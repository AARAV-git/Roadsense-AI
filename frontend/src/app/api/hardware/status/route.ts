import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function GET() {
  const r = await fetch(`${API}/api/hardware/status`, { cache: "no-store" });
  if (!r.ok) return NextResponse.json(null, { status: 200 });
  return NextResponse.json(await r.json());
}
