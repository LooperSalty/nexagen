"""Algorithmic structure generation for villages, dungeons, and temples."""

from __future__ import annotations

import random
from dataclasses import dataclass, field
from enum import Enum

from .biome import BlockId


@dataclass(frozen=True)
class BlockPlacement:
    x: int
    y: int
    z: int
    block_id: int


class StructureStyle(str, Enum):
    MEDIEVAL = "medieval"
    EASTERN = "eastern"
    DESERT = "desert"
    NORDIC = "nordic"


class DungeonDifficulty(str, Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class TempleMaterial(str, Enum):
    STONE = "stone"
    SANDSTONE = "sandstone"
    OBSIDIAN = "obsidian"
    QUARTZ = "quartz"


class StructureGenerator:
    """Generate voxel structures algorithmically."""

    def __init__(self, seed: int = 0) -> None:
        self._rng = random.Random(seed)

    # ── Village ──────────────────────────────────────────────────────────

    def generate_village(
        self,
        size: int = 64,
        style: StructureStyle = StructureStyle.MEDIEVAL,
    ) -> list[BlockPlacement]:
        """Generate a village as a list of block placements."""
        placements: list[BlockPlacement] = []
        wall, floor, roof = self._style_materials(style)

        num_buildings = max(3, size // 16)
        placed_rects: list[tuple[int, int, int, int]] = []

        for _ in range(num_buildings):
            bw = self._rng.randint(5, 9)
            bd = self._rng.randint(5, 9)
            bh = self._rng.randint(4, 6)

            for attempt in range(20):
                bx = self._rng.randint(2, size - bw - 2)
                bz = self._rng.randint(2, size - bd - 2)
                if not self._overlaps(bx, bz, bw, bd, placed_rects, margin=3):
                    break
            else:
                continue

            placed_rects.append((bx, bz, bw, bd))
            placements.extend(self._build_house(bx, 0, bz, bw, bd, bh, wall, floor, roof))

        # Paths between buildings
        for i in range(len(placed_rects) - 1):
            r1 = placed_rects[i]
            r2 = placed_rects[i + 1]
            cx1, cz1 = r1[0] + r1[2] // 2, r1[1] + r1[3] // 2
            cx2, cz2 = r2[0] + r2[2] // 2, r2[1] + r2[3] // 2
            placements.extend(self._build_path(cx1, cz1, cx2, cz2))

        return placements

    # ── Dungeon ──────────────────────────────────────────────────────────

    def generate_dungeon(
        self,
        size: int = 48,
        difficulty: DungeonDifficulty = DungeonDifficulty.MEDIUM,
    ) -> list[BlockPlacement]:
        """Generate a dungeon layout underground."""
        placements: list[BlockPlacement] = []
        wall = BlockId.COBBLESTONE
        floor_block = BlockId.STONE

        room_count = {"easy": 4, "medium": 7, "hard": 12}[difficulty.value]
        rooms: list[tuple[int, int, int, int]] = []

        for _ in range(room_count):
            rw = self._rng.randint(5, 10)
            rd = self._rng.randint(5, 10)
            rh = self._rng.randint(4, 6)

            for _attempt in range(30):
                rx = self._rng.randint(1, size - rw - 1)
                rz = self._rng.randint(1, size - rd - 1)
                if not self._overlaps(rx, rz, rw, rd, rooms, margin=1):
                    break
            else:
                continue

            rooms.append((rx, rz, rw, rd))

            # Carve room (floor + walls + ceiling)
            for lx in range(rw):
                for lz in range(rd):
                    placements.append(BlockPlacement(rx + lx, -1, rz + lz, floor_block))
                    placements.append(BlockPlacement(rx + lx, -1 + rh, rz + lz, wall))
                    # Walls on edges
                    if lx == 0 or lx == rw - 1 or lz == 0 or lz == rd - 1:
                        for ly in range(rh):
                            placements.append(BlockPlacement(rx + lx, -1 + ly, rz + lz, wall))

        # Corridors
        for i in range(len(rooms) - 1):
            r1, r2 = rooms[i], rooms[i + 1]
            cx1, cz1 = r1[0] + r1[2] // 2, r1[1] + r1[3] // 2
            cx2, cz2 = r2[0] + r2[2] // 2, r2[1] + r2[3] // 2
            placements.extend(self._build_corridor(cx1, cz1, cx2, cz2, floor_block, wall))

        return placements

    # ── Temple ───────────────────────────────────────────────────────────

    def generate_temple(
        self,
        size: int = 32,
        material: TempleMaterial = TempleMaterial.STONE,
    ) -> list[BlockPlacement]:
        """Generate a temple structure."""
        placements: list[BlockPlacement] = []
        mat_map: dict[TempleMaterial, int] = {
            TempleMaterial.STONE: BlockId.STONE,
            TempleMaterial.SANDSTONE: BlockId.SANDSTONE,
            TempleMaterial.OBSIDIAN: BlockId.STONE,
            TempleMaterial.QUARTZ: BlockId.GLASS,
        }
        block = mat_map[material]
        cx, cz = size // 2, size // 2

        # Base platform (3 tiered steps)
        for tier in range(3):
            half = (size // 2) - tier * 3
            for lx in range(-half, half + 1):
                for lz in range(-half, half + 1):
                    placements.append(BlockPlacement(cx + lx, tier, cz + lz, block))

        base_y = 3
        # Pillars
        pillar_offsets = [
            (-size // 4, -size // 4),
            (size // 4, -size // 4),
            (-size // 4, size // 4),
            (size // 4, size // 4),
            (0, -size // 4),
            (0, size // 4),
            (-size // 4, 0),
            (size // 4, 0),
        ]
        pillar_height = 8
        for ox, oz in pillar_offsets:
            for py in range(pillar_height):
                placements.append(BlockPlacement(cx + ox, base_y + py, cz + oz, block))

        # Roof slab
        roof_half = size // 4 + 1
        for lx in range(-roof_half, roof_half + 1):
            for lz in range(-roof_half, roof_half + 1):
                placements.append(BlockPlacement(cx + lx, base_y + pillar_height, cz + lz, block))

        # Peaked roof (pyramid)
        for layer in range(roof_half):
            h = roof_half - layer
            for lx in range(-h, h + 1):
                for lz in range(-h, h + 1):
                    if abs(lx) == h or abs(lz) == h:
                        placements.append(
                            BlockPlacement(cx + lx, base_y + pillar_height + 1 + layer, cz + lz, block)
                        )

        return placements

    # ── Private helpers ──────────────────────────────────────────────────

    @staticmethod
    def _overlaps(
        x: int, z: int, w: int, d: int,
        existing: list[tuple[int, int, int, int]],
        margin: int = 2,
    ) -> bool:
        for ex, ez, ew, ed in existing:
            if (
                x - margin < ex + ew
                and x + w + margin > ex
                and z - margin < ez + ed
                and z + d + margin > ez
            ):
                return True
        return False

    def _style_materials(
        self, style: StructureStyle
    ) -> tuple[int, int, int]:
        """Return (wall, floor, roof) block IDs for a given style."""
        styles: dict[StructureStyle, tuple[int, int, int]] = {
            StructureStyle.MEDIEVAL: (BlockId.COBBLESTONE, BlockId.PLANKS, BlockId.OAK_LOG),
            StructureStyle.EASTERN: (BlockId.PLANKS, BlockId.PLANKS, BlockId.TERRACOTTA),
            StructureStyle.DESERT: (BlockId.SANDSTONE, BlockId.SAND, BlockId.SANDSTONE),
            StructureStyle.NORDIC: (BlockId.SPRUCE_LOG, BlockId.PLANKS, BlockId.SPRUCE_LOG),
        }
        return styles.get(style, styles[StructureStyle.MEDIEVAL])

    def _build_house(
        self,
        bx: int, by: int, bz: int,
        w: int, d: int, h: int,
        wall: int, floor_block: int, roof: int,
    ) -> list[BlockPlacement]:
        blocks: list[BlockPlacement] = []
        # Floor
        for lx in range(w):
            for lz in range(d):
                blocks.append(BlockPlacement(bx + lx, by, bz + lz, floor_block))
        # Walls
        for ly in range(1, h):
            for lx in range(w):
                for lz in range(d):
                    if lx == 0 or lx == w - 1 or lz == 0 or lz == d - 1:
                        # Door opening
                        if lx == w // 2 and lz == 0 and ly <= 2:
                            continue
                        # Window
                        if ly == 2 and ((lx == w // 2 and lz == d - 1) or (lz == d // 2 and lx == 0)):
                            blocks.append(BlockPlacement(bx + lx, by + ly, bz + lz, BlockId.GLASS))
                            continue
                        blocks.append(BlockPlacement(bx + lx, by + ly, bz + lz, wall))
        # Flat roof
        for lx in range(w):
            for lz in range(d):
                blocks.append(BlockPlacement(bx + lx, by + h, bz + lz, roof))
        return blocks

    def _build_path(
        self, x1: int, z1: int, x2: int, z2: int
    ) -> list[BlockPlacement]:
        blocks: list[BlockPlacement] = []
        cx, cz = x1, z1
        while cx != x2 or cz != z2:
            blocks.append(BlockPlacement(cx, 0, cz, BlockId.GRAVEL))
            if cx != x2:
                cx += 1 if x2 > cx else -1
            elif cz != z2:
                cz += 1 if z2 > cz else -1
        return blocks

    def _build_corridor(
        self,
        x1: int, z1: int, x2: int, z2: int,
        floor_block: int, wall: int,
    ) -> list[BlockPlacement]:
        blocks: list[BlockPlacement] = []
        cx, cz = x1, z1
        while cx != x2 or cz != z2:
            for dy in range(-1, 3):
                if dy == -1 or dy == 3:
                    blocks.append(BlockPlacement(cx, dy, cz, wall))
                else:
                    blocks.append(BlockPlacement(cx, dy, cz, BlockId.AIR))
            if cx != x2:
                cx += 1 if x2 > cx else -1
            elif cz != z2:
                cz += 1 if z2 > cz else -1
        return blocks
