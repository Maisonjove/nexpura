import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import TeamClient from "./TeamClient";

export const metadata = { title: "Team — Nexpura" };

export default async function TeamPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id, role, tenants(business_mode)")
    .eq("id", user.id)
    .single();

  const tenantId = userData?.tenant_id;
  const currentUserRole = userData?.role ?? "staff";
  const businessMode = (userData?.tenants as any)?.business_mode || 'full';

  const [{ data: members }, { data: tasks }] = await Promise.all([
    supabase
      .from("team_members")
      .select("id, name, email, role, department, last_login_at, invite_accepted, created_at")
      .eq("tenant_id", tenantId ?? "")
      .order("created_at", { ascending: true }),
    supabase
      .from("tasks")
      .select("*")
      .eq("tenant_id", tenantId ?? "")
      .order("created_at", { ascending: false }),
  ]);

  return (
    <TeamClient
      members={members ?? []}
      tasks={tasks ?? []}
      currentUserRole={currentUserRole}
      businessMode={businessMode}
    />
  );
}
