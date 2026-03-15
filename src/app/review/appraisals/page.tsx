import { createAdminClient } from "@/lib/supabase/admin";
import AppraisalsClient from "@/app/(app)/appraisals/AppraisalsClient";

const TENANT_ID = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";

export const revalidate = 60;

export default async function ReviewAppraisalsPage() {
  const admin = createAdminClient();

  // appraisals table may not exist — graceful fallback
  let appraisals: unknown[] = [];
  try {
    const { data } = await admin
      .from("appraisals")
      .select("*")
      .eq("tenant_id", TENANT_ID)
      .order("created_at", { ascending: false });
    appraisals = data ?? [];
  } catch {
    // table doesn't exist — show empty state
  }

  const { data: customers } = await admin
    .from("customers")
    .select("id, first_name, last_name, email, phone")
    .eq("tenant_id", TENANT_ID)
    .order("first_name");

  return (
    <AppraisalsClient
      appraisals={appraisals as never[]}
      customers={customers ?? []}
      tenantId={TENANT_ID}
    />
  );
}
