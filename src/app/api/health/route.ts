import { NextResponse } from "next/server";
import { hasDatabaseUrl } from "@/lib/db/neon";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ neon: hasDatabaseUrl() });
}
