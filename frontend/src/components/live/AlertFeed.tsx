"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeftRight,
  Check,
  CheckCircle2,
  CircleSlash,
  CornerUpRight,
  Merge,
  OctagonAlert,
  Users,
  WifiOff,
  X,
  type LucideIcon,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  alertTypeMeta,
  fmtPct,
  fmtTime,
} from "@/lib/format";
import type { AlertRecord, AlertType } from "@/lib/types";

interface AlertFeedProps {
  alerts: AlertRecord[];
  max?: number;
}

const ICONS: Record<AlertType, LucideIcon> = {
  lane_cut: Merge,
  sudden_slowdown: OctagonAlert,
  high_chaos: Users,
  harsh_brake: OctagonAlert,
  sharp_turn: CornerUpRight,
  crowd_surge: Users,
  wrong_side: ArrowLeftRight,
  sensor_stale: WifiOff,
  low_confidence: CircleSlash,
};

export function AlertFeed({ alerts, max = 40 }: AlertFeedProps) {
  const slice = React.useMemo(() => alerts.slice(0, max), [alerts, max]);
  const hasAlerts = slice.length > 0;

  return (
    <Card className="rs-grid-bg gap-0 overflow-hidden">
      <CardHeader className="px-5 pt-5 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base">Alert feed</CardTitle>
            <CardDescription>plain-language decisions</CardDescription>
          </div>
          <Badge
            variant="outline"
            className="gap-1.5 border-rose-500/30 bg-rose-500/10 text-rose-300"
          >
            <span className="rs-pulse inline-block size-1.5 rounded-full bg-rose-400" />
            LIVE
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="px-3 pb-3">
        <div className="rs-scroll max-h-[420px] overflow-y-auto pr-2">
          {hasAlerts ? (
            <ul className="flex flex-col gap-1.5">
              <AnimatePresence initial={false}>
                {slice.map((a) => (
                  <AlertRow key={a.id} alert={a} />
                ))}
              </AnimatePresence>
            </ul>
          ) : (
            <EmptyState />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AlertRow({ alert }: { alert: AlertRecord }) {
  const meta = alertTypeMeta(alert.type);
  const Icon = ICONS[alert.type] ?? CircleSlash;

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className={cn(
        "relative flex gap-3 overflow-hidden rounded-lg border bg-card/60 p-3 pl-4",
        meta.border,
      )}
    >
      {/* Vertical accent bar */}
      <span
        className={cn(
          "absolute inset-y-0 left-0 w-1 rounded-l-lg bg-current opacity-70",
          meta.color,
        )}
        aria-hidden
      />

      <div className="relative flex size-8 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/40">
        <Icon className={cn("size-4", meta.color)} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "text-xs font-semibold uppercase tracking-wide",
              meta.color,
            )}
          >
            {meta.label}
          </span>
          {alert.agree ? (
            <Badge
              variant="outline"
              className="gap-1 border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0 text-[10px] text-emerald-300"
            >
              <Check className="size-2.5" />
              agree
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="gap-1 border-rose-500/30 bg-rose-500/10 px-1.5 py-0 text-[10px] text-rose-300"
            >
              <X className="size-2.5" />
              disagree
            </Badge>
          )}
        </div>

        <p className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">
          {alert.explanation}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="font-mono">{fmtTime(alert.t)}</span>
          <span className="text-border">·</span>
          <Chip label="chaos" value={fmtPct(alert.chaos_score)} tone="amber" />
          <Chip
            label="trust"
            value={fmtPct(alert.trust_weight)}
            tone="emerald"
          />
          <Chip
            label="conf"
            value={fmtPct(alert.final_conf)}
            tone={alert.final_conf >= 0.6 ? "emerald" : "rose"}
          />
        </div>
      </div>
    </motion.li>
  );
}

function Chip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "emerald" | "amber" | "rose";
}) {
  const tones: Record<string, string> = {
    emerald: "text-emerald-300 border-emerald-500/25 bg-emerald-500/10",
    amber: "text-amber-300 border-amber-500/25 bg-amber-500/10",
    rose: "text-rose-300 border-rose-500/25 bg-rose-500/10",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono",
        tones[tone],
      )}
    >
      <span className="text-muted-foreground/80">{label}</span>
      <span className="font-semibold">{value}</span>
    </span>
  );
}

function EmptyState() {
  return (
    <div className="flex h-[280px] flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10">
        <CheckCircle2 className="size-6 text-emerald-300" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">
          No alerts in this window
        </p>
        <p className="text-xs text-muted-foreground">Traffic is calm.</p>
      </div>
    </div>
  );
}

export default AlertFeed;
