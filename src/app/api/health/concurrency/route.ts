import { NextResponse } from "next/server";
import { checkIdempotencyHealth } from "@/lib/idempotency";

export const runtime = 'edge';

export async function GET() {
  // Minimal health check - do not expose implementation details
  const idempotencyHealth = await checkIdempotencyHealth();
  
  const checks = {
    status: idempotencyHealth.healthy ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(checks, {
    headers: {
      'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
    },
  });
}
