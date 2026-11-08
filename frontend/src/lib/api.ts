// RoadSense API client — all calls proxy through Next.js API routes
// which forward to the FastAPI backend at http://localhost:8000.

import type {
  AlertRecord,
  HardwareStatus,
  HealthStatus,
  SensorReading,
  Session,
  SessionFrame,
  SessionSummary,
} from "./types";

async function getJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { Accept: "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Request failed (${res.status}): ${url}`);
  }
  return (await res.json()) as T;
}

export const api = {
  health: () => getJSON<HealthStatus>("/api/health"),

  // ---- Sensors ----
  sensorLatest: () => getJSON<SensorReading | null>("/api/sensors/latest"),
  sensorHistory: (seconds = 60) =>
    getJSON<SensorReading[]>(`/api/sensors/history?seconds=${seconds}`),
  hardwareStatus: () => getJSON<HardwareStatus>("/api/hardware/status"),

  // ---- Sessions ----
  listSessions: () => getJSON<Session[]>("/api/sessions"),
  getSession: (id: string | number) =>
    getJSON<SessionSummary>(`/api/sessions/${id}`),
  getSessionFrames: (id: string | number) =>
    getJSON<SessionFrame[]>(`/api/sessions/${id}/frames`),

  // ---- Alerts ----
  listAlerts: (params: { session_id?: string | number; limit?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.session_id != null) qs.set("session_id", String(params.session_id));
    if (params.limit != null) qs.set("limit", String(params.limit));
    const q = qs.toString();
    return getJSON<AlertRecord[]>(`/api/alerts${q ? `?${q}` : ""}`);
  },

  // ---- Analysis ----
  /** Start the IP-Webcam live stream (one click). */
  startPhoneCamera: async (url?: string) => {
    const res = await fetch("/api/analysis/phone-camera", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.detail ?? "Failed to start phone camera");
    }
    return (await res.json()) as { session_id: number; stream_url: string };
  },

  /** Start any camera source (0 = laptop, URL = IP stream). */
  startLive: async (camera = "0", name?: string) => {
    const res = await fetch("/api/analysis/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ camera, name }),
    });
    if (!res.ok) throw new Error("Failed to start live session");
    return (await res.json()) as { session_id: number | string };
  },

  stopSession: async (id: string | number) => {
    const res = await fetch(`/api/analysis/${id}/stop`, { method: "POST" });
    if (!res.ok) throw new Error("Stop failed");
    return (await res.json()) as { ok: boolean };
  },

  /** MJPEG annotated video feed URL — pass directly to <img src=...> */
  mjpegUrl: (sessionId: number | string) =>
    `http://localhost:8000/api/stream/${sessionId}`,
};
