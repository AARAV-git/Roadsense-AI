"use client";

import * as React from "react";
import { AlertTriangle, Check } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { fmtPct, trustColor } from "@/lib/format";
import type { LiveTick } from "@/lib/types";

interface TrustPanelProps {
  fusion: LiveTick["fusion"] | null;
}

export function TrustPanel({ fusion }: TrustPanelProps) {
  if (!fusion) {
    return <TrustPanelSkeleton />;
  }

  const agree = fusion.agree;
  const summary = agree
    ? "Camera and motion sensor corroborate — confidence boosted."
    : "Sources diverge — trust down-weighted.";

  return (
    <Card className="gap-0">
      <CardHeader className="px-5 pt-5 pb-3">
        <CardTitle className="text-base">Fusion &amp; trust</CardTitle>
        <CardDescription>camera × sensor calibration</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 px-5 pb-5">
        {/* Agreement badge */}
        <div className="flex items-center justify-between gap-3">
          <Badge
            variant="outline"
            className={cn(
              "gap-1.5 px-2.5 py-1 text-xs font-semibold",
              agree
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 rs-glow-emerald"
                : "border-amber-500/40 bg-amber-500/10 text-amber-300 rs-glow-amber",
            )}
          >
            {agree ? (
              <Check className="size-3.5" />
            ) : (
              <AlertTriangle className="size-3.5" />
            )}
            {agree ? "SOURCES AGREE" : "SOURCES DISAGREE"}
          </Badge>
          <span className="text-right text-[10px] uppercase tracking-wide text-muted-foreground">
            agreement
          </span>
        </div>

        {/* Summary line */}
        <p
          className={cn(
            "rounded-md border px-3 py-2 text-xs leading-relaxed",
            agree
              ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-100/90"
              : "border-amber-500/20 bg-amber-500/5 text-amber-100/90",
          )}
        >
          {summary}
        </p>

        {/* Bar rows */}
        <div className="space-y-3">
          <BarRow
            label="Vision conf"
            value={fusion.vision_conf}
            color="oklch(0.72 0.16 162)"
            indicatorClass="[&_[data-slot=progress-indicator]]:bg-emerald-400"
          />
          <BarRow
            label="Sensor conf"
            value={fusion.sensor_conf}
            color="oklch(0.7 0.13 195)"
            indicatorClass="[&_[data-slot=progress-indicator]]:bg-teal-400"
          />
          <BarRow
            label="Trust weight"
            value={fusion.trust_weight}
            color={trustColor(fusion.trust_weight)}
            indicatorClass={
              fusion.trust_weight >= 0.75
                ? "[&_[data-slot=progress-indicator]]:bg-emerald-400"
                : fusion.trust_weight >= 0.45
                  ? "[&_[data-slot=progress-indicator]]:bg-amber-400"
                  : "[&_[data-slot=progress-indicator]]:bg-rose-400"
            }
          />
        </div>

        {/* Headline final confidence */}
        <div className="rounded-lg border border-border/70 bg-muted/40 p-3">
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Final confidence
            </span>
            <span
              className="font-mono text-lg font-bold tabular-nums"
              style={{ color: trustColor(fusion.final_conf) }}
            >
              {fmtPct(fusion.final_conf)}
            </span>
          </div>
          <Progress
            value={fusion.final_conf * 100}
            className={cn(
              "h-2.5",
              fusion.final_conf >= 0.75
                ? "[&_[data-slot=progress-indicator]]:bg-emerald-400"
                : fusion.final_conf >= 0.45
                  ? "[&_[data-slot=progress-indicator]]:bg-amber-400"
                  : "[&_[data-slot=progress-indicator]]:bg-rose-400",
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function BarRow({
  label,
  value,
  color,
  indicatorClass,
}: {
  label: string;
  value: number;
  color: string;
  indicatorClass?: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-xs font-medium text-foreground/90">{label}</span>
        <span
          className="font-mono text-xs font-semibold tabular-nums"
          style={{ color }}
        >
          {fmtPct(value)}
        </span>
      </div>
      <Progress
        value={value * 100}
        className={cn(
          "h-2 [&_[data-slot=progress-indicator]]:transition-transform",
          indicatorClass,
        )}
      />
    </div>
  );
}

function TrustPanelSkeleton() {
  return (
    <Card className="gap-0">
      <CardHeader className="px-5 pt-5 pb-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-1 h-3 w-40" />
      </CardHeader>
      <CardContent className="space-y-4 px-5 pb-5">
        <Skeleton className="h-7 w-40 rounded-md" />
        <Skeleton className="h-9 w-full rounded-md" />
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </div>
        <Skeleton className="h-14 w-full rounded-lg" />
      </CardContent>
    </Card>
  );
}

export default TrustPanel;
