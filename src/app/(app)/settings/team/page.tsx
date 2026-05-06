import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { getEntitlementContext } from "@/lib/auth/entitlements";
import { PLAN_FEATURES, PLAN_NAMES, PlanId } from "@/lib/plans";
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
    .select("role, tenants(business_mode, require_2fa_for_staff)")
    .eq("id", user.id)
    .single();

  const currentUserRole = userData?.role ?? "staff";
  const tenantsField = userData?.tenants as
    | { business_mode?: string; require_2fa_for_staff?: boolean | null }
    | null;
  const businessMode = tenantsField?.business_mode || 'full';
  const require2faForStaff = tenantsField?.require_2fa_for_staff === true;

  const [{ data: members }, { data: tasks }, { data: locations }] = await Promise.all([
    admin
      .from("team_members")
      .select("id, name, email, role, department, last_login_at, invite_accepted, invite_expires_at, created_at, allowed_location_ids, notify_new_repairs, notify_new_bespoke")
      .eq("tenant_id", ctx.tenantId)
      .order("created_at", { ascending: true }),
    supabase
      .from("tasks")
      .select("*")
      .eq("tenant_id", ctx.tenantId)
      .order("created_at", { ascending: false }),
    supabase
      .from("locations")
      .select("id, name, type, is_active")
      .eq("tenant_id", ctx.tenantId)
      .eq("is_active", true)
      .order("name"),
  ]);

  const maxUsers = PLAN_FEATURES[ctx.plan as PlanId]?.staffLimit ?? null;
  const currentUsers = members?.length ?? 0;
  const isAtLimit = maxUsers !== null && currentUsers >= maxUsers;

  return (
    <TeamClient
      members={members ?? []}
      tasks={tasks ?? []}
      currentUserRole={currentUserRole}
      businessMode={businessMode}
      plan={ctx.plan}
      planName={PLAN_NAMES[ctx.plan as PlanId]}
      maxUsers={maxUsers}
      isAtLimit={isAtLimit}
      locations={locations ?? []}
      require2faForStaff={require2faForStaff}
    />
  );
}
