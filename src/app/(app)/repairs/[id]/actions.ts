"use server";
import debug from "@/lib/debug";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { withIdempotency, createPaymentFingerprint } from "@/lib/idempotency";
import { sendTwilioSms } from "@/lib/twilio-sms";
import { generateDraftInvoiceNumber } from "@/lib/invoices/draft-number";
import { resend } from "@/lib/email/resend";
import logger from "@/lib/logger";
import { requireAuth } from "@/lib/auth-context";

import { flushSentry } from "@/lib/sentry-flush";
async function getAuthContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const admin = createAdminClient();
  const { data: userData } = await admin
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  if (!userData?.tenant_id) throw new Error("No tenant found");
  return { supabase, admin, userId: user.id, tenantId: userData.tenant_id };
}

async function recalcInvoice(admin: ReturnType<typeof createAdminClient>, invoiceId: string, taxRate: number) {
  const { data: items } = await admin
    .from("invoice_line_items")
    .select("quantity, unit_price")
    .eq("invoice_id", invoiceId);
  const subtotal = (items ?? []).reduce((s, i) => s + (i.quantity ?? 1) * (i.unit_price ?? 0), 0);
  const taxAmount = subtotal * taxRate;
  const total = subtotal + taxAmount;
  // Destructive — invoice totals are state-of-record (drives what
  // the customer pays). Throw on error so callers (line-item add /
  // remove server actions) catch and return the failure to the UI;
  // silent failure here would let the displayed totals drift from
  // the line-item rows.
  const { error: recalcErr } = await admin
    .from("invoices")
    .update({ subtotal, tax_amount: taxAmount, total })
    .eq("id", invoiceId);
  if (recalcErr) {
    throw new Error(`invoice totals recalc failed: ${recalcErr.message}`);
  }
}

export async function addRepairLineItem(
  repairId: string,
  tenantId: string,
  item: { description: string; qty: number; unitPrice: number; inventoryId?: string }
): Promise<{ success?: boolean; error?: string }> {
  let ctx;
  try { ctx = await getAuthContext(); } catch { return { error: "Not authenticated" }; }
  const { admin } = ctx;
  if (ctx.tenantId !== tenantId) return { error: "Unauthorized" };

  // Get or create invoice
  const { data: repairRow } = await admin.from("repairs").select("invoice_id").eq("id", repairId).eq("tenant_id", tenantId).single();
  let invoiceId = repairRow?.invoice_id ?? null;

  if (!invoiceId) {
    // Auto-create draft invoice
    const { data: inv, error: invErr } = await admin.from("invoices").insert({
      tenant_id: tenantId,
      invoice_number: generateDraftInvoiceNumber(),
      customer_id: null,
      reference_type: "repair",
      reference_id: repairId,
      status: "draft",
      invoice_date: new Date().toISOString().split("T")[0],
      subtotal: 0,
      tax_amount: 0,
      discount_amount: 0,
      total: 0,
      amount_paid: 0,
      tax_name: "GST",
      tax_rate: 0.1,
    }).select("id").single();
    if (invErr || !inv) return { error: invErr?.message ?? "Failed to create invoice" };
    invoiceId = inv.id;
    // Link customer from repair. Destructive — both updates are
    // state-of-record (links the new invoice to its customer + the
    // owning repair). Surface failure to the caller so the UI
    // doesn't claim success on a half-linked invoice.
    const { data: repairFull } = await admin.from("repairs").select("customer_id").eq("id", repairId).single();
    const { error: invLinkErr } = await admin
      .from("invoices")
      .update({ customer_id: repairFull?.customer_id })
      .eq("id", invoiceId);
    if (invLinkErr) return { error: `invoice customer-link failed: ${invLinkErr.message}` };
    const { error: repairLinkErr } = await admin
      .from("repairs")
      .update({ invoice_id: invoiceId })
      .eq("id", repairId)
      .eq("tenant_id", tenantId);
    if (repairLinkErr) return { error: `repair invoice-link failed: ${repairLinkErr.message}` };
  }

  // Get tax rate
  const { data: invRow } = await admin.from("invoices").select("tax_rate").eq("id", invoiceId).single();
  const taxRate = invRow?.tax_rate ?? 0.1;

  // Insert line item
  const { error: liErr } = await admin.from("invoice_line_items").insert({
    tenant_id: tenantId,
    invoice_id: invoiceId,
    description: item.description,
    inventory_id: item.inventoryId ?? null,
    quantity: item.qty,
    unit_price: item.unitPrice,
  });
  if (liErr) return { error: liErr.message };

  await recalcInvoice(admin, invoiceId, taxRate);
  revalidatePath(`/repairs/${repairId}`);
  return { success: true };
}

