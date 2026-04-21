import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Launch-QA W5-CRIT-001: this public shop endpoint previously accepted a
 * `tenant_id` from the request body and would write the enquiry under that
 * tenant if present. A stranger could POST with any tenant's UUID in the
 * body and drop repair enquiries into that tenant's inbox. The fix: the
 * subdomain path parameter is the ONLY way the tenant is resolved.
 * `tenant_id` in the body is ignored.
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

    const { name, email, phone, item_description, issue_description, preferred_date } = body;

    if (!name || !email || !item_description || !issue_description) {
      return NextResponse.json({ error: "Name, email, item description, and issue description are required" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Resolve tenant_id strictly from the subdomain. The body is not trusted.
    const { data: config } = await admin
      .from("website_config")
      .select("tenant_id")
      .eq("subdomain", subdomain)
      .single();
    const tenantId = config?.tenant_id;

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

    // Look up store owner — currently only used to keep the query logic
    // consistent across tenants; primary notification is in-app below.
    await admin
      .from("users")
      .select("email, full_name")
      .eq("tenant_id", tenantId)
      .eq("role", "owner")
      .single();

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
