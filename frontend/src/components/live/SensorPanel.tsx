"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Gauge,
  Satellite,
  Radio,
  TriangleAlert,
  CircleDot,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { fmtG, fmtSpeed, sensorEventLabel } from "@/lib/format";
import type { HardwareStatus, LiveTick, SensorEvent } from "@/lib/types";

interface SensorPanelProps {
  latest: LiveTick | null;
  hw: HardwareStatus | null;
}

const EVENT_TONE: Record<
  SensorEvent,
  { text: string; border: string; bg: string }
> = {
  harsh_brake: {
    text: "text-rose-300",
    border: "border-rose-500/30",
    bg: "bg-rose-500/10",
  },
  sharp_turn: {
    text: "text-amber-300",
    border: "border-amber-500/30",
    bg: "bg-amber-500/10",
  },
  smooth: {
    text: "text-emerald-300",
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/10",
  },
  none: {
    text: "text-muted-foreground",
    border: "border-border",
    bg: "bg-muted/40",
  },
};

export function SensorPanel({ latest, hw }: SensorPanelProps) {
  if (!latest) {
    return <SensorPanelSkeleton />;
  }

  const s = latest.sensor;
  const brakeTone =
    s.event === "harsh_brake"
      ? EVENT_TONE.harsh_brake
      : { text: "text-foreground", border: "border-border/60", bg: "bg-muted/30" };
  const turnTone =
    s.event === "sharp_turn"
      ? EVENT_TONE.sharp_turn
      : { text: "text-foreground", border: "border-border/60", bg: "bg-muted/30" };
  const eventTone = EVENT_TONE[s.event] ?? EVENT_TONE.none;

  const age = typeof s?.age_s === "number" ? s.age_s : null;
  const fresh = age !== null && age < 3;

  return (
    <Card className="gap-0">
      <CardHeader className="px-5 pt-5 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base">Sensor telemetry</CardTitle>
            <CardDescription>ESP32 · GPS + IMU</CardDescription>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "gap-1.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
              fresh && "rs-glow-emerald",
            )}
          >
            <span
              className={cn(
                "inline-block size-1.5 rounded-full",
                fresh ? "rs-pulse bg-emerald-400" : "bg-amber-400",
              )}
            />
            {fresh ? "fresh" : "stale"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 px-5 pb-5">
        {/* Big speed readout */}
        <div className="flex items-end justify-between gap-4 rounded-xl border border-border/60 bg-gradient-to-br from-muted/40 to-transparent p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10">
              <Gauge className="size-5 text-emerald-300" />
            </div>
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Vehicle speed
              </div>
              <div className="font-mono text-4xl font-bold leading-none tabular-nums text-foreground">
                {fmtSpeed(s.speed_kmh).replace(" km/h", "")}
                <span className="ml-1 text-base font-medium text-muted-foreground">
                  km/h
                </span>
              </div>
            </div>
          </div>
          <Activity className="size-5 text-muted-foreground/60" />
        </div>

        {/* Stat tiles */}
        <div className="grid grid-cols-3 gap-2">
          <StatTile
            label="Braking"
            value={fmtG(s.peak_decel_g)}
            icon={<TriangleAlert className="size-3.5" />}
            tone={brakeTone}
          />
          <StatTile
            label="Turning"
            value={fmtG(s.peak_lateral_g)}
            icon={<CircleDot className="size-3.5" />}
            tone={turnTone}
          />
          <StatTile
            label="Event"
            value={sensorEventLabel(s.event)}
            tone={eventTone}
          />
        </div>

        {/* GPS / hardware row */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
            <Satellite
              className={cn(
                "size-4",
                hw?.gps_fix ? "text-emerald-300" : "text-rose-300",
              )}
            />
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                GPS
              </span>
              <span
                className={cn(
                  "font-mono text-xs font-semibold",
                  hw?.gps_fix ? "text-emerald-300" : "text-rose-300",
                )}
              >
                {hw?.gps_fix ? "FIX" : "NO FIX"}
              </span>
            </div>
            <span className="ml-auto font-mono text-xs text-muted-foreground">
              {hw?.satellites ?? "—"} sat
            </span>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
            <Radio className="size-4 text-teal-300" />
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Packets
              </span>
              <span className="font-mono text-xs font-semibold text-foreground">
                {hw?.packets_per_second?.toFixed(1) ?? "—"}/s
              </span>
            </div>
            <span className="ml-auto font-mono text-xs text-rose-300/80">
              {hw?.total_dropped ?? 0} dropped
            </span>
          </div>
        </div>

        {/* Sensor age line */}
        <div
          className={cn(
            "flex items-center justify-between rounded-lg border px-3 py-2",
            fresh
              ? "border-emerald-500/30 bg-emerald-500/5"
              : age !== null && age < 6
                ? "border-amber-500/30 bg-amber-500/5"
                : "border-rose-500/30 bg-rose-500/5",
          )}
        >
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "rs-pulse inline-block size-2 rounded-full",
                fresh
                  ? "bg-emerald-400"
                  : age !== null && age < 6
                    ? "bg-amber-400"
                    : "bg-rose-400",
              )}
            />
            <span
              className={cn(
                "font-mono text-xs font-semibold uppercase tracking-wide",
                fresh
                  ? "text-emerald-300"
                  : age !== null && age < 6
                    ? "text-amber-300"
                    : "text-rose-300",
              )}
            >
              {fresh ? "fresh" : "stale"} · {age !== null ? `${age.toFixed(1)}s` : "no data"}
            </span>
          </div>
          <span className="font-mono text-[10px] text-muted-foreground">
            sensor age
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function StatTile({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  tone: { text: string; border: string; bg: string };
}) {
  return (
    <motion.div
      initial={{ opacity: 0.6, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25 }}
      className={cn(
        "flex flex-col gap-1 rounded-lg border px-3 py-2.5",
        tone.border,
        tone.bg,
      )}
    >
      <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <span
        className={cn(
          "font-mono text-sm font-semibold leading-none",
          tone.text,
        )}
      >
        {value}
      </span>
    </motion.div>
  );
}

function SensorPanelSkeleton() {
  return (
    <Card className="gap-0">
      <CardHeader className="px-5 pt-5 pb-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-1 h-3 w-40" />
      </CardHeader>
      <CardContent className="space-y-4 px-5 pb-5">
        <Skeleton className="h-20 w-full rounded-xl" />
        <div className="grid grid-cols-3 gap-2">
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-14 rounded-lg" />
          <Skeleton className="h-14 rounded-lg" />
        </div>
        <Skeleton className="h-9 w-full rounded-lg" />
      </CardContent>
    </Card>
  );
}

export default SensorPanel;
