"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";
import { logAuditEvent } from "@/lib/audit";
import { requireRole } from "@/lib/auth-context";

import { flushSentry } from "@/lib/sentry-flush";

// H-04a (consolidation, 2026-05-05): the duplicate inviteTeamMember
// that lived here has been removed. The canonical action is in
// `../roles/actions.ts:inviteTeamMember` — it sends the invite email
// (this twin didn't, leaving recipients without the join link).
// Re-export the canonical so existing TeamClient.tsx callers keep
// working without touching the import line.
export { inviteTeamMember } from "../roles/actions";

async function getAuthContext() {
  const supabase = await createClient();
  const admin = createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: userData } = await admin
    .from("users")
    .select("tenant_id, role")
    .eq("id", user.id)
    .single();
  if (!userData?.tenant_id) throw new Error("No tenant found");
  return { supabase, admin, userId: user.id, tenantId: userData.tenant_id, role: userData.role };
}

export async function getTeamMembers() {
  try {
    const { admin, tenantId } = await getAuthContext();
    const { data, error } = await admin
      .from("team_members")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true });
    return { data: data ?? [], error: error?.message };
  } catch (error) {
    logger.error("getTeamMembers failed", { error });
    await flushSentry();
    return { error: "Operation failed" };
  }
}

// H-04a: deleted local inviteTeamMember(formData) here — re-exported
// the canonical from ../roles/actions at the top of this file. The
// callers in TeamClient.tsx pass a FormData; the canonical takes
// typed args, so TeamClient now extracts the fields itself before
// calling.

export async function updateTeamMemberRole(memberId: string, role: string) {
  try {
    // W6-CRIT-04: role changes are privilege escalation. Owner-only.
    await requireRole("owner");
    const { admin, userId, tenantId } = await getAuthContext();

    // Get old role for audit
    const { data: oldData } = await admin
      .from("team_members")
      .select("role, name")
      .eq("id", memberId)
      .eq("tenant_id", tenantId)
      .single();

    const { error } = await admin
      .from("team_members")
      .update({ role, updated_at: new Date().toISOString() })
      .eq("id", memberId)
      .eq("tenant_id", tenantId);

    if (error) return { error: error.message };

    await logAuditEvent({
      tenantId,
      userId,
      action: "team_member_update",
      entityType: "team_member",
      entityId: memberId,
      oldData: oldData || undefined,
      newData: { role },
    });

    revalidatePath("/settings/team");
    return { success: true };
  } catch (error) {
    logger.error("updateTeamMemberRole failed", { error });
    await flushSentry();
    return { error: "Operation failed" };
  }
}

export async function removeTeamMember(memberId: string) {
  try {
    // W6-CRIT-04: tightened from owner/manager to owner-only — peer
    // managers should not be able to evict each other. Aligns with
    // removeMember() in /settings/roles/actions.
    await requireRole("owner");
    const { admin, userId, tenantId } = await getAuthContext();

    // Get member data for audit
    const { data: oldData } = await admin
      .from("team_members")
      .select("name, email, role")
      .eq("id", memberId)
      .eq("tenant_id", tenantId)
      .single();

    const { error } = await admin
      .from("team_members")
      .delete()
      .eq("id", memberId)
      .eq("tenant_id", tenantId);

    if (error) return { error: error.message };

    await logAuditEvent({
      tenantId,
      userId,
      action: "team_member_delete",
      entityType: "team_member",
      entityId: memberId,
      oldData: oldData || undefined,
    });

    revalidatePath("/settings/team");
    return { success: true };
  } catch (error) {
    logger.error("removeTeamMember failed", { error });
    await flushSentry();
    return { error: "Operation failed" };
  }
}

export async function getTasks() {
  try {
    const { admin, tenantId } = await getAuthContext();
    const { data, error } = await admin
      .from("tasks")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    return { data: data ?? [], error: error?.message };
  } catch (error) {
    logger.error("getTasks failed", { error });
    await flushSentry();
    return { error: "Operation failed" };
  }
}

