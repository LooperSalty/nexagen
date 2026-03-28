"""Creature generation microservice for NEXAGEN."""

from __future__ import annotations

import os
import time
from enum import Enum
from typing import Optional

import structlog
import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field

from generators.lsystem import CreatureAesthetic, CreatureMorphologyGenerator
from generators.mesh_gen import MeshGenerator
from generators.texture_gen import TextureGenerator

load_dotenv()

structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ],
)
logger = structlog.get_logger()


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class BiomeHint(str, Enum):
    PLAINS = "plains"
    FOREST = "forest"
    DESERT = "desert"
    TUNDRA = "tundra"
    JUNGLE = "jungle"
    MOUNTAINS = "mountains"
    OCEAN = "ocean"
    SWAMP = "swamp"
    SAVANNA = "savanna"
    TAIGA = "taiga"


class CreatureRole(str, Enum):
    PASSIVE = "passive"
    NEUTRAL = "neutral"
    HOSTILE = "hostile"
    MOUNT = "mount"
    PET = "pet"
    BOSS = "boss"


class CreatureSize(str, Enum):
    TINY = "tiny"
    SMALL = "small"
    MEDIUM = "medium"
    LARGE = "large"
    HUGE = "huge"


class BoneData(BaseModel):
    name: str
    parent_index: int
    local_position: tuple[float, float, float]
    local_rotation: tuple[float, float, float]
    length: float
    radius: float


class AestheticData(BaseModel):
    base_color: tuple[int, int, int]
    pattern_type: str
    material: str
    glow: bool
    size_scale: float


class CreatureData(BaseModel):
    creature_id: str
    body_plan: str
    bones: list[BoneData]
    aesthetic: AestheticData
    mesh_b64: str  # base64-encoded glTF binary
    texture_b64: str  # base64-encoded PNG
    generation_time_ms: float


class CreatureGenerationRequest(BaseModel):
    world_id: str = Field(..., min_length=1)
    biome: BiomeHint = BiomeHint.PLAINS
    role: CreatureRole = CreatureRole.PASSIVE
    size: CreatureSize = CreatureSize.MEDIUM
    count: int = Field(default=1, ge=1, le=20)
    seed: int = Field(default=42)


class HealthResponse(BaseModel):
    status: str = "ok"
    service: str = "creature-generator"
    version: str = "1.0.0"


# ---------------------------------------------------------------------------
# FastAPI application
# ---------------------------------------------------------------------------

app = FastAPI(
    title="NEXAGEN Creature Service",
    version="1.0.0",
    description="AI-powered procedural creature generation",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse()


@app.post("/generate", response_model=list[CreatureData])
async def generate(req: CreatureGenerationRequest) -> list[CreatureData]:
    """Generate one or more creatures based on biome, role, and size."""
    import base64
    import uuid

    logger.info(
        "creature_generation_started",
        world_id=req.world_id,
        biome=req.biome.value,
        role=req.role.value,
        count=req.count,
    )

    morph_gen = CreatureMorphologyGenerator()
    mesh_gen = MeshGenerator()
    tex_gen = TextureGenerator()

    results: list[CreatureData] = []
    for i in range(req.count):
        start = time.perf_counter()
        creature_seed = req.seed + i

        morphology = morph_gen.generate(
            biome=req.biome.value,
            role=req.role.value,
            seed=creature_seed,
        )

        # Scale by requested size
        size_scales = {"tiny": 0.3, "small": 0.6, "medium": 1.0, "large": 1.8, "huge": 3.0}
        scale = size_scales.get(req.size.value, 1.0)
        morphology = morphology._replace(
            aesthetic=CreatureAesthetic(
                base_color=morphology.aesthetic.base_color,
                pattern_type=morphology.aesthetic.pattern_type,
                material=morphology.aesthetic.material,
                glow=morphology.aesthetic.glow,
                size_scale=morphology.aesthetic.size_scale * scale,
            )
        )

        gltf_bytes = mesh_gen.generate(morphology)
        tex_image = tex_gen.generate(morphology.aesthetic)
        import io
        buf = io.BytesIO()
        tex_image.save(buf, format="PNG")
        tex_bytes = buf.getvalue()

        elapsed_ms = (time.perf_counter() - start) * 1000

        bones = [
            BoneData(
                name=b.name,
                parent_index=b.parent_index,
                local_position=b.local_position,
                local_rotation=b.local_rotation,
                length=b.length,
                radius=b.radius,
            )
            for b in morphology.bones
        ]

        aesthetic = AestheticData(
            base_color=morphology.aesthetic.base_color,
            pattern_type=morphology.aesthetic.pattern_type,
            material=morphology.aesthetic.material,
            glow=morphology.aesthetic.glow,
            size_scale=morphology.aesthetic.size_scale,
        )

        results.append(
            CreatureData(
                creature_id=str(uuid.uuid4()),
                body_plan=morphology.body_plan if hasattr(morphology, "body_plan") else "quadruped",
                bones=bones,
                aesthetic=aesthetic,
                mesh_b64=base64.b64encode(gltf_bytes).decode(),
                texture_b64=base64.b64encode(tex_bytes).decode(),
                generation_time_ms=round(elapsed_ms, 2),
            )
        )

    logger.info("creature_generation_complete", count=len(results))
    return results


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=5002, reload=True)
