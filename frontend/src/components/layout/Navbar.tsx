"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Bell,
  Cpu,
  Film,
  LayoutDashboard,
  Radio,
  Radar,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtClock } from "@/lib/format";
import type { ServiceState } from "@/lib/types";
import { StatusPill } from "./StatusPill";

export type View = "home" | "live" | "sessions" | "alerts" | "hardware";

export interface NavbarProps {
  view: View;
  onNavigate: (v: View) => void;
  backendState: ServiceState;
  esp32State: ServiceState;
  esp32Detail?: string;
}

const NAV_ITEMS: { id: View; label: string; icon: LucideIcon }[] = [
  { id: "home", label: "Home", icon: LayoutDashboard },
  { id: "live", label: "Live", icon: Radio },
  { id: "sessions", label: "Sessions", icon: Film },
  { id: "alerts", label: "Alerts", icon: Bell },
  { id: "hardware", label: "Hardware", icon: Cpu },
];

/**
 * Top navigation bar — sticky, blurred, with the RoadSense brand, primary nav
 * (horizontal-scroll on mobile), Backend + ESP32 status pills, and a live
 * clock. The active nav item gets an emerald underline that slides between
 * items via a framer-motion shared-layout transition.
 */
export function Navbar({
  view,
  onNavigate,
  backendState,
  esp32State,
  esp32Detail,
}: NavbarProps) {
  // Start null so server + first client render match; the clock only appears
  // after mount to avoid a hydration mismatch on the time string.
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // Synchronous initial set is deliberate: the clock is client-only to
    // avoid a hydration mismatch on the time string.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full",
        "border-b border-border/60",
        "bg-background/80 backdrop-blur-xl",
        "supports-[backdrop-filter]:bg-background/60",
      )}
    >
      {/* faint grid texture layered behind the bar contents */}
      <div
        aria-hidden
        className="rs-grid-bg pointer-events-none absolute inset-0 opacity-40"
      />

      <div className="relative mx-auto flex h-14 max-w-[1600px] items-center gap-2 px-3 sm:gap-3 sm:px-4">
        {/* ---- Brand ---- */}
        <div className="flex shrink-0 items-center gap-2.5">
          <div className="grid size-8 place-items-center rounded-md bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30">
            <Radar className="size-5" />
          </div>
          <div className="hidden flex-col leading-none sm:flex">
            <span className="text-sm font-semibold tracking-tight">
              RoadSense
            </span>
            <span className="text-[10px] tracking-wide text-muted-foreground/80">
              multimodal chaos intelligence
            </span>
          </div>
        </div>

        <div
          aria-hidden
          className="mx-1 hidden h-6 w-px shrink-0 bg-border/60 md:block"
        />

        {/* ---- Primary nav (horizontally scrollable on mobile) ---- */}
        <nav
          aria-label="Primary"
          className="rs-scroll flex flex-1 items-center gap-0.5 overflow-x-auto md:justify-center"
        >
          {NAV_ITEMS.map((item) => {
            const active = item.id === view;
            const Icon = item.icon;
            return (
              <motion.button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                aria-current={active ? "page" : undefined}
                whileTap={{ scale: 0.97 }}
                className={cn(
                  "relative inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                <span>{item.label}</span>
                {active ? (
                  <motion.span
                    layoutId="nav-active-indicator"
                    className="absolute inset-x-2 -bottom-[3px] h-0.5 rounded-full bg-emerald-400 shadow-[0_0_8px_0_oklch(0.72_0.16_162/0.7)]"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                ) : null}
              </motion.button>
            );
          })}
        </nav>

        {/* ---- Right cluster: status pills + live clock ---- */}
        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          <StatusPill
            label="Backend"
            state={backendState}
            pulse
          />

          {/* ESP32 pill: full detail on sm+, dot-only on very small screens */}
          <StatusPill
            label="ESP32"
            state={esp32State}
            detail={esp32Detail}
            pulse
            className="hidden sm:inline-flex"
          />
          <StatusPill
            label="ESP32"
            state={esp32State}
            pulse
            className="sm:hidden"
          />

          {/* Live clock — hidden below lg */}
          <div
            aria-label="Current time"
            className="hidden items-center gap-2 rounded-md border border-border/60 bg-card/40 px-2.5 py-1 font-mono text-xs tabular-nums text-muted-foreground lg:flex"
          >
            <span
              aria-hidden
              className="size-1.5 rounded-full bg-emerald-400 rs-pulse"
            />
            <span>{now ? fmtClock(now) : "--:--:--"}</span>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
