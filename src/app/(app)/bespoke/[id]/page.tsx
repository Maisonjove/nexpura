import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import BespokeCommandCenter from "./BespokeCommandCenter";

export default async function BespokeJobDetailPage({
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

  const { data: job } = await adminClient
    .from("bespoke_jobs")
    .select("*, customers(id, full_name, email, mobile)")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .single();

  if (!job) notFound();

  const customer = Array.isArray(job.customers) ? job.customers[0] ?? null : job.customers;

  // Fetch invoice via invoice_id on job (primary)
  let invoice = null;
  const invoiceId = job.invoice_id ?? null;

  if (invoiceId) {
    const { data: inv } = await adminClient
      .from("invoices")
      .select("id, invoice_number, status, subtotal, tax_amount, tax_rate, total, amount_paid")
      .eq("id", invoiceId)
      .eq("tenant_id", tenantId)
      .single();

    if (inv) {
      const { data: lineItems, error: liErr } = await adminClient
        .from("invoice_line_items")
        .select("*")
        .eq("invoice_id", invoiceId);

      if (liErr) console.error("Line items fetch error:", liErr);

      const { data: payments, error: pErr } = await adminClient
        .from("payments")
        .select("*")
        .eq("invoice_id", invoiceId)
        .order("created_at", { ascending: true });

      if (pErr) console.error("Payments fetch error:", pErr);

      invoice = {
        ...inv,
        lineItems: lineItems ?? [],
        payments: payments ?? [],
      };
    }
  }

  const { data: inventory } = await adminClient
    .from("inventory")
    .select("id, name, sku, retail_price")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .order("name", { ascending: true })
    .limit(100);

  // Fetch attachments and events
  const { data: attachments } = await adminClient
    .from("job_attachments")
    .select("*")
    .eq("job_type", "bespoke")
    .eq("job_id", id)
    .order("created_at", { ascending: true });

  const { data: events } = await adminClient
    .from("job_events")
    .select("*")
    .eq("job_type", "bespoke")
    .eq("job_id", id)
    .order("created_at", { ascending: false });

  // Map deposit_received to deposit_paid for the component
  const depositPaid = job.deposit_received ?? job.deposit_paid ?? false;

  return (
    <BespokeCommandCenter
      job={{
        id: job.id,
        job_number: job.job_number,
        title: job.title,
        description: job.description ?? null,
        jewellery_type: job.jewellery_type ?? null,
        metal_type: job.metal_type ?? null,
        metal_colour: job.metal_colour ?? null,
        metal_purity: job.metal_purity ?? null,
        stone_type: job.stone_type ?? null,
        stone_carat: job.stone_carat ?? null,
        stone_colour: job.stone_colour ?? null,
        stone_clarity: job.stone_clarity ?? null,
        ring_size: job.ring_size ?? null,
        setting_style: job.setting_style ?? null,
        stage: job.stage,
        priority: job.priority ?? "normal",
        quoted_price: job.quoted_price ?? null,
        deposit_amount: job.deposit_amount ?? null,
        deposit_paid: depositPaid,
        due_date: job.due_date ?? null,
        invoice_id: job.invoice_id ?? null,
        internal_notes: job.internal_notes ?? null,
        workshop_notes: job.workshop_notes ?? null,
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
