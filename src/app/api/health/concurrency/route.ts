import { NextResponse } from "next/server";
import { connection } from "next/server";
import { checkIdempotencyHealth } from "@/lib/idempotency";

/**
 * /api/health/concurrency — third route-by-route cacheComponents
 * migration. Page template was /settings/tags; API-route template was
 * /api/check-subdomain. This one confirms both:
 *
 *   1. The same `await connection()` one-line API-route pattern is
 *      sufficient for GET handlers that don't read request.headers
 *      but DO make async server-side calls (Supabase / Redis / etc.).
 *
 *   2. Cache Components does NOT support `runtime: 'edge'` — per the
 *      official migration guide:
 *        "Not supported. Cache Components requires the Node.js runtime.
 *         Switch to the Node.js runtime (the default) by removing the
 *         `runtime = 'edge'` export."
 *
 * BLOCKER (pre-migration), from the 40cf0d0 build log:
 *
 *   Route segment config "runtime" is not compatible with
 *   `nextConfig.cacheComponents`. Please remove it.
 *     > export const runtime = 'edge';
 *
 *   AND separately, at prerender:
 *     Idempotency lock error:
 *       "Error: During prerendering, fetch() rejects when the prerender
 *        is complete. ... This occurred at route
 *        /api/health/concurrency."
 *     Metrics error: digest NEXT_PRERENDER_INTERRUPTED
 *
 * The fetch-after-prerender comes from `checkIdempotencyHealth()`,
 * which internally hits Supabase for a test-acquire/release of an
 * idempotency lock. Under CC's prerender attempt that async fetch is
 * still pending when Next.js finalises the prerender — the fetch then
 * rejects "in a different context", causing the HANGING_PROMISE noise
 * and (more importantly) breaking the build.
 *
 * FIX (both parts, combined in one commit because neither works alone):
 *
 *   1. Delete `export const runtime = 'edge';`. CC requires Node.js.
 *      The handler uses `checkIdempotencyHealth()` which goes to
 *      Supabase Sydney — edge runtime was not buying us anything here
 *      (the backend request is Sydney-bound regardless of PoP) so the
 *      removal has no observable performance cost.
 *
 *   2. Add `await connection()` from `next/server` as the first
 *      statement of GET. Prevents prerender attempt — under CC the
 *      promise never resolves during build; at request time it
 *      resolves immediately and the handler runs normally.
 *
 * Same pattern as /api/check-subdomain, reaffirmed. Use this as the
 * template for /api/warm + the remaining health-ish routes.
 */

export async function GET() {
  // CC-migration marker: defer to request time. Prevents the prerender
  // pipeline from evaluating the body and firing an unowned Supabase
  // fetch that rejects post-prerender. Under the current model this is
  // a no-op (resolves immediately during real request rendering).
  await connection();

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
