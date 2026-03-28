"""Biome classification inspired by the Whittaker diagram."""

from __future__ import annotations

from enum import Enum
from typing import Optional


class BiomeType(str, Enum):
    OCEAN = "ocean"
    BEACH = "beach"
    TUNDRA = "tundra"
    TAIGA = "taiga"
    SNOW = "snow"
    PLAINS = "plains"
    FOREST = "forest"
    DARK_FOREST = "dark_forest"
    JUNGLE = "jungle"
    SWAMP = "swamp"
    DESERT = "desert"
    SAVANNA = "savanna"
    MOUNTAINS = "mountains"
    MESA = "mesa"
    MUSHROOM = "mushroom"


class BlockId(int, Enum):
    AIR = 0
    STONE = 1
    DIRT = 2
    GRASS = 3
    SAND = 4
    SNOW_BLOCK = 5
    WATER = 6
    GRAVEL = 7
    CLAY = 8
    TERRACOTTA = 9
    MYCELIUM = 10
    PODZOL = 11
    MUD = 12
    RED_SAND = 13
    ICE = 14
    SANDSTONE = 15
    OAK_LOG = 16
    OAK_LEAVES = 17
    SPRUCE_LOG = 18
    SPRUCE_LEAVES = 19
    JUNGLE_LOG = 20
    JUNGLE_LEAVES = 21
    BIRCH_LOG = 22
    BIRCH_LEAVES = 23
    DARK_OAK_LOG = 24
    DARK_OAK_LEAVES = 25
    MUSHROOM_BLOCK = 26
    CACTUS = 27
    COBBLESTONE = 28
    PLANKS = 29
    GLASS = 30


class TreeType(str, Enum):
    OAK = "oak"
    BIRCH = "birch"
    SPRUCE = "spruce"
    JUNGLE = "jungle"
    DARK_OAK = "dark_oak"
    ACACIA = "acacia"
    MUSHROOM_GIANT = "mushroom_giant"
    CACTUS = "cactus"


# ── Whittaker-inspired classification table ──────────────────────────────
# Each entry: (temp_min, temp_max, humid_min, humid_max, elev_min, elev_max, biome)
_BIOME_RULES: list[tuple[float, float, float, float, float, float, BiomeType]] = [
    # Ocean / Beach — low elevation
    (0.0, 1.0, 0.0, 1.0, 0.0, 0.15, BiomeType.OCEAN),
    (0.0, 1.0, 0.0, 1.0, 0.15, 0.20, BiomeType.BEACH),
    # Cold biomes
    (0.0, 0.15, 0.0, 0.4, 0.20, 0.75, BiomeType.TUNDRA),
    (0.0, 0.15, 0.4, 1.0, 0.20, 0.75, BiomeType.SNOW),
    (0.15, 0.35, 0.3, 1.0, 0.20, 0.75, BiomeType.TAIGA),
    # Temperate biomes
    (0.35, 0.60, 0.0, 0.3, 0.20, 0.75, BiomeType.PLAINS),
    (0.35, 0.60, 0.3, 0.6, 0.20, 0.75, BiomeType.FOREST),
    (0.35, 0.60, 0.6, 1.0, 0.20, 0.75, BiomeType.DARK_FOREST),
    # Hot biomes
    (0.60, 1.0, 0.0, 0.25, 0.20, 0.75, BiomeType.DESERT),
    (0.60, 1.0, 0.25, 0.50, 0.20, 0.75, BiomeType.SAVANNA),
    (0.60, 1.0, 0.50, 0.75, 0.20, 0.75, BiomeType.JUNGLE),
    (0.60, 1.0, 0.75, 1.0, 0.20, 0.75, BiomeType.SWAMP),
    # High elevation
    (0.0, 1.0, 0.0, 1.0, 0.75, 1.0, BiomeType.MOUNTAINS),
]

