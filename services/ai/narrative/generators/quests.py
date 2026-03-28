"""Quest generator using Claude API."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .lore import WorldLore
from .npcs import NPCProfile

logger = logging.getLogger(__name__)

_PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "quest_tree.md"


@dataclass(frozen=True)
class Objective:
    description: str
    type: str  # "kill", "collect", "deliver", "explore", "talk", "escort", "defend"
    target: str
    count: int = 1


@dataclass(frozen=True)
class Reward:
    type: str  # "xp", "gold", "item", "reputation", "unlock"
    description: str
    amount: int = 1


@dataclass(frozen=True)
class Quest:
    title: str
    description: str
    type: str  # "main", "side", "fetch", "combat", "mystery", "escort"
    objectives: list[Objective]
    rewards: list[Reward]
    dialogue: str  # opening dialogue from quest-giver


@dataclass(frozen=True)
class QuestTree:
    main_quests: list[Quest]
    side_quests: list[Quest]


def _load_prompt_template() -> str:
    if _PROMPT_PATH.exists():
        return _PROMPT_PATH.read_text(encoding="utf-8")
    return (
        "You are a quest designer for a fantasy RPG.\n"
        "Create interconnected quests that reference the world lore, NPCs, and structures.\n"
        "Return ONLY valid JSON.\n"
    )


def _build_fallback_quests(
    lore: WorldLore,
    npcs: list[NPCProfile],
    structures: list[dict[str, Any]],
) -> QuestTree:
    """Deterministic fallback quest generation."""
    npc_names = [n.name for n in npcs[:5]] if npcs else ["The Elder", "A Stranger"]
    struct_names = [s.get("name", "ancient ruin") for s in structures[:3]]

    main_quests: list[Quest] = [
        Quest(
            title="The Awakening",
            description="Strange lights have been seen near the old temple. Investigate the source.",
            type="main",
            objectives=[
                Objective(description="Travel to the ancient temple", type="explore", target=struct_names[0] if struct_names else "temple"),
                Objective(description="Examine the glowing artifact", type="collect", target="artifact"),
            ],
            rewards=[Reward(type="xp", description="Experience points", amount=500)],
            dialogue=f"{npc_names[0]} says: Something stirs in the depths. Will you answer the call?",
        ),
        Quest(
            title="Echoes of the Past",
            description="Decipher the inscriptions found in the ruins to learn about the ancient builders.",
            type="main",
            objectives=[
                Objective(description="Find three inscription tablets", type="collect", target="inscription_tablet", count=3),
                Objective(description="Bring tablets to the scholar", type="deliver", target="scholar"),
            ],
            rewards=[
                Reward(type="xp", description="Experience points", amount=750),
                Reward(type="item", description="Ancient Compass", amount=1),
            ],
            dialogue="The inscriptions glow faintly in the moonlight. Each tells a fragment of the story.",
        ),
        Quest(
            title="The Hollow Threat",
            description="The Hollow faction grows bolder. Confront their leader in the underground sanctum.",
            type="main",
            objectives=[
                Objective(description="Infiltrate the Hollow's sanctum", type="explore", target="sanctum"),
                Objective(description="Defeat the Hollow Overseer", type="kill", target="hollow_overseer"),
            ],
            rewards=[
                Reward(type="xp", description="Experience points", amount=1200),
                Reward(type="reputation", description="Warden reputation", amount=100),
            ],
            dialogue="The balance teeters. Only courage can tip it back.",
        ),
        Quest(
            title="Convergence",
            description="The artifact's power is growing. Unite the factions before it's too late.",
            type="main",
            objectives=[
                Objective(description="Speak with each faction leader", type="talk", target="faction_leader", count=3),
                Objective(description="Attend the Council of Flames", type="explore", target="council_hall"),
            ],
            rewards=[
                Reward(type="xp", description="Experience points", amount=1000),
                Reward(type="unlock", description="Access to the Inner Sanctum"),
            ],
            dialogue="The time for division has ended. Will you broker peace?",
        ),
        Quest(
            title="The Final Seal",
            description="Seal the rift that threatens to consume the world.",
            type="main",
            objectives=[
                Objective(description="Collect three elemental keys", type="collect", target="elemental_key", count=3),
                Objective(description="Close the rift", type="defend", target="rift"),
            ],
            rewards=[
                Reward(type="xp", description="Experience points", amount=2000),
                Reward(type="item", description="World-Shaper's Crown", amount=1),
            ],
            dialogue="This is the moment everything has led to. The world itself holds its breath.",
        ),
    ]

    side_quests: list[Quest] = []
    side_templates = [
        ("Lost Livestock", "A farmer's creatures have escaped. Round them up.", "fetch",
         [Objective(description="Find the lost creatures", type="collect", target="lost_creature", count=5)],
         [Reward(type="gold", description="Gold coins", amount=50)]),
        ("Herb Gathering", "The healer needs rare herbs from the forest.", "fetch",
         [Objective(description="Gather moonpetal flowers", type="collect", target="moonpetal", count=8)],
         [Reward(type="gold", description="Gold coins", amount=30), Reward(type="item", description="Healing Potion", amount=3)]),
        ("Bandit Camp", "Bandits are terrorising the road. Clear them out.", "combat",
         [Objective(description="Defeat the bandits", type="kill", target="bandit", count=6)],
         [Reward(type="xp", description="Experience points", amount=300), Reward(type="gold", description="Gold coins", amount=80)]),
        ("The Missing Courier", "A courier vanished en route. Find them.", "mystery",
         [Objective(description="Search the forest path", type="explore", target="forest_path"),
          Objective(description="Rescue the courier", type="escort", target="courier")],
         [Reward(type="xp", description="Experience points", amount=250)]),
        ("Mushroom Madness", "Strange mushrooms are appearing everywhere.", "fetch",
         [Objective(description="Collect glowing mushroom samples", type="collect", target="glowing_mushroom", count=10)],
         [Reward(type="gold", description="Gold coins", amount=40)]),
        ("The Singing Stone", "Locals report a boulder that hums at night.", "mystery",
         [Objective(description="Investigate the singing stone", type="explore", target="singing_stone")],
         [Reward(type="xp", description="Experience points", amount=200)]),
        ("Escort Duty", "A merchant needs safe passage through the pass.", "escort",
         [Objective(description="Escort the merchant", type="escort", target="merchant")],
         [Reward(type="gold", description="Gold coins", amount=100)]),
        ("Mine Infestation", "Spiders have overrun the old mine.", "combat",
         [Objective(description="Clear the mine of spiders", type="kill", target="cave_spider", count=8)],
         [Reward(type="xp", description="Experience points", amount=350), Reward(type="item", description="Spider Silk", amount=5)]),
        ("A Friendly Wager", "Beat the tavern champion in a challenge.", "side",
         [Objective(description="Win the tavern challenge", type="talk", target="tavern_champion")],
         [Reward(type="gold", description="Gold coins", amount=60)]),
        ("Ancient Map", "A torn map hints at buried treasure.", "mystery",
         [Objective(description="Find the three map pieces", type="collect", target="map_piece", count=3),
          Objective(description="Dig at the marked location", type="explore", target="treasure_site")],
         [Reward(type="item", description="Treasure Chest contents", amount=1)]),
        ("The Wandering Spirit", "A ghost begs for release.", "mystery",
         [Objective(description="Find the spirit's remains", type="explore", target="burial_site"),
          Objective(description="Perform the ritual", type="collect", target="ritual_component", count=3)],
         [Reward(type="xp", description="Experience points", amount=400)]),
        ("Fishing Contest", "The annual fishing contest is underway.", "side",
         [Objective(description="Catch the legendary fish", type="collect", target="legendary_fish")],
         [Reward(type="gold", description="Gold coins", amount=70), Reward(type="item", description="Golden Rod", amount=1)]),
    ]

    for title, desc, qtype, objs, rews in side_templates:
        giver = npc_names[hash(title) % len(npc_names)] if npc_names else "A villager"
        side_quests.append(
            Quest(
                title=title,
                description=desc,
                type=qtype,
                objectives=objs,
                rewards=rews,
                dialogue=f"{giver}: I could really use your help with something...",
            )
        )

    return QuestTree(main_quests=main_quests, side_quests=side_quests)


async def generate_quests(
    lore: WorldLore,
    npcs: list[NPCProfile],
    structures: list[dict[str, Any]],
    api_key: str = "",
) -> QuestTree:
    """Generate quests using Claude API with fallback."""
    if not api_key:
        logger.warning("No API key — using fallback quest generation")
        return _build_fallback_quests(lore, npcs, structures)

    try:
        import anthropic

        client = anthropic.AsyncAnthropic(api_key=api_key)
        template = _load_prompt_template()

        npc_summaries = [{"name": n.name, "role": n.role} for n in npcs]

        user_content = (
            f"World title: {lore.title}\n"
            f"History: {lore.history[:500]}\n"
            f"Factions: {json.dumps([{'name': f.name, 'alignment': f.alignment} for f in lore.factions])}\n"
            f"NPCs: {json.dumps(npc_summaries)}\n"
            f"Structures: {json.dumps(structures)}\n\n"
            "Generate a quest tree with 5-7 main quests and 10-15 side quests.\n"
            "Each quest must have: title, description, type, objectives "
            "(each with description, type, target, count), rewards "
            "(each with type, description, amount), and dialogue.\n"
            "Return JSON: {\"main_quests\": [...], \"side_quests\": [...]}"
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

        def _parse_quest(q: dict[str, Any]) -> Quest:
            objectives = [
                Objective(
                    description=o["description"],
                    type=o.get("type", "explore"),
                    target=o.get("target", "unknown"),
                    count=o.get("count", 1),
                )
                for o in q.get("objectives", [])
            ]
            rewards = [
                Reward(
                    type=r.get("type", "xp"),
                    description=r.get("description", ""),
                    amount=r.get("amount", 1),
                )
                for r in q.get("rewards", [])
            ]
            return Quest(
                title=q.get("title", "Untitled Quest"),
                description=q.get("description", ""),
                type=q.get("type", "side"),
                objectives=objectives,
                rewards=rewards,
                dialogue=q.get("dialogue", ""),
            )

        main = [_parse_quest(q) for q in data.get("main_quests", [])]
        side = [_parse_quest(q) for q in data.get("side_quests", [])]

        return QuestTree(main_quests=main, side_quests=side)

    except Exception as exc:
        logger.error("Quest generation failed: %s — using fallback", exc)
        return _build_fallback_quests(lore, npcs, structures)
