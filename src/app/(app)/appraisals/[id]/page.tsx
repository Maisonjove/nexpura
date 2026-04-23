import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getIntegration } from "@/lib/integrations";
import AppraisalDetailClient from "./AppraisalDetailClient";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  return { title: "Appraisal — Nexpura" };
}

export default async function AppraisalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id, role")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) redirect("/login");

  const admin = createAdminClient();
  const { data: appraisal } = await admin
    .from("appraisals")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", userData.tenant_id)
    .single();

  if (!appraisal) notFound();

  // Use getIntegration() so config is decrypted at the boundary
  // (W6-HIGH-12). The row's encrypted `config_encrypted` column isn't
  // selectable from client code — only decrypted plaintext reaches us.
  const [tenantResult, insuranceIntegration] = await Promise.all([
    admin.from("tenants").select("name, email, phone, address").eq("id", userData.tenant_id).single(),
    getIntegration(userData.tenant_id, "insurance"),
  ]);

  const tenant = tenantResult.data;
  const insuranceEnabled = insuranceIntegration?.config?.enabled === true;

  return (
    <AppraisalDetailClient
      appraisal={appraisal}
      tenant={tenant}
      userId={user.id}
      insuranceEnabled={insuranceEnabled}
    />
  );
}
