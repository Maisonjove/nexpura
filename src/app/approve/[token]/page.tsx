import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import ApprovalClient from "./ApprovalClient";

export default async function ApprovalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createAdminClient();

  // Find the job by approval token
  const { data: job, error } = await admin
    .from("bespoke_jobs")
    .select(`
      id, job_number, title, description, jewellery_type, 
      metal_type, metal_colour, metal_purity, stone_type, stone_carat,
      stone_colour, stone_clarity, ring_size, setting_style,
      quoted_price, deposit_amount, approval_status, approved_at, approval_notes,
      customers(id, full_name, email),
      tenants(id, name, business_name, logo_url),
      bespoke_milestones(id, title, description, due_date, completed_at, order_index)
    `)
    .eq("approval_token", token)
    .single();

  if (error || !job) {
    notFound();
  }

  // Get attachments (design images)
  const { data: attachments } = await admin
    .from("job_attachments")
    .select("id, file_url, file_name, caption")
    .eq("job_type", "bespoke")
    .eq("job_id", job.id)
    .order("created_at", { ascending: true });

  const customer = Array.isArray(job.customers) ? job.customers[0] : job.customers;
  const tenant = Array.isArray(job.tenants) ? job.tenants[0] : job.tenants;
  const milestones = Array.isArray(job.bespoke_milestones) ? job.bespoke_milestones : [];

  return (
    <ApprovalClient
      token={token}
      job={{
        id: job.id,
        job_number: job.job_number,
        title: job.title,
        description: job.description,
        jewellery_type: job.jewellery_type,
        metal_type: job.metal_type,
        metal_colour: job.metal_colour,
        metal_purity: job.metal_purity,
        stone_type: job.stone_type,
        stone_carat: job.stone_carat,
        stone_colour: job.stone_colour,
        stone_clarity: job.stone_clarity,
        ring_size: job.ring_size,
        setting_style: job.setting_style,
        quoted_price: job.quoted_price,
        deposit_amount: job.deposit_amount,
        approval_status: job.approval_status,
        approved_at: job.approved_at,
        approval_notes: job.approval_notes,
      }}
      customer={customer}
      tenant={tenant}
      milestones={milestones}
      attachments={attachments || []}
    />
  );
}
