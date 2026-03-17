import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import AccessRequestsClient from "./AccessRequestsClient";

const OWNER_EMAIL = "germanijoey@yahoo.com";

export const metadata = { title: "Access Requests — Nexpura Owner Portal" };

export default async function AccessRequestsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.email !== OWNER_EMAIL) {
    redirect("/owner-admin");
  }

  const admin = createAdminClient();

  // Fetch all access requests with tenant info
  const { data: requests } = await admin
    .from("owner_access_requests")
    .select("*, tenants(id, name, slug)")
    .order("requested_at", { ascending: false });

  const accessRequests = (requests ?? []).map((r) => ({
    id: r.id,
    tenantId: r.tenant_id,
    tenantName: (r.tenants as { name: string } | null)?.name ?? "Unknown",
    tenantSlug: (r.tenants as { slug: string } | null)?.slug ?? null,
    status: r.status as "pending" | "approved" | "denied" | "expired" | "revoked",
    requestedAt: r.requested_at,
    approvedAt: r.approved_at,
    expiresAt: r.expires_at,
    revokedAt: r.revoked_at,
    notes: r.notes,
  }));

  return <AccessRequestsClient requests={accessRequests} />;
}
