/**
 * WhatsApp Business API (Meta Cloud API) integration for employee notifications
 */

import { getIntegration } from "@/lib/integrations";
import { createAdminClient } from "@/lib/supabase/admin";

interface WhatsAppConfig {
  phone_number_id: string;
  access_token: string;
  business_account_id?: string;
}

interface SendMessageParams {
  to: string; // Phone number with country code, e.g., "1234567890"
  message: string;
}

/**
 * Send a WhatsApp text message using Meta Cloud API
 */
export async function sendWhatsAppMessage(
  tenantId: string,
  params: SendMessageParams
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const integration = await getIntegration(tenantId, "whatsapp");
  
  if (!integration || integration.status !== "connected") {
    return { success: false, error: "WhatsApp not configured" };
  }

  const config = integration.config as WhatsAppConfig;
  
  // Clean phone number (remove spaces, dashes, plus sign for API)
  const cleanPhone = params.to.replace(/[\s\-\+]/g, "");
  
  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${config.phone_number_id}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: cleanPhone,
          type: "text",
          text: {
            preview_url: false,
            body: params.message,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error("[whatsapp] Send failed:", errorData);
      return { 
        success: false, 
        error: errorData.error?.message || "Failed to send message" 
      };
    }

    const data = await response.json();
    return { 
      success: true, 
      messageId: data.messages?.[0]?.id 
    };
  } catch (err) {
    console.error("[whatsapp] Send error:", err);
    return { 
      success: false, 
      error: err instanceof Error ? err.message : "Network error" 
    };
  }
}

/**
 * Check if employee WhatsApp notifications are enabled for a tenant
 */
export async function isWhatsAppNotificationsEnabled(tenantId: string): Promise<boolean> {
  const admin = createAdminClient();
  
  const { data: tenant } = await admin
    .from("tenants")
    .select("notification_settings")
    .eq("id", tenantId)
    .single();

  const settings = tenant?.notification_settings as Record<string, boolean> | null;
  return settings?.whatsapp_employee_notifications ?? false;
}

/**
 * Get team member by ID with phone number
 */
export async function getTeamMemberWithPhone(
  tenantId: string,
  memberId: string
): Promise<{ name: string; phone_number: string | null; whatsapp_notifications_enabled: boolean } | null> {
  const admin = createAdminClient();
  
  const { data } = await admin
    .from("team_members")
    .select("name, phone_number, whatsapp_notifications_enabled")
    .eq("tenant_id", tenantId)
    .eq("id", memberId)
    .single();

  return data;
}

/**
 * Notify employee of new task assignment
 */
export async function notifyTaskAssignment(
  tenantId: string,
  assigneeId: string,
  task: {
    description: string;
    customerName?: string;
    dueDate?: string;
    notes?: string;
    type: "repair" | "bespoke" | "task";
  }
): Promise<{ sent: boolean; error?: string }> {
  // Check if notifications enabled
  if (!(await isWhatsAppNotificationsEnabled(tenantId))) {
    return { sent: false, error: "WhatsApp notifications disabled" };
  }

  // Get assignee
  const member = await getTeamMemberWithPhone(tenantId, assigneeId);
  if (!member) {
    return { sent: false, error: "Team member not found" };
  }

  if (!member.phone_number) {
    return { sent: false, error: "No phone number on file" };
  }

  if (!member.whatsapp_notifications_enabled) {
    return { sent: false, error: "Employee opted out of notifications" };
  }

  // Build message
  const taskType = task.type === "repair" ? "Repair" : task.type === "bespoke" ? "Bespoke job" : "Task";
  let message = `🔔 New ${taskType.toLowerCase()} assigned: ${task.description}`;
  
  if (task.customerName) {
    message += ` for ${task.customerName}`;
  }
  
  if (task.dueDate) {
    const date = new Date(task.dueDate);
    message += `\n📅 Due: ${date.toLocaleDateString()}`;
  }
  
  if (task.notes) {
    message += `\n📝 Notes: ${task.notes}`;
  }

  const result = await sendWhatsAppMessage(tenantId, {
    to: member.phone_number,
    message,
  });

  return { sent: result.success, error: result.error };
}

/**
 * Notify employee of status change on their assigned item
 */
export async function notifyStatusChange(
  tenantId: string,
  assigneeId: string,
  item: {
    description: string;
    customerName?: string;
    oldStatus: string;
    newStatus: string;
    type: "repair" | "bespoke";
  }
): Promise<{ sent: boolean; error?: string }> {
  if (!(await isWhatsAppNotificationsEnabled(tenantId))) {
    return { sent: false, error: "WhatsApp notifications disabled" };
  }

  const member = await getTeamMemberWithPhone(tenantId, assigneeId);
  if (!member?.phone_number || !member.whatsapp_notifications_enabled) {
    return { sent: false, error: "Cannot notify member" };
  }

  const message = `📋 Status updated: ${item.description}${item.customerName ? ` (${item.customerName})` : ""}\n${item.oldStatus} → ${item.newStatus}`;

  const result = await sendWhatsAppMessage(tenantId, {
    to: member.phone_number,
    message,
  });

  return { sent: result.success, error: result.error };
}

/**
 * Notify employee when an item is flagged urgent
 */
export async function notifyUrgentFlagged(
  tenantId: string,
  assigneeId: string,
  item: {
    description: string;
    customerName?: string;
    reason?: string;
  }
): Promise<{ sent: boolean; error?: string }> {
  if (!(await isWhatsAppNotificationsEnabled(tenantId))) {
    return { sent: false, error: "WhatsApp notifications disabled" };
  }

  const member = await getTeamMemberWithPhone(tenantId, assigneeId);
  if (!member?.phone_number || !member.whatsapp_notifications_enabled) {
    return { sent: false, error: "Cannot notify member" };
  }

  let message = `🚨 URGENT: ${item.description}`;
  if (item.customerName) {
    message += ` for ${item.customerName}`;
  }
  if (item.reason) {
    message += `\nReason: ${item.reason}`;
  }
  message += "\n\nPlease prioritize this item.";

  const result = await sendWhatsAppMessage(tenantId, {
    to: member.phone_number,
    message,
  });

  return { sent: result.success, error: result.error };
}
