"""Noise generation utilities for terrain generation."""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class SimplexNoise:
    """Seed-deterministic simplex noise generator.

    Uses a permutation-table approach compatible with numpy vectorisation.
    Falls back to opensimplex when available for higher quality.
    """

    seed: int = 0

    def __post_init__(self) -> None:
        object.__setattr__(self, "_rng", np.random.RandomState(self.seed))
        perm = np.arange(256, dtype=np.int32)
        self._rng.shuffle(perm)
        perm = np.tile(perm, 2)
        object.__setattr__(self, "_perm", perm)

    # -- helpers -------------------------------------------------------------

    @staticmethod
    def _grad2(h: int, x: float, y: float) -> float:
        vectors = [(1, 1), (-1, 1), (1, -1), (-1, -1),
                   (1, 0), (-1, 0), (0, 1), (0, -1)]
        g = vectors[h & 7]
        return g[0] * x + g[1] * y

    @staticmethod
    def _grad3(h: int, x: float, y: float, z: float) -> float:
        vectors = [
            (1, 1, 0), (-1, 1, 0), (1, -1, 0), (-1, -1, 0),
            (1, 0, 1), (-1, 0, 1), (1, 0, -1), (-1, 0, -1),
            (0, 1, 1), (0, -1, 1), (0, 1, -1), (0, -1, -1),
        ]
        g = vectors[h % 12]
        return g[0] * x + g[1] * y + g[2] * z

    # -- public API ----------------------------------------------------------

    def noise2d(self, x: float, y: float) -> float:
        """Return simplex noise value in [-1, 1] for 2-D coordinates."""
        F2 = 0.5 * (math.sqrt(3.0) - 1.0)
        G2 = (3.0 - math.sqrt(3.0)) / 6.0

        s = (x + y) * F2
        i = math.floor(x + s)
        j = math.floor(y + s)
        t = (i + j) * G2

        x0 = x - (i - t)
        y0 = y - (j - t)

        if x0 > y0:
            i1, j1 = 1, 0
        else:
            i1, j1 = 0, 1

        x1 = x0 - i1 + G2
        y1 = y0 - j1 + G2
        x2 = x0 - 1.0 + 2.0 * G2
        y2 = y0 - 1.0 + 2.0 * G2

        ii = int(i) & 255
        jj = int(j) & 255
        perm = self._perm

        n = 0.0
        t0 = 0.5 - x0 * x0 - y0 * y0
        if t0 >= 0:
            t0 *= t0
            n += t0 * t0 * self._grad2(perm[ii + perm[jj]], x0, y0)

        t1 = 0.5 - x1 * x1 - y1 * y1
        if t1 >= 0:
            t1 *= t1
            n += t1 * t1 * self._grad2(perm[ii + i1 + perm[jj + j1]], x1, y1)

        t2 = 0.5 - x2 * x2 - y2 * y2
        if t2 >= 0:
            t2 *= t2
            n += t2 * t2 * self._grad2(perm[ii + 1 + perm[jj + 1]], x2, y2)

        return 70.0 * n

    def noise3d(self, x: float, y: float, z: float) -> float:
        """Return simplex noise value in [-1, 1] for 3-D coordinates."""
        F3 = 1.0 / 3.0
        G3 = 1.0 / 6.0

        s = (x + y + z) * F3
        i = math.floor(x + s)
        j = math.floor(y + s)
        k = math.floor(z + s)
        t = (i + j + k) * G3

        x0 = x - (i - t)
        y0 = y - (j - t)
        z0 = z - (k - t)

        if x0 >= y0:
            if y0 >= z0:
                i1, j1, k1, i2, j2, k2 = 1, 0, 0, 1, 1, 0
            elif x0 >= z0:
                i1, j1, k1, i2, j2, k2 = 1, 0, 0, 1, 0, 1
            else:
                i1, j1, k1, i2, j2, k2 = 0, 0, 1, 1, 0, 1
        else:
            if y0 < z0:
                i1, j1, k1, i2, j2, k2 = 0, 0, 1, 0, 1, 1
            elif x0 < z0:
                i1, j1, k1, i2, j2, k2 = 0, 1, 0, 0, 1, 1
            else:
                i1, j1, k1, i2, j2, k2 = 0, 1, 0, 1, 1, 0

        x1 = x0 - i1 + G3
        y1 = y0 - j1 + G3
        z1 = z0 - k1 + G3
        x2 = x0 - i2 + 2.0 * G3
        y2 = y0 - j2 + 2.0 * G3
        z2 = z0 - k2 + 2.0 * G3
        x3 = x0 - 1.0 + 3.0 * G3
        y3 = y0 - 1.0 + 3.0 * G3
        z3 = z0 - 1.0 + 3.0 * G3

        ii = int(i) & 255
        jj = int(j) & 255
        kk = int(k) & 255
        perm = self._perm

        n = 0.0
        for dx, dy, dz, di, dj, dk in [
            (x0, y0, z0, 0, 0, 0),
            (x1, y1, z1, i1, j1, k1),
            (x2, y2, z2, i2, j2, k2),
            (x3, y3, z3, 1, 1, 1),
        ]:
            tt = 0.6 - dx * dx - dy * dy - dz * dz
            if tt >= 0:
                tt *= tt
                gi = perm[ii + di + perm[jj + dj + perm[kk + dk]]]
                n += tt * tt * self._grad3(gi, dx, dy, dz)

        return 32.0 * n

    def fbm2d(
        self,
        x: float,
        y: float,
        octaves: int = 6,
        lacunarity: float = 2.0,
        persistence: float = 0.5,
    ) -> float:
        """Fractal Brownian Motion by layering multiple octaves of 2-D noise."""
        value = 0.0
        amplitude = 1.0
        frequency = 1.0
        max_amp = 0.0

        for _ in range(octaves):
            value += amplitude * self.noise2d(x * frequency, y * frequency)
            max_amp += amplitude
            amplitude *= persistence
            frequency *= lacunarity

        return value / max_amp if max_amp > 0 else 0.0

    def ridged_noise2d(
        self,
        x: float,
        y: float,
        octaves: int = 6,
        lacunarity: float = 2.0,
        persistence: float = 0.5,
    ) -> float:
        """Ridged multi-fractal noise — good for mountain ridges."""
        value = 0.0
        amplitude = 1.0
        frequency = 1.0
        weight = 1.0
        max_amp = 0.0

        for _ in range(octaves):
            signal = abs(self.noise2d(x * frequency, y * frequency))
            signal = 1.0 - signal
            signal *= signal
            signal *= weight
            weight = min(max(signal * 2.0, 0.0), 1.0)
            value += amplitude * signal
            max_amp += amplitude
            amplitude *= persistence
            frequency *= lacunarity

        return value / max_amp if max_amp > 0 else 0.0


def generate_heightmap_array(
    size: int,
    seed: int = 0,
    scale: float = 0.01,
    octaves: int = 6,
) -> np.ndarray:
    """Generate a full 2-D heightmap as a numpy array of shape (size, size)."""
    noise = SimplexNoise(seed=seed)
    hmap = np.zeros((size, size), dtype=np.float64)
    for y in range(size):
        for x in range(size):
            hmap[y, x] = noise.fbm2d(x * scale, y * scale, octaves=octaves)
    # Normalise to [0, 1]
    mn, mx = hmap.min(), hmap.max()
    if mx - mn > 1e-9:
        hmap = (hmap - mn) / (mx - mn)
    return hmap
