import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth-context";
import { getCached, tenantCacheKey } from "@/lib/cache";
import TasksClient from "./TasksClient";

export const metadata = { title: "Tasks — Nexpura" };

export default async function TasksPage() {
  const auth = await getAuthContext();
  if (!auth) redirect("/login");

  const { userId, tenantId, role, isManager } = auth;
  const admin = createAdminClient();

  // Parallel fetch - tasks + team members
  const [myTasksResult, allTasksResult, teamMembers] = await Promise.all([
    // My tasks - always fetch
    admin
      .from("tasks")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("assigned_to", userId)
      .order("due_date", { ascending: true, nullsFirst: false }),

    // All tasks - only for managers/owners
    isManager
      ? admin
          .from("tasks")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
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
      myTasks={myTasksResult.data ?? []}
      allTasks={allTasksResult.data ?? []}
      teamMembers={teamMembers}
      tenantId={tenantId}
    />
  );
}
