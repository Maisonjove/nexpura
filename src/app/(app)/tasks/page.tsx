import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth-context";
import { getCached, tenantCacheKey } from "@/lib/cache";
import TasksClient from "./TasksClient";
import type { StaffTask } from "./actions";

export const metadata = { title: "Tasks — Nexpura" };

export default async function TasksPage() {
  const auth = await getAuthContext();
  if (!auth) redirect("/login");

  const { userId, tenantId, role, isManager } = auth;
  const admin = createAdminClient();

  // Narrowed columns — the tasks table includes free-text `description`,
  // `notes`, and linked-entity blobs that aren't shown in either the Kanban
  // or My-Tasks views. Pulling just the list-render fields cuts row size by
  // roughly 60-80% on real tasks.
  const TASK_LIST_COLUMNS =
    "id, title, description, status, priority, due_date, assigned_to, linked_type, linked_id, created_at, updated_at";

  // Parallel fetch - tasks + team members
  const [myTasksResult, allTasksResult, teamMembers] = await Promise.all([
    // My tasks - always fetch, bounded to 500 most-recent-by-due (any staff
    // member with >500 personal tasks should use a filter, not scroll).
    admin
      .from("tasks")
      .select(TASK_LIST_COLUMNS)
      .eq("tenant_id", tenantId)
      .eq("assigned_to", userId)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(500),

    // All tasks - only for managers/owners, bounded to 500 most-recent.
    // Previously unbounded — a mature tenant could pull thousands of rows
    // into the RSC on every /tasks nav. The Kanban view only needs enough
    // rows to fill the visible columns; older completed tasks aren't useful
    // there.
    isManager
      ? admin
          .from("tasks")
          .select(TASK_LIST_COLUMNS)
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(500)
      : Promise.resolve({ data: null }),

    // Team members - cache for 5 min (rarely changes)
    getCached(
      tenantCacheKey(tenantId, "team-members"),
      async () => {
        const { data } = await admin
          .from("users")
          .select("id, full_name, email")
          .eq("tenant_id", tenantId);
        return data ?? [];
      },
      300
    ),
  ]);

  return (
    <TasksClient
      userId={userId}
      userRole={role}
      myTasks={(myTasksResult.data ?? []) as unknown as StaffTask[]}
      allTasks={(allTasksResult.data ?? []) as unknown as StaffTask[]}
      teamMembers={teamMembers}
      tenantId={tenantId}
    />
  );
}
