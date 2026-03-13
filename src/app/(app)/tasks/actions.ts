"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity-log";

async function getAuthContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id, role")
    .eq("id", user.id)
    .single();
  if (!userData?.tenant_id) throw new Error("No tenant");
  return { supabase, userId: user.id, tenantId: userData.tenant_id as string, role: userData.role as string };
}

export interface StaffTask {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  created_by: string | null;
  linked_type: string | null;
  linked_id: string | null;
  due_date: string | null;
  priority: string;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  assignee_name?: string | null;
  assignee_email?: string | null;
}

export async function getMyTasks(): Promise<{ data: StaffTask[]; error?: string }> {
  try {
    const { supabase, userId, tenantId } = await getAuthContext();
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("staff_tasks")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("assigned_to", userId)
      .order("due_date", { ascending: true, nullsFirst: false });

    if (error) return { data: [], error: error.message };
    return { data: data ?? [] };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : "Error" };
  }
}

export async function getAllTasks(): Promise<{ data: StaffTask[]; error?: string }> {
  try {
    const { tenantId } = await getAuthContext();
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("staff_tasks")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (error) return { data: [], error: error.message };
    return { data: data ?? [] };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : "Error" };
  }
}

export async function getWorkshopTasks(): Promise<{ data: StaffTask[]; error?: string }> {
  try {
    const { tenantId } = await getAuthContext();
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("staff_tasks")
      .select("*")
      .eq("tenant_id", tenantId)
      .in("linked_type", ["repair", "bespoke"])
      .order("due_date", { ascending: true, nullsFirst: false });

    if (error) return { data: [], error: error.message };
    return { data: data ?? [] };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : "Error" };
  }
}

export async function createTask(
  formData: FormData
): Promise<{ id?: string; error?: string }> {
  try {
    const { supabase: _supabase, userId, tenantId } = await getAuthContext();
    const admin = createAdminClient();

    const title = (formData.get("title") as string)?.trim();
    if (!title) return { error: "Title is required" };

    const { data: task, error } = await admin
      .from("staff_tasks")
      .insert({
        tenant_id: tenantId,
        title,
        description: (formData.get("description") as string) || null,
        assigned_to: (formData.get("assigned_to") as string) || null,
        due_date: (formData.get("due_date") as string) || null,
        priority: (formData.get("priority") as string) || "medium",
        status: (formData.get("status") as string) || "pending",
        linked_type: (formData.get("linked_type") as string) || null,
        linked_id: (formData.get("linked_id") as string) || null,
        notes: (formData.get("notes") as string) || null,
        created_by: userId,
      })
      .select("id")
      .single();

    if (error) return { error: error.message };

    await logActivity(tenantId, userId, "created_task", "staff_task", task?.id, title);
    revalidatePath("/tasks");
    return { id: task?.id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error" };
  }
}

export async function updateTask(
  taskId: string,
  updates: Partial<{
    title: string;
    description: string;
    assigned_to: string | null;
    due_date: string | null;
    priority: string;
    status: string;
    linked_type: string | null;
    linked_id: string | null;
    notes: string | null;
  }>
): Promise<{ success?: boolean; error?: string }> {
  try {
    const { tenantId } = await getAuthContext();
    const admin = createAdminClient();

    const { error } = await admin
      .from("staff_tasks")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", taskId)
      .eq("tenant_id", tenantId);

    if (error) return { error: error.message };
    revalidatePath("/tasks");
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error" };
  }
}

export async function deleteTask(
  taskId: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    const { tenantId } = await getAuthContext();
    const admin = createAdminClient();

    const { error } = await admin
      .from("staff_tasks")
      .delete()
      .eq("id", taskId)
      .eq("tenant_id", tenantId);

    if (error) return { error: error.message };
    revalidatePath("/tasks");
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error" };
  }
}
