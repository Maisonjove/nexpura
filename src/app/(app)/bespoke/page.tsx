import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import BespokeListClient from "./BespokeListClient";
import { hasPermission } from "@/lib/permissions";

const DEMO_TENANT = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";
const REVIEW_TOKENS = ["nexpura-review-2026", "nexpura-staff-2026"];

export default async function BespokePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string; stage?: string; rt?: string }>;
}) {
  const params = await searchParams;
  const view = params.view || "pipeline";
  const q = params.q || "";
  const stageFilter = params.stage || "";
  const admin = createAdminClient();

  // Inline review check — URL param is the most reliable signal.
  // Does not depend on middleware, cookies, or dynamic imports.
  let tenantId: string | null = null;
  let userId: string | null = null;
  let isReviewMode = false;
  
  if (params.rt && REVIEW_TOKENS.includes(params.rt)) {
    tenantId = DEMO_TENANT;
    isReviewMode = true;
  } else {
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        userId = user.id;
        const { data: ud } = await admin.from("users").select("tenant_id").eq("id", user.id).single();
        tenantId = ud?.tenant_id ?? null;
      }
    } catch { /* no session */ }
    if (!tenantId) redirect("/login");
  }

  // Check permission - skip for review mode
  if (!isReviewMode && userId && tenantId) {
    const canView = await hasPermission(userId, tenantId, "view_bespoke");
    if (!canView) {
      return (
        <div className="max-w-2xl mx-auto py-16 text-center">
          <h1 className="text-2xl font-semibold text-stone-900 mb-3">Access Denied</h1>
          <p className="text-stone-500">You don&apos;t have permission to view custom orders.</p>
        </div>
      );
    }
  }

  let query = admin
    .from("bespoke_jobs")
    .select(
      `id, job_number, title, stage, priority, due_date, created_at,
       customers(id, full_name)`
    )
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (q) {
    query = query.or(`title.ilike.%${q}%,job_number.ilike.%${q}%`);
  }
  if (stageFilter) {
    query = query.eq("stage", stageFilter);
  }

  const { data: rawJobs } = await query;

  const jobs = (rawJobs || []).map((j) => ({
    ...j,
    customers: Array.isArray(j.customers) ? (j.customers[0] ?? null) : j.customers,
  }));

  return (
    <BespokeListClient
      jobs={jobs}
      view={view}
      q={q}
      stageFilter={stageFilter}
    />
  );
}
