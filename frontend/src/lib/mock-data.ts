// Shared mock-data engine for RoadSense.
// Produces deterministic-but-evolving realistic telemetry so the dashboard
// (REST endpoints + WebSocket live stream) tells one consistent story.
//
// Not exported from the Next bundle to the client — used by route handlers
// and the live-stream mini-service reads the same scripted timeline.

import type {
  AlertRecord,
  AlertType,
  HardwareStatus,
  LiveTick,
  SensorEvent,
  SensorReading,
  Session,
  SessionFrame,
  SessionSummary,
} from "./types";

// ---- Detection classes (matches the YOLO model in the brief) ----
export const DETECTION_CLASSES = [
  "autorickshaw",
  "rider",
  "car",
  "truck",
  "bus",
  "person",
  "bicycle",
  "motorcycle",
] as const;

// ---- Seeded RNG so timelines are reproducible per session ----
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ---- Smooth pseudo-random walk ----
export function walk(prev: number, step: number, min: number, max: number, rng: () => number) {
  const delta = (rng() - 0.5) * 2 * step;
  return Math.max(min, Math.min(max, prev + delta));
}

// ---- The scripted "scenario" timeline (one demo loop, ~90s) ----
// Defines peaks of chaos / braking / turning so the graphs tell a story.
interface ScenarioBeat {
  chaos: number; // target chaos 0..1
  brake: number; // peak decel g
  lateral: number; // peak lateral g
  speed: number; // km/h
  event: SensorEvent;
  alert?: { type: AlertType; explanation: string };
}

