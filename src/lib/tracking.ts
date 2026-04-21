/**
 * Customer Order Tracking utilities
 * Handles status history logging and email notifications
 */

import { createAdminClient } from "@/lib/supabase/admin";
import logger from "@/lib/logger";

interface LogStatusChangeParams {
  tenantId: string;
  orderType: "repair" | "bespoke";
  orderId: string;
  status: string;
  notes?: string;
  changedBy?: string;
}

/**
 * Log a status change to the order_status_history table
 */
export async function logStatusChange({
  tenantId,
  orderType,
  orderId,
  status,
  notes,
  changedBy,
}: LogStatusChangeParams): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = createAdminClient();

    const { error } = await admin.from("order_status_history").insert({
      tenant_id: tenantId,
      order_type: orderType,
      order_id: orderId,
      status,
      notes: notes || null,
      changed_by: changedBy || null,
    });

    if (error) {
      logger.error("[tracking/logStatusChange] Insert error:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    logger.error("[tracking/logStatusChange] Exception:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

interface SendTrackingEmailParams {
  tenantId: string;
  orderType: "repair" | "bespoke";
  orderId: string;
}

/**
 * Send tracking email to customer
 * Called internally after order creation if customer_email is set
 */
export async function sendTrackingEmail({
  tenantId,
  orderType,
  orderId,
}: SendTrackingEmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://nexpura.com";
    
    // tenantId is no longer accepted by the route (PR-01 / W7-CRIT-04) —
    // the server resolves the tenant from the caller's session. We keep
    // tenantId in the helper signature for internal bookkeeping only.
    void tenantId;
    const response = await fetch(`${baseUrl}/api/tracking/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderType, orderId }),
    });

    if (!response.ok) {
      const data = await response.json();
      return { success: false, error: data.error || "Failed to send email" };
    }

    return { success: true };
  } catch (err) {
    logger.error("[tracking/sendTrackingEmail] Exception:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

interface AddAttachmentParams {
  tenantId: string;
  orderType: "repair" | "bespoke";
  orderId: string;
  fileUrl: string;
  fileName: string;
  fileType?: string;
  fileSize?: number;
  description?: string;
  isPublic?: boolean;
  uploadedBy?: string;
}

/**
 * Add an attachment to an order
 */
export async function addOrderAttachment({
  tenantId,
  orderType,
  orderId,
  fileUrl,
  fileName,
  fileType,
  fileSize,
  description,
  isPublic = true,
  uploadedBy,
}: AddAttachmentParams): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("order_attachments")
      .insert({
        tenant_id: tenantId,
        order_type: orderType,
        order_id: orderId,
        file_url: fileUrl,
        file_name: fileName,
        file_type: fileType || null,
        file_size: fileSize || null,
        description: description || null,
        is_public: isPublic,
        uploaded_by: uploadedBy || null,
      })
      .select("id")
      .single();

    if (error) {
      logger.error("[tracking/addOrderAttachment] Insert error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data.id };
  } catch (err) {
    logger.error("[tracking/addOrderAttachment] Exception:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

interface DeleteAttachmentParams {
  attachmentId: string;
  tenantId: string;
}

/**
 * Delete an attachment from an order
 */
export async function deleteOrderAttachment({
  attachmentId,
  tenantId,
}: DeleteAttachmentParams): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = createAdminClient();

    const { error } = await admin
      .from("order_attachments")
      .delete()
      .eq("id", attachmentId)
      .eq("tenant_id", tenantId);

    if (error) {
      logger.error("[tracking/deleteOrderAttachment] Delete error:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    logger.error("[tracking/deleteOrderAttachment] Exception:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Get attachments for an order
 */
export async function getOrderAttachments(
  orderType: "repair" | "bespoke",
  orderId: string
): Promise<Array<{
  id: string;
  file_url: string;
  file_name: string;
  file_type: string | null;
  description: string | null;
  is_public: boolean;
  created_at: string;
}>> {
  try {
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("order_attachments")
      .select("id, file_url, file_name, file_type, description, is_public, created_at")
      .eq("order_type", orderType)
      .eq("order_id", orderId)
      .order("created_at", { ascending: false });

    if (error) {
      logger.error("[tracking/getOrderAttachments] Query error:", error);
      return [];
    }

    return data || [];
  } catch (err) {
    logger.error("[tracking/getOrderAttachments] Exception:", err);
    return [];
  }
}

/**
 * Get status history for an order
 */
export async function getOrderStatusHistory(
  orderType: "repair" | "bespoke",
  orderId: string
): Promise<Array<{
  id: string;
  status: string;
  notes: string | null;
  changed_at: string;
  changed_by: string | null;
}>> {
  try {
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("order_status_history")
      .select("id, status, notes, changed_at, changed_by")
      .eq("order_type", orderType)
      .eq("order_id", orderId)
      .order("changed_at", { ascending: false });

    if (error) {
      logger.error("[tracking/getOrderStatusHistory] Query error:", error);
      return [];
    }

    return data || [];
  } catch (err) {
    logger.error("[tracking/getOrderStatusHistory] Exception:", err);
    return [];
  }
}
