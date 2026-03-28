"""Wave Function Collapse solver for tile-based structure generation."""

from __future__ import annotations

import random
from dataclasses import dataclass, field
from enum import IntEnum
from typing import Optional

import numpy as np


class Face(IntEnum):
    POS_X = 0
    NEG_X = 1
    POS_Y = 2
    NEG_Y = 3
    POS_Z = 4
    NEG_Z = 5


OPPOSITE: dict[Face, Face] = {
    Face.POS_X: Face.NEG_X,
    Face.NEG_X: Face.POS_X,
    Face.POS_Y: Face.NEG_Y,
    Face.NEG_Y: Face.POS_Y,
    Face.POS_Z: Face.NEG_Z,
    Face.NEG_Z: Face.POS_Z,
}

DIRECTION_OFFSETS: dict[Face, tuple[int, int, int]] = {
    Face.POS_X: (1, 0, 0),
    Face.NEG_X: (-1, 0, 0),
    Face.POS_Y: (0, 1, 0),
    Face.NEG_Y: (0, -1, 0),
    Face.POS_Z: (0, 0, 1),
    Face.NEG_Z: (0, 0, -1),
}


@dataclass(frozen=True)
class Tile:
    id: int
    block_data: np.ndarray  # 3-D array of block IDs
    adjacency: dict[Face, frozenset[int]]  # face -> set of allowed neighbour tile IDs
    weight: float = 1.0


@dataclass
class Cell:
    possible: set[int] = field(default_factory=set)
    collapsed: bool = False
    tile_id: int | None = None


class ContradictionError(Exception):
    """Raised when no valid tile remains for a cell."""


