import { createAdminClient } from "@/lib/supabase/admin";
import { Suspense } from "react";
import TasksClient from "@/app/(app)/tasks/TasksClient";
import type { StaffTask } from "@/app/(app)/tasks/actions";

const TENANT_ID = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";
const DEMO_USER_ID = "bd7d2c20-5727-4f80-a449-818429abecc9";

export const revalidate = 60;

export default async function ReviewTasksPage() {
  const admin = createAdminClient();

  let myTasks: StaffTask[] = [];
  let allTasks: StaffTask[] = [];

  // Try staff_tasks first, fall back to tasks table, then empty
  try {
    const { data: myTasksData } = await admin
      .from("staff_tasks")
      .select("*")
      .eq("tenant_id", TENANT_ID)
      .eq("assigned_to", DEMO_USER_ID)
      .order("due_date", { ascending: true, nullsFirst: false });
    myTasks = (myTasksData ?? []) as StaffTask[];

    const { data: allTasksData } = await admin
      .from("staff_tasks")
      .select("*")
      .eq("tenant_id", TENANT_ID)
      .order("created_at", { ascending: false });
    allTasks = (allTasksData ?? []) as StaffTask[];
  } catch {
    // staff_tasks doesn't exist — try tasks table
    try {
      const { data: tasksData } = await admin
        .from("tasks")
        .select("id, tenant_id, title, description, assigned_to, created_by, linked_type, linked_id, due_date, priority, status, notes, created_at, updated_at")
        .eq("tenant_id", TENANT_ID)
        .order("due_date", { ascending: true, nullsFirst: false });

      myTasks = (tasksData ?? []).filter((t) => t.assigned_to === DEMO_USER_ID || !t.assigned_to) as StaffTask[];
      allTasks = (tasksData ?? []) as StaffTask[];
    } catch {
      // both fail — empty state
    }
  }

  const { data: teamMembers } = await admin
    .from("users")
    .select("id, full_name, email")
    .eq("tenant_id", TENANT_ID);

  return (
    <Suspense fallback={<div className="p-8 text-stone-400 text-sm">Loading tasks...</div>}>
      <TasksClient
        userId={DEMO_USER_ID}
        userRole="owner"
        myTasks={myTasks}
        allTasks={allTasks}
        teamMembers={teamMembers ?? []}
        tenantId={TENANT_ID}
      />
    </Suspense>
  );
}
