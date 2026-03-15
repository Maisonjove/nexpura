import { createAdminClient } from "@/lib/supabase/admin";
import MemoListClient from "@/app/(app)/memo/MemoListClient";

const TENANT_ID = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";

export const revalidate = 60;

export default async function ReviewMemoPage() {
  const admin = createAdminClient();

  // memo_items table may not exist — graceful fallback
  let memoItems: unknown[] = [];
  try {
    const { data } = await admin
      .from("memo_items")
      .select("*")
      .eq("tenant_id", TENANT_ID)
      .order("created_at", { ascending: false });
    memoItems = data ?? [];
  } catch {
    // table doesn't exist — show empty state
  }

  const { data: customers } = await admin
    .from("customers")
    .select("id, first_name, last_name, email")
    .eq("tenant_id", TENANT_ID)
    .order("first_name");

  const { data: suppliers } = await admin
    .from("suppliers")
    .select("id, name")
    .eq("tenant_id", TENANT_ID)
    .order("name");

  return (
    <MemoListClient
      items={memoItems as never[]}
      customers={customers ?? []}
      suppliers={suppliers ?? []}
      tenantId={TENANT_ID}
    />
  );
}
