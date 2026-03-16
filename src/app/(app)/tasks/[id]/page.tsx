import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import TaskDetailClient from "./TaskDetailClient";
import { getTaskComments, getTaskActivities, getTaskAttachments } from "../actions";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const { data: userData } = await admin
    .from("users")
    .select("tenant_id")
    .eq("id", user?.id ?? "")
    .single();

  const { data: task } = await admin
    .from("tasks")
    .select("*, assignee:assigned_to(full_name, avatar_url), creator:created_by(full_name)")
    .eq("id", id)
    .eq("tenant_id", userData?.tenant_id ?? "")
    .single();

  if (!task) notFound();

  const [comments, activities, attachments] = await Promise.all([
    getTaskComments(id),
    getTaskActivities(id),
    getTaskAttachments(id),
  ]);

  return (
    <TaskDetailClient 
      task={task} 
      initialComments={comments.data || []} 
      activities={activities || []}
      attachments={attachments.data || []}
    />
  );
}
