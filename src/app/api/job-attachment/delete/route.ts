import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const { attachmentId, tenantId, fileUrl } = await req.json();
  if (!attachmentId || !tenantId) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

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
