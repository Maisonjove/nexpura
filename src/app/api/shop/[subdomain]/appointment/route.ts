import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ subdomain: string }> }
) {
  try {
    const { subdomain } = await params;
    const body = await request.json();

    const { name, email, phone, appointment_type, preferred_date, preferred_time, notes, tenant_id } = body;

    if (!name || !email || !appointment_type || !preferred_date || !preferred_time) {
      return NextResponse.json({ error: "Name, email, appointment type, date, and time slot are required" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Resolve tenant_id from subdomain if not provided
    let tenantId = tenant_id;
    if (!tenantId) {
      const { data: config } = await admin
        .from("website_config")
        .select("tenant_id")
        .eq("subdomain", subdomain)
        .single();
      tenantId = config?.tenant_id;
    }

    if (!tenantId) {
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

    // Create in-app notification
    await admin.from("notifications").insert({
      tenant_id: tenantId,
      type: "appointment_request",
      title: "New Appointment Request",
      body: `${name} requested a ${appointment_type} appointment on ${preferred_date}`,
      link: `/enquiries`,
    });

    return NextResponse.json({ ok: true, id: enquiry?.id });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
