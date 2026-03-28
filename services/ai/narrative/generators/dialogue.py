"""Dialogue system for NPC conversations."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from .npcs import NPCProfile

logger = logging.getLogger(__name__)

_PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "dialogue_context.md"

_FALLBACK_RESPONSES = [
    "Hmm, I'm not sure what to say about that.",
    "Interesting... Tell me more.",
    "I've heard rumours, but nothing certain.",
    "You should speak with the elder about that.",
    "The roads have been dangerous lately. Be careful.",
    "I don't have much to offer, but you're welcome here.",
    "That reminds me of an old tale...",
    "Perhaps the answer lies in the ruins to the north.",
]


def _load_dialogue_template() -> str:
    if _PROMPT_PATH.exists():
        return _PROMPT_PATH.read_text(encoding="utf-8")
    return (
        "You are {npc_name}, a {npc_role} in a fantasy world.\n"
        "Personality: {personality_summary}\n"
        "Backstory: {backstory}\n"
        "Knowledge: {knowledge}\n"
        "Dialogue style: {dialogue_style}\n"
        "World context: {world_context}\n\n"
        "Stay in character. Respond concisely (1-3 sentences). "
        "Never break character or mention you are an AI."
    )


def _build_system_prompt(
    npc: NPCProfile,
    world_context: str,
    template: str,
) -> str:
    """Fill the prompt template with NPC data."""
    p = npc.personality
    personality_summary = (
        f"Openness={p.openness:.1f}, Conscientiousness={p.conscientiousness:.1f}, "
        f"Extraversion={p.extraversion:.1f}, Agreeableness={p.agreeableness:.1f}, "
        f"Neuroticism={p.neuroticism:.1f}"
    )

    return template.format(
        npc_name=npc.name,
        npc_role=npc.role,
        personality_summary=personality_summary,
        backstory=npc.backstory,
        knowledge=", ".join(npc.knowledge),
        dialogue_style=npc.dialogue_style,
        world_context=world_context,
    )


def _summarize_history(history: list[dict[str, str]], max_messages: int = 20) -> list[dict[str, str]]:
    """Keep the last *max_messages* turns; summarise earlier ones into a single entry."""
    if len(history) <= max_messages:
        return list(history)

    early = history[: len(history) - max_messages]
    recent = history[len(history) - max_messages:]

    summary_parts: list[str] = []
    for msg in early:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        summary_parts.append(f"{role}: {content[:60]}")

    summary_text = "[Earlier conversation summary: " + " | ".join(summary_parts) + "]"
    return [{"role": "user", "content": summary_text}] + recent


class DialogueManager:
    """Manage NPC dialogue interactions."""

    async def generate_response(
        self,
        npc: NPCProfile,
        message: str,
        history: list[dict[str, str]],
        world_context: str,
        api_key: str = "",
    ) -> str:
        """Generate an in-character NPC response."""
        if not api_key:
            return self._fallback_response(npc, message)

        try:
            import anthropic

            client = anthropic.AsyncAnthropic(api_key=api_key)
            template = _load_dialogue_template()
            system_prompt = _build_system_prompt(npc, world_context, template)

            condensed = _summarize_history(history)

            messages: list[dict[str, str]] = []
            for entry in condensed:
                role = entry.get("role", "user")
                if role not in ("user", "assistant"):
                    role = "user"
                messages.append({"role": role, "content": entry.get("content", "")})

            messages.append({"role": "user", "content": message})

            response = await client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=256,
                system=system_prompt,
                messages=messages,
            )

            return response.content[0].text.strip()

        except Exception as exc:
            logger.error("Dialogue generation failed for %s: %s", npc.name, exc)
            return self._fallback_response(npc, message)

    @staticmethod
    def _fallback_response(npc: NPCProfile, message: str) -> str:
        """Deterministic fallback when API is unavailable."""
        idx = hash(npc.name + message) % len(_FALLBACK_RESPONSES)
        prefix = ""
        if npc.dialogue_style:
            # Simulate style with a brief in-character prefix
            if "gruff" in npc.dialogue_style.lower():
                prefix = "*grunts* "
            elif "enthusiastic" in npc.dialogue_style.lower():
                prefix = "Oh! "
            elif "calm" in npc.dialogue_style.lower():
                prefix = "*nods slowly* "
            elif "theatrical" in npc.dialogue_style.lower():
                prefix = "*gestures dramatically* "
        return prefix + _FALLBACK_RESPONSES[idx]
