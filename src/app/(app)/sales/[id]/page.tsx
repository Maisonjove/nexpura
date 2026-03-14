import { createClient } from "@/lib/supabase/server";
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

  const { data: sale } = await supabase
    .from("sales")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenantId ?? "")
    .single();

  if (!sale) notFound();

  const { data: items } = await supabase
    .from("sale_items")
    .select("*")
    .eq("sale_id", id)
    .order("created_at", { ascending: true });

  const { data: invoiceRow } = await supabase
    .from("invoices")
    .select("id")
    .eq("sale_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const invoiceId = invoiceRow?.id ?? null;

  return <SaleDetailClient sale={sale} items={items ?? []} initialInvoiceId={invoiceId} />;
}
