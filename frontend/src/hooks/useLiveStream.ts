"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { LiveTick } from "@/lib/types";
import { api } from "@/lib/api";

const MAX_HISTORY = 60;

// Browser replaces http(s):// → ws(s):// automatically when we swap the origin.
function wsUrl(sessionId: string | number): string {
  // In the browser, derive from window.location so it always matches the page origin.
  // In SSR (no window), fall back to env var or localhost.
  const base =
    typeof window !== "undefined"
      ? window.location.origin.replace(/^http/, "ws")
      : (process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000");
  // FastAPI WebSocket lives on the backend directly, not on Next.js.
  const backendWs =
    typeof window !== "undefined"
      ? "ws://localhost:8000"          // always talk directly to FastAPI WS
      : "ws://localhost:8000";
  return `${backendWs}/ws/live/${sessionId}`;
}

export interface LiveStreamState {
  ticks: LiveTick[];
  latest: LiveTick | null;
  connected: boolean;
  reconnecting: boolean;
}

/**
 * Connects to the FastAPI native WebSocket at ws://localhost:8000/ws/live/{sessionId}
 * and keeps the last 60 ticks in state. Falls back to sensor history on connect.
 */
export function useLiveStream(sessionId: string | number | null = 1) {
  const [ticks, setTicks] = useState<LiveTick[]>([]);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const refillFromHistory = useCallback(async () => {
    try {
      const readings = await api.sensorHistory(60);
      if (!readings.length) return;
      const synthetic: LiveTick[] = readings.map((r) => ({
        type: "tick" as const,
        t: r.received_at,
        chaos_score: Math.min(1, 0.3 + r.peak_decel_g * 0.6 + r.peak_lateral_g * 0.4),
        detections: {},
        sensor: {
          speed_kmh: r.speed_kmh,
          peak_decel_g: r.peak_decel_g,
          peak_lateral_g: r.peak_lateral_g,
          event: r.event,
          age_s: r.age_s,
        },
        fusion: {
          vision_conf: 0.7,
          sensor_conf: 0.8,
          agree: true,
          trust_weight: 0.8,
          final_conf: 0.78,
        },
        alert: null,
      }));
      setTicks((prev) => {
        const map = new Map<string, LiveTick>();
        for (const t of [...synthetic, ...prev]) map.set(t.t, t);
        return Array.from(map.values())
          .sort((a, b) => new Date(a.t).getTime() - new Date(b.t).getTime())
          .slice(-MAX_HISTORY);
      });
    } catch {
      /* ignore */
    }
  }, []);

  const connect = useCallback(() => {
    if (!sessionId || !mountedRef.current) return;

    const url = wsUrl(sessionId);
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setConnected(true);
      setReconnecting(false);
      refillFromHistory();
    };

    ws.onmessage = (ev) => {
      if (!mountedRef.current) return;
      try {
        const tick = JSON.parse(ev.data as string) as LiveTick;
        if (tick.type !== "tick") return;
        setTicks((prev) => {
          const next = [...prev, tick];
          if (next.length > MAX_HISTORY) next.splice(0, next.length - MAX_HISTORY);
          return next;
        });
      } catch {
        /* ignore malformed messages */
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setConnected(false);
      // Auto-reconnect after 2 s
      setReconnecting(true);
      reconnectTimer.current = setTimeout(() => {
        if (mountedRef.current) connect();
      }, 2000);
    };

    ws.onerror = () => {
      ws.close(); // triggers onclose → reconnect
    };
  }, [sessionId, refillFromHistory]);

  useEffect(() => {
    mountedRef.current = true;
    if (sessionId) {
      connect();
    } else {
      refillFromHistory();
      const id = setInterval(refillFromHistory, 2000);
      return () => {
        clearInterval(id);
        mountedRef.current = false;
      };
    }
    return () => {
      mountedRef.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [sessionId, connect, refillFromHistory]);

  const latest = ticks.length ? ticks[ticks.length - 1] : null;
  return { ticks, latest, connected, reconnecting };
}
