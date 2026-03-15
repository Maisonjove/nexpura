import { createAdminClient } from "@/lib/supabase/admin";
import WebsiteBuilderClient from "@/app/(app)/website/WebsiteBuilderClient";

const TENANT_ID = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";

export const revalidate = 60;

export default async function ReviewWebsitePage() {
  const admin = createAdminClient();

  const { data: config } = await admin
    .from("website_config")
    .select("*")
    .eq("tenant_id", TENANT_ID)
    .maybeSingle();

  return (
    <WebsiteBuilderClient
      initial={config}
      tenantId={TENANT_ID}
    />
  );
}
