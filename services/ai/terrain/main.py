"""Terrain generation microservice for NEXAGEN."""

from __future__ import annotations

import os
import time
from enum import Enum
from typing import Any

import structlog
import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from generators.pipeline import WorldGenerationPipeline

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


class WorldParams(BaseModel):
    biomes: list[BiomeHint] = Field(default_factory=lambda: [BiomeHint.PLAINS])
    temperature_range: tuple[float, float] = (0.3, 0.7)
    humidity_range: tuple[float, float] = (0.3, 0.7)
    elevation_scale: float = Field(default=1.0, ge=0.1, le=10.0)
    sea_level: float = Field(default=0.3, ge=0.0, le=1.0)
    structure_density: float = Field(default=0.5, ge=0.0, le=1.0)
    tree_density: float = Field(default=0.5, ge=0.0, le=1.0)


class WorldGenerationRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=2000)
    seed: int = Field(default=42)
    size: int = Field(default=256, ge=16, le=2048)
    params: WorldParams | None = None


class ChunkMeta(BaseModel):
    x: int
    z: int
    biome: str
    min_y: int
    max_y: int


class WorldGenerationResponse(BaseModel):
    world_id: str
    seed: int
    size: int
    params: WorldParams
    chunks: list[ChunkMeta]
    generation_time_ms: float
    heightmap_url: str | None = None


class PromptParseRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=2000)


class HealthResponse(BaseModel):
    status: str = "ok"
    service: str = "terrain-generator"
    version: str = "1.0.0"


# ---------------------------------------------------------------------------
# FastAPI application
# ---------------------------------------------------------------------------

app = FastAPI(
    title="NEXAGEN Terrain Service",
    version="1.0.0",
    description="AI-powered terrain generation for voxel worlds",
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


@app.post("/parse-prompt", response_model=WorldParams)
async def parse_prompt(req: PromptParseRequest) -> WorldParams:
    """Use Claude API to parse a natural-language prompt into WorldParams."""
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        logger.warning("anthropic_api_key_missing", fallback=True)
        return WorldParams()

    try:
        import anthropic

        client = anthropic.AsyncAnthropic(api_key=api_key)

        system_prompt = (
            "You are a terrain parameter extractor. Given a user description of a "
            "game world, return ONLY valid JSON matching this schema:\n"
            '{"biomes": ["plains"|"forest"|"desert"|"tundra"|"jungle"|"mountains"|"ocean"|"swamp"|"savanna"|"taiga"], '
            '"temperature_range": [min, max], "humidity_range": [min, max], '
            '"elevation_scale": float 0.1-10, "sea_level": float 0-1, '
            '"structure_density": float 0-1, "tree_density": float 0-1}\n'
            "Return raw JSON only, no markdown."
        )

        message = await client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=512,
            system=system_prompt,
            messages=[{"role": "user", "content": req.prompt}],
        )
        import json

        raw = message.content[0].text.strip()
        data = json.loads(raw)
        return WorldParams(**data)
    except Exception as exc:
        logger.error("prompt_parse_failed", error=str(exc))
        raise HTTPException(status_code=500, detail=f"Prompt parsing failed: {exc}") from exc


@app.post("/generate", response_model=WorldGenerationResponse)
async def generate(req: WorldGenerationRequest) -> WorldGenerationResponse:
    """Generate a full voxel world from the request parameters."""
    start = time.perf_counter()
    logger.info("generation_started", seed=req.seed, size=req.size, prompt=req.prompt[:80])

    params = req.params or WorldParams()

    pipeline = WorldGenerationPipeline()

    try:
        manifest = await pipeline.generate(
            prompt=req.prompt,
            seed=req.seed,
            size=req.size,
            params=params,
        )
    except Exception as exc:
        logger.error("generation_failed", error=str(exc))
        raise HTTPException(status_code=500, detail=f"Generation failed: {exc}") from exc

    elapsed_ms = (time.perf_counter() - start) * 1000
    logger.info("generation_complete", world_id=manifest.world_id, elapsed_ms=elapsed_ms)

    chunks = [
        ChunkMeta(x=c.x, z=c.z, biome=c.biome, min_y=c.min_y, max_y=c.max_y)
        for c in manifest.chunks
    ]

    return WorldGenerationResponse(
        world_id=manifest.world_id,
        seed=req.seed,
        size=req.size,
        params=params,
        chunks=chunks,
        generation_time_ms=round(elapsed_ms, 2),
        heightmap_url=manifest.heightmap_url,
    )


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=5001, reload=True)
