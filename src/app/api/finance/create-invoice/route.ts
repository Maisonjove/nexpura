import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
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

    // 1. Fetch job details
    let job;
    if (jobType === "repair") {
      const { data } = await supabase
        .from("repairs")
        .select("*")
        .eq("id", jobId)
        .eq("tenant_id", tenantId)
        .single();
      job = data;
    } else {
      const { data } = await supabase
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
    const { data: existingInvoice } = await supabase
      .from("invoices")
      .select("id")
      .eq(field, jobId)
      .eq("tenant_id", tenantId)
      .single();

    if (existingInvoice) {
      return NextResponse.json({ error: "Invoice already exists" }, { status: 400 });
    }

    // 3. Generate invoice number
    const { data: invoiceNumberData } = await supabase.rpc("next_invoice_number", {
      p_tenant_id: tenantId,
    });

    const total = job.final_price || job.quoted_price || 0;
    const description = jobType === "repair" 
      ? `Repair #${job.ticket_number || job.repair_number}: ${job.item_description}`
      : `Bespoke Job #${job.job_number}: ${job.title}`;

    // 4. Create Invoice
    const { data: newInvoice, error: invErr } = await supabase
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
        tax_name: "GST",
        tax_rate: 0.1,
        tax_inclusive: true,
        tax_amount: Math.round(total * 0.1 * 100) / 100,
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
    await supabase.from("invoice_line_items").insert({
      tenant_id: tenantId,
      invoice_id: newInvoice.id,
      description,
      quantity: 1,
      unit_price: total,
      line_total: total,
    });

    return NextResponse.json({ success: true, invoiceId: newInvoice.id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
