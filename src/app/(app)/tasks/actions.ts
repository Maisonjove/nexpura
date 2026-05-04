"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { signStoragePath } from "@/lib/supabase/signed-urls";
import { revalidatePath, revalidateTag } from "next/cache";
import { after } from "next/server";
import { logActivity } from "@/lib/activity-log";
import { notifyTaskAssignment } from "@/lib/whatsapp-notifications";
import logger from "@/lib/logger";
import { logAuditEvent } from "@/lib/audit";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { requireAuth } from "@/lib/auth-context";
import { flushSentry } from "@/lib/sentry-flush";

async function getAuthContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const admin = createAdminClient();
  const { data: userData } = await admin
    .from("users")
    .select("tenant_id, role")
    .eq("id", user.id)
    .single();
  if (!userData?.tenant_id) throw new Error("No tenant");
  return { supabase, userId: user.id, tenantId: userData.tenant_id as string, role: userData.role as string, userEmail: user.email };
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
    const { tenantId, userId } = await getAuthContext();
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("tasks")
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
      .from("tasks")
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
      .from("tasks")
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
    const { userId, tenantId, userEmail } = await getAuthContext();
    const admin = createAdminClient();

    const title = (formData.get("title") as string)?.trim();
    if (!title) return { error: "Title is required" };

    // Core payload (columns that exist on every tenant's schema). Optional
    // columns (linked_type, linked_id, notes) are added separately and
    // retry-dropped on PGRST204 to tolerate schema-cache drift where the
    // migration for those columns wasn't applied.
    const payload: Record<string, unknown> = {
      tenant_id: tenantId,
      title,
      description: (formData.get("description") as string) || null,
      assigned_to: (formData.get("assigned_to") as string) || null,
      due_date: (formData.get("due_date") as string) || null,
      priority: (formData.get("priority") as string) || "normal",
      status: (formData.get("status") as string) || "todo",
      linked_type: (formData.get("linked_type") as string) || null,
      linked_id: (formData.get("linked_id") as string) || null,
      notes: (formData.get("notes") as string) || null,
      created_by: userId,
    };

    let task: { id: string } | null = null;
    let error: { message: string; code?: string } | null = null;
    for (let attempt = 0; attempt < 20; attempt++) {
      // Destructive return-error — `tasks` is the lifecycle state-of-record.
      // Capturing `{ data, error }` (instead of the full result) satisfies the
      // swallowed-error policy and is required by the PGRST204 retry, which
      // inspects error.code to decide whether to drop the missing column and
      // retry. Outer caller surfaces error.message back to the UI.
      const { data: rData, error: rErr } = await admin
        .from("tasks")
        .insert(payload)
        .select("id")
        .single();
      if (!rErr) { task = rData as { id: string }; error = null; break; }
      error = rErr as { message: string; code?: string };
      if (error.code === "PGRST204") {
        const match = error.message.match(/Could not find the '(\w+)' column/);
        if (match && match[1] in payload) {
          delete payload[match[1]];
          continue;
        }
      }
      break;
    }

    if (error) return { error: error.message };

    after(async () => {
      await logActivity(tenantId, userId, "created_task", "staff_task", task?.id, title);
      // Side-effect — `task_activities` is the per-task audit/comment-stream
      // feed. The `tasks` row is already created and revalidated; a missing
      // activity row is a visibility gap, not state-of-record drift.
      const { error: actErr } = await admin.from("task_activities").insert({
        tenant_id: tenantId,
        task_id: task?.id,
        user_id: userId,
        activity_type: "created",
        description: `Task created by ${userEmail}`,
      });
      if (actErr) {
        logger.error("[createTask] task_activities created insert failed (non-fatal)", { taskId: task?.id, err: actErr });
      }
      await logAuditEvent({
        tenantId,
        userId,
        action: "task_create",
        entityType: "task",
        entityId: task?.id,
        newData: {
          title,
          priority: (formData.get("priority") as string) || "normal",
          status: (formData.get("status") as string) || "todo",
          assignedTo: (formData.get("assigned_to") as string) || null,
          dueDate: (formData.get("due_date") as string) || null,
        },
      });
    });

    // Send WhatsApp notification if assigned
    const assignedTo = (formData.get("assigned_to") as string) || null;
    if (assignedTo) {
      // Get team member ID from user ID
      const { data: teamMember } = await admin
        .from("team_members")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("user_id", assignedTo)
        .single();
      
      if (teamMember) {
        notifyTaskAssignment(tenantId, teamMember.id, {
          description: title,
          dueDate: (formData.get("due_date") as string) || undefined,
          notes: (formData.get("notes") as string) || undefined,
          type: "task",
        }).catch((err) => logger.error("Unhandled error", { error: String(err) })); // Fire and forget
      }
    }

    revalidatePath("/tasks");
    revalidateTag(CACHE_TAGS.tasks(tenantId), "default");
    // notifyTaskAssignment above is fire-and-forget; its .catch fires
    // logger.error if the WA notification fails. Flush before exit.
    await flushSentry();
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
    const { userId, tenantId } = await getAuthContext();
    const admin = createAdminClient();

    // Get old state for logging
    const { data: oldTask } = await admin
      .from("tasks")
      .select("*")
      .eq("id", taskId)
      .single();

    // Same PGRST204 retry as createTask — tolerate missing optional columns.
    const updatePayload: Record<string, unknown> = {
      ...updates,
      updated_at: new Date().toISOString(),
    };
    let updateError: { message: string; code?: string } | null = null;
    for (let attempt = 0; attempt < 20; attempt++) {
      // Destructive return-error — `tasks` lifecycle update is state-of-record
      // (status / assignee / due-date drive the rest of the UI). Destructure
      // `{ error }` to satisfy the swallowed-error rule; PGRST204 retry needs
      // error.code to drop missing optional columns. Final error surfaces back
      // to the caller so the UI can show the failure.
      const { error: rErr } = await admin
        .from("tasks")
        .update(updatePayload)
        .eq("id", taskId)
        .eq("tenant_id", tenantId);
      if (!rErr) { updateError = null; break; }
      updateError = rErr as { message: string; code?: string };
      if (updateError.code === "PGRST204") {
        const match = updateError.message.match(/Could not find the '(\w+)' column/);
        if (match && match[1] in updatePayload) {
          delete updatePayload[match[1]];
          continue;
        }
      }
      break;
    }
    if (updateError) return { error: updateError.message };

    // Log activities for specific changes
    if (updates.status && updates.status !== oldTask?.status) {
      // Side-effect — `task_activities` is the per-task audit feed. The
      // `tasks` row already moved to the new status above; a missing
      // status_change activity row is a visibility gap, not state drift.
      const { error: statusActErr } = await admin.from("task_activities").insert({
        tenant_id: tenantId,
        task_id: taskId,
        user_id: userId,
        activity_type: "status_change",
        description: `Status changed from ${oldTask?.status} to ${updates.status}`,
      });
      if (statusActErr) {
        logger.error("[updateTask] task_activities status_change insert failed (non-fatal)", { taskId, err: statusActErr });
      }
    }

    if (updates.assigned_to && updates.assigned_to !== oldTask?.assigned_to) {
      // Side-effect — same as above; `task_activities` audit-trail entry for
      // the assignment change. The assignee already changed on `tasks`.
      const { error: assignActErr } = await admin.from("task_activities").insert({
        tenant_id: tenantId,
        task_id: taskId,
        user_id: userId,
        activity_type: "assigned",
        description: `Task assigned to a new user`,
      });
      if (assignActErr) {
        logger.error("[updateTask] task_activities assigned insert failed (non-fatal)", { taskId, err: assignActErr });
      }

      // Send WhatsApp notification to new assignee
      const { data: teamMember } = await admin
        .from("team_members")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("user_id", updates.assigned_to)
        .single();
      
      if (teamMember) {
        notifyTaskAssignment(tenantId, teamMember.id, {
          description: oldTask?.title || "Task",
          dueDate: oldTask?.due_date || undefined,
          notes: oldTask?.notes || undefined,
          type: "task",
        }).catch((err) => logger.error("Unhandled error", { error: String(err) }));
      }
    }

    // Log audit event
    await logAuditEvent({
      tenantId,
      userId,
      action: "task_update",
      entityType: "task",
      entityId: taskId,
      oldData: oldTask ? { title: oldTask.title, status: oldTask.status, priority: oldTask.priority } : undefined,
      newData: updates,
    });

    revalidatePath("/tasks");
    revalidatePath(`/tasks/${taskId}`);
    revalidateTag(CACHE_TAGS.tasks(tenantId), "default");
    // Sentry serverless flush — side-effect activity-row inserts above may
    // have logged via logger.error; flush before the Lambda freezes so the
    // capture lands.
    await flushSentry();
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error" };
  }
}