export async function removeRepairLineItem(
  lineItemId: string,
  repairId: string,
  tenantId: string
): Promise<{ success?: boolean; error?: string }> {
  // RBAC: removing a line item from a shared invoice directly alters a
  // customer's bill — destructive on shared-entity data. Owner/manager only.
  try {
    const authCtx = await requireAuth();
    if (!authCtx.isManager && !authCtx.isOwner) {
      return { error: "Only owner or manager can remove repair line items." };
    }
  } catch {
    return { error: "Not authenticated" };
  }
  let ctx;
  try { ctx = await getAuthContext(); } catch { return { error: "Not authenticated" }; }
  const { admin } = ctx;
  if (ctx.tenantId !== tenantId) return { error: "Unauthorized" };

  // Tenant-scope every admin-client read + delete below so a session-authed
  // user of Tenant A can't delete a line item belonging to Tenant B by
  // supplying its UUID. The outer `ctx.tenantId !== tenantId` check only
  // verifies the caller's own session; the admin client otherwise has
  // no tenant filter.
  const { data: li } = await admin
    .from("invoice_line_items")
    .select("invoice_id")
    .eq("id", lineItemId)
    .eq("tenant_id", tenantId)
    .single();
  if (!li?.invoice_id) return { error: "Line item not found" };

  const { error } = await admin
    .from("invoice_line_items")
    .delete()
    .eq("id", lineItemId)
    .eq("tenant_id", tenantId);
  if (error) return { error: error.message };

  const { data: invRow } = await admin
    .from("invoices")
    .select("tax_rate")
    .eq("id", li.invoice_id)
    .eq("tenant_id", tenantId)
    .single();
  await recalcInvoice(admin, li.invoice_id, invRow?.tax_rate ?? 0.1);
  revalidatePath(`/repairs/${repairId}`);
  return { success: true };
}

export async function recordRepairPayment(
  repairId: string,
  invoiceId: string,
  tenantId: string,
  amount: number,
  method: string,
  notes: string
): Promise<{ success?: boolean; error?: string }> {
  let ctx;
  try { ctx = await getAuthContext(); } catch { return { error: "Not authenticated" }; }
  const { admin } = ctx;
  if (ctx.tenantId !== tenantId) return { error: "Unauthorized" };

  // IDEMPOTENCY: Prevent duplicate payment submissions
  const paymentDate = new Date().toISOString().split("T")[0];
  const fingerprint = createPaymentFingerprint(amount, method, paymentDate);
  const result = await withIdempotency(
    "repair_payment",
    tenantId,
    invoiceId,
    fingerprint,
    async () => {
      // Tenant-scope every admin-client access below. Without
      // `.eq("tenant_id", tenantId)` on the invoice read + update, a
      // session-authed user of Tenant A can flip any Tenant B invoice
      // to paid/partial by supplying its UUID — the outer ctx check
      // only verifies the caller's own session.
      const { data: invCheck } = await admin
        .from("invoices")
        .select("status, total")
        .eq("id", invoiceId)
        .eq("tenant_id", tenantId)
        .single();
      if (!invCheck) return { error: "Invoice not found" };
      if (invCheck.status === "voided") return { error: "Cannot record payment on voided invoice" };

      const { error: payErr } = await admin.from("payments").insert({
        tenant_id: tenantId,
        invoice_id: invoiceId,
        amount,
        payment_method: method,
        payment_date: paymentDate,
        notes: notes || null,
      });
      if (payErr) return { error: payErr.message };

      // ATOMIC: recalculate from all payments (race-safe)
      const { data: payments } = await admin
        .from("payments")
        .select("amount")
        .eq("invoice_id", invoiceId)
        .eq("tenant_id", tenantId);
      const totalPaid = (payments ?? []).reduce((s, p) => s + (p.amount ?? 0), 0);
      const invTotal = invCheck.total ?? 0;

      const newStatus = totalPaid >= invTotal ? "paid" : totalPaid > 0 ? "partial" : "unpaid";
      // Destructive — invoice payment state. Without surfacing a
      // failure here the payments row was inserted but the invoice
      // would stay "unpaid" with the customer's payment "lost"
      // until manual reconciliation.
      const { error: payStatusErr } = await admin
        .from("invoices")
        .update({
          amount_paid: totalPaid,
          status: newStatus,
          ...(newStatus === "paid" ? { paid_at: new Date().toISOString() } : {}),
        })
        .eq("id", invoiceId)
        .eq("tenant_id", tenantId);
      if (payStatusErr) return { error: `invoice payment-status update failed: ${payStatusErr.message}` };

      return { success: true };
    }
  );

  if ("duplicate" in result && result.duplicate) {
    return { error: result.error };
  }

  revalidatePath(`/repairs/${repairId}`);
  revalidatePath("/dashboard");
  return result as { success?: boolean; error?: string };
}

