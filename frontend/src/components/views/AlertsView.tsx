"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Bell, RefreshCw, ShieldAlert, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertFeed } from "@/components/live/AlertFeed";
import { api } from "@/lib/api";
import type { AlertRecord, AlertType } from "@/lib/types";
import { alertTypeMeta, fmtPct } from "@/lib/format";

const ALL_TYPES: AlertType[] = [
  "lane_cut",
  "sudden_slowdown",
  "high_chaos",
  "harsh_brake",
  "sharp_turn",
  "crowd_surge",
  "wrong_side",
  "sensor_stale",
  "low_confidence",
];

export function AlertsView() {
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<AlertType | "all">("all");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const a = await api.listAlerts({ limit: 200 });
        if (active) setAlerts(a);
      } catch {
        /* ignore */
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    const id = setInterval(load, 4000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of alerts) m[a.type] = (m[a.type] ?? 0) + 1;
    return m;
  }, [alerts]);

  const visible = filter === "all" ? alerts : alerts.filter((a) => a.type === filter);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-mono text-xl font-bold sm:text-2xl">
            <Bell className="size-5 text-amber-400" /> Alert history
          </h1>
          <p className="text-sm text-muted-foreground">
            every decision, with the plain-language reason behind it
          </p>
        </div>
        <Button variant="outline" size="sm" disabled={loading}>
          <RefreshCw className={`mr-1.5 size-3.5 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Syncing…" : "Live"}
        </Button>
      </div>

      {/* Type breakdown */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {ALL_TYPES.map((t, i) => {
          const meta = alertTypeMeta(t);
          const count = counts[t] ?? 0;
          const active = filter === t;
          return (
            <motion.button
              key={t}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.03 }}
              onClick={() => setFilter(active ? "all" : t)}
              className={`text-left rounded-lg border p-3 transition-colors ${
                active
                  ? `${meta.bg} ${meta.border}`
                  : "bg-card hover:bg-muted/50 border-border"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-medium uppercase tracking-wide ${meta.color}`}>
                  {meta.label}
                </span>
                {count > 0 && (
                  <span className={`font-mono text-sm font-bold ${meta.color}`}>{count}</span>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Decision log</CardTitle>
                <CardDescription>
                  {filter === "all" ? "all types" : alertTypeMeta(filter).label} ·{" "}
                  {visible.length} shown
                </CardDescription>
              </div>
              {filter !== "all" && (
                <Button variant="ghost" size="sm" onClick={() => setFilter("all")}>
                  <Filter className="mr-1.5 size-3.5" /> Clear
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="py-12 text-center text-sm text-muted-foreground">Loading alerts…</p>
            ) : (
              <AlertFeed alerts={visible} max={200} />
            )}
          </CardContent>
        </Card>

        <div className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldAlert className="size-4 text-amber-400" /> Why these fire
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                Each alert is the fusion layer's verdict — it only fires when
                vision and the motion sensor corroborate the same event.
              </p>
              <ul className="space-y-1.5 pt-1">
                <li>
                  <Badge variant="outline" className="mr-1.5 border-rose-500/30 bg-rose-500/10 text-rose-300">
                    lane_cut
                  </Badge>
                  chaos spike + lateral motion agree.
                </li>
                <li>
                  <Badge variant="outline" className="mr-1.5 border-orange-500/30 bg-orange-500/10 text-orange-300">
                    harsh_brake
                  </Badge>
                  deceleration g crosses 0.3 with rising chaos.
                </li>
                <li>
                  <Badge variant="outline" className="mr-1.5 border-amber-500/30 bg-amber-500/10 text-amber-300">
                    sensor_stale
                  </Badge>
                  ESP32 age &gt; 3s — camera only, confidence dropped.
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Average confidence</CardTitle>
              <CardDescription>across the visible alerts</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="font-mono text-3xl font-bold text-emerald-400">
                {visible.length
                  ? fmtPct(
                      visible.reduce((s, a) => s + a.final_conf, 0) / visible.length,
                      0,
                    )
                  : "—"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                final fused confidence per alert
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default AlertsView;
