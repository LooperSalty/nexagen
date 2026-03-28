"""L-System morphology generator for procedural creatures."""

from __future__ import annotations

import math
import random
from dataclasses import dataclass
from typing import NamedTuple


@dataclass(frozen=True)
class Bone:
    name: str
    parent_index: int
    local_position: tuple[float, float, float]
    local_rotation: tuple[float, float, float]
    length: float
    radius: float


@dataclass(frozen=True)
class CreatureAesthetic:
    base_color: tuple[int, int, int]
    pattern_type: str  # "solid", "spots", "stripes", "gradient"
    material: str  # "scales", "fur", "chitin", "crystal", "skin"
    glow: bool
    size_scale: float


class CreatureMorphology(NamedTuple):
    bones: list[Bone]
    aesthetic: CreatureAesthetic
    body_plan: str


# ── L-System core ────────────────────────────────────────────────────────

@dataclass(frozen=True)
class LSystemRule:
    predecessor: str
    successor: str
    probability: float = 1.0


class LSystem:
    """Stochastic, parametric L-System."""

    def __init__(self, axiom: str, rules: list[LSystemRule], seed: int = 0) -> None:
        self._axiom = axiom
        self._rules = rules
        self._rng = random.Random(seed)

    def iterate(self, n: int = 3) -> str:
        current = self._axiom
        for _ in range(n):
            result: list[str] = []
            for ch in current:
                applied = False
                candidates = [r for r in self._rules if r.predecessor == ch]
                if candidates:
                    roll = self._rng.random()
                    cumulative = 0.0
                    for rule in candidates:
                        cumulative += rule.probability
                        if roll <= cumulative:
                            result.append(rule.successor)
                            applied = True
                            break
                if not applied:
                    result.append(ch)
            current = "".join(result)
        return current


# ── Body plan definitions ────────────────────────────────────────────────

_BODY_PLANS: dict[str, tuple[str, list[LSystemRule]]] = {
    "quadruped": (
        "B",
        [
            LSystemRule("B", "S[+LF][-LF]T[+LB][-LB]H"),
        ],
    ),
    "biped": (
        "B",
        [
            LSystemRule("B", "S[+LB][-LB]A[+LA][-LA]H"),
        ],
    ),
    "serpentine": (
        "B",
        [
            LSystemRule("B", "SSSSSSH"),
            LSystemRule("S", "SS", 0.3),
        ],
    ),
    "insectoid": (
        "B",
        [
            LSystemRule("B", "S[+LI][-LI][+LI][-LI][+LI][-LI]H"),
        ],
    ),
    "avian": (
        "B",
        [
            LSystemRule("B", "S[+W][-W][+LB][-LB]HT"),
        ],
    ),
}

# Biome -> preferred body plans
_BIOME_PLANS: dict[str, list[str]] = {
    "plains": ["quadruped", "biped"],
    "forest": ["quadruped", "avian", "insectoid"],
    "desert": ["serpentine", "insectoid"],
    "tundra": ["quadruped"],
    "jungle": ["insectoid", "avian", "serpentine"],
    "mountains": ["avian", "quadruped"],
    "ocean": ["serpentine"],
    "swamp": ["serpentine", "insectoid"],
    "savanna": ["quadruped", "avian"],
    "taiga": ["quadruped"],
}

# Biome -> aesthetic palette
_BIOME_AESTHETICS: dict[str, dict[str, object]] = {
    "plains": {"colors": [(120, 180, 80), (180, 160, 100), (200, 190, 150)], "materials": ["fur", "skin"], "patterns": ["solid", "spots"]},
    "forest": {"colors": [(60, 120, 40), (100, 80, 50), (80, 140, 60)], "materials": ["fur", "scales"], "patterns": ["stripes", "spots"]},
    "desert": {"colors": [(220, 190, 130), (200, 160, 90), (180, 140, 80)], "materials": ["scales", "chitin"], "patterns": ["solid", "gradient"]},
    "tundra": {"colors": [(220, 230, 240), (200, 210, 220), (180, 190, 200)], "materials": ["fur"], "patterns": ["solid"]},
    "jungle": {"colors": [(30, 160, 50), (200, 60, 40), (50, 200, 180)], "materials": ["scales", "chitin", "skin"], "patterns": ["spots", "stripes"]},
    "mountains": {"colors": [(140, 130, 120), (100, 90, 80), (160, 150, 140)], "materials": ["scales", "crystal"], "patterns": ["solid", "gradient"]},
    "ocean": {"colors": [(40, 100, 200), (20, 180, 180), (60, 60, 160)], "materials": ["scales", "skin"], "patterns": ["gradient", "spots"]},
    "swamp": {"colors": [(80, 100, 50), (60, 80, 40), (100, 120, 60)], "materials": ["skin", "scales"], "patterns": ["spots", "stripes"]},
    "savanna": {"colors": [(200, 170, 100), (180, 140, 70), (220, 190, 120)], "materials": ["fur", "skin"], "patterns": ["stripes", "spots"]},
    "taiga": {"colors": [(160, 140, 100), (120, 100, 80), (200, 180, 140)], "materials": ["fur"], "patterns": ["solid", "stripes"]},
}

# Role -> glow likelihood
_ROLE_GLOW: dict[str, float] = {
    "passive": 0.05,
    "neutral": 0.10,
    "hostile": 0.30,
    "mount": 0.05,
    "pet": 0.15,
    "boss": 0.70,
}


