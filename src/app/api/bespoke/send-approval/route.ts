import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getResend } from "@/lib/email/resend";
import { randomUUID } from "crypto";
import logger from "@/lib/logger";
import { getAuthContext } from "@/lib/auth-context";

export async function POST(req: NextRequest) {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { jobId } = body;
  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Fetch the job + customer, ensuring tenant match
  const { data: job, error: jobErr } = await admin
    .from("bespoke_jobs")
    .select("*, customers(id, full_name, email)")
    .eq("id", jobId)
    .eq("tenant_id", auth.tenantId)
    .single();

  if (jobErr || !job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const customer = Array.isArray(job.customers) ? job.customers[0] : job.customers;
  if (!customer?.email) {
    return NextResponse.json({ error: "Customer has no email" }, { status: 400 });
  }

  // Fetch tenant details
  const { data: tenant } = await admin
    .from("tenants")
    .select("name, subdomain")
    .eq("id", auth.tenantId)
    .single();

  // Generate approval token
  const token = randomUUID();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://nexpura.com";
  const approvalUrl = `${appUrl}/approve/${token}`;

  // Update job with approval token + status
  const { error: updateErr } = await admin
    .from("bespoke_jobs")
    .update({
      approval_status: "requested",
      approval_token: token,
      approval_requested_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .eq("tenant_id", auth.tenantId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // Send email
  try {
    await getResend().emails.send({
      from: `${tenant?.name || "Nexpura"} <noreply@nexpura.com>`,
      to: customer.email,
      subject: `Your custom jewellery design is ready for approval — Job #${job.job_number}`,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #1c1917; font-size: 20px;">Hi ${customer.full_name || "there"},</h2>
          <p style="color: #44403c; line-height: 1.6;">
            Your custom jewellery design for <strong>${job.title}</strong> (Job #${job.job_number}) 
            is ready for your review and approval.
          </p>
          <p style="color: #44403c; line-height: 1.6;">
            Please click the button below to view the design, quote, and approve or request changes.
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${approvalUrl}" 
               style="background: #1c1917; color: white; padding: 14px 32px; border-radius: 10px; 
                      text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">
              Review & Approve Design
            </a>
          </div>
          <p style="color: #78716c; font-size: 14px;">
            Or copy this link: <a href="${approvalUrl}" style="color: #0ea5e9;">${approvalUrl}</a>
          </p>
          <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 24px 0;" />
          <p style="color: #78716c; font-size: 12px;">
            ${tenant?.name || "Your jeweller"} — Powered by Nexpura
          </p>
        </div>
      `,
    });
  } catch (emailErr) {
    logger.error("Send approval email failed", { error: emailErr, jobId });
    // Don't fail the request — approval token is already set
  }

  return NextResponse.json({ success: true, approvalUrl });
}
