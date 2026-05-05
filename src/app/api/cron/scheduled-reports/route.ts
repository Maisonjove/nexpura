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
import { safeBearerMatch } from "@/lib/timing-safe-compare";
import logger from "@/lib/logger";
import { withSentryFlush } from "@/lib/sentry-flush";

export const GET = withSentryFlush(async (req: NextRequest) => {
  // W4-APR2 / fail-closed contract: when CRON_SECRET is unset we MUST NOT
  // return 200 — the previous handler would cheerfully respond "ok" to
  // any anonymous caller in that branch. Now: 503 when misconfigured,
  // 401 when the bearer mismatches, and constant-time compare.
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    logger.error("[scheduled-reports] CRON_SECRET env var not configured — refusing");
    return NextResponse.json({ error: "Cron not configured" }, { status: 503 });
  }
  if (!safeBearerMatch(authHeader, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  const admin = createAdminClient();

  try {
    // Get all active scheduled reports that are due.
    //
    // half-fix-pair: cron-iterates-tenants family (cleanup #23 + #29-32,
    // see docs/CONTRIBUTING.md §13). Sibling lifecycle crons
    // (grace-period-checker / trial-end-checker / process-tenant-deletions)
    // already gate on `tenants.deleted_at IS NULL`; without the same
    // gate here, a wound-down tenant with an active scheduled_reports
    // row would keep emailing CSV data dumps to saved recipients
    // post-deletion. Switch the join to `tenants!inner(...)` and add
    // the deleted_at filter — same shape as the other crons.
    const now = new Date();
    const { data: dueReports, error } = await admin
      .from("scheduled_reports")
      .select("*, tenants!inner(name, business_name, email, currency, timezone, deleted_at)")
      .eq("is_active", true)
      .is("tenants.deleted_at", null)
      .lte("next_run_at", now.toISOString())
      .limit(50);

    if (error) {
      logger.error("[scheduled-reports] Failed to fetch due reports:", error);
      return NextResponse.json({ success: true, message: "Skipped: DB query error", processed: 0 }, { status: 200 });
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

        const tenant = report.tenants as { name: string; business_name: string; email: string; deleted_at: string | null } | null;
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

        // Log execution. Cron-runner log+continue: scheduled_report_logs
        // is observability — it's the audit trail of "did this report
        // actually fire?". A missing log row means we lose forensics
        // for THIS run only. The actual emails already left the
        // outbound queue above; we still need to advance next_run_at
        // below, so do not abort the loop iteration here.
        const { error: logInsertErr } = await admin.from("scheduled_report_logs").insert({
          tenant_id: report.tenant_id,
          scheduled_report_id: report.id,
          status: failedCount === 0 ? "success" : failedCount < recipients.length ? "partial" : "failed",
          recipients_sent: sentCount,
          recipients_failed: failedCount,
          execution_time_ms: Date.now() - reportStartTime,
        });
        if (logInsertErr) {
          logger.error("[scheduled-reports] scheduled_report_logs insert failed (non-fatal — emails already sent, audit row lost)", {
            tenantId: report.tenant_id, scheduledReportId: report.id, err: logInsertErr,
          });
        }

        // Update last_sent_at and next_run_at. Cron-runner log+continue:
        // if this fails, next_run_at stays in the past and the report
        // will be picked up again on the next cron tick (and re-sent —
        // duplicate emails). Worth surfacing loudly via Sentry, but not
        // worth aborting the rest of the dueReports loop, since the
        // other tenants' reports are independent.
        const { error: schedUpdateErr } = await admin.from("scheduled_reports").update({
          last_sent_at: now.toISOString(),
          next_run_at: calculateNextRunTime(report.schedule_type, report.schedule_day, report.schedule_time),
        }).eq("id", report.id);
        if (schedUpdateErr) {
          logger.error("[scheduled-reports] scheduled_reports next_run_at update failed (non-fatal — next cron tick will re-send report; duplicate-email risk)", {
            tenantId: report.tenant_id, scheduledReportId: report.id, err: schedUpdateErr,
          });
        }

        processed++;
      } catch (reportErr) {
        logger.error(`[scheduled-reports] Failed to generate report ${report.id}:`, reportErr);

        // Log failure. Cron-runner log+continue: this is the FAILURE
        // branch of the audit trail. If THIS insert also fails we have
        // no record at all that the report tried to run — but the outer
        // catch block already logged the original generator error to
        // Sentry, so at least the primary failure is captured. Don't
        // abort the loop; advance next_run_at below and move to the
        // next due report.
        const { error: failLogErr } = await admin.from("scheduled_report_logs").insert({
          tenant_id: report.tenant_id,
          scheduled_report_id: report.id,
          status: "failed",
          error_message: reportErr instanceof Error ? reportErr.message : "Unknown error",
          execution_time_ms: Date.now() - reportStartTime,
        });
        if (failLogErr) {
          logger.error("[scheduled-reports] failure-branch log insert failed (non-fatal — primary report error already logged above)", {
            tenantId: report.tenant_id, scheduledReportId: report.id, err: failLogErr,
          });
        }

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
});

async function updateNextRunTime(admin: ReturnType<typeof createAdminClient>, report: { id: string; schedule_type: string; schedule_day: number | null; schedule_time: string | null }) {
  // Cron-runner log+continue: helper called from two paths — the
  // no-recipients skip and the generator-failure branch. In both
  // cases we want to advance next_run_at so the report doesn't get
  // re-picked next tick. If THIS update fails, we'll just re-pick
  // and re-fail next tick (no duplicate emails in those branches —
  // either no recipients, or the generator threw before sending).
  // Surface via Sentry but don't abort the outer dueReports loop.
  const { error: updateErr } = await admin.from("scheduled_reports").update({
    next_run_at: calculateNextRunTime(report.schedule_type, report.schedule_day, report.schedule_time),
  }).eq("id", report.id);
  if (updateErr) {
    logger.error("[scheduled-reports] updateNextRunTime helper failed (non-fatal — report will be re-picked next cron tick)", {
      tenantId: undefined, scheduledReportId: report.id, err: updateErr,
    });
  }
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
