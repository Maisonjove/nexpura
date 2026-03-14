import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import MemoListClient from "./MemoListClient";

export const metadata = { title: "Memo & Consignment — Nexpura" };

export default async function MemoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id, role")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) redirect("/login");
  const tenantId = userData.tenant_id;

  const admin = createAdminClient();
  const { data: memoItems } = await admin
    .from("memo_items")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  const { data: customers } = await admin
    .from("customers")
    .select("id, first_name, last_name, email")
    .eq("tenant_id", tenantId)
    .order("first_name");

  const { data: suppliers } = await admin
    .from("suppliers")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .order("name");

  return (
    <MemoListClient
      items={memoItems ?? []}
      customers={customers ?? []}
      suppliers={suppliers ?? []}
      tenantId={tenantId}
    />
  );
}
