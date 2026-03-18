"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function testTwilioConnection(
  accountSid: string,
  authToken: string
): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        return { success: false, message: "Invalid credentials. Please check your Account SID and Auth Token." };
      }
      return { success: false, message: `Connection failed: ${response.statusText}` };
    }

    const data = await response.json();
    return {
      success: true,
      message: `Connected successfully to account: ${data.friendly_name || accountSid}`,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to connect to Twilio",
    };
  }
}

export async function saveTwilioCredentials(credentials: {
  account_sid: string;
  auth_token: string;
  phone_number: string;
}): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();
  const { data: userData } = await admin
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) return { error: "Tenant not found" };

  // Check if integration already exists
  const { data: existing } = await admin
    .from("tenant_integrations")
    .select("id")
    .eq("tenant_id", userData.tenant_id)
    .eq("integration_type", "twilio")
    .single();

  if (existing) {
    const { error } = await admin
      .from("tenant_integrations")
      .update({
        settings: {
          account_sid: credentials.account_sid,
          auth_token: credentials.auth_token,
          phone_number: credentials.phone_number,
        },
        enabled: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (error) return { error: error.message };
  } else {
    const { error } = await admin.from("tenant_integrations").insert({
      tenant_id: userData.tenant_id,
      integration_type: "twilio",
      settings: {
        account_sid: credentials.account_sid,
        auth_token: credentials.auth_token,
        phone_number: credentials.phone_number,
      },
      enabled: true,
    });

    if (error) return { error: error.message };
  }

  revalidatePath("/settings/notifications");
  revalidatePath("/marketing/bulk-sms");
  return { success: true };
}

export async function disconnectTwilio(): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();
  const { data: userData } = await admin
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) return { error: "Tenant not found" };

  const { error } = await admin
    .from("tenant_integrations")
    .update({ enabled: false, updated_at: new Date().toISOString() })
    .eq("tenant_id", userData.tenant_id)
    .eq("integration_type", "twilio");

  if (error) return { error: error.message };

  revalidatePath("/settings/notifications");
  revalidatePath("/marketing/bulk-sms");
  return { success: true };
}

export async function saveSmsTemplates(templates: {
  job_ready: string;
  appointment_reminder: string;
  custom_1: string;
  custom_2: string;
}): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();
  const { data: userData } = await admin
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) return { error: "Tenant not found" };

  const { error } = await admin
    .from("tenants")
    .update({
      sms_templates: templates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userData.tenant_id);

  if (error) return { error: error.message };

  revalidatePath("/settings/notifications");
  return { success: true };
}

export async function sendJobReadySMS(params: {
  customerId: string;
  customerName: string;
  customerPhone: string;
  jobType: string;
  jobId: string;
  customMessage?: string;
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const admin = createAdminClient();
  const { data: userData } = await admin
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) return { success: false, error: "Tenant not found" };

  // Get tenant info for business name
  const { data: tenant } = await admin
    .from("tenants")
    .select("name, business_name, sms_templates")
    .eq("id", userData.tenant_id)
    .single();

  const businessName = tenant?.business_name || tenant?.name || "our store";
  const templates = tenant?.sms_templates as { job_ready?: string } | null;
  
  // Use custom message or template
  let message = params.customMessage || templates?.job_ready || 
    "Hi {{customer_name}}, great news! Your {{job_type}} is ready for pickup at {{business_name}}. See you soon!";

  // Replace variables
  message = message
    .replace(/\{\{\s*customer_name\s*\}\}/gi, params.customerName || "there")
    .replace(/\{\{\s*job_type\s*\}\}/gi, params.jobType || "item")
    .replace(/\{\{\s*business_name\s*\}\}/gi, businessName);

  // Get Twilio credentials
  const { data: integration } = await admin
    .from("tenant_integrations")
    .select("settings")
    .eq("tenant_id", userData.tenant_id)
    .eq("integration_type", "twilio")
    .eq("enabled", true)
    .single();

  const settings = integration?.settings as {
    account_sid?: string;
    auth_token?: string;
    phone_number?: string;
  } | null;

  if (!settings?.account_sid || !settings?.auth_token || !settings?.phone_number) {
    return { success: false, error: "Twilio not configured" };
  }

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${settings.account_sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${settings.account_sid}:${settings.auth_token}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          From: settings.phone_number,
          To: params.customerPhone,
          Body: message,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      // Log failed send
      await admin.from("sms_sends").insert({
        tenant_id: userData.tenant_id,
        customer_id: params.customerId,
        phone: params.customerPhone,
        message,
        status: "failed",
        error_message: data.message || "Failed to send",
        context: { job_id: params.jobId, type: "job_ready" },
      });

      return { success: false, error: data.message || "Failed to send SMS" };
    }

    // Log successful send
    await admin.from("sms_sends").insert({
      tenant_id: userData.tenant_id,
      customer_id: params.customerId,
      phone: params.customerPhone,
      message,
      status: "sent",
      twilio_sid: data.sid,
      context: { job_id: params.jobId, type: "job_ready" },
    });

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    await admin.from("sms_sends").insert({
      tenant_id: userData.tenant_id,
      customer_id: params.customerId,
      phone: params.customerPhone,
      message,
      status: "failed",
      error_message: errorMessage,
      context: { job_id: params.jobId, type: "job_ready" },
    });

    return { success: false, error: errorMessage };
  }
}
