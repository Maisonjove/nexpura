import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { tenantId, completed_at, title, description, due_date } = body;
  if (!tenantId) return NextResponse.json({ error: "Missing tenantId" }, { status: 400 });

  const admin = createAdminClient();
  const updates: Record<string, unknown> = {};
  if (completed_at !== undefined) updates.completed_at = completed_at;
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (due_date !== undefined) updates.due_date = due_date;

  const { error } = await admin
    .from("bespoke_milestones")
    .update(updates)
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { tenantId } = body;
  if (!tenantId) return NextResponse.json({ error: "Missing tenantId" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin
    .from("bespoke_milestones")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
