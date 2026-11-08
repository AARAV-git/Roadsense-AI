from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import Alert
from ..schemas import AlertOut

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("", response_model=list[AlertOut])
async def list_alerts(session_id: int | None = None, limit: int = 100, db: AsyncSession = Depends(get_db)):
    q = select(Alert).order_by(Alert.id.desc()).limit(min(limit, 500))
    if session_id is not None:
        q = q.where(Alert.session_id == session_id)
    return (await db.scalars(q)).all()
