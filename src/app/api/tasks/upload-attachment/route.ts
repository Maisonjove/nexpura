import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";

// Whitelist of MIME types we let users attach to tasks. Pre-fix the
// route only enforced size (10MB) and trusted file.type from the
// browser, which means an attacker could upload .exe / .sh / archives
// and host them under our domain — risk is malware distribution from
// nexpura.com (domain reputation hit) + security scanners flagging us.
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "text/plain",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",       // xlsx
  "application/msword",                                                       // doc
  "application/vnd.ms-excel",                                                 // xls
]);

// Reject extensions a malicious uploader could ride past a spoofed
// content-type header. Even if file.type says "application/pdf", the
// extension on the persisted URL doesn't lie.
const BLOCKED_EXTENSIONS = new Set([
  "exe", "bat", "cmd", "sh", "ps1", "vbs", "msi", "scr", "pif", "com",
  "jar", "app", "dmg", "deb", "rpm", "apk", "iso",
  "html", "htm", "svg", // these can host JS in a same-origin file
]);

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "anonymous";
  const { success } = await checkRateLimit(ip, "api");
  if (!success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const adminForTenant = createAdminClient();
  const { data: userData } = await adminForTenant.from("users").select("tenant_id").eq("id", user.id).single();
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

  // MIME + extension whitelist. We check both because a malicious client
  // can spoof the content-type header but the extension persists in the
  // storage URL once we serve it.
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: `Unsupported file type "${file.type || "unknown"}". Allowed: PDF, images, plain text, Office docs.` },
      { status: 400 },
    );
  }
  const fileExt = (file.name.split(".").pop() ?? "").toLowerCase();
  if (BLOCKED_EXTENSIONS.has(fileExt)) {
    return NextResponse.json(
      { error: `Filename extension ".${fileExt}" is not allowed.` },
      { status: 400 },
    );
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
