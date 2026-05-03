import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import logger from "@/lib/logger";

/**
 * Launch-QA W5-CRIT-001: this public shop endpoint previously accepted a
 * `tenant_id` from the request body and would write the enquiry under that
 * tenant if present. A stranger could POST with any tenant's UUID in the
 * body and drop arbitrary records into that tenant's enquiries + fire an
 * in-app notification there. The fix: the subdomain path parameter is the
 * ONLY way the tenant is resolved. `tenant_id` in the body is ignored.
 */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ subdomain: string }> }
) {
  const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
  const { success } = await checkRateLimit(ip, "api");
  if (!success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const { subdomain } = await params;
    const body = await request.json();

    const { name, email, phone, appointment_type, preferred_date, preferred_time, notes } = body;

    if (!name || !email || !appointment_type || !preferred_date || !preferred_time) {
      return NextResponse.json({ error: "Name, email, appointment type, date, and time slot are required" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Resolve tenant_id strictly from the subdomain. The body is not trusted.
    // Joey 2026-05-03 P2-B audit: also enforce published=true (matches the
    // sibling /enquiry endpoint behaviour) and reject soft-deleted tenants
    // by JOIN. Pre-fix unpublished or soft-deleted tenants accepted
    // submissions silently.
    const { data: config } = await admin
      .from("website_config")
      .select("tenant_id, published, tenants!inner(deleted_at)")
      .eq("subdomain", subdomain)
      .maybeSingle();
    const tenantId = config?.tenant_id;
    const tenantsRel = (config as unknown as { tenants?: { deleted_at: string | null } | null })?.tenants;

    if (!tenantId || !config?.published || tenantsRel?.deleted_at) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    // Save enquiry
    const { data: enquiry, error } = await admin
      .from("shop_enquiries")
      .insert({
        tenant_id: tenantId,
        enquiry_type: "appointment",
        name,
        email,
        phone: phone || null,
        appointment_type,
        preferred_date,
        preferred_time,
        message: notes || null,
        status: "new",
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Create in-app notification. Joey 2026-05-03 P2-B audit: capture
    // the error so a silent fail (RLS, schema drift, etc.) shows up in
    // logs instead of returning ok=true with no dashboard alert.
    const { error: notifErr } = await admin.from("notifications").insert({
      tenant_id: tenantId,
      type: "appointment_request",
      title: "New Appointment Request",
      body: `${name} requested a ${appointment_type} appointment on ${preferred_date}`,
      link: `/enquiries`,
    });
    if (notifErr) {
      logger.error("[shop/appointment] notification insert failed", { tenantId, err: notifErr });
    }

    return NextResponse.json({ ok: true, id: enquiry?.id });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
