import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import RepairsListClient from "./RepairsListClient";

export default async function RepairsPage({
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
    .from("repairs")
    .select(
      `id, repair_number, item_type, item_description, repair_type, stage, priority, due_date, created_at,
       customers(id, full_name)`
    )
    .eq("tenant_id", tenantId ?? "")
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
