import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import update

from .config import settings
from .database import init_db, SessionLocal
from .models import AnalysisSession, utcnow
from .routers import sensors, analysis, sessions, alerts, live


@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs("data", exist_ok=True)
    os.makedirs(settings.upload_dir, exist_ok=True)
    await init_db()
    async with SessionLocal() as db:        # anything still "running" from a previous crash
        await db.execute(update(AnalysisSession).where(AnalysisSession.status == "running")
                         .values(status="interrupted", ended_at=utcnow()))
        await db.commit()
    yield


app = FastAPI(title="RoadSense AI", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_list,
                   allow_methods=["*"], allow_headers=["*"])

for r in (sensors.router, analysis.router, sessions.router, alerts.router, live.router):
    app.include_router(r)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
