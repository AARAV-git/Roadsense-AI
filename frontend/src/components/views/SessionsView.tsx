"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Film, ClipboardList, ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { UploadForm } from "@/components/sessions/UploadForm";
import { SessionTable } from "@/components/sessions/SessionTable";
import { SessionSummary } from "@/components/sessions/SessionSummary";
import { ChaosChart } from "@/components/charts/ChaosChart";
import { SensorCharts } from "@/components/charts/SensorCharts";
import { FusionChart } from "@/components/charts/FusionChart";
import { TrustChart } from "@/components/charts/TrustChart";
import { api } from "@/lib/api";
import type { LiveTick, Session, SessionFrame, SessionSummary as Summary } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

function framesToTicks(frames: SessionFrame[]): LiveTick[] {
  return frames.map((f) => ({
    type: "tick" as const,
    t: f.t,
    chaos_score: f.chaos_score,
    detections: {},
    sensor: {
      speed_kmh: f.speed_kmh,
      peak_decel_g: f.peak_decel_g,
      peak_lateral_g: f.peak_lateral_g,
      event:
        f.peak_decel_g >= 0.3
          ? "harsh_brake"
          : f.peak_lateral_g >= 0.18
            ? "sharp_turn"
            : "smooth",
      age_s: 0.5,
    },
    fusion: {
      vision_conf: f.vision_conf,
      sensor_conf: f.sensor_conf,
      agree: true,
      trust_weight: f.trust_weight,
      final_conf: f.final_conf,
    },
    alert: null,
  }));
}

export function SessionsView() {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [frames, setFrames] = useState<SessionFrame[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [uploading, setUploading] = useState(false);

  const loadSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const s = await api.listSessions();
      setSessions(s);
      if (!selectedId && s.length > 0) setSelectedId(s[0].id);
    } catch {
      /* ignore */
    } finally {
      setLoadingSessions(false);
    }
  }, [selectedId]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    if (!selectedId) {
      setSummary(null);
      setFrames([]);
      return;
    }
    let active = true;
    setLoadingDetail(true);
    Promise.all([api.getSession(selectedId), api.getSessionFrames(selectedId)])
      .then(([s, f]) => {
        if (!active) return;
        setSummary(s);
        setFrames(f);
      })
      .catch(() => {
        if (active) {
          setSummary(null);
          setFrames([]);
        }
      })
      .finally(() => active && setLoadingDetail(false));
    return () => {
      active = false;
    };
  }, [selectedId]);

  const handleUploaded = async (sessionId: string, name: string) => {
    setUploading(true);
    toast({
      title: "Analysis queued",
      description: `Session ${sessionId} · “${name}” is processing.`,
    });
    // Refresh the list and select the new session after a short beat.
    setTimeout(async () => {
      await loadSessions();
      setSelectedId(sessionId);
      setUploading(false);
    }, 1200);
  };

  const ticks = framesToTicks(frames);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-mono text-xl font-bold sm:text-2xl">
            <Film className="size-5 text-emerald-400" /> Sessions
          </h1>
          <p className="text-sm text-muted-foreground">
            recorded runs, clip uploads, and full replays
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadSessions} disabled={loadingSessions}>
          <RefreshCw className={`mr-1.5 size-3.5 ${loadingSessions ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <UploadForm onUploaded={handleUploaded} />
        </div>
        <div className="lg:col-span-2">
          <SessionTable
            sessions={sessions}
            loading={loadingSessions || uploading}
            onSelect={setSelectedId}
            selectedId={selectedId ?? undefined}
          />
        </div>
      </div>

      {selectedId ? (
        <motion.div
          key={selectedId}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="space-y-5"
        >
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)}>
              <ArrowLeft className="mr-1.5 size-3.5" /> Back to list
            </Button>
            <Badge variant="outline" className="font-mono text-xs">
              {selectedId}
            </Badge>
          </div>
          <SessionSummary summary={summary} loading={loadingDetail} />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Replay graphs</CardTitle>
              <CardDescription>
                same views as live — pulled from stored frames
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {frames.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {loadingDetail ? "Loading frames…" : "No frames for this session."}
                </p>
              ) : (
                <>
                  <ChaosChart ticks={ticks} />
                  <SensorCharts ticks={ticks} />
                  <div className="grid gap-5 xl:grid-cols-2">
                    <FusionChart ticks={ticks} />
                    <TrustChart ticks={ticks} />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <ClipboardList className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Select a run to view its summary and replay graphs.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default SessionsView;
