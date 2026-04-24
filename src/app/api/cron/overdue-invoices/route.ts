import { NextRequest, NextResponse } from "next/server";
import { runOverdueAutomation } from "@/lib/invoices/overdue-automation";
import { safeBearerMatch } from "@/lib/timing-safe-compare";
import logger from "@/lib/logger";

// Called daily by Vercel cron or external scheduler
// vercel.json: { "crons": [{ "path": "/api/cron/overdue-invoices", "schedule": "0 8 * * *" }] }
export async function GET(req: NextRequest) {
  // Constant-time bearer compare — previously this was a raw string
  // equality, which is timing-leakable byte-by-byte over repeated
  // probes against a responsive endpoint.
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    logger.error("CRON_SECRET env var not configured", { route: "cron/overdue-invoices" });
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  if (!safeBearerMatch(authHeader, cronSecret)) {
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
