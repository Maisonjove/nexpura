"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications";
import { sendWhatsAppMessage } from "@/lib/whatsapp-notifications";
import { revalidatePath, revalidateTag } from "next/cache";
import logger from "@/lib/logger";

export type OrderType = "repair" | "bespoke";
export type SenderType = "customer" | "staff";
export type MessageType = "general" | "amendment_request" | "reply";

export interface OrderMessage {
  id: string;
  tenant_id: string;
  order_type: OrderType;
  order_id: string;
  sender_type: SenderType;
  sender_user_id: string | null;
  sender_display_name: string | null;
  body: string;
  message_type: MessageType;
  read_by_staff_at: string | null;
  created_at: string;
}

// Matches the format enforced by the `generate_tracking_id` DB function and
// by the tracking page's own validator (see
// src/app/track/[trackingId]/page.tsx:44). Keep these in lockstep.
//
// Accepts 8 OR 12 hex chars: 8 is the legacy length, 12 is the current
// generator output (migration 20260424_tracking_id_entropy + 20260425_
// tracking_id_strip_uuid_dash). Pre-fix this regex required exactly 8,
// so customer messages and approve/decline against the new 12-char IDs
// were silently rejected with "Invalid tracking ID" — the optimistic
// UI echoed but the server insert never happened.
const TRACKING_ID_RE = /^(RPR|BSP)-[A-F0-9]{8,12}$/i;

/**
 * Customer-side public message send. Called from /track/[trackingId] with no
 * authenticated user. Trust boundary: we verify the caller knows the exact
 * tracking_id (format-validated + looked up) before inserting. That's the
 * same trust boundary the tracking page already uses to render job status.
 *
 * We deliberately DON'T accept an order_id directly — the customer only
 * knows their tracking_id, and we resolve that to order_type + order_id +
 * tenant_id ourselves via a service-role lookup. This means a malicious
 * client can't post to an arbitrary order they don't possess the tracking
 * ID for.
 *
 * Creates a tenant-level notification on every send so the jeweller sees
 * the message land in their notifications center deep-linked to the job.
 */
export async function postCustomerMessage(params: {
  trackingId: string;
  body: string;
  messageType?: Extract<MessageType, "general" | "amendment_request">;
}): Promise<{ success?: boolean; error?: string }> {
  const trackingId = params.trackingId?.trim().toUpperCase();
  const body = params.body?.trim();
  const messageType = params.messageType ?? "general";

  if (!trackingId || !TRACKING_ID_RE.test(trackingId)) {
    return { error: "Invalid tracking ID" };
  }
  if (!body) return { error: "Message cannot be empty" };
  if (body.length > 4000) return { error: "Message is too long (max 4000 characters)" };

  const admin = createAdminClient();

  // Resolve tracking_id → order_type + order_id + tenant_id.
  const isRepair = trackingId.startsWith("RPR-");
  const isBespoke = trackingId.startsWith("BSP-");
  if (!isRepair && !isBespoke) return { error: "Invalid tracking ID format" };

  const orderType: OrderType = isRepair ? "repair" : "bespoke";
  const table = isRepair ? "repairs" : "bespoke_jobs";

  // Honour the tracking_revoked_at kill-switch (added by migration
  // 20260421_tracking_revoked_at). The /track page already 404s revoked
  // links, but the message-post helper used to filter only on
  // deleted_at — meaning a tenant who revoked a customer's tracking
  // link to lock out a hostile sender could still receive messages
  // posted via the API. Apply the same gate here + on getTrackingThread
  // + submitBespokeDecision so the React form stopping rendering and
  // the server actually accepting writes stay aligned.
  const { data: order, error: lookupErr } = await admin
    .from(table)
    .select("id, tenant_id, created_by")
    .eq("tracking_id", trackingId)
    .is("deleted_at", null)
    .is("tracking_revoked_at", null)
    .maybeSingle();

  if (lookupErr || !order) {
    // Don't leak whether the tracking_id is unknown vs some other failure.
    logger.error("[postCustomerMessage] order lookup failed", { trackingId, err: lookupErr });
    return { error: "Could not send message" };
  }

  const { error: insertErr } = await admin.from("order_messages").insert({
    tenant_id: order.tenant_id,
    order_type: orderType,
    order_id: order.id,
    sender_type: "customer",
    sender_user_id: null,
    sender_display_name: null,
    body,
    message_type: messageType,
    read_by_staff_at: null,
  });

  if (insertErr) {
    logger.error("[postCustomerMessage] insert failed", { err: insertErr });
    return { error: "Could not send message" };
  }

  // Tenant-level notification (user_id null = broadcast to all team).
  const label = messageType === "amendment_request" ? "Amendment request" : "New message";
  const jobLabel = trackingId;
  const link = orderType === "repair" ? `/repairs/${order.id}` : `/bespoke/${order.id}`;
  await createNotification({
    tenantId: order.tenant_id,
    userId: null,
    type: "customer_message",
    title: `${label} from customer on ${jobLabel}`,
    body: body.slice(0, 140) + (body.length > 140 ? "…" : ""),
    link,
  }).catch((err) => {
    // A failed notification shouldn't lose the message that's already saved.
    logger.error("[postCustomerMessage] notification failed (message saved OK)", { err });
  });

  // WhatsApp ping to the person who created the order (their team_member
  // row is the source of truth for phone + opt-in). Fire-and-forget so a
  // Twilio outage can never lose a customer message.
  notifyPersonInChargeWhatsApp({
    tenantId: order.tenant_id as string,
    createdByUserId: (order.created_by as string | null) ?? null,
    headline: `${label} from customer on ${jobLabel}`,
    body,
    link,
  }).catch((err) => {
    logger.error("[postCustomerMessage] whatsapp notify failed (message saved OK)", { err });
  });

  // /track/[trackingId] wraps fetchOrderData in unstable_cache with tag
  // 'tracking' (30s revalidate). Bust it so the customer's reload picks
  // up the fresh state immediately. Optimistic UI hides the lag for the
  // active tab, this fixes the multi-device / hard-reload case.
  revalidateTag("tracking", "default");

  return { success: true };
}

