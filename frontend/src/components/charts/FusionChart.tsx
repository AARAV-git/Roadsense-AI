"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
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
const ROSE = "oklch(0.68 0.21 25)";
const ORANGE = "oklch(0.72 0.17 50)";
const EMERALD = "oklch(0.72 0.16 162)";

interface FusionChartProps {
  ticks: LiveTick[];
}

function FusionTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: LiveTick }>;
}) {
  if (!active || !payload?.length) return null;
  const tick = payload[0]?.payload;
  if (!tick) return null;
  const agree = tick.fusion.agree;
  return (
    <div className="rounded-md border border-border/60 bg-popover/95 p-2 text-xs shadow-lg backdrop-blur">
      <div className="font-mono text-muted-foreground">{fmtClock(tick.t)}</div>
      <div className="mt-1 flex items-center gap-1.5">
        <span
          className="inline-block h-2 w-2 rounded-[2px]"
          style={{ background: ROSE }}
        />
        <span className="text-muted-foreground">Chaos (camera)</span>
        <span
          className="ml-auto font-mono font-medium tabular-nums"
          style={{ color: ROSE }}
        >
          {fmtPct(tick.chaos_score, 0)}
        </span>
      </div>
      <div className="mt-0.5 flex items-center gap-1.5">
        <span
          className="inline-block h-2 w-2 rounded-[2px]"
          style={{ background: ORANGE }}
        />
        <span className="text-muted-foreground">Braking (sensor)</span>
        <span
          className="ml-auto font-mono font-medium tabular-nums"
          style={{ color: ORANGE }}
        >
          {fmtNum(tick.sensor.peak_decel_g, 2)} g
        </span>
      </div>
      <div className="mt-1 flex items-center gap-1.5 border-t border-border/40 pt-1">
        <span className="text-muted-foreground">Sources</span>
        <span
          className="ml-auto rounded px-1.5 py-0.5 text-[10px] font-medium"
          style={{
            color: agree ? EMERALD : ROSE,
            background: agree
              ? "oklch(0.72 0.16 162 / 0.12)"
              : "oklch(0.68 0.21 25 / 0.12)",
          }}
        >
          {agree ? "agree" : "disagree"}
        </span>
      </div>
    </div>
  );
}

export function FusionChart({ ticks }: FusionChartProps) {
  // Build contiguous agreement segments for the shaded emerald band.
  const agreeSegments: { start: string; end: string }[] = [];
  let segStart: string | null = null;
  for (let i = 0; i < ticks.length; i++) {
    const tick = ticks[i];
    if (tick.fusion.agree && segStart === null) {
      segStart = tick.t;
    } else if (!tick.fusion.agree && segStart !== null) {
      agreeSegments.push({ start: segStart, end: ticks[i - 1].t });
      segStart = null;
    }
  }
  if (segStart !== null && ticks.length > 0) {
    agreeSegments.push({ start: segStart, end: ticks[ticks.length - 1].t });
  }

  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <CardTitle className="text-sm">Sensor fusion</CardTitle>
        <CardDescription className="text-xs">
          camera chaos × sensor braking · agreement band
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4">
        {ticks.length === 0 ? (
          <Skeleton className="h-[220px] w-full" />
        ) : (
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={ticks}
                margin={{ top: 8, right: 12, bottom: 0, left: -12 }}
              >
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
                  yAxisId="left"
                  domain={[0, 1]}
                  tick={{ fontSize: 10, fill: TICK_FILL }}
                  tickLine={false}
                  axisLine={false}
                  width={32}
                  ticks={[0, 0.5, 1]}
                  tickFormatter={(v: number) => fmtPct(v, 0)}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 0.6]}
                  tick={{ fontSize: 10, fill: TICK_FILL }}
                  tickLine={false}
                  axisLine={false}
                  width={32}
                  ticks={[0, 0.3, 0.6]}
                  tickFormatter={(v: number) => fmtNum(v, 1)}
                />
                <Tooltip
                  content={<FusionTooltip />}
                  cursor={{ stroke: TICK_FILL, strokeOpacity: 0.3 }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 10, paddingBottom: 8 }}
                />
                {agreeSegments.map((seg, i) => (
                  <ReferenceArea
                    key={`agree-${i}`}
                    yAxisId="left"
                    x1={seg.start}
                    x2={seg.end}
                    y1={0}
                    y2={1}
                    fill={EMERALD}
                    fillOpacity={0.08}
                    stroke="none"
                  />
                ))}
                <ReferenceLine
                  yAxisId="right"
                  y={0.3}
                  stroke={ORANGE}
                  strokeDasharray="4 4"
                  label={{
                    value: "harsh brake",
                    fill: ORANGE,
                    fontSize: 9,
                    position: "insideTopRight",
                  }}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="chaos_score"
                  name="Chaos (camera)"
                  stroke={ROSE}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive
                  animationDuration={300}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="sensor.peak_decel_g"
                  name="Braking (sensor)"
                  stroke={ORANGE}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive
                  animationDuration={300}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default FusionChart;
