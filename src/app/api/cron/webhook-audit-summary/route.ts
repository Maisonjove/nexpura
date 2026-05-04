/**
 * Cron job: /api/cron/webhook-audit-summary
 *
 * Runs hourly. Counts webhook_audit_log rows by signature_status over
 * the last hour and:
 *   1. Emits a Sentry breadcrumb with the per-handler counts (always —
 *      gives a paper trail for forensic queries).
 *   2. Captures a Sentry exception (= alertable event) when the count
 *      of "tamper-attempt-shaped" rejections crosses the threshold —
 *      `invalid_signature`, `replay_attack` (future), `tampered_body`
 *      (future) > 5 events / hour.
 *
 * P2-F follow-on (Joey 2026-05-04). The webhook_audit_log table from
 * PR #129 records every webhook delivery (rejection + valid). Without
 * this cron the table accumulates rows forever but no one is notified
 * if an attacker probes our webhook endpoints — the rows are forensic-
 * after-the-fact, not preventive.
 *
 * Threshold tunable via env var WEBHOOK_TAMPER_ALERT_THRESHOLD (default
 * 5/hour). Tune higher if you start seeing legitimate noise (Stripe
 * replay buffer occasionally hits invalid_signature on retries of
 * timed-out events).
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeBearerMatch } from "@/lib/timing-safe-compare";
import * as Sentry from "@sentry/nextjs";
import logger from "@/lib/logger";

const TAMPER_STATUSES = ["invalid_signature", "replay_attack", "tampered_body"] as const;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    logger.error("[webhook-audit-summary] CRON_SECRET env var not configured — refusing");
    return NextResponse.json({ error: "Cron not configured" }, { status: 503 });
  }
  if (!safeBearerMatch(authHeader, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const threshold = Number(process.env.WEBHOOK_TAMPER_ALERT_THRESHOLD ?? "5");
  const admin = createAdminClient();

  // Group counts by (handler_name, signature_status) over the last hour.
  // Postgres aggregation done in SQL via the rest API's group-by-equivalent —
  // we pull all rows from the last hour (small set, capped by retention)
  // and aggregate in JS for portability.
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from("webhook_audit_log")
    .select("handler_name, signature_status")
    .gte("created_at", oneHourAgo);

  if (error) {
    logger.error("[webhook-audit-summary] query failed", { err: error });
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  type Row = { handler_name: string; signature_status: string };
  const rows = (data ?? []) as Row[];
  const counts: Record<string, Record<string, number>> = {};
  for (const r of rows) {
    counts[r.handler_name] = counts[r.handler_name] ?? {};
    counts[r.handler_name][r.signature_status] =
      (counts[r.handler_name][r.signature_status] ?? 0) + 1;
  }

  // Total tamper-shaped rejections across all handlers.
  let tamperCount = 0;
  for (const handler of Object.keys(counts)) {
    for (const status of TAMPER_STATUSES) {
      tamperCount += counts[handler][status] ?? 0;
    }
  }

  // Always leave a breadcrumb — gives the dashboard a per-hour pulse
  // even when nothing's wrong.
  Sentry.addBreadcrumb({
    category: "webhook-audit-summary",
    level: tamperCount > threshold ? "warning" : "info",
    message: `Last hour: ${rows.length} webhook deliveries, ${tamperCount} tamper-shaped rejections`,
    data: counts,
  });

  // If tampering threshold crossed, capture an alertable Sentry event.
  // The Sentry dashboard's project alert rules can fire pages / Slack /
  // email off these. logger.error → Sentry.captureException keeps both
  // a Vercel runtime log line + the alertable event tied to the same
  // stack frame.
  if (tamperCount > threshold) {
    const errorMsg = `[webhook-audit-summary] Tamper threshold exceeded: ${tamperCount} > ${threshold} rejections in last hour`;
    logger.error(errorMsg, {
      tamperCount,
      threshold,
      counts,
      window: "1h",
    });
  }

  return NextResponse.json({
    ok: true,
    window: "1h",
    total_deliveries: rows.length,
    tamper_count: tamperCount,
    threshold,
    breached: tamperCount > threshold,
    counts,
  });
}
