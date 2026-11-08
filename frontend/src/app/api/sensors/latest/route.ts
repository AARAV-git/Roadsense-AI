import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function GET() {
  const r = await fetch(`${API}/api/sensors/latest`, { cache: "no-store" });
  if (!r.ok) return NextResponse.json(null, { status: 200 });
  const data = await r.json();
  const reading = data?.reading ?? (data?.id ? data : null);
  if (reading) {
    if (reading.gps_fix === undefined) {
      reading.gps_fix = reading.gps_status === "fix";
    }
  }
  return NextResponse.json(reading);
}
