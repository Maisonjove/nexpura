import { NextRequest, NextResponse } from "next/server";
import { runOverdueAutomation } from "@/lib/invoices/overdue-automation";

// Called daily by Vercel cron or external scheduler
// vercel.json: { "crons": [{ "path": "/api/cron/overdue-invoices", "schedule": "0 8 * * *" }] }
export async function GET(req: NextRequest) {
  // Basic auth check
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || "nexpura-cron-2026";
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
    console.error("[cron/overdue-invoices] Error:", err);
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}
