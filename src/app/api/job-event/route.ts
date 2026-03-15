import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const { tenantId, jobType, jobId, eventType, description, actor } = await req.json();
  const admin = createAdminClient();
  await admin.from("job_events").insert({
    tenant_id: tenantId,
    job_type: jobType,
    job_id: jobId,
    event_type: eventType,
    description,
    actor: actor ?? "demo@nexpura.com",
  });
  return NextResponse.json({ success: true });
}
