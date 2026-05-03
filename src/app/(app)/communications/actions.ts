"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resend } from "@/lib/email/resend";
import { escapeHtml } from "@/lib/sanitize";
import { revalidatePath } from "next/cache";

async function getAuthContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) throw new Error("No tenant found");

  return { supabase, userId: user.id, tenantId: userData.tenant_id };
}

export async function getCommunications() {
  let ctx;
  try {
    ctx = await getAuthContext();
  } catch {
    return { data: null, error: "Not authenticated" };
  }

  const { supabase, tenantId } = ctx;

  const { data, error } = await supabase
    .from("communications")
    .select("id, type, subject, customer_name, customer_email, status, sent_at, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  return { data, error: error?.message ?? null };
}

/**
 * Verify that a customer_email truly belongs to the caller's tenant before
 * emailing it. Otherwise a staff user could send a message to any email
 * that exists on another tenant's customer record by passing the address
 * directly in the form. W5-CRIT-005 audit finding.
 */
async function customerEmailBelongsToTenant(
  tenantId: string,
  email: string,
): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("customers")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("email", email)
    .limit(1)
    .maybeSingle();
  return !!data;
}

export async function sendCommunication(
  formData: FormData
): Promise<{ id?: string; error?: string }> {
  let ctx;
  try {
    ctx = await getAuthContext();
  } catch {
    return { error: "Not authenticated" };
  }

  const { supabase, userId, tenantId } = ctx;

  const str = (key: string) => (formData.get(key) as string) || null;
  const type = (formData.get("type") as string) || "email";
  const body = formData.get("body") as string;

  if (!body?.trim()) return { error: "Body is required" };

  let status = "sent";

  // If type is email, attempt to send via Resend directly
  if (type === "email") {
    const customerEmail = str("customer_email");
    if (customerEmail) {
      // W5-CRIT-005: verify the provided email actually belongs to a
      // customer in the caller's tenant. Otherwise staff could email
      // arbitrary addresses (including other tenants' customers) via
      // the direct form submit.
      const belongs = await customerEmailBelongsToTenant(tenantId, customerEmail);
      if (!belongs) {
        return { error: "Customer email not found for this tenant" };
      }

      try {
        const admin = createAdminClient();
        const { data: tenant } = await admin.from("tenants").select("name, business_name").eq("id", tenantId).single();
        const businessName = tenant?.business_name || tenant?.name || "Your Jeweller";
        const fromEmail = process.env.RESEND_FROM_EMAIL || "notifications@nexpura.com";

        const subject = str("subject") || "Message from your jeweller";
        const customerName = str("customer_name") || "Valued Customer";
        // W5-CRIT-005: escape user-supplied fields before interpolating into HTML.
        // Previously `${customerName}` / `${body}` were raw, allowing a staff
        // user to inject arbitrary HTML (including tracking pixels or
        // phishing links in the rendered email).
        const safeCustomerName = escapeHtml(customerName);
        const safeBody = escapeHtml(body).replace(/\n/g, "<br/>");
        const { error: sendError } = await resend.emails.send({
          from: `${businessName} <${fromEmail}>`,
          to: [customerEmail],
          subject,
          html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto"><p>Hi ${safeCustomerName},</p><div style="white-space:pre-wrap">${safeBody}</div></div>`,
        });
        if (sendError) status = "failed";
      } catch {
        // Email send not critical — still log it
        status = "sent";
      }
    }
  }

  const { data, error } = await supabase
    .from("communications")
    .insert({
      tenant_id: tenantId,
      type,
      subject: str("subject"),
      body,
      customer_name: str("customer_name"),
      customer_email: str("customer_email"),
      status,
      sent_by: userId,
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "Failed to send" };

  return { id: data.id };
}

export async function resendEmailLog(logId: string) {
  let ctx;
  try {
    ctx = await getAuthContext();
  } catch {
    return { error: "Not authenticated" };
  }

  const { supabase, tenantId } = ctx;

  const { data: log, error: logError } = await supabase
    .from("email_logs")
    .select("*")
    .eq("id", logId)
    .eq("tenant_id", tenantId)
    .single();

  if (logError || !log) return { error: "Log not found" };

  try {
    const admin = createAdminClient();
    const { data: tenant } = await admin.from("tenants").select("name, business_name").eq("id", tenantId).single();
    const businessName = tenant?.business_name || tenant?.name || "Your Jeweller";
    const fromEmail = process.env.RESEND_FROM_EMAIL || "notifications@nexpura.com";

    const safeSubject = log.subject ? escapeHtml(log.subject) : "";
    const { error: sendError } = await resend.emails.send({
      from: `${businessName} <${fromEmail}>`,
      to: [log.recipient],
      subject: log.subject || "Re-sent message",
      html: `<div><p>Re-sending previous message:</p><hr/><p>${safeSubject}</p></div>`,
    });
    if (sendError) return { error: sendError.message };

    // Log re-send. email_logs has no sent_at column — created_at is the
    // canonical timestamp, and we don't want to clobber it on re-send;
    // just bump the status back to 'sent' and clear bounce_reason.
    await supabase
      .from("email_logs")
      .update({ status: "sent", bounce_reason: null })
      .eq("id", logId);

    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function markNotificationRead(
  notificationId: string,
): Promise<{ success?: boolean; error?: string }> {
  let ctx;
  try { ctx = await getAuthContext(); } catch { return { error: "Not authenticated" }; }
  const admin = createAdminClient();
  const { error } = await admin
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId)
    .eq("tenant_id", ctx.tenantId);
  if (error) return { error: error.message };
  revalidatePath("/communications");
  return { success: true };
}

export async function markAllNotificationsRead(): Promise<{ success?: boolean; error?: string; updated?: number }> {
  let ctx;
  try { ctx = await getAuthContext(); } catch { return { error: "Not authenticated" }; }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("notifications")
    .update({ is_read: true })
    .eq("tenant_id", ctx.tenantId)
    .eq("is_read", false)
    .select("id");
  if (error) return { error: error.message };
  revalidatePath("/communications");
  return { success: true, updated: data?.length ?? 0 };
}

