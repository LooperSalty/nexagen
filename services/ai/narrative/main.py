"""Narrative generation microservice for NEXAGEN."""

from __future__ import annotations

import os

import structlog
import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from generators.dialogue import DialogueManager
from generators.lore import WorldLore, generate_lore
from generators.npcs import NPCProfile, generate_npcs
from generators.quests import QuestTree, generate_quests

load_dotenv()

structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ],
)
logger = structlog.get_logger()


# ---------------------------------------------------------------------------
# Pydantic request / response models
# ---------------------------------------------------------------------------

class StructureInfo(BaseModel):
    name: str
    type: str  # "village", "dungeon", "temple", etc.
    location: str = ""


class NarrativeRequest(BaseModel):
    world_id: str = Field(..., min_length=1)
    world_description: str = Field(..., min_length=1, max_length=5000)
    biomes: list[str] = Field(default_factory=lambda: ["plains"])
    structures: list[StructureInfo] = Field(default_factory=list)


class FactionOut(BaseModel):
    name: str
    description: str
    alignment: str


class WorldLoreOut(BaseModel):
    title: str
    history: str
    factions: list[FactionOut]
    mysteries: list[str]
    culture: str


class BigFiveOut(BaseModel):
    openness: float
    conscientiousness: float
    extraversion: float
    agreeableness: float
    neuroticism: float


class NPCOut(BaseModel):
    name: str
    role: str
    personality: BigFiveOut
    backstory: str
    knowledge: list[str]
    dialogue_style: str


class ObjectiveOut(BaseModel):
    description: str
    type: str
    target: str
    count: int = 1


class RewardOut(BaseModel):
    type: str
    description: str
    amount: int = 1


class QuestOut(BaseModel):
    title: str
    description: str
    type: str
    objectives: list[ObjectiveOut]
    rewards: list[RewardOut]
    dialogue: str


class QuestTreeOut(BaseModel):
    main_quests: list[QuestOut]
    side_quests: list[QuestOut]


class NarrativeResponse(BaseModel):
    world_id: str
    lore: WorldLoreOut
    npcs: list[NPCOut]
    quests: QuestTreeOut


class DialogueRequest(BaseModel):
    npc_id: str = Field(..., min_length=1)
    message: str = Field(..., min_length=1, max_length=2000)
    context: dict[str, str] = Field(default_factory=dict)
    history: list[dict[str, str]] = Field(default_factory=list)


class DialogueResponse(BaseModel):
    npc_id: str
    response: str


class HealthResponse(BaseModel):
    status: str = "ok"
    service: str = "narrative-generator"
    version: str = "1.0.0"


# ---------------------------------------------------------------------------
# FastAPI application
# ---------------------------------------------------------------------------

app = FastAPI(
    title="NEXAGEN Narrative Service",
    version="1.0.0",
    description="AI-powered narrative, lore, NPC and quest generation",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory NPC store (production would use a database)
_npc_store: dict[str, NPCProfile] = {}
_dialogue_manager = DialogueManager()


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse()


@app.post("/generate", response_model=NarrativeResponse)
async def generate(req: NarrativeRequest) -> NarrativeResponse:
    """Generate full narrative content for a world."""
    logger.info("narrative_generation_started", world_id=req.world_id)

    api_key = os.getenv("ANTHROPIC_API_KEY", "")

    # Step 1: World lore
    structure_dicts = [s.model_dump() for s in req.structures]
    lore = await generate_lore(
        world_description=req.world_description,
        biomes=req.biomes,
        structures=structure_dicts,
        api_key=api_key,
    )

    # Step 2: NPCs
    npcs = await generate_npcs(
        lore=lore,
        structures=structure_dicts,
        count_per_structure=3,
        api_key=api_key,
    )

    # Store NPCs for dialogue
    for npc in npcs:
        _npc_store[npc.name.lower().replace(" ", "_")] = npc

    # Step 3: Quests
    quest_tree = await generate_quests(
        lore=lore,
        npcs=npcs,
        structures=structure_dicts,
        api_key=api_key,
    )

    # Build response
    lore_out = WorldLoreOut(
        title=lore.title,
        history=lore.history,
        factions=[
            FactionOut(name=f.name, description=f.description, alignment=f.alignment)
            for f in lore.factions
        ],
        mysteries=lore.mysteries,
        culture=lore.culture,
    )

    npcs_out = [
        NPCOut(
            name=n.name,
            role=n.role,
            personality=BigFiveOut(**n.personality.__dict__),
            backstory=n.backstory,
            knowledge=n.knowledge,
            dialogue_style=n.dialogue_style,
        )
        for n in npcs
    ]

    quests_out = QuestTreeOut(
        main_quests=[
            QuestOut(
                title=q.title,
                description=q.description,
                type=q.type,
                objectives=[
                    ObjectiveOut(description=o.description, type=o.type, target=o.target, count=o.count)
                    for o in q.objectives
                ],
                rewards=[
                    RewardOut(type=r.type, description=r.description, amount=r.amount)
                    for r in q.rewards
                ],
                dialogue=q.dialogue,
            )
            for q in quest_tree.main_quests
        ],
        side_quests=[
            QuestOut(
                title=q.title,
                description=q.description,
                type=q.type,
                objectives=[
                    ObjectiveOut(description=o.description, type=o.type, target=o.target, count=o.count)
                    for o in q.objectives
                ],
                rewards=[
                    RewardOut(type=r.type, description=r.description, amount=r.amount)
                    for r in q.rewards
                ],
                dialogue=q.dialogue,
            )
            for q in quest_tree.side_quests
        ],
    )

    logger.info(
        "narrative_generation_complete",
        world_id=req.world_id,
        npcs=len(npcs_out),
        main_quests=len(quests_out.main_quests),
        side_quests=len(quests_out.side_quests),
    )

    return NarrativeResponse(
        world_id=req.world_id,
        lore=lore_out,
        npcs=npcs_out,
        quests=quests_out,
    )


@app.post("/dialogue", response_model=DialogueResponse)
async def dialogue(req: DialogueRequest) -> DialogueResponse:
    """Generate an NPC dialogue response."""
    npc = _npc_store.get(req.npc_id)
    if npc is None:
        raise HTTPException(status_code=404, detail=f"NPC '{req.npc_id}' not found")

    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    world_context = req.context.get("world", "A mysterious fantasy world.")

    response_text = await _dialogue_manager.generate_response(
        npc=npc,
        message=req.message,
        history=req.history,
        world_context=world_context,
        api_key=api_key,
    )

    return DialogueResponse(npc_id=req.npc_id, response=response_text)


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=5003, reload=True)
