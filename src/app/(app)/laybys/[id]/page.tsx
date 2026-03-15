import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import LaybyDetailClient from "./LaybyDetailClient";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function LaybyDetailPage({ params }: Props) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  const tenantId = profile?.tenant_id;
  if (!tenantId) redirect("/dashboard");

  const admin = createAdminClient();

  const { data: sale } = await admin
    .from("sales")
    .select(
      "id, sale_number, customer_name, customer_id, total, amount_paid, deposit_amount, status, sale_date, payment_method"
    )
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .single();

  if (!sale || sale.payment_method !== "layby") notFound();

  const { data: saleItems } = await admin
    .from("sale_items")
    .select("id, description, quantity, unit_price, line_total")
    .eq("sale_id", id)
    .eq("tenant_id", tenantId);

  const { data: payments } = await admin
    .from("layby_payments")
    .select("id, amount, payment_method, notes, paid_at")
    .eq("sale_id", id)
    .eq("tenant_id", tenantId)
    .order("paid_at", { ascending: true });

  return (
    <LaybyDetailClient
      tenantId={tenantId}
      userId={user.id}
      sale={{
        id: sale.id,
        saleNumber: sale.sale_number,
        customerName: sale.customer_name,
        customerId: sale.customer_id,
        total: sale.total || 0,
        amountPaid: sale.amount_paid || 0,
        depositAmount: sale.deposit_amount || 0,
        status: sale.status,
        saleDate: sale.sale_date,
      }}
      saleItems={(saleItems ?? []).map((i) => ({
        id: i.id,
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unit_price,
        lineTotal: i.line_total,
      }))}
      payments={(payments ?? []).map((p) => ({
        id: p.id,
        amount: p.amount,
        paymentMethod: p.payment_method,
        notes: p.notes,
        paidAt: p.paid_at,
      }))}
    />
  );
}
