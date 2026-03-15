import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
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

  const [tenantResult, insuranceResult] = await Promise.all([
    admin.from("tenants").select("name, email, phone, address").eq("id", userData.tenant_id).single(),
    admin.from("integrations").select("config").eq("tenant_id", userData.tenant_id).eq("type", "insurance").maybeSingle(),
  ]);

  const tenant = tenantResult.data;
  const insuranceEnabled = (insuranceResult.data?.config as Record<string, unknown> | null)?.enabled === true;

  return (
    <AppraisalDetailClient
      appraisal={appraisal}
      tenant={tenant}
      userId={user.id}
      insuranceEnabled={insuranceEnabled}
    />
  );
}
