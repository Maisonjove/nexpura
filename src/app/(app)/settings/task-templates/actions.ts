"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import logger from "@/lib/logger";
import { requireAuth, requireRole } from "@/lib/auth-context";

export interface TaskTemplate {
  id: string;
  title: string;
  description: string | null;
  department: string | null;
  priority: string;
}

export async function getTaskTemplates(): Promise<{ data?: TaskTemplate[]; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    const { data: userData } = await createAdminClient()
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) return { error: "No tenant found" };

    const { data, error } = await supabase
      .from("task_templates")
      .select("*")
      .eq("tenant_id", userData.tenant_id)
      .order("created_at", { ascending: false });

    if (error) return { error: error.message };
    return { data: (data ?? []) as TaskTemplate[] };
  } catch (err) {
    logger.error("[getTaskTemplates] Error:", err);
    return { error: err instanceof Error ? err.message : "Failed to get task templates" };
  }
}

export async function createTaskTemplate(input: {
  title: string;
  description?: string;
  department?: string | null;
  priority: string;
}): Promise<{ data?: TaskTemplate; error?: string }> {
  try {
    // Group 15 audit: task templates pre-populate every staff member's
    // to-do list. Pre-fix only deleteTaskTemplate was role-gated; create
    // and update were callable by any tenant member, so a salesperson
    // could ship workflow templates that flood the team. Aligning with
    // the delete gate.
    try {
      await requireRole("owner", "manager");
    } catch {
      return { error: "Only owner or manager can create task templates." };
    }
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    const { data: userData } = await createAdminClient()
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) return { error: "No tenant found" };

    const { data, error } = await supabase
      .from("task_templates")
      .insert({
        tenant_id: userData.tenant_id,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        department: input.department?.trim() || null,
        priority: input.priority,
      })
      .select()
      .single();

    if (error) return { error: error.message };
    revalidatePath("/settings/task-templates");
    return { data: data as TaskTemplate };
  } catch (err) {
    logger.error("[createTaskTemplate] Error:", err);
    return { error: err instanceof Error ? err.message : "Failed to create task template" };
  }
}

export async function updateTaskTemplate(
  id: string,
  input: {
    title?: string;
    description?: string;
    department?: string | null;
    priority?: string;
  }
): Promise<{ error?: string }> {
  try {
    // Same gate as createTaskTemplate (Group 15 audit fix).
    try {
      await requireRole("owner", "manager");
    } catch {
      return { error: "Only owner or manager can update task templates." };
    }
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    const { data: userData } = await createAdminClient()
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) return { error: "No tenant found" };

    const updateData: Record<string, unknown> = {};
    if (input.title !== undefined) updateData.title = input.title.trim();
    if (input.description !== undefined) updateData.description = input.description.trim() || null;
    if (input.department !== undefined) updateData.department = input.department?.trim() || null;
    if (input.priority !== undefined) updateData.priority = input.priority;

    const { error } = await supabase
      .from("task_templates")
      .update(updateData)
      .eq("id", id)
      .eq("tenant_id", userData.tenant_id);

    if (error) return { error: error.message };
    revalidatePath("/settings/task-templates");
    return {};
  } catch (err) {
    logger.error("[updateTaskTemplate] Error:", err);
    return { error: err instanceof Error ? err.message : "Failed to update task template" };
  }
}

export async function deleteTaskTemplate(id: string): Promise<{ error?: string }> {
  try {
    // RBAC: task templates shape the default workflow for all staff.
    // Destructive removal is owner/manager only.
    const authCtx = await requireAuth();
    if (!authCtx.isManager && !authCtx.isOwner) {
      return { error: "Only owner or manager can delete task templates." };
    }
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    const { data: userData } = await createAdminClient()
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) return { error: "No tenant found" };

    const { error } = await supabase
      .from("task_templates")
      .delete()
      .eq("id", id)
      .eq("tenant_id", userData.tenant_id);

    if (error) return { error: error.message };
    revalidatePath("/settings/task-templates");
    return {};
  } catch (err) {
    logger.error("[deleteTaskTemplate] Error:", err);
    return { error: err instanceof Error ? err.message : "Failed to delete task template" };
  }
}
