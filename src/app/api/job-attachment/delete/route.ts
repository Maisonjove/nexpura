import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { jobAttachmentDeleteSchema } from "@/lib/schemas";

export async function POST(req: NextRequest) {
  // Auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit attachment deletions per user
  const { success: rateLimitOk } = await checkRateLimit(`job-attachment-delete:${user.id}`);
  if (!rateLimitOk) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await req.json();
  const parseResult = jobAttachmentDeleteSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json({ error: parseResult.error.issues }, { status: 400 });
  }
  const { attachmentId, tenantId, fileUrl } = parseResult.data;

  const admin = createAdminClient();

  // Delete DB record
  const { error } = await admin.from("job_attachments")
    .delete()
    .eq("id", attachmentId)
    .eq("tenant_id", tenantId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Delete from storage (extract path from URL)
  if (fileUrl && fileUrl.includes("/job-photos/")) {
    try {
      const path = fileUrl.split("/storage/v1/object/public/job-photos/")[1];
      if (path) await admin.storage.from("job-photos").remove([path]);
    } catch (_) { /* non-fatal if storage delete fails */ }
  }

  return NextResponse.json({ success: true });
}
