/**
 * Overdue Invoice Email Automation
 * 
 * Called daily (e.g., from a cron endpoint) to send reminder emails
 * for overdue invoices according to the sequence below.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { resend } from "@/lib/email/resend";
import logger from "@/lib/logger";

interface OverdueSequenceStep {
  days: number;
  subject: string;
  urgency: "mild" | "medium" | "high" | "final";
}

export const OVERDUE_SEQUENCE: OverdueSequenceStep[] = [
  { days: 1,  subject: "Invoice #{number} is now due",                    urgency: "mild"   },
  { days: 7,  subject: "Reminder: Invoice #{number} is overdue",          urgency: "medium" },
  { days: 14, subject: "Second reminder: Invoice #{number} is overdue",   urgency: "high"   },
  { days: 30, subject: "Final notice: Invoice #{number} — action required", urgency: "final" },
];

/**
 * Run the overdue email automation for all tenants.
 * Should be called once per day.
 */
export async function runOverdueAutomation(): Promise<{ sent: number; errors: number }> {
  const admin = createAdminClient();
  let sent = 0;
  let errors = 0;

  // Get all overdue invoices that are unpaid/partial, with customer email
  const today = new Date().toISOString().split("T")[0];
  const { data: invoices, error } = await admin
    .from("invoices")
    .select(`
      id, invoice_number, total, amount_paid, due_date, 
      overdue_reminder_sent_at, tenant_id,
      customers(id, full_name, email, marketing_consent),
      tenants(id, name, overdue_reminders_enabled)
    `)
    .in("status", ["unpaid", "partial"])
    .lt("due_date", today)
    .not("due_date", "is", null);

  if (error || !invoices) return { sent, errors };

  for (const invoice of invoices) {
    try {
      const tenant = Array.isArray(invoice.tenants) ? invoice.tenants[0] : invoice.tenants as any;
      const customer = Array.isArray(invoice.customers) ? invoice.customers[0] : invoice.customers as any;

      // Check if tenant has overdue reminders enabled
      if (tenant?.overdue_reminders_enabled === false) continue;

      // Must have customer email
      if (!customer?.email) continue;

      const dueDate = new Date(invoice.due_date!);
      const daysPastDue = Math.floor((Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysPastDue <= 0) continue;

      // Check which reminders have been sent
      const sentAt: Record<string, string> = (invoice.overdue_reminder_sent_at as any) || {};

      // Find the next step to send
      for (const step of OVERDUE_SEQUENCE) {
        const stepKey = `day_${step.days}`;
        if (daysPastDue >= step.days && !sentAt[stepKey]) {
          // Send this reminder
          const subject = step.subject.replace("{number}", invoice.invoice_number);
          const emailResult = await sendOverdueEmail({
            toEmail: customer.email,
            toName: customer.full_name,
            tenantName: tenant?.name || "Your supplier",
            invoiceNumber: invoice.invoice_number,
            total: invoice.total,
            amountPaid: invoice.amount_paid || 0,
            dueDate: invoice.due_date!,
            daysPastDue,
            subject,
            urgency: step.urgency,
          });

          if (emailResult.success) {
            // Record that this step was sent
            const updatedSentAt = { ...sentAt, [stepKey]: new Date().toISOString() };
            await admin
              .from("invoices")
              .update({ overdue_reminder_sent_at: updatedSentAt })
              .eq("id", invoice.id);
            sent++;
          } else {
            errors++;
          }

          // Only send one email per invoice per run
          break;
        }
      }
    } catch (err) {
      logger.error("Overdue automation error for invoice", { invoiceId: invoice.id, error: err });
      errors++;
    }
  }

  return { sent, errors };
}

async function sendOverdueEmail(params: {
  toEmail: string;
  toName: string;
  tenantName: string;
  invoiceNumber: string;
  total: number;
  amountPaid: number;
  dueDate: string;
  daysPastDue: number;
  subject: string;
  urgency: "mild" | "medium" | "high" | "final";
}): Promise<{ success: boolean }> {
  const { toEmail, toName, tenantName, invoiceNumber, total, amountPaid, dueDate, daysPastDue, subject, urgency } = params;
  const outstanding = total - amountPaid;
  const currencySymbol = "$";

  const urgencyColor = {
    mild: "#0ea5e9",
    medium: "#f59e0b",
    high: "#ef4444",
    final: "#7f1d1d",
  }[urgency];

  const urgencyMessage = {
    mild: "This is a friendly reminder that your invoice is now due.",
    medium: "Your invoice is now 7 days overdue. Please arrange payment at your earliest convenience.",
    high: "Your invoice is 2 weeks overdue. Please make payment immediately to avoid further action.",
    final: "This is a final notice. Your invoice is 30 days overdue. Immediate payment is required.",
  }[urgency];

  try {
    await resend.emails.send({
      from: `${tenantName} <noreply@nexpura.com>`,
      to: toEmail,
      subject,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <div style="background: ${urgencyColor}; color: white; padding: 16px 20px; border-radius: 10px; margin-bottom: 24px;">
            <strong style="font-size: 16px;">Invoice #${invoiceNumber} — ${daysPastDue} day${daysPastDue !== 1 ? "s" : ""} overdue</strong>
          </div>
          
          <p style="color: #44403c; line-height: 1.6;">Hi ${toName || "there"},</p>
          <p style="color: #44403c; line-height: 1.6;">${urgencyMessage}</p>
          
          <div style="background: #fafaf9; border: 1px solid #e7e5e4; border-radius: 10px; padding: 16px; margin: 24px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; color: #78716c; font-size: 14px;">Invoice Number</td>
                <td style="padding: 6px 0; text-align: right; font-size: 14px; font-weight: 600; color: #1c1917;">#${invoiceNumber}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #78716c; font-size: 14px;">Due Date</td>
                <td style="padding: 6px 0; text-align: right; font-size: 14px; color: #ef4444;">${new Date(dueDate).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}</td>
              </tr>
              ${amountPaid > 0 ? `
              <tr>
                <td style="padding: 6px 0; color: #78716c; font-size: 14px;">Paid</td>
                <td style="padding: 6px 0; text-align: right; font-size: 14px; color: #10b981;">${currencySymbol}${amountPaid.toFixed(2)}</td>
              </tr>` : ""}
              <tr style="border-top: 1px solid #e7e5e4;">
                <td style="padding: 10px 0 6px; color: #1c1917; font-weight: 600;">Outstanding</td>
                <td style="padding: 10px 0 6px; text-align: right; font-size: 18px; font-weight: 700; color: #1c1917;">${currencySymbol}${outstanding.toFixed(2)}</td>
              </tr>
            </table>
          </div>
          
          <p style="color: #44403c; font-size: 14px; line-height: 1.6;">
            Please contact us if you have any questions or need to arrange a payment plan.
          </p>
          
          <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 24px 0;" />
          <p style="color: #78716c; font-size: 12px;">${tenantName} — Powered by Nexpura</p>
        </div>
      `,
    });
    return { success: true };
  } catch (err) {
    logger.error("Failed to send overdue email", { error: err });
    return { success: false };
  }
}
