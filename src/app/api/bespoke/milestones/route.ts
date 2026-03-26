import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "anonymous";
  const { success } = await checkRateLimit(ip, "api");
  if (!success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");
  const tenantId = searchParams.get("tenantId");
  if (!jobId || !tenantId) return NextResponse.json({ error: "Missing params" }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("bespoke_milestones")
    .select("*")
    .eq("bespoke_job_id", jobId)
    .eq("tenant_id", tenantId)
    .order("order_index", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ milestones: data });
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "anonymous";
  const { success } = await checkRateLimit(ip, "api");
  if (!success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const body = await req.json();
  const { jobId, tenantId, title, description, due_date, order_index } = body;
  if (!jobId || !tenantId || !title) return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("bespoke_milestones")
    .insert({
      bespoke_job_id: jobId,
      tenant_id: tenantId,
      title,
      description: description || null,
      due_date: due_date || null,
      order_index: order_index ?? 0,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ milestone: data });
}