export async function generateRepairInvoice(
  repairId: string,
  tenantId: string
): Promise<{ success?: boolean; invoiceId?: string; error?: string }> {
  let ctx;
  try { ctx = await getAuthContext(); } catch { return { error: "Not authenticated" }; }
  const { admin } = ctx;
  if (ctx.tenantId !== tenantId) return { error: "Unauthorized" };

  const { data: repair } = await admin.from("repairs").select("customer_id, quoted_price, invoice_id").eq("id", repairId).eq("tenant_id", tenantId).single();
  if (!repair) return { error: "Repair not found" };
  if (repair.invoice_id) return { success: true, invoiceId: repair.invoice_id };

  const { data: inv, error } = await admin.from("invoices").insert({
    tenant_id: tenantId,
    invoice_number: generateDraftInvoiceNumber(),
    customer_id: repair.customer_id,
    reference_type: "repair",
    reference_id: repairId,
    status: "draft",
    invoice_date: new Date().toISOString().split("T")[0],
    subtotal: repair.quoted_price ?? 0,
    tax_amount: (repair.quoted_price ?? 0) * 0.1,
    discount_amount: 0,
    total: (repair.quoted_price ?? 0) * 1.1,
    amount_paid: 0,
    tax_name: "GST",
    tax_rate: 0.1,
  }).select("id").single();
  if (error || !inv) return { error: error?.message ?? "Failed to create invoice" };

  // Destructive — links the new invoice to the owning repair. Without
  // this update the invoice exists but the repair's `invoice_id`
  // pointer stays null, so re-running generateRepairInvoice would
  // create a duplicate. Surface to caller.
  const { error: linkErr } = await admin
    .from("repairs")
    .update({ invoice_id: inv.id })
    .eq("id", repairId)
    .eq("tenant_id", tenantId);
  if (linkErr) return { error: `repair invoice-link failed: ${linkErr.message}` };
  revalidatePath(`/repairs/${repairId}`);
  return { success: true, invoiceId: inv.id };
}

