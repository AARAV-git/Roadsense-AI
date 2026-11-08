"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Bell,
  ClipboardList,
  Clock,
  Cpu,
  Film,
  Gauge,
  ShieldCheck,
  Target,
  TrendingUp,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  chaosColor,
  chaosLabel,
  fmtDateTime,
  fmtDuration,
  fmtNum,
  fmtPct,
  trustColor,
} from "@/lib/format";
import type { SessionStatus, SessionSummary as SessionSummaryType } from "@/lib/types";

export interface SessionSummaryProps {
  summary: SessionSummaryType | null;
  loading?: boolean;
}

const containerVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.05, delayChildren: 0.04 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.28, ease: "easeOut" as const },
  },
};

function StatusBadge({ status }: { status: SessionStatus }) {
  switch (status) {
    case "running":
      return (
        <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-300">
          <span className="size-1.5 rounded-full bg-emerald-400 rs-pulse" />
          Running
        </Badge>
      );
    case "completed":
      return (
        <Badge className="border-teal-500/30 bg-teal-500/15 text-teal-300">
          <span className="size-1.5 rounded-full bg-teal-400" />
          Completed
        </Badge>
      );
    case "stopped":
      return (
        <Badge className="border-amber-500/30 bg-amber-500/15 text-amber-300">
          <span className="size-1.5 rounded-full bg-amber-400" />
          Stopped
        </Badge>
      );
    case "failed":
      return (
        <Badge className="border-rose-500/30 bg-rose-500/15 text-rose-300">
          <span className="size-1.5 rounded-full bg-rose-400" />
          Failed
        </Badge>
      );
  }
}

type IconType = React.ComponentType<{ className?: string }>;

interface StatTileProps {
  icon: IconType;
  label: string;
  value: string;
  valueColor?: string;
  sub?: string;
  spark?: number;
  accent?: string;
}

function StatTile({
  icon: Icon,
  label,
  value,
  valueColor,
  sub,
  spark,
  accent,
}: StatTileProps) {
  return (
    <Card className="overflow-hidden p-4 gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
        <Icon
          className={accent ? `size-3.5 ${accent}` : "size-3.5 text-muted-foreground/60"}
        />
      </div>
      <div
        className="text-2xl font-semibold tabular-nums leading-none"
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
      </div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      {spark != null && (
        <div
          className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted"
          aria-hidden
        >
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.max(2, Math.min(100, (spark || 0) * 100))}%`,
              backgroundColor: valueColor,
            }}
          />
        </div>
      )}
    </Card>
  );
}

export function SessionSummary({ summary, loading = false }: SessionSummaryProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
          <ClipboardList className="size-7 text-muted-foreground/60" />
          <p className="text-sm">Select a run to see its summary.</p>
        </CardContent>
      </Card>
    );
  }

  const chaosClr = chaosColor(summary.avg_chaos);
  const peakClr = chaosColor(summary.max_chaos);
  const trustClr = trustColor(summary.avg_trust_weight);
  const confClr = trustColor(summary.avg_final_conf);

  const tiles: StatTileProps[] = [
    {
      icon: Gauge,
      label: "Avg chaos",
      value: fmtPct(summary.avg_chaos),
      valueColor: chaosClr,
      sub: chaosLabel(summary.avg_chaos),
      spark: summary.avg_chaos,
    },
    {
      icon: TrendingUp,
      label: "Peak chaos",
      value: fmtPct(summary.max_chaos),
      valueColor: peakClr,
      sub: "worst moment",
    },
    {
      icon: Bell,
      label: "Alerts fired",
      value: fmtNum(summary.alert_count, 0),
      sub: "events",
      accent: "text-rose-400/80",
    },
    {
      icon: ShieldCheck,
      label: "Avg trust",
      value: fmtPct(summary.avg_trust_weight),
      valueColor: trustClr,
      sub: "calibration",
    },
    {
      icon: Target,
      label: "Avg confidence",
      value: fmtPct(summary.avg_final_conf),
      valueColor: confClr,
      sub: "final fused",
    },
    {
      icon: Film,
      label: "Frames analyzed",
      value: fmtNum(summary.frame_count, 0),
      sub: "video frames",
    },
    {
      icon: Cpu,
      label: "Sensor samples",
      value: fmtNum(summary.sensor_samples, 0),
      sub: "ESP32 packets",
    },
    {
      icon: Clock,
      label: "Duration",
      value: fmtDuration(summary.duration_s),
      sub: "total runtime",
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="rs-grid-bg">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <h3 className="text-lg font-semibold leading-tight truncate">
                {summary.name}
              </h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Film className="size-3.5" />
                <span className="font-mono text-foreground/70 truncate max-w-[280px]">
                  {summary.clip_name}
                </span>
              </div>
            </div>
            <StatusBadge status={summary.status} />
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
            <div className="text-muted-foreground">
              <span className="text-muted-foreground/70">Started · </span>
              <span className="text-foreground/80 tabular-nums">
                {fmtDateTime(summary.started_at)}
              </span>
            </div>
            <div className="text-muted-foreground">
              <span className="text-muted-foreground/70">Ended · </span>
              <span className="text-foreground/80 tabular-nums">
                {fmtDateTime(summary.ended_at)}
              </span>
            </div>
            <div className="text-muted-foreground">
              <span className="text-muted-foreground/70">Runtime · </span>
              <span className="text-foreground/80 tabular-nums">
                {fmtDuration(summary.duration_s)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stat grid */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {tiles.map((t, i) => (
          <motion.div key={i} variants={itemVariants}>
            <StatTile {...t} />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

export default SessionSummary;