export async function deleteTask(
  taskId: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    const { userId, tenantId } = await getAuthContext();
    const admin = createAdminClient();

    // Get task data for audit + ownership check
    const { data: oldTask } = await admin
      .from("tasks")
      .select("title, status, priority, assigned_to, created_by")
      .eq("id", taskId)
      .eq("tenant_id", tenantId)
      .single();

    if (!oldTask) return { error: "Task not found" };

    // RBAC: owner/manager can delete any task; otherwise only the
    // creator or the assignee may delete their own task (self-scoped
    // personal tasks). Prevents a low-privilege user from wiping
    // another staffer's task via a network-level request.
    const authCtx = await requireAuth();
    const isSelfOwned = oldTask.created_by === userId || oldTask.assigned_to === userId;
    if (!authCtx.isManager && !authCtx.isOwner && !isSelfOwned) {
      return { error: "Only owner, manager, or the task owner can delete a task." };
    }

    const { error } = await admin
      .from("tasks")
      .delete()
      .eq("id", taskId)
      .eq("tenant_id", tenantId);

    if (error) return { error: error.message };

    // Log audit event
    await logAuditEvent({
      tenantId,
      userId,
      action: "task_delete",
      entityType: "task",
      entityId: taskId,
      oldData: oldTask || undefined,
    });

    revalidatePath("/tasks");
    revalidateTag(CACHE_TAGS.tasks(tenantId), "default");
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error" };
  }
}

