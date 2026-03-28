"""NPC generator using Claude API."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .lore import WorldLore
from .names import generate_name

logger = logging.getLogger(__name__)

_PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "npc_personality.md"


@dataclass(frozen=True)
class BigFive:
    openness: float
    conscientiousness: float
    extraversion: float
    agreeableness: float
    neuroticism: float


@dataclass(frozen=True)
class NPCProfile:
    name: str
    role: str
    personality: BigFive
    backstory: str
    knowledge: list[str]
    dialogue_style: str


_ROLE_TEMPLATES: list[tuple[str, str, str]] = [
    ("blacksmith", "I forge steel and mend blades. What do you need?", "gruff and direct"),
    ("merchant", "Welcome, welcome! I have wares if you have coin.", "enthusiastic and persuasive"),
    ("healer", "Let me tend to your wounds. Sit still.", "calm and compassionate"),
    ("guard", "Move along, citizen. Nothing to see here.", "authoritative and suspicious"),
    ("scholar", "Fascinating... the inscriptions suggest...", "verbose and analytical"),
    ("innkeeper", "Ale, food, or a bed? Take your pick.", "warm and gossipy"),
    ("hunter", "The forest holds many secrets. Tread carefully.", "quiet and observant"),
    ("elder", "I have seen much in my years. Sit and listen.", "wise and deliberate"),
    ("bard", "Shall I sing you a tale of the old wars?", "theatrical and charismatic"),
    ("farmer", "The harvest is thin this year. Strange times.", "humble and worried"),
    ("thief", "You didn't see me. I wasn't here.", "evasive and witty"),
    ("priest", "The spirits guide us. Have faith.", "serene and cryptic"),
]


def _load_prompt_template() -> str:
    if _PROMPT_PATH.exists():
        return _PROMPT_PATH.read_text(encoding="utf-8")
    return (
        "You are an NPC personality designer for a fantasy RPG.\n"
        "Create detailed, unique NPCs with Big Five personality traits (0-1).\n"
        "Return ONLY valid JSON.\n"
    )


def _build_fallback_npcs(
    lore: WorldLore,
    structures: list[dict[str, Any]],
    count_per_structure: int,
) -> list[NPCProfile]:
    """Deterministic fallback NPC generation."""
    import random as _rng

    _rng.seed(hash(lore.title))
    npcs: list[NPCProfile] = []

    culture = "human"
    if "forest" in lore.culture.lower() or "elv" in lore.culture.lower():
        culture = "elvish"
    elif "mountain" in lore.culture.lower() or "forge" in lore.culture.lower():
        culture = "dwarven"

    struct_count = max(len(structures), 1)
    total_needed = struct_count * count_per_structure

    for i in range(total_needed):
        role_idx = i % len(_ROLE_TEMPLATES)
        role_name, opening, style = _ROLE_TEMPLATES[role_idx]

        name = generate_name(culture=culture, name_type="person", seed=hash(lore.title) + i)

        personality = BigFive(
            openness=round(_rng.uniform(0.2, 0.9), 2),
            conscientiousness=round(_rng.uniform(0.2, 0.9), 2),
            extraversion=round(_rng.uniform(0.2, 0.9), 2),
            agreeableness=round(_rng.uniform(0.2, 0.9), 2),
            neuroticism=round(_rng.uniform(0.1, 0.7), 2),
        )

        faction_mention = ""
        if lore.factions:
            faction = _rng.choice(lore.factions)
            faction_mention = f" They have ties to {faction.name}."

        backstory = (
            f"{name} has served as {role_name} in {lore.title} for many years.{faction_mention} "
            f"They know the land well and have stories to tell about the old days."
        )

        knowledge_pool = [
            f"Knows about {lore.title}'s history",
            "Familiar with local trade routes",
            "Has heard rumours about the ancient ruins",
        ]
        if lore.mysteries:
            knowledge_pool.append(f"Whispers about: {lore.mysteries[0]}")
        if lore.factions:
            knowledge_pool.append(f"Knows the {lore.factions[0].name} faction well")

        npcs.append(
            NPCProfile(
                name=name,
                role=role_name,
                personality=personality,
                backstory=backstory,
                knowledge=knowledge_pool[: _rng.randint(2, min(4, len(knowledge_pool)))],
                dialogue_style=style,
            )
        )

    return npcs


async def generate_npcs(
    lore: WorldLore,
    structures: list[dict[str, Any]],
    count_per_structure: int = 3,
    api_key: str = "",
) -> list[NPCProfile]:
    """Generate NPCs using Claude API with fallback."""
    if not api_key:
        logger.warning("No API key — using fallback NPC generation")
        return _build_fallback_npcs(lore, structures, count_per_structure)

    try:
        import anthropic

        client = anthropic.AsyncAnthropic(api_key=api_key)
        template = _load_prompt_template()

        total = max(len(structures), 1) * count_per_structure

        user_content = (
            f"World: {lore.title}\n"
            f"History: {lore.history[:300]}\n"
            f"Factions: {json.dumps([{'name': f.name, 'description': f.description} for f in lore.factions])}\n"
            f"Structures: {json.dumps(structures)}\n\n"
            f"Generate {total} unique NPCs. Each NPC must have:\n"
            "- name: a fitting fantasy name\n"
            "- role: their job/function\n"
            "- personality: Big Five traits as floats 0-1 (openness, conscientiousness, extraversion, agreeableness, neuroticism)\n"
            "- backstory: 2-3 sentences\n"
            "- knowledge: list of 2-4 things they know\n"
            "- dialogue_style: short description of how they speak\n"
            "Return JSON: {\"npcs\": [...]}"
        )

        message = await client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            system=template,
            messages=[{"role": "user", "content": user_content}],
        )

        raw = message.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1]
            if raw.endswith("```"):
                raw = raw[: raw.rfind("```")]

        data = json.loads(raw)
        npcs: list[NPCProfile] = []

        for n in data.get("npcs", []):
            p = n.get("personality", {})
            personality = BigFive(
                openness=float(p.get("openness", 0.5)),
                conscientiousness=float(p.get("conscientiousness", 0.5)),
                extraversion=float(p.get("extraversion", 0.5)),
                agreeableness=float(p.get("agreeableness", 0.5)),
                neuroticism=float(p.get("neuroticism", 0.3)),
            )
            npcs.append(
                NPCProfile(
                    name=n.get("name", "Unknown"),
                    role=n.get("role", "villager"),
                    personality=personality,
                    backstory=n.get("backstory", ""),
                    knowledge=n.get("knowledge", []),
                    dialogue_style=n.get("dialogue_style", "neutral"),
                )
            )

        return npcs

    except Exception as exc:
        logger.error("NPC generation failed: %s — using fallback", exc)
        return _build_fallback_npcs(lore, structures, count_per_structure)
