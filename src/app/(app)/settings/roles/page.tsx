import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { getEntitlementContext } from "@/lib/auth/entitlements";
import RolesClient from "./RolesClient";

export const metadata = { title: "Roles & Permissions — Nexpura" };

export default async function RolesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const ctx = await getEntitlementContext();
  if (!ctx.tenantId) redirect("/login");

  const admin = createAdminClient();
  
  // Fetch team members with their permissions
  const { data: members } = await admin
    .from("team_members")
    .select("id, user_id, name, email, role, permissions, allowed_location_ids, default_location_id, invite_accepted, phone_number, whatsapp_notifications_enabled")
    .eq("tenant_id", ctx.tenantId)
    .order("name");

  // Fetch locations for this tenant
  const { data: locations } = await admin
    .from("locations")
    .select("id, name, type, is_active")
    .eq("tenant_id", ctx.tenantId)
    .eq("is_active", true)
    .order("name");

  // Get current user's role
  const currentMember = members?.find(m => m.user_id === user.id);
  const isOwnerOrManager = currentMember?.role === "owner" || currentMember?.role === "manager";

  return (
    <RolesClient 
      members={members ?? []} 
      locations={locations ?? []}
      isOwnerOrManager={isOwnerOrManager}
      tenantId={ctx.tenantId}
    />
  );
}
