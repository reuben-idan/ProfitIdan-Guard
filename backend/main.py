"""ProfitPilot AI backend entrypoint: uvicorn backend.main:app"""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import actions, investigations, sessions, uploads


def cors_origins() -> list[str]:
    """Allowed frontend origins, comma-separated in CORS_ORIGINS."""
    raw = os.getenv("CORS_ORIGINS", "http://localhost:3000")
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


app = FastAPI(title="ProfitPilot AI", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins(),
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(uploads.router)
app.include_router(investigations.router)
app.include_router(actions.router)
app.include_router(sessions.router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
