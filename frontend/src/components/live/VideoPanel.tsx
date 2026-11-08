"use client";

import * as React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Loader2, Radio, Cpu } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { fmtClock } from "@/lib/format";
import type { LiveTick } from "@/lib/types";

interface VideoPanelProps {
  latest: LiveTick | null;
  connected: boolean;
}

// Per-class accent palette. Mirrors the project's control-room look.
const CLASS_STYLES: Record<
  string,
  { border: string; text: string }
> = {
  autorickshaw: { border: "border-amber-400/80", text: "text-amber-300" },
  rider: { border: "border-teal-400/80", text: "text-teal-300" },
  car: { border: "border-emerald-400/80", text: "text-emerald-300" },
  person: { border: "border-rose-400/80", text: "text-rose-300" },
  motorcycle: { border: "border-orange-400/80", text: "text-orange-300" },
};

const FALLBACK_STYLES = {
  border: "border-emerald-400/70",
  text: "text-emerald-300",
};

interface BoxDef {
  cls: string;
  conf: number;
  // position as percentage of the frame
  left: string;
  top: string;
  width: string;
  height: string;
  // drift keyframes (percentage points) for a subtle parallax
  drift: { x: number[]; y: number[]; dur: number };
}

const DEFAULT_BOXES: BoxDef[] = [
  {
    cls: "autorickshaw",
    conf: 0.84,
    left: "8%",
    top: "30%",
    width: "26%",
    height: "42%",
    drift: { x: [0, 0.6, -0.4, 0], y: [0, 0.4, -0.3, 0], dur: 8 },
  },
  {
    cls: "rider",
    conf: 0.72,
    left: "42%",
    top: "36%",
    width: "14%",
    height: "32%",
    drift: { x: [0, -0.5, 0.4, 0], y: [0, 0.3, -0.4, 0], dur: 7.5 },
  },
  {
    cls: "car",
    conf: 0.91,
    left: "62%",
    top: "28%",
    width: "30%",
    height: "38%",
    drift: { x: [0, 0.5, -0.3, 0], y: [0, -0.3, 0.4, 0], dur: 9 },
  },
  {
    cls: "person",
    conf: 0.66,
    left: "32%",
    top: "55%",
    width: "12%",
    height: "28%",
    drift: { x: [0, 0.3, -0.4, 0], y: [0, 0.5, -0.2, 0], dur: 6.5 },
  },
  {
    cls: "motorcycle",
    conf: 0.78,
    left: "78%",
    top: "62%",
    width: "16%",
    height: "26%",
    drift: { x: [0, -0.4, 0.3, 0], y: [0, 0.3, -0.3, 0], dur: 7 },
  },
];

function buildBoxes(detections: Record<string, number> | undefined): BoxDef[] {
  if (!detections) return DEFAULT_BOXES;
  const present = DEFAULT_BOXES.filter((b) => (detections[b.cls] ?? 0) > 0);
  if (present.length === 0) {
    // fall back to a sensible subset
    return DEFAULT_BOXES.slice(0, 4);
  }
  return present;
}

const DETECTION_CHIPS = [
  { cls: "autorickshaw", label: "Auto" },
  { cls: "rider", label: "Rider" },
  { cls: "car", label: "Car" },
  { cls: "person", label: "Person" },
] as const;

