import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  // Forward to FastAPI: POST /api/analysis/live with ?camera=<source>
  const camera = (body?.camera as string) ?? "0";
  const name = (body?.name as string) ?? `Live run ${new Date().toLocaleTimeString("en-IN")}`;
  const r = await fetch(`${API}/api/analysis/live?camera=${encodeURIComponent(camera)}&name=${encodeURIComponent(name)}`, {
    method: "POST",
    cache: "no-store",
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: "backend error" }));
    return NextResponse.json(err, { status: r.status });
  }
  return NextResponse.json(await r.json(), { status: 201 });
}
