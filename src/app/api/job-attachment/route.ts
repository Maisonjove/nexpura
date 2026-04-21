import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { jobAttachmentSchema } from "@/lib/schemas";
import { reportServerError } from "@/lib/logger";

/**
 * Launch-QA W7-CRIT-05: this route previously pulled `tenantId` out of the
 * request body and inserted the attachment row under that tenant. Any
 * authed user could attach files to another tenant's repair/bespoke/sale
 * by passing a foreign UUID, polluting their audit trail and customer-
 * facing attachments.
 *
 * Fix: tenant is derived from the parent job row, and the caller must
 * belong to that tenant. The body's `tenantId` is ignored.
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

    // Rate limit attachment uploads per user
    const { success: rateLimitOk } = await checkRateLimit(`job-attachment:${user.id}`);
    if (!rateLimitOk) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await req.json();
    const parseResult = jobAttachmentSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues }, { status: 400 });
    }
    const { jobType, jobId, fileName, fileUrl, caption } = parseResult.data;

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

    const { data, error } = await admin
      .from("job_attachments")
      .insert({
        tenant_id: callerTenantId,
        job_type: jobType,
        job_id: jobId,
        file_name: fileName,
        file_url: fileUrl,
        caption: caption ?? null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ attachment: data });
  } catch (error) {
    reportServerError("job-attachment:POST", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
