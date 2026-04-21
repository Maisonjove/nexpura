import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthContext } from "@/lib/auth-context";
import { reportServerError } from "@/lib/logger";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get("jobId");
    if (!jobId) {
      return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("bespoke_milestones")
      .select("*")
      .eq("bespoke_job_id", jobId)
      .eq("tenant_id", auth.tenantId)
      .order("order_index", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ milestones: data });
  } catch (error) {
    reportServerError("bespoke/milestones:GET", error);
    return NextResponse.json({ error: "Failed to fetch milestones" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { jobId, title, description, due_date, order_index } = body;
    if (!jobId || !title) {
      return NextResponse.json({ error: "Missing required fields (jobId, title)" }, { status: 400 });
    }

    // Verify the job belongs to this tenant
    const admin = createAdminClient();
    const { data: job, error: jobErr } = await admin
      .from("bespoke_jobs")
      .select("id")
      .eq("id", jobId)
      .eq("tenant_id", auth.tenantId)
      .single();

    if (jobErr || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const { data, error } = await admin
      .from("bespoke_milestones")
      .insert({
        bespoke_job_id: jobId,
        tenant_id: auth.tenantId,
        title,
        description: description || null,
        due_date: due_date || null,
        order_index: order_index ?? 0,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ milestone: data });
  } catch (error) {
    reportServerError("bespoke/milestones:POST", error);
    return NextResponse.json({ error: "Failed to create milestone" }, { status: 500 });
  }
}
