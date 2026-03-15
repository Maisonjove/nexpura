import { createAdminClient } from "@/lib/supabase/admin";
import RepairCommandCenter from "@/app/(app)/repairs/[id]/RepairCommandCenter";

const TENANT_ID = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";

export default async function ReviewRepairDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const adminClient = createAdminClient();

  const { data: repair } = await adminClient
    .from("repairs")
    .select("*, customers(id, full_name, email, mobile)")
    .eq("id", id)
    .eq("tenant_id", TENANT_ID)
    .is("deleted_at", null)
    .single();

  if (!repair) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <h1 className="text-2xl font-semibold text-stone-900 mb-3">Repair Not Found</h1>
        <p className="text-stone-500">This repair doesn&apos;t exist in the demo data.</p>
      </div>
    );
  }

  const customer = Array.isArray(repair.customers) ? repair.customers[0] ?? null : repair.customers;

  let invoice = null;
  const invoiceId = repair.invoice_id ?? null;

  if (invoiceId) {
    const { data: inv } = await adminClient
      .from("invoices")
      .select("id, invoice_number, status, subtotal, tax_amount, tax_rate, total, amount_paid")
      .eq("id", invoiceId)
      .eq("tenant_id", TENANT_ID)
      .single();

    if (inv) {
      const { data: lineItems } = await adminClient
        .from("invoice_line_items")
        .select("id, description, quantity, unit_price, total")
        .eq("invoice_id", invoiceId)
        .order("id", { ascending: true });

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
      inventory={[]}
      tenantId={TENANT_ID}
      currency="AUD"
      readOnly={true}
    />
  );
}
