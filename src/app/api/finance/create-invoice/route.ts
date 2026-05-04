import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantTaxConfig } from "@/lib/tenant-tax";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { requirePermission } from "@/lib/auth-context";
import { withSentryFlush } from "@/lib/sentry-flush";

export const POST = withSentryFlush(async (req: NextRequest) => {
  const ip = req.headers.get("x-forwarded-for") ?? "anonymous";
  const { success } = await checkRateLimit(ip, "api");
  if (!success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    // W3-HIGH-10 / W3-RBAC-10: finance invoice creation must mirror the
    // /invoices/new permission gate. Without this any authed staffer can
    // POST the route directly and issue invoices (+ Stripe payment
    // links) even if the UI hides the button.
    let ctx;
    try {
      ctx = await requirePermission("create_invoices");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "permission_denied";
      const status = msg.startsWith("permission_denied") ? 403 : msg.startsWith("role_denied") ? 403 : 401;
      return NextResponse.json({ error: msg }, { status });
    }

    const { jobId, jobType } = await req.json();
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Session-derived tenant from the RBAC context (not body / user lookup).
    const tenantId = ctx.tenantId;

    // Use admin client for data fetches to bypass RLS (same pattern as detail pages)
    const adminClient = createAdminClient();

    // Fetch tenant tax config
    const { tax_rate: taxRate, tax_name: taxName, tax_inclusive: taxInclusive } = await getTenantTaxConfig(tenantId);

    // 1. Fetch job details
    let job;
    if (jobType === "repair") {
      const { data } = await adminClient
        .from("repairs")
        .select("*")
        .eq("id", jobId)
        .eq("tenant_id", tenantId)
        .single();
      job = data;
    } else {
      const { data } = await adminClient
        .from("bespoke_jobs")
        .select("*")
        .eq("id", jobId)
        .eq("tenant_id", tenantId)
        .single();
      job = data;
    }

    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    // 2. Check for existing invoice
    const field = jobType === "repair" ? "repair_id" : "bespoke_job_id";
    const { data: existingInvoice } = await adminClient
      .from("invoices")
      .select("id")
      .eq(field, jobId)
      .eq("tenant_id", tenantId)
      .single();

    if (existingInvoice) {
      return NextResponse.json({ error: "Invoice already exists" }, { status: 400 });
    }

    // 3. Generate invoice number
    const { data: invoiceNumberData } = await adminClient.rpc("next_invoice_number", {
      p_tenant_id: tenantId,
    });

    const total = job.final_price || job.quoted_price || job.final_cost || job.estimated_cost || 0;
    const description = jobType === "repair" 
      ? `Repair #${job.ticket_number || job.repair_number}: ${job.item_description}`
      : `Bespoke Job #${job.job_number}: ${job.title}`;

    // 4. Create Invoice
    const { data: newInvoice, error: invErr } = await adminClient
      .from("invoices")
      .insert({
        tenant_id: tenantId,
        invoice_number: invoiceNumberData || `INV-${Date.now()}`,
        customer_id: job.customer_id || null,
        customer_name: job.customer_name || null,
        customer_email: job.customer_email || null,
        [field]: jobId,
        invoice_date: new Date().toISOString().split("T")[0],
        subtotal: total,
        tax_name: taxName,
        tax_rate: taxRate,
        tax_inclusive: taxInclusive,
        tax_amount: Math.round(total * taxRate * 100) / 100,
        total: total,
        status: "sent",
        created_by: user.id,
      })
      .select("id")
      .single();

    if (invErr || !newInvoice) {
      return NextResponse.json({ error: invErr?.message || "Failed to create invoice" }, { status: 500 });
    }

    // 5. Create Line Item
    // Kind B (server-action-style, destructive return-error). The
    // invoice header was just inserted above (newInvoice.id holds an
    // FK target). If the line-item insert fails the invoice exists
    // with no lines — its total wouldn't reconcile against
    // SUM(line_items) and the customer would receive an invoice with
    // no detail breakdown. Return 500 so the caller can rollback /
    // retry; the orphan invoice header is a known cleanup task ops can
    // grep for.
    const { error: lineItemErr } = await adminClient.from("invoice_line_items").insert({
      tenant_id: tenantId,
      invoice_id: newInvoice.id,
      description,
      quantity: 1,
      unit_price: total,
    });
    if (lineItemErr) {
      return NextResponse.json(
        { error: `invoice_line_items insert failed: ${lineItemErr.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, invoiceId: newInvoice.id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
});
