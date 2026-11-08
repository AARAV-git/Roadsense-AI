import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const qs = new URLSearchParams();
  if (searchParams.has("session_id")) qs.set("session_id", searchParams.get("session_id")!);
  if (searchParams.has("limit")) qs.set("limit", searchParams.get("limit")!);
  const r = await fetch(`${API}/api/alerts?${qs.toString()}`, { cache: "no-store" });
  if (!r.ok) return NextResponse.json([], { status: 200 });
  const raw = await r.json();
  const normalized = (Array.isArray(raw) ? raw : []).map((item: any) => ({
    id: String(item.id),
    session_id: String(item.session_id ?? ""),
    session_name: item.session_id ? `Session #${item.session_id}` : "Live",
    t: item.t ?? item.created_at ?? new Date().toISOString(),
    type: item.type ?? item.alert_type ?? "low_confidence",
    alert_type: item.alert_type ?? item.type ?? "low_confidence",
    explanation: item.explanation ?? "",
    chaos_score: item.chaos_score ?? 0,
    trust_weight: item.trust_weight ?? 1,
    final_conf: item.final_conf ?? item.final_confidence ?? 1,
    agree: item.agree ?? true,
  }));
  return NextResponse.json(normalized);
}
