import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import ApprovalClient from "./ApprovalClient";

export const metadata = { title: "Design Approval — Nexpura" };

export default async function ApprovalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();

  // Look up job by approval token
  const { data: job, error } = await admin
    .from("bespoke_jobs")
    .select("*, customers(id, full_name, email), tenants(name, currency)")
    .eq("approval_token", token)
    .single();

  if (error || !job) notFound();

  const customer = Array.isArray(job.customers) ? job.customers[0] : job.customers;
  const tenant = Array.isArray(job.tenants) ? job.tenants[0] : job.tenants;

  // Get attachments (design photos)
  const { data: attachments } = await admin
    .from("job_attachments")
    .select("*")
    .eq("job_type", "bespoke")
    .eq("job_id", job.id)
    .order("created_at", { ascending: true });

  // Get invoice if exists
  let invoice = null;
  if (job.invoice_id) {
    const { data: inv } = await admin
      .from("invoices")
      .select("id, invoice_number, total, subtotal, tax_amount, tax_rate")
      .eq("id", job.invoice_id)
      .single();
    invoice = inv;
  }

  return (
    <ApprovalClient
      token={token}
      job={{
        id: job.id,
        job_number: job.job_number,
        title: job.title,
        description: job.description,
        quoted_price: job.quoted_price,
        approval_status: job.approval_status,
        approved_at: job.approved_at,
        approval_notes: job.approval_notes,
      }}
      customer={customer}
      tenant={tenant}
      attachments={attachments ?? []}
      invoice={invoice}
    />
  );
}
