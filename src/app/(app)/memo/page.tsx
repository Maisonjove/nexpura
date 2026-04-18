import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { AUTH_HEADERS } from "@/lib/cached-auth";
import MemoListClient from "./MemoListClient";

export const metadata = { title: "Memo & Consignment — Nexpura" };

export default async function MemoPage() {
  const headersList = await headers();
  const tenantId = headersList.get(AUTH_HEADERS.TENANT_ID);
  if (!tenantId) redirect("/login");

  const admin = createAdminClient();
  const [{ data: memoItems }, { data: customers }, { data: suppliers }] = await Promise.all([
    admin
      .from("memo_items")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
    admin
      .from("customers")
      .select("id, first_name, last_name, email")
      .eq("tenant_id", tenantId)
      .order("first_name"),
    admin
      .from("suppliers")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .order("name"),
  ]);

  return (
    <MemoListClient
      items={memoItems ?? []}
      customers={customers ?? []}
      suppliers={suppliers ?? []}
      tenantId={tenantId}
    />
  );
}