/**
 * Customer-side bespoke approve/decline. Same trust boundary as the
 * customer-message flow: caller knows the tracking_id, we resolve it
 * service-role and only act on this job's row.
 *
 * Decline forces a non-empty message (Joey's spec): we both write the
 * approval_status='changes_requested' AND insert an order_messages row
 * carrying the customer's reason so it shows up in the in-app thread
 * AND on the admin Tracking history page.
 *
 * Either action fires a WhatsApp ping to the person-in-charge so the
 * jeweller knows immediately.
 */
export async function submitBespokeDecision(params: {
  trackingId: string;
  decision: "approve" | "decline";
  message?: string;
}): Promise<{ success?: boolean; error?: string }> {
  const trackingId = params.trackingId?.trim().toUpperCase();
  const message = params.message?.trim() ?? "";
  const decision = params.decision;

  if (!trackingId || !TRACKING_ID_RE.test(trackingId) || !trackingId.startsWith("BSP-")) {
    return { error: "Approval is only available on bespoke jobs" };
  }
  if (decision !== "approve" && decision !== "decline") {
    return { error: "Invalid decision" };
  }
  if (decision === "decline" && message.length < 5) {
    return { error: "Please tell the jeweller why so they know what to change." };
  }
  if (message.length > 4000) {
    return { error: "Message is too long (max 4000 characters)" };
  }

  const admin = createAdminClient();
  const { data: job, error: lookupErr } = await admin
    .from("bespoke_jobs")
    .select("id, tenant_id, created_by, approval_status")
    .eq("tracking_id", trackingId)
    .is("deleted_at", null)
    .is("tracking_revoked_at", null)
    .maybeSingle();

  if (lookupErr || !job) {
    logger.error("[submitBespokeDecision] lookup failed", { trackingId, err: lookupErr });
    return { error: "Could not record decision" };
  }
  if (job.approval_status === "approved") {
    return { error: "This design has already been approved." };
  }

  const updates: Record<string, unknown> = {
    approval_notes: message || null,
  };
  if (decision === "approve") {
    updates.approval_status = "approved";
    updates.approved_at = new Date().toISOString();
  } else {
    updates.approval_status = "changes_requested";
  }

  let { error: updateErr } = await admin
    .from("bespoke_jobs")
    .update(updates)
    .eq("id", job.id);

  // Defensive retry — same shape as /api/bespoke/approval-response. If
  // a column is missing from the live schema cache (we've been bitten
  // twice on this codepath: client_signature_data, sale_id), retry with
  // just the essential state transition so the customer's decision
  // never silently drops.
  if (updateErr && /column .* not find|schema cache/i.test(updateErr.message)) {
    const safe: Record<string, unknown> = { approval_status: updates.approval_status };
    if (updates.approved_at) safe.approved_at = updates.approved_at;
    if (updates.approval_notes) safe.approval_notes = updates.approval_notes;
    const retry = await admin.from("bespoke_jobs").update(safe).eq("id", job.id);
    updateErr = retry.error;
  }

  if (updateErr) {
    logger.error("[submitBespokeDecision] update failed", { err: updateErr });
    return { error: "Could not record decision" };
  }

  // Mirror the decision into the message thread so it shows up on the
  // admin Tracking history page alongside everything else, and so the
  // jeweller's OrderMessagesPanel sees the rationale inline. Customer
  // sender_type so the unread badge fires.
  const threadBody = decision === "approve"
    ? (message ? `[Approved design]\n\n${message}` : "[Approved design]")
    : `[Requested changes]\n\n${message}`;
  await admin.from("order_messages").insert({
    tenant_id: job.tenant_id,
    order_type: "bespoke",
    order_id: job.id,
    sender_type: "customer",
    sender_user_id: null,
    sender_display_name: null,
    body: threadBody,
    message_type: "amendment_request",
    read_by_staff_at: null,
  });

  // job_events is the audit-log surface other approval-related code already
  // writes to (see /api/bespoke/approval-response). Mirror there so a single
  // historical view of the bespoke job stays consistent.
  const eventResult = await admin.from("job_events").insert({
    tenant_id: job.tenant_id,
    job_type: "bespoke",
    job_id: job.id,
    event_type: decision === "approve" ? "client_approved" : "changes_requested",
    description: decision === "approve"
      ? "Customer approved design from tracking page"
      : `Customer requested changes from tracking page: ${message || "No details"}`,
  });
  if (eventResult.error) {
    logger.error("[submitBespokeDecision] job_events insert failed (decision saved OK)", {
      err: eventResult.error,
    });
  }

  // In-app notification (broadcast to team).
  const headline = decision === "approve"
    ? `Customer approved design on ${trackingId}`
    : `Customer requested changes on ${trackingId}`;
  await createNotification({
    tenantId: job.tenant_id as string,
    userId: null,
    type: "customer_message",
    title: headline,
    body: (message || (decision === "approve" ? "No additional notes." : "")).slice(0, 140),
    link: `/bespoke/${job.id}`,
  }).catch((err) => {
    logger.error("[submitBespokeDecision] notification failed (decision saved OK)", { err });
  });

  // WhatsApp ping to person-in-charge. Same fire-and-forget semantics
  // as customer messages — never let a Twilio outage drop the decision.
  notifyPersonInChargeWhatsApp({
    tenantId: job.tenant_id as string,
    createdByUserId: (job.created_by as string | null) ?? null,
    headline,
    body: message || (decision === "approve" ? "Approved with no extra notes." : ""),
    link: `/bespoke/${job.id}`,
  }).catch((err) => {
    logger.error("[submitBespokeDecision] whatsapp notify failed (decision saved OK)", { err });
  });

  // Bust the cached tracking page so a hard refresh after approve/decline
  // doesn't bring back the Approve/Request changes buttons (which would
  // then 4xx with "already approved" — confusing UX). Optimistic UI in
  // BespokeDecisionCard handles the active tab.
  revalidateTag("tracking", "default");

  return { success: true };
}

