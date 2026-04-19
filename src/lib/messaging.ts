"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications";
import { revalidatePath } from "next/cache";
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
const TRACKING_ID_RE = /^(RPR|BSP)-[A-F0-9]{8}$/i;

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

  const { data: order, error: lookupErr } = await admin
    .from(table)
    .select("id, tenant_id")
    .eq("tracking_id", trackingId)
    .is("deleted_at", null)
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

  return { success: true };
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
  const { data: order } = await admin
    .from(table)
    .select("id, tenant_id")
    .eq("tracking_id", id)
    .is("deleted_at", null)
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