// ── Task Comments ─────────────────────────────────────────────

export interface TaskComment {
  id: string;
  task_id: string;
  tenant_id: string;
  user_id: string | null;
  content: string;
  created_at: string;
  user_name?: string | null;
}

export async function getTaskComments(taskId: string): Promise<{ data: TaskComment[]; error?: string }> {
  try {
    const { tenantId } = await getAuthContext();
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("task_comments")
      .select("*")
      .eq("task_id", taskId)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true });
    if (error) return { data: [], error: error.message };
    return { data: data ?? [] };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : "Error" };
  }
}

export async function addTaskComment(taskId: string, content: string): Promise<{ data: TaskComment | null; error?: string }> {
  try {
    const { userId, tenantId } = await getAuthContext();
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("task_comments")
      .insert({ task_id: taskId, tenant_id: tenantId, user_id: userId, content })
      .select("*")
      .single();
    
    if (error) return { data: null, error: error.message };

    // Side-effect — `task_activities` audit-trail row mirroring the comment
    // insert. The `task_comments` row above is the actual state-of-record
    // (the comment itself); the activity row is just the per-task feed entry.
    const { error: commentActErr } = await admin.from("task_activities").insert({
      tenant_id: tenantId,
      task_id: taskId,
      user_id: userId,
      activity_type: "comment_added",
      description: "Added a comment",
    });
    if (commentActErr) {
      logger.error("[addTaskComment] task_activities comment_added insert failed (non-fatal)", { taskId, err: commentActErr });
    }

    // Sentry serverless flush — drain queued logger.error capture before
    // the Lambda freezes on response return.
    await flushSentry();
    return { data: data as TaskComment };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : "Error" };
  }
}

export async function getTasksForEntity(linkedType: string, linkedId: string): Promise<{ data: StaffTask[]; error?: string }> {
  try {
    const { tenantId } = await getAuthContext();
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("tasks")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("linked_type", linkedType)
      .eq("linked_id", linkedId)
      .order("created_at", { ascending: false });
    if (error) return { data: [], error: error.message };
    return { data: data ?? [] };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : "Error" };
  }
}