/**
 * Send a WhatsApp ping to the team member who created (= is responsible
 * for) an order. Resolves user_id → team_members row → phone + opt-in flag.
 *
 * Soft-failure semantics: every miss path returns `{ sent: false, … }`
 * without throwing — the caller (postCustomerMessage / approve / decline)
 * is fire-and-forget. We never want a Twilio outage or a missing phone
 * number to lose the underlying customer action.
 */
async function notifyPersonInChargeWhatsApp(params: {
  tenantId: string;
  createdByUserId: string | null;
  headline: string;
  body: string;
  link: string;
}): Promise<{ sent: boolean; reason?: string }> {
  if (!params.createdByUserId) return { sent: false, reason: "no created_by on order" };

  const admin = createAdminClient();
  const { data: member } = await admin
    .from("team_members")
    .select("phone_number, whatsapp_notifications_enabled")
    .eq("tenant_id", params.tenantId)
    .eq("user_id", params.createdByUserId)
    .maybeSingle();

  if (!member?.phone_number) return { sent: false, reason: "no team_member phone" };
  if (member.whatsapp_notifications_enabled === false) {
    return { sent: false, reason: "team_member opted out" };
  }

  // Keep the WhatsApp body conversational + truncated. Twilio rejects very
  // long messages and the customer's full body is already in-app.
  const snippet = params.body.length > 220 ? params.body.slice(0, 217) + "…" : params.body;
  const text = `${params.headline}\n\n"${snippet}"\n\nReply in Nexpura: https://nexpura.com${params.link}`;

  const r = await sendWhatsAppMessage(params.tenantId, {
    to: member.phone_number,
    message: text,
  });
  if (!r.success) return { sent: false, reason: r.error || "twilio failed" };
  return { sent: true };
}

