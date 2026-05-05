import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";

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
  const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
  const { success } = await checkRateLimit(ip, "shop");
  if (!success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const { subdomain } = await params;
  const ticketNumber = request.nextUrl.searchParams.get("ticket");

  if (!ticketNumber?.trim()) {
    return NextResponse.json({ error: "Ticket number required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Joey 2026-05-03 P2-B audit: pre-fix this resolved tenant from
  // tenants.subdomain (a different column to website_config.subdomain
  // used by every sibling endpoint), and didn't filter deleted_at. Now
  // resolve via website_config.subdomain + JOIN tenants for the contact
  // fields, with deleted_at and published guards. Brings repair-track
  // into line with /enquiry / /appointment / /repair-enquiry.
  const { data: config } = await admin
    .from("website_config")
    .select("tenant_id, published, tenants!inner(id, name, business_name, phone, email, address_line1, suburb, state, postcode, deleted_at)")
    .eq("subdomain", subdomain)
    .maybeSingle();
  const tenantsRel = (config as unknown as {
    tenants?: {
      id: string;
      name: string | null;
      business_name: string | null;
      phone: string | null;
      email: string | null;
      address_line1: string | null;
      suburb: string | null;
      state: string | null;
      postcode: string | null;
      deleted_at: string | null;
    } | null;
  })?.tenants;
  if (!config?.published || !tenantsRel || tenantsRel.deleted_at) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }
  const tenant = tenantsRel;

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