export async function updateRepairStage(
  repairId: string,
  tenantId: string,
  stage: string
): Promise<{ success?: boolean; error?: string; smsSent?: boolean }> {
  let ctx;
  try { ctx = await getAuthContext(); } catch { return { error: "Not authenticated" }; }
  const { supabase, admin, userId } = ctx;
  if (ctx.tenantId !== tenantId) return { error: "Unauthorized" };

  const { error } = await supabase.from("repairs").update({ stage, updated_at: new Date().toISOString() }).eq("id", repairId).eq("tenant_id", tenantId);
  if (error) return { error: error.message };

  // Side-effect — repair_stages is the audit-trail table; if the
  // insert fails we lose history but the stage transition itself
  // already succeeded. Log + continue rather than fail the action.
  const { error: stageHistErr } = await admin
    .from("repair_stages")
    .insert({ tenant_id: tenantId, repair_id: repairId, stage, notes: null, created_by: userId });
  if (stageHistErr) {
    logger.error("[updateRepairStage] repair_stages insert failed (non-fatal)", { repairId, stage, err: stageHistErr });
  }

  // Side-effect — job_events is the per-job activity feed; same
  // policy as above. Stage was updated; lost event row is a
  // visibility gap, not state-of-record drift.
  const stageLabel = stage.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const { error: stageEventErr } = await admin.from("job_events").insert({
    tenant_id: tenantId,
    job_type: "repair",
    job_id: repairId,
    event_type: "stage_change",
    description: `Stage changed to ${stageLabel}`,
    actor: ctx.userId,
  });
  if (stageEventErr) {
    logger.error("[updateRepairStage] job_events stage_change insert failed (non-fatal)", { repairId, stage, err: stageEventErr });
  }

  // ── Auto-SMS on stage change ────────────────────────────────────────────
  let smsSent = false;
  try {
    // Check if auto-SMS is enabled for this tenant
    const { data: smsSettings } = await admin
      .from("tenant_integrations")
      .select("settings")
      .eq("tenant_id", tenantId)
      .eq("integration_type", "twilio")
      .eq("enabled", true)
      .single();

    const settings = smsSettings?.settings as {
      account_sid?: string;
      auth_token?: string;
      phone_number?: string;
      phone_number_au?: string;
      phone_number_us?: string;
      auto_sms_on_stage_change?: boolean;
    } | null;

    // Only send if auto-SMS is enabled and stage warrants notification.
    // 'quality_check' isn't allowed by repairs_stage_valid (verified
    // 2026-04-25) so the branch was dead — never fired. Drop it.
    // Also gate on the explicit auto_sms_on_stage_change preference,
    // not just Twilio creds; pre-fix any tenant with Twilio configured
    // got auto-SMS regardless of whether they opted in.
    const NOTIFY_STAGES = ["quoted", "in_progress", "ready"];
    if (
      settings?.account_sid &&
      settings?.auth_token &&
      settings?.auto_sms_on_stage_change &&
      NOTIFY_STAGES.includes(stage)
    ) {
      // Get repair + customer details
      const { data: repairRow } = await admin
        .from("repairs")
        .select("repair_number, item_description, customer_id")
        .eq("id", repairId)
        .single();

      if (repairRow?.customer_id) {
        const { data: customer } = await admin
          .from("customers")
          .select("full_name, mobile, phone")
          .eq("id", repairRow.customer_id)
          .single();

        const customerPhone = customer?.mobile || customer?.phone;
        if (customerPhone) {
          const repairNumber = repairRow.repair_number ?? repairId.slice(-6).toUpperCase();
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://nexpura.com";

          // Get subdomain for tracking link
          const { data: websiteConfig } = await admin
            .from("website_config")
            .select("subdomain")
            .eq("tenant_id", tenantId)
            .maybeSingle();

          const trackingUrl = websiteConfig?.subdomain
            ? `${appUrl}/${websiteConfig.subdomain}/track/${repairId}`
            : null;

          const STAGE_SMS_MESSAGES: Record<string, string> = {
            quoted: `Hi ${customer?.full_name?.split(" ")[0] ?? "there"}, your repair #${repairNumber} has been assessed and a quote is ready. Please contact us to approve.`,
            in_progress: `Hi ${customer?.full_name?.split(" ")[0] ?? "there"}, great news! Work has started on your repair #${repairNumber}.`,
            quality_check: `Hi ${customer?.full_name?.split(" ")[0] ?? "there"}, your repair #${repairNumber} is in final quality check — almost done!`,
            ready: `Hi ${customer?.full_name?.split(" ")[0] ?? "there"}, your repair #${repairNumber} (${repairRow.item_description || "item"}) is ready for collection! 🎉${trackingUrl ? ` Track: ${trackingUrl}` : ""}`,
          };

          const message = STAGE_SMS_MESSAGES[stage];
          if (message) {
            // Route through the sandbox-aware helper (W2-001). In preview/dev
            // this returns a synthetic sid and never hits Twilio; in prod it
            // uses the same smart AU/US number selection the helper owns.
            const smsResult = await sendTwilioSms(customerPhone, message, {
              accountSid: settings.account_sid,
              authToken: settings.auth_token,
              smsNumberAU: settings.phone_number_au,
              smsNumberUS: settings.phone_number_us,
              phoneNumber: settings.phone_number,
            });
            if (smsResult.success) {
              smsSent = true;
              // Side-effect — sms_sends is the per-customer message
              // log for the activity feed. Twilio already accepted
              // the message; a failed log row is a visibility gap.
              const { error: smsLogErr } = await admin.from("sms_sends").insert({
                tenant_id: tenantId,
                customer_id: repairRow.customer_id,
                phone: customerPhone,
                message,
                status: "sent",
                twilio_sid: smsResult.messageId ?? null,
                context: { repair_id: repairId, stage, type: "stage_change" },
              });
              if (smsLogErr) {
                logger.error("[updateRepairStage] auto-SMS log failed (non-fatal)", { repairId, stage, err: smsLogErr });
              }
              const { error: smsEventErr } = await admin.from("job_events").insert({
                tenant_id: tenantId,
                job_type: "repair",
                job_id: repairId,
                event_type: "sms_sent",
                description: `Auto SMS sent for stage: ${stageLabel}`,
                actor: userId,
              });
              if (smsEventErr) {
                logger.error("[updateRepairStage] auto-SMS job_events insert failed (non-fatal)", { repairId, stage, err: smsEventErr });
              }
            }
          }
        }
      }
    }
  } catch (smsErr) {
    logger.error("Auto SMS on stage change failed:", smsErr);
    // Non-fatal — stage was updated successfully
  }

  // ── Auto-email customer with tracking link on stage change ──────────────
  // 'in_workshop' and 'quality_check' aren't valid repairs.stage values
  // per repairs_stage_valid (verified 2026-04-25). Drop the dead branches.
  const EMAIL_NOTIFY_STAGES = ["quoted", "approved", "in_progress", "ready", "collected"];
  if (EMAIL_NOTIFY_STAGES.includes(stage)) {
    try {
      const { data: repairRow } = await admin
        .from("repairs")
        .select("repair_number, item_description, customer_id, due_date")
        .eq("id", repairId)
        .single();

      if (repairRow?.customer_id) {
        const { data: customer } = await admin
          .from("customers")
          .select("full_name, email")
          .eq("id", repairRow.customer_id)
          .single();

        if (customer?.email) {
          const { data: tenant } = await admin
            .from("tenants")
            .select("name, business_name, email, phone")
            .eq("id", tenantId)
            .single();
          const businessName = tenant?.business_name || tenant?.name || "Your Jeweller";

          const { data: websiteConfig } = await admin
            .from("website_config")
            .select("subdomain")
            .eq("tenant_id", tenantId)
            .maybeSingle();

          const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://nexpura.com";
          const trackingUrl = websiteConfig?.subdomain
            ? `${appUrl}/${websiteConfig.subdomain}/track/${repairId}`
            : null;

          const STAGE_EMAIL_SUBJECTS: Record<string, string> = {
            quoted: `Your repair quote is ready — ${repairRow.repair_number}`,
            approved: `Repair approved & scheduled — ${repairRow.repair_number}`,
            in_progress: `Work has started on your repair — ${repairRow.repair_number}`,
            in_workshop: `Your item is in the workshop — ${repairRow.repair_number}`,
            quality_check: `Almost done! Quality check underway — ${repairRow.repair_number}`,
            ready: `Your item is ready for collection — ${repairRow.repair_number}`,
            collected: `Thank you — repair complete — ${repairRow.repair_number}`,
          };

          const STAGE_EMAIL_BODY: Record<string, string> = {
            quoted: `A quote is ready for your repair. Please contact us to review and approve.`,
            approved: `Your repair has been approved and is now scheduled for work. We'll keep you updated as it progresses.`,
            in_progress: `Great news — work has started on your <strong>${repairRow.item_description || "item"}</strong>. We'll notify you when it's complete.`,
            in_workshop: `Your item is currently in our workshop. Our team is working on it with care.`,
            quality_check: `Your repair is in its final quality check — almost ready!`,
            ready: `Wonderful news — your <strong>${repairRow.item_description || "item"}</strong> is ready for collection! Please visit us at your convenience during business hours.`,
            collected: `Thank you for trusting us with your precious piece. We hope you're delighted with the result.`,
          };

          const firstName = customer.full_name?.split(" ")[0] ?? "there";
          const trackingSection = trackingUrl
            ? `<div style="margin:20px 0;text-align:center;"><a href="${trackingUrl}" style="display:inline-block;background:#8B7355;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;letter-spacing:0.5px;">View Live Status →</a><p style="margin:8px 0 0;font-size:12px;color:#78716c;">Or copy this link: <a href="${trackingUrl}" style="color:#8B7355;">${trackingUrl}</a></p></div>`
            : "";

          const htmlBody = `<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;color:#1c1917;"><div style="background:#1c1917;color:#fff;padding:28px 24px;text-align:center;"><h1 style="margin:0;font-size:20px;letter-spacing:1px;">${businessName}</h1></div><div style="padding:28px 24px;background:#fafaf9;"><p style="margin:0 0 16px;">Hi ${firstName},</p><p style="margin:0 0 16px;">${STAGE_EMAIL_BODY[stage]}</p>${trackingSection}<div style="margin:24px 0;padding:16px;background:#fff;border:1px solid #e7e5e4;border-radius:8px;"><p style="margin:0 0 8px;font-size:12px;color:#78716c;text-transform:uppercase;letter-spacing:1px;">Repair Reference</p><p style="margin:0;font-size:18px;font-weight:600;font-family:monospace;">${repairRow.repair_number}</p>${repairRow.item_description ? `<p style="margin:4px 0 0;font-size:14px;color:#57534e;">${repairRow.item_description}</p>` : ""}</div>${tenant?.phone || tenant?.email ? `<p style="font-size:13px;color:#78716c;margin:16px 0 0;">Questions? Contact us${tenant.phone ? ` on ${tenant.phone}` : ""}${tenant.email ? ` or ${tenant.email}` : ""}.</p>` : ""}</div><div style="padding:14px 24px;background:#fff;text-align:center;font-size:11px;color:#a8a29e;border-top:1px solid #e7e5e4;">${businessName} · Powered by Nexpura</div></div>`;

          const fromEmail = process.env.RESEND_FROM_EMAIL || "notifications@nexpura.com";
          // W2-001: route through the sandbox-aware `resend` wrapper; the
          // raw fetch bypassed `isSandbox()` and would hit real Resend from
          // preview/dev deploys.
          await resend.emails.send({
            from: `${businessName} <${fromEmail}>`,
            to: [customer.email],
            subject: STAGE_EMAIL_SUBJECTS[stage] || `Repair update — ${repairRow.repair_number}`,
            html: htmlBody,
          });

          // Side-effect — email already sent; lost log row is a
          // visibility gap, not state-of-record drift.
          const { error: emailEventErr } = await admin.from("job_events").insert({
            tenant_id: tenantId,
            job_type: "repair",
            job_id: repairId,
            event_type: "email_sent",
            description: `Status update email sent to ${customer.email} — stage: ${stageLabel}`,
            actor: userId,
          });
          if (emailEventErr) {
            logger.error("[updateRepairStage] auto-email job_events insert failed (non-fatal)", { repairId, stage, err: emailEventErr });
          }
        }
      }
    } catch (emailErr) {
      logger.error("Auto email on stage change failed:", emailErr);
      // Non-fatal
    }
  }

  // ── Auto-SMS customer when repair becomes ready ─────────────────────────
  // Customer "ready" notifications go via SMS (per Joey 2026-04-30):
  // SMS lands reliably even for customers without WhatsApp installed and
  // doesn't require Meta business templates. Employee task assignments
  // stay on WhatsApp; only customer-facing repair/bespoke ready use SMS.
  //
  // Pre-fix history: the active UI path (RepairCommandCenter →
  // updateRepairStage) had no working customer notification at all. The
  // dead `advanceRepairStage` function in repairs/actions.ts had logic
  // wired but its only caller (RepairDetailClient.tsx) was retired; and
  // the per-tenant SMS branch above reads from `tenant_integrations`,
  // a table that doesn't exist in the schema, so it silently no-op'd.
  if (stage === "ready") {
    try {
      const { data: repairRow } = await admin
        .from("repairs")
        .select("repair_number, item_description, item_type, customer_id")
        .eq("id", repairId)
        .single();

      if (repairRow?.customer_id) {
        const { data: customer } = await admin
          .from("customers")
          .select("full_name, mobile, phone")
          .eq("id", repairRow.customer_id)
          .single();

        const customerPhone = customer?.mobile || customer?.phone;
        if (customerPhone) {
          const { data: tenant } = await admin
            .from("tenants")
            .select("name, business_name")
            .eq("id", tenantId)
            .single();
          const businessName = tenant?.business_name || tenant?.name || "your jeweller";
          const firstName = (customer?.full_name || "there").split(" ")[0];
          const description =
            repairRow.item_description ||
            (repairRow.item_type ? repairRow.item_type : `repair ${repairRow.repair_number ?? ""}`);

          const message = `Hi ${firstName}, your ${description} is ready for collection at ${businessName}. Please contact us to arrange pickup.`;
          const smsResult = await sendTwilioSms(customerPhone, message);
          if (smsResult.success) {
            // Side-effect — Twilio already delivered. Both inserts
            // are activity-log rows; lost rows are visibility gaps.
            // sms_sends has no `context` column in this schema (verified
            // via information_schema 2026-04-30) — keep the insert minimal
            // and put the repair linkage on job_events instead.
            const { error: readySmsLogErr } = await admin.from("sms_sends").insert({
              tenant_id: tenantId,
              customer_id: repairRow.customer_id,
              phone: customerPhone,
              message,
              status: "sent",
              twilio_sid: smsResult.messageId ?? null,
            });
            if (readySmsLogErr) {
              logger.error("[updateRepairStage] ready-SMS sms_sends insert failed (non-fatal)", { repairId, err: readySmsLogErr });
            }
            const { error: readySmsEventErr } = await admin.from("job_events").insert({
              tenant_id: tenantId,
              job_type: "repair",
              job_id: repairId,
              event_type: "sms_sent",
              description: `Ready SMS sent to ${customerPhone}`,
              actor: userId,
            });
            if (readySmsEventErr) {
              logger.error("[updateRepairStage] ready-SMS job_events insert failed (non-fatal)", { repairId, err: readySmsEventErr });
            }
          } else {
            logger.warn("[updateRepairStage] Ready SMS failed", {
              error: smsResult.error,
              repairId,
            });
          }
        }
      }
    } catch (smsErr) {
      logger.error("Auto SMS on stage change failed:", smsErr);
      // Non-fatal — stage was updated successfully
    }
  }

  revalidatePath(`/repairs/${repairId}`);
  await flushSentry();
  return { success: true, smsSent };
}