export async function createTask(formData: FormData) {
  try {
    const { admin, userId, tenantId } = await getAuthContext();

    const title = (formData.get("title") as string).trim();
    const description = (formData.get("description") as string) || null;
    const assignedTo = (formData.get("assigned_to") as string) || null;
    const priority = (formData.get("priority") as string) || "normal";
    const dueDate = (formData.get("due_date") as string) || null;

    if (!title) return { error: "Title is required" };

    const { error } = await admin.from("tasks").insert({
      tenant_id: tenantId,
      created_by: userId,
      assigned_to: assignedTo || null,
      title,
      description,
      priority,
      due_date: dueDate || null,
      status: "todo",
    });

    if (error) return { error: error.message };
    revalidatePath("/settings/team");
    return { success: true };
  } catch (error) {
    logger.error("createTask failed", { error });
    await flushSentry();
    return { error: "Operation failed" };
  }
}

export async function updateTaskStatus(taskId: string, status: string) {
  try {
    const { admin, tenantId } = await getAuthContext();

    const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (status === "done") updates.completed_at = new Date().toISOString();

    const { error } = await admin
      .from("tasks")
      .update(updates)
      .eq("id", taskId)
      .eq("tenant_id", tenantId);

    if (error) return { error: error.message };
    revalidatePath("/settings/team");
    return { success: true };
  } catch (error) {
    logger.error("updateTaskStatus failed", { error });
    await flushSentry();
    return { error: "Operation failed" };
  }
}

// ============================================================================
// Team Member Location Assignment
// ============================================================================

export async function getTeamMemberLocations(memberId: string) {
  try {
    const { admin, tenantId } = await getAuthContext();

    // Get the team member's allowed_location_ids and junction table entries
    const [memberRes, junctionRes] = await Promise.all([
      admin
        .from("team_members")
        .select("allowed_location_ids")
        .eq("id", memberId)
        .eq("tenant_id", tenantId)
        .single(),
      admin
        .from("team_member_locations")
        .select("location_id")
        .eq("team_member_id", memberId),
    ]);

    // Prefer junction table if it has entries, otherwise use array column
    const locationIds = junctionRes.data?.length
      ? junctionRes.data.map((l) => l.location_id)
      : memberRes.data?.allowed_location_ids ?? null;

    return { data: locationIds, error: null };
  } catch (error) {
    logger.error("getTeamMemberLocations failed", { error });
    await flushSentry();
    return { error: "Operation failed", data: null };
  }
}

export async function updateTeamMemberLocations(
  memberId: string,
  locationIds: string[] | null // null means all locations
) {
  try {
    // W6-CRIT-04: location grants are privilege escalation. Owner-only,
    // matching updateMemberLocationAccess() in /settings/roles/actions.
    await requireRole("owner");
    const { admin, userId, tenantId } = await getAuthContext();

    // Get old data for audit
    const { data: oldMember } = await admin
      .from("team_members")
      .select("name, allowed_location_ids")
      .eq("id", memberId)
      .eq("tenant_id", tenantId)
      .single();

    // Update the array column on team_members
    const { error: updateError } = await admin
      .from("team_members")
      .update({
        allowed_location_ids: locationIds,
        updated_at: new Date().toISOString(),
      })
      .eq("id", memberId)
      .eq("tenant_id", tenantId);

    if (updateError) return { error: updateError.message };

    // Also sync the junction table
    // First, delete existing entries
    // Destructive return-error: this is the wipe phase of a sync to the
    // team_member_locations junction. If delete silently fails, the
    // insert below merges new rows on top of stale ones → duplicate
    // grants and the team member ends up with access to MORE locations
    // than allowed_location_ids says. Surface so the caller can retry.
    const { error: locDelErr } = await admin
      .from("team_member_locations")
      .delete()
      .eq("team_member_id", memberId);
    if (locDelErr) return { error: locDelErr.message };

    // Then insert new entries (if not "all locations")
    if (locationIds && locationIds.length > 0) {
      const entries = locationIds.map((locId) => ({
        team_member_id: memberId,
        location_id: locId,
      }));
      // Destructive return-error: the wipe above just succeeded — without
      // these inserts the junction is empty for this member. RBAC
      // location filters that read the junction will deny ALL locations,
      // even though allowed_location_ids says otherwise. Surface so the
      // caller can retry; on retry the wipe is idempotent.
      const { error: locInsErr } = await admin.from("team_member_locations").insert(entries);
      if (locInsErr) return { error: locInsErr.message };
    }

    await logAuditEvent({
      tenantId,
      userId,
      action: "team_member_locations_update",
      entityType: "team_member",
      entityId: memberId,
      oldData: { allowed_location_ids: oldMember?.allowed_location_ids },
      newData: { allowed_location_ids: locationIds },
    });

    revalidatePath("/settings/team");
    return { success: true };
  } catch (error) {
    logger.error("updateTeamMemberLocations failed", { error });
    await flushSentry();
    return { error: "Operation failed" };
  }
}

