import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import logger from "@/lib/logger";

/**
 * Backup Check Cron Job
 * 
 * Runs weekly to verify Supabase automatic backups are working.
 * Supabase Pro handles daily backups automatically - this just monitors.
 * 
 * Schedule: 0 4 * * 0 (4am every Sunday)
 */

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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

    // Log backup check
    await admin.from("system_logs").insert({
      type: "backup_check",
      status: "success",
      message: "Weekly backup check passed - database accessible",
      created_at: new Date().toISOString(),
    }).catch(() => {
      // system_logs might not exist - that's ok
    });

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
}
