"""Procedural texture generation for creatures."""

from __future__ import annotations

import math
import random
from typing import Tuple

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from .lsystem import CreatureAesthetic


class TextureGenerator:
    """Generate procedural creature textures as PIL Images."""

    def generate(self, aesthetic: CreatureAesthetic, uv_size: int = 256) -> Image.Image:
        """Return a UV-ready texture image for the given aesthetic."""
        base = self._fill_base(uv_size, aesthetic.base_color)

        pattern_fn = {
            "solid": self._pattern_solid,
            "spots": self._pattern_spots,
            "stripes": self._pattern_stripes,
            "gradient": self._pattern_gradient,
        }.get(aesthetic.pattern_type, self._pattern_solid)

        base = pattern_fn(base, aesthetic)

        material_fn = {
            "scales": self._material_scales,
            "fur": self._material_fur,
            "chitin": self._material_chitin,
            "crystal": self._material_crystal,
            "skin": self._material_skin,
        }.get(aesthetic.material, self._material_skin)

        base = material_fn(base, aesthetic)

        if aesthetic.glow:
            base = self._apply_glow(base, aesthetic)

        return base

    # ── Base fill ────────────────────────────────────────────────────────

    @staticmethod
    def _fill_base(size: int, color: tuple[int, int, int]) -> Image.Image:
        img = Image.new("RGB", (size, size), color)
        # Add slight noise for organic feel
        arr = np.array(img, dtype=np.int16)
        noise = np.random.randint(-8, 9, arr.shape, dtype=np.int16)
        arr = np.clip(arr + noise, 0, 255).astype(np.uint8)
        return Image.fromarray(arr)

    # ── Patterns ─────────────────────────────────────────────────────────

    @staticmethod
    def _pattern_solid(img: Image.Image, aesthetic: CreatureAesthetic) -> Image.Image:
        return img

    @staticmethod
    def _pattern_spots(img: Image.Image, aesthetic: CreatureAesthetic) -> Image.Image:
        draw = ImageDraw.Draw(img)
        w, h = img.size
        rng = random.Random(hash(aesthetic.base_color))
        r, g, b = aesthetic.base_color
        spot_color = (max(0, r - 60), max(0, g - 60), max(0, b - 60))

        num_spots = rng.randint(20, 60)
        for _ in range(num_spots):
            cx = rng.randint(0, w - 1)
            cy = rng.randint(0, h - 1)
            radius = rng.randint(3, 12)
            draw.ellipse(
                [cx - radius, cy - radius, cx + radius, cy + radius],
                fill=spot_color,
            )
        return img

    @staticmethod
    def _pattern_stripes(img: Image.Image, aesthetic: CreatureAesthetic) -> Image.Image:
        draw = ImageDraw.Draw(img)
        w, h = img.size
        rng = random.Random(hash(aesthetic.base_color))
        r, g, b = aesthetic.base_color
        stripe_color = (max(0, r - 50), max(0, g - 50), max(0, b - 50))

        stripe_width = rng.randint(6, 16)
        angle = rng.uniform(-0.3, 0.3)

        for y in range(0, h, stripe_width * 2):
            for dy in range(stripe_width):
                if y + dy >= h:
                    break
                for x in range(w):
                    shifted_y = y + dy + int(x * math.tan(angle))
                    if 0 <= shifted_y < h:
                        draw.point((x, shifted_y), fill=stripe_color)
        return img

    @staticmethod
    def _pattern_gradient(img: Image.Image, aesthetic: CreatureAesthetic) -> Image.Image:
        w, h = img.size
        arr = np.array(img, dtype=np.float32)
        r, g, b = aesthetic.base_color

        # Belly is lighter, back is darker
        for y in range(h):
            factor = 0.6 + 0.8 * (y / h)
            arr[y, :, :] *= factor

        arr = np.clip(arr, 0, 255).astype(np.uint8)
        return Image.fromarray(arr)

    # ── Material overlays ────────────────────────────────────────────────

    @staticmethod
    def _material_scales(img: Image.Image, aesthetic: CreatureAesthetic) -> Image.Image:
        """Hexagonal scale pattern overlay."""
        draw = ImageDraw.Draw(img)
        w, h = img.size
        r, g, b = aesthetic.base_color
        scale_size = 8

        for row in range(0, h, scale_size):
            offset = (scale_size // 2) if (row // scale_size) % 2 else 0
            for col in range(offset, w, scale_size):
                highlight = (
                    min(255, r + 20),
                    min(255, g + 20),
                    min(255, b + 20),
                )
                draw.arc(
                    [col, row, col + scale_size, row + scale_size],
                    200, 340,
                    fill=highlight,
                )
        return img

    @staticmethod
    def _material_fur(img: Image.Image, aesthetic: CreatureAesthetic) -> Image.Image:
        """Fine directional noise to simulate fur."""
        arr = np.array(img, dtype=np.int16)
        h, w, _ = arr.shape
        rng = np.random.RandomState(42)

        # Directional streaks
        for _ in range(w * 2):
            x = rng.randint(0, w - 1)
            y = rng.randint(0, h - 4)
            length = rng.randint(3, 8)
            shade = rng.randint(-20, 20)
            for dy in range(length):
                if y + dy < h:
                    arr[y + dy, x, :] = np.clip(arr[y + dy, x, :] + shade, 0, 255)

        return Image.fromarray(arr.astype(np.uint8))

    @staticmethod
    def _material_chitin(img: Image.Image, aesthetic: CreatureAesthetic) -> Image.Image:
        """Glossy chitin: sharpen + high contrast."""
        arr = np.array(img, dtype=np.float32)
        # Increase contrast
        mean = arr.mean()
        arr = (arr - mean) * 1.4 + mean
        arr = np.clip(arr, 0, 255).astype(np.uint8)
        result = Image.fromarray(arr)
        result = result.filter(ImageFilter.SHARPEN)
        return result

    @staticmethod
    def _material_crystal(img: Image.Image, aesthetic: CreatureAesthetic) -> Image.Image:
        """Faceted crystalline look with bright specular highlights."""
        draw = ImageDraw.Draw(img)
        w, h = img.size
        rng = random.Random(42)

        for _ in range(30):
            cx = rng.randint(0, w - 1)
            cy = rng.randint(0, h - 1)
            size = rng.randint(5, 20)
            points = []
            n_sides = rng.choice([4, 5, 6])
            for i in range(n_sides):
                angle = 2.0 * math.pi * i / n_sides + rng.uniform(-0.2, 0.2)
                px = cx + int(size * math.cos(angle))
                py = cy + int(size * math.sin(angle))
                points.append((px, py))
            r, g, b = aesthetic.base_color
            facet_color = (
                min(255, r + rng.randint(20, 60)),
                min(255, g + rng.randint(20, 60)),
                min(255, b + rng.randint(20, 60)),
            )
            draw.polygon(points, fill=facet_color, outline=(255, 255, 255))

        return img

    @staticmethod
    def _material_skin(img: Image.Image, aesthetic: CreatureAesthetic) -> Image.Image:
        """Subtle smooth skin — just a light blur."""
        return img.filter(ImageFilter.SMOOTH)

    # ── Glow effect ──────────────────────────────────────────────────────

    @staticmethod
    def _apply_glow(img: Image.Image, aesthetic: CreatureAesthetic) -> Image.Image:
        """Add a luminous glow layer."""
        arr = np.array(img, dtype=np.float32)
        h, w, _ = arr.shape
        cy, cx = h // 2, w // 2
        max_dist = math.sqrt(cx ** 2 + cy ** 2)

        for y in range(h):
            for x in range(w):
                dist = math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
                glow_factor = max(0.0, 1.0 - dist / max_dist) * 0.4
                arr[y, x, :] = np.clip(arr[y, x, :] + glow_factor * 80, 0, 255)

        return Image.fromarray(arr.astype(np.uint8))
