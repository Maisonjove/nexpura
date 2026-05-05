import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import logger from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { withSentryFlush } from "@/lib/sentry-flush";

// Public contact-form schema. Enforced lengths stop a spammer bloating
// the DB with a megabyte-sized "message" and shut down the most obvious
// XSS-via-long-input patterns. Honeypot field `website` should always
// be empty from real browsers; spambots fill every field.
const enquirySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  email: z.string().trim().email("Please enter a valid email").max(200),
  phone: z.string().trim().max(40).optional(),
  message: z.string().trim().min(1, "Message is required").max(5000),
  item_name: z.string().trim().max(400).optional(),
  // honeypot — must be empty
  website: z.string().max(0).optional().or(z.literal("")).or(z.undefined()),
});

export const POST = withSentryFlush(async (
  req: NextRequest,
  { params }: { params: Promise<{ subdomain: string }> }
) => {
  const ip = req.headers.get("x-forwarded-for") ?? "anonymous";
  const { success } = await checkRateLimit(`${ip}:enquiry`, "shop-anon");
  if (!success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const { subdomain } = await params;

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = enquirySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  // Honeypot: if a bot filled the hidden `website` field, swallow the
  // request with a 200 so spam pipelines think it worked but no row
  // lands in the DB.
  if (parsed.data.website && parsed.data.website.length > 0) {
    return NextResponse.json({ success: true });
  }

  const body = parsed.data;

  const supabase = createAdminClient();

  // Get website config + tenant
  // Joey 2026-05-05 P2-C audit: also enforce tenants.deleted_at IS NULL by
  // JOIN, matching the 3 sibling routes (appointment + repair-enquiry +
  // repair-track) which were gated in PR #121's P2-B audit. Pre-fix this
  // route accepted enquiry submissions for soft-deleted tenants and silently
  // landed orphan rows in `communications`. Live evidence: P2-C synthetic-
  // fixture probe surfaced a row from POST /api/shop/nexpura-dogfood/enquiry
  // while tenants.deleted_at IS NOT NULL — same half-fix-pair pattern as
  // tracked under cleanup #23.
  const { data: config } = await supabase
    .from("website_config")
    .select("tenant_id, allow_enquiry, published, tenants!inner(deleted_at)")
    .eq("subdomain", subdomain)
    .maybeSingle();
  const tenantsRel = (config as unknown as { tenants?: { deleted_at: string | null } | null })?.tenants;

  if (!config?.published || tenantsRel?.deleted_at) {
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
    logger.error("Enquiry insert error:", error);
    return NextResponse.json({ error: "Failed to save enquiry" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
});
