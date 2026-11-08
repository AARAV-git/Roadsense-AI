import secrets
from datetime import timedelta

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..database import get_db
from ..models import SensorReading, utcnow
from ..schemas import SensorPacket, SensorReadingOut, LatestSensor, HardwareStatus
from ..services.hub import hub

router = APIRouter(prefix="/api", tags=["sensors"])


def require_key(x_api_key: str = Header(default="")):
    if not secrets.compare_digest(x_api_key.encode(), settings.api_key.encode()):
        raise HTTPException(status_code=401, detail="invalid API key")


def _out(row: SensorReading) -> SensorReadingOut:
    age = (utcnow() - row.received_at).total_seconds()
    out = SensorReadingOut.model_validate(row)
    return out.model_copy(update={"age_s": round(age, 2), "online": age <= settings.sensor_fresh_seconds})


@router.post("/sensors", dependencies=[Depends(require_key)])
async def ingest(packet: SensorPacket, db: AsyncSession = Depends(get_db)):
    last_seq = await db.scalar(
        select(SensorReading.seq).where(SensorReading.node_id == packet.node_id)
        .order_by(SensorReading.id.desc()).limit(1))
    # gap in seq = packets lost; a lower seq means the ESP32 rebooted, so no drop is counted
    dropped = packet.seq - last_seq - 1 if last_seq is not None and packet.seq > last_seq else 0

    db.add(SensorReading(
        node_id=packet.node_id, seq=packet.seq, dropped_since_last=dropped,
        node_uptime_ms=packet.uptime_ms, gps_source=packet.gps.source, gps_status=packet.gps.status,
        lat=packet.gps.latitude, lon=packet.gps.longitude, speed_kmh=packet.gps.speed_kmh,
        satellites=packet.gps.satellites, peak_decel_g=packet.imu.peak_decel_g,
        peak_lateral_g=packet.imu.peak_lateral_g, event=packet.imu.event))
    await db.commit()

    hub.push_sensor({"node_id": packet.node_id, "seq": packet.seq, "speed_kmh": packet.gps.speed_kmh,
                     "peak_decel_g": packet.imu.peak_decel_g, "peak_lateral_g": packet.imu.peak_lateral_g,
                     "event": packet.imu.event})
    return {"ok": True, "dropped_since_last": dropped}


@router.get("/sensors/latest", response_model=LatestSensor)
async def latest(db: AsyncSession = Depends(get_db)):
    row = await db.scalar(select(SensorReading).order_by(SensorReading.id.desc()).limit(1))
    if row is None:
        return LatestSensor(online=False, reading=None)
    out = _out(row)
    return LatestSensor(online=out.online, reading=out)


@router.get("/sensors/history", response_model=list[SensorReadingOut])
async def history(seconds: int = 60, db: AsyncSession = Depends(get_db)):
    since = utcnow() - timedelta(seconds=min(max(seconds, 1), 3600))
    rows = (await db.scalars(select(SensorReading).where(SensorReading.received_at >= since)
                             .order_by(SensorReading.id.asc()))).all()
    return [SensorReadingOut.model_validate(r) for r in rows]


@router.get("/hardware/status", response_model=HardwareStatus)
async def hardware_status(db: AsyncSession = Depends(get_db)):
    row = await db.scalar(select(SensorReading).order_by(SensorReading.id.desc()).limit(1))
    now = utcnow()
    n10 = await db.scalar(select(func.count(SensorReading.id))
                          .where(SensorReading.received_at >= now - timedelta(seconds=10)))
    dropped = await db.scalar(select(func.coalesce(func.sum(SensorReading.dropped_since_last), 0))
                              .where(SensorReading.received_at >= now - timedelta(seconds=60)))
    if row is None:
        return HardwareStatus(online=False, node_id=None, last_seen=None, age_s=None,
                              packets_per_second=0, dropped_last_60s=0,
                              gps_source=None, gps_status=None, satellites=None)
    age = (now - row.received_at).total_seconds()
    return HardwareStatus(online=age <= settings.sensor_fresh_seconds, node_id=row.node_id,
                          last_seen=row.received_at, age_s=round(age, 2),
                          packets_per_second=round((n10 or 0) / 10, 2), dropped_last_60s=int(dropped or 0),
                          gps_source=row.gps_source, gps_status=row.gps_status, satellites=row.satellites)