export async function emailRepairInvoice(
  repairId: string,
  invoiceId: string
): Promise<{ success?: boolean; note?: string; message?: string; error?: string }> {
  let ctx;
  try { ctx = await getAuthContext(); } catch { return { error: "Not authenticated" }; }
  const { admin, tenantId } = ctx;

  // Fetch tenant info for dynamic branding
  const { data: tenant } = await admin.from("tenants").select("name, business_name, email, phone, address_line1, suburb, state, postcode").eq("id", tenantId).single();
  const businessName = tenant?.business_name || tenant?.name || "Your Jeweller";
  const businessAddress = [tenant?.address_line1, tenant?.suburb, tenant?.state, tenant?.postcode].filter(Boolean).join(", ");
  const businessEmail = tenant?.email || "";

  // Fetch repair + customer + invoice + line items
  const { data: repair } = await admin.from("repairs").select("repair_number, item_description, customer_id").eq("id", repairId).eq("tenant_id", tenantId).single();
  if (!repair) return { error: "Repair not found" };

  const { data: customer } = repair.customer_id
    ? await admin.from("customers").select("full_name, email").eq("id", repair.customer_id).single()
    : { data: null };

  if (!customer?.email) return { error: "Customer has no email address" };

  const { data: invoice } = await admin.from("invoices").select("invoice_number, total, amount_paid, subtotal, tax_amount, status, due_date").eq("id", invoiceId).single();
  if (!invoice) return { error: "Invoice not found" };

  const { data: lineItems } = await admin.from("invoice_line_items").select("description, quantity, unit_price").eq("invoice_id", invoiceId);

  const balanceDue = Math.max(0, (invoice.total ?? 0) - (invoice.amount_paid ?? 0));
  const fmt = (n: number) => `$${n.toFixed(2)}`;

  const lineItemsHtml = (lineItems ?? []).map((li) =>
    `<tr><td style="padding:4px 8px;border:1px solid #eee;">${li.description}</td><td style="padding:4px 8px;border:1px solid #eee;text-align:right;">${li.quantity}</td><td style="padding:4px 8px;border:1px solid #eee;text-align:right;">${fmt(li.unit_price)}</td><td style="padding:4px 8px;border:1px solid #eee;text-align:right;">${fmt((li.quantity ?? 1) * (li.unit_price ?? 0))}</td></tr>`
  ).join("");

  const htmlBody = `
<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;color:#1c1917;">
  <div style="background:#1c1917;color:#fff;padding:24px;text-align:center;">
    <h1 style="margin:0;font-size:22px;">${businessName}</h1>
    <p style="margin:4px 0 0;font-size:13px;color:#d6d3d1;">Invoice ${invoice.invoice_number}</p>
  </div>
  <div style="padding:24px;background:#fafaf9;">
    <p>Hi ${customer.full_name},</p>
    <p>Please find your invoice below for repair work on your <strong>${repair.item_description}</strong>.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <thead>
        <tr style="background:#f5f5f4;">
          <th style="padding:4px 8px;border:1px solid #eee;text-align:left;">Description</th>
          <th style="padding:4px 8px;border:1px solid #eee;text-align:right;">Qty</th>
          <th style="padding:4px 8px;border:1px solid #eee;text-align:right;">Unit</th>
          <th style="padding:4px 8px;border:1px solid #eee;text-align:right;">Total</th>
        </tr>
      </thead>
      <tbody>${lineItemsHtml}</tbody>
    </table>
    <div style="text-align:right;margin-top:8px;">
      <div>Subtotal: ${fmt(invoice.subtotal ?? 0)}</div>
      <div>GST (10%): ${fmt(invoice.tax_amount ?? 0)}</div>
      <div style="font-size:16px;font-weight:bold;margin-top:4px;">Total: ${fmt(invoice.total ?? 0)}</div>
      <div>Paid: ${fmt(invoice.amount_paid ?? 0)}</div>
      <div style="font-weight:bold;color:${balanceDue > 0 ? "#b45309" : "#1c1917"};">Balance Due: ${fmt(balanceDue)}</div>
    </div>
  </div>
  <div style="padding:16px 24px;background:#fff;text-align:center;font-size:12px;color:#78716c;">
    ${businessName}${businessAddress ? ` · ${businessAddress}` : ""}${businessEmail ? ` · ${businessEmail}` : ""}
  </div>
</div>`;

  // Use tenant's configured from email, or fall back to nexpura.com domain
  const fromEmail = process.env.RESEND_FROM_EMAIL || "notifications@nexpura.com";
  // W2-001: route through the sandbox-aware `resend` wrapper. The old raw
  // fetch hit Resend unconditionally, which meant preview/dev deploys could
  // email real customer invoices.
  const { error: sendError } = await resend.emails.send({
    from: `${businessName} <${fromEmail}>`,
    to: [customer.email],
    subject: `Invoice ${invoice.invoice_number} — ${businessName}`,
    html: htmlBody,
  });

  if (sendError) {
    logger.error("Resend error:", sendError);
    // Demo-limited: log event but don't surface as error.
    // Side-effect (already in a try/catch) — log on failure; the
    // primary flow returns demo_limited regardless.
    try {
      const { error: attemptErr } = await admin.from("job_events").insert({
        tenant_id: tenantId,
        job_type: "repair",
        job_id: repairId,
        event_type: "email_attempted",
        description: `Invoice email attempted (demo mode — verify sending domain for external delivery)`,
        actor: ctx.userId,
      });
      if (attemptErr) {
        logger.error("[emailRepairInvoice] email_attempted log failed (non-fatal)", { repairId, err: attemptErr });
      }
    } catch { /* ignore */ }
    revalidatePath(`/repairs/${repairId}`);
    await flushSentry();
    return { success: true, note: "demo_limited", message: "Email logged — configure a verified sending domain in Settings for external delivery" };
  }

  // Side-effect — email delivered; lost log row is visibility gap.
  const { error: invEmailEventErr } = await admin.from("job_events").insert({
    tenant_id: tenantId,
    job_type: "repair",
    job_id: repairId,
    event_type: "email_sent",
    description: `Invoice ${invoice.invoice_number} emailed to ${customer.email} ✓`,
    actor: ctx.userId,
  });
  if (invEmailEventErr) {
    logger.error("[emailRepairInvoice] email_sent log failed (non-fatal)", { repairId, err: invEmailEventErr });
  }

  revalidatePath(`/repairs/${repairId}`);
  await flushSentry();
  return { success: true, note: "sent", message: `Invoice emailed to ${customer.email}` };
}

