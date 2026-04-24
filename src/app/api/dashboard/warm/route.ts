/**
 * GET /api/dashboard/warm — Edge-runtime keep-warm ping.
 *
 * Vercel cron hits this every 5 minutes so the Edge function's
 * module graph + outbound fetch pool stay warm. The sibling
 * /api/dashboard/stats route (same Edge runtime) benefits from the
 * shared warm state on a cold first-user-of-the-day dashboard open.
 *
 * No auth. No side effects. Returns { ok, at } and nothing else — the
 * body is a liveness signal only, never consumed by the app.
 */

import { NextResponse } from "next/server";

export const runtime = "edge";

export async function GET() {
  return NextResponse.json(
    { ok: true, at: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export { GET as HEAD };
