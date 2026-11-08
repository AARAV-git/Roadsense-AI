"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Cpu,
  Satellite,
  Activity,
  WifiOff,
  Wifi,
  Clock,
  Package,
  AlertTriangle,
  RefreshCw,
  CircuitBoard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSensorStatus } from "@/hooks/useSensorStatus";
import { api } from "@/lib/api";
import type { SensorReading } from "@/lib/types";
import { fmtClock, fmtDuration, fmtG, fmtNum, fmtSpeed, relTime } from "@/lib/format";
import { SensorCharts } from "@/components/charts/SensorCharts";
import type { LiveTick } from "@/lib/types";

function readingsToTicks(readings: SensorReading[]): LiveTick[] {
  return readings.map((r) => ({
    type: "tick" as const,
    t: r.received_at,
    chaos_score: 0.3 + r.peak_decel_g * 0.6 + r.peak_lateral_g * 0.4,
    detections: {},
    sensor: {
      speed_kmh: r.speed_kmh,
      peak_decel_g: r.peak_decel_g,
      peak_lateral_g: r.peak_lateral_g,
      event: r.event,
      age_s: r.age_s,
    },
    fusion: { vision_conf: 0.7, sensor_conf: 0.8, agree: true, trust_weight: 0.8, final_conf: 0.78 },
    alert: null,
  }));
}

