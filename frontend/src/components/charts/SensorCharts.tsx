"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
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
import { fmtClock, fmtNum } from "@/lib/format";

// --- RoadSense palette tokens ---
const GRID_STROKE = "oklch(0.6 0.01 200 / 0.15)";
const TICK_FILL = "oklch(0.7 0.01 200 / 0.6)";
const TEAL = "oklch(0.7 0.13 195)";
const ORANGE = "oklch(0.72 0.17 50)";
const AMBER = "oklch(0.78 0.16 70)";
const ROSE = "oklch(0.68 0.21 25)";

interface SensorChartsProps {
  ticks: LiveTick[];
}

type Metric = "speed" | "braking" | "turning";

function SensorTooltip({
  active,
  payload,
  metric,
  color,
}: {
  active?: boolean;
  payload?: Array<{ payload: LiveTick }>;
  metric: Metric;
  color: string;
}) {
  if (!active || !payload?.length) return null;
  const tick = payload[0]?.payload;
  if (!tick) return null;
  let label = "";
  let value = "";
  let unit = "";
  if (metric === "speed") {
    label = "Speed";
    value = fmtNum(tick.sensor.speed_kmh, 1);
    unit = "km/h";
  } else if (metric === "braking") {
    label = "Braking";
    value = fmtNum(tick.sensor.peak_decel_g, 2);
    unit = "g";
  } else {
    label = "Turning";
    value = fmtNum(tick.sensor.peak_lateral_g, 2);
    unit = "g";
  }
  return (
    <div className="rounded-md border border-border/60 bg-popover/95 p-2 text-xs shadow-lg backdrop-blur">
      <div className="font-mono text-muted-foreground">{fmtClock(tick.t)}</div>
      <div className="mt-1 flex items-center gap-1.5">
        <span
          className="inline-block h-2 w-2 rounded-[2px]"
          style={{ background: color }}
        />
        <span className="text-muted-foreground">{label}</span>
        <span className="ml-auto font-mono font-medium tabular-nums text-foreground">
          {value} {unit}
        </span>
      </div>
      {metric !== "speed" && (
        <div className="mt-1 flex items-center gap-1.5 border-t border-border/40 pt-1">
          <span className="text-muted-foreground">Event</span>
          <span className="ml-auto font-mono text-muted-foreground">
            {tick.sensor.event === "harsh_brake"
              ? "harsh brake"
              : tick.sensor.event === "sharp_turn"
                ? "sharp turn"
                : tick.sensor.event === "smooth"
                  ? "smooth"
                  : "—"}
          </span>
        </div>
      )}
    </div>
  );
}

function MiniPanel({
  title,
  value,
  color,
  children,
}: {
  title: string;
  value: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/50 bg-card/40 px-3 py-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </span>
        <span
          className="font-mono text-xs font-medium tabular-nums"
          style={{ color }}
        >
          {value}
        </span>
      </div>
      {children}
    </div>
  );
}

export function SensorCharts({ ticks }: SensorChartsProps) {
  const latest = ticks.at(-1);
  const harshBrakes = ticks.filter((t) => t.sensor.event === "harsh_brake");
  const sharpTurns = ticks.filter((t) => t.sensor.event === "sharp_turn");

  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <CardTitle className="text-sm">Sensor readings</CardTitle>
        <CardDescription className="text-xs">
          speed · braking · turning · last 60s
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4">
        {ticks.length === 0 || !latest ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Skeleton className="h-[150px] w-full" />
            <Skeleton className="h-[150px] w-full" />
            <Skeleton className="h-[150px] w-full" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {/* 1. Vehicle speed */}
            <MiniPanel
              title="Vehicle speed"
              value={`${fmtNum(latest.sensor.speed_kmh, 1)} km/h`}
              color={TEAL}
            >
              <div className="h-[120px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={ticks}
                    margin={{ top: 8, right: 12, bottom: 0, left: -12 }}
                  >
                    <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                    <XAxis dataKey="t" hide />
                    <YAxis
                      domain={[0, "auto"]}
                      tick={{ fontSize: 10, fill: TICK_FILL }}
                      tickLine={false}
                      axisLine={false}
                      width={28}
                      tickCount={3}
                      tickFormatter={(v: number) => fmtNum(v, 0)}
                    />
                    <Tooltip
                      content={
                        <SensorTooltip metric="speed" color={TEAL} />
                      }
                      cursor={{ stroke: TICK_FILL, strokeOpacity: 0.3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="sensor.speed_kmh"
                      stroke={TEAL}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive
                      animationDuration={300}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </MiniPanel>

            {/* 2. Braking */}
            <MiniPanel
              title="Braking"
              value={`${fmtNum(latest.sensor.peak_decel_g, 2)} g`}
              color={ORANGE}
            >
              <div className="h-[120px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={ticks}
                    margin={{ top: 8, right: 12, bottom: 0, left: -12 }}
                  >
                    <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                    <XAxis dataKey="t" hide />
                    <YAxis
                      domain={[0, "auto"]}
                      tick={{ fontSize: 10, fill: TICK_FILL }}
                      tickLine={false}
                      axisLine={false}
                      width={28}
                      tickCount={3}
                      tickFormatter={(v: number) => fmtNum(v, 2)}
                    />
                    <Tooltip
                      content={
                        <SensorTooltip metric="braking" color={ORANGE} />
                      }
                      cursor={{ stroke: TICK_FILL, strokeOpacity: 0.3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="sensor.peak_decel_g"
                      stroke={ORANGE}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive
                      animationDuration={300}
                    />
                    {harshBrakes.map((t) => (
                      <ReferenceDot
                        key={t.t}
                        x={t.t}
                        y={t.sensor.peak_decel_g}
                        r={4}
                        fill={ROSE}
                        stroke={ROSE}
                        isFront
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </MiniPanel>

            {/* 3. Turning */}
            <MiniPanel
              title="Turning"
              value={`${fmtNum(latest.sensor.peak_lateral_g, 2)} g`}
              color={AMBER}
            >
              <div className="h-[120px] w-full">
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
                      minTickGap={20}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      domain={[0, "auto"]}
                      tick={{ fontSize: 10, fill: TICK_FILL }}
                      tickLine={false}
                      axisLine={false}
                      width={28}
                      tickCount={3}
                      tickFormatter={(v: number) => fmtNum(v, 2)}
                    />
                    <Tooltip
                      content={
                        <SensorTooltip metric="turning" color={AMBER} />
                      }
                      cursor={{ stroke: TICK_FILL, strokeOpacity: 0.3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="sensor.peak_lateral_g"
                      stroke={AMBER}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive
                      animationDuration={300}
                    />
                    {sharpTurns.map((t) => (
                      <ReferenceDot
                        key={t.t}
                        x={t.t}
                        y={t.sensor.peak_lateral_g}
                        r={4}
                        fill={ROSE}
                        stroke={ROSE}
                        isFront
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </MiniPanel>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default SensorCharts;
