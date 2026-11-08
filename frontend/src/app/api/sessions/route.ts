import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function GET() {
  const r = await fetch(`${API}/api/sessions`, { cache: "no-store" });
  if (!r.ok) return NextResponse.json([], { status: 200 });
  const raw = await r.json();
  const normalized = (Array.isArray(raw) ? raw : []).map((s: any) => {
    const started = s.started_at ? new Date(s.started_at).getTime() : Date.now();
    const ended = s.ended_at ? new Date(s.ended_at).getTime() : Date.now();
    const duration = Math.max(0, Math.round((ended - started) / 1000));
    return {
      id: String(s.id),
      name: s.name || `Session #${s.id}`,
      status: s.status || "completed",
      started_at: s.started_at || new Date().toISOString(),
      ended_at: s.ended_at || null,
      duration_s: s.duration_s ?? duration,
      clip_name: s.clip_name || s.source || "camera stream",
      avg_chaos: s.avg_chaos ?? 0,
      alert_count: s.alert_count ?? 0,
      avg_trust_weight: s.avg_trust_weight ?? 1,
    };
  });
  return NextResponse.json(normalized);
}
