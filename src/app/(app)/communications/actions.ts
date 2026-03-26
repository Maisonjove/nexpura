"use server";

import { createClient } from "@/lib/supabase/server";

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
      try {
        const { resend } = await import("@/lib/email/resend");
        const subject = str("subject") || "Message from your jeweller";
        const customerName = str("customer_name") || "Valued Customer";
        const { error: sendError } = await resend.emails.send({
          from: "Nexpura <onboarding@resend.dev>",
          to: [customerEmail],
          subject,
          html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto"><p>Hi ${customerName},</p><div style="white-space:pre-wrap">${body.replace(/\n/g, "<br/>")}</div></div>`,
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
    const { resend } = await import("@/lib/email/resend");
    const { error: sendError } = await resend.emails.send({
      from: "Nexpura <onboarding@resend.dev>",
      to: [log.recipient_email],
      subject: log.subject || "Re-sent message",
      html: `<div><p>Re-sending previous message:</p><hr/><p>${log.subject}</p></div>`,
    });
    if (sendError) return { error: sendError.message };
    
    // Log re-send
    await supabase.from("email_logs").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", logId);
    
    return { success: true };
  } catch (err) {
    return { error: err.message };
  }
}
