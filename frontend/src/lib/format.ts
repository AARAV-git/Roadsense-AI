// Formatting + colour-band helpers for RoadSense.

import type { AlertType, SensorEvent } from "./types";

// --- Time ---
export function fmtTime(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function fmtClock(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-GB", { hour12: false });
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "—";
  const s = Math.floor(seconds % 60);
  const m = Math.floor((seconds / 60) % 60);
  const h = Math.floor(seconds / 3600);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function relTime(iso: string | null | undefined): string {
  if (!iso) return "never";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "never";
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 3) return "just now";
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

// --- Numbers ---
export function fmtPct(v: number | null | undefined, digits = 0): string {
  if (v == null || !isFinite(v)) return "—";
  return `${(v * 100).toFixed(digits)}%`;
}

export function fmtNum(v: number | null | undefined, digits = 1): string {
  if (v == null || !isFinite(v)) return "—";
  return v.toFixed(digits);
}

export function fmtSpeed(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "—";
  return `${v.toFixed(1)} km/h`;
}

export function fmtG(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "—";
  return `${v.toFixed(2)} g`;
}

// --- Chaos bands (green / amber / red) ---
export type ChaosBand = "low" | "mid" | "high";

export function chaosBand(score: number): ChaosBand {
  if (score >= 0.7) return "high";
  if (score >= 0.4) return "mid";
  return "low";
}

export function chaosLabel(score: number): string {
  const b = chaosBand(score);
  if (b === "high") return "Critical";
  if (b === "mid") return "Elevated";
  return "Calm";
}

export function chaosColor(score: number): string {
  // emerald / amber / rose — matches the chart palette
  const b = chaosBand(score);
  if (b === "high") return "oklch(0.68 0.21 25)";
  if (b === "mid") return "oklch(0.78 0.16 70)";
  return "oklch(0.72 0.16 162)";
}

export function chaosClasses(score: number): {
  text: string;
  bg: string;
  border: string;
  ring: string;
  glow: string;
} {
  const b = chaosBand(score);
  if (b === "high")
    return {
      text: "text-rose-400",
      bg: "bg-rose-500/10",
      border: "border-rose-500/30",
      ring: "ring-rose-500/30",
      glow: "rs-glow-rose",
    };
  if (b === "mid")
    return {
      text: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/30",
      ring: "ring-amber-500/30",
      glow: "rs-glow-amber",
    };
  return {
    text: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    ring: "ring-emerald-500/30",
    glow: "rs-glow-emerald",
  };
}

// --- Trust / confidence ---
export function trustColor(v: number): string {
  if (v >= 0.75) return "oklch(0.72 0.16 162)";
  if (v >= 0.45) return "oklch(0.78 0.16 70)";
  return "oklch(0.68 0.21 25)";
}

// --- Sensor event labels ---
export function sensorEventLabel(e: SensorEvent): string {
  switch (e) {
    case "harsh_brake":
      return "Harsh brake";
    case "sharp_turn":
      return "Sharp turn";
    case "smooth":
      return "Smooth";
    default:
      return "None";
  }
}

export function sensorEventColor(e: SensorEvent): string {
  switch (e) {
    case "harsh_brake":
      return "text-rose-400";
    case "sharp_turn":
      return "text-amber-400";
    case "smooth":
      return "text-emerald-400";
    default:
      return "text-muted-foreground";
  }
}

// --- Alert type styling ---
export function alertTypeMeta(t: AlertType): {
  label: string;
  color: string;
  bg: string;
  border: string;
} {
  switch (t) {
    case "lane_cut":
      return {
        label: "Lane cut",
        color: "text-rose-400",
        bg: "bg-rose-500/10",
        border: "border-rose-500/30",
      };
    case "sudden_slowdown":
      return {
        label: "Sudden slowdown",
        color: "text-amber-400",
        bg: "bg-amber-500/10",
        border: "border-amber-500/30",
      };
    case "high_chaos":
      return {
        label: "High chaos",
        color: "text-rose-500",
        bg: "bg-rose-500/15",
        border: "border-rose-500/40",
      };
    case "harsh_brake":
      return {
        label: "Harsh brake",
        color: "text-orange-400",
        bg: "bg-orange-500/10",
        border: "border-orange-500/30",
      };
    case "sharp_turn":
      return {
        label: "Sharp turn",
        color: "text-amber-400",
        bg: "bg-amber-500/10",
        border: "border-amber-500/30",
      };
    case "crowd_surge":
      return {
        label: "Crowd surge",
        color: "text-fuchsia-400",
        bg: "bg-fuchsia-500/10",
        border: "border-fuchsia-500/30",
      };
    case "wrong_side":
      return {
        label: "Wrong side",
        color: "text-rose-400",
        bg: "bg-rose-500/10",
        border: "border-rose-500/30",
      };
    case "sensor_stale":
      return {
        label: "Sensor stale",
        color: "text-amber-400",
        bg: "bg-amber-500/10",
        border: "border-amber-500/30",
      };
    case "low_confidence":
      return {
        label: "Low confidence",
        color: "text-muted-foreground",
        bg: "bg-muted",
        border: "border-border",
      };
    default:
      return {
        label: String(t || "Alert").replace(/_/g, " "),
        color: "text-amber-400",
        bg: "bg-amber-500/10",
        border: "border-amber-500/30",
      };
  }
}

export function statusColor(status: string): string {
  switch (status) {
    case "running":
      return "text-emerald-400";
    case "completed":
      return "text-cyan-400";
    case "stopped":
      return "text-amber-400";
    case "failed":
      return "text-rose-400";
    default:
      return "text-muted-foreground";
  }
}
