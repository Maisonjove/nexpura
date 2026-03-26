import { NextRequest, NextResponse } from "next/server";
import { runOverdueAutomation } from "@/lib/invoices/overdue-automation";
import logger from "@/lib/logger";

// Called daily by Vercel cron or external scheduler
// vercel.json: { "crons": [{ "path": "/api/cron/overdue-invoices", "schedule": "0 8 * * *" }] }
export async function GET(req: NextRequest) {
  // Basic auth check - require CRON_SECRET env var
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    logger.error("CRON_SECRET env var not configured", { route: "cron/overdue-invoices" });
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runOverdueAutomation();
    return NextResponse.json({
      success: true,
      sent: result.sent,
      errors: result.errors,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error("Cron job failed", { route: "cron/overdue-invoices", error: err });
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}