export function VideoPanel({ latest, connected }: VideoPanelProps) {
  const boxes = React.useMemo(
    () => buildBoxes(latest?.detections),
    [latest?.detections],
  );
  const detections = latest?.detections ?? {};
  const ts = fmtClock(latest?.t);

  return (
    <Card className="rs-grid-bg gap-0 overflow-hidden p-0">
      <CardHeader className="px-5 pt-5 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base">Live video feed</CardTitle>
            <CardDescription>YOLOv8n detections · dashcam stream</CardDescription>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
              connected && "rs-glow-emerald",
            )}
          >
            <span
              className={cn(
                "inline-block size-1.5 rounded-full bg-emerald-400",
                connected && "rs-pulse",
              )}
            />
            {connected ? "STREAM LIVE" : "OFFLINE"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="px-5 pb-5">
        <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-border/70 bg-black">
          {/* Background dashcam frame */}
          <Image
            src="/traffic-frame.png"
            alt="Dashcam traffic feed"
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover opacity-90"
            priority
          />

          {/* Subtle grid overlay */}
          <div className="rs-grid-bg pointer-events-none absolute inset-0 opacity-60" />

          {/* Vignette */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,oklch(0.16_0.015_230/0.85)_100%)]" />

          {/* YOLO bounding boxes */}
          {boxes.map((b, i) => {
            const style = CLASS_STYLES[b.cls] ?? FALLBACK_STYLES;
            return (
              <motion.div
                key={`${b.cls}-${i}`}
                className={cn(
                  "absolute rounded-[3px] border-2",
                  style.border,
                )}
                style={{
                  left: b.left,
                  top: b.top,
                  width: b.width,
                  height: b.height,
                  boxShadow: "0 0 12px -4px oklch(0 0 0 / 0.6)",
                }}
                animate={{
                  x: b.drift.x.map((v) => `${v}%`),
                  y: b.drift.y.map((v) => `${v}%`),
                }}
                transition={{
                  duration: b.drift.dur,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                {/* Corner ticks for a HUD feel */}
                <span className="pointer-events-none absolute -left-px -top-px size-2 border-l-2 border-t-2 border-current" />
                <span className="pointer-events-none absolute -right-px -top-px size-2 border-r-2 border-t-2 border-current" />
                <span className="pointer-events-none absolute -bottom-px -left-px size-2 border-b-2 border-l-2 border-current" />
                <span className="pointer-events-none absolute -bottom-px -right-px size-2 border-b-2 border-r-2 border-current" />

                <span
                  className={cn(
                    "absolute -top-5 left-0 rounded-sm border border-current/40 bg-black/70 px-1.5 py-0.5 font-mono text-[10px] font-medium leading-none tracking-tight backdrop-blur-sm",
                    style.text,
                  )}
                >
                  {b.cls} {b.conf.toFixed(2)}
                </span>
              </motion.div>
            );
          })}

          {/* Scanline */}
          <div className="rs-scanline pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-emerald-400/15 to-transparent opacity-40" />

          {/* Top-left REC indicator */}
          <div className="absolute left-3 top-3 flex items-center gap-2 rounded-md border border-rose-500/30 bg-black/60 px-2 py-1 backdrop-blur-sm">
            <span className="rs-pulse inline-block size-2 rounded-full bg-rose-500" />
            <span className="font-mono text-[11px] font-semibold tracking-widest text-rose-300">
              REC
            </span>
            <span className="font-mono text-[11px] text-rose-200/70">{ts}</span>
          </div>

          {/* Top-right model chip */}
          <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-md border border-emerald-500/20 bg-black/60 px-2 py-1 backdrop-blur-sm">
            <Cpu className="size-3 text-emerald-300" />
            <span className="font-mono text-[10px] tracking-wide text-emerald-200/80">
              YOLOv8n · 30 FPS
            </span>
          </div>

          {/* Bottom detection chips */}
          <div className="absolute inset-x-3 bottom-3 flex flex-wrap items-center gap-1.5 rounded-md border border-white/5 bg-black/55 px-2 py-1.5 backdrop-blur-sm">
            <Radio className="size-3 text-muted-foreground" />
            {DETECTION_CHIPS.map(({ cls, label }) => {
              const style = CLASS_STYLES[cls] ?? FALLBACK_STYLES;
              const count = detections[cls] ?? 0;
              return (
                <Badge
                  key={cls}
                  variant="outline"
                  className={cn(
                    "gap-1 border-current/30 bg-current/10 px-1.5 py-0 text-[10px] font-medium",
                    style.text,
                  )}
                >
                  <span className="text-muted-foreground/80">{label}</span>
                  <span className="font-mono">{count}</span>
                </Badge>
              );
            })}
            <span className="ml-auto font-mono text-[10px] text-muted-foreground/70">
              {boxes.length} tracks
            </span>
          </div>

          {/* Disconnected overlay */}
          {!connected && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/70 backdrop-blur-sm">
              <Loader2 className="size-6 animate-spin text-amber-300" />
              <Badge
                variant="outline"
                className="border-amber-500/30 bg-amber-500/10 text-amber-300"
              >
                Reconnecting…
              </Badge>
              <span className="font-mono text-[10px] text-muted-foreground">
                socket stream interrupted
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default VideoPanel;
