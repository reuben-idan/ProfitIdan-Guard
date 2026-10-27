"""ProfitPilot AI backend entrypoint: uvicorn backend.main:app"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import actions, investigations, sessions, uploads

app = FastAPI(title="ProfitPilot AI", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
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