class WFCSolver:
    """3-D Wave Function Collapse solver with backtracking."""

    def __init__(self, seed: int = 0, max_backtracks: int = 500) -> None:
        self._rng = random.Random(seed)
        self._max_backtracks = max_backtracks

    def solve(
        self,
        grid_size: tuple[int, int, int],
        tileset: list[Tile],
    ) -> np.ndarray:
        """Solve WFC and return a 3-D grid of tile IDs with shape *grid_size*."""
        sx, sy, sz = grid_size
        tile_ids = {t.id for t in tileset}
        tile_map = {t.id: t for t in tileset}

        grid: list[list[list[Cell]]] = [
            [[Cell(possible=set(tile_ids)) for _ in range(sz)] for _ in range(sy)]
            for _ in range(sx)
        ]

        history: list[tuple[tuple[int, int, int], list[list[list[set[int]]]]]] = []
        backtracks = 0

        while True:
            # Find lowest-entropy uncollapsed cell
            target = self._observe(grid, sx, sy, sz, tile_map)
            if target is None:
                break  # all collapsed

            x, y, z = target
            cell = grid[x][y][z]

            # Save state for backtracking
            snapshot = self._snapshot(grid, sx, sy, sz)
            history.append((target, snapshot))

            # Collapse
            weights = [tile_map[tid].weight for tid in cell.possible]
            total = sum(weights)
            probs = [w / total for w in weights]
            chosen = self._rng.choices(list(cell.possible), weights=probs, k=1)[0]

            cell.possible = {chosen}
            cell.collapsed = True
            cell.tile_id = chosen

            try:
                self._propagate(grid, sx, sy, sz, tile_map, [(x, y, z)])
            except ContradictionError:
                backtracks += 1
                if backtracks > self._max_backtracks or not history:
                    # Give up — fill remaining with first tile
                    self._fill_uncollapsed(grid, sx, sy, sz, tileset[0].id)
                    break

                # Restore previous state and remove the bad choice
                coord, snap = history.pop()
                self._restore(grid, sx, sy, sz, snap)
                cx, cy, cz = coord
                grid[cx][cy][cz].possible.discard(chosen)
                if not grid[cx][cy][cz].possible:
                    self._fill_uncollapsed(grid, sx, sy, sz, tileset[0].id)
                    break

                try:
                    self._propagate(grid, sx, sy, sz, tile_map, [coord])
                except ContradictionError:
                    self._fill_uncollapsed(grid, sx, sy, sz, tileset[0].id)
                    break

        result = np.zeros(grid_size, dtype=np.int32)
        for xi in range(sx):
            for yi in range(sy):
                for zi in range(sz):
                    c = grid[xi][yi][zi]
                    result[xi, yi, zi] = c.tile_id if c.tile_id is not None else tileset[0].id
        return result

    # ── Core WFC operations ──────────────────────────────────────────────

    def _observe(
        self,
        grid: list[list[list[Cell]]],
        sx: int, sy: int, sz: int,
        tile_map: dict[int, Tile],
    ) -> tuple[int, int, int] | None:
        """Pick the lowest-entropy uncollapsed cell (random tie-breaking)."""
        min_entropy = float("inf")
        candidates: list[tuple[int, int, int]] = []

        for x in range(sx):
            for y in range(sy):
                for z in range(sz):
                    cell = grid[x][y][z]
                    if cell.collapsed:
                        continue
                    n = len(cell.possible)
                    if n == 0:
                        raise ContradictionError(f"Cell ({x},{y},{z}) has no possibilities")
                    if n < min_entropy:
                        min_entropy = n
                        candidates = [(x, y, z)]
                    elif n == min_entropy:
                        candidates.append((x, y, z))

        if not candidates:
            return None
        return self._rng.choice(candidates)

    def _propagate(
        self,
        grid: list[list[list[Cell]]],
        sx: int, sy: int, sz: int,
        tile_map: dict[int, Tile],
        stack: list[tuple[int, int, int]],
    ) -> None:
        """Constraint propagation: eliminate impossible tiles from neighbours."""
        visited: set[tuple[int, int, int]] = set()

        while stack:
            x, y, z = stack.pop()
            if (x, y, z) in visited:
                continue
            visited.add((x, y, z))

            cell = grid[x][y][z]
            # Compute allowed neighbours per face
            for face, (dx, dy, dz) in DIRECTION_OFFSETS.items():
                nx, ny, nz = x + dx, y + dy, z + dz
                if not (0 <= nx < sx and 0 <= ny < sy and 0 <= nz < sz):
                    continue

                neighbour = grid[nx][ny][nz]
                if neighbour.collapsed:
                    continue

                opp = OPPOSITE[face]
                allowed: set[int] = set()
                for tid in cell.possible:
                    allowed |= set(tile_map[tid].adjacency.get(face, frozenset()))

                before = len(neighbour.possible)
                neighbour.possible &= allowed
                if not neighbour.possible:
                    raise ContradictionError(
                        f"Contradiction at ({nx},{ny},{nz}) — no tiles remain"
                    )
                if len(neighbour.possible) < before:
                    stack.append((nx, ny, nz))
                    if len(neighbour.possible) == 1:
                        neighbour.collapsed = True
                        neighbour.tile_id = next(iter(neighbour.possible))

    # ── State management ─────────────────────────────────────────────────

    @staticmethod
    def _snapshot(
        grid: list[list[list[Cell]]],
        sx: int, sy: int, sz: int,
    ) -> list[list[list[set[int]]]]:
        return [
            [[set(grid[x][y][z].possible) for z in range(sz)] for y in range(sy)]
            for x in range(sx)
        ]

    @staticmethod
    def _restore(
        grid: list[list[list[Cell]]],
        sx: int, sy: int, sz: int,
        snap: list[list[list[set[int]]]],
    ) -> None:
        for x in range(sx):
            for y in range(sy):
                for z in range(sz):
                    poss = snap[x][y][z]
                    cell = grid[x][y][z]
                    cell.possible = poss
                    if len(poss) == 1:
                        cell.collapsed = True
                        cell.tile_id = next(iter(poss))
                    else:
                        cell.collapsed = False
                        cell.tile_id = None

    @staticmethod
    def _fill_uncollapsed(
        grid: list[list[list[Cell]]],
        sx: int, sy: int, sz: int,
        default_id: int,
    ) -> None:
        for x in range(sx):
            for y in range(sy):
                for z in range(sz):
                    cell = grid[x][y][z]
                    if not cell.collapsed:
                        cell.collapsed = True
                        cell.tile_id = default_id


# ── Default tilesets ─────────────────────────────────────────────────────

def _make_all_compatible(ids: list[int]) -> dict[Face, frozenset[int]]:
    s = frozenset(ids)
    return {f: s for f in Face}


