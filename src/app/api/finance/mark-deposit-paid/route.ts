import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "anonymous";
  const { success } = await checkRateLimit(ip, "api");
  if (!success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const { jobId, jobType } = await req.json();
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id)
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

    const tenantId = userData.tenant_id;

    const table = jobType === "repair" ? "repairs" : "bespoke_jobs";
    const depositField = jobType === "repair" ? "deposit_paid" : "deposit_received";

    const { error } = await supabase
      .from(table)
      .update({ [depositField]: true, updated_at: new Date().toISOString() })
      .eq("id", jobId)
      .eq("tenant_id", tenantId);

    if (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
