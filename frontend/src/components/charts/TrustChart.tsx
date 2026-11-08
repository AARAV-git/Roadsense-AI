"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceDot,
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
import { fmtClock, fmtNum, fmtPct } from "@/lib/format";

// --- RoadSense palette tokens ---
const GRID_STROKE = "oklch(0.6 0.01 200 / 0.15)";
const TICK_FILL = "oklch(0.7 0.01 200 / 0.6)";
const EMERALD = "oklch(0.72 0.16 162)";
const AMBER = "oklch(0.78 0.16 70)";
const ROSE = "oklch(0.68 0.21 25)";

interface TrustChartProps {
  ticks: LiveTick[];
}

function TrustTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: LiveTick }>;
}) {
  if (!active || !payload?.length) return null;
  const tick = payload[0]?.payload;
  if (!tick) return null;
  const stale = tick.sensor.age_s > 1.5;
  return (
    <div className="rounded-md border border-border/60 bg-popover/95 p-2 text-xs shadow-lg backdrop-blur">
      <div className="font-mono text-muted-foreground">{fmtClock(tick.t)}</div>
      <div className="mt-1 flex items-center gap-1.5">
        <span
          className="inline-block h-2 w-2 rounded-[2px]"
          style={{ background: EMERALD }}
        />
        <span className="text-muted-foreground">Trust weight</span>
        <span
          className="ml-auto font-mono font-medium tabular-nums"
          style={{ color: EMERALD }}
        >
          {fmtPct(tick.fusion.trust_weight, 0)}
        </span>
      </div>
      <div className="mt-0.5 flex items-center gap-1.5">
        <span
          className="inline-block h-2 w-2 rounded-[2px]"
          style={{ background: AMBER }}
        />
        <span className="text-muted-foreground">Final confidence</span>
        <span
          className="ml-auto font-mono font-medium tabular-nums"
          style={{ color: AMBER }}
        >
          {fmtPct(tick.fusion.final_conf, 0)}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-1.5 border-t border-border/40 pt-1">
        <span className="text-muted-foreground">Sensor age</span>
        <span
          className="ml-auto font-mono font-medium tabular-nums"
          style={{ color: stale ? ROSE : EMERALD }}
        >
          {fmtNum(tick.sensor.age_s, 2)}s
        </span>
      </div>
    </div>
  );
}

export function TrustChart({ ticks }: TrustChartProps) {
  const lowTrust = ticks.filter((t) => t.fusion.trust_weight < 0.45);
  const gradientId = "rs-trust-area-grad";

  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="text-sm">Trust calibration</CardTitle>
            <CardDescription className="text-xs">
              trust weight × final confidence · last 60s
            </CardDescription>
          </div>
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
            trust drops when sensor goes stale
          </span>
        </div>
      </CardHeader>
      <CardContent className="px-4">
        {ticks.length === 0 ? (
          <Skeleton className="h-[220px] w-full" />
        ) : (
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={ticks}
                margin={{ top: 8, right: 12, bottom: 0, left: -12 }}
              >
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={EMERALD} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={EMERALD} stopOpacity={0} />
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
                  content={<TrustTooltip />}
                  cursor={{ stroke: TICK_FILL, strokeOpacity: 0.3 }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 10, paddingBottom: 8 }}
                />
                <ReferenceLine
                  y={0.45}
                  stroke={AMBER}
                  strokeDasharray="4 4"
                  label={{
                    value: "trust floor",
                    fill: AMBER,
                    fontSize: 9,
                    position: "insideTopLeft",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="fusion.trust_weight"
                  name="Trust weight"
                  stroke={EMERALD}
                  strokeWidth={2}
                  fill={`url(#${gradientId})`}
                  dot={false}
                  isAnimationActive
                  animationDuration={300}
                />
                <Line
                  type="monotone"
                  dataKey="fusion.final_conf"
                  name="Final confidence"
                  stroke={AMBER}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive
                  animationDuration={300}
                />
                {lowTrust.map((t) => (
                  <ReferenceDot
                    key={t.t}
                    x={t.t}
                    y={t.fusion.trust_weight}
                    r={3.5}
                    fill={ROSE}
                    stroke={ROSE}
                    isFront
                  />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default TrustChart;
