import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import CustomerListClient from "./CustomerListClient";

export default async function CustomersPage({
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

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user?.id ?? "")
    .single();

  const tenantId = userData?.tenant_id;

  let query = supabase
    .from("customers")
    .select("id, full_name, first_name, last_name, email, phone, mobile, tags, is_vip, created_at, updated_at", { count: "exact" })
    .eq("tenant_id", tenantId ?? "")
    .is("deleted_at", null);

  if (q) {
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
