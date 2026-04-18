import { createAdminClient } from "@/lib/supabase/admin";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_HEADERS } from "@/lib/cached-auth";
import SupplierListClient from "./SupplierListClient";

const DEMO_TENANT = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";
const REVIEW_TOKENS = ["nexpura-review-2026", "nexpura-staff-2026"];

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams?: Promise<{ rt?: string }>;
}) {
  const [params, headersList] = await Promise.all([
    searchParams ? searchParams : Promise.resolve({} as { rt?: string }),
    headers(),
  ]);
  const admin = createAdminClient();

  let tenantId: string | null;
  if (params.rt && REVIEW_TOKENS.includes(params.rt)) {
    tenantId = DEMO_TENANT;
  } else {
    // Middleware already resolved tenant for authenticated requests
    tenantId = headersList.get(AUTH_HEADERS.TENANT_ID);
    if (!tenantId) redirect("/login");
  }

  const { data: suppliers } = await admin
    .from("suppliers")
    .select("id, name, contact_name, email, phone, website, created_at")
    .eq("tenant_id", tenantId)
    .order("name", { ascending: true });

  return <SupplierListClient suppliers={suppliers ?? []} />;
}
