import cv2


class Detector:
    """YOLO detector supporting single model or multi-model ensemble (autorickshaw + rider + standard traffic)."""

    def __init__(self, path: str, conf: float, imgsz: int):
        import torch
        from ultralytics import YOLO      # imported here so the API starts fast
        self.device = "cuda:0" if torch.cuda.is_available() else "cpu"
        paths = [p.strip() for p in path.split(",") if p.strip()]
        self.models = [YOLO(p).to(self.device) for p in paths]
        self.conf = conf
        self.imgsz = imgsz
        self.is_multi = len(self.models) > 1
        if not self.is_multi:
            self.model = self.models[0]
        # Warm up CUDA kernels so the very first frame is instant
        import numpy as np
        dummy = np.zeros((self.imgsz, self.imgsz, 3), dtype=np.uint8)
        for m in self.models:
            m.predict(dummy, imgsz=self.imgsz, device=self.device, verbose=False)

    def track(self, frame):
        if not self.is_multi:
            r = self.model.track(frame, persist=True, conf=self.conf, imgsz=self.imgsz,
                                 device=self.device, tracker="bytetrack.yaml", verbose=False)[0]
            dets = []
            boxes = r.boxes
            if boxes is not None and len(boxes):
                xyxy = boxes.xyxy.cpu().tolist()
                confs = boxes.conf.cpu().tolist()
                clss = boxes.cls.int().cpu().tolist()
                ids = boxes.id.int().cpu().tolist() if boxes.id is not None else [None] * len(xyxy)
                for b, c, k, i in zip(xyxy, confs, clss, ids):
                    dets.append({"id": i, "cls": r.names[k], "conf": c, "box": b})
            return dets, r.plot()

        # Multi-model ensemble (e.g. autorickshaw + rider + vehicle base)
        dets = []
        annotated = frame.copy()
        colors = {
            "auto_rickshaw": (0, 200, 255),
            "autorickshaw": (0, 200, 255),
            "rider": (255, 100, 0),
            "motorcycle": (200, 50, 200),
            "car": (0, 255, 0),
            "bus": (255, 0, 255),
            "truck": (0, 165, 255),
            "person": (255, 255, 0),
            "bicycle": (0, 255, 128)
        }

        for idx, m in enumerate(self.models):
            r = m.track(frame, persist=True, conf=self.conf, imgsz=self.imgsz,
                        device=self.device, tracker="bytetrack.yaml", verbose=False)[0]
            boxes = r.boxes
            if boxes is not None and len(boxes):
                xyxy = boxes.xyxy.cpu().tolist()
                confs = boxes.conf.cpu().tolist()
                clss = boxes.cls.int().cpu().tolist()
                ids = boxes.id.int().cpu().tolist() if boxes.id is not None else [None] * len(xyxy)
                for b, c, k, i in zip(xyxy, confs, clss, ids):
                    cls_name = r.names[k]
                    if cls_name == "auto_rickshaw":
                        cls_name = "autorickshaw"
                    # Filter COCO classes if model is general detector to avoid clutter
                    if len(r.names) > 20 and cls_name not in ("car", "bus", "truck", "person", "bicycle", "motorcycle"):
                        continue
                    track_id = (idx * 10000 + i) if i is not None else None
                    dets.append({"id": track_id, "cls": cls_name, "conf": c, "box": b})

                    x1, y1, x2, y2 = [int(v) for v in b]
                    color = colors.get(cls_name, (0, 255, 255))
                    cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
                    label = f"{cls_name} {c:.2f}" + (f" #{i}" if i is not None else "")
                    (w_text, h_text), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
                    cv2.rectangle(annotated, (x1, max(0, y1 - 18)), (x1 + w_text, y1), color, -1)
                    cv2.putText(annotated, label, (x1, max(0, y1 - 4)),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1, cv2.LINE_AA)

        return dets, annotated
