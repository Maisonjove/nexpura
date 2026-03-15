import { createAdminClient } from "@/lib/supabase/admin";
import BespokeListClient from "@/app/(app)/bespoke/BespokeListClient";

const TENANT_ID = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";

export const revalidate = 60;

export default async function ReviewBespokePage({
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
    .from("bespoke_jobs")
    .select(
      `id, job_number, title, stage, priority, due_date, created_at,
       customers(id, full_name)`
    )
    .eq("tenant_id", TENANT_ID)
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
