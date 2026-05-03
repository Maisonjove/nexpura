import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import Link from "next/link";
import CustomerReportClient, { CustomerRow } from "./CustomerReportClient";

export const metadata = { title: "Customer Reports — Nexpura" };

export default async function CustomerReportsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  const tenantId = userData?.tenant_id ?? "";
  if (!tenantId) redirect("/onboarding");

  const allowed = await hasPermission(user.id, tenantId, "access_reports");
  if (!allowed) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <h1 className="text-2xl font-semibold text-stone-900 mb-3">Access Denied</h1>
        <p className="text-stone-500">You don&apos;t have permission to access Reports.</p>
      </div>
    );
  }

  const admin = createAdminClient();

  const { data: customers } = await admin
    .from("customers")
    .select("id, full_name, email, is_vip, store_credit, sales(total)")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null);

  const rows: CustomerRow[] = (customers || []).map((c) => {
    const sales = (c.sales as Array<{ total: number | null }> | null) || [];
    const totalSpend = sales.reduce((sum, s) => sum + (Number(s.total) || 0), 0);
    return {
      id: c.id,
      full_name: c.full_name,
      email: c.email,
      is_vip: !!c.is_vip,
      store_credit: Number(c.store_credit) || 0,
      totalSpend,
      saleCount: sales.length,
    };
  });

  return (
    <div className="max-w-6xl mx-auto py-10 px-4 space-y-8">
      <div>
        <div className="flex items-center gap-2 text-sm text-stone-400 mb-1">
          <Link href="/reports" className="hover:text-amber-700">Reports</Link>
          <span>/</span>
          <span className="text-stone-600">Customers</span>
        </div>
        <h1 className="text-2xl font-semibold text-stone-900">Customer Intelligence</h1>
        <p className="text-sm text-stone-500 mt-1">Analyze customer behavior, spend, and loyalty metrics</p>
      </div>

      <CustomerReportClient customers={rows} />
    </div>
  );
}
