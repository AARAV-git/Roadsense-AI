import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const r = await fetch(`${API}/api/sessions/${params.id}`, { cache: "no-store" });
  if (!r.ok) return NextResponse.json(null, { status: r.status });
  return NextResponse.json(await r.json());
}
