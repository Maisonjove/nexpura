import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import NewWhatsAppCampaignClient from "./NewWhatsAppCampaignClient";

export const metadata = { title: "New WhatsApp Campaign — Nexpura" };

export default async function NewWhatsAppCampaignPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const admin = createAdminClient();

  const { data: userData } = await admin
    .from("users")
    .select("tenant_id, tenants(name, business_name)")
    .eq("id", user.id)
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

  // Fetch customers with phone numbers
  const { data: customers } = await admin
    .from("customers")
    .select("id, full_name, phone, tags")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .not("phone", "is", null)
    .order("full_name")
    .limit(500);

  const allTags = [...new Set((customers || []).flatMap((c) => c.tags || []))].sort();

  // Count total customers with phone
  const { count: totalCustomersWithPhone } = await admin
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .not("phone", "is", null);

  return (
    <NewWhatsAppCampaignClient
      segments={segments || []}
      customers={customers || []}
      tags={allTags}
      businessName={businessName}
      totalCustomersWithPhone={totalCustomersWithPhone || 0}
    />
  );
}
