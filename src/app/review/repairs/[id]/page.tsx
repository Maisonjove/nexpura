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

  // Repair + attachments in parallel
  const [{ data: repair }, { data: attachments }, { data: events }] = await Promise.all([
    adminClient
      .from("repairs")
      .select("*, customers(id, full_name, email, mobile)")
      .eq("id", id)
      .eq("tenant_id", TENANT_ID)
      .is("deleted_at", null)
      .single(),
    adminClient
      .from("job_attachments")
      .select("id, file_name, file_url, caption, created_at")
      .eq("job_type", "repair")
      .eq("job_id", id)
      .eq("tenant_id", TENANT_ID)
      .order("created_at", { ascending: true }),
    adminClient
      .from("job_events")
      .select("*")
      .eq("job_type", "repair")
      .eq("job_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (!repair) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <h1 className="text-2xl font-semibold text-stone-900 mb-3">Repair Not Found</h1>
        <p className="text-stone-500">This repair doesn&apos;t exist in the demo data.</p>
      </div>
    );
  }

  const customer = Array.isArray(repair.customers) ? repair.customers[0] ?? null : repair.customers;
  const invoiceId = repair.invoice_id ?? null;

  let invoice = null;
  if (invoiceId) {
    const [{ data: inv }, { data: lineItems }, { data: payments }] = await Promise.all([
      adminClient
        .from("invoices")
        .select("id, invoice_number, status, subtotal, tax_amount, tax_rate, total, amount_paid")
        .eq("id", invoiceId)
        .eq("tenant_id", TENANT_ID)
        .single(),
      adminClient
        .from("invoice_line_items")
        .select("id, description, quantity, unit_price, total")
        .eq("invoice_id", invoiceId)
        .order("id", { ascending: true }),
      adminClient
        .from("payments")
        .select("id, amount, payment_method, payment_date, notes")
        .eq("invoice_id", invoiceId)
        .order("created_at", { ascending: true }),
    ]);

    if (inv) {
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
        tracking_id: repair.tracking_id ?? null,
      }}
      customer={customer}
      invoice={invoice}
      inventory={[]}
      tenantId={TENANT_ID}
      currency="AUD"
      readOnly={true}
      attachments={attachments ?? []}
      events={events ?? []}
    />
  );
}
