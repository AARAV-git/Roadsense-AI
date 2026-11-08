import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** One-click start for Redmi Note 8 Pro IP-Webcam stream */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const urlParam = body?.url ? `?url=${encodeURIComponent(body.url)}` : "";
  const r = await fetch(`${API}/api/analysis/phone-camera${urlParam}`, {
    method: "POST",
    cache: "no-store",
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: "backend error" }));
    return NextResponse.json(err, { status: r.status });
  }
  return NextResponse.json(await r.json(), { status: 201 });
}
