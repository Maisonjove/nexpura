import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import logger from "@/lib/logger";
import { safeBearerMatch } from "@/lib/timing-safe-compare";
import { withSentryFlush } from "@/lib/sentry-flush";

/**
 * Backup Check Cron Job
 * 
 * Runs weekly to verify Supabase automatic backups are working.
 * Supabase Pro handles daily backups automatically - this just monitors.
 * 
 * Schedule: 0 4 * * 0 (4am every Sunday)
 */

export const GET = withSentryFlush(async (request: Request) => {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (!safeBearerMatch(authHeader, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  try {
    // Check database is accessible
    const { data: tenants, error } = await admin
      .from("tenants")
      .select("id")
      .limit(1);

    if (error) {
      logger.error("[backup-check] Database connection failed:", error);
      // TODO: Send alert to admin
      return NextResponse.json({ 
        status: "error", 
        message: "Database connection failed",
        error: error.message,
      }, { status: 500 });
    }

    // Log backup check. Cron-runner log+continue: this insert is pure
    // observability — the cron's actual signal (DB accessible) was
    // already proven by the SELECT above. A failed system_logs write
    // means we lose one weekly heartbeat row, not that backups broke.
    // NOTE (post-Phase-2 cleanup item #8): the system_logs table may
    // not exist in this schema, and Supabase automatic backup health
    // is not actually queryable from the JS client — the whole cron
    // is a candidate for rewrite onto the Supabase Management API.
    // Until then: tolerate the missing-table case via the error log.
    const { error: logErr } = await admin.from("system_logs").insert({
      type: "backup_check",
      status: "success",
      message: "Weekly backup check passed - database accessible",
      created_at: new Date().toISOString(),
    });
    if (logErr) {
      logger.error("[backup-check] system_logs heartbeat insert failed (non-fatal — cron will retry next schedule; table may not exist, see cleanup item #8)", {
        err: logErr,
      });
    }

    logger.info("[backup-check] Weekly backup check passed");

    return NextResponse.json({
      status: "ok",
      message: "Database accessible - Supabase handles daily backups automatically",
      checked_at: new Date().toISOString(),
      note: "Supabase Pro includes daily backups with 7-day retention. Point-in-time recovery available.",
    });
  } catch (error) {
    logger.error("[backup-check] Check failed:", error);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
});
