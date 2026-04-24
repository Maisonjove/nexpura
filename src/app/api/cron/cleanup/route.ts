import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { safeBearerMatch } from "@/lib/timing-safe-compare";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!safeBearerMatch(authHeader, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const results: Record<string, string> = {};

  // Delete old audit logs (keep 90 days)
  const { error: auditError, count: auditCount } = await supabase
    .from("audit_logs")
    .delete({ count: "exact" })
    .lt("created_at", ninetyDaysAgo.toISOString());

  if (auditError) {
    results.audit_logs = `error: ${auditError.message}`;
  } else {
    results.audit_logs = `deleted ${auditCount ?? 0} records older than 90 days`;
  }

  // Rate-limit bucket + login-attempt cleanup. Postgres-backed limiters
  // grow unbounded without pruning; the RPC handles its own deletion
  // logic and returns counts.
  const { data: rlData, error: rlError } = await supabase.rpc(
    "cleanup_expired_rate_limits",
  );
  if (rlError) {
    results.rate_limit_buckets = `error: ${rlError.message}`;
  } else if (rlData) {
    const counts = rlData as {
      rate_limit_buckets_deleted?: number;
      login_lockouts_deleted?: number;
    };
    results.rate_limit_buckets = `deleted ${counts.rate_limit_buckets_deleted ?? 0}`;
    results.login_lockouts = `deleted ${counts.login_lockouts_deleted ?? 0}`;
  }

  return NextResponse.json({
    success: true,
    cleaned_at: new Date().toISOString(),
    results,
  });
}
