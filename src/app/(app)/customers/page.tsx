import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth-context";
import CustomerListClient from "./CustomerListClient";

const DEMO_TENANT = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";
const REVIEW_TOKENS = ["nexpura-review-2026", "nexpura-staff-2026"];

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tag?: string; sort?: string; page?: string; rt?: string }>;
}) {
  const params = await searchParams;
  const q = params.q || "";
  const tagFilter = params.tag || "";
  const sort = params.sort || "created_at_desc";
  const page = parseInt(params.page || "1");
  const pageSize = 20;
  const offset = (page - 1) * pageSize;
  const admin = createAdminClient();

  // Check for review mode or auth
  let tenantId: string | null = null;
  if (params.rt && REVIEW_TOKENS.includes(params.rt)) {
    tenantId = DEMO_TENANT;
  } else {
    const auth = await getAuthContext();
    if (!auth) redirect("/login");
    tenantId = auth.tenantId;
  }

  let query = admin
    .from("customers")
    .select("id, full_name, first_name, last_name, email, phone, mobile, tags, is_vip, created_at, updated_at", { count: "exact" })
    .eq("tenant_id", tenantId)
    .is("deleted_at", null);

  if (q) {
    // Use similarity search if pg_trgm is available, fallback to ilike
    query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,mobile.ilike.%${q}%`);
  }

  if (tagFilter) {
    query = query.contains("tags", [tagFilter]);
  }

  // Sort
  if (sort === "name_asc") query = query.order("full_name", { ascending: true });
  else if (sort === "name_desc") query = query.order("full_name", { ascending: false });
  else if (sort === "updated_asc") query = query.order("updated_at", { ascending: true });
  else if (sort === "updated_desc") query = query.order("updated_at", { ascending: false });
  else query = query.order("created_at", { ascending: sort === "created_at_asc" });

  query = query.range(offset, offset + pageSize - 1);

  const { data: customers, count } = await query;
  const totalPages = Math.ceil((count || 0) / pageSize);

  return (
    <CustomerListClient
      customers={customers || []}
      totalCount={count || 0}
      page={page}
      totalPages={totalPages}
      q={q}
      tagFilter={tagFilter}
      sort={sort}
    />
  );
}
