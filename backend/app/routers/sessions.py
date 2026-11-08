from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import AnalysisSession, Frame, Alert
from ..schemas import SessionOut, SessionSummary, FrameOut

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


@router.get("", response_model=list[SessionOut])
async def list_sessions(db: AsyncSession = Depends(get_db)):
    return (await db.scalars(select(AnalysisSession).order_by(AnalysisSession.id.desc()))).all()


@router.get("/{sid}", response_model=SessionSummary)
async def summary(sid: int, db: AsyncSession = Depends(get_db)):
    s = await db.get(AnalysisSession, sid)
    if not s:
        raise HTTPException(404, "session not found")
    f = (await db.execute(select(func.count(Frame.id), func.avg(Frame.chaos_score), func.max(Frame.chaos_score))
                          .where(Frame.session_id == sid))).one()
    a = (await db.execute(select(func.count(Alert.id), func.avg(Alert.trust_weight), func.avg(Alert.final_confidence))
                          .where(Alert.session_id == sid))).one()
    r = lambda x: round(x, 3) if x is not None else None
    return SessionSummary.model_validate(s).model_copy(update={
        "frame_count": f[0], "avg_chaos": r(f[1]), "max_chaos": r(f[2]),
        "alert_count": a[0], "avg_trust_weight": r(a[1]), "avg_final_conf": r(a[2])})


@router.get("/{sid}/frames", response_model=list[FrameOut])
async def frames(sid: int, db: AsyncSession = Depends(get_db)):
    return (await db.scalars(select(Frame).where(Frame.session_id == sid).order_by(Frame.id.asc()))).all()
