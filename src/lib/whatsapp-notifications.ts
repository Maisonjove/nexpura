import logger from "@/lib/logger";

/**
 * Notifications - Powered by Nexpura Platform
 * Uses platform Twilio account for all notifications (free for jewellers)
 * - Customer notifications: WhatsApp (when available)
 * - Employee task assignment: WhatsApp (rich formatting, native app)
 * - Employee status-change / urgent flags: SMS (smart number selection AU/US)
 * No per-tenant Twilio setup needed
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { sendTwilioWhatsApp } from "@/lib/twilio-whatsapp";
import { sendTwilioSms } from "@/lib/twilio-sms";

interface SendMessageParams {
  to: string; // Phone number with country code, e.g., "+61412345678"
  message: string;
}

/**
 * Send a WhatsApp message via platform Twilio account
 */
export async function sendWhatsAppMessage(
  tenantId: string,
  params: SendMessageParams
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  // Use platform Twilio directly (env vars: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER)
  const result = await sendTwilioWhatsApp(params.to, params.message);

  // Always log the attempt (success OR failure). Pre-fix the failure
  // branch was silent — when Twilio rejected (e.g. sandbox-not-joined,
  // unverified trial number), no DB row landed, so ops had no visibility
  // into "why didn't my customer get the WhatsApp?". The other helpers
  // in this file (notifyCustomerJobReady etc.) already log on both
  // outcomes; this aligns sendWhatsAppMessage with the same pattern.
  const admin = createAdminClient();
  try {
    await admin.from("whatsapp_sends").insert({
      tenant_id: tenantId,
      phone: params.to,
      message: params.message,
      message_type: "notification",
      status: result.success ? "sent" : "failed",
      twilio_sid: result.messageId,
      error_message: result.error,
    });
  } catch (err) {
    logger.warn("[whatsapp-notifications] Failed to log send:", err);
  }

  return result;
}

/**
 * Check if job ready notifications are enabled for a tenant
 */
export async function isJobReadyNotificationsEnabled(tenantId: string): Promise<boolean> {
  const admin = createAdminClient();
  
  const { data: tenant } = await admin
    .from("tenants")
    .select("notification_settings")
    .eq("id", tenantId)
    .single();

  const settings = tenant?.notification_settings as Record<string, boolean> | null;
  return settings?.whatsapp_job_ready_enabled ?? true; // Default to enabled
}

/**
 * Check if task assignment notifications are enabled for a tenant
 */
