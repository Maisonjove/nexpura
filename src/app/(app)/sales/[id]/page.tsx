import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import SaleDetailClient from "./SaleDetailClient";

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

  // Fetch layby payments if this is a layby sale
  let laybyPayments: Array<{ id: string; amount: number; payment_method: string; payment_date: string; notes: string | null }> = [];
  if (sale.status === "layby" || sale.payment_method === "layby") {
    const { data: payments } = await adminClient
      .from("layby_payments")
      .select("id, amount, payment_method, payment_date, notes")
      .eq("sale_id", id)
      .eq("tenant_id", tenantId ?? "")
      .order("payment_date", { ascending: true });
    laybyPayments = payments ?? [];
  }

  return <SaleDetailClient sale={sale} items={items ?? []} initialInvoiceId={invoiceId} laybyPayments={laybyPayments} />;
}