const SCENARIO: ScenarioBeat[] = [
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

export const SCENARIO_LEN = SCENARIO.length;

// ---- Build one tick at a given step index (0..SCENARIO_LEN-1) ----
export function buildTick(
  step: number,
  t: Date,
  sensorOnline: boolean,
  rng: () => number,
  bootStep = 0,
): LiveTick {
  const beat = SCENARIO[((step % SCENARIO_LEN) + SCENARIO_LEN) % SCENARIO_LEN];
  const jitter = (v: number, j: number) =>
    Math.max(0, v + (rng() - 0.5) * 2 * j);

  const chaos_score = Math.min(1, Math.max(0, jitter(beat.chaos, 0.03)));
  const speed_kmh = Math.max(0, jitter(beat.speed, 1.2));
  const peak_decel_g = Math.max(0, jitter(beat.brake, 0.02));
  const peak_lateral_g = Math.max(0, jitter(beat.lateral, 0.015));
  const event: SensorEvent = beat.event;

  // Detections roughly scale with chaos.
  const intensity = 0.5 + chaos_score;
  const detections: Record<string, number> = {};
  for (const c of DETECTION_CLASSES) {
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

  // Sensor age grows when offline; small when online.
  const age_s = sensorOnline ? jitter(0.5, 0.3) : jitter(8 + (step - bootStep) * 0.4, 1);

  // Fusion: vision confidence depends on detections + chaos; sensor conf on
  // how fresh/agreeable the sensor is.
  const vision_conf = Math.min(0.97, 0.55 + intensity * 0.3 + rng() * 0.05);
  const sensor_conf = sensorOnline
    ? Math.min(0.97, 0.6 + (1 - Math.min(1, age_s / 3)) * 0.35)
    : Math.max(0.1, 0.4 - age_s * 0.04);

  // Agreement: do camera and sensor both flag the same event?
  const cameraFlags = chaos_score >= 0.55 || peak_decel_g >= 0.3 || peak_lateral_g >= 0.18;
  const sensorFlags = event !== "smooth" && event !== "none";
  const agree = sensorOnline ? cameraFlags === sensorFlags || (cameraFlags && sensorFlags) : false;

  // Trust weight: drops when sensor is stale or disagreeing.
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
    vision_conf * (1 - trust_weight) + sensor_conf * trust_weight + (agree ? 0.05 : 0) - (!sensorOnline ? 0.1 : 0),
  );

  // Alerts
  let alert: LiveTick["alert"] = null;
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
    type: "tick",
    t: t.toISOString(),
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

// ---- In-memory timeline store (server-side only) ----
// Keeps a rolling buffer of recent ticks + readings so REST endpoints can
// serve history without recomputing.

const HISTORY_MS = 5 * 60 * 1000; // keep 5 minutes
const BOOT = Date.now();

interface TimelineState {
  ticks: LiveTick[];
  readings: SensorReading[]; // aligned 1:1 with ticks when sensor online
  alerts: AlertRecord[];
  seq: number;
  lastDropped: number;
  sensorOnline: boolean;
  // toggle so the demo can show the "sensor goes offline" failure mode
  offlineUntil: number;
}

const state: TimelineState = {
  ticks: [],
  readings: [],
  alerts: [],
  seq: 1,
  lastDropped: 0,
  sensorOnline: true,
  offlineUntil: 0,
};

export function getTimelineState() {
  return state;
}

export function setSensorOnline(online: boolean, durationMs = 0) {
  state.sensorOnline = online;
  if (!online && durationMs > 0) {
    state.offlineUntil = Date.now() + durationMs;
  } else if (online) {
    state.offlineUntil = 0;
  }
}

export function maybeAutoToggleSensor() {
  // Demo: every ~75s, drop the sensor for ~15s to show the failure mode.
  const now = Date.now();
  if (state.sensorOnline && now - BOOT > 60000) {
    const cycle = Math.floor((now - BOOT) / 1000) % 90;
    if (cycle >= 70 && cycle < 85) {
      state.sensorOnline = false;
    } else if (cycle >= 85) {
      state.sensorOnline = true;
    }
  }
  if (!state.sensorOnline && state.offlineUntil && now > state.offlineUntil) {
    state.sensorOnline = true;
    state.offlineUntil = 0;
  }
}

export function pushTick(step: number) {
  const now = new Date();
  maybeAutoToggleSensor();
  const rng = mulberry32(hashStr(`tick-${step}-${now.toISOString().slice(0, 13)}`));
  const tick = buildTick(step, now, state.sensorOnline, rng);

  state.ticks.push(tick);
  // trim
  const cutoff = now.getTime() - HISTORY_MS;
  while (state.ticks.length && new Date(state.ticks[0].t).getTime() < cutoff) {
    state.ticks.shift();
  }

  // sensor reading row (only when online)
  if (state.sensorOnline) {
    const seq = state.seq++;
    const dropped = Math.random() < 0.03 ? 1 : 0; // occasional dropped packet
    state.lastDropped += dropped;
    const reading: SensorReading = {
      id: seq,
      received_at: now.toISOString(),
      speed_kmh: tick.sensor.speed_kmh,
      peak_decel_g: tick.sensor.peak_decel_g,
      peak_lateral_g: tick.sensor.peak_lateral_g,
      event: tick.sensor.event,
      gps_fix: true,
      satellites: 7 + Math.floor(rng() * 4),
      seq,
      dropped_since_last: dropped,
      age_s: tick.sensor.age_s,
    };
    state.readings.push(reading);
    while (state.readings.length && new Date(state.readings[0].received_at).getTime() < cutoff) {
      state.readings.shift();
    }
  }

  // alerts
  if (tick.alert) {
    state.alerts.unshift({
      id: `al-${seq()}`,
      session_id: "live",
      session_name: "Live demo",
      t: now.toISOString(),
      type: tick.alert.type,
      explanation: tick.alert.explanation,
      chaos_score: tick.chaos_score,
      trust_weight: tick.fusion.trust_weight,
      final_conf: tick.fusion.final_conf,
      agree: tick.fusion.agree,
    });
    if (state.alerts.length > 500) state.alerts.length = 500;
  }
}

let _id = 0;
function seq() {
  return ++_id;
}

export function getTicks(seconds: number): LiveTick[] {
  const cutoff = Date.now() - seconds * 1000;
  return state.ticks.filter((t) => new Date(t.t).getTime() >= cutoff);
}

export function getReadings(seconds: number): SensorReading[] {
  const cutoff = Date.now() - seconds * 1000;
  return state.readings.filter((r) => new Date(r.received_at).getTime() >= cutoff);
}

export function getLatestReading(): SensorReading | null {
  return state.readings[state.readings.length - 1] ?? null;
}

export function getLatestTick(): LiveTick | null {
  return state.ticks[state.ticks.length - 1] ?? null;
}

export function getAlerts(limit = 100, sessionId?: string): AlertRecord[] {
  let out = state.alerts;
  if (sessionId) out = out.filter((a) => a.session_id === sessionId);
  return out.slice(0, limit);
}

export function getHardwareStatus(): HardwareStatus {
  const latest = getLatestReading();
  const online = !!latest && Date.now() - new Date(latest.received_at).getTime() < 3000;
  const recent = getReadings(10);
  const pps = recent.length > 0 ? recent.length / 10 : 0;
  return {
    online,
    last_seen: latest?.received_at ?? null,
    packets_per_second: Math.round(pps * 10) / 10,
    total_dropped: state.lastDropped,
    gps_fix: latest?.gps_fix ?? false,
    satellites: latest?.satellites ?? 0,
    uptime_s: Math.floor((Date.now() - BOOT) / 1000),
  };
}

// ---- Seed sessions (past runs) ----
export function seedSessions(): Session[] {
  const now = Date.now();
  const mk = (
    id: string,
    name: string,
    minsAgo: number,
    dur: number,
    avgChaos: number,
    alerts: number,
    trust: number,
    status: Session["status"] = "completed",
  ): Session => ({
    id,
    name,
    status,
    started_at: new Date(now - minsAgo * 60000).toISOString(),
    ended_at: new Date(now - minsAgo * 60000 + dur * 1000).toISOString(),
    duration_s: dur,
    clip_name: `${name.toLowerCase().replace(/\s+/g, "_")}.mp4`,
    avg_chaos: avgChaos,
    alert_count: alerts,
    avg_trust_weight: trust,
  });
  return [
    mk("s-1042", "Jayanagar 4th Block evening", 22, 142, 0.58, 9, 0.82),
    mk("s-1041", "Silk Board junction morning", 68, 187, 0.71, 14, 0.74),
    mk("s-1040", "Indiranagar 100ft road", 195, 96, 0.44, 5, 0.88),
    mk("s-1039", "Koramangala inner ring road", 320, 211, 0.66, 11, 0.79),
    mk("s-1038", "MG Road weekend afternoon", 1340, 73, 0.39, 3, 0.91),
    mk("s-1037", "HSR Layout sector 6", 1620, 154, 0.52, 7, 0.84),
    mk("s-1036", "BTM Layout flyover", 2880, 128, 0.63, 10, 0.77),
  ];
}

export function getSessionSummary(id: string): SessionSummary | null {
  const s = seedSessions().find((x) => x.id === id);
  if (!s) return null;
  return {
    ...s,
    max_chaos: Math.min(1, s.avg_chaos + 0.22),
    avg_final_conf: Math.min(0.97, s.avg_trust_weight - 0.04),
    frame_count: s.duration_s,
    sensor_samples: Math.floor(s.duration_s * 0.97),
  };
}

// ---- Background ticker (server-only) ----
// Keeps the in-memory timeline populated so REST endpoints always return
// fresh data even when no WebSocket client is connected.
let _tickerStarted = false;
let _step = 0;

export function startTicker() {
  if (_tickerStarted) return;
  _tickerStarted = true;
  // Pre-fill 60s of history so graphs aren't empty on first load.
  const now = Date.now();
  for (let i = 60; i > 0; i--) {
    const t = new Date(now - i * 1000);
    const rng = mulberry32(hashStr(`seed-${i}`));
    const tick = buildTick(_step++, t, true, rng);
    state.ticks.push(tick);
    const seq = state.seq++;
    state.readings.push({
      id: seq,
      received_at: t.toISOString(),
      speed_kmh: tick.sensor.speed_kmh,
      peak_decel_g: tick.sensor.peak_decel_g,
      peak_lateral_g: tick.sensor.peak_lateral_g,
      event: tick.sensor.event,
      gps_fix: true,
      satellites: 7 + Math.floor(rng() * 4),
      seq,
      dropped_since_last: 0,
      age_s: tick.sensor.age_s,
    });
    if (tick.alert) {
      state.alerts.unshift({
        id: `al-seed-${seq}`,
        session_id: "live",
        session_name: "Live demo",
        t: t.toISOString(),
        type: tick.alert.type,
        explanation: tick.alert.explanation,
        chaos_score: tick.chaos_score,
        trust_weight: tick.fusion.trust_weight,
        final_conf: tick.fusion.final_conf,
        agree: tick.fusion.agree,
      });
    }
  }
  setInterval(() => pushTick(_step++), 1000);
}

export function getSessionFrames(id: string): SessionFrame[] {
  const s = getSessionSummary(id);
  if (!s) return [];
  const rng = mulberry32(hashStr(id));
  const frames: SessionFrame[] = [];
  const start = new Date(s.started_at).getTime();
  for (let i = 0; i < s.duration_s; i++) {
    const beat = SCENARIO[i % SCENARIO_LEN];
    const chaos = Math.min(1, Math.max(0, beat.chaos + (rng() - 0.5) * 0.06));
    const speed = Math.max(0, beat.speed + (rng() - 0.5) * 3);
    const decel = Math.max(0, beat.brake + (rng() - 0.5) * 0.05);
    const lateral = Math.max(0, beat.lateral + (rng() - 0.5) * 0.04);
    const trust = Math.min(0.96, 0.6 + (rng() - 0.5) * 0.3 + (beat.event === "smooth" ? 0.1 : 0));
    const vision = Math.min(0.97, 0.6 + chaos * 0.3 + (rng() - 0.5) * 0.05);
    const sensorConf = Math.min(0.97, 0.7 + (rng() - 0.5) * 0.2);
    const final = Math.min(0.98, vision * (1 - trust) + sensorConf * trust);
    frames.push({
      t: new Date(start + i * 1000).toISOString(),
      chaos_score: chaos,
      speed_kmh: speed,
      peak_decel_g: decel,
      peak_lateral_g: lateral,
      trust_weight: trust,
      final_conf: final,
      vision_conf: vision,
      sensor_conf: sensorConf,
    });
  }
  return frames;
}
