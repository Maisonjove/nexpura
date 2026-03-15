import { createAdminClient } from "@/lib/supabase/admin";
import DocumentCenterClient from "@/app/(app)/settings/documents/DocumentCenterClient";

const TENANT_ID = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";

export const revalidate = 60;

export default async function ReviewSettingsPage() {
  const admin = createAdminClient();

  let labelTemplates: Array<{ id: string; name: string; label_type: string; zpl_template: string; created_at: string }> = [];
  try {
    const { data } = await admin
      .from("label_templates")
      .select("id, name, label_type, zpl_template, created_at")
      .eq("tenant_id", TENANT_ID)
      .order("created_at", { ascending: false });
    labelTemplates = data ?? [];
  } catch {
    // graceful fallback
  }

  return (
    <DocumentCenterClient
      tenantId={TENANT_ID}
      labelTemplates={labelTemplates}
    />
  );
}
