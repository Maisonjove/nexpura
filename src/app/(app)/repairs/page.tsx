import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth-context";
import RepairsListClient from "./RepairsListClient";

const DEMO_TENANT = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";
const REVIEW_TOKENS = ["nexpura-review-2026", "nexpura-staff-2026"];

export default async function RepairsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string; stage?: string; rt?: string }>;
}) {
  const params = await searchParams;
  const view = params.view || "pipeline";
  const q = params.q || "";
  const stageFilter = params.stage || "";
  const admin = createAdminClient();

  // Check for review mode or auth
  let tenantId: string | null = null;
  let canView = false;
  const isReviewMode = !!(params.rt && REVIEW_TOKENS.includes(params.rt));
  
  if (isReviewMode) {
    tenantId = DEMO_TENANT;
    canView = true;
  } else {
    const auth = await getAuthContext();
    if (!auth) redirect("/login");
    tenantId = auth.tenantId;
    canView = auth.permissions.view_repairs;
  }

  if (!canView) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <h1 className="text-2xl font-semibold text-stone-900 mb-3">Access Denied</h1>
        <p className="text-stone-500">You don&apos;t have permission to view repairs.</p>
      </div>
    );
  }

  // Build query with minimal fields for list view
  let query = admin
    .from("repairs")
    .select(
      `id, repair_number, item_type, item_description, repair_type, stage, priority, due_date, created_at,
       customers(id, full_name)`
    )
    .eq("tenant_id", tenantId)
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
