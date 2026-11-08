import os
import tempfile
import time

os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///" + os.path.join(tempfile.mkdtemp(), "t.db")
os.environ["API_KEY"] = "testkey"

from fastapi.testclient import TestClient   # noqa: E402

from app.main import app                                     # noqa: E402
from app.services.chaos_score import VisionEvent              # noqa: E402
from app.services.fusion import fuse                          # noqa: E402
from app.services.tracker import MotionTracker                # noqa: E402
from app.utils.geo import haversine_m                         # noqa: E402

H = {"X-API-Key": "testkey"}


def packet(seq, event="none", decel=0.05, lateral=0.03):
    return {"node_id": "t1", "seq": seq, "uptime_ms": seq * 1000,
            "gps": {"source": "neo6m", "status": "fix", "latitude": 19.0, "longitude": 73.0,
                    "speed_kmh": 30.5, "satellites": 7, "extra_field": "ignored"},
            "imu": {"peak_decel_g": decel, "peak_lateral_g": lateral, "event": event}}


def test_hardware_flow():
    with TestClient(app) as c:
        assert c.get("/api/health").json() == {"status": "ok"}
        assert c.get("/api/sensors/latest").json() == {"online": False, "reading": None}
        assert c.post("/api/sensors", json=packet(0)).status_code == 401
        assert c.post("/api/sensors", json=packet(0), headers={"X-API-Key": "wrong"}).status_code == 401
        assert c.post("/api/sensors", json=packet(0), headers=H).json()["dropped_since_last"] == 0
        assert c.post("/api/sensors", json=packet(3, "harsh_brake", 0.5), headers=H).json()["dropped_since_last"] == 2
        assert c.post("/api/sensors", json=packet(0), headers=H).json()["dropped_since_last"] == 0  # reboot
        bad = packet(9); bad["imu"]["event"] = "explode"
        assert c.post("/api/sensors", json=bad, headers=H).status_code == 422
        latest = c.get("/api/sensors/latest").json()
        assert latest["online"] is True and latest["reading"]["received_at"].endswith("Z")
        assert len(c.get("/api/sensors/history?seconds=60").json()) == 3
        hw = c.get("/api/hardware/status").json()
        assert hw["online"] and hw["dropped_last_60s"] == 2 and hw["gps_source"] == "neo6m"
        assert c.get("/api/sessions").json() == []
        assert c.get("/api/sessions/99").status_code == 404
        assert c.get("/api/alerts").json() == []


def test_fusion_trust_changes():
    now = time.monotonic()
    ev = VisionEvent("sudden_slowdown", 0.8)
    confirmed = fuse(ev, [{"recv_mono": now - 0.5, "peak_decel_g": 0.5, "peak_lateral_g": 0, "event": "harsh_brake"}], now)
    calm = fuse(ev, [{"recv_mono": now - 0.5, "peak_decel_g": 0.02, "peak_lateral_g": 0, "event": "none"}], now)
    stale = fuse(ev, [{"recv_mono": now - 20, "peak_decel_g": 0.5, "peak_lateral_g": 0, "event": "harsh_brake"}], now)
    none = fuse(ev, [], now)
    assert confirmed["reason"] == "confirmed" and confirmed["trust_weight"] >= 0.9
    assert calm["reason"] == "camera_only_calm" and calm["trust_weight"] == 0.5
    assert stale["reason"] == "camera_only_stale" and stale["trust_weight"] == 0.4
    assert none["reason"] == "camera_only_stale"
    assert confirmed["final_conf"] > calm["final_conf"] > stale["final_conf"]
    assert fuse(None, [], now)["final_conf"] is None


def test_tracker_detects_erratic_motion():
    m = MotionTracker()
    shape = (720, 1280, 3)
    # steady object moving right, and one zig-zagging
    for i in range(8):
        steady = {"id": 1, "cls": "car", "conf": .9, "box": [100 + i * 40, 300, 200 + i * 40, 400]}
        zig = {"id": 2, "cls": "autorickshaw", "conf": .9,
               "box": [600 + (60 if i % 2 else -60), 300 + i * 40, 700 + (60 if i % 2 else -60), 400 + i * 40]}
        stats = m.update([steady, zig], shape)
    assert stats.n_objects == 2 and stats.class_counts == {"car": 1, "autorickshaw": 1}
    assert stats.erratic_max > 0.5


def test_haversine():
    assert abs(haversine_m(19.0, 73.0, 19.0, 73.001) - 105) < 3
