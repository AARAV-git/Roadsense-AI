from dataclasses import dataclass

from ..config import settings
from .tracker import FrameStats


@dataclass
class VisionEvent:
    type: str          # lane_cut | sudden_slowdown | high_chaos
    confidence: float


def _clamp(x: float) -> float:
    return max(0.0, min(1.0, x))


def compute_chaos(s: FrameStats) -> float:
    """0..1. Replace with your existing formula if you have one; only this signature matters."""
    density = min(s.n_objects / 15, 1.0)
    mix = min(len(s.class_counts) / 4, 1.0)
    erratic = 0.5 * s.erratic_mean + 0.5 * s.erratic_max
    accel = 0.5 * s.accel_mean + 0.5 * s.accel_max
    return round(_clamp(0.30 * density + 0.15 * mix + 0.30 * erratic + 0.25 * accel), 3)


def detect_vision_event(chaos: float, erratic_max: float, accel_max: float) -> VisionEvent | None:
    strength = max(chaos, erratic_max, accel_max)
    if strength < settings.event_threshold:
        return None
    if erratic_max >= 0.6 and erratic_max >= accel_max:
        kind = "lane_cut"
    elif accel_max >= 0.6:
        kind = "sudden_slowdown"
    else:
        kind = "high_chaos"
    return VisionEvent(kind, round(min(1.0, 0.45 + 0.55 * strength), 3))
