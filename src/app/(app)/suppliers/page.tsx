import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import SupplierListClient from "./SupplierListClient";

const DEMO_TENANT = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";
const REVIEW_TOKENS = ["nexpura-review-2026", "nexpura-staff-2026"];

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams?: Promise<{ rt?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const admin = createAdminClient();

  // Inline review check — URL param is the most reliable signal.
  // Does not depend on middleware, cookies, or dynamic imports.
  let tenantId: string | null = null;
  if (params.rt && REVIEW_TOKENS.includes(params.rt)) {
    tenantId = DEMO_TENANT;
  } else {
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: ud } = await admin.from("users").select("tenant_id").eq("id", user.id).single();
        tenantId = ud?.tenant_id ?? null;
      }
    } catch { /* no session */ }
    if (!tenantId) redirect("/login");
  }

  const { data: suppliers } = await admin
    .from("suppliers")
    .select("id, name, contact_name, email, phone, website, created_at")
    .eq("tenant_id", tenantId)
    .order("name", { ascending: true });

  return <SupplierListClient suppliers={suppliers ?? []} />;
}
