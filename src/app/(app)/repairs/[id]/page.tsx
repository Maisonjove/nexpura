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
  const adminClient = createAdminClient();

  // Auth + repair + inventory all in parallel — no inter-dependencies at this stage
  const [{ data: { user } }, { data: repair }, { data: inventory }] = await Promise.all([
    supabase.auth.getUser(),
    adminClient
      .from("repairs")
      .select("*, customers(id, full_name, email, mobile)")
      .eq("id", id)
      .is("deleted_at", null)
      .single(),
    adminClient
      .from("inventory")
      .select("id, name, sku, retail_price")
      .eq("status", "active")
      .order("name", { ascending: true })
      .limit(100),
  ]);

  if (!repair) notFound();

  // User lookup + attachments + events in parallel (all independent)
  const [{ data: userData }, { data: attachments }, { data: events }] = await Promise.all([
    user
      ? adminClient.from("users").select("tenant_id, tenants(currency)").eq("id", user.id).single()
      : Promise.resolve({ data: null }),
    adminClient
      .from("job_attachments")
      .select("*")
      .eq("job_type", "repair")
      .eq("job_id", id)
      .order("created_at", { ascending: true }),
    adminClient
      .from("job_events")
      .select("*")
      .eq("job_type", "repair")
      .eq("job_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const tenantId = userData?.tenant_id ?? "";
  const tenantCurrency = (userData?.tenants as { currency?: string } | null)?.currency || "AUD";
  const customer = Array.isArray(repair.customers) ? repair.customers[0] ?? null : repair.customers;
  const invoiceId = repair.invoice_id ?? null;

  // Invoice + line items + payments in parallel (only if invoice exists)
  let invoice = null;
  if (invoiceId) {
    const [{ data: inv }, { data: lineItems }, { data: payments }] = await Promise.all([
      adminClient
        .from("invoices")
        .select("id, invoice_number, status, subtotal, tax_amount, tax_rate, total, amount_paid")
        .eq("id", invoiceId)
        .single(),
      adminClient
        .from("invoice_line_items")
        .select("*")
        .eq("invoice_id", invoiceId),
      adminClient
        .from("payments")
        .select("*")
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
      }}
      customer={customer}
      invoice={invoice}
      inventory={inventory ?? []}
      tenantId={tenantId}
      currency={tenantCurrency}
      attachments={attachments ?? []}
      events={events ?? []}
    />
  );
}
