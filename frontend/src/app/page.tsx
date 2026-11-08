"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Github, Radar, Heart } from "lucide-react";
import { Navbar, type View } from "@/components/layout/Navbar";
import { HomeView } from "@/components/views/HomeView";
import { LiveView } from "@/components/views/LiveView";
import { SessionsView } from "@/components/views/SessionsView";
import { AlertsView } from "@/components/views/AlertsView";
import { HardwareView } from "@/components/views/HardwareView";
import { useSensorStatus } from "@/hooks/useSensorStatus";
import { api } from "@/lib/api";
import type { ServiceState, Session, AlertRecord } from "@/lib/types";

export default function Page() {
  const [view, setView] = useState<View>("home");
  const { hw, backend } = useSensorStatus(3000);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [alertsCount, setAlertsCount] = useState(0);

  // Lightweight background refresh for the home KPIs.
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [s, a] = await Promise.all([
          api.listSessions().catch(() => [] as Session[]),
          api.listAlerts({ limit: 200 }).catch(() => [] as AlertRecord[]),
        ]);
        if (!active) return;
        setSessions(s);
        setAlertsCount(a.length);
      } catch {
        /* ignore */
      }
    }
    load();
    const id = setInterval(load, 8000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  const esp32State: ServiceState = hw
    ? hw.online
      ? "online"
      : "offline"
    : "offline";
  const esp32Detail = hw
    ? `${hw.satellites} sats · ${hw.packets_per_second.toFixed(1)} pps`
    : undefined;

  const latestSession = useMemo(() => sessions[0] ?? null, [sessions]);

  // Pull a live chaos reading for the home KPI (best-effort).
  const [liveChaos, setLiveChaos] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const r = await api.sensorLatest();
        if (active && r) {
          // approximate chaos from sensor (matches mock-data mapping)
          setLiveChaos(
            Math.min(1, 0.3 + r.peak_decel_g * 0.6 + r.peak_lateral_g * 0.4),
          );
        }
      } catch {
        /* ignore */
      }
    }
    load();
    const id = setInterval(load, 2000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar
        view={view}
        onNavigate={setView}
        backendState={backend}
        esp32State={esp32State}
        esp32Detail={esp32Detail}
      />

      <main className="rs-grid-bg flex-1">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25 }}
            >
              {view === "home" && (
                <HomeView
                  onNavigate={setView}
                  backendState={backend}
                  hw={hw}
                  latestSession={latestSession}
                  liveChaos={liveChaos}
                  totalAlerts={alertsCount}
                />
              )}
              {view === "live" && <LiveView />}
              {view === "sessions" && <SessionsView />}
              {view === "alerts" && <AlertsView />}
              {view === "hardware" && <HardwareView />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <footer className="mt-auto border-t bg-card/50 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-3 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-emerald-500/15 ring-1 ring-emerald-500/30">
              <Radar className="size-3.5 text-emerald-400" />
            </span>
            <span className="font-mono">
              RoadSense · multimodal traffic chaos intelligence
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span>
              YOLOv8n · ESP32-WROOM · Next.js · socket.io
            </span>
            <span className="hidden items-center gap-1 sm:flex">
              built with <Heart className="size-3 text-rose-400" /> for safer roads
            </span>
            <a
              href="#"
              className="flex items-center gap-1 transition-colors hover:text-foreground"
              onClick={(e) => e.preventDefault()}
            >
              <Github className="size-3.5" /> docs
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
