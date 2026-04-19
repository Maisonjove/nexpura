import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { unstable_cache } from "next/cache";
import { getAuthContext } from "@/lib/auth-context";
import { getCached, tenantCacheKey } from "@/lib/cache";
import { CACHE_TAGS } from "@/lib/cache-tags";
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

  // Both task lists are cached behind unstable_cache + the per-tenant
  // `tasks:{tenantId}` tag. tasks/actions.ts calls `revalidateTag` on every
  // create/update/delete so new tasks land on next nav without TTL wait.
  // Keyed on userId so the "My Tasks" slice doesn't accidentally leak
  // across staff members sharing a tenant.
  const fetchMyTasks = unstable_cache(
    async () => {
      const { data } = await admin
        .from("tasks")
        .select(TASK_LIST_COLUMNS)
        .eq("tenant_id", tenantId)
        .eq("assigned_to", userId)
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(500);
      return data ?? [];
    },
    ["tasks-my", tenantId, userId],
    { tags: [CACHE_TAGS.tasks(tenantId)], revalidate: 3600 }
  );

  const fetchAllTasks = unstable_cache(
    async () => {
      const { data } = await admin
        .from("tasks")
        .select(TASK_LIST_COLUMNS)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(500);
      return data ?? [];
    },
    ["tasks-all", tenantId],
    { tags: [CACHE_TAGS.tasks(tenantId)], revalidate: 3600 }
  );

  // Parallel fetch - tasks + team members
  const [myTasks, allTasks, teamMembers] = await Promise.all([
    fetchMyTasks(),
    isManager ? fetchAllTasks() : Promise.resolve([]),
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
      myTasks={myTasks as unknown as StaffTask[]}
      allTasks={allTasks as unknown as StaffTask[]}
      teamMembers={teamMembers}
      tenantId={tenantId}
    />
  );
}
