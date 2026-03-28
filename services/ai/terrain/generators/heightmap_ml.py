"""ML-accelerated heightmap generator with noise fallback."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

import numpy as np

from .noise import SimplexNoise

logger = logging.getLogger(__name__)

_MODEL_PATH = Path(__file__).parent.parent / "models" / "heightmap.onnx"


class HeightmapGenerator:
    """Generate heightmaps using an ONNX model when available, otherwise multi-octave noise."""

    def __init__(self, model_path: Optional[Path] = None) -> None:
        self._model_path = model_path or _MODEL_PATH
        self._session = self._try_load_model()

    def _try_load_model(self) -> object | None:
        if not self._model_path.exists():
            logger.info("ONNX model not found at %s — using noise fallback", self._model_path)
            return None
        try:
            import onnxruntime as ort

            session = ort.InferenceSession(
                str(self._model_path),
                providers=["CPUExecutionProvider"],
            )
            logger.info("Loaded ONNX heightmap model from %s", self._model_path)
            return session
        except Exception as exc:
            logger.warning("Failed to load ONNX model: %s — using noise fallback", exc)
            return None

    # ── public API ───────────────────────────────────────────────────────

    def generate(
        self,
        size: int,
        biome_map: np.ndarray | None = None,
        style_embedding: np.ndarray | None = None,
        seed: int = 0,
    ) -> np.ndarray:
        """Return a 2-D float32 heightmap of shape (size, size) in [0, 1]."""
        if self._session is not None:
            return self._generate_ml(size, biome_map, style_embedding)
        return self._generate_noise(size, seed)

    # ── ML path ──────────────────────────────────────────────────────────

    def _generate_ml(
        self,
        size: int,
        biome_map: np.ndarray | None,
        style_embedding: np.ndarray | None,
    ) -> np.ndarray:
        session = self._session
        input_name = session.get_inputs()[0].name
        input_shape = session.get_inputs()[0].shape

        if biome_map is None:
            biome_map = np.full((size, size), 0.5, dtype=np.float32)
        else:
            biome_map = np.asarray(biome_map, dtype=np.float32)
            if biome_map.shape != (size, size):
                from PIL import Image

                img = Image.fromarray(biome_map)
                img = img.resize((size, size), Image.BILINEAR)
                biome_map = np.array(img, dtype=np.float32)

        if style_embedding is None:
            style_embedding = np.zeros(64, dtype=np.float32)

        # Build input tensor — [batch, channels, H, W]
        biome_channel = biome_map.reshape(1, 1, size, size)
        style_tiled = np.tile(
            style_embedding.reshape(1, -1, 1, 1),
            (1, 1, size, size),
        ).astype(np.float32)

        # Pad/truncate channels to match model expectation
        expected_channels = input_shape[1] if len(input_shape) > 1 else 1
        inp = np.concatenate([biome_channel, style_tiled], axis=1)
        current_c = inp.shape[1]
        if current_c < expected_channels:
            pad = np.zeros((1, expected_channels - current_c, size, size), dtype=np.float32)
            inp = np.concatenate([inp, pad], axis=1)
        elif current_c > expected_channels:
            inp = inp[:, :expected_channels, :, :]

        outputs = session.run(None, {input_name: inp})
        raw = outputs[0].squeeze()

        if raw.shape != (size, size):
            from PIL import Image

            img = Image.fromarray(raw.astype(np.float32))
            img = img.resize((size, size), Image.BILINEAR)
            raw = np.array(img, dtype=np.float32)

        return self.normalize(raw)

    # ── Noise fallback ───────────────────────────────────────────────────

    def _generate_noise(self, size: int, seed: int) -> np.ndarray:
        noise = SimplexNoise(seed=seed)
        scale = 0.007
        hmap = np.zeros((size, size), dtype=np.float64)

        for y in range(size):
            for x in range(size):
                base = noise.fbm2d(x * scale, y * scale, octaves=6)
                ridge = noise.ridged_noise2d(
                    x * scale * 0.5, y * scale * 0.5, octaves=4
                )
                detail = noise.fbm2d(
                    x * scale * 4.0 + 1000, y * scale * 4.0 + 1000, octaves=3
                )
                hmap[y, x] = base * 0.5 + ridge * 0.35 + detail * 0.15

        return self.normalize(hmap).astype(np.float32)

    # ── Utilities ────────────────────────────────────────────────────────

    @staticmethod
    def normalize(heightmap: np.ndarray) -> np.ndarray:
        """Normalize heightmap values to [0, 1]."""
        mn, mx = heightmap.min(), heightmap.max()
        if mx - mn < 1e-9:
            return np.full_like(heightmap, 0.5)
        return (heightmap - mn) / (mx - mn)

    @staticmethod
    def apply_erosion(heightmap: np.ndarray, iterations: int = 50) -> np.ndarray:
        """Simulated hydraulic erosion on a heightmap.

        A simplified particle-based erosion:
        - Drop water particles at random positions
        - Each particle flows downhill, picks up sediment, and deposits it
        """
        h = heightmap.copy().astype(np.float64)
        rows, cols = h.shape
        rng = np.random.RandomState(42)

        inertia = 0.05
        capacity_factor = 4.0
        deposition_rate = 0.3
        erosion_rate = 0.3
        evaporation = 0.01
        gravity = 4.0
        min_slope = 0.01

        for _ in range(iterations * 100):
            px = rng.uniform(1, cols - 2)
            py = rng.uniform(1, rows - 2)
            dx, dy = 0.0, 0.0
            speed = 1.0
            water = 1.0
            sediment = 0.0

            for _ in range(64):
                ix, iy = int(px), int(py)
                if ix < 1 or ix >= cols - 1 or iy < 1 or iy >= rows - 1:
                    break

                # Gradient via central differences
                gx = h[iy, min(ix + 1, cols - 1)] - h[iy, max(ix - 1, 0)]
                gy = h[min(iy + 1, rows - 1), ix] - h[max(iy - 1, 0), ix]

                dx = dx * inertia - gx * (1 - inertia)
                dy = dy * inertia - gy * (1 - inertia)

                length = max(np.sqrt(dx * dx + dy * dy), 1e-6)
                dx /= length
                dy /= length

                npx, npy = px + dx, py + dy
                nix, niy = int(npx), int(npy)
                if nix < 0 or nix >= cols or niy < 0 or niy >= rows:
                    break

                height_diff = h[niy, nix] - h[iy, ix]
                carry_capacity = max(-height_diff, min_slope) * speed * water * capacity_factor

                if sediment > carry_capacity or height_diff > 0:
                    deposit = min(sediment, max(height_diff, 0.0)) if height_diff > 0 else (
                        (sediment - carry_capacity) * deposition_rate
                    )
                    sediment -= deposit
                    h[iy, ix] += deposit
                else:
                    erode = min((carry_capacity - sediment) * erosion_rate, -height_diff)
                    sediment += erode
                    h[iy, ix] -= erode

                speed = max(0.0, speed + height_diff * gravity)
                water *= (1 - evaporation)
                px, py = npx, npy

                if water < 0.001:
                    break

        mn, mx = h.min(), h.max()
        if mx - mn > 1e-9:
            h = (h - mn) / (mx - mn)
        return h.astype(np.float32)
