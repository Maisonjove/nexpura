import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import BulkEmailClient from "./BulkEmailClient";

export const metadata = { title: "Bulk Email — Nexpura" };

export default async function BulkEmailPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();

  const { data: userData } = await admin
    .from("users")
    .select("tenant_id, tenants(name, business_name)")
    .eq("id", user?.id ?? "")
    .single();

  const tenantId = userData?.tenant_id ?? "";
  const tenantData = userData?.tenants as { name?: string; business_name?: string } | null;
  const businessName = tenantData?.business_name || tenantData?.name || "Business";

  // Fetch segments
  const { data: segments } = await admin
    .from("customer_segments")
    .select("id, name, customer_count")
    .eq("tenant_id", tenantId)
    .order("name");

  // Fetch customer tags
  const { data: customers } = await admin
    .from("customers")
    .select("id, full_name, email, tags")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .not("email", "is", null)
    .order("full_name");

  const allTags = [...new Set((customers || []).flatMap((c) => c.tags || []))].sort();

  return (
    <BulkEmailClient
      segments={segments || []}
      customers={customers || []}
      tags={allTags}
      businessName={businessName}
    />
  );
}
