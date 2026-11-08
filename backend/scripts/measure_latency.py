"""
RoadSense AI - Inference Latency Benchmark
Measures per-stage pipeline latency on GPU (RTX 3070 Ti).
Run from: roadsense-ai/backend/
  python scripts/measure_latency.py
"""
import sys, os, time
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import cv2
import numpy as np
from app.config import settings
from app.services.detector import Detector
from app.services.tracker import MotionTracker
from app.services.chaos_score import compute_chaos
from app.services.fusion import fuse

DUMMY_FRAMES = 60   # number of blank frames to benchmark on

def bench():
    print("Loading YOLOv8 model ...")
    t0 = time.perf_counter()
    detector = Detector(settings.model_path, settings.detect_conf, settings.detect_imgsz)
    load_ms = (time.perf_counter() - t0) * 1000
    print(f"  Model load time : {load_ms:.1f} ms")

    motion = MotionTracker()

    # Use a real-looking synthetic frame (1080p grey road image)
    frame = np.random.randint(80, 160, (1080, 1920, 3), dtype=np.uint8)

    detect_times, chaos_times, fusion_times = [], [], []

    print(f"\nBenchmarking {DUMMY_FRAMES} frames ...")
    for i in range(DUMMY_FRAMES):
        # --- Detection + Tracking ---
        t1 = time.perf_counter()
        dets, annotated = detector.track(frame)
        t2 = time.perf_counter()
        stats = motion.update(dets, frame.shape)
        t3 = time.perf_counter()

        # --- Chaos Metric ---
        chaos = compute_chaos(stats)
        t4 = time.perf_counter()

        # --- Trust Calibration (no sensor data) ---
        fusion = fuse(None, [], time.monotonic())
        t5 = time.perf_counter()

        detect_times.append((t2 - t1) * 1000)
        chaos_times.append((t4 - t3) * 1000)
        fusion_times.append((t5 - t4) * 1000)

        if (i + 1) % 10 == 0:
            print(f"  Frame {i+1:>3}/{DUMMY_FRAMES} done")

    def stats_ms(times):
        return (
            round(sum(times) / len(times), 2),
            round(min(times), 2),
            round(max(times), 2)
        )

    da, dmin, dmax = stats_ms(detect_times)
    ca, cmin, cmax = stats_ms(chaos_times)
    fa, fmin, fmax = stats_ms(fusion_times)
    total_avg = round(da + ca + fa, 2)

    print("\n" + "=" * 55)
    print("LATENCY RESULTS (milliseconds)")
    print("=" * 55)
    print(f"{'Stage':<35} {'Avg':>7} {'Min':>7} {'Max':>7}")
    print("-" * 55)
    print(f"{'YOLOv8 detect + ByteTrack':<35} {da:>7} {dmin:>7} {dmax:>7}")
    print(f"{'Chaos Metric (C_vis)':<35} {ca:>7} {cmin:>7} {cmax:>7}")
    print(f"{'Trust Calibration (fuse)':<35} {fa:>7} {fmin:>7} {fmax:>7}")
    print(f"{'Groq LLM (measured separately)':<35} {'~125':>7} {'  --':>7} {'  --':>7}")
    print("-" * 55)
    print(f"{'End-to-end (excl. LLM)':<35} {total_avg:>7}")
    print("=" * 55)
    print(f"\nEquivalent throughput: ~{round(1000/total_avg, 1)} FPS (vision pipeline only)")

if __name__ == "__main__":
    bench()
