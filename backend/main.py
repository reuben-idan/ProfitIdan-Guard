"""ProfitPilot AI backend entrypoint: uvicorn backend.main:app"""

from fastapi import FastAPI

from .api import actions, investigations, uploads

app = FastAPI(title="ProfitPilot AI", version="0.1.0")
app.include_router(uploads.router)
app.include_router(investigations.router)
app.include_router(actions.router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
