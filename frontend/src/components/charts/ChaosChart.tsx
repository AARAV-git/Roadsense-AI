"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { LiveTick } from "@/lib/types";
import { chaosColor, fmtClock, fmtPct } from "@/lib/format";

// --- RoadSense palette tokens (dark "control room") ---
const GRID_STROKE = "oklch(0.6 0.01 200 / 0.15)";
const TICK_FILL = "oklch(0.7 0.01 200 / 0.6)";
const EMERALD = "oklch(0.72 0.16 162)";
const AMBER = "oklch(0.78 0.16 70)";
const ROSE = "oklch(0.68 0.21 25)";

interface ChaosChartProps {
  ticks: LiveTick[];
}

function ChaosTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: LiveTick }>;
}) {
  if (!active || !payload?.length) return null;
  const tick = payload[0]?.payload;
  if (!tick) return null;
  const color = chaosColor(tick.chaos_score);
  return (
    <div className="rounded-md border border-border/60 bg-popover/95 p-2 text-xs shadow-lg backdrop-blur">
      <div className="font-mono text-muted-foreground">{fmtClock(tick.t)}</div>
      <div className="mt-1 flex items-center gap-1.5">
        <span
          className="inline-block h-2 w-2 rounded-[2px]"
          style={{ background: color }}
        />
        <span className="text-muted-foreground">Chaos</span>
        <span
          className="ml-auto font-mono font-medium tabular-nums"
          style={{ color }}
        >
          {fmtPct(tick.chaos_score, 0)}
        </span>
      </div>
    </div>
  );
}

export function ChaosChart({ ticks }: ChaosChartProps) {
  const latest = ticks.at(-1);
  const lineColor = latest ? chaosColor(latest.chaos_score) : EMERALD;
  const gradientId = "rs-chaos-area-grad";

  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <CardTitle className="text-sm">Chaos score</CardTitle>
        <CardDescription className="text-xs">
          last 60s · live
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4">
        {ticks.length === 0 || !latest ? (
          <Skeleton className="h-[200px] w-full" />
        ) : (
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={ticks}
                margin={{ top: 8, right: 12, bottom: 0, left: -12 }}
              >
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={lineColor} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                <XAxis
                  dataKey="t"
                  tickFormatter={fmtClock}
                  tick={{ fontSize: 10, fill: TICK_FILL }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={[0, 1]}
                  tick={{ fontSize: 10, fill: TICK_FILL }}
                  tickLine={false}
                  axisLine={false}
                  width={32}
                  ticks={[0, 0.5, 1]}
                  tickFormatter={(v: number) => fmtPct(v, 0)}
                />
                <Tooltip
                  content={<ChaosTooltip />}
                  cursor={{ stroke: TICK_FILL, strokeOpacity: 0.3 }}
                />
                <ReferenceLine
                  y={0.4}
                  stroke={AMBER}
                  strokeDasharray="4 4"
                  label={{
                    value: "elevated",
                    fill: AMBER,
                    fontSize: 9,
                    position: "insideTopLeft",
                  }}
                />
                <ReferenceLine
                  y={0.7}
                  stroke={ROSE}
                  strokeDasharray="4 4"
                  label={{
                    value: "critical",
                    fill: ROSE,
                    fontSize: 9,
                    position: "insideTopLeft",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="chaos_score"
                  stroke={lineColor}
                  strokeWidth={2}
                  fill={`url(#${gradientId})`}
                  isAnimationActive
                  animationDuration={300}
                  dot={false}
                  activeDot={{
                    r: 3,
                    stroke: lineColor,
                    strokeWidth: 1,
                    fill: lineColor,
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ChaosChart;
