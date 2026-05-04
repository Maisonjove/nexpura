import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resend } from "@/lib/email/resend";
import logger from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { getUserLocationIds } from "@/lib/locations";
import { isSandbox, logSandboxSuppressedSend } from "@/lib/sandbox";
import { withSentryFlush } from "@/lib/sentry-flush";

export const POST = withSentryFlush(async (req: NextRequest) => {
  const ip = req.headers.get("x-forwarded-for") ?? "anonymous";
  const { success } = await checkRateLimit(ip, "api");
  if (!success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

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

    // L-notify-ready-sandbox: in sandbox mode (preview/dev/SANDBOX_MODE)
    // never hit real customer inboxes. Short-circuit before any lookup
    // so preview QA runs are observable in logs but emit nothing.
    if (isSandbox()) {
      logSandboxSuppressedSend({
        channel: "email",
        to: "bulk-ready-notifications",
        subject: "notify-ready batch suppressed in sandbox",
      });
      return NextResponse.json({ success: true, skipped: "sandbox", notified: 0 });
    }

    // Fetch tenant name + business_name for email branding. Prefer
    // business_name (the trading-as name); fall back to `name` (legacy
    // owner-display label) then a generic.
    const { data: tenant } = await admin
      .from("tenants")
      .select("business_name, name, email")
      .eq("id", tenantId)
      .maybeSingle();
    const businessName = tenant?.business_name ?? tenant?.name ?? "Our Store";
    const fromEmail = process.env.RESEND_FROM_EMAIL ?? "noreply@nexpura.com";

    let notified = 0;
    let skipped = 0;

    // W2-006: bulk notify must respect the session user's location
    // scope. A location-restricted staffer can only trigger
    // notifications for jobs at their assigned locations. Owners/
    // managers (null allowed_location_ids) pass through with full
    // tenant scope.
    const allowedLocations = await getUserLocationIds(user.id, tenantId);

    if (jobType === "repair") {
      // Fetch all ready repairs with customer contact info
      let repairsQuery = admin
        .from("repairs")
        .select("id, repair_number, item_description, location_id, customers(id, full_name, email, mobile)")
        .eq("tenant_id", tenantId)
        .eq("stage", "ready")
        .is("deleted_at", null);
      if (allowedLocations !== null) {
        // Restricted — only rows in allowed_location_ids, plus legacy
        // location_id IS NULL rows (pre-location-column).
        if (allowedLocations.length === 0) {
          return NextResponse.json({ notified: 0, skipped: 0 });
        }
        repairsQuery = repairsQuery.or(
          `location_id.in.(${allowedLocations.join(",")}),location_id.is.null`,
        );
      }
      const { data: repairs } = await repairsQuery;

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

          // Log communication. Schema doesn't have reference_type /
          // reference_id / metadata (verified 2026-04-25). Drop them so
          // the audit row actually lands. Email gets persisted as
          // customer_email instead.
          // Kind A-style throw INTO the existing try/catch (which
          // increments `skipped` and continues to the next customer).
          // The notification email already sent — losing the audit row
          // for one customer is recoverable. Throwing keeps the supabase
          // failure visible (vs swallowed) and routes through the
          // existing skipped++ path so one bad row doesn't kill the
          // batch.
          const { error: commsErr } = await admin.from("customer_communications").insert({
            customer_id: customer.id,
            customer_email: customer.email,
            customer_name: customer.full_name,
            tenant_id: tenantId,
            type: "repair_ready",
            subject: `Your repair is ready for collection — ${businessName}`,
            sent_by: user.id,
            sent_at: new Date().toISOString(),
            status: "sent",
          }).maybeSingle();
          if (commsErr) {
            throw new Error(`customer_communications insert failed: ${commsErr.message}`);
          }

          notified++;
        } catch {
          skipped++;
        }
      }
    } else {
      // Bespoke jobs
      let jobsQuery = admin
        .from("bespoke_jobs")
        .select("id, job_number, title, location_id, customers(id, full_name, email, mobile)")
        .eq("tenant_id", tenantId)
        .eq("stage", "ready")
        .is("deleted_at", null);
      if (allowedLocations !== null) {
        if (allowedLocations.length === 0) {
          return NextResponse.json({ notified: 0, skipped: 0 });
        }
        jobsQuery = jobsQuery.or(
          `location_id.in.(${allowedLocations.join(",")}),location_id.is.null`,
        );
      }
      const { data: jobs } = await jobsQuery;

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

          // Log communication. Same column-drift fix as the repair
          // branch — drop reference_type / reference_id / metadata.
          // Kind A-style throw INTO the existing try/catch (same
          // rationale as the repair branch above — notification email
          // already sent, batch shouldn't die over one missing audit
          // row).
          const { error: commsErr } = await admin.from("customer_communications").insert({
            customer_id: customer.id,
            customer_email: customer.email,
            customer_name: customer.full_name,
            tenant_id: tenantId,
            type: "repair_ready",
            subject: `Your bespoke piece is ready — ${businessName}`,
            sent_by: user.id,
            sent_at: new Date().toISOString(),
            status: "sent",
          }).maybeSingle();
          if (commsErr) {
            throw new Error(`customer_communications insert failed: ${commsErr.message}`);
          }

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
});
