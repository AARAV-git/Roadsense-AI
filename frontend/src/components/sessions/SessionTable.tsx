"use client";

import * as React from "react";
import { Bell, ChevronRight, Clapperboard } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  chaosColor,
  fmtDateTime,
  fmtDuration,
  fmtPct,
  trustColor,
} from "@/lib/format";
import type { Session, SessionStatus } from "@/lib/types";

export interface SessionTableProps {
  sessions: Session[];
  loading?: boolean;
  onSelect?: (id: string) => void;
  selectedId?: string;
}

function StatusBadge({ status }: { status: SessionStatus }) {
  switch (status) {
    case "running":
      return (
        <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-300">
          <span className="size-1.5 rounded-full bg-emerald-400 rs-pulse" />
          Running
        </Badge>
      );
    case "completed":
      return (
        <Badge className="border-teal-500/30 bg-teal-500/15 text-teal-300">
          <span className="size-1.5 rounded-full bg-teal-400" />
          Completed
        </Badge>
      );
    case "stopped":
      return (
        <Badge className="border-amber-500/30 bg-amber-500/15 text-amber-300">
          <span className="size-1.5 rounded-full bg-amber-400" />
          Stopped
        </Badge>
      );
    case "failed":
      return (
        <Badge className="border-rose-500/30 bg-rose-500/15 text-rose-300">
          <span className="size-1.5 rounded-full bg-rose-400" />
          Failed
        </Badge>
      );
  }
}

function ChaosInlineBar({ score }: { score: number }) {
  const color = chaosColor(score);
  const pct = Math.max(2, Math.min(100, (score || 0) * 100));
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-1.5 w-14 overflow-hidden rounded-full bg-muted"
        aria-hidden
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span
        className="font-mono text-xs tabular-nums"
        style={{ color }}
      >
        {fmtPct(score)}
      </span>
    </div>
  );
}

export function SessionTable({
  sessions,
  loading = false,
  onSelect,
  selectedId,
}: SessionTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Past runs</CardTitle>
        <CardDescription>recorded analyses &amp; replays</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="max-h-[460px] overflow-y-auto rs-scroll rounded-md border border-border/40">
          <Table className="min-w-[640px]">
            <TableHeader className="bg-muted/40">
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="pl-4">Run</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Avg chaos</TableHead>
                <TableHead>Alerts</TableHead>
                <TableHead>Avg trust</TableHead>
                <TableHead className="w-8 pr-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow
                    key={`sk-${i}`}
                    className="hover:bg-transparent border-border"
                  >
                    <TableCell className="pl-4 py-3">
                      <Skeleton className="h-4 w-36" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-20 rounded-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-12" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-10" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-12" />
                    </TableCell>
                    <TableCell className="pr-4">
                      <Skeleton className="h-4 w-4" />
                    </TableCell>
                  </TableRow>
                ))
              ) : sessions.length === 0 ? (
                <TableRow className="hover:bg-transparent border-border">
                  <TableCell colSpan={8} className="py-14">
                    <div className="flex flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                      <Clapperboard className="size-6 text-muted-foreground/60" />
                      <p className="text-sm">
                        No runs yet — upload a clip to begin.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                sessions.map((s) => {
                  const isSelected = s.id === selectedId;
                  return (
                    <TableRow
                      key={s.id}
                      data-state={isSelected ? "selected" : undefined}
                      tabIndex={0}
                      onClick={() => onSelect?.(s.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onSelect?.(s.id);
                        }
                      }}
                      className={cn(
                        "cursor-pointer border-border outline-none",
                        "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500/40",
                        isSelected
                          ? "bg-accent/70 hover:bg-accent/70"
                          : "hover:bg-muted/50",
                      )}
                    >
                      <TableCell className="pl-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-foreground">
                            {s.name}
                          </span>
                          <span className="font-mono text-[11px] text-muted-foreground truncate max-w-[220px]">
                            {s.clip_name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={s.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground tabular-nums">
                        {fmtDateTime(s.started_at)}
                      </TableCell>
                      <TableCell className="text-muted-foreground tabular-nums">
                        {fmtDuration(s.duration_s)}
                      </TableCell>
                      <TableCell>
                        <ChaosInlineBar score={s.avg_chaos} />
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                          <Bell className="size-3.5" />
                          <span className="tabular-nums">{s.alert_count}</span>
                        </span>
                      </TableCell>
                      <TableCell>
                        <span
                          className="font-mono text-xs tabular-nums"
                          style={{ color: trustColor(s.avg_trust_weight) }}
                        >
                          {fmtPct(s.avg_trust_weight)}
                        </span>
                      </TableCell>
                      <TableCell className="pr-4">
                        <ChevronRight className="size-4 text-muted-foreground/70" />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export default SessionTable;
