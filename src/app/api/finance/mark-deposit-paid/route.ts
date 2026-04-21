import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { requirePermission } from "@/lib/auth-context";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "anonymous";
  const { success } = await checkRateLimit(ip, "api");
  if (!success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    // W3-HIGH-10 / W3-RBAC-10: marking a deposit paid is a financial
    // state change. Gate on create_invoices — owners bypass.
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

    // Session-derived tenant (never trust body).
    const tenantId = ctx.tenantId;

    const table = jobType === "repair" ? "repairs" : "bespoke_jobs";
    const depositField = jobType === "repair" ? "deposit_paid" : "deposit_received";

    const { error } = await supabase
      .from(table)
      .update({ [depositField]: true, updated_at: new Date().toISOString() })
      .eq("id", jobId)
      .eq("tenant_id", tenantId);

    if (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
