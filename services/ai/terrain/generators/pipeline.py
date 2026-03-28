"""World generation pipeline orchestrator."""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field
from typing import Callable, Optional

import numpy as np

from .biome import BiomeClassifier, BiomeType, BlockId
from .heightmap_ml import HeightmapGenerator
from .noise import SimplexNoise
from .structures import BlockPlacement, StructureGenerator, StructureStyle


@dataclass(frozen=True)
class ChunkInfo:
    x: int
    z: int
    biome: str
    min_y: int
    max_y: int


@dataclass(frozen=True)
class WorldManifest:
    world_id: str
    chunks: list[ChunkInfo]
    heightmap_url: str | None = None
    step_timings: dict[str, float] = field(default_factory=dict)


ProgressCallback = Callable[[str, float], None]


def _noop_progress(step: str, pct: float) -> None:
    pass


class WorldGenerationPipeline:
    """Orchestrate the full terrain-generation flow."""

    CHUNK_SIZE: int = 16

    def __init__(self, progress_cb: Optional[ProgressCallback] = None) -> None:
        self._progress = progress_cb or _noop_progress

    async def generate(
        self,
        prompt: str,
        seed: int,
        size: int,
        params: object | None = None,
    ) -> WorldManifest:
        timings: dict[str, float] = {}
        world_id = str(uuid.uuid4())

        # Import here to access Pydantic model without circular dep at module level
        from ..main import WorldParams  # type: ignore[import-untyped]

        wp: WorldParams = params if params is not None else WorldParams()

        # Step 1 — Parse prompt (already done upstream, params provided)
        t0 = time.perf_counter()
        self._progress("parse_prompt", 0.0)
        timings["parse_prompt"] = time.perf_counter() - t0
        self._progress("parse_prompt", 1.0)

        # Step 2 — Generate heightmap
        t0 = time.perf_counter()
        self._progress("generate_heightmap", 0.0)
        hm_gen = HeightmapGenerator()
        heightmap = hm_gen.generate(size=size, seed=seed)
        heightmap = heightmap * wp.elevation_scale
        heightmap = HeightmapGenerator.normalize(heightmap)
        timings["generate_heightmap"] = time.perf_counter() - t0
        self._progress("generate_heightmap", 1.0)

        # Step 3 — Climate maps (temperature / humidity via noise)
        t0 = time.perf_counter()
        self._progress("classify_biomes", 0.0)
        noise = SimplexNoise(seed=seed + 1000)
        noise_h = SimplexNoise(seed=seed + 2000)

        temp_map = np.zeros((size, size), dtype=np.float32)
        humid_map = np.zeros((size, size), dtype=np.float32)
        for y in range(size):
            for x in range(size):
                temp_map[y, x] = (noise.fbm2d(x * 0.005, y * 0.005, octaves=3) + 1.0) / 2.0
                humid_map[y, x] = (noise_h.fbm2d(x * 0.005, y * 0.005, octaves=3) + 1.0) / 2.0

        # Clamp to requested ranges
        t_lo, t_hi = wp.temperature_range
        temp_map = temp_map * (t_hi - t_lo) + t_lo
        h_lo, h_hi = wp.humidity_range
        humid_map = humid_map * (h_hi - h_lo) + h_lo

        classifier = BiomeClassifier()
        biome_grid = np.empty((size, size), dtype=object)
        for y in range(size):
            for x in range(size):
                biome_grid[y, x] = classifier.classify(
                    float(temp_map[y, x]),
                    float(humid_map[y, x]),
                    float(heightmap[y, x]),
                )
        timings["classify_biomes"] = time.perf_counter() - t0
        self._progress("classify_biomes", 1.0)

        # Step 4 — Generate block columns
        t0 = time.perf_counter()
        self._progress("generate_blocks", 0.0)
        max_height = 128
        # We represent only metadata per chunk, not full block arrays (kept lightweight)
        chunks_per_axis = max(1, size // self.CHUNK_SIZE)
        chunks: list[ChunkInfo] = []

        for cz in range(chunks_per_axis):
            for cx in range(chunks_per_axis):
                bx = cx * self.CHUNK_SIZE
                bz = cz * self.CHUNK_SIZE
                mid_x = min(bx + self.CHUNK_SIZE // 2, size - 1)
                mid_z = min(bz + self.CHUNK_SIZE // 2, size - 1)
                elev = float(heightmap[mid_z, mid_x])
                biome: BiomeType = biome_grid[mid_z, mid_x]
                col_height = int(elev * (max_height - 1)) + 1
                min_y = 0
                if elev < wp.sea_level:
                    min_y = -int((wp.sea_level - elev) * max_height)
                chunks.append(
                    ChunkInfo(x=cx, z=cz, biome=biome.value, min_y=min_y, max_y=col_height)
                )
        timings["generate_blocks"] = time.perf_counter() - t0
        self._progress("generate_blocks", 1.0)

        # Step 5 — Place structures
        t0 = time.perf_counter()
        self._progress("place_structures", 0.0)
        if wp.structure_density > 0:
            struct_gen = StructureGenerator(seed=seed)
            num_villages = max(1, int(wp.structure_density * 3))
            for _ in range(num_villages):
                struct_gen.generate_village(size=min(size, 64), style=StructureStyle.MEDIEVAL)
        timings["place_structures"] = time.perf_counter() - t0
        self._progress("place_structures", 1.0)

        # Step 6 — Decorate (trees, grass, flowers)
        t0 = time.perf_counter()
        self._progress("decorate", 0.0)
        # Decoration is implicit — density values stored per biome for client-side placement
        timings["decorate"] = time.perf_counter() - t0
        self._progress("decorate", 1.0)

        # Step 7 — Generate metadata
        t0 = time.perf_counter()
        self._progress("generate_metadata", 0.0)
        timings["generate_metadata"] = time.perf_counter() - t0
        self._progress("generate_metadata", 1.0)

        return WorldManifest(
            world_id=world_id,
            chunks=chunks,
            step_timings=timings,
        )
