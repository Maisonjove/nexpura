import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import MembershipsClient from "./MembershipsClient";

const OWNER_EMAIL = "germanijoey@yahoo.com";

export const metadata = { title: "All Memberships — Nexpura Owner Portal" };

export default async function OwnerMembershipsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.email !== OWNER_EMAIL) {
    redirect("/owner-admin");
  }

  const admin = createAdminClient();

  // Fetch all tenants with their subscriptions and owner info
  const [tenantsResult, subscriptionsResult, ownersResult, accessRequestsResult] = await Promise.all([
    admin
      .from("tenants")
      .select("id, name, slug, business_type, created_at")
      .order("created_at", { ascending: false }),
    admin
      .from("subscriptions")
      .select("*")
      .order("created_at", { ascending: false }),
    admin
      .from("users")
      .select("id, tenant_id, email, full_name, role")
      .eq("role", "owner"),
    admin
      .from("owner_access_requests")
      .select("*")
      .in("status", ["pending", "approved"]),
  ]);

  const tenants = tenantsResult.data ?? [];
  const subscriptions = subscriptionsResult.data ?? [];
  const owners = ownersResult.data ?? [];
  const accessRequests = accessRequestsResult.data ?? [];

  // Create lookup maps
  const subMap: Record<string, typeof subscriptions[0]> = {};
  for (const sub of subscriptions) {
    subMap[sub.tenant_id] = sub;
  }

  const ownerMap: Record<string, typeof owners[0]> = {};
  for (const owner of owners) {
    ownerMap[owner.tenant_id] = owner;
  }

  const accessRequestMap: Record<string, typeof accessRequests[0]> = {};
  for (const req of accessRequests) {
    if (req.status === "approved" || req.status === "pending") {
      accessRequestMap[req.tenant_id] = req;
    }
  }

  // Build tenant data for client component
  const tenantData = tenants.map((tenant) => {
    const sub = subMap[tenant.id];
    const owner = ownerMap[tenant.id];
    const accessRequest = accessRequestMap[tenant.id];

    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      businessType: tenant.business_type,
      createdAt: tenant.created_at,
      owner: owner ? {
        id: owner.id,
        email: owner.email,
        fullName: owner.full_name,
      } : null,
      subscription: sub ? {
        id: sub.id,
        plan: sub.plan,
        status: sub.status,
        trialEndsAt: sub.trial_ends_at,
        currentPeriodEnd: sub.current_period_end,
        stripeCustomerId: sub.stripe_customer_id,
        stripeSubscriptionId: sub.stripe_subscription_id,
      } : null,
      accessRequest: accessRequest ? {
        id: accessRequest.id,
        status: accessRequest.status,
        expiresAt: accessRequest.expires_at,
      } : null,
    };
  });

  return <MembershipsClient tenants={tenantData} />;
}
