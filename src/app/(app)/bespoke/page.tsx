import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import BespokeListClient from "./BespokeListClient";

export default async function BespokePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string; stage?: string }>;
}) {
  const params = await searchParams;
  const view = params.view || "pipeline";
  const q = params.q || "";
  const stageFilter = params.stage || "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user?.id ?? "")
    .single();

  const tenantId = userData?.tenant_id;

  let query = supabase
    .from("bespoke_jobs")
    .select(
      `id, job_number, title, stage, priority, due_date, created_at,
       customers(id, full_name)`
    )
    .eq("tenant_id", tenantId ?? "")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (q) {
    query = query.or(`title.ilike.%${q}%,job_number.ilike.%${q}%`);
  }
  if (stageFilter) {
    query = query.eq("stage", stageFilter);
  }

  const { data: rawJobs } = await query;

  // Normalise customers field — Supabase may return array or object depending on generated types
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
