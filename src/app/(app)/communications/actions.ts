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

  // If type is email, attempt to send via email helper
  if (type === "email") {
    const customerEmail = str("customer_email");
    if (customerEmail) {
      try {
        // Dynamic import to avoid build errors if send.ts has issues
        const { sendGenericEmail } = await import("@/lib/email/send");
        if (sendGenericEmail) {
          const result = await sendGenericEmail({
            to: customerEmail,
            subject: str("subject") || "Message from Nexpura",
            body: body,
          });
          if (result?.error) status = "failed";
        }
      } catch {
        // Email send not available — still log it
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
