"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { getAuthContext } from "@/lib/auth-context";
import { isAllowlistedAdmin } from "@/lib/admin-allowlist";
import type { IssueCategory, IssueSeverity, IssueStatus } from "./types";

/**
 * Joey 2026-05-03 P2-H audit: every entry point in this file used
 * `auth.isOwner` as the gate, which let ANY tenant owner read /
 * write / delete pilot_issues across ALL tenants (the table is
 * platform-wide, not tenant-scoped). That's a Group-16-class data
 * leak: a hostile owner of any tenant could enumerate all platform
 * pilot feedback or vandalise other tenants' issues. Now gated on
 * `isAllowlistedAdmin(auth.email)` — same allowlist as the (admin)
 * layout. Single helper centralises the check so future actions
 * inherit it.
 */
async function requirePilotAdmin() {
  const auth = await getAuthContext();
  if (!auth || !isAllowlistedAdmin(auth.email)) {
    return null;
  }
  return auth;
}

interface CreateIssueInput {
  title: string;
  description?: string;
  route_path?: string;
  category: IssueCategory;
  severity: IssueSeverity;
  is_pilot_blocking?: boolean;
  reported_by?: string;
  tenant_id?: string;
  tenant_name?: string;
  steps_to_reproduce?: string;
  expected_result?: string;
  actual_result?: string;
}

export async function createPilotIssue(input: CreateIssueInput) {
  const auth = await requirePilotAdmin();
  if (!auth) {
    return { error: "Unauthorized" };
  }

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("pilot_issues")
    .insert({
      title: input.title,
      description: input.description || null,
      route_path: input.route_path || null,
      category: input.category,
      severity: input.severity,
      status: "new",
      is_pilot_blocking: input.is_pilot_blocking || false,
      reported_by: input.reported_by || auth.email,
      reported_by_user_id: auth.userId,
      tenant_id: input.tenant_id || null,
      tenant_name: input.tenant_name || null,
      steps_to_reproduce: input.steps_to_reproduce || null,
      expected_result: input.expected_result || null,
      actual_result: input.actual_result || null,
    })
    .select()
    .single();

  if (error) {
    console.error("[createPilotIssue] Error:", error);
    return { error: error.message };
  }

  revalidatePath("/admin/pilot-issues");
  return { id: data.id };
}

interface UpdateIssueInput {
  id: string;
  title?: string;
  description?: string;
  route_path?: string;
  category?: IssueCategory;
  severity?: IssueSeverity;
  status?: IssueStatus;
  is_pilot_blocking?: boolean;
  steps_to_reproduce?: string;
  expected_result?: string;
  actual_result?: string;
  fix_notes?: string;
  fixed_by?: string;
  fixed_in_commit?: string;
  assigned_to?: string;
  assigned_to_user_id?: string;
  attachments?: string[];
}

export async function updatePilotIssue(input: UpdateIssueInput) {
  const auth = await requirePilotAdmin();
  if (!auth) {
    return { error: "Unauthorized" };
  }

  const admin = createAdminClient();

  // Build update object with only provided fields
  const updates: Record<string, unknown> = {};
  if (input.title !== undefined) updates.title = input.title;
  if (input.description !== undefined) updates.description = input.description;
  if (input.route_path !== undefined) updates.route_path = input.route_path;
  if (input.category !== undefined) updates.category = input.category;
  if (input.severity !== undefined) updates.severity = input.severity;
  if (input.status !== undefined) {
    updates.status = input.status;
    // Auto-set fixed_at when status changes to fixed
    if (input.status === "fixed" && !input.fixed_by) {
      updates.fixed_at = new Date().toISOString();
      updates.fixed_by = auth.email;
    }
  }
  if (input.is_pilot_blocking !== undefined) updates.is_pilot_blocking = input.is_pilot_blocking;
  if (input.steps_to_reproduce !== undefined) updates.steps_to_reproduce = input.steps_to_reproduce;
  if (input.expected_result !== undefined) updates.expected_result = input.expected_result;
  if (input.actual_result !== undefined) updates.actual_result = input.actual_result;
  if (input.fix_notes !== undefined) updates.fix_notes = input.fix_notes;
  if (input.fixed_by !== undefined) updates.fixed_by = input.fixed_by;
  if (input.fixed_in_commit !== undefined) updates.fixed_in_commit = input.fixed_in_commit;
  if (input.assigned_to !== undefined) updates.assigned_to = input.assigned_to;
  if (input.assigned_to_user_id !== undefined) updates.assigned_to_user_id = input.assigned_to_user_id;
  if (input.attachments !== undefined) updates.attachments = input.attachments;

  const { error } = await admin
    .from("pilot_issues")
    .update(updates)
    .eq("id", input.id);

  if (error) {
    console.error("[updatePilotIssue] Error:", error);
    return { error: error.message };
  }

  revalidatePath("/admin/pilot-issues");
  return { success: true };
}

export async function deletePilotIssue(id: string) {
  const auth = await requirePilotAdmin();
  if (!auth) {
    return { error: "Unauthorized" };
  }

  const admin = createAdminClient();

  const { error } = await admin
    .from("pilot_issues")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[deletePilotIssue] Error:", error);
    return { error: error.message };
  }

  revalidatePath("/admin/pilot-issues");
  return { success: true };
}

// Bulk status update
export async function bulkUpdateStatus(ids: string[], status: IssueStatus) {
  const auth = await requirePilotAdmin();
  if (!auth) {
    return { error: "Unauthorized" };
  }

  const admin = createAdminClient();

  const updates: Record<string, unknown> = { status };
  if (status === "fixed") {
    updates.fixed_at = new Date().toISOString();
    updates.fixed_by = auth.email;
  }

  const { error } = await admin
    .from("pilot_issues")
    .update(updates)
    .in("id", ids);

  if (error) {
    console.error("[bulkUpdateStatus] Error:", error);
    return { error: error.message };
  }

  revalidatePath("/admin/pilot-issues");
  return { success: true };
}
