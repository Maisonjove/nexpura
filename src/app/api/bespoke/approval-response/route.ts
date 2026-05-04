import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import logger, { reportServerError } from "@/lib/logger";
import { withSentryFlush } from "@/lib/sentry-flush";

export const POST = withSentryFlush(async (req: NextRequest) => {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "anonymous";
    const { success } = await checkRateLimit(ip, "api");
    if (!success) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const body = await req.json();
    const { token, action, decision, notes, signature } = body;
    // Support both "action" and "decision" for backwards compatibility
    const finalAction = action || decision;
    if (!token || !finalAction) return NextResponse.json({ error: "Missing params" }, { status: 400 });

    const admin = createAdminClient();

    // Find job by token
    const { data: job, error: jobErr } = await admin
      .from("bespoke_jobs")
      .select("id, tenant_id, approval_status")
      .eq("approval_token", token)
      .single();

    if (jobErr || !job) return NextResponse.json({ error: "Invalid approval link" }, { status: 404 });
    if (job.approval_status === "approved") {
      return NextResponse.json({ error: "This design has already been approved" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {
      approval_notes: notes || null,
    };

    if (finalAction === "approve") {
      updates.approval_status = "approved";
      updates.approved_at = new Date().toISOString();
      if (signature) {
        updates.client_signature_data = signature;
      }
      // Rotate the approval token on success. Audit finding (Medium):
      // previously the token stayed valid after approval. If the jeweller
      // later reverted status to pending (via UI or DB write), the
      // customer's original email link still worked. New UUID per
      // approval means the old link deterministically 404s after
      // approval — the branded ApprovalInvalid page at /approve/[token]
      // catches stale links correctly.
      updates.approval_token = crypto.randomUUID();
    } else {
      updates.approval_status = "changes_requested";
    }

    let { error: updateErr } = await admin
      .from("bespoke_jobs")
      .update(updates)
      .eq("id", job.id);

    // Defensive: if the schema cache on some tenant hasn't caught up
    // with a column this handler writes (has happened twice historically:
    // client_signature_data before 20260421_bespoke_signature_column and
    // invoices.sale_id before 20260421_invoices_sale_id_column), retry
    // with just the essential state transition so the customer approval
    // never silently fails — the signature/notes lose their home for
    // one request but the approval itself always completes.
    if (updateErr && /column .* not find|schema cache/i.test(updateErr.message)) {
      // Operators-need-to-know signal — without this the
      // signature/notes silently disappear for one request and the
      // schema cache miss is invisible to ops.
      logger.warn("[bespoke/approval-response] schema-cache retry triggered — refresh the schema cache or run pending migrations", {
        tenantId: job.tenant_id,
        droppedFromUpdate: Object.keys(updates).filter(k => k !== "approval_status" && k !== "approved_at" && k !== "approval_notes"),
        originalError: updateErr.message,
      });
      const safeUpdates: Record<string, unknown> = { approval_status: updates.approval_status };
      if (updates.approved_at) safeUpdates.approved_at = updates.approved_at;
      if (updates.approval_notes) safeUpdates.approval_notes = updates.approval_notes;
      // Kind B (server-action-style, destructive return-error). Schema-
      // cache miss retry path with the essential state transition only.
      // The error is captured into updateErr below and surfaced to the
      // customer via the existing 500 path; without an `{ error }`
      // destructure the lint rule flags this as a swallow.
      const { error: retryErr } = await admin.from("bespoke_jobs").update(safeUpdates).eq("id", job.id);
      updateErr = retryErr;
    }

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    // Log the event. Previously fire-and-forget — but on Vercel Lambda the
    // function returns before the insert promise resolves and the log row
    // gets dropped, leaving the audit trail silent for every customer
    // approval. Await so the row actually lands.
    // Kind C (best-effort observability log+continue). job_events is the
    // audit-trail table — the customer approval has already succeeded
    // by this point and is reflected in bespoke_jobs.approval_status, so
    // a failure here must NOT 500 the response. Log loudly so ops can
    // backfill the audit row from bespoke_jobs.approved_at if needed.
    const { error: jobEventErr } = await admin.from("job_events").insert({
      tenant_id: job.tenant_id,
      job_type: "bespoke",
      job_id: job.id,
      event_type: finalAction === "approve" ? "client_approved" : "changes_requested",
      description: finalAction === "approve"
        ? `Client approved design with digital signature`
        : `Client requested changes: ${notes || "No details provided"}`,
    });
    if (jobEventErr) {
      logger.error("[bespoke/approval-response] job_events insert failed; approval already succeeded — backfill from bespoke_jobs.approved_at", {
        jobId: job.id,
        tenantId: job.tenant_id,
        action: finalAction,
        err: jobEventErr,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    reportServerError("bespoke/approval-response:POST", error);
    return NextResponse.json({ error: "Approval processing failed" }, { status: 500 });
  }
});
