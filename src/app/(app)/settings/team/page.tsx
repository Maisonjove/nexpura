import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { getEntitlementContext } from "@/lib/auth/entitlements";
import { getMaxUsers, planDisplayName } from "@/lib/features";
import TeamClient from "./TeamClient";

export const metadata = { title: "Team — Nexpura" };

export default async function TeamPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const ctx = await getEntitlementContext();
  if (!ctx.tenantId) redirect("/login");

  const admin = createAdminClient();
  const { data: userData } = await admin
    .from("users")
    .select("role, tenants(business_mode)")
    .eq("id", user.id)
    .single();

  const currentUserRole = userData?.role ?? "staff";
  const businessMode = (userData?.tenants as any)?.business_mode || 'full';

  const [{ data: members }, { data: tasks }] = await Promise.all([
    supabase
      .from("team_members")
      .select("id, name, email, role, department, last_login_at, invite_accepted, created_at")
      .eq("tenant_id", ctx.tenantId)
      .order("created_at", { ascending: true }),
    supabase
      .from("tasks")
      .select("*")
      .eq("tenant_id", ctx.tenantId)
      .order("created_at", { ascending: false }),
  ]);

  const maxUsers = getMaxUsers(ctx.plan);
  const currentUsers = members?.length ?? 0;
  const isAtLimit = maxUsers !== null && currentUsers >= maxUsers;

  return (
    <TeamClient
      members={members ?? []}
      tasks={tasks ?? []}
      currentUserRole={currentUserRole}
      businessMode={businessMode}
      plan={ctx.plan}
      planName={planDisplayName(ctx.plan)}
      maxUsers={maxUsers}
      isAtLimit={isAtLimit}
    />
  );
}
