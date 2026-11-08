import math
from collections import defaultdict, deque
from dataclasses import dataclass, field

MIN_SPEED = 0.003          # ignore box jitter below this (fraction of frame diagonal per step)
FULL_TURN = math.pi / 3    # a 60 degree heading change counts as fully erratic
FULL_ACCEL = 0.01          # this much speed change per step counts as a full sudden change


@dataclass
class FrameStats:
    n_objects: int = 0
    class_counts: dict = field(default_factory=dict)
    erratic_mean: float = 0.0
    erratic_max: float = 0.0
    accel_mean: float = 0.0
    accel_max: float = 0.0


def _mean(xs):
    return sum(xs) / len(xs) if xs else 0.0


class MotionTracker:
    """Keeps a short position history per tracked ID and measures erratic movement."""

    def __init__(self, history: int = 10, forget_after: int = 30):
        self.tracks = defaultdict(lambda: deque(maxlen=history))
        self.last_seen: dict[int, int] = {}
        self.step = 0
        self.forget_after = forget_after

    def update(self, dets: list[dict], shape) -> FrameStats:
        self.step += 1
        h, w = shape[:2]
        diag = math.hypot(w, h)
        counts: dict[str, int] = {}
        for d in dets:
            counts[d["cls"]] = counts.get(d["cls"], 0) + 1
            if d["id"] is None:
                continue
            x1, y1, x2, y2 = d["box"]
            self.tracks[d["id"]].append((((x1 + x2) / 2) / diag, y2 / diag))   # bottom-centre point
            self.last_seen[d["id"]] = self.step

        for tid in [t for t, s in self.last_seen.items() if self.step - s > self.forget_after]:
            del self.tracks[tid]
            del self.last_seen[tid]

        erratic, accel = [], []
        for tid, pts in self.tracks.items():
            if self.last_seen[tid] != self.step or len(pts) < 4:
                continue
            steps = [(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) for i in range(1, len(pts))]
            speeds = [math.hypot(*s) for s in steps]
            a1 = math.atan2(steps[-2][1], steps[-2][0])
            a2 = math.atan2(steps[-1][1], steps[-1][0])
            dtheta = abs((a2 - a1 + math.pi) % (2 * math.pi) - math.pi)
            moving = speeds[-1] > MIN_SPEED and speeds[-2] > MIN_SPEED
            erratic.append(min(dtheta / FULL_TURN, 1.0) if moving else 0.0)
            prev = _mean(speeds[:-1])
            accel.append(min(abs(speeds[-1] - prev) / FULL_ACCEL, 1.0))

        return FrameStats(
            n_objects=len(dets), class_counts=counts,
            erratic_mean=_mean(erratic), erratic_max=max(erratic, default=0.0),
            accel_mean=_mean(accel), accel_max=max(accel, default=0.0),
        )