export async function getLocations() {
  try {
    const { admin, tenantId } = await getAuthContext();
    const { data, error } = await admin
      .from("locations")
      .select("id, name, type, is_active")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("name");

    return { data: data ?? [], error: error?.message };
  } catch (error) {
    logger.error("getLocations failed", { error });
    await flushSentry();
    return { error: "Operation failed" };
  }
}

// ============================================================================
// Team Member Notification Settings
// ============================================================================

export async function updateTeamMemberNotifications(
  memberId: string,
  notifyNewRepairs: boolean,
  notifyNewBespoke: boolean
) {
  try {
    const { admin, userId, tenantId } = await getAuthContext();

    // Get old data for audit
    const { data: oldMember } = await admin
      .from("team_members")
      .select("name, notify_new_repairs, notify_new_bespoke")
      .eq("id", memberId)
      .eq("tenant_id", tenantId)
      .single();

    const { error } = await admin
      .from("team_members")
      .update({
        notify_new_repairs: notifyNewRepairs,
        notify_new_bespoke: notifyNewBespoke,
        updated_at: new Date().toISOString(),
      })
      .eq("id", memberId)
      .eq("tenant_id", tenantId);

    if (error) return { error: error.message };

    await logAuditEvent({
      tenantId,
      userId,
      action: "team_member_notifications_update",
      entityType: "team_member",
      entityId: memberId,
      oldData: {
        notify_new_repairs: oldMember?.notify_new_repairs,
        notify_new_bespoke: oldMember?.notify_new_bespoke,
      },
      newData: {
        notify_new_repairs: notifyNewRepairs,
        notify_new_bespoke: notifyNewBespoke,
      },
    });

    revalidatePath("/settings/team");
    return { success: true };
  } catch (error) {
    logger.error("updateTeamMemberNotifications failed", { error });
    await flushSentry();
    return { error: "Operation failed" };
  }
}

/**
 * M-05 (desktop-Opus, narrow scope): tenant-level 2FA enforcement
 * toggle. Sets tenants.require_2fa_for_staff for the caller's
 * tenant. When TRUE, staff (non-owner) sign-ins without TOTP are
 * bounced to /settings/two-factor?enrolment_required=1 (login route
 * branch).
 *
 * Owner-only — staff must not be able to flip the toggle that
 * gates them out of the app.
 */
export async function setTenantRequire2faForStaff(
  enabled: boolean,
): Promise<{ success?: boolean; error?: string }> {
  try {
    await requireRole("owner");
  } catch {
    return { error: "Only the tenant owner can change the 2FA-required policy." };
  }
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
    .update({ require_2fa_for_staff: enabled })
    .eq("id", userData.tenant_id);
  if (error) return { error: error.message };

  await logAuditEvent({
    tenantId: userData.tenant_id,
    userId: user.id,
    action: "settings_update",
    entityType: "tenant",
    entityId: userData.tenant_id,
    metadata: {
      setting: "require_2fa_for_staff",
      enabled,
    },
  });

  revalidatePath("/settings/team");
  revalidatePath("/settings/two-factor");
  return { success: true };
}
