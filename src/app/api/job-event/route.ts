import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { jobEventSchema } from "@/lib/schemas";
import { reportServerError } from "@/lib/logger";

/**
 * Launch-QA W7-CRIT-05: this route previously pulled `tenantId` out of the
 * request body and wrote the event under that tenant. Any authed user
 * could log fake/misleading events into another tenant's audit trail by
 * passing a foreign UUID (e.g. fabricating "photo_removed" events on
 * someone else's repair to cover a theft).
 *
 * Fix: the tenant is always the parent job's tenant, and the caller must
 * belong to that tenant. The body's `tenantId` (if any) is ignored.
 */

const PARENT_TABLE_BY_JOB_TYPE: Record<string, string> = {
  repair: "repairs",
  bespoke: "bespoke_jobs",
  sale: "sales",
  quote: "quotes",
  invoice: "invoices",
};

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Resolve caller's tenant from the session — never from the body.
    const { data: profile } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();
    const callerTenantId = profile?.tenant_id as string | undefined;
    if (!callerTenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit job events per user
    const { success: rateLimitOk } = await checkRateLimit(`job-event:${user.id}`);
    if (!rateLimitOk) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await req.json();
    const parseResult = jobEventSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues }, { status: 400 });
    }
    const { jobType, jobId, eventType, description, actor } = parseResult.data;

    const admin = createAdminClient();

    // Resolve the effective tenant from the parent job row, not the body.
    const parentTable = PARENT_TABLE_BY_JOB_TYPE[jobType];
    if (!parentTable) {
      return NextResponse.json({ error: "Unsupported job type" }, { status: 400 });
    }
    const { data: parent } = await admin
      .from(parentTable)
      .select("tenant_id")
      .eq("id", jobId)
      .single();
    if (!parent) {
      return NextResponse.json({ error: "Parent job not found" }, { status: 404 });
    }
    if (parent.tenant_id !== callerTenantId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error: insertErr } = await admin.from("job_events").insert({
      tenant_id: callerTenantId,
      job_type: jobType,
      job_id: jobId,
      event_type: eventType,
      description,
      actor: actor ?? user.email ?? "system",
    });
    if (insertErr) {
      reportServerError("job-event:insert", insertErr, {
        tenantId: callerTenantId,
        jobType,
        jobId,
        eventType,
      });
      return NextResponse.json({ error: "Event logging failed" }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    reportServerError("job-event:POST", error);
    return NextResponse.json({ error: "Event logging failed" }, { status: 500 });
  }
}
