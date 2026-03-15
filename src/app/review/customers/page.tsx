import { createAdminClient } from "@/lib/supabase/admin";
import CustomerListClient from "@/app/(app)/customers/CustomerListClient";

const TENANT_ID = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";

export const revalidate = 60;

export default async function ReviewCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tag?: string; sort?: string; page?: string }>;
}) {
  const params = await searchParams;
  const q = params.q || "";
  const tagFilter = params.tag || "";
  const sort = params.sort || "created_at_desc";
  const page = parseInt(params.page || "1");
  const pageSize = 20;
  const offset = (page - 1) * pageSize;

  const admin = createAdminClient();

  let query = admin
    .from("customers")
    .select("id, full_name, first_name, last_name, email, phone, mobile, tags, is_vip, created_at, updated_at", { count: "exact" })
    .eq("tenant_id", TENANT_ID)
    .is("deleted_at", null);

  if (q) {
    query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,mobile.ilike.%${q}%`);
  }

  if (tagFilter) {
    query = query.contains("tags", [tagFilter]);
  }

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
