import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import RepairCommandCenter from "./RepairCommandCenter";

export default async function RepairDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const adminClient = createAdminClient();
  const { data: userData } = user
    ? await adminClient.from("users").select("tenant_id, tenants(currency)").eq("id", user.id).single()
    : { data: null };
  const tenantId = userData?.tenant_id ?? "";
  const tenantCurrency = (userData?.tenants as { currency?: string } | null)?.currency || "AUD";

  const { data: repair } = await adminClient
    .from("repairs")
    .select("*, customers(id, full_name, email, mobile)")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .single();

  if (!repair) notFound();

  const customer = Array.isArray(repair.customers) ? repair.customers[0] ?? null : repair.customers;

  // Fetch invoice via invoice_id on repair (primary), fallback to reference lookup
  let invoice = null;
  const invoiceId = repair.invoice_id ?? null;

  if (invoiceId) {
    const { data: inv } = await adminClient
      .from("invoices")
      .select("id, invoice_number, status, subtotal, tax_amount, tax_rate, total, amount_paid")
      .eq("id", invoiceId)
      .eq("tenant_id", tenantId)
      .single();

    if (inv) {
      const { data: lineItems } = await adminClient
        .from("invoice_line_items")
        .select("id, description, quantity, unit_price, total")
        .eq("invoice_id", invoiceId)
        .order("created_at", { ascending: true });

      const { data: payments } = await adminClient
        .from("payments")
        .select("id, amount, payment_method, payment_date, notes")
        .eq("invoice_id", invoiceId)
        .order("created_at", { ascending: true });

      invoice = {
        ...inv,
        lineItems: lineItems ?? [],
        payments: payments ?? [],
      };
    }
  }

  // Fetch inventory for stock item picker
  const { data: inventory } = await adminClient
    .from("inventory")
    .select("id, name, sku, retail_price")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .order("name", { ascending: true })
    .limit(100);

  return (
    <RepairCommandCenter
      repair={{
        id: repair.id,
        repair_number: repair.repair_number,
        item_type: repair.item_type,
        item_description: repair.item_description,
        repair_type: repair.repair_type,
        work_description: repair.work_description ?? null,
        intake_notes: repair.intake_notes ?? null,
        internal_notes: repair.internal_notes ?? null,
        workshop_notes: repair.workshop_notes ?? null,
        stage: repair.stage,
        priority: repair.priority ?? "normal",
        quoted_price: repair.quoted_price ?? null,
        final_price: repair.final_price ?? null,
        deposit_amount: repair.deposit_amount ?? null,
        deposit_paid: repair.deposit_paid ?? false,
        due_date: repair.due_date ?? null,
        invoice_id: repair.invoice_id ?? null,
      }}
      customer={customer}
      invoice={invoice}
      inventory={inventory ?? []}
      tenantId={tenantId}
      currency={tenantCurrency}
    />
  );
}
