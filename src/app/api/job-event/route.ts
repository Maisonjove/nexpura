import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { jobEventSchema } from "@/lib/schemas";

export async function POST(req: NextRequest) {
  // Auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
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
  const { tenantId, jobType, jobId, eventType, description, actor } = parseResult.data;
  const admin = createAdminClient();
  await admin.from("job_events").insert({
    tenant_id: tenantId,
    job_type: jobType,
    job_id: jobId,
    event_type: eventType,
    description,
    actor: actor ?? user.email ?? "system",
  });
  return NextResponse.json({ success: true });
}
