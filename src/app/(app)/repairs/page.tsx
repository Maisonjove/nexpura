import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getAuthContext } from "@/lib/auth-context";
import { AUTH_HEADERS } from "@/lib/cached-auth";
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

  const isReviewMode = !!(params.rt && REVIEW_TOKENS.includes(params.rt));

  // Resolve tenantId instantly from middleware headers (no Supabase round-trip).
  // For review mode: use the demo tenant constant.
  let tenantId: string;
  if (isReviewMode) {
    tenantId = DEMO_TENANT;
  } else {
    const headersList = await headers();
    const headerTenantId = headersList.get(AUTH_HEADERS.TENANT_ID);
    if (!headerTenantId) redirect("/login");
    tenantId = headerTenantId;
  }

  // Load the 200 most-recent repairs once. Stage filtering is now entirely
  // client-side — previously each tab click triggered a full server round-trip
  // (~3.5s observed) to re-query the same rows with a different `.eq("stage", …)`.
  // With 200 rows already on the client, filtering them by stage via useMemo
  // is ~1ms and feels instant.
  //
  // Server-side `q` (search) is preserved so deep-links like `?q=REP-047`
  // and the camera-scanner fallback still work for repairs older than the
  // recent 200.
  let query = admin
    .from("repairs")
    .select(
      `id, repair_number, item_type, item_description, repair_type, stage, priority, due_date, created_at,
      customers(id, full_name)`
    )
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200);

  if (q) {
    query = query.or(
      `repair_number.ilike.%${q}%,item_description.ilike.%${q}%,repair_type.ilike.%${q}%`
    );
  }

  // Run auth AND data query IN PARALLEL — no sequential waterfall.
  // Previously auth (~20-40ms) had to complete before the DB query could start.
  const [auth, { data: rawRepairs }] = await Promise.all([
    isReviewMode ? Promise.resolve(null) : getAuthContext(),
    query,
  ]);

  if (!isReviewMode && !auth) redirect("/login");

  const canView = isReviewMode ? true : (auth?.permissions.view_repairs ?? false);

  if (!canView) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <h1 className="text-2xl font-semibold text-stone-900 mb-3">Access Denied</h1>
        <p className="text-stone-500">You don&apos;t have permission to view repairs.</p>
      </div>
    );
  }

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
