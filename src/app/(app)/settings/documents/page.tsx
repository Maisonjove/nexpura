import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import DocumentCenterClient from "./DocumentCenterClient";

export const metadata = { title: "Document Center — Nexpura" };

export default async function DocumentCenterPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) redirect("/onboarding");

  const tenantId = userData.tenant_id;
  const admin = createAdminClient();

  const { data: labelTemplates } = await admin
    .from("label_templates")
    .select("id, name, label_type, zpl_template, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  return (
    <DocumentCenterClient
      tenantId={tenantId}
      labelTemplates={labelTemplates ?? []}
    />
  );
}
