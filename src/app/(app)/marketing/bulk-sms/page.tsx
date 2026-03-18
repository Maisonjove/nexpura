import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import BulkSMSClient from "./BulkSMSClient";

export const metadata = { title: "Bulk SMS — Nexpura" };

export default async function BulkSMSPage() {
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

  // Check if Twilio is configured
  const { data: integration } = await admin
    .from("tenant_integrations")
    .select("settings")
    .eq("tenant_id", tenantId)
    .eq("integration_type", "twilio")
    .single();

  const twilioSettings = integration?.settings as {
    account_sid?: string;
    auth_token?: string;
    phone_number?: string;
  } | null;
  const twilioConfigured = !!(
    twilioSettings?.account_sid &&
    twilioSettings?.auth_token &&
    twilioSettings?.phone_number
  );

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
    .order("full_name");

  const allTags = [...new Set((customers || []).flatMap((c) => c.tags || []))].sort();

  return (
    <BulkSMSClient
      segments={segments || []}
      customers={customers || []}
      tags={allTags}
      businessName={businessName}
      twilioConfigured={twilioConfigured}
    />
  );
}