class CreatureMorphologyGenerator:
    """Generate a full creature morphology from biome + role + seed."""

    def generate(self, biome: str, role: str, seed: int = 0) -> CreatureMorphology:
        rng = random.Random(seed)

        # Choose body plan
        plans = _BIOME_PLANS.get(biome, ["quadruped"])
        plan_name = rng.choice(plans)
        axiom, rules = _BODY_PLANS[plan_name]

        ls = LSystem(axiom=axiom, rules=rules, seed=seed)
        genome = ls.iterate(n=2)

        bones = self._interpret_genome(genome, plan_name, rng)

        # Aesthetic
        palette = _BIOME_AESTHETICS.get(biome, _BIOME_AESTHETICS["plains"])
        base_color = rng.choice(palette["colors"])
        pattern = rng.choice(palette["patterns"])
        material = rng.choice(palette["materials"])
        glow = rng.random() < _ROLE_GLOW.get(role, 0.1)

        size_map = {"passive": 0.8, "neutral": 1.0, "hostile": 1.2, "mount": 1.5, "pet": 0.5, "boss": 2.5}
        size_scale = size_map.get(role, 1.0) * rng.uniform(0.85, 1.15)

        aesthetic = CreatureAesthetic(
            base_color=base_color,
            pattern_type=pattern,
            material=material,
            glow=glow,
            size_scale=round(size_scale, 2),
        )

        return CreatureMorphology(bones=bones, aesthetic=aesthetic, body_plan=plan_name)

    def _interpret_genome(
        self, genome: str, plan_name: str, rng: random.Random
    ) -> list[Bone]:
        """Convert L-System string into a skeleton of Bone objects."""
        bones: list[Bone] = []
        parent_stack: list[int] = []
        current_parent = -1
        angle = 0.0
        segment_idx = 0
        y_pos = 0.0

        # Spine direction
        dx, dz = 0.0, 1.0

        for ch in genome:
            if ch == "S":
                # Spine segment
                bone = Bone(
                    name=f"spine_{segment_idx}",
                    parent_index=max(current_parent, 0) if bones else 0,
                    local_position=(0.0, y_pos, dz * 0.5),
                    local_rotation=(0.0, 0.0, 0.0),
                    length=rng.uniform(0.4, 0.8),
                    radius=rng.uniform(0.15, 0.3),
                )
                bones.append(bone)
                current_parent = len(bones) - 1
                y_pos += 0.1
                segment_idx += 1

            elif ch == "H":
                # Head
                bone = Bone(
                    name="head",
                    parent_index=max(current_parent, 0),
                    local_position=(0.0, 0.1, 0.4),
                    local_rotation=(0.0, 0.0, 0.0),
                    length=rng.uniform(0.3, 0.5),
                    radius=rng.uniform(0.2, 0.35),
                )
                bones.append(bone)

            elif ch == "T":
                # Tail
                for ti in range(rng.randint(2, 4)):
                    bone = Bone(
                        name=f"tail_{ti}",
                        parent_index=max(current_parent, 0) if ti == 0 else len(bones) - 1,
                        local_position=(0.0, -0.05, -0.3),
                        local_rotation=(rng.uniform(-10, 10), 0.0, 0.0),
                        length=rng.uniform(0.2, 0.5),
                        radius=max(0.05, 0.15 - ti * 0.03),
                    )
                    bones.append(bone)

            elif ch in ("L", "A", "W", "I"):
                # Limb types: L=leg, A=arm, W=wing, I=insect leg
                limb_type = {"L": "leg", "A": "arm", "W": "wing", "I": "insect_leg"}[ch]
                side_sign = 1.0 if angle >= 0 else -1.0
                num_segments = {"leg": 3, "arm": 3, "wing": 4, "insect_leg": 3}[limb_type]
                for si in range(num_segments):
                    bone = Bone(
                        name=f"{limb_type}_{len(bones)}_{si}",
                        parent_index=max(current_parent, 0) if si == 0 else len(bones) - 1,
                        local_position=(side_sign * 0.3, -0.1 * si, 0.0),
                        local_rotation=(0.0, 0.0, side_sign * rng.uniform(5, 30)),
                        length=rng.uniform(0.2, 0.5),
                        radius=max(0.04, 0.12 - si * 0.03),
                    )
                    bones.append(bone)

            elif ch == "F":
                # Foot
                bone = Bone(
                    name=f"foot_{len(bones)}",
                    parent_index=max(len(bones) - 1, 0),
                    local_position=(0.0, -0.05, 0.1),
                    local_rotation=(0.0, 0.0, 0.0),
                    length=rng.uniform(0.1, 0.2),
                    radius=rng.uniform(0.06, 0.12),
                )
                bones.append(bone)

            elif ch == "[":
                parent_stack.append(current_parent)

            elif ch == "]":
                if parent_stack:
                    current_parent = parent_stack.pop()

            elif ch == "+":
                angle = rng.uniform(20, 45)

            elif ch == "-":
                angle = rng.uniform(-45, -20)

        # Ensure at least one bone
        if not bones:
            bones.append(
                Bone(
                    name="body",
                    parent_index=0,
                    local_position=(0.0, 0.0, 0.0),
                    local_rotation=(0.0, 0.0, 0.0),
                    length=0.5,
                    radius=0.2,
                )
            )

        return bones
