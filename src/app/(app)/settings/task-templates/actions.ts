"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export interface TaskTemplate {
  id: string;
  title: string;
  description: string | null;
  department: string | null;
  priority: string;
}

export async function getTaskTemplates() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: userData } = await createAdminClient()
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) throw new Error("No tenant found");

  const { data, error } = await supabase
    .from("task_templates")
    .select("*")
    .eq("tenant_id", userData.tenant_id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function createTaskTemplate(input: {
  title: string;
  description?: string;
  department?: string | null;
  priority: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: userData } = await createAdminClient()
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) throw new Error("No tenant found");

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

  if (error) throw error;
  revalidatePath("/settings/task-templates");
  return data;
}

export async function updateTaskTemplate(
  id: string,
  input: {
    title?: string;
    description?: string;
    department?: string | null;
    priority?: string;
  }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: userData } = await createAdminClient()
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) throw new Error("No tenant found");

  const updateData: Record<string, any> = {};
  if (input.title !== undefined) updateData.title = input.title.trim();
  if (input.description !== undefined) updateData.description = input.description.trim() || null;
  if (input.department !== undefined) updateData.department = input.department?.trim() || null;
  if (input.priority !== undefined) updateData.priority = input.priority;

  const { error } = await supabase
    .from("task_templates")
    .update(updateData)
    .eq("id", id)
    .eq("tenant_id", userData.tenant_id);

  if (error) throw error;
  revalidatePath("/settings/task-templates");
}

export async function deleteTaskTemplate(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: userData } = await createAdminClient()
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) throw new Error("No tenant found");

  const { error } = await supabase
    .from("task_templates")
    .delete()
    .eq("id", id)
    .eq("tenant_id", userData.tenant_id);

  if (error) throw error;
  revalidatePath("/settings/task-templates");
}
