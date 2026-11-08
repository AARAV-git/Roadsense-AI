"""
RoadSense AI - Per-Class YOLO Validation
Runs yolo val on each fine-tuned model and prints per-class metrics.
Run from: roadsense-ai/backend/
  python scripts/yolo_val.py
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from ultralytics import YOLO

MODELS = [
    {
        "name": "Auto-Rickshaw v1",
        "weights": r"C:\Users\sunny\Desktop\Roadsense AI\roadsense-ai\backend\weights\auto_rickshaw_best.pt",
        "data": r"C:\Users\sunny\Desktop\ADAS Adoption\backend\datasets\auto_rickshaw_fixed.yaml",
    },
    {
        "name": "Rider Detector v1.2",
        "weights": r"C:\Users\sunny\Desktop\Roadsense AI\roadsense-ai\backend\weights\rider_best.pt",
        "data": r"C:\Users\sunny\Desktop\ADAS Adoption\backend\datasets\rider_fixed.yaml",
    },
]

def run():
    for m in MODELS:
        print("\n" + "=" * 60)
        print(f"MODEL: {m['name']}")
        print(f"Weights: {m['weights']}")
        print("=" * 60)

        if not os.path.exists(m["weights"]):
            print(f"  [SKIP] Weights file not found: {m['weights']}")
            continue
        if not os.path.exists(m["data"]):
            print(f"  [SKIP] Dataset YAML not found: {m['data']}")
            print("  Please verify the dataset YAML path and re-run.")
            continue

        model = YOLO(m["weights"])
        results = model.val(
            data=m["data"],
            imgsz=640,
            conf=0.35,
            iou=0.7,
            device=0,
            split="test",
            verbose=True,
        )

        # Per-class results
        names = results.names
        print(f"\n{'Class':<25} {'Precision':>10} {'Recall':>8} {'mAP@0.5':>9} {'mAP@0.5:0.95':>13}")
        print("-" * 70)
        for i, name in names.items():
            try:
                p  = round(float(results.box.p[i]), 3)
                r  = round(float(results.box.r[i]), 3)
                m50   = round(float(results.box.ap50[i]), 3)
                m5095 = round(float(results.box.ap[i]), 3)
                print(f"{name:<25} {p:>10} {r:>8} {m50:>9} {m5095:>13}")
            except (IndexError, AttributeError):
                print(f"{name:<25}   (no data)")

        print("-" * 70)
        print(f"{'ALL (mean)':<25} {round(float(results.box.mp), 3):>10} "
              f"{round(float(results.box.mr), 3):>8} "
              f"{round(float(results.box.map50), 3):>9} "
              f"{round(float(results.box.map), 3):>13}")

if __name__ == "__main__":
    run()
