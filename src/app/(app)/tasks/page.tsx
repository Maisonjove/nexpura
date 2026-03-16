import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import TasksClient from "./TasksClient";

export const metadata = { title: "Tasks — Nexpura" };

export default async function TasksPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: userData } = await admin
    .from("users")
    .select("tenant_id, role")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) redirect("/onboarding");

  const tenantId = userData.tenant_id;
  const role = userData.role ?? "staff";

  // Fetch my tasks
  const { data: myTasks } = await admin
    .from("tasks")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("assigned_to", user.id)
    .order("due_date", { ascending: true, nullsFirst: false });

  // Fetch all tasks (for manager/owner)
  let allTasks = null;
  if (role === "owner" || role === "manager") {
    const { data } = await admin
      .from("tasks")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    allTasks = data;
  }

  // Fetch team members for assignee dropdown
  const { data: teamMembers } = await admin
    .from("users")
    .select("id, full_name, email")
    .eq("tenant_id", tenantId);

  return (
    <TasksClient
      userId={user.id}
      userRole={role}
      myTasks={myTasks ?? []}
      allTasks={allTasks ?? []}
      teamMembers={teamMembers ?? []}
      tenantId={tenantId}
    />
  );
}
