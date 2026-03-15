import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const STAGE_LABELS: Record<string, string> = {
  intake: "Received — Awaiting Inspection",
  quoted: "Inspected — Quote Ready",
  approved: "Quote Approved — Awaiting Workshop",
  in_progress: "In Progress",
  in_workshop: "Currently in the Workshop",
  quality_check: "Quality Check",
  ready: "Ready for Collection",
  collected: "Collected",
  cancelled: "Cancelled",
  on_hold: "On Hold",
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ subdomain: string }> }
) {
  const { subdomain } = await params;
  const ticketNumber = request.nextUrl.searchParams.get("ticket");

  if (!ticketNumber?.trim()) {
    return NextResponse.json({ error: "Ticket number required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Resolve tenant by subdomain
  const { data: tenant } = await admin
    .from("tenants")
    .select("id, name, business_name, phone, email, address_line1, suburb, state, postcode")
    .eq("subdomain", subdomain)
    .single();

  if (!tenant) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  // Look up repair by ticket number (case-insensitive)
  const { data: repair } = await admin
    .from("repairs")
    .select("repair_number, item_type, item_description, stage, due_date, created_at")
    .eq("tenant_id", tenant.id)
    .ilike("repair_number", ticketNumber.trim())
    .single();

  if (!repair) {
    return NextResponse.json({ error: "Repair ticket not found" }, { status: 404 });
  }

  const storeAddress = [tenant.address_line1, tenant.suburb, tenant.state, tenant.postcode]
    .filter(Boolean)
    .join(", ");

  return NextResponse.json({
    ticket: {
      number: repair.repair_number,
      item: repair.item_description || repair.item_type || "Item",
      stage: repair.stage,
      stageLabel: STAGE_LABELS[repair.stage] ?? repair.stage,
      estimatedReady: repair.due_date ?? null,
      receivedAt: repair.created_at,
    },
    store: {
      name: tenant.business_name || tenant.name,
      phone: tenant.phone ?? null,
      email: tenant.email ?? null,
      address: storeAddress || null,
    },
  });
}
