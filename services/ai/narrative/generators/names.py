"""Markov-chain name generator with culture-specific phoneme sets."""

from __future__ import annotations

import random
from typing import Optional

# ── Phoneme / syllable tables per culture ────────────────────────────────

_SYLLABLES: dict[str, dict[str, list[str]]] = {
    "elvish": {
        "onset": ["", "l", "th", "n", "s", "r", "f", "gl", "el", "ar", "v"],
        "nucleus": ["a", "e", "i", "ae", "ia", "ei", "o"],
        "coda": ["n", "l", "th", "r", "s", "", "nd", "ll"],
    },
    "dwarven": {
        "onset": ["b", "d", "g", "th", "k", "br", "dr", "gr", "kr", "t"],
        "nucleus": ["o", "u", "a", "or", "ur", "i"],
        "coda": ["k", "n", "m", "r", "nd", "rg", "lk", "x", ""],
    },
    "human": {
        "onset": ["", "m", "j", "r", "s", "w", "h", "b", "c", "d", "l", "t"],
        "nucleus": ["a", "e", "i", "o", "u", "ai", "ea"],
        "coda": ["n", "r", "s", "d", "l", "th", "", "ck", "nn"],
    },
    "exotic": {
        "onset": ["z", "x", "q", "kh", "zh", "vy", "tch", "sh", "ny"],
        "nucleus": ["a", "u", "o", "aa", "uu", "ai", "ou"],
        "coda": ["x", "z", "rr", "sh", "th", "k", "", "ss"],
    },
}

# Type-specific length ranges (min_syllables, max_syllables)
_TYPE_LENGTHS: dict[str, tuple[int, int]] = {
    "person": (2, 3),
    "place": (2, 4),
    "creature": (2, 3),
    "item": (1, 3),
    "faction": (2, 4),
}

# Place / faction suffixes for flavour
_PLACE_SUFFIXES: dict[str, list[str]] = {
    "elvish": ["vale", "wood", "haven", "glade", "mere"],
    "dwarven": ["hold", "forge", "deep", "hall", "mine"],
    "human": ["shire", "ford", "stead", "ton", "burg"],
    "exotic": ["zar", "kesh", "vaal", "thar", "xis"],
}

_FACTION_PREFIXES: dict[str, list[str]] = {
    "elvish": ["Order of", "Circle of", "Fellowship of"],
    "dwarven": ["Clan", "Guild of", "Brotherhood of"],
    "human": ["Knights of", "The", "House of"],
    "exotic": ["Cult of", "The Crimson", "Pact of"],
}


def _build_syllable(culture: str, rng: random.Random) -> str:
    table = _SYLLABLES.get(culture, _SYLLABLES["human"])
    onset = rng.choice(table["onset"])
    nucleus = rng.choice(table["nucleus"])
    coda = rng.choice(table["coda"])
    return onset + nucleus + coda


def _capitalise(name: str) -> str:
    return name[0].upper() + name[1:] if name else name


def generate_name(
    culture: str = "human",
    name_type: str = "person",
    seed: Optional[int] = None,
) -> str:
    """Generate a culturally-flavoured name.

    Parameters
    ----------
    culture : "elvish", "dwarven", "human", or "exotic"
    name_type : "person", "place", "creature", "item", or "faction"
    seed : optional RNG seed for reproducibility
    """
    rng = random.Random(seed)
    culture = culture if culture in _SYLLABLES else "human"
    min_syl, max_syl = _TYPE_LENGTHS.get(name_type, (2, 3))
    num_syllables = rng.randint(min_syl, max_syl)

    base = "".join(_build_syllable(culture, rng) for _ in range(num_syllables))
    base = _capitalise(base)

    if name_type == "person":
        # Sometimes add a surname
        if rng.random() < 0.5:
            surname = "".join(_build_syllable(culture, rng) for _ in range(rng.randint(1, 2)))
            base = f"{base} {_capitalise(surname)}"

    elif name_type == "place":
        suffixes = _PLACE_SUFFIXES.get(culture, _PLACE_SUFFIXES["human"])
        if rng.random() < 0.6:
            base = base + rng.choice(suffixes)

    elif name_type == "faction":
        prefixes = _FACTION_PREFIXES.get(culture, _FACTION_PREFIXES["human"])
        prefix = rng.choice(prefixes)
        # Build a short evocative name
        core = "".join(_build_syllable(culture, rng) for _ in range(rng.randint(1, 2)))
        base = f"{prefix} {_capitalise(core)}"

    elif name_type == "creature":
        # Creatures get harsher sounds
        if rng.random() < 0.4:
            base = base + rng.choice(["claw", "fang", "maw", "horn", "wing"])

    elif name_type == "item":
        # Items often have a descriptor
        descriptors = ["Ancient", "Gleaming", "Cursed", "Blessed", "Shattered", "Eternal"]
        if rng.random() < 0.5:
            base = f"{rng.choice(descriptors)} {base}"

    return base
