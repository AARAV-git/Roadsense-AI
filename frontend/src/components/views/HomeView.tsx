"use client";

import { motion } from "framer-motion";
import {
  Radio,
  Cpu,
  Gauge,
  ShieldCheck,
  ArrowRight,
  Activity,
  Boxes,
  Waves,
  Radar,
  ServerCog,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { View } from "@/components/layout/Navbar";
import type { HardwareStatus, ServiceState, Session } from "@/lib/types";
import { fmtDateTime, fmtDuration, fmtPct, relTime, chaosColor } from "@/lib/format";

interface HomeViewProps {
  onNavigate: (v: View) => void;
  backendState: ServiceState;
  hw: HardwareStatus | null;
  latestSession: Session | null;
  liveChaos: number | null;
  totalAlerts: number;
}

export function HomeView({
  onNavigate,
  backendState,
  hw,
  latestSession,
  liveChaos,
  totalAlerts,
}: HomeViewProps) {
  const esp32Online = hw?.online ?? false;

  return (
    <div className="space-y-8">
      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-emerald-500/10 via-card to-card p-6 sm:p-10"
      >
        <div className="rs-grid-bg pointer-events-none absolute inset-0 opacity-60" />
        <div
          className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-emerald-500/15 blur-3xl"
          aria-hidden
        />
        <div className="relative">
          <Badge
            variant="outline"
            className="mb-4 border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          >
            <Radar className="mr-1.5 size-3.5" /> multimodal · vision + IMU fusion
          </Badge>
          <h1 className="max-w-3xl font-mono text-3xl font-bold tracking-tight sm:text-5xl">
            Road<span className="text-emerald-400">Sense</span>
          </h1>
          <p className="mt-3 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Real-time traffic chaos intelligence. A YOLOv8 dashcam fuses with an
            ESP32 GPS+IMU stream to score road risk, calibrate trust, and explain
            every alert in plain language.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              size="lg"
              className="bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
              onClick={() => onNavigate("live")}
            >
              <Radio className="mr-2 size-4" /> Open live demo
            </Button>
            <Button size="lg" variant="outline" onClick={() => onNavigate("hardware")}>
              <Cpu className="mr-2 size-4" /> Check hardware
            </Button>
          </div>
        </div>
      </motion.section>

      {/* KPI row */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          icon={ServerCog}
          label="Backend"
          value={backendState === "online" ? "Online" : "Offline"}
          accent={backendState === "online" ? "emerald" : "rose"}
          sub={backendState === "online" ? "REST + WebSocket up" : "unreachable"}
          delay={0.05}
        />
        <KpiCard
          icon={Cpu}
          label="ESP32 node"
          value={esp32Online ? "Online" : "Offline"}
          accent={esp32Online ? "emerald" : "rose"}
          sub={
            esp32Online
              ? `${hw?.satellites ?? 0} sats · ${hw?.packets_per_second ?? 0} pps`
              : `last seen ${relTime(hw?.last_seen)}`
          }
          delay={0.1}
        />
        <KpiCard
          icon={Gauge}
          label="Live chaos"
          value={liveChaos != null ? fmtPct(liveChaos) : "—"}
          accent={
            liveChaos == null
              ? "muted"
              : liveChaos >= 0.7
                ? "rose"
                : liveChaos >= 0.4
                  ? "amber"
                  : "emerald"
          }
          sub={liveChaos != null ? "fused risk right now" : "open the live demo"}
          delay={0.15}
        />
        <KpiCard
          icon={ShieldCheck}
          label="Alerts (24h)"
          value={String(totalAlerts)}
          accent="amber"
          sub="explained decisions"
          delay={0.2}
        />
      </section>

      {/* Latest session + features */}
      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Latest session</CardTitle>
              <CardDescription>most recent recorded run</CardDescription>
            </div>
            <Activity className="size-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {latestSession ? (
              <div className="space-y-3">
                <div>
                  <p className="font-medium leading-tight">{latestSession.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {latestSession.id} · {latestSession.clip_name}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                    {latestSession.status}
                  </Badge>
                  <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
                    {fmtDuration(latestSession.duration_s)}
                  </Badge>
                  <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
                    {latestSession.alert_count} alerts
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <MiniStat
                    label="avg chaos"
                    value={fmtPct(latestSession.avg_chaos)}
                    color={chaosColor(latestSession.avg_chaos)}
                  />
                  <MiniStat
                    label="avg trust"
                    value={fmtPct(latestSession.avg_trust_weight)}
                    color="oklch(0.72 0.16 162)"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {fmtDateTime(latestSession.started_at)}
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => onNavigate("sessions")}
                >
                  View sessions <ArrowRight className="ml-1.5 size-3.5" />
                </Button>
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No sessions yet.
              </p>
            )}
          </CardContent>
        </Card>

        <FeatureCard
          icon={Boxes}
          title="Sensor fusion"
          body="Camera chaos and motion-sensor braking share one timeline. When both spike together, the event is corroborated."
          accent="rose"
          delay={0.1}
        />
        <FeatureCard
          icon={Waves}
          title="Trust calibration"
          body="Trust weight drops the moment the ESP32 goes stale or disagrees with vision — and so does final confidence."
          accent="amber"
          delay={0.15}
        />
        <FeatureCard
          icon={ShieldCheck}
          title="Explainable alerts"
          body="Every alert ships with a plain-language reason: “camera and motion sensor agree, high confidence.”"
          accent="emerald"
          delay={0.2}
        />
        <FeatureCard
          icon={Cpu}
          title="Edge telemetry"
          body="GPS fix, satellites, packet rate and drops stream from the ESP32 at 1 Hz — the hardware page proves it live."
          accent="teal"
          delay={0.25}
        />
      </section>

      {/* How it works */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">How the data flows</CardTitle>
            <CardDescription>one source of truth — the backend</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <FlowNode icon={Cpu} title="ESP32" sub="GPS + IMU · 1 Hz" accent="teal" />
              <FlowArrow label="POST /api/sensors" />
              <FlowNode icon={ServerCog} title="Backend" sub="fusion · alerts · DB" accent="emerald" />
              <FlowArrow label="REST + WebSocket" />
              <FlowNode icon={Radio} title="Frontend" sub="live dashboard" accent="amber" />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              The ESP32 never talks to the frontend directly — everything goes
              through the backend, so a changed hotspot IP never breaks the UI.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  delay,
}: {
  icon: typeof Radio;
  label: string;
  value: string;
  sub: string;
  accent: "emerald" | "amber" | "rose" | "teal" | "muted";
  delay: number;
}) {
  const tone = {
    emerald: "text-emerald-400",
    amber: "text-amber-400",
    rose: "text-rose-400",
    teal: "text-teal-400",
    muted: "text-muted-foreground",
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
          <p className={`mt-2 font-mono text-2xl font-bold sm:text-3xl ${tone}`}>
            {value}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-md border bg-muted/40 px-2.5 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="font-mono text-sm font-semibold" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  body,
  accent,
  delay,
}: {
  icon: typeof Radio;
  title: string;
  body: string;
  accent: "emerald" | "amber" | "rose" | "teal";
  delay: number;
}) {
  const tone = {
    emerald: "text-emerald-400 bg-emerald-500/10 ring-emerald-500/30",
    amber: "text-amber-400 bg-amber-500/10 ring-amber-500/30",
    rose: "text-rose-400 bg-rose-500/10 ring-rose-500/30",
    teal: "text-teal-400 bg-teal-500/10 ring-teal-500/30",
  }[accent];
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <Card className="h-full">
        <CardHeader>
          <div className={`flex size-9 items-center justify-center rounded-lg ring-1 ${tone}`}>
            <Icon className="size-4.5" />
          </div>
          <CardTitle className="mt-2 text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{body}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function FlowNode({
  icon: Icon,
  title,
  sub,
  accent,
}: {
  icon: typeof Radio;
  title: string;
  sub: string;
  accent: "emerald" | "amber" | "teal";
}) {
  const tone = {
    emerald: "text-emerald-400 bg-emerald-500/10 ring-emerald-500/30",
    amber: "text-amber-400 bg-amber-500/10 ring-amber-500/30",
    teal: "text-teal-400 bg-teal-500/10 ring-teal-500/30",
  }[accent];
  return (
    <div className="flex flex-1 items-center gap-3 rounded-lg border bg-card p-3">
      <div className={`flex size-9 items-center justify-center rounded-md ring-1 ${tone}`}>
        <Icon className="size-4.5" />
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
    </div>
  );
}

function FlowArrow({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-1 self-center text-muted-foreground">
      <ArrowRight className="hidden size-4 sm:block" />
      <span className="font-mono text-[10px] uppercase tracking-wide sm:hidden">
        {label}
      </span>
      <span className="hidden font-mono text-[10px] uppercase tracking-wide sm:inline">
        {label}
      </span>
    </div>
  );
}

export default HomeView;