/**
 * Fetch the thread for a job. Public-safe variant — called from the tracking
 * page with just a tracking_id. Same trust boundary as posting: caller must
 * know the tracking_id, we resolve it service-role and only return this
 * job's messages. Never returns tenant data beyond what the customer
 * already sees on the tracking page (display name + body + timestamps).
 */
export async function getTrackingThread(trackingId: string): Promise<OrderMessage[]> {
  const id = trackingId?.trim().toUpperCase();
  if (!id || !TRACKING_ID_RE.test(id)) return [];
  const admin = createAdminClient();
  const isRepair = id.startsWith("RPR-");
  const table = isRepair ? "repairs" : "bespoke_jobs";
  // Same revoke gate as postCustomerMessage / submitBespokeDecision —
  // a revoked tracking link must not return any thread history.
  const { data: order } = await admin
    .from(table)
    .select("id, tenant_id")
    .eq("tracking_id", id)
    .is("deleted_at", null)
    .is("tracking_revoked_at", null)
    .maybeSingle();
  if (!order) return [];
  const orderType: OrderType = isRepair ? "repair" : "bespoke";
  const { data: messages } = await admin
    .from("order_messages")
    .select("*")
    .eq("order_type", orderType)
    .eq("order_id", order.id)
    .order("created_at", { ascending: true });
  return (messages ?? []) as OrderMessage[];
}

/**
 * Fetch the thread for a job — authenticated staff variant. RLS-scoped by
 * tenant via get_tenant_id() policy. Ordered oldest-to-newest for
 * conversation flow.
 */
export async function getStaffThread(
  orderType: OrderType,
  orderId: string
): Promise<{ messages: OrderMessage[]; error?: string }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("order_messages")
      .select("*")
      .eq("order_type", orderType)
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });
    if (error) return { messages: [], error: error.message };
    return { messages: (data ?? []) as OrderMessage[] };
  } catch (err) {
    logger.error("[getStaffThread] failed", { err });
    return { messages: [], error: "Failed to load thread" };
  }
}

/**
 * Staff reply. Authenticated. RLS enforces tenant + sender_user_id = auth.uid().
 */
export async function postStaffReply(params: {
  orderType: OrderType;
  orderId: string;
  body: string;
}): Promise<{ success?: boolean; error?: string }> {
  const body = params.body?.trim();
  if (!body) return { error: "Reply cannot be empty" };
  if (body.length > 4000) return { error: "Reply is too long (max 4000 characters)" };

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    // Look up tenant + staff display name from the users table.
    const admin = createAdminClient();
    const { data: staff } = await admin
      .from("users")
      .select("tenant_id, full_name, email")
      .eq("id", user.id)
      .single();
    if (!staff?.tenant_id) return { error: "No tenant found" };

    const displayName = (staff.full_name as string | null) || (staff.email as string | null) || "Staff";

    const { error: insertErr } = await supabase.from("order_messages").insert({
      tenant_id: staff.tenant_id,
      order_type: params.orderType,
      order_id: params.orderId,
      sender_type: "staff",
      sender_user_id: user.id,
      sender_display_name: displayName,
      body,
      message_type: "reply",
      read_by_staff_at: new Date().toISOString(), // staff's own reply is implicitly "read" by staff
    });
    if (insertErr) return { error: insertErr.message };

    // Revalidate the staff-facing detail page so the refreshed thread shows up.
    const path = params.orderType === "repair" ? `/repairs/${params.orderId}` : `/bespoke/${params.orderId}`;
    revalidatePath(path);
    // And bust the customer's cached tracking page so they see the
    // jeweller's reply on their next reload (otherwise stale up to 30s).
    revalidateTag("tracking", "default");

    return { success: true };
  } catch (err) {
    logger.error("[postStaffReply] failed", { err });
    return { error: "Reply failed" };
  }
}

/**
 * Mark all unread customer messages for a given order as read by staff.
 * Called when the jeweller opens the detail page (or clicks "mark read").
 * RLS ensures we can only update our own tenant's rows.
 */
export async function markOrderMessagesRead(params: {
  orderType: OrderType;
  orderId: string;
}): Promise<{ success?: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("order_messages")
      .update({ read_by_staff_at: new Date().toISOString() })
      .eq("order_type", params.orderType)
      .eq("order_id", params.orderId)
      .eq("sender_type", "customer")
      .is("read_by_staff_at", null);
    if (error) return { error: error.message };
    return { success: true };
  } catch (err) {
    logger.error("[markOrderMessagesRead] failed", { err });
    return { error: "Mark-read failed" };
  }
}