// ── Task Activities ──────────────────────────────────────────

export async function getTaskActivities(taskId: string) {
  try {
    const { tenantId } = await getAuthContext();
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("task_activities")
      .select("*, users(full_name, avatar_url)")
      .eq("task_id", taskId)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    
    if (error) return { data: [], error: error.message };
    return { data: data ?? [] };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : "Error" };
  }
}

// ── Task Attachments ──────────────────────────────────────────

export interface TaskAttachment {
  id: string;
  task_id: string;
  tenant_id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  uploaded_by: string | null;
  created_at: string;
}

export async function getTaskAttachments(taskId: string): Promise<{ data: TaskAttachment[]; error?: string }> {
  try {
    const { tenantId } = await getAuthContext();
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("task_attachments")
      .select("*")
      .eq("task_id", taskId)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    if (error) return { data: [], error: error.message };
    // cleanup #18 — `inventory-photos` bucket is private. `file_url` is
    // a storage path going forward (legacy rows still hold a public
    // URL; signStoragePath handles both shapes). Resolve to a 7-day
    // signed URL before returning so the client can <a href=…> directly.
    const rows = data ?? [];
    const signed = await Promise.all(
      rows.map(async (row) => {
        const url = await signStoragePath(admin, "inventory-photos", row.file_url);
        return { ...row, file_url: url ?? row.file_url };
      }),
    );
    return { data: signed };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : "Error" };
  }
}

export async function addTaskAttachment(
  taskId: string,
  fileName: string,
  /**
   * Storage path inside the `inventory-photos` bucket (cleanup #18 —
   * caller uploads to private bucket and hands us the path). Stored
   * verbatim into `file_url` (legacy column name); resolved to a signed
   * URL on read.
   */
  filePath: string,
  fileType: string,
  fileSize: number
): Promise<{ data: TaskAttachment | null; error?: string }> {
  try {
    const { userId, tenantId } = await getAuthContext();
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("task_attachments")
      .insert({ task_id: taskId, tenant_id: tenantId, file_name: fileName, file_url: filePath, file_type: fileType, file_size: fileSize, uploaded_by: userId })
      .select("*")
      .single();

    if (error) return { data: null, error: error.message };

    // Side-effect — `task_activities` audit-trail entry for the attachment.
    // The `task_attachments` row above is the state-of-record (the file
    // pointer); the activity row is the per-task feed entry.
    const { error: attachActErr } = await admin.from("task_activities").insert({
      tenant_id: tenantId,
      task_id: taskId,
      user_id: userId,
      activity_type: "attachment_added",
      description: `Attached file: ${fileName}`,
    });
    if (attachActErr) {
      logger.error("[addTaskAttachment] task_activities attachment_added insert failed (non-fatal)", { taskId, err: attachActErr });
    }

    // Sentry serverless flush — drain queued logger.error capture before
    // the Lambda freezes on response return.
    await flushSentry();

    // Sign the just-stored path before returning so the client can link
    // straight away (matches the read shape from getTaskAttachments).
    const row = data as TaskAttachment;
    const signed = await signStoragePath(admin, "inventory-photos", row.file_url);
    return { data: { ...row, file_url: signed ?? row.file_url } };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : "Error" };
  }
}

export async function deleteTaskAttachment(attachmentId: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const { tenantId } = await getAuthContext();
    const admin = createAdminClient();
    // RBAC: attachment deletion on shared task entities is destructive
    // and unrecoverable — owner/manager only. Low-privilege roles can
    // still attach; they cannot wipe attachments uploaded by others.
    const authCtx = await requireAuth();
    if (!authCtx.isManager && !authCtx.isOwner) {
      return { error: "Only owner or manager can delete task attachments." };
    }
    const { error } = await admin.from("task_attachments").delete().eq("id", attachmentId).eq("tenant_id", tenantId);
    if (error) return { error: error.message };
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error" };
  }
}
