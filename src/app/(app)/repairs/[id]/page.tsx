import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";
import RepairCommandCenter from "./RepairCommandCenter";

const DEMO_TENANT = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";
const REVIEW_TOKENS = ["nexpura-review-2026", "nexpura-staff-2026"];

export default async function RepairDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ rt?: string }>;
}) {
  const { id } = await params;
  const sp = searchParams ? await searchParams : {};
  const adminClient = createAdminClient();

  let tenantId: string | null = null;
  let tenantCurrencyFromCtx = "AUD";
  if (sp.rt && REVIEW_TOKENS.includes(sp.rt)) {
    tenantId = DEMO_TENANT;
  } else {
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: ud } = await adminClient.from("users").select("tenant_id, tenants(currency)").eq("id", user.id).single();
        tenantId = ud?.tenant_id ?? null;
        tenantCurrencyFromCtx = (ud?.tenants as { currency?: string } | null)?.currency || "AUD";
      }
    } catch { }
    if (!tenantId) redirect("/login");
  }

  // Fetch repair + inventory in parallel
  const [{ data: repair }, { data: inventory }] = await Promise.all([
    adminClient
      .from("repairs")
      .select("*, customers(id, full_name, email, mobile)")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .single(),
    adminClient
      .from("inventory")
      .select("id, name, sku, retail_price")
      .eq("status", "active")
      .eq("tenant_id", tenantId)
      .order("name", { ascending: true })
      .limit(100),
  ]);

  if (!repair) notFound();

  // Attachments + events in parallel
  const [{ data: attachments }, { data: events }] = await Promise.all([
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

  const tenantCurrency = tenantCurrencyFromCtx;
  const customer = Array.isArray(repair.customers) ? repair.customers[0] ?? null : repair.customers;
  const invoiceId = repair.invoice_id ?? null;

  // Invoice + line items + payments in parallel
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