def village_tileset() -> list[Tile]:
    """Simple village tileset: empty, road, house-floor, house-wall, roof."""
    ids = [0, 1, 2, 3, 4]
    return [
        Tile(
            id=0,
            block_data=np.zeros((1, 1, 1), dtype=np.int32),
            adjacency={
                Face.POS_X: frozenset({0, 1}),
                Face.NEG_X: frozenset({0, 1}),
                Face.POS_Z: frozenset({0, 1}),
                Face.NEG_Z: frozenset({0, 1}),
                Face.POS_Y: frozenset({0, 4}),
                Face.NEG_Y: frozenset({0}),
            },
            weight=3.0,
        ),
        Tile(
            id=1,
            block_data=np.array([[[7]]], dtype=np.int32),  # gravel road
            adjacency={
                Face.POS_X: frozenset({0, 1, 2}),
                Face.NEG_X: frozenset({0, 1, 2}),
                Face.POS_Z: frozenset({0, 1, 2}),
                Face.NEG_Z: frozenset({0, 1, 2}),
                Face.POS_Y: frozenset({0}),
                Face.NEG_Y: frozenset({0}),
            },
            weight=2.0,
        ),
        Tile(
            id=2,
            block_data=np.array([[[29]]], dtype=np.int32),  # planks floor
            adjacency={
                Face.POS_X: frozenset({2, 3}),
                Face.NEG_X: frozenset({2, 3}),
                Face.POS_Z: frozenset({2, 3}),
                Face.NEG_Z: frozenset({1, 2, 3}),
                Face.POS_Y: frozenset({3}),
                Face.NEG_Y: frozenset({0}),
            },
            weight=1.0,
        ),
        Tile(
            id=3,
            block_data=np.array([[[28]]], dtype=np.int32),  # cobble wall
            adjacency={
                Face.POS_X: frozenset({0, 3}),
                Face.NEG_X: frozenset({0, 3}),
                Face.POS_Z: frozenset({0, 3}),
                Face.NEG_Z: frozenset({0, 3}),
                Face.POS_Y: frozenset({4}),
                Face.NEG_Y: frozenset({2, 3}),
            },
            weight=1.0,
        ),
        Tile(
            id=4,
            block_data=np.array([[[16]]], dtype=np.int32),  # oak log roof
            adjacency={
                Face.POS_X: frozenset({0, 4}),
                Face.NEG_X: frozenset({0, 4}),
                Face.POS_Z: frozenset({0, 4}),
                Face.NEG_Z: frozenset({0, 4}),
                Face.POS_Y: frozenset({0}),
                Face.NEG_Y: frozenset({3, 0}),
            },
            weight=1.0,
        ),
    ]


def dungeon_tileset() -> list[Tile]:
    """Simple dungeon tileset: stone wall, corridor, room floor, ceiling."""
    ids = [0, 1, 2, 3]
    return [
        Tile(
            id=0,
            block_data=np.array([[[1]]], dtype=np.int32),  # stone wall (solid)
            adjacency={f: frozenset(ids) for f in Face},
            weight=3.0,
        ),
        Tile(
            id=1,
            block_data=np.array([[[0]]], dtype=np.int32),  # corridor air
            adjacency={
                Face.POS_X: frozenset({0, 1}),
                Face.NEG_X: frozenset({0, 1}),
                Face.POS_Z: frozenset({0, 1}),
                Face.NEG_Z: frozenset({0, 1}),
                Face.POS_Y: frozenset({0, 3}),
                Face.NEG_Y: frozenset({0, 2}),
            },
            weight=2.0,
        ),
        Tile(
            id=2,
            block_data=np.array([[[1]]], dtype=np.int32),  # room floor
            adjacency={
                Face.POS_X: frozenset({0, 2}),
                Face.NEG_X: frozenset({0, 2}),
                Face.POS_Z: frozenset({0, 2}),
                Face.NEG_Z: frozenset({0, 2}),
                Face.POS_Y: frozenset({1}),
                Face.NEG_Y: frozenset({0}),
            },
            weight=1.5,
        ),
        Tile(
            id=3,
            block_data=np.array([[[1]]], dtype=np.int32),  # ceiling
            adjacency={
                Face.POS_X: frozenset({0, 3}),
                Face.NEG_X: frozenset({0, 3}),
                Face.POS_Z: frozenset({0, 3}),
                Face.NEG_Z: frozenset({0, 3}),
                Face.POS_Y: frozenset({0}),
                Face.NEG_Y: frozenset({1}),
            },
            weight=1.5,
        ),
    ]
