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
    .select("role, tenants(business_mode)")
    .eq("id", user.id)
    .single();

  const currentUserRole = userData?.role ?? "staff";
  const businessMode = (userData?.tenants as { business_mode?: string } | null)?.business_mode || 'full';

  // R6-F2 (item 13): the prior SELECT listed `department` and
  // `last_login_at` — neither column exists on `team_members` (verified
  // against information_schema in prod 2026-05-06). PostgREST returns
  // an error for unknown columns and the destructured `data: members`
  // ends up null, so /settings/team rendered "No team members yet" for
  // every tenant — owner row included. The owner row IS in the table
  // (e.g. tenant 316a3313 has the hello@nexpura.com owner with
  // user_id+invite_accepted=true). The fix is purely the SELECT list;
  // the TeamMember type still permits both fields as nullable so the
  // UI's `m.last_login_at ?? '—'` rendering keeps working unchanged.
  const [{ data: members }, { data: tasks }, { data: locations }] = await Promise.all([
    admin
      .from("team_members")
      .select("id, name, email, role, invite_accepted, invite_expires_at, created_at, allowed_location_ids, notify_new_repairs, notify_new_bespoke")
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
    />
  );
}
