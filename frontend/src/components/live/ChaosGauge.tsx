"use client";

import * as React from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  chaosClasses,
  chaosColor,
  chaosLabel,
} from "@/lib/format";

interface ChaosGaugeProps {
  score: number | null;
}

// 270° arc gauge drawn with an SVG stroke-dasharray.
const START_ANGLE = 135; // deg
const SWEEP = 270; // deg

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function arcPath(cx: number, cy: number, r: number, start: number, end: number) {
  const s = polar(cx, cy, r, end);
  const e = polar(cx, cy, r, start);
  const largeArc = end - start <= 180 ? 0 : 1;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 0 ${e.x} ${e.y}`;
}

// rAF-based number/angle animation, no extra deps.
function useRafTween(target: number, duration = 600) {
  const [value, setValue] = React.useState(target);
  const fromRef = React.useRef(target);
  const targetRef = React.useRef(target);
  React.useEffect(() => {
    fromRef.current = value;
    targetRef.current = target;
    let raf = 0;
    let start = 0;
    const from = fromRef.current;
    const tick = (now: number) => {
      if (!start) start = now;
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(from + (target - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

export function ChaosGauge({ score }: ChaosGaugeProps) {
  const safe =
    score != null && isFinite(score) ? Math.min(1, Math.max(0, score)) : 0;
  const label = chaosLabel(safe);
  const color = chaosColor(safe);
  const classes = chaosClasses(safe);

  const W = 220;
  const H = 200;
  const cx = W / 2;
  const cy = H / 2 + 14;
  const r = 78;
  const stroke = 14;

  const animatedScore = useRafTween(safe, 600);
  const displayValue = animatedScore * 100;
  const endAngle = START_ANGLE + animatedScore * SWEEP;
  const needle = polar(cx, cy, r, endAngle);

  const glowClass =
    safe >= 0.7 ? "rs-glow-rose" : safe >= 0.4 ? "rs-glow-amber" : "";

  return (
    <Card className={cn("gap-0", glowClass)}>
      <CardHeader className="px-5 pt-5 pb-2">
        <CardTitle className="text-base">Chaos score</CardTitle>
        <CardDescription>fused traffic risk 0–100</CardDescription>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <div className="flex flex-col items-center">
          <div className="relative" style={{ width: W, height: H }}>
            <svg
              width={W}
              height={H}
              viewBox={`0 0 ${W} ${H}`}
              className="overflow-visible"
            >
              {/* Track */}
              <path
                d={arcPath(cx, cy, r, START_ANGLE, START_ANGLE + SWEEP)}
                fill="none"
                stroke="oklch(1 0 0 / 0.07)"
                strokeWidth={stroke}
                strokeLinecap="round"
              />
              {/* Band tints */}
              <path
                d={arcPath(cx, cy, r, START_ANGLE, START_ANGLE + SWEEP * 0.4)}
                fill="none"
                stroke="oklch(0.72 0.16 162 / 0.18)"
                strokeWidth={stroke}
                strokeLinecap="round"
              />
              <path
                d={arcPath(
                  cx,
                  cy,
                  r,
                  START_ANGLE + SWEEP * 0.4,
                  START_ANGLE + SWEEP * 0.7,
                )}
                fill="none"
                stroke="oklch(0.78 0.16 70 / 0.18)"
                strokeWidth={stroke}
              />
              <path
                d={arcPath(
                  cx,
                  cy,
                  r,
                  START_ANGLE + SWEEP * 0.7,
                  START_ANGLE + SWEEP,
                )}
                fill="none"
                stroke="oklch(0.68 0.21 25 / 0.18)"
                strokeWidth={stroke}
              />
              {/* Value arc */}
              <path
                d={arcPath(cx, cy, r, START_ANGLE, endAngle)}
                fill="none"
                stroke={color}
                strokeWidth={stroke}
                strokeLinecap="round"
                style={{ filter: `drop-shadow(0 0 6px ${color})` }}
              />
              {/* Needle dot */}
              <circle
                cx={needle.x}
                cy={needle.y}
                r={6}
                fill={color}
                style={{ filter: `drop-shadow(0 0 6px ${color})` }}
              />
              {/* Hub */}
              <circle cx={cx} cy={cy} r={3} fill="oklch(1 0 0 / 0.35)" />
            </svg>

            {/* Center readout */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pt-2">
              <div className="flex items-baseline gap-0.5">
                <span
                  className={cn(
                    "font-mono text-5xl font-bold tabular-nums",
                    classes.text,
                  )}
                  style={{ textShadow: `0 0 18px ${color}` }}
                >
                  {Math.round(displayValue)}
                </span>
                <span className="text-lg font-medium text-muted-foreground">
                  %
                </span>
              </div>
              <span
                className={cn(
                  "mt-1 text-xs font-semibold uppercase tracking-[0.2em]",
                  classes.text,
                )}
              >
                {label}
              </span>
            </div>
          </div>

          {/* Band legend */}
          <div className="mt-3 flex w-full items-center justify-between gap-1 rounded-md border border-border/60 bg-muted/30 px-3 py-2">
            <BandDot label="Calm" color="oklch(0.72 0.16 162)" active={safe < 0.4} />
            <BandDot
              label="Elevated"
              color="oklch(0.78 0.16 70)"
              active={safe >= 0.4 && safe < 0.7}
            />
            <BandDot
              label="Critical"
              color="oklch(0.68 0.21 25)"
              active={safe >= 0.7}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BandDot({
  label,
  color,
  active,
}: {
  label: string;
  color: string;
  active: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1">
      <div className="flex items-center gap-1.5">
        <span
          className="inline-block size-1.5 rounded-full"
          style={{
            backgroundColor: color,
            boxShadow: active ? `0 0 8px ${color}` : "none",
          }}
        />
        <span
          className={cn(
            "text-[10px] font-medium uppercase tracking-wide",
            active ? "text-foreground" : "text-muted-foreground/70",
          )}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

export default ChaosGauge;
