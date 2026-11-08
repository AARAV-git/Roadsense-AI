from datetime import datetime, timezone

from sqlalchemy import String, Integer, Float, BigInteger, Boolean, DateTime, ForeignKey, JSON, Text
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)   # naive UTC everywhere


class AnalysisSession(Base):
    __tablename__ = "sessions"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    source: Mapped[str] = mapped_column(String(20))              # video | live
    status: Mapped[str] = mapped_column(String(20), default="running")
    started_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class Frame(Base):
    """One row per second of analysis (a 'tick')."""
    __tablename__ = "frames"
    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("sessions.id"), index=True)
    frame_no: Mapped[int] = mapped_column(Integer)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    detection_count: Mapped[int] = mapped_column(Integer, default=0)
    class_counts: Mapped[dict] = mapped_column(JSON, default=dict)
    chaos_score: Mapped[float] = mapped_column(Float, default=0.0)
    sensor_online: Mapped[bool] = mapped_column(Boolean, default=False)
    speed_kmh: Mapped[float | None] = mapped_column(Float, nullable=True)
    peak_decel_g: Mapped[float | None] = mapped_column(Float, nullable=True)
    peak_lateral_g: Mapped[float | None] = mapped_column(Float, nullable=True)
    sensor_event: Mapped[str | None] = mapped_column(String(20), nullable=True)
    sensor_age_s: Mapped[float | None] = mapped_column(Float, nullable=True)
    vision_conf: Mapped[float | None] = mapped_column(Float, nullable=True)
    trust_weight: Mapped[float | None] = mapped_column(Float, nullable=True)
    final_conf: Mapped[float | None] = mapped_column(Float, nullable=True)


class SensorReading(Base):
    __tablename__ = "sensor_readings"
    id: Mapped[int] = mapped_column(primary_key=True)
    node_id: Mapped[str] = mapped_column(String(40), index=True)
    seq: Mapped[int] = mapped_column(Integer)
    dropped_since_last: Mapped[int] = mapped_column(Integer, default=0)
    received_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    node_uptime_ms: Mapped[int] = mapped_column(BigInteger)
    gps_source: Mapped[str] = mapped_column(String(20), default="none")
    gps_status: Mapped[str] = mapped_column(String(20), default="no_data")
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lon: Mapped[float | None] = mapped_column(Float, nullable=True)
    speed_kmh: Mapped[float | None] = mapped_column(Float, nullable=True)
    satellites: Mapped[int | None] = mapped_column(Integer, nullable=True)
    peak_decel_g: Mapped[float] = mapped_column(Float, default=0.0)
    peak_lateral_g: Mapped[float] = mapped_column(Float, default=0.0)
    event: Mapped[str] = mapped_column(String(20), default="none")


class Alert(Base):
    __tablename__ = "alerts"
    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int | None] = mapped_column(ForeignKey("sessions.id"), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    alert_type: Mapped[str] = mapped_column(String(40))
    vision_confidence: Mapped[float] = mapped_column(Float)
    trust_weight: Mapped[float] = mapped_column(Float)
    final_confidence: Mapped[float] = mapped_column(Float)
    explanation: Mapped[str] = mapped_column(Text, default="")
