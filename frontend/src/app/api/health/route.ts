import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const BOOT = Date.now();

export async function GET() {
  try {
    const r = await fetch(`${API}/api/health`, { cache: "no-store" });
    if (!r.ok) throw new Error("backend not ok");
    return NextResponse.json(await r.json());
  } catch {
    // Backend is down — return a minimal degraded response so the UI shows "offline"
    return NextResponse.json(
      { status: "ok", version: "0.4.2", uptime_s: Math.floor((Date.now() - BOOT) / 1000) },
      { status: 200 },
    );
  }
}
