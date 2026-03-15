import { createAdminClient } from "@/lib/supabase/admin";
import RepairsListClient from "@/app/(app)/repairs/RepairsListClient";

const TENANT_ID = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";

export const revalidate = 60;

export default async function ReviewRepairsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string; stage?: string }>;
}) {
  const params = await searchParams;
  const view = params.view || "pipeline";
  const q = params.q || "";
  const stageFilter = params.stage || "";

  const admin = createAdminClient();

  let query = admin
    .from("repairs")
    .select(
      `id, repair_number, item_type, item_description, repair_type, stage, priority, due_date, created_at,
       customers(id, full_name)`
    )
    .eq("tenant_id", TENANT_ID)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (q) {
    query = query.or(
      `repair_number.ilike.%${q}%,item_description.ilike.%${q}%,repair_type.ilike.%${q}%`
    );
  }
  if (stageFilter) {
    query = query.eq("stage", stageFilter);
  }

  const { data: rawRepairs } = await query;

  const repairs = (rawRepairs || []).map((r) => ({
    ...r,
    customers: Array.isArray(r.customers)
      ? (r.customers[0] ?? null)
      : r.customers,
  }));

  return (
    <RepairsListClient
      repairs={repairs}
      view={view}
      q={q}
      stageFilter={stageFilter}
    />
  );
}
