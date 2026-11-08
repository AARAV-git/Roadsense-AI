import asyncio
import shutil
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..database import get_db
from ..models import AnalysisSession
from ..services import pipeline

router = APIRouter(prefix="/api/analysis", tags=["analysis"])
ALLOWED = {".mp4", ".avi", ".mov", ".mkv", ".webm"}


def _ensure_idle():
    if pipeline.is_running():
        raise HTTPException(409, "a session is already running; stop it first")


@router.post("/upload")
async def upload(file: UploadFile = File(...), name: str = Form(""), db: AsyncSession = Depends(get_db)):
    _ensure_idle()
    ext = Path(file.filename or "clip.mp4").suffix.lower() or ".mp4"
    if ext not in ALLOWED:
        raise HTTPException(400, f"unsupported file type {ext}")
    dest = Path(settings.upload_dir) / f"{uuid4().hex}{ext}"
    dest.parent.mkdir(parents=True, exist_ok=True)
    with dest.open("wb") as f:
        await asyncio.to_thread(shutil.copyfileobj, file.file, f)

    session = AnalysisSession(name=name or file.filename or "clip", source="video")
    db.add(session)
    await db.commit()
    await db.refresh(session)
    pipeline.start(session.id, str(dest))
    return {"session_id": session.id}


@router.post("/live")
async def live(camera: str = "0", name: str = "Live camera", db: AsyncSession = Depends(get_db)):
    """camera = webcam index (0, 1...) or a stream URL."""
    _ensure_idle()
    session = AnalysisSession(name=name, source="live")
    db.add(session)
    await db.commit()
    await db.refresh(session)
    pipeline.start(session.id, int(camera) if camera.isdigit() else camera)
    return {"session_id": session.id}


@router.post("/phone-camera")
async def phone_camera(url: str | None = None, name: str = "Redmi Note 8 Pro", db: AsyncSession = Depends(get_db)):
    """Start the IP-Webcam stream (URL from param or PHONE_CAMERA_URL in .env)."""
    _ensure_idle()
    stream_url = url or settings.phone_camera_url
    if not stream_url:
        raise HTTPException(400, "PHONE_CAMERA_URL is not set in .env")
    session = AnalysisSession(name=name, source="phone_camera")
    db.add(session)
    await db.commit()
    await db.refresh(session)
    pipeline.start(session.id, stream_url)
    return {"session_id": session.id, "stream_url": stream_url}


@router.post("/{session_id}/stop")
async def stop(session_id: int):
    if not pipeline.stop(session_id):
        raise HTTPException(404, "session is not running")
    return {"ok": True}