export async function isTaskNotificationsEnabled(tenantId: string): Promise<boolean> {
  const admin = createAdminClient();
  
  const { data: tenant } = await admin
    .from("tenants")
    .select("notification_settings")
    .eq("id", tenantId)
    .single();

  const settings = tenant?.notification_settings as Record<string, boolean> | null;
  return settings?.whatsapp_task_assignment_enabled ?? true; // Default to enabled
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
 * Send job ready notification to customer
 */
export async function notifyCustomerJobReady(
  tenantId: string,
  customer: {
    id: string;
    phone: string;
    name: string;
  },
  job: {
    id: string;
    description: string;
    type: "repair" | "bespoke";
  },
  businessName: string
): Promise<{ sent: boolean; error?: string }> {
  // Check if job ready notifications are enabled
  if (!(await isJobReadyNotificationsEnabled(tenantId))) {
    return { sent: false, error: "Job ready notifications disabled" };
  }

  if (!customer.phone) {
    return { sent: false, error: "Customer has no phone number" };
  }

  // Build message
  const jobType = job.type === "repair" ? "repair" : "order";
  const message = `Hi ${customer.name}! 🎉\n\nGreat news — your ${jobType} is ready for pickup at ${businessName}!\n\n${job.description}\n\nSee you soon!`;

  const result = await sendWhatsAppMessage(tenantId, {
    to: customer.phone,
    message,
  });

  // Log the notification
  const admin = createAdminClient();
  await admin.from("whatsapp_sends").upsert({
    tenant_id: tenantId,
    customer_id: customer.id,
    phone: customer.phone,
    message,
    message_type: "job_ready",
    status: result.success ? "sent" : "failed",
    twilio_sid: result.messageId,
    error_message: result.error,
  });

  return { sent: result.success, error: result.error };
}

/**
 * Notify employee of new task assignment via WhatsApp
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
  if (!(await isTaskNotificationsEnabled(tenantId))) {
    return { sent: false, error: "Task notifications disabled" };
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

  const taskType = task.type === "repair" ? "Repair" : task.type === "bespoke" ? "Bespoke job" : "Task";
  let message = `🔔 New ${taskType.toLowerCase()} assigned: ${task.description}`;

  if (task.customerName) {
    message += ` — ${task.customerName}`;
  }

  if (task.dueDate) {
    const date = new Date(task.dueDate);
    message += `\nDue: ${date.toLocaleDateString()}`;
  }

  const result = await sendTwilioWhatsApp(member.phone_number, message);

  const admin = createAdminClient();
  try {
    await admin.from("whatsapp_sends").insert({
      tenant_id: tenantId,
      phone: member.phone_number,
      message,
      message_type: "task_assignment",
      status: result.success ? "sent" : "failed",
      twilio_sid: result.messageId,
      error_message: result.error,
    });
  } catch (err) {
    logger.warn("[notifyTaskAssignment] Failed to log send:", err);
  }

  return { sent: result.success, error: result.error };
}

/**
 * Notify employee of status change on their assigned item via SMS
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
  if (!(await isTaskNotificationsEnabled(tenantId))) {
    return { sent: false, error: "Task notifications disabled" };
  }

  // Check if status change notifications are enabled
  const admin = createAdminClient();
  const { data: tenant } = await admin
    .from("tenants")
    .select("notification_settings")
    .eq("id", tenantId)
    .single();

  const settings = tenant?.notification_settings as Record<string, boolean> | null;
  if (!(settings?.notify_on_status_change ?? true)) {
    return { sent: false, error: "Status change notifications disabled" };
  }

  const member = await getTeamMemberWithPhone(tenantId, assigneeId);
  if (!member?.phone_number || !member.whatsapp_notifications_enabled) {
    return { sent: false, error: "Cannot notify member" };
  }

  // Keep message concise for SMS
  const message = `Status update: ${item.description}${item.customerName ? ` (${item.customerName})` : ""} - ${item.oldStatus} > ${item.newStatus}`;

  // Use SMS instead of WhatsApp for employees
  const result = await sendTwilioSms(member.phone_number, message);

  // Log the send
  try {
    await admin.from("sms_sends").insert({
      tenant_id: tenantId,
      phone: member.phone_number,
      message,
      status: result.success ? "sent" : "failed",
      twilio_sid: result.messageId,
      error_message: result.error,
      context: { type: "status_change", assignee_id: assigneeId },
    });
  } catch (err) {
    logger.warn("[notifyStatusChange] Failed to log send:", err);
  }

  return { sent: result.success, error: result.error };
}

/**
 * Notify employee when an item is flagged urgent via SMS
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
  if (!(await isTaskNotificationsEnabled(tenantId))) {
    return { sent: false, error: "Task notifications disabled" };
  }

  // Check if urgent notifications are enabled
  const admin = createAdminClient();
  const { data: tenant } = await admin
    .from("tenants")
    .select("notification_settings")
    .eq("id", tenantId)
    .single();

  const settings = tenant?.notification_settings as Record<string, boolean> | null;
  if (!(settings?.notify_on_urgent_flagged ?? true)) {
    return { sent: false, error: "Urgent notifications disabled" };
  }

  const member = await getTeamMemberWithPhone(tenantId, assigneeId);
  if (!member?.phone_number || !member.whatsapp_notifications_enabled) {
    return { sent: false, error: "Cannot notify member" };
  }

  // Keep message concise for SMS
  let message = `URGENT: ${item.description}`;
  if (item.customerName) {
    message += ` - ${item.customerName}`;
  }
  if (item.reason) {
    message += ` (${item.reason})`;
  }
  message += " - Please prioritize!";

  // Use SMS instead of WhatsApp for employees
  const result = await sendTwilioSms(member.phone_number, message);

  // Log the send
  try {
    await admin.from("sms_sends").insert({
      tenant_id: tenantId,
      phone: member.phone_number,
      message,
      status: result.success ? "sent" : "failed",
      twilio_sid: result.messageId,
      error_message: result.error,
      context: { type: "urgent_flagged", assignee_id: assigneeId },
    });
  } catch (err) {
    logger.warn("[notifyUrgentFlagged] Failed to log send:", err);
  }

  return { sent: result.success, error: result.error };
}
