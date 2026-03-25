"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { randomUUID } from "crypto";
import logger from "@/lib/logger";

export interface SupportAccessRequest {
  id: string;
  tenant_id: string;
  requested_by: string;
  requested_by_email: string;
  reason: string | null;
  status: "pending" | "approved" | "denied" | "expired" | "revoked";
  token: string;
  approved_at: string | null;
  approved_by: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Create a new support access request
 */
export async function createSupportAccessRequest(params: {
  tenantId: string;
  requestedBy: string;
  requestedByEmail: string;
  reason?: string;
}): Promise<{ success: boolean; token?: string; error?: string }> {
  const admin = createAdminClient();
  const token = randomUUID();

  // Check if there's already a pending/approved request for this tenant
  const { data: existing } = await admin
    .from("support_access_requests")
    .select("id, status")
    .eq("tenant_id", params.tenantId)
    .in("status", ["pending", "approved"])
    .single();

  if (existing) {
    return {
      success: false,
      error: existing.status === "pending"
        ? "There is already a pending request for this tenant"
        : "There is already an active access grant for this tenant",
    };
  }

  const { error } = await admin.from("support_access_requests").insert({
    tenant_id: params.tenantId,
    requested_by: params.requestedBy,
    requested_by_email: params.requestedByEmail,
    reason: params.reason || null,
    status: "pending",
    token,
  });

  if (error) {
    logger.error("[support-access] Failed to create request:", error);
    return { success: false, error: error.message };
  }

  return { success: true, token };
}

/**
 * Get support access request by token
 */
export async function getSupportAccessByToken(token: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("support_access_requests")
    .select(`
      *,
      tenants:tenant_id (id, name, business_name)
    `)
    .eq("token", token)
    .single();

  if (error || !data) return null;
  return data;
}

/**
 * Approve a support access request
 */
export async function approveSupportAccess(
  token: string,
  approvedBy: string
): Promise<{ success: boolean; error?: string }> {
  const admin = createAdminClient();

  const request = await getSupportAccessByToken(token);
  if (!request) {
    return { success: false, error: "Request not found" };
  }

  if (request.status !== "pending") {
    return { success: false, error: `Request has already been ${request.status}` };
  }

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  const { error } = await admin
    .from("support_access_requests")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      approved_by: approvedBy,
      expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("token", token);

  if (error) {
    logger.error("[support-access] Failed to approve:", error);
    return { success: false, error: error.message };
  }

  // Log the approval
  await admin.from("activity_logs").insert({
    tenant_id: request.tenant_id,
    user_id: approvedBy,
    action: "support_access_approved",
    entity_type: "support_access",
    entity_id: request.id,
    details: {
      requested_by_email: request.requested_by_email,
      expires_at: expiresAt.toISOString(),
    },
  });

  return { success: true };
}

/**
 * Deny a support access request
 */
export async function denySupportAccess(
  token: string,
  deniedBy?: string
): Promise<{ success: boolean; error?: string }> {
  const admin = createAdminClient();

  const request = await getSupportAccessByToken(token);
  if (!request) {
    return { success: false, error: "Request not found" };
  }

  if (request.status !== "pending") {
    return { success: false, error: `Request has already been ${request.status}` };
  }

  const { error } = await admin
    .from("support_access_requests")
    .update({
      status: "denied",
      updated_at: new Date().toISOString(),
    })
    .eq("token", token);

  if (error) {
    logger.error("[support-access] Failed to deny:", error);
    return { success: false, error: error.message };
  }

  // Log the denial
  if (deniedBy) {
    await admin.from("activity_logs").insert({
      tenant_id: request.tenant_id,
      user_id: deniedBy,
      action: "support_access_denied",
      entity_type: "support_access",
      entity_id: request.id,
      details: {
        requested_by_email: request.requested_by_email,
      },
    });
  }

  return { success: true };
}

/**
 * Revoke an active support access
 */
export async function revokeSupportAccess(
  requestId: string,
  revokedBy: string
): Promise<{ success: boolean; error?: string }> {
  const admin = createAdminClient();

  const { data: request, error: fetchError } = await admin
    .from("support_access_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (fetchError || !request) {
    return { success: false, error: "Request not found" };
  }

  if (request.status !== "approved") {
    return { success: false, error: "Can only revoke approved access" };
  }

  const { error } = await admin
    .from("support_access_requests")
    .update({
      status: "revoked",
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  if (error) {
    logger.error("[support-access] Failed to revoke:", error);
    return { success: false, error: error.message };
  }

  // Log the revocation
  await admin.from("activity_logs").insert({
    tenant_id: request.tenant_id,
    user_id: revokedBy,
    action: "support_access_revoked",
    entity_type: "support_access",
    entity_id: request.id,
    details: {
      requested_by_email: request.requested_by_email,
    },
  });

  return { success: true };
}

/**
 * Check if super admin has active access to a tenant
 */
export async function checkActiveAccess(
  superAdminId: string,
  tenantId: string
): Promise<{ hasAccess: boolean; expiresAt?: string }> {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data } = await admin
    .from("support_access_requests")
    .select("expires_at")
    .eq("tenant_id", tenantId)
    .eq("requested_by", superAdminId)
    .eq("status", "approved")
    .gt("expires_at", now)
    .single();

  if (!data) return { hasAccess: false };
  return { hasAccess: true, expiresAt: data.expires_at };
}

/**
 * Get all support access requests for a tenant (for jeweller view)
 */
export async function getTenantAccessRequests(tenantId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("support_access_requests")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (error) {
    logger.error("[support-access] Failed to fetch requests:", error);
    return [];
  }
  return data || [];
}

/**
 * Get active access for a tenant
 */
export async function getActiveAccessForTenant(tenantId: string) {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data } = await admin
    .from("support_access_requests")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("status", "approved")
    .gt("expires_at", now)
    .single();

  return data;
}

/**
 * Get pending/active access status for multiple tenants (for admin dashboard)
 */
export async function getTenantAccessStatuses(tenantIds: string[]) {
  if (tenantIds.length === 0) return new Map();

  const admin = createAdminClient();
  const now = new Date().toISOString();

  // Get all pending and approved (not expired) requests
  const { data } = await admin
    .from("support_access_requests")
    .select("tenant_id, status, expires_at, requested_by_email")
    .in("tenant_id", tenantIds)
    .in("status", ["pending", "approved"]);

  const statusMap = new Map<
    string,
    { status: string; expiresAt?: string; requestedBy?: string }
  >();

  for (const row of data || []) {
    // Skip expired approved requests
    if (row.status === "approved" && row.expires_at && new Date(row.expires_at) < new Date(now)) {
      continue;
    }
    statusMap.set(row.tenant_id, {
      status: row.status,
      expiresAt: row.expires_at,
      requestedBy: row.requested_by_email,
    });
  }

  return statusMap;
}

/**
 * Expire old approved requests (for cron job)
 */
export async function expireOldAccess() {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { error } = await admin
    .from("support_access_requests")
    .update({ status: "expired", updated_at: now })
    .eq("status", "approved")
    .lt("expires_at", now);

  if (error) {
    logger.error("[support-access] Failed to expire old access:", error);
  }
}
