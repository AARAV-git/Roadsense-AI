"""Fake ESP32: sends sensor packets to the backend so you can test without hardware.
Run from the backend folder:  python scripts/simulate_sensor.py --mode mixed
"""
import argparse
import random
import time

import requests


def env_key() -> str:
    try:
        for line in open(".env"):
            if line.startswith("API_KEY="):
                return line.split("=", 1)[1].strip()
    except OSError:
        pass
    return "change-me"


p = argparse.ArgumentParser()
p.add_argument("--url", default="http://localhost:8000/api/sensors")
p.add_argument("--key", default=env_key())
p.add_argument("--mode", choices=["normal", "brake", "turn", "mixed", "dropout"], default="mixed")
args = p.parse_args()

seq, speed = 0, 30.0
while True:
    phase = seq % 20
    event, decel, lateral = "none", random.uniform(0, 0.08), random.uniform(0, 0.06)
    if args.mode in ("brake", "mixed") and phase == 8:
        event, decel = "harsh_brake", random.uniform(0.4, 0.6)
    if args.mode in ("turn", "mixed") and phase == 14:
        event, lateral = "sharp_turn", random.uniform(0.3, 0.5)
    speed = max(0.0, speed + random.uniform(-2, 2) - (6 if event == "harsh_brake" else 0))

    if args.mode == "dropout" and phase in range(10, 18):      # 8 seconds of silence, seq jumps
        seq += 1
        time.sleep(1)
        continue

    body = {"node_id": "sim_01", "seq": seq, "uptime_ms": seq * 1000,
            "gps": {"source": "sim", "status": "fix", "latitude": 19.0760, "longitude": 72.8777,
                    "speed_kmh": round(speed, 1), "satellites": 8},
            "imu": {"peak_decel_g": round(decel, 3), "peak_lateral_g": round(lateral, 3), "event": event}}
    try:
        r = requests.post(args.url, json=body, headers={"X-API-Key": args.key}, timeout=2)
        print(seq, event, r.status_code)
    except requests.RequestException as e:
        print("post failed:", e)
    seq += 1
    time.sleep(1)
