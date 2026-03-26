"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";
import { logAuditEvent } from "@/lib/audit";

async function getAuthContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id, role")
    .eq("id", user.id)
    .single();
  if (!userData?.tenant_id) throw new Error("No tenant found");
  return { supabase, userId: user.id, tenantId: userData.tenant_id, role: userData.role };
}

export async function getTeamMembers() {
  try {
    const { supabase, tenantId } = await getAuthContext();
    const { data, error } = await supabase
      .from("team_members")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true });
    return { data: data ?? [], error: error?.message };
  } catch (error) {
    logger.error("getTeamMembers failed", { error });
    return { error: "Operation failed" };
  }
}

export async function inviteTeamMember(formData: FormData) {
  try {
    const { supabase, tenantId } = await getAuthContext();

    const name = (formData.get("name") as string).trim();
    const email = (formData.get("email") as string).trim().toLowerCase();
    const role = (formData.get("role") as string) || "staff";

    if (!name || !email) return { error: "Name and email are required" };

    // Generate invite token
    const inviteToken = crypto.randomUUID();

    const { data: member, error } = await supabase.from("team_members").insert({
      tenant_id: tenantId,
      name,
      email,
      role,
      invite_token: inviteToken,
      invite_accepted: false,
    }).select("id").single();

    if (error) return { error: error.message };

    const { data: { user } } = await supabase.auth.getUser();
    await logAuditEvent({
      tenantId,
      userId: user?.id,
      action: "team_member_invite",
      entityType: "team_member",
      entityId: member?.id,
      newData: { name, email, role },
    });

    revalidatePath("/settings/team");
    return { success: true, inviteToken };
  } catch (error) {
    logger.error("inviteTeamMember failed", { error });
    return { error: "Operation failed" };
  }
}

export async function updateTeamMemberRole(memberId: string, role: string) {
  try {
    const { supabase, userId, tenantId } = await getAuthContext();

    // Get old role for audit
    const { data: oldData } = await supabase
      .from("team_members")
      .select("role, name")
      .eq("id", memberId)
      .eq("tenant_id", tenantId)
      .single();

    const { error } = await supabase
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
    return { error: "Operation failed" };
  }
}

export async function removeTeamMember(memberId: string) {
  try {
    const { supabase, userId, tenantId } = await getAuthContext();

    // Get member data for audit
    const { data: oldData } = await supabase
      .from("team_members")
      .select("name, email, role")
      .eq("id", memberId)
      .eq("tenant_id", tenantId)
      .single();

    const { error } = await supabase
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
    return { error: "Operation failed" };
  }
}

export async function getTasks() {
  try {
    const { supabase, tenantId } = await getAuthContext();
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    return { data: data ?? [], error: error?.message };
  } catch (error) {
    logger.error("getTasks failed", { error });
    return { error: "Operation failed" };
  }
}

export async function createTask(formData: FormData) {
  try {
    const { supabase, userId, tenantId } = await getAuthContext();

    const title = (formData.get("title") as string).trim();
    const description = (formData.get("description") as string) || null;
    const assignedTo = (formData.get("assigned_to") as string) || null;
    const priority = (formData.get("priority") as string) || "normal";
    const dueDate = (formData.get("due_date") as string) || null;

    if (!title) return { error: "Title is required" };

    const { error } = await supabase.from("tasks").insert({
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
    return { error: "Operation failed" };
  }
}

export async function updateTaskStatus(taskId: string, status: string) {
  try {
    const { supabase, tenantId } = await getAuthContext();

    const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (status === "done") updates.completed_at = new Date().toISOString();

    const { error } = await supabase
      .from("tasks")
      .update(updates)
      .eq("id", taskId)
      .eq("tenant_id", tenantId);

    if (error) return { error: error.message };
    revalidatePath("/settings/team");
    return { success: true };
  } catch (error) {
    logger.error("updateTaskStatus failed", { error });
    return { error: "Operation failed" };
  }
}

// ============================================================================
// Team Member Location Assignment
// ============================================================================

export async function getTeamMemberLocations(memberId: string) {
  try {
    const { supabase, tenantId } = await getAuthContext();

    // Get the team member's allowed_location_ids and junction table entries
    const [memberRes, junctionRes] = await Promise.all([
      supabase
        .from("team_members")
        .select("allowed_location_ids")
        .eq("id", memberId)
        .eq("tenant_id", tenantId)
        .single(),
      supabase
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
    return { error: "Operation failed", data: null };
  }
}

export async function updateTeamMemberLocations(
  memberId: string,
  locationIds: string[] | null // null means all locations
) {
  try {
    const { supabase, userId, tenantId } = await getAuthContext();

    // Get old data for audit
    const { data: oldMember } = await supabase
      .from("team_members")
      .select("name, allowed_location_ids")
      .eq("id", memberId)
      .eq("tenant_id", tenantId)
      .single();

    // Update the array column on team_members
    const { error: updateError } = await supabase
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
    await supabase
      .from("team_member_locations")
      .delete()
      .eq("team_member_id", memberId);

    // Then insert new entries (if not "all locations")
    if (locationIds && locationIds.length > 0) {
      const entries = locationIds.map((locId) => ({
        team_member_id: memberId,
        location_id: locId,
      }));
      await supabase.from("team_member_locations").insert(entries);
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
    return { error: "Operation failed" };
  }
}

export async function getLocations() {
  try {
    const { supabase, tenantId } = await getAuthContext();
    const { data, error } = await supabase
      .from("locations")
      .select("id, name, type, is_active")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("name");

    return { data: data ?? [], error: error?.message };
  } catch (error) {
    logger.error("getLocations failed", { error });
    return { error: "Operation failed" };
  }
}
