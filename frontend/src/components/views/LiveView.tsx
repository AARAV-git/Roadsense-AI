"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Radio, Loader2, Square, AlertTriangle,
  Smartphone, Video, WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { VideoPanel } from "@/components/live/VideoPanel";
import { ChaosGauge } from "@/components/live/ChaosGauge";
import { SensorPanel } from "@/components/live/SensorPanel";
import { AlertFeed } from "@/components/live/AlertFeed";
import { TrustPanel } from "@/components/live/TrustPanel";
import { ChaosChart } from "@/components/charts/ChaosChart";
import { SensorCharts } from "@/components/charts/SensorCharts";
import { FusionChart } from "@/components/charts/FusionChart";
import { TrustChart } from "@/components/charts/TrustChart";
import { useLiveStream } from "@/hooks/useLiveStream";
import { useSensorStatus } from "@/hooks/useSensorStatus";
import { api } from "@/lib/api";
import type { AlertRecord } from "@/lib/types";

export function LiveView() {
  // Active session state
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  // Live stream from FastAPI WebSocket — connects to sessionId
  const { ticks, latest, connected, reconnecting } = useLiveStream(sessionId);
  const { hw } = useSensorStatus(2000);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);

  // Poll recent alerts
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const a = await api.listAlerts({ limit: 40, session_id: sessionId ?? undefined });
        if (active) setAlerts(a);
      } catch { /* ignore */ }
    }
    load();
    const id = setInterval(load, 3000);
    return () => { active = false; clearInterval(id); };
  }, [sessionId]);

  // Check if a session is already running on mount
  useEffect(() => {
    api.listSessions().then((sessions) => {
      const running = sessions.find((s) => s.status === "running");
      if (running) setSessionId(Number(running.id));
    }).catch(() => {});
  }, []);

  // Merge latest live alert into alert feed instantly (no extra poll needed)
  const mergedAlerts = useMemo<AlertRecord[]>(() => {
    if (!latest?.alert) return alerts;
    const sig = `${latest.t}-${latest.alert.type}`;
    if (alerts[0] && `${alerts[0].t}-${alerts[0].type}` === sig) return alerts;
    const liveAlert: AlertRecord = {
      id: `live-${sig}`,
      session_id: String(sessionId ?? "live"),
      session_name: "Live · Redmi Note 8 Pro",
      t: latest.t,
      type: latest.alert.type,
      explanation: latest.alert.explanation,
      chaos_score: latest.chaos_score,
      trust_weight: latest.fusion.trust_weight,
      final_conf: latest.fusion.final_conf,
      agree: latest.fusion.agree,
    };
    return [liveAlert, ...alerts].slice(0, 60);
  }, [alerts, latest, sessionId]);

  const [cameraUrl, setCameraUrl] = useState("http://10.130.131.247:8080/video");
  const sensorStale = (latest?.sensor.age_s ?? 0) >= 3;

  // ── Actions ─────────────────────────────────────────────────────────────────
  const startPhone = useCallback(async () => {
    setStarting(true);
    setStartError(null);
    try {
      const res = await api.startPhoneCamera(cameraUrl);
      setSessionId(res.session_id);
    } catch (e) {
      setStartError(e instanceof Error ? e.message : "Failed to start camera");
    } finally {
      setStarting(false);
    }
  }, [cameraUrl]);

  const startUsb = useCallback(async () => {
    setStarting(true);
    setStartError(null);
    try {
      const res = await api.startLive("0", "USB Dashcam");
      setSessionId(Number(res.session_id));
    } catch (e) {
      setStartError(e instanceof Error ? e.message : "Failed to start USB camera");
    } finally {
      setStarting(false);
    }
  }, []);

  const stop = useCallback(async () => {
    if (!sessionId) return;
    setStopping(true);
    try {
      await api.stopSession(sessionId);
      setSessionId(null);
      setAlerts([]);
    } catch { /* ignore */ }
    finally { setStopping(false); }
  }, [sessionId]);

  // MJPEG annotated video feed (direct from FastAPI — no proxy needed)
  const mjpegSrc = sessionId ? api.mjpegUrl(sessionId) : null;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Header strip ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-mono text-xl font-bold sm:text-2xl">
            <Radio className="size-5 text-emerald-400" />
            Live · RoadSense AI
          </h1>
          <p className="text-sm text-muted-foreground">
            IP Webcam / USB Dashcam · YOLOv8n + ESP32 IMU Fusion
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Hardware status badge */}
          <Badge
            variant="outline"
            className={
              hw?.online
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-amber-500/30 bg-amber-500/10 text-amber-300"
            }
          >
            <span
              className={`mr-1.5 size-1.5 rounded-full ${
                hw?.online ? "bg-emerald-400 rs-pulse" : "bg-amber-400"
              }`}
            />
            {hw?.online ? "ESP32 Sensor Online" : "Sensor Standby"}
          </Badge>

          {/* WS status badge */}
          {sessionId && (
            connected ? (
              <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                <span className="mr-1.5 size-1.5 rounded-full bg-emerald-400 rs-pulse" />
                WebSocket live
              </Badge>
            ) : (
              <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-300">
                {reconnecting
                  ? <Loader2 className="mr-1.5 size-3 animate-spin" />
                  : <WifiOff className="mr-1.5 size-3" />}
                {reconnecting ? "Reconnecting…" : "Disconnected"}
              </Badge>
            )
          )}

          {/* Sensor stale warning */}
          {sensorStale && (
            <Badge variant="outline" className="border-rose-500/30 bg-rose-500/10 text-rose-300">
              <AlertTriangle className="mr-1.5 size-3" /> sensor stale · camera only
            </Badge>
          )}

          {/* Stop controls */}
          {sessionId && (
            <Button
              variant="outline"
              size="sm"
              onClick={stop}
              disabled={stopping}
              className="border-rose-500/30 text-rose-300 hover:bg-rose-500/10"
            >
              {stopping
                ? <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                : <Square className="mr-1.5 size-3.5" />}
              {stopping ? "Stopping…" : "Stop Session"}
            </Button>
          )}
        </div>
      </div>

      {/* Camera Stream Controller Bar */}
      {!sessionId && (
        <Card className="border border-emerald-500/20 bg-muted/20">
          <CardContent className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">IP Camera URL:</span>
              <input
                type="text"
                value={cameraUrl}
                onChange={(e) => setCameraUrl(e.target.value)}
                placeholder="http://192.168.31.157:8080/video"
                className="h-8 flex-1 rounded-md border border-border/80 bg-background/80 px-2.5 font-mono text-xs text-foreground focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={startPhone}
                disabled={starting}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs h-8"
              >
                {starting
                  ? <Loader2 className="mr-1.5 size-3 animate-spin" />
                  : <Smartphone className="mr-1.5 size-3" />}
                {starting ? "Connecting…" : "Start IP Camera"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={startUsb}
                disabled={starting}
                className="border-border text-foreground text-xs h-8 hover:bg-accent"
              >
                <Video className="mr-1.5 size-3" />
                USB Camera (0)
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error banner */}
      {startError && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 shrink-0" />
            <span>{startError}</span>
          </div>
          <span className="text-xs text-rose-200/70">Check phone Wi-Fi & URL</span>
        </div>
      )}

      {/* Row 1: video + gauges */}
      <div className="grid gap-5 xl:grid-cols-3">
        <motion.div
          className="xl:col-span-2"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* MJPEG annotated video direct from FastAPI */}
          {mjpegSrc ? (
            <Card className="overflow-hidden border border-emerald-500/30">
              <CardHeader className="py-2.5 px-4 flex flex-row items-center justify-between border-b border-border/40">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <span className="size-2 rounded-full bg-emerald-400 rs-pulse" />
                  Live Annotated Feed · YOLOv8n
                </CardTitle>
                <Badge variant="outline" className="text-[10px] text-emerald-300 border-emerald-500/40">
                  REAL-TIME DETECTIONS
                </Badge>
              </CardHeader>
              <CardContent className="p-0 bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={mjpegSrc}
                  alt="YOLO annotated live feed"
                  className="w-full rounded-b-lg object-contain bg-black"
                  style={{ maxHeight: 420 }}
                />
              </CardContent>
            </Card>
          ) : (
            <VideoPanel latest={latest} connected={Boolean(sessionId && connected)} />
          )}
        </motion.div>
        <motion.div
          className="grid gap-5"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
        >
          <ChaosGauge score={latest?.chaos_score ?? null} />
          <TrustPanel fusion={latest?.fusion ?? null} />
        </motion.div>
      </div>

      {/* Row 2: sensor + alerts */}
      <div className="grid gap-5 lg:grid-cols-2">
        <SensorPanel latest={latest} hw={hw} />
        <AlertFeed alerts={mergedAlerts} max={40} />
      </div>

      {/* Row 3: live charts */}
      <div className="grid gap-5">
        <ChaosChart ticks={ticks} />
        <SensorCharts ticks={ticks} />
        <div className="grid gap-5 xl:grid-cols-2">
          <FusionChart ticks={ticks} />
          <TrustChart ticks={ticks} />
        </div>
      </div>

      {/* Explain-it card — always visible */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How to read this screen</CardTitle>
          <CardDescription>the 4-step story for your project demo</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["1 · Video", "Redmi Note 8 Pro streams 1080p over Wi-Fi · YOLO draws boxes per class."],
              ["2 · Sensor graphs", "ESP32 sends IMU every second — speed, braking g, lateral g."],
              ["3 · Fusion graph", "camera chaos × sensor braking on one axis — agreement made visible."],
              ["4 · Trust graph", "confidence drops when the sensor goes stale or disagrees with camera."],
            ].map(([t, b]) => (
              <li key={t} className="rounded-lg border bg-muted/30 p-3">
                <p className="font-medium text-foreground">{t}</p>
                <p className="mt-1 text-xs text-muted-foreground">{b}</p>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

export default LiveView;
