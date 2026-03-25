import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Resend } from "resend";
import logger from "@/lib/logger";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id, full_name")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) {
      return NextResponse.json({ error: "No tenant" }, { status: 403 });
    }

    const tenantId = userData.tenant_id;
    const body = await req.json();
    const jobType: "repair" | "bespoke" = body.type ?? "repair";

    const admin = createAdminClient();

    // Fetch tenant name for email branding
    const { data: tenant } = await admin
      .from("tenants")
      .select("name, email")
      .eq("id", tenantId)
      .maybeSingle();
    const businessName = tenant?.name ?? "Our Store";
    const fromEmail = process.env.RESEND_FROM_EMAIL ?? "noreply@nexpura.com";

    let notified = 0;
    let skipped = 0;

    if (jobType === "repair") {
      // Fetch all ready repairs with customer contact info
      const { data: repairs } = await admin
        .from("repairs")
        .select("id, repair_number, item_description, customers(id, full_name, email, mobile)")
        .eq("tenant_id", tenantId)
        .eq("stage", "ready")
        .is("deleted_at", null);

      for (const repair of repairs ?? []) {
        const customer = Array.isArray(repair.customers)
          ? repair.customers[0]
          : repair.customers;

        if (!customer?.email) {
          skipped++;
          continue;
        }

        try {
          await resend.emails.send({
            from: `${businessName} <${fromEmail}>`,
            to: customer.email,
            subject: `Your repair is ready for collection — ${businessName}`,
            html: `
              <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
                <h2 style="color: #1A1A1A;">Your repair is ready! 🎉</h2>
                <p>Hi ${customer.full_name ?? "there"},</p>
                <p>Great news — your repair <strong>${repair.item_description ?? repair.repair_number ?? ""}</strong> is ready for collection at <strong>${businessName}</strong>.</p>
                <p>Please bring your repair ticket number <strong>${repair.repair_number ?? repair.id.slice(-6).toUpperCase()}</strong> when you come in.</p>
                <p>We look forward to seeing you!</p>
                <p style="color: #666; font-size: 12px; margin-top: 24px;">— The team at ${businessName}</p>
              </div>
            `,
          });

          // Log communication
          await admin.from("customer_communications").insert({
            customer_id: customer.id,
            tenant_id: tenantId,
            type: "repair_ready",
            subject: `Your repair is ready for collection — ${businessName}`,
            sent_by: user.id,
            reference_type: "repair",
            reference_id: repair.id,
            metadata: { email: customer.email },
          }).maybeSingle();

          notified++;
        } catch {
          skipped++;
        }
      }
    } else {
      // Bespoke jobs
      const { data: jobs } = await admin
        .from("bespoke_jobs")
        .select("id, job_number, title, customers(id, full_name, email, mobile)")
        .eq("tenant_id", tenantId)
        .eq("stage", "ready")
        .is("deleted_at", null);

      for (const job of jobs ?? []) {
        const customer = Array.isArray(job.customers)
          ? job.customers[0]
          : job.customers;

        if (!customer?.email) {
          skipped++;
          continue;
        }

        try {
          await resend.emails.send({
            from: `${businessName} <${fromEmail}>`,
            to: customer.email,
            subject: `Your bespoke piece is ready — ${businessName}`,
            html: `
              <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
                <h2 style="color: #1A1A1A;">Your bespoke piece is ready! 🎉</h2>
                <p>Hi ${customer.full_name ?? "there"},</p>
                <p>We're thrilled to let you know that your bespoke piece <strong>${job.title ?? job.job_number ?? ""}</strong> is ready for collection at <strong>${businessName}</strong>.</p>
                <p>Please reference job number <strong>${job.job_number ?? job.id.slice(-6).toUpperCase()}</strong> when you come in.</p>
                <p>We can't wait for you to see the finished result!</p>
                <p style="color: #666; font-size: 12px; margin-top: 24px;">— The team at ${businessName}</p>
              </div>
            `,
          });

          // Log communication
          await admin.from("customer_communications").insert({
            customer_id: customer.id,
            tenant_id: tenantId,
            type: "repair_ready",
            subject: `Your bespoke piece is ready — ${businessName}`,
            sent_by: user.id,
            reference_type: "bespoke_job",
            reference_id: job.id,
            metadata: { email: customer.email },
          }).maybeSingle();

          notified++;
        } catch {
          skipped++;
        }
      }
    }

    return NextResponse.json({ notified, skipped });
  } catch (err) {
    logger.error("[notify-ready]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
