"""ProfitPilot AI backend entrypoint: uvicorn backend.main:app"""

import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .api import actions, investigations, sessions, uploads


def cors_origins() -> list[str]:
    """Allowed frontend origins, comma-separated in CORS_ORIGINS."""
    raw = os.getenv("CORS_ORIGINS", "http://localhost:3000")
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


def cors_origin_regex() -> str | None:
    """Regex matched against the request Origin (covers Vercel's
    per-deployment preview URLs, which cannot be allowlisted one by one).
    Set CORS_ORIGIN_REGEX to "" to disable; unset allows any https
    *.vercel.app origin. Explicit CORS_ORIGINS entries always apply too."""
    return os.getenv("CORS_ORIGIN_REGEX", r"https://.*\.vercel\.app") or None


app = FastAPI(title="ProfitPilot AI", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins(),
    allow_origin_regex=cors_origin_regex(),
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(uploads.router)
app.include_router(investigations.router)
app.include_router(actions.router)
app.include_router(sessions.router)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Last resort: report crashes as JSON instead of an empty 500.

    Uncaught exceptions bypass CORSMiddleware, so browsers misreport them
    as CORS policy blocks. Handling them here keeps the CORS headers and
    shows the real error. (HTTPException keeps its own, more specific
    handler and is unaffected.)
    """
    return JSONResponse(
        status_code=500, content={"detail": f"{type(exc).__name__}: {exc}"}
    )


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
