// RoadSense shared types — match the backend / WebSocket message shapes.

export type AlertType =
  | "lane_cut"
  | "sudden_slowdown"
  | "high_chaos"
  | "harsh_brake"
  | "sharp_turn"
  | "crowd_surge"
  | "wrong_side"
  | "sensor_stale"
  | "low_confidence";

export type SensorEvent = "harsh_brake" | "sharp_turn" | "smooth" | "none";

export type SessionStatus = "running" | "completed" | "stopped" | "failed";

// ---- Live tick (the heart of the dashboard) ----
export interface LiveTick {
  type: "tick";
  t: string; // ISO timestamp
  chaos_score: number; // 0..1
  detections: Record<string, number>; // class -> count
  sensor: {
    speed_kmh: number;
    peak_decel_g: number;
    peak_lateral_g: number;
    event: SensorEvent;
    age_s: number;
  };
  fusion: {
    vision_conf: number; // 0..1
    sensor_conf: number; // 0..1
    agree: boolean;
    trust_weight: number; // 0..1
    final_conf: number; // 0..1
  };
  alert: {
    type: AlertType;
    explanation: string;
  } | null;
}

// ---- Sensor reading (hardware page + history) ----
export interface SensorReading {
  id: number;
  received_at: string; // ISO
  speed_kmh: number;
  peak_decel_g: number;
  peak_lateral_g: number;
  event: SensorEvent;
  gps_fix: boolean;
  satellites: number;
  seq: number;
  dropped_since_last: number;
  age_s: number;
}

export interface HardwareStatus {
  online: boolean;
  last_seen: string | null; // ISO
  packets_per_second: number;
  total_dropped: number;
  gps_fix: boolean;
  satellites: number;
  uptime_s: number;
}

// ---- Sessions ----
export interface Session {
  id: string;
  name: string;
  status: SessionStatus;
  started_at: string;
  ended_at: string | null;
  duration_s: number;
  clip_name: string;
  avg_chaos: number;
  alert_count: number;
  avg_trust_weight: number;
}

export interface SessionSummary {
  id: string;
  name: string;
  status: SessionStatus;
  started_at: string;
  ended_at: string | null;
  duration_s: number;
  avg_chaos: number;
  max_chaos: number;
  alert_count: number;
  avg_trust_weight: number;
  avg_final_conf: number;
  frame_count: number;
  sensor_samples: number;
}

export interface SessionFrame {
  t: string; // ISO
  chaos_score: number;
  speed_kmh: number;
  peak_decel_g: number;
  peak_lateral_g: number;
  trust_weight: number;
  final_conf: number;
  vision_conf: number;
  sensor_conf: number;
}

// ---- Alerts ----
export interface AlertRecord {
  id: string;
  session_id: string;
  session_name: string;
  t: string; // ISO
  type: AlertType;
  explanation: string;
  chaos_score: number;
  trust_weight: number;
  final_conf: number;
  agree: boolean;
}

// ---- Health ----
export interface HealthStatus {
  status: "ok";
  version: string;
  uptime_s: number;
}

// ---- Connection / status pills ----
export type ServiceState = "online" | "offline" | "degraded";
