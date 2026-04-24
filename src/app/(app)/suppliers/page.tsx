import { createAdminClient } from "@/lib/supabase/admin";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_HEADERS } from "@/lib/cached-auth";
import { matchesReviewOrStaffToken } from "@/lib/auth/review";
import SupplierListClient from "./SupplierListClient";

export const metadata = { title: "Suppliers — Nexpura" };

const DEMO_TENANT = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";

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
  // W7-HIGH-04: env-backed constant-time check.
  if (matchesReviewOrStaffToken(params.rt)) {
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
