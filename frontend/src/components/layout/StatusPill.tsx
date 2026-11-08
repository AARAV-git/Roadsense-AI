"use client";

import { cn } from "@/lib/utils";
import type { ServiceState } from "@/lib/types";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface StatusPillProps {
  /** Service name shown in the pill body, e.g. "Backend" or "ESP32". */
  label: string;
  /** Current service state — drives the dot colour. */
  state: ServiceState;
  /** Optional mono detail line, e.g. "8 sats · 1.0 pps". */
  detail?: string;
  /** Pulse the dot when the service is online. */
  pulse?: boolean;
  /** Extra classes merged onto the outer pill (used for responsive show/hide). */
  className?: string;
}

const STATE_STYLES: Record<
  ServiceState,
  { dot: string; text: string; border: string }
> = {
  online: {
    dot: "bg-emerald-400",
    text: "text-emerald-300",
    border: "border-emerald-500/25",
  },
  offline: {
    dot: "bg-rose-400",
    text: "text-rose-300",
    border: "border-rose-500/25",
  },
  degraded: {
    dot: "bg-amber-400",
    text: "text-amber-300",
    border: "border-amber-500/25",
  },
};

const STATE_LABEL: Record<ServiceState, string> = {
  online: "Online",
  offline: "Offline",
  degraded: "Degraded",
};

/**
 * Compact status pill used in the navbar / hardware page to show a service's
 * health at a glance. Coloured dot + label + optional detail, wrapped in a
 * shadcn Tooltip that surfaces the state name on hover/focus.
 */
export function StatusPill({
  label,
  state,
  detail,
  pulse = false,
  className,
}: StatusPillProps) {
  const s = STATE_STYLES[state];
  const showPulse = pulse && state === "online";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          tabIndex={0}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border bg-card/60 px-2.5 py-1 text-xs font-medium",
            "backdrop-blur-sm transition-colors outline-none",
            "focus-visible:ring-2 focus-visible:ring-ring/50",
            s.border,
            className,
          )}
        >
          <span
            aria-hidden
            className={cn(
              "inline-flex size-2 rounded-full",
              s.dot,
              showPulse && "rs-pulse",
            )}
          />
          <span className="leading-none text-foreground/90">{label}</span>
          {detail ? (
            <>
              <span aria-hidden className="leading-none text-muted-foreground/50">
                ·
              </span>
              <span
                className={cn(
                  "font-mono leading-none tabular-nums",
                  s.text,
                )}
              >
                {detail}
              </span>
            </>
          ) : null}
        </div>
      </TooltipTrigger>
      <TooltipContent sideOffset={6}>
        <div className="flex items-center gap-1.5">
          <span className={cn("size-1.5 rounded-full", s.dot)} />
          <span className="font-semibold">{label}</span>
          <span className="opacity-80">· {STATE_LABEL[state]}</span>
        </div>
        {detail ? (
          <div className="text-[10px] opacity-80">{detail}</div>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}

export default StatusPill;
