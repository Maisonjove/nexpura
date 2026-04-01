import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthContext } from "@/lib/auth-context";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { completed_at, title, description, due_date } = body;

  const admin = createAdminClient();
  
  // Verify milestone belongs to this tenant
  const { data: milestone, error: milestoneErr } = await admin
    .from("bespoke_milestones")
    .select("id")
    .eq("id", id)
    .eq("tenant_id", auth.tenantId)
    .single();

  if (milestoneErr || !milestone) {
    return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  if (completed_at !== undefined) updates.completed_at = completed_at;
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (due_date !== undefined) updates.due_date = due_date;

  const { error } = await admin
    .from("bespoke_milestones")
    .update(updates)
    .eq("id", id)
    .eq("tenant_id", auth.tenantId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const admin = createAdminClient();
  
  // Verify milestone belongs to this tenant
  const { data: milestone, error: milestoneErr } = await admin
    .from("bespoke_milestones")
    .select("id")
    .eq("id", id)
    .eq("tenant_id", auth.tenantId)
    .single();

  if (milestoneErr || !milestone) {
    return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
  }

  const { error } = await admin
    .from("bespoke_milestones")
    .delete()
    .eq("id", id)
    .eq("tenant_id", auth.tenantId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
