import { NextResponse } from "next/server";
import { warmup } from "@/lib/server/qvac";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Hit this off-camera before recording so QVAC's model is resident (no cold-start stall on capture).
export async function GET() {
  const t0 = Date.now();
  try {
    const modelId = await warmup();
    return NextResponse.json({ warm: true, modelId, ms: Date.now() - t0 });
  } catch (e) {
    return NextResponse.json({ warm: false, error: e instanceof Error ? e.message : String(e) });
  }
}
