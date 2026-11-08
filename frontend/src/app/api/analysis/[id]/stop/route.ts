import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const r = await fetch(`${API}/api/analysis/${id}/stop`, {
    method: "POST",
    cache: "no-store",
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: "backend error" }));
    return NextResponse.json(err, { status: r.status });
  }
  return NextResponse.json(await r.json());
}
