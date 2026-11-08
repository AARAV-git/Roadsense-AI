// RoadSense live-stream mini-service.
// Emits one LiveTick per second over socket.io on port 3003.
// Path is "/" so Caddy can forward ?XTransformPort=3003 from the frontend.
//
// Self-contained (separate bun project) — embeds the same scenario timeline
// as the Next.js mock-data engine so the live stream looks consistent.

import { createServer } from "http";
import { Server } from "socket.io";

// ---- Types (mirrors src/lib/types.ts LiveTick) ----
type SensorEvent = "harsh_brake" | "sharp_turn" | "smooth" | "none";
type AlertType =
  | "lane_cut"
  | "harsh_brake"
  | "sharp_turn"
  | "crowd_surge"
  | "wrong_side"
  | "sensor_stale"
  | "low_confidence";

interface Beat {
  chaos: number;
  brake: number;
  lateral: number;
  speed: number;
  event: SensorEvent;
  alert?: { type: AlertType; explanation: string };
}

const SCENARIO: Beat[] = [
  { chaos: 0.18, brake: 0.05, lateral: 0.03, speed: 34, event: "smooth" },
  { chaos: 0.22, brake: 0.08, lateral: 0.05, speed: 35, event: "smooth" },
  { chaos: 0.26, brake: 0.07, lateral: 0.06, speed: 36, event: "smooth" },
  { chaos: 0.31, brake: 0.1, lateral: 0.08, speed: 37, event: "smooth" },
  { chaos: 0.4, brake: 0.18, lateral: 0.09, speed: 34, event: "smooth" },
  {
    chaos: 0.62,
    brake: 0.42,
    lateral: 0.1,
    speed: 26,
    event: "harsh_brake",
    alert: {
      type: "harsh_brake",
      explanation: "Harsh brake detected — motion sensor and rising chaos agree.",
    },
  },
  { chaos: 0.55, brake: 0.3, lateral: 0.12, speed: 22, event: "smooth" },
  {
    chaos: 0.74,
    brake: 0.22,
    lateral: 0.18,
    speed: 24,
    event: "sharp_turn",
    alert: {
      type: "sharp_turn",
      explanation: "Sharp turn across oncoming lane — high lateral g and crowd density.",
    },
  },
  {
    chaos: 0.81,
    brake: 0.15,
    lateral: 0.14,
    speed: 21,
    event: "smooth",
    alert: {
      type: "lane_cut",
      explanation: "Autorickshaw cut in — camera and motion sensor agree, high confidence.",
    },
  },
  { chaos: 0.66, brake: 0.2, lateral: 0.11, speed: 25, event: "smooth" },
  { chaos: 0.48, brake: 0.12, lateral: 0.07, speed: 30, event: "smooth" },
  { chaos: 0.39, brake: 0.09, lateral: 0.06, speed: 33, event: "smooth" },
  { chaos: 0.34, brake: 0.07, lateral: 0.05, speed: 35, event: "smooth" },
  {
    chaos: 0.58,
    brake: 0.35,
    lateral: 0.09,
    speed: 27,
    event: "harsh_brake",
    alert: {
      type: "harsh_brake",
      explanation: "Sudden stop — pedestrian incursion, sensor spikes with vision.",
    },
  },
  { chaos: 0.47, brake: 0.16, lateral: 0.08, speed: 31, event: "smooth" },
  { chaos: 0.36, brake: 0.08, lateral: 0.05, speed: 34, event: "smooth" },
  {
    chaos: 0.69,
    brake: 0.12,
    lateral: 0.22,
    speed: 29,
    event: "sharp_turn",
    alert: {
      type: "sharp_turn",
      explanation: "Sharp swerve around parked vehicle — lateral g confirms vision.",
    },
  },
  { chaos: 0.52, brake: 0.14, lateral: 0.13, speed: 32, event: "smooth" },
  { chaos: 0.41, brake: 0.1, lateral: 0.07, speed: 34, event: "smooth" },
  {
    chaos: 0.77,
    brake: 0.44,
    lateral: 0.15,
    speed: 23,
    event: "harsh_brake",
    alert: {
      type: "lane_cut",
      explanation: "Two-wheeler lane cut + hard brake — fused confidence high.",
    },
  },
  { chaos: 0.6, brake: 0.26, lateral: 0.1, speed: 26, event: "smooth" },
  { chaos: 0.44, brake: 0.12, lateral: 0.07, speed: 31, event: "smooth" },
  { chaos: 0.33, brake: 0.08, lateral: 0.05, speed: 35, event: "smooth" },
  { chaos: 0.27, brake: 0.06, lateral: 0.04, speed: 36, event: "smooth" },
  { chaos: 0.24, brake: 0.05, lateral: 0.04, speed: 37, event: "smooth" },
];

