import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Keep-warm endpoint for the hot authenticated runtime.
 *
 * Hit by Vercel Cron at a short interval (see vercel.json) so the shared
 * serverless Node runtime, the Supabase admin client's connection pool, and
 * the PostgREST HTTP connection all stay warm between bursts of jeweller
 * traffic. When the first request of the day lands on /dashboard, the
 * shared TLS handshake + pool warm-up has already been paid by this cron,
 * shaving ~200-500 ms off the cold edge.
 *
 * What this does:
 * - Exercises `createAdminClient()` so the module graph stays loaded and
 *   the service-role HTTP client keeps its keep-alive socket to Supabase.
 * - Runs a trivial `SELECT id FROM tenants LIMIT 1` — no tenant data is
 *   returned to the caller (we only log the timing).
 * - Returns `{ ok, at, dbMs, runtimeMs }` — no business data leaks.
 *
 * What this does NOT do:
 * - Directly warm each route's serverless function. Each Next.js route is
 *   its own function on Vercel; this warms the *shared* runtime + DB pool
 *   that all of them use. Per-route function prewarm would need Vercel
 *   Fluid Compute / provisioned concurrency (plan-level).
 *
 * Safety:
 * - Public, no auth. Idempotent. No mutations. No sensitive data in the
 *   response body. Supabase RLS is untouched (admin client is used only to
 *   run a 1-row `LIMIT 1` query whose result is discarded).
 * - Uses the Node runtime explicitly so the warm target matches the
 *   runtime that /dashboard, /customers, /repairs etc. run on.
 */

export async function GET() {
  const runtimeStart = Date.now();

  try {
    const admin = createAdminClient();
    const dbStart = Date.now();
    // 1-row ping. Result is intentionally discarded.
    await admin.from("tenants").select("id").limit(1);
    const dbMs = Date.now() - dbStart;

    return NextResponse.json(
      {
        ok: true,
        at: new Date().toISOString(),
        dbMs,
        runtimeMs: Date.now() - runtimeStart,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        at: new Date().toISOString(),
        error: err instanceof Error ? err.message : "warm failed",
        runtimeMs: Date.now() - runtimeStart,
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}

// Support HEAD for cheaper pings if ever needed.
export { GET as HEAD };
