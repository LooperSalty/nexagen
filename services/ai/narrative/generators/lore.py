"""World lore generator using Claude API."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

_PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "world_lore.md"


@dataclass(frozen=True)
class Faction:
    name: str
    description: str
    alignment: str  # "good", "neutral", "evil", "chaotic"


@dataclass(frozen=True)
class WorldLore:
    title: str
    history: str
    factions: list[Faction]
    mysteries: list[str]
    culture: str


def _load_prompt_template() -> str:
    if _PROMPT_PATH.exists():
        return _PROMPT_PATH.read_text(encoding="utf-8")
    return (
        "You are a world-lore writer for a fantasy game.\n"
        "Given the world description, biomes, and structures, produce rich lore.\n"
        "Return ONLY valid JSON matching the schema below.\n"
    )


def _build_fallback_lore(
    world_description: str,
    biomes: list[str],
    structures: list[dict[str, Any]],
) -> WorldLore:
    """Deterministic fallback when the API is unavailable."""
    biome_str = ", ".join(biomes) if biomes else "unknown lands"
    struct_names = [s.get("name", "ancient ruin") for s in structures]
    struct_str = ", ".join(struct_names) if struct_names else "scattered ruins"

    return WorldLore(
        title=f"The Realm of {biome_str.title()}",
        history=(
            f"Long ago, the world was shaped by elemental forces, carving {biome_str} "
            f"across the land. Ancient builders left behind {struct_str}, now crumbling "
            "under the weight of centuries."
        ),
        factions=[
            Faction(name="The Wardens", description="Protectors of the ancient balance.", alignment="good"),
            Faction(name="The Hollow", description="Seekers of forbidden knowledge.", alignment="neutral"),
            Faction(name="The Ashen Court", description="Rulers who crave dominion.", alignment="evil"),
        ],
        mysteries=[
            "What lies beneath the deepest dungeon?",
            "Who built the first temple, and why did they vanish?",
            "Whispers speak of a fifth faction, hidden in the shadows.",
        ],
        culture=(
            "The inhabitants celebrate the Solstice of Embers each year, "
            "honouring the forces that shaped their world."
        ),
    )


async def generate_lore(
    world_description: str,
    biomes: list[str],
    structures: list[dict[str, Any]],
    api_key: str = "",
) -> WorldLore:
    """Generate world lore using Claude API, with fallback."""
    if not api_key:
        logger.warning("No API key — using fallback lore generation")
        return _build_fallback_lore(world_description, biomes, structures)

    try:
        import anthropic

        client = anthropic.AsyncAnthropic(api_key=api_key)
        template = _load_prompt_template()

        user_content = (
            f"World description: {world_description}\n"
            f"Biomes: {json.dumps(biomes)}\n"
            f"Structures: {json.dumps(structures)}\n\n"
            "Generate world lore as JSON with fields: title, history, factions "
            "(each with name, description, alignment), mysteries (list of strings), culture."
        )

        message = await client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2048,
            system=template,
            messages=[{"role": "user", "content": user_content}],
        )

        raw = message.content[0].text.strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1]
            if raw.endswith("```"):
                raw = raw[: raw.rfind("```")]

        data = json.loads(raw)

        factions = [
            Faction(
                name=f["name"],
                description=f["description"],
                alignment=f.get("alignment", "neutral"),
            )
            for f in data.get("factions", [])
        ]

        return WorldLore(
            title=data.get("title", "Unnamed World"),
            history=data.get("history", ""),
            factions=factions,
            mysteries=data.get("mysteries", []),
            culture=data.get("culture", ""),
        )

    except Exception as exc:
        logger.error("Lore generation failed: %s — using fallback", exc)
        return _build_fallback_lore(world_description, biomes, structures)
