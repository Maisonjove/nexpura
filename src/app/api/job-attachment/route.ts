import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { jobAttachmentSchema } from "@/lib/schemas";

export async function POST(req: NextRequest) {
  // Auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
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
  const { tenantId, jobType, jobId, fileName, fileUrl, caption } = parseResult.data;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("job_attachments")
    .insert({
      tenant_id: tenantId,
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
}