const CLASSES = [
  "autorickshaw",
  "rider",
  "car",
  "truck",
  "bus",
  "person",
  "bicycle",
  "motorcycle",
];

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildTick(step: number, sensorOnline: boolean) {
  const now = new Date();
  const rng = mulberry32((step * 2654435761) ^ (now.getUTCSeconds() * 40503));
  const beat = SCENARIO[((step % SCENARIO.length) + SCENARIO.length) % SCENARIO.length];
  const jitter = (v: number, j: number) => Math.max(0, v + (rng() - 0.5) * 2 * j);

  const chaos_score = Math.min(1, Math.max(0, jitter(beat.chaos, 0.03)));
  const speed_kmh = Math.max(0, jitter(beat.speed, 1.2));
  const peak_decel_g = Math.max(0, jitter(beat.brake, 0.02));
  const peak_lateral_g = Math.max(0, jitter(beat.lateral, 0.015));
  const event = beat.event;

  const intensity = 0.5 + chaos_score;
  const detections: Record<string, number> = {};
  for (const c of CLASSES) {
    const base =
      c === "autorickshaw"
        ? Math.round(2 + intensity * 3 + rng() * 2)
        : c === "rider"
          ? Math.round(1 + intensity * 4 + rng() * 2)
          : c === "person"
            ? Math.round(intensity * 3 + rng() * 2)
            : c === "car"
              ? Math.round(intensity * 2 + rng())
              : c === "motorcycle"
                ? Math.round(1 + intensity * 2 + rng())
                : Math.round(rng() * 2);
    detections[c] = Math.max(0, base);
  }

  const age_s = sensorOnline ? jitter(0.5, 0.3) : jitter(9, 1);
  const vision_conf = Math.min(0.97, 0.55 + intensity * 0.3 + rng() * 0.05);
  const sensor_conf = sensorOnline
    ? Math.min(0.97, 0.6 + (1 - Math.min(1, age_s / 3)) * 0.35)
    : Math.max(0.1, 0.4 - age_s * 0.04);

  const cameraFlags = chaos_score >= 0.55 || peak_decel_g >= 0.3 || peak_lateral_g >= 0.18;
  const sensorFlags = event !== "smooth" && event !== "none";
  const agree = sensorOnline ? cameraFlags === sensorFlags || (cameraFlags && sensorFlags) : false;

  let trust_weight: number;
  if (!sensorOnline) {
    trust_weight = Math.max(0.18, 0.35 - age_s * 0.03);
  } else if (!agree) {
    trust_weight = 0.55;
  } else {
    trust_weight = Math.min(0.96, 0.7 + (1 - Math.min(1, age_s / 3)) * 0.25);
  }

  const final_conf = Math.min(
    0.98,
    vision_conf * (1 - trust_weight) +
      sensor_conf * trust_weight +
      (agree ? 0.05 : 0) -
      (!sensorOnline ? 0.1 : 0),
  );

  let alert: { type: AlertType; explanation: string } | null = null;
  if (!sensorOnline && chaos_score >= 0.5) {
    alert = {
      type: "sensor_stale",
      explanation: "Camera only — sensor stale, confidence down-weighted.",
    };
  } else if (beat.alert && chaos_score >= beat.chaos - 0.08) {
    alert = beat.alert;
  } else if (final_conf < 0.45) {
    alert = {
      type: "low_confidence",
      explanation: "Sources disagree — alert suppressed pending more evidence.",
    };
  }

  return {
    type: "tick" as const,
    t: now.toISOString(),
    chaos_score,
    detections,
    sensor: { speed_kmh, peak_decel_g, peak_lateral_g, event, age_s },
    fusion: {
      vision_conf: Math.max(0, Math.min(1, vision_conf)),
      sensor_conf: Math.max(0, Math.min(1, sensor_conf)),
      agree,
      trust_weight: Math.max(0, Math.min(1, trust_weight)),
      final_conf: Math.max(0, Math.min(1, final_conf)),
    },
    alert,
  };
}

// ---- Server ----
const httpServer = createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ service: "roadsense-live-stream", ok: true }));
});

const io = new Server(httpServer, {
  path: "/",
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

let step = 0;
let sensorOnline = true;
const BOOT = Date.now();

// Demo failure mode: every ~75s drop the sensor for ~15s.
function maybeToggleSensor() {
  const elapsed = (Date.now() - BOOT) / 1000;
  if (elapsed < 45) {
    sensorOnline = true;
    return;
  }
  const cycle = Math.floor(elapsed / 90);
  const phase = elapsed - cycle * 90;
  sensorOnline = !(phase >= 70 && phase < 85);
}

setInterval(() => {
  maybeToggleSensor();
  const tick = buildTick(step++, sensorOnline);
  io.emit("tick", tick);
}, 1000);

io.on("connection", (socket) => {
  console.log(`[live-stream] client connected: ${socket.id}`);
  // Send an immediate tick so the client isn't waiting a full second.
  maybeToggleSensor();
  socket.emit("tick", buildTick(step, sensorOnline));
  socket.on("disconnect", () => {
    console.log(`[live-stream] client disconnected: ${socket.id}`);
  });
});

const PORT = 3003;
httpServer.listen(PORT, () => {
  console.log(`[live-stream] socket.io server running on port ${PORT}`);
});

process.on("SIGTERM", () => {
  console.log("[live-stream] SIGTERM, shutting down");
  httpServer.close(() => process.exit(0));
});
process.on("SIGINT", () => {
  console.log("[live-stream] SIGINT, shutting down");
  httpServer.close(() => process.exit(0));
});
