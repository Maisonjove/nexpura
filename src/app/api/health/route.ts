import { NextResponse } from "next/server";
import { checkDatabaseHealth } from "@/lib/high-scale";
import { logger } from "@/lib/logger";

/**
 * Liveness/health endpoint for the uptime monitor and load balancers.
 *
 * Contract (post C-07):
 *   GET /api/health  → 200 OK, JSON body { ok: true, timestamp, version }
 *   HEAD /api/health → 200 OK, empty body
 *   503 ONLY if Supabase REST is genuinely unreachable.
 *
 * Why this shape:
 * - Uptime monitors check 2xx vs non-2xx. The previous handler folded a
 *   non-fatal Supabase latency wobble into a 503, which paged ops on a
 *   green stack. C-07 (QA audit, 2026-05-04) caught a 503 on prod when
 *   Supabase REST was up but slow; we now only 503 on a true reachability
 *   failure (fetch reject / network error), not on `latencyMs > X`.
 * - The body intentionally exposes only:
 *     ok        — boolean liveness signal
 *     timestamp — ISO-8601 server time (not high-res epoch; the prior
 *                 F-11 audit objected to leaking server clock for
 *                 cache-poison recon. ISO-8601 second-precision is the
 *                 same info every HTTP Date: header already carries, so
 *                 it's fine.)
 *     version   — first 12 chars of VERCEL_GIT_COMMIT_SHA. Lets the
 *                 uptime monitor correlate a 503 with a specific deploy.
 *                 Falls back to "unknown" in local dev where the env var
 *                 is absent.
 * - DB ping latency is exposed via Server-Timing header (not the body) so
 *   it doesn't grow the JSON contract — the monitor parses one shape, but
 *   ops can still see the latency in DevTools / Sentry breadcrumbs.
 *
 * Why no auth:
 * - Middleware exempts /api/health via isAlwaysPublicApiPath() in
 *   src/lib/supabase/middleware.ts. Required: the uptime monitor has no
 *   session.
 *
 * What this is NOT:
 * - Not a deep-health endpoint. Queue depth, last-cron-run, RLS sanity
 *   checks, etc. belong on /api/admin/health (gated, future work, see
 *   Section 4 #9 of the post-audit roadmap). Keeping this surface tiny
 *   means a partially-degraded background subsystem doesn't take down
 *   the uptime page.
 */

const VERSION = (process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown").slice(0, 12);

export async function GET() {
  const dbHealth = await checkDatabaseHealth();

  const headers: Record<string, string> = {
    "Cache-Control": "no-store",
    // Server-Timing surfaces the Supabase-REST round-trip without
    // contaminating the JSON contract. Clients that care can read it;
    // the uptime monitor ignores it.
    "Server-Timing": `db;dur=${dbHealth.latencyMs}`,
  };

  // Only flip to 503 on a genuine reachability failure
  // (checkDatabaseHealth returns healthy:false only when the underlying
  // fetch threw — an HTTP response, even 500, counts as "service is up
  // enough to answer", per the helper's contract). This matches what the
  // uptime monitor actually wants to know: "is the Vercel function + its
  // Supabase dependency answering at all?".
  if (!dbHealth.healthy) {
    // Page Sentry. A 503 here means the Vercel function reached the
    // Supabase REST endpoint and the underlying fetch threw (per the
    // checkDatabaseHealth contract — see lib/high-scale.ts) — that is
    // a real outage signal, not a latency wobble. logger.error forwards
    // to Sentry (see lib/logger.ts → Sentry.captureException). One log
    // per failed health check is fine; the uptime monitor only hits
    // this once a minute, so amplification risk is bounded.
    logger.error("api.health: supabase unreachable", {
      latencyMs: dbHealth.latencyMs,
      version: VERSION,
    });
    return NextResponse.json(
      { ok: false, timestamp: new Date().toISOString(), version: VERSION },
      { status: 503, headers },
    );
  }

  return NextResponse.json(
    { ok: true, timestamp: new Date().toISOString(), version: VERSION },
    { status: 200, headers },
  );
}

// Next.js does not auto-delegate HEAD to GET on the App Router, so we
// export an explicit handler. Body must be empty (HEAD spec) but headers
// match GET so HEAD-based monitors get the same Server-Timing signal.
export async function HEAD() {
  const dbHealth = await checkDatabaseHealth();
  if (!dbHealth.healthy) {
    logger.error("api.health: supabase unreachable (HEAD)", {
      latencyMs: dbHealth.latencyMs,
      version: VERSION,
    });
  }
  return new NextResponse(null, {
    status: dbHealth.healthy ? 200 : 503,
    headers: {
      "Cache-Control": "no-store",
      "Server-Timing": `db;dur=${dbHealth.latencyMs}`,
    },
  });
}
