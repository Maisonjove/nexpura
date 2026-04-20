import { NextResponse } from "next/server";
import { connection } from "next/server";
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
 *   that all of them use.
 *
 * Safety:
 * - Public, no auth. Idempotent. No mutations. No sensitive data in the
 *   response body. Supabase RLS is untouched (admin client is used only to
 *   run a 1-row `LIMIT 1` query whose result is discarded).
 *
 * ── cacheComponents migration notes ─────────────────────────────────────
 *
 * Fourth route in the route-by-route CC migration sequence. Confirms the
 * /api/check-subdomain + /api/health/concurrency pattern for a third time.
 *
 * Previous blockers (from the 40cf0d0 CC-flip build log):
 *
 *   1. `export const runtime = "nodejs"` — CC rejects ALL `runtime`
 *      segment-config exports, including `nodejs`. Node is already the
 *      default when the export is absent. Removed.
 *
 *   2. `export const dynamic = "force-dynamic"` — CC's whole point is
 *      "dynamic by default"; `force-dynamic` is a hard segment-config
 *      conflict at build time. Removed.
 *
 *   3. HANGING_PROMISE_REJECTION from the Supabase `select("id").limit(1)`
 *      ping. Same pattern as /api/health/concurrency: the handler makes
 *      an async server-side fetch at the top of its body, which is still
 *      pending when CC's prerender pipeline finalises, leading to
 *      "During prerendering, fetch() rejects when the prerender is
 *      complete."
 *
 *      Fix: `await connection()` from `next/server` as the very first
 *      statement of GET. Same one-line pattern applied on the previous
 *      two API-route migrations.
 *
 * Under the current (pre-CC) model:
 *   - `connection()` resolves immediately during real request rendering,
 *     so the handler runs identically to today.
 *   - Removing `runtime = "nodejs"` changes nothing at runtime (Node is
 *     still the default).
 *   - Removing `force-dynamic` on this specific route is safe because
 *     the handler has no request-header reads, no cookies access, and
 *     no compile-time-static data — the `await admin.from(…)` call is a
 *     Supabase network fetch that Next automatically classifies as
 *     dynamic. So the route stays effectively dynamic without the
 *     explicit export.
 */

export async function GET() {
  // CC-migration marker: defer to request time. Prevents the prerender
  // pipeline from evaluating the Supabase ping at build time. No-op
  // under the current pre-CC model.
  await connection();

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

// Support HEAD for cheaper pings if ever needed. Re-exporting GET works
// under CC too — the `await connection()` inside the body runs whether
// the method is GET or HEAD.
export { GET as HEAD };
