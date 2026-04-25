import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import SaleDetailClient from "./SaleDetailClient";
import { resolveReadLocationScope } from "@/lib/location-read-scope";

export default async function SaleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  const adminClient = createAdminClient();

  const { data: sale } = await adminClient
    .from("sales")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenantId ?? "")
    .single();

  if (!sale) notFound();

  // Location-scope read guard — see src/lib/location-read-scope.ts.
  if (user?.id && tenantId && sale.location_id) {
    const scope = await resolveReadLocationScope(user.id, tenantId);
    if (!scope.all && !scope.allowedIds.includes(sale.location_id)) notFound();
  }

  const { data: items } = await adminClient
    .from("sale_items")
    .select("*")
    .eq("sale_id", id)
    .order("created_at", { ascending: true });

  const { data: invoiceRow } = await adminClient
    .from("invoices")
    .select("id")
    .eq("sale_id", id)
    .eq("tenant_id", tenantId ?? "")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const invoiceId = invoiceRow?.id ?? null;

  // Fetch layby payments if this is a layby sale.
  // Schema columns are paid_at + paid_by (the older payment_date / received_by
  // names never existed on this table; using them returns column-not-found
  // and 500s the sale-detail page on every layby sale).
  let laybyPayments: Array<{ id: string; amount: number; payment_method: string; paid_at: string; notes: string | null }> = [];
  if (sale.status === "layby" || sale.payment_method === "layby") {
    const { data: payments } = await adminClient
      .from("layby_payments")
      .select("id, amount, payment_method, paid_at, notes")
      .eq("sale_id", id)
      .eq("tenant_id", tenantId ?? "")
      .order("paid_at", { ascending: true });
    laybyPayments = payments ?? [];
  }

  return <SaleDetailClient sale={sale} items={items ?? []} initialInvoiceId={invoiceId} laybyPayments={laybyPayments} />;
}
