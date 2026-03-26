/**
 * Cron job: /api/cron/scheduled-reports
 * 
 * Runs periodically to send scheduled report emails.
 * Checks for reports due and generates/sends them.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTenantEmail } from "@/lib/email-sender";
import { generateReport } from "@/lib/reports/generator";
import logger from "@/lib/logger";

export async function GET(req: NextRequest) {
  // Verify cron secret - require CRON_SECRET env var
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    logger.error("[scheduled-reports] CRON_SECRET env var not configured");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  const admin = createAdminClient();

  try {
    // Get all active scheduled reports that are due
    const now = new Date();
    const { data: dueReports, error } = await admin
      .from("scheduled_reports")
      .select("*, tenants(name, business_name, email, currency, timezone)")
      .eq("is_active", true)
      .lte("next_run_at", now.toISOString())
      .limit(50);

    if (error) {
      logger.error("[scheduled-reports] Failed to fetch due reports:", error);
      return NextResponse.json({ error: "Failed to fetch reports" }, { status: 500 });
    }

    if (!dueReports?.length) {
      return NextResponse.json({ success: true, message: "No reports due", processed: 0 });
    }

    let processed = 0;
    let failed = 0;

    for (const report of dueReports) {
      const reportStartTime = Date.now();
      const recipients: string[] = (report.recipients as string[]) || [];

      if (!recipients.length) {
        // Skip reports with no recipients
        await updateNextRunTime(admin, report);
        continue;
      }

      try {
        // Generate the report
        const reportData = await generateReport(
          report.tenant_id,
          report.report_type,
          report.filters as Record<string, unknown> || {}
        );

        // Send to each recipient
        let sentCount = 0;
        let failedCount = 0;

        const tenant = report.tenants as { name: string; business_name: string; email: string } | null;
        const businessName = tenant?.business_name || tenant?.name || "Nexpura";

        for (const email of recipients) {
          try {
            await sendTenantEmail(
              { tenantId: report.tenant_id, type: "notifications" },
              {
                to: email,
                subject: `${report.name} - ${businessName}`,
                html: generateReportEmailHtml(report.name, reportData, businessName),
                attachments: report.include_csv ? [{
                  filename: `${report.name.replace(/\s+/g, "_")}_${formatDate(new Date())}.csv`,
                  content: reportData.csv || "",
                }] : undefined,
              }
            );
            sentCount++;
          } catch (emailErr) {
            logger.error(`[scheduled-reports] Failed to send to ${email}:`, emailErr);
            failedCount++;
          }
        }

        // Log execution
        await admin.from("scheduled_report_logs").insert({
          tenant_id: report.tenant_id,
          scheduled_report_id: report.id,
          status: failedCount === 0 ? "success" : failedCount < recipients.length ? "partial" : "failed",
          recipients_sent: sentCount,
          recipients_failed: failedCount,
          execution_time_ms: Date.now() - reportStartTime,
        });

        // Update last_sent_at and next_run_at
        await admin.from("scheduled_reports").update({
          last_sent_at: now.toISOString(),
          next_run_at: calculateNextRunTime(report.schedule_type, report.schedule_day, report.schedule_time),
        }).eq("id", report.id);

        processed++;
      } catch (reportErr) {
        logger.error(`[scheduled-reports] Failed to generate report ${report.id}:`, reportErr);
        
        // Log failure
        await admin.from("scheduled_report_logs").insert({
          tenant_id: report.tenant_id,
          scheduled_report_id: report.id,
          status: "failed",
          error_message: reportErr instanceof Error ? reportErr.message : "Unknown error",
          execution_time_ms: Date.now() - reportStartTime,
        });

        // Still update next_run_at to avoid repeated failures
        await updateNextRunTime(admin, report);
        failed++;
      }
    }

    return NextResponse.json({
      success: true,
      processed,
      failed,
      duration_ms: Date.now() - startTime,
    });
  } catch (err) {
    logger.error("[scheduled-reports] Cron error:", err);
    return NextResponse.json({ error: "Cron job failed" }, { status: 500 });
  }
}

async function updateNextRunTime(admin: ReturnType<typeof createAdminClient>, report: { id: string; schedule_type: string; schedule_day: number | null; schedule_time: string | null }) {
  await admin.from("scheduled_reports").update({
    next_run_at: calculateNextRunTime(report.schedule_type, report.schedule_day, report.schedule_time),
  }).eq("id", report.id);
}

function calculateNextRunTime(
  scheduleType: string,
  scheduleDay: number | null,
  scheduleTime: string | null
): string {
  const now = new Date();
  const [hours, minutes] = (scheduleTime || "09:00").split(":").map(Number);
  
  const next = new Date(now);
  next.setHours(hours, minutes, 0, 0);

  switch (scheduleType) {
    case "daily":
      // Next day if already past scheduled time today
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
      break;

    case "weekly":
      const targetDay = scheduleDay ?? 1; // Default to Monday
      const currentDay = next.getDay();
      let daysUntil = targetDay - currentDay;
      if (daysUntil <= 0 || (daysUntil === 0 && next <= now)) {
        daysUntil += 7;
      }
      next.setDate(next.getDate() + daysUntil);
      break;

    case "monthly":
      const targetDate = scheduleDay ?? 1;
      next.setDate(targetDate);
      // If already past this month's date, move to next month
      if (next <= now) {
        next.setMonth(next.getMonth() + 1);
      }
      // Handle months with fewer days
      if (next.getDate() !== targetDate) {
        next.setDate(0); // Last day of previous month
      }
      break;
  }

  return next.toISOString();
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function generateReportEmailHtml(
  reportName: string,
  reportData: { summary: Record<string, unknown>; html?: string },
  businessName: string
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #b45309 0%, #92400e 100%); color: white; padding: 24px; border-radius: 8px 8px 0 0; }
    .content { background: #fff; padding: 24px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 8px 8px; }
    .summary { background: #f9fafb; padding: 16px; border-radius: 6px; margin: 16px 0; }
    .summary-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e5e5; }
    .summary-item:last-child { border-bottom: none; }
    .footer { text-align: center; color: #666; font-size: 12px; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 24px;">${reportName}</h1>
      <p style="margin: 8px 0 0; opacity: 0.9;">${businessName}</p>
    </div>
    <div class="content">
      <p>Here is your scheduled report for ${formatDate(new Date())}.</p>
      
      <div class="summary">
        <h3 style="margin: 0 0 12px;">Summary</h3>
        ${Object.entries(reportData.summary || {}).map(([key, value]) => `
          <div class="summary-item">
            <span>${formatKey(key)}</span>
            <strong>${formatValue(value)}</strong>
          </div>
        `).join("")}
      </div>

      ${reportData.html || "<p>See attached CSV for detailed data.</p>"}
      
      <p style="color: #666; font-size: 14px; margin-top: 24px;">
        This is an automated report. You can manage your scheduled reports in Settings → Reports.
      </p>
    </div>
    <div class="footer">
      <p>Sent by Nexpura • <a href="https://nexpura.com">nexpura.com</a></p>
    </div>
  </div>
</body>
</html>
  `;
}

function formatKey(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function formatValue(value: unknown): string {
  if (typeof value === "number") {
    return value.toLocaleString();
  }
  return String(value);
}
