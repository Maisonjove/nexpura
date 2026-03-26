import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantTaxConfig } from "@/lib/tenant-tax";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "anonymous";
  const { success } = await checkRateLimit(ip, "api");
  if (!success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const { jobId, jobType } = await req.json();
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id)
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

    const tenantId = userData.tenant_id;

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
    await adminClient.from("invoice_line_items").insert({
      tenant_id: tenantId,
      invoice_id: newInvoice.id,
      description,
      quantity: 1,
      unit_price: total,
    });

    return NextResponse.json({ success: true, invoiceId: newInvoice.id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
