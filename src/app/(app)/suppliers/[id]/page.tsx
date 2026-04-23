import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect, notFound } from "next/navigation";
import { matchesReviewOrStaffToken } from "@/lib/auth/review";
import SupplierDetailClient from "./SupplierDetailClient";

const DEMO_TENANT = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";

export default async function SupplierDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ rt?: string }>;
}) {
  const { id } = await params;
  const sp = searchParams ? await searchParams : {};
  const admin = createAdminClient();

  let tenantId: string | null = null;
  // W7-HIGH-04: env-backed constant-time check.
  if (matchesReviewOrStaffToken(sp.rt)) {
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

  const { data: supplier } = await admin
    .from("suppliers")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .single();

  if (!supplier) notFound();

  return <SupplierDetailClient supplier={supplier} />;
}
