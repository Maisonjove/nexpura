import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
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
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