export function HardwareView() {
  const { latest, hw, loading } = useSensorStatus(2000);
  const [history, setHistory] = useState<SensorReading[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const h = await api.sensorHistory(60);
        if (active) setHistory(h);
      } catch {
        /* ignore */
      } finally {
        if (active) setHistoryLoading(false);
      }
    }
    load();
    const id = setInterval(load, 2000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  const online = hw?.online ?? false;
  const ticks = readingsToTicks(history);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-mono text-xl font-bold sm:text-2xl">
            <Cpu className="size-5 text-teal-400" /> Hardware
          </h1>
          <p className="text-sm text-muted-foreground">
            ESP32 node · GPS + IMU telemetry at 1 Hz
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            className={
              online
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-rose-500/30 bg-rose-500/10 text-rose-300"
            }
          >
            {online ? (
              <>
                <Wifi className="mr-1.5 size-3.5" /> Node online
              </>
            ) : (
              <>
                <WifiOff className="mr-1.5 size-3.5" /> Node offline
              </>
            )}
          </Badge>
          <Button variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`mr-1.5 size-3.5 ${loading ? "animate-spin" : ""}`} />
            Polling
          </Button>
        </div>
      </div>

      {/* Status grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          icon={Activity}
          label="Last seen"
          value={hw?.last_seen ? fmtClock(hw.last_seen) : "—"}
          sub={relTime(hw?.last_seen)}
          accent={online ? "emerald" : "rose"}
          delay={0.05}
        />
        <StatTile
          icon={Package}
          label="Packet rate"
          value={hw ? `${fmtNum(hw.packets_per_second, 1)} pps` : "—"}
          sub="1 Hz expected"
          accent={online && hw.packets_per_second >= 0.8 ? "emerald" : "amber"}
          delay={0.1}
        />
        <StatTile
          icon={AlertTriangle}
          label="Dropped packets"
          value={hw ? String(hw.total_dropped) : "—"}
          sub="since boot"
          accent={hw && hw.total_dropped > 5 ? "amber" : "emerald"}
          delay={0.15}
        />
        <StatTile
          icon={Clock}
          label="Uptime"
          value={hw ? fmtDuration(hw.uptime_s) : "—"}
          sub="backend process"
          accent="teal"
          delay={0.2}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* GPS / latest reading */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Satellite className="size-4 text-teal-400" /> GPS & latest reading
            </CardTitle>
            <CardDescription>newest row of sensor_readings</CardDescription>
          </CardHeader>
          <CardContent>
            {loading && !latest ? (
              <div className="space-y-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : latest ? (
              <div className="space-y-3">
                <Row
                  label="GPS fix"
                  value={
                    <Badge
                      className={
                        latest.gps_fix
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                          : "border-rose-500/30 bg-rose-500/10 text-rose-300"
                      }
                    >
                      {latest.gps_fix ? "FIX" : "NO FIX"}
                    </Badge>
                  }
                />
                <Row label="Satellites" value={<span className="font-mono">{latest.satellites}</span>} />
                <Row label="Speed" value={<span className="font-mono">{fmtSpeed(latest.speed_kmh)}</span>} />
                <Row label="Peak decel" value={<span className="font-mono">{fmtG(latest.peak_decel_g)}</span>} />
                <Row label="Peak lateral" value={<span className="font-mono">{fmtG(latest.peak_lateral_g)}</span>} />
                <Row label="Sequence #" value={<span className="font-mono">{latest.seq}</span>} />
                <Row
                  label="Dropped (last)"
                  value={
                    <span className={`font-mono ${latest.dropped_since_last > 0 ? "text-amber-400" : ""}`}>
                      {latest.dropped_since_last}
                    </span>
                  }
                />
                <Row label="Received" value={<span className="font-mono text-xs">{fmtClock(latest.received_at)}</span>} />
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No readings yet. Start the ESP32 to stream data.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Live sensor graphs */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Live sensor stream</CardTitle>
            <CardDescription>last 60 seconds · GET /api/sensors/history</CardDescription>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <Skeleton className="h-[380px] w-full" />
            ) : history.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Waiting for the first packets…
              </p>
            ) : (
              <SensorCharts ticks={ticks} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Connection diagram + node detail */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CircuitBoard className="size-4 text-teal-400" /> Node config
            </CardTitle>
            <CardDescription>what the ESP32 reports every second</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 font-mono text-xs">
              <CodeLine k="endpoint" v="POST /api/sensors" />
              <CodeLine k="auth" v="X-API-Key: <shared>" />
              <CodeLine k="rate" v="1 Hz (1000 ms)" />
              <CodeLine k="payload" v="{ seq, speed_kmh, peak_decel_g, peak_lateral_g, gps, sats }" />
              <CodeLine k="transport" v="WiFi · phone hotspot 2.4 GHz" />
              <CodeLine k="online_if" v="received_at within 3s" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Failure behaviour</CardTitle>
            <CardDescription>the demo sequence worth showing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Shake or brake the ESP32 while a clip plays — the sensor graphs
              spike, the fusion band lights up, and an alert fires.
            </p>
            <p>
              Then unplug it (or stop its packets). Within 3 seconds:
            </p>
            <ul className="space-y-1.5">
              <li className="flex items-start gap-2">
                <span className="mt-1.5 size-1.5 rounded-full bg-rose-400" />
                the node flips to <span className="text-rose-300">offline</span> here
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 size-1.5 rounded-full bg-amber-400" />
                sensor <span className="text-amber-300">age_s</span> grows on the live screen
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 size-1.5 rounded-full bg-amber-400" />
                the <span className="text-amber-300">trust</span> line drops on the trust graph
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 size-1.5 rounded-full bg-emerald-400" />
                alert text switches to <span className="text-emerald-300">“camera only, sensor stale”</span>
              </li>
            </ul>
            <p className="rounded-md border bg-muted/40 p-2 text-xs">
              That single sequence shows the whole project — fusion, trust
              calibration, and explainability.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  delay,
}: {
  icon: typeof Cpu;
  label: string;
  value: string;
  sub: string;
  accent: "emerald" | "amber" | "rose" | "teal";
  delay: number;
}) {
  const tone = {
    emerald: "text-emerald-400",
    amber: "text-amber-400",
    rose: "text-rose-400",
    teal: "text-teal-400",
  }[accent];
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <Card className="h-full">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <Icon className={`size-4 ${tone}`} />
          </div>
          <p className={`mt-2 font-mono text-xl font-bold sm:text-2xl ${tone}`}>{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 pb-2 last:border-0 last:pb-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      {value}
    </div>
  );
}

function CodeLine({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-3">
      <span className="w-20 shrink-0 text-teal-400">{k}</span>
      <span className="text-muted-foreground">{v}</span>
    </div>
  );
}

export default HardwareView;
