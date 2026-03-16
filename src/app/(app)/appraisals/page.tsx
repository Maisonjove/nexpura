import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import AppraisalsClient from "./AppraisalsClient";

export const metadata = { title: "Appraisals & Valuations — Nexpura" };

export default async function AppraisalsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: userData } = await admin
    .from("users")
    .select("tenant_id, role")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) redirect("/login");
  const tenantId = userData.tenant_id;

  const { data: appraisals } = await admin
    .from("appraisals")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  const { data: customers } = await admin
    .from("customers")
    .select("id, first_name, last_name, email, phone")
    .eq("tenant_id", tenantId)
    .order("first_name");

  return (
    <AppraisalsClient
      appraisals={appraisals ?? []}
      customers={customers ?? []}
      tenantId={tenantId}
    />
  );
}
