import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
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
    // Store signature data if provided
    if (signature) {
      updates.client_signature_data = signature;
    }
  } else {
    updates.approval_status = "changes_requested";
  }

  const { error: updateErr } = await admin
    .from("bespoke_jobs")
    .update(updates)
    .eq("id", job.id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // Log the event (non-critical, don't await)
  admin.from("job_events").insert({
    tenant_id: job.tenant_id,
    job_type: "bespoke",
    job_id: job.id,
    event_type: finalAction === "approve" ? "client_approved" : "changes_requested",
    description: finalAction === "approve"
      ? `Client approved design with digital signature`
      : `Client requested changes: ${notes || "No details provided"}`,
  });

  return NextResponse.json({ success: true });
}
