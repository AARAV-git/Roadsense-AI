import asyncio
import logging
import time
from datetime import datetime, timezone

import cv2
from sqlalchemy import update

from ..config import settings
from ..database import SessionLocal
from ..models import AnalysisSession, Frame, Alert, utcnow
from .chaos_score import compute_chaos, detect_vision_event
from .detector import Detector
from .explainer import explain
from .fusion import fuse
from .hub import hub
from .tracker import MotionTracker

import threading

log = logging.getLogger("roadsense.pipeline")
_current: dict[int, dict] = {}


class FreshFrameReader:
    """Threaded camera reader that discards stale buffered frames for zero-latency network streams."""

    def __init__(self, source):
        self.cap = cv2.VideoCapture(source)
        self.is_network = isinstance(source, str) and (source.startswith("http") or source.startswith("rtsp"))
        if self.is_network:
            self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        self.lock = threading.Lock()
        self.running = True
        self.ret, self.frame = self.cap.read()
        if self.is_network and self.ret:
            self.thread = threading.Thread(target=self._worker, daemon=True)
            self.thread.start()

    def isOpened(self) -> bool:
        return self.cap.isOpened()

    def get(self, prop):
        return self.cap.get(prop)

    def _worker(self):
        while self.running:
            try:
                ret, frame = self.cap.read()
                if not ret or frame is None:
                    time.sleep(0.005)
                    continue
                with self.lock:
                    self.ret = ret
                    self.frame = frame
            except Exception:
                time.sleep(0.01)

    def read(self):
        if self.is_network:
            with self.lock:
                if not self.ret or self.frame is None:
                    return False, None
                return True, self.frame.copy()
        return self.cap.read()

    def release(self):
        self.running = False
        self.cap.release()


def is_running() -> bool:
    return any(not v["task"].done() for v in _current.values())


def is_active(sid: int) -> bool:
    v = _current.get(sid)
    return bool(v and not v["task"].done())


def start(sid: int, source):
    stop_event = asyncio.Event()
    _current[sid] = {"task": asyncio.create_task(_run(sid, source, stop_event)), "stop": stop_event}


def stop(sid: int) -> bool:
    v = _current.get(sid)
    if not v:
        return False
    v["stop"].set()
    return True


def _analyze(detector, motion, frame):
    """Runs in a worker thread (YOLO blocks)."""
    dets, annotated = detector.track(frame)
    stats = motion.update(dets, frame.shape)
    ok, buf = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 70])
    return stats, (buf.tobytes() if ok else None)


def _sensor_view(packets: list[dict], now: float) -> dict:
    empty = {"online": False, "speed_kmh": None, "peak_decel_g": None,
             "peak_lateral_g": None, "event": None, "age_s": None}
    if not packets:
        return empty
    p = packets[-1]
    age = now - p["recv_mono"]
    if age > settings.sensor_fresh_seconds:      # stale: values go null so graphs show a gap
        return {**empty, "age_s": round(age, 2)}
    return {"online": True, "speed_kmh": p.get("speed_kmh"), "peak_decel_g": p.get("peak_decel_g"),
            "peak_lateral_g": p.get("peak_lateral_g"), "event": p.get("event"), "age_s": round(age, 2)}


async def _tick(sid, frame_no, stats, peak, last_alert_at):
    now = time.monotonic()
    vision = detect_vision_event(peak["chaos"], peak["erratic"], peak["accel"])
    packets = hub.recent_packets()
    fusion = fuse(vision, packets, now)
    sensor = _sensor_view(packets, now)

    alert = None
    if vision and now - last_alert_at.get(vision.type, -1e9) >= settings.alert_cooldown_seconds:
        last_alert_at[vision.type] = now
        alert = {"type": vision.type, "level": fusion["level"],
                 "explanation": await explain(vision.type, fusion)}

    async with SessionLocal() as db:
        db.add(Frame(
            session_id=sid, frame_no=frame_no, detection_count=stats.n_objects,
            class_counts=stats.class_counts, chaos_score=peak["chaos"],
            sensor_online=sensor["online"], speed_kmh=sensor["speed_kmh"],
            peak_decel_g=sensor["peak_decel_g"], peak_lateral_g=sensor["peak_lateral_g"],
            sensor_event=sensor["event"], sensor_age_s=sensor["age_s"],
            vision_conf=fusion["vision_conf"], trust_weight=fusion["trust_weight"],
            final_conf=fusion["final_conf"]))
        if alert:
            db.add(Alert(session_id=sid, alert_type=alert["type"],
                         vision_confidence=fusion["vision_conf"], trust_weight=fusion["trust_weight"],
                         final_confidence=fusion["final_conf"], explanation=alert["explanation"]))
        await db.commit()

    await hub.broadcast(sid, {
        "type": "tick", "session_id": sid, "frame_no": frame_no,
        "t": datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
        "chaos_score": peak["chaos"], "detections": stats.class_counts,
        "sensor": sensor, "fusion": fusion, "alert": alert})


async def _run(sid: int, source, stop_event: asyncio.Event):
    status, cap = "completed", None
    try:
        detector = await asyncio.to_thread(Detector, settings.model_path,
                                           settings.detect_conf, settings.detect_imgsz)
        motion = MotionTracker()
        cap = await asyncio.to_thread(FreshFrameReader, source)
        if not cap.isOpened():
            raise RuntimeError(f"cannot open video source: {source}")
        fps = cap.get(cv2.CAP_PROP_FPS)
        fps = fps if 1 <= fps <= 120 else 25.0
        interval = 1.0 / fps

        frame_no, last_stats = 0, None
        peak = {"chaos": 0.0, "erratic": 0.0, "accel": 0.0}
        last_tick, last_alert_at = time.monotonic(), {}
        next_time = time.monotonic()

        while not stop_event.is_set():
            ok, frame = await asyncio.to_thread(cap.read)
            if not ok or frame is None:
                await asyncio.sleep(0.01)
                continue
            frame_no += 1
            next_time += interval

            if frame_no % settings.process_every_n == 0:
                stats, jpeg = await asyncio.to_thread(_analyze, detector, motion, frame)
                chaos = compute_chaos(stats)
                peak["chaos"] = max(peak["chaos"], chaos)
                peak["erratic"] = max(peak["erratic"], stats.erratic_max)
                peak["accel"] = max(peak["accel"], stats.accel_max)
                last_stats = stats
                if jpeg:
                    hub.jpeg[sid] = jpeg

            if last_stats and time.monotonic() - last_tick >= 1.0:
                last_tick = time.monotonic()
                await _tick(sid, frame_no, last_stats, peak, last_alert_at)
                peak = {"chaos": 0.0, "erratic": 0.0, "accel": 0.0}

            if cap.is_network:
                # Live network stream: rate is dictated by camera hardware
                await asyncio.sleep(0.005)
            else:
                # Recorded video file: pace to native FPS
                delay = next_time - time.monotonic()
                if delay > 0:
                    await asyncio.sleep(delay)
                else:
                    next_time = time.monotonic()
        if stop_event.is_set():
            status = "stopped"
    except Exception:
        log.exception("pipeline failed")
        status = "failed"
    finally:
        if cap:
            cap.release()
        async with SessionLocal() as db:
            await db.execute(update(AnalysisSession).where(AnalysisSession.id == sid)
                             .values(status=status, ended_at=utcnow()))
            await db.commit()
        await hub.broadcast(sid, {"type": "session_end", "status": status})
        hub.jpeg.pop(sid, None)
        _current.pop(sid, None)
