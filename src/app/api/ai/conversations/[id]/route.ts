import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) {
    return Response.json({ error: "No tenant" }, { status: 403 });
  }

  const adminClient = createAdminClient();

  const { data: messages } = await adminClient
    .from("ai_messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", id)
    .eq("tenant_id", userData.tenant_id)
    .order("created_at", { ascending: true });

  return Response.json({ messages: messages ?? [] });
}
