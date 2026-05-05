/**
 * Cron: sweep stale TOTP enrolment pendings.
 *
 * /api/auth/2fa/setup mints a candidate `totp_pending_secret` plus a
 * `totp_pending_at` timestamp; /api/auth/2fa/verify consumes them on
 * successful enrolment and clears both columns.
 *
 * If the user abandons the QR-scan step (closes the tab, drops off
 * mid-flow) the pending row sits indefinitely. That's a small but
 * non-zero exposure: the unactivated secret is still on disk, and the
 * presence of a pending row blocks /setup from minting a fresh secret
 * because /setup short-circuits and re-uses the existing one
 * (intentional — to make refresh-during-enrolment idempotent).
 *
 * Resolution: every hour, clear pending pairs that are older than 10
 * minutes. The 10-minute window is generous compared to the realistic
 * QR-scan UX (sub-30s), but tolerant of slow hand-typed secret entry.
 */
import { withSentryFlush } from "@/lib/sentry-flush";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeBearerMatch } from "@/lib/timing-safe-compare";
import logger from "@/lib/logger";

// Pendings older than this are swept. Exported so the unit test can
// assert the SQL contract uses the same constant.
export const PENDING_TTL_MS = 10 * 60 * 1000;

export const GET = withSentryFlush(async (request: NextRequest) => {
  const authHeader = request.headers.get("authorization");
  if (!safeBearerMatch(authHeader, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const cutoff = new Date(Date.now() - PENDING_TTL_MS).toISOString();

    // Two-step instead of a raw SQL UPDATE so the supabase-js client can
    // give us back the swept row count (PostgREST returns the affected
    // rows by default with .select() chained on the update).
    const { data, error } = await admin
      .from("users")
      .update({
        totp_pending_secret: null,
        totp_pending_at: null,
      })
      .lt("totp_pending_at", cutoff)
      .not("totp_pending_at", "is", null)
      .select("id");

    if (error) {
      logger.error("[cron/totp-pending-sweep] update failed", { error });
      return NextResponse.json({ ok: false, error: "sweep_failed" }, { status: 500 });
    }

    const swept = data?.length ?? 0;
    return NextResponse.json({ ok: true, swept, cutoff });
  } catch (err) {
    logger.error("[cron/totp-pending-sweep] failed", { error: err });
    return NextResponse.json({ ok: false, error: "cron_failed" }, { status: 500 });
  }
});