_SURFACE_BLOCKS: dict[BiomeType, BlockId] = {
    BiomeType.OCEAN: BlockId.WATER,
    BiomeType.BEACH: BlockId.SAND,
    BiomeType.TUNDRA: BlockId.SNOW_BLOCK,
    BiomeType.TAIGA: BlockId.PODZOL,
    BiomeType.SNOW: BlockId.SNOW_BLOCK,
    BiomeType.PLAINS: BlockId.GRASS,
    BiomeType.FOREST: BlockId.GRASS,
    BiomeType.DARK_FOREST: BlockId.GRASS,
    BiomeType.JUNGLE: BlockId.GRASS,
    BiomeType.SWAMP: BlockId.MUD,
    BiomeType.DESERT: BlockId.SAND,
    BiomeType.SAVANNA: BlockId.GRASS,
    BiomeType.MOUNTAINS: BlockId.STONE,
    BiomeType.MESA: BlockId.TERRACOTTA,
    BiomeType.MUSHROOM: BlockId.MYCELIUM,
}

_TREE_TYPES: dict[BiomeType, Optional[TreeType]] = {
    BiomeType.OCEAN: None,
    BiomeType.BEACH: None,
    BiomeType.TUNDRA: None,
    BiomeType.TAIGA: TreeType.SPRUCE,
    BiomeType.SNOW: TreeType.SPRUCE,
    BiomeType.PLAINS: TreeType.OAK,
    BiomeType.FOREST: TreeType.BIRCH,
    BiomeType.DARK_FOREST: TreeType.DARK_OAK,
    BiomeType.JUNGLE: TreeType.JUNGLE,
    BiomeType.SWAMP: TreeType.OAK,
    BiomeType.DESERT: TreeType.CACTUS,
    BiomeType.SAVANNA: TreeType.ACACIA,
    BiomeType.MOUNTAINS: TreeType.SPRUCE,
    BiomeType.MESA: None,
    BiomeType.MUSHROOM: TreeType.MUSHROOM_GIANT,
}

_DECORATION_DENSITY: dict[BiomeType, float] = {
    BiomeType.OCEAN: 0.0,
    BiomeType.BEACH: 0.05,
    BiomeType.TUNDRA: 0.02,
    BiomeType.TAIGA: 0.35,
    BiomeType.SNOW: 0.10,
    BiomeType.PLAINS: 0.15,
    BiomeType.FOREST: 0.55,
    BiomeType.DARK_FOREST: 0.70,
    BiomeType.JUNGLE: 0.85,
    BiomeType.SWAMP: 0.40,
    BiomeType.DESERT: 0.03,
    BiomeType.SAVANNA: 0.20,
    BiomeType.MOUNTAINS: 0.08,
    BiomeType.MESA: 0.02,
    BiomeType.MUSHROOM: 0.50,
}


class BiomeClassifier:
    """Classify biome from temperature, humidity, and elevation using Whittaker rules."""

    @staticmethod
    def classify(temperature: float, humidity: float, elevation: float) -> BiomeType:
        """Return the biome type for given climate values (all in [0, 1])."""
        temperature = max(0.0, min(1.0, temperature))
        humidity = max(0.0, min(1.0, humidity))
        elevation = max(0.0, min(1.0, elevation))

        for t_lo, t_hi, h_lo, h_hi, e_lo, e_hi, biome in _BIOME_RULES:
            if t_lo <= temperature < t_hi and h_lo <= humidity < h_hi and e_lo <= elevation < e_hi:
                return biome

        # Fallback
        return BiomeType.PLAINS

    @staticmethod
    def get_surface_block(biome: BiomeType) -> BlockId:
        return _SURFACE_BLOCKS.get(biome, BlockId.GRASS)

    @staticmethod
    def get_tree_type(biome: BiomeType) -> Optional[TreeType]:
        return _TREE_TYPES.get(biome)

    @staticmethod
    def get_decoration_density(biome: BiomeType) -> float:
        return _DECORATION_DENSITY.get(biome, 0.1)
