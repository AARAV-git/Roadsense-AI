import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const seconds = searchParams.get("seconds") ?? "60";
  const r = await fetch(`${API}/api/sensors/history?seconds=${seconds}`, {
    cache: "no-store",
  });
  if (!r.ok) return NextResponse.json([], { status: 200 });
  const list = await r.json();
  if (Array.isArray(list)) {
    for (const item of list) {
      if (item && item.gps_fix === undefined) {
        item.gps_fix = item.gps_status === "fix";
      }
    }
  }
  return NextResponse.json(list);
}
