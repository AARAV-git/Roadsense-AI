from ..config import settings
from .chaos_score import VisionEvent

BRAKE_FULL_G = 0.5     # this much deceleration = full braking evidence
TURN_FULL_G = 0.4      # this much lateral g = full turning evidence
AGREE_MIN = 0.4        # sensor evidence needed to count as "camera and sensor agree"


def _freshness(age: float | None) -> float:
    """1.0 while data is recent, fades to 0 as it gets stale, 0 if no data."""
    if age is None:
        return 0.0
    fresh = settings.sensor_fresh_seconds
    if age <= fresh:
        return 1.0
    return max(0.0, 1.0 - (age - fresh) / (2 * fresh))


def _strengths(recent: list[dict]) -> tuple[float, float]:
    brake = turn = 0.0
    for p in recent:
        brake = max(brake, min(1.0, (p.get("peak_decel_g") or 0.0) / BRAKE_FULL_G))
        turn = max(turn, min(1.0, (p.get("peak_lateral_g") or 0.0) / TURN_FULL_G))
        if p.get("event") == "harsh_brake":
            brake = max(brake, 0.6)
        if p.get("event") == "sharp_turn":
            turn = max(turn, 0.6)
    return brake, turn


def fuse(vision: VisionEvent | None, packets: list[dict], now: float) -> dict:
    """Trust calibration: the camera's confidence is scaled by how well fresh sensor data confirms it."""
    newest = packets[-1] if packets else None
    age = (now - newest["recv_mono"]) if newest else None
    fresh = _freshness(age)

    agree, sensor_conf = False, 0.0
    if vision and fresh > 0:
        recent = [p for p in packets if now - p["recv_mono"] <= settings.match_window_seconds]
        brake, turn = _strengths(recent)
        sensor_conf = {"lane_cut": turn, "sudden_slowdown": brake}.get(vision.type, max(brake, turn))
        agree = sensor_conf >= AGREE_MIN

    # Trust: 0.6-1.0 when the sensor confirms the camera, 0.4-0.5 when the camera stands alone
    trust = 0.6 + 0.4 * fresh * sensor_conf if agree else 0.4 + 0.1 * fresh
    trust = round(trust, 3)

    if not vision:
        return {"vision_conf": None, "sensor_conf": None, "agree": None, "freshness": round(fresh, 2),
                "trust_weight": trust, "final_conf": None, "level": None, "reason": "no_event"}

    final = round(min(1.0, vision.confidence * (0.5 + 0.5 * trust)), 3)
    level = "high" if final >= 0.7 else "moderate" if final >= 0.45 else "low"
    reason = "confirmed" if agree else ("camera_only_calm" if fresh > 0.5 else "camera_only_stale")
    return {"vision_conf": vision.confidence, "sensor_conf": round(sensor_conf, 3), "agree": agree,
            "freshness": round(fresh, 2), "trust_weight": trust, "final_conf": final,
            "level": level, "reason": reason}