export async function emailJobReady(
  jobType: "repair" | "bespoke",
  jobId: string
): Promise<{ success?: boolean; error?: string }> {
  let ctx;
  try { ctx = await getAuthContext(); } catch { return { error: "Not authenticated" }; }
  const { admin, tenantId } = ctx;

  // Fetch tenant info for dynamic branding
  const { data: tenant } = await admin.from("tenants").select("name, business_name, email, phone, address_line1, suburb, state, postcode").eq("id", tenantId).single();
  const businessName = tenant?.business_name || tenant?.name || "Your Jeweller";
  const businessAddress = [tenant?.address_line1, tenant?.suburb, tenant?.state, tenant?.postcode].filter(Boolean).join(", ");
  const businessEmail = tenant?.email || "";

  let customer = null;
  let itemDesc = "";
  let jobNumber = "";

  if (jobType === "repair") {
    const { data: repair } = await admin.from("repairs").select("repair_number, item_description, customer_id").eq("id", jobId).eq("tenant_id", tenantId).single();
    if (!repair) return { error: "Job not found" };
    itemDesc = repair.item_description;
    jobNumber = repair.repair_number;
    if (repair.customer_id) {
      const { data: cust } = await admin.from("customers").select("full_name, email").eq("id", repair.customer_id).single();
      customer = cust;
    }
  }

  if (!customer?.email) return { error: "Customer has no email address" };

  const htmlBody = `
<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;color:#1c1917;">
  <div style="background:#1c1917;color:#fff;padding:24px;text-align:center;">
    <h1 style="margin:0;font-size:22px;">${businessName}</h1>
  </div>
  <div style="padding:24px;background:#fafaf9;">
    <p>Hi ${customer.full_name},</p>
    <p>Great news — your <strong>${itemDesc}</strong> (${jobNumber}) is ready for collection.</p>
    <p>Please come in at your convenience during business hours. Don't forget to bring your receipt.</p>
    <p>If you have any questions, please don't hesitate to get in touch.</p>
    <p style="margin-top:24px;">Warm regards,<br/>The team at ${businessName}</p>
  </div>
  <div style="padding:16px 24px;background:#fff;text-align:center;font-size:12px;color:#78716c;">
    ${businessName}${businessAddress ? ` · ${businessAddress}` : ""}${businessEmail ? ` · ${businessEmail}` : ""}
  </div>
</div>`;

  const fromEmail = process.env.RESEND_FROM_EMAIL || "notifications@nexpura.com";
  // W2-001: route through the sandbox-aware `resend` wrapper.
  const { error: jobReadyErr } = await resend.emails.send({
    from: `${businessName} <${fromEmail}>`,
    to: [customer.email],
    subject: `Your repair is ready — ${businessName}`,
    html: htmlBody,
  });

  if (jobReadyErr) return { error: "Email failed to send" };

  // Side-effect — email already sent; log row is activity feed.
  const { error: readyEmailEventErr } = await admin.from("job_events").insert({
    tenant_id: tenantId,
    job_type: jobType,
    job_id: jobId,
    event_type: "email_sent",
    description: `Ready for collection email sent to ${customer.email}`,
    actor: ctx.userId,
  });
  if (readyEmailEventErr) {
    logger.error("[emailJobReady] email_sent log failed (non-fatal)", { jobType, jobId, err: readyEmailEventErr });
  }

  revalidatePath(`/repairs/${jobId}`);
  await flushSentry();
  return { success: true };
}

