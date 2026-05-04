/**
 * /api/cron/fx-refresh
 *
 * Phase 1.5 post-audit (Joey 2026-05-03 directive). Daily 02:00 UTC.
 *
 * Fetches latest FX rates from Frankfurter (api.frankfurter.dev,
 * ECB-sourced, free, no API key) for the 4 currencies the platform
 * supports (AUD/USD/GBP/EUR), then writes one row per ordered pair
 * into fx_rates. Source-of-truth for the "≈ A$X total (FX rates
 * updated daily)" line on /admin/revenue.
 *
 * (Original spec named exchangerate.host — they moved to a paid-key
 * model in 2025; Frankfurter is the closest free no-key replacement
 * and is ECB-backed which is appropriate for monthly FX averages.)
 *
 * Auth: bearer match against CRON_SECRET (same convention as the
 * other 9 vercel-managed crons).
 *
 * Failure mode: any HTTP failure on the upstream call OR any missing
 * pair in the response logs an error and returns 200 with a partial-
 * write count. The /admin/revenue UI handles staleness independently
 * (rates older than 7 days → "≈ A$— (FX rate stale)") so a missed
 * cron run is non-blocking.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeBearerMatch } from "@/lib/timing-safe-compare";
import logger from "@/lib/logger";
import { withSentryFlush } from "@/lib/sentry-flush";

const SUPPORTED = ["AUD", "USD", "GBP", "EUR"] as const;
type Currency = (typeof SUPPORTED)[number];

interface FrankfurterResponse {
  amount?: number;
  base?: string;
  date?: string;
  rates?: Record<string, number>;
}

async function fetchRatesForBase(base: Currency, targets: Currency[]): Promise<Record<string, number> | null> {
  const symbols = targets.filter((t) => t !== base).join(",");
  const url = `https://api.frankfurter.dev/v1/latest?base=${base}&symbols=${symbols}`;
  try {
    const resp = await fetch(url, {
      // Don't cache — the cron is the cache layer. Vercel's fetch cache
      // would serve a stale response if we ran twice in the same day.
      cache: "no-store",
      // 8s timeout (cron has 60s default but we want to fail fast on
      // upstream wedge so the admin client can persist whatever pairs
      // we did get).
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) {
      logger.error(`[fx-refresh] upstream ${base} returned HTTP ${resp.status}`);
      return null;
    }
    const json = (await resp.json()) as FrankfurterResponse;
    return json.rates ?? null;
  } catch (err) {
    logger.error(`[fx-refresh] upstream ${base} fetch failed:`, err);
    return null;
  }
}

export const GET = withSentryFlush(async (request: Request) => {
  const authHeader = request.headers.get("authorization");
  if (!safeBearerMatch(authHeader, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const fetchedAt = new Date().toISOString();

  type RateRow = {
    base_currency: Currency;
    target_currency: Currency;
    rate: number;
    fetched_at: string;
  };
  const rows: RateRow[] = [];
  const failures: string[] = [];

  // 4 bases × 3 targets each = 12 ordered pairs. We fetch one /latest
  // call per base (3 targets returned in one response) so 4 upstream
  // hits total.
  for (const base of SUPPORTED) {
    const rates = await fetchRatesForBase(base, [...SUPPORTED]);
    if (!rates) {
      failures.push(`base=${base}`);
      continue;
    }
    for (const target of SUPPORTED) {
      if (target === base) continue;
      const rate = rates[target];
      if (typeof rate !== "number" || rate <= 0) {
        failures.push(`${base}→${target}`);
        continue;
      }
      rows.push({ base_currency: base, target_currency: target, rate, fetched_at: fetchedAt });
    }
  }

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "All upstream fetches failed", failures },
      { status: 503 }
    );
  }

  const { error } = await admin.from("fx_rates").insert(rows);
  if (error) {
    logger.error("[fx-refresh] DB insert failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    rows_inserted: rows.length,
    expected: SUPPORTED.length * (SUPPORTED.length - 1),
    failures,
    fetched_at: fetchedAt,
  });
});
