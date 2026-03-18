"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function testTwilioConnection(
  accountSid: string,
  authToken: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Test by fetching account info from Twilio
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
    // Update existing
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
    // Create new
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

  revalidatePath("/marketing/bulk-sms");
  revalidatePath("/integrations");
  return { success: true };
}

export async function sendSMS(params: {
  to: string;
  message: string;
  customerId?: string;
}): Promise<{ success: boolean; error?: string; sid?: string }> {
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
    // Send SMS via Twilio API
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
          To: params.to,
          Body: params.message,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      // Log failed send
      await admin.from("sms_sends").insert({
        tenant_id: userData.tenant_id,
        customer_id: params.customerId || null,
        phone: params.to,
        message: params.message,
        status: "failed",
        error_message: data.message || "Failed to send",
      });

      return { success: false, error: data.message || "Failed to send SMS" };
    }

    // Log successful send
    await admin.from("sms_sends").insert({
      tenant_id: userData.tenant_id,
      customer_id: params.customerId || null,
      phone: params.to,
      message: params.message,
      status: "sent",
      twilio_sid: data.sid,
    });

    return { success: true, sid: data.sid };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    await admin.from("sms_sends").insert({
      tenant_id: userData.tenant_id,
      customer_id: params.customerId || null,
      phone: params.to,
      message: params.message,
      status: "failed",
      error_message: errorMessage,
    });

    return { success: false, error: errorMessage };
  }
}

export async function sendBulkSMS(params: {
  message: string;
  recipients: Array<{ phone: string; name?: string; customerId?: string }>;
}): Promise<{ sent: number; failed: number; errors: string[] }> {
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  // Process in smaller batches to avoid rate limits
  const BATCH_SIZE = 5;
  for (let i = 0; i < params.recipients.length; i += BATCH_SIZE) {
    const batch = params.recipients.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (recipient) => {
        // Personalize message
        const personalizedMessage = params.message.replace(
          /\{\{\s*customer_name\s*\}\}/gi,
          recipient.name || "Customer"
        );

        const result = await sendSMS({
          to: recipient.phone,
          message: personalizedMessage,
          customerId: recipient.customerId,
        });

        if (result.success) {
          sent++;
        } else {
          failed++;
          if (result.error) {
            errors.push(`${recipient.phone}: ${result.error}`);
          }
        }
      })
    );

    // Delay between batches to respect rate limits
    if (i + BATCH_SIZE < params.recipients.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return { sent, failed, errors };
}
