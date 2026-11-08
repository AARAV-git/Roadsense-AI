from datetime import datetime, timezone
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, PlainSerializer


def _iso_z(d: datetime) -> str:
    if d.tzinfo is not None:
        d = d.astimezone(timezone.utc).replace(tzinfo=None)
    return d.isoformat(timespec="milliseconds") + "Z"


# Naive UTC datetimes are sent with a trailing Z so browsers don't read them as local time
UtcDatetime = Annotated[datetime, PlainSerializer(_iso_z, return_type=str)]


# ---- incoming ESP32 packet (extra fields from the firmware are ignored) ----
class GpsData(BaseModel):
    source: str = "none"
    status: str = "no_data"
    latitude: float | None = None
    longitude: float | None = None
    speed_kmh: float | None = None
    satellites: int | None = None


class ImuData(BaseModel):
    peak_decel_g: float = 0.0
    peak_lateral_g: float = 0.0
    event: Literal["none", "harsh_brake", "sharp_turn"] = "none"


class SensorPacket(BaseModel):
    node_id: str = Field(max_length=40)
    seq: int = Field(ge=0)
    uptime_ms: int = Field(ge=0)
    gps: GpsData = Field(default_factory=GpsData)
    imu: ImuData = Field(default_factory=ImuData)


# ---- outgoing ----
class SensorReadingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    node_id: str
    seq: int
    dropped_since_last: int
    received_at: UtcDatetime
    node_uptime_ms: int
    gps_source: str
    gps_status: str
    lat: float | None
    lon: float | None
    speed_kmh: float | None
    satellites: int | None
    peak_decel_g: float
    peak_lateral_g: float
    event: str
    age_s: float | None = None
    online: bool = False


class LatestSensor(BaseModel):
    online: bool
    reading: SensorReadingOut | None


class HardwareStatus(BaseModel):
    online: bool
    node_id: str | None
    last_seen: UtcDatetime | None
    age_s: float | None
    packets_per_second: float
    dropped_last_60s: int
    gps_source: str | None
    gps_status: str | None
    satellites: int | None


class SessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    source: str
    status: str
    started_at: UtcDatetime
    ended_at: UtcDatetime | None


class SessionSummary(SessionOut):
    frame_count: int = 0
    avg_chaos: float | None = None
    max_chaos: float | None = None
    alert_count: int = 0
    avg_trust_weight: float | None = None
    avg_final_conf: float | None = None


class FrameOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    session_id: int
    frame_no: int
    timestamp: UtcDatetime
    detection_count: int
    class_counts: dict
    chaos_score: float
    sensor_online: bool
    speed_kmh: float | None
    peak_decel_g: float | None
    peak_lateral_g: float | None
    sensor_event: str | None
    sensor_age_s: float | None
    vision_conf: float | None
    trust_weight: float | None
    final_conf: float | None


class AlertOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    session_id: int | None
    created_at: UtcDatetime
    alert_type: str
    vision_confidence: float
    trust_weight: float
    final_confidence: float
    explanation: str
