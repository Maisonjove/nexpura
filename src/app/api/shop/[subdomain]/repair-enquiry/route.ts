import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";

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

    const { name, email, phone, item_description, issue_description, preferred_date, tenant_id } = body;

    if (!name || !email || !item_description || !issue_description) {
      return NextResponse.json({ error: "Name, email, item description, and issue description are required" }, { status: 400 });
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
        enquiry_type: "repair",
        name,
        email,
        phone: phone || null,
        item_description,
        issue_description,
        preferred_date: preferred_date || null,
        status: "new",
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get store owner email for notification
    const { data: owner } = await admin
      .from("users")
      .select("email, full_name")
      .eq("tenant_id", tenantId)
      .eq("role", "owner")
      .single();

    // Note: notification to store happens via in-app notification below

    // Create in-app notification
    await admin.from("notifications").insert({
      tenant_id: tenantId,
      type: "repair_enquiry",
      title: "New Repair Enquiry",
      body: `${name} submitted a repair enquiry for: ${item_description.slice(0, 60)}`,
      link: `/enquiries`,
    });

    return NextResponse.json({ ok: true, id: enquiry?.id });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