export async function sendJobReadySms(params: {
  repairId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  jobType: string;
  message: string;
}): Promise<{ success: boolean; error?: string }> {
  let ctx;
  try { ctx = await getAuthContext(); } catch { return { success: false, error: "Not authenticated" }; }
  const { admin, tenantId, userId } = ctx;

  // Get Twilio credentials
  const { data: integration } = await admin
    .from("tenant_integrations")
    .select("settings")
    .eq("tenant_id", tenantId)
    .eq("integration_type", "twilio")
    .eq("enabled", true)
    .single();

  const settings = integration?.settings as {
    account_sid?: string;
    auth_token?: string;
    phone_number?: string;
    phone_number_au?: string;
    phone_number_us?: string;
  } | null;

  if (!settings?.account_sid || !settings?.auth_token) {
    return { success: false, error: "Twilio not configured" };
  }

  debug.log(`[sendJobReadySms] Sending to ${params.customerPhone}`);

  // W2-001: route through the sandbox-aware Twilio helper; never hit the
  // Twilio REST API directly from a route/action handler. The helper
  // short-circuits in preview/dev/SANDBOX_MODE and logs the intent.
  const smsResult = await sendTwilioSms(params.customerPhone, params.message, {
    accountSid: settings.account_sid,
    authToken: settings.auth_token,
    smsNumberAU: settings.phone_number_au,
    smsNumberUS: settings.phone_number_us,
    phoneNumber: settings.phone_number,
  });

  if (!smsResult.success) {
    // Side-effect — failure log row. The send already failed;
    // whether the local log row writes is observability not state.
    const { error: failLogErr } = await admin.from("sms_sends").insert({
      tenant_id: tenantId,
      customer_id: params.customerId,
      phone: params.customerPhone,
      message: params.message,
      status: "failed",
      error_message: smsResult.error || "Failed to send",
      context: { job_id: params.repairId, type: "job_ready" },
    });
    if (failLogErr) {
      logger.error("[sendJobReadySms] failed-sms log insert failed (non-fatal)", { repairId: params.repairId, err: failLogErr });
    }
    await flushSentry();
    return { success: false, error: smsResult.error || "Failed to send SMS" };
  }

  // Side-effect — Twilio accepted the message; both rows are
  // activity-feed entries.
  const { error: sentLogErr } = await admin.from("sms_sends").insert({
    tenant_id: tenantId,
    customer_id: params.customerId,
    phone: params.customerPhone,
    message: params.message,
    status: "sent",
    twilio_sid: smsResult.messageId ?? null,
    context: { job_id: params.repairId, type: "job_ready" },
  });
  if (sentLogErr) {
    logger.error("[sendJobReadySms] sent-sms log insert failed (non-fatal)", { repairId: params.repairId, err: sentLogErr });
  }

  const { error: smsJobEventErr } = await admin.from("job_events").insert({
    tenant_id: tenantId,
    job_type: "repair",
    job_id: params.repairId,
    event_type: "sms_sent",
    description: `Ready for collection SMS sent to ${params.customerPhone}`,
    actor: userId,
  });
  if (smsJobEventErr) {
    logger.error("[sendJobReadySms] job_events insert failed (non-fatal)", { repairId: params.repairId, err: smsJobEventErr });
  }

  revalidatePath(`/repairs/${params.repairId}`);
  await flushSentry();
  return { success: true };
}
