import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import RolesClient from "./RolesClient";

export const metadata = { title: "Roles & Permissions — Nexpura" };

export default async function RolesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  // Get user's tenant
  const { data: userData } = await admin
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  
  if (!userData?.tenant_id) redirect("/onboarding");
  const tenantId = userData.tenant_id;
  
  // Fetch team members with their permissions
  const { data: members, error: membersError } = await admin
    .from("team_members")
    .select("id, user_id, name, email, role, permissions, allowed_location_ids, default_location_id, invite_accepted, phone_number, whatsapp_notifications_enabled")
    .eq("tenant_id", tenantId)
    .order("name");

  if (membersError) {
    console.error("Error fetching team members:", membersError);
  }

  // Fetch locations for this tenant
  const { data: locations, error: locationsError } = await admin
    .from("locations")
    .select("id, name, type, is_active")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("name");

  if (locationsError) {
    console.error("Error fetching locations:", locationsError);
  }

  // Get current user's role
  const currentMember = members?.find(m => m.user_id === user.id);
  const isOwnerOrManager = currentMember?.role === "owner" || currentMember?.role === "manager";

  return (
    <RolesClient 
      members={members ?? []} 
      locations={locations ?? []}
      isOwnerOrManager={isOwnerOrManager}
      tenantId={tenantId}
    />
  );
}
