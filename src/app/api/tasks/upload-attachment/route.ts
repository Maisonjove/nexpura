import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: userData } = await supabase.from("users").select("tenant_id").eq("id", user.id).single();
  const tenantId = userData?.tenant_id;
  if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 400 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const taskId = formData.get("task_id") as string | null;

  if (!file || !taskId) {
    return NextResponse.json({ error: "Missing file or task_id" }, { status: 400 });
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
  }

  try {
    const admin = createAdminClient();

    // Upload to Supabase Storage
    const ext = file.name.split(".").pop() ?? "bin";
    const path = `task-attachments/${tenantId}/${taskId}/${Date.now()}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const { error: uploadError } = await admin.storage
      .from("uploads")
      .upload(path, buffer, { contentType: file.type, upsert: false });

    if (uploadError) {
      // If bucket doesn't exist, just store a data URL reference
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
    }

    const { data: { publicUrl } } = admin.storage.from("uploads").getPublicUrl(path);

    // Save attachment record
    const { data: attachment, error: dbError } = await admin
      .from("task_attachments")
      .insert({
        task_id: taskId,
        tenant_id: tenantId,
        file_name: file.name,
        file_url: publicUrl,
        file_type: file.type,
        file_size: file.size,
        uploaded_by: user.id,
      })
      .select("*")
      .single();

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

    return NextResponse.json({ attachment });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Upload failed" }, { status: 500 });
  }
}
