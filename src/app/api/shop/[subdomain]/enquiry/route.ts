import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ subdomain: string }> }
) {
  const { subdomain } = await params;

  let body: {
    name?: string;
    email?: string;
    phone?: string;
    message?: string;
    item_name?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.name || !body.email || !body.message) {
    return NextResponse.json({ error: "Name, email, and message are required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Get website config + tenant
  const { data: config } = await supabase
    .from("website_config")
    .select("tenant_id, allow_enquiry, published")
    .eq("subdomain", subdomain)
    .maybeSingle();

  if (!config?.published) {
    return NextResponse.json({ error: "Website not found" }, { status: 404 });
  }

  if (config.allow_enquiry === false) {
    return NextResponse.json({ error: "Enquiries are not enabled" }, { status: 403 });
  }

  // Look up customer if they exist
  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("tenant_id", config.tenant_id)
    .eq("email", body.email.toLowerCase())
    .maybeSingle();

  // Insert communication record
  const subject = body.item_name
    ? `Website enquiry: ${body.item_name}`
    : "Website enquiry";

  const bodyText = [
    `From: ${body.name}`,
    `Email: ${body.email}`,
    body.phone ? `Phone: ${body.phone}` : null,
    "",
    body.message,
  ]
    .filter((l) => l !== null)
    .join("\n");

  const { error } = await supabase.from("communications").insert({
    tenant_id: config.tenant_id,
    customer_id: customer?.id || null,
    customer_email: body.email,
    customer_name: body.name,
    type: "note", // use note since website_enquiry may not be in constraint yet
    subject,
    body: bodyText,
    status: "sent",
  });

  if (error) {
    console.error("Enquiry insert error:", error);
    return NextResponse.json({ error: "Failed to save enquiry" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
