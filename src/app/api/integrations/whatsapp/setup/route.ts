/**
 * POST /api/integrations/whatsapp/setup
 *
 * Saves WhatsApp Business Cloud API credentials to the integrations table.
 *
 * Body: { business_account_id, phone_number_id, access_token }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireIntegrationManager, upsertIntegration } from "@/lib/integrations";
import logger from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { withSentryFlush } from "@/lib/sentry-flush";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const POST = withSentryFlush(async (req: NextRequest) => {
  // Cleanup #31: rate-limit by tenant_id instead of IP. Pre-fix, two
  // tenants on the same corporate NAT or shared dev box could starve
  // each other's bucket — one operator running through the WhatsApp
  // setup flow at 100 reqs/min would 429 the next tenant on the same
  // egress IP for the rest of the window. Mirror the auth-context
  // lookup pattern from src/app/api/billing/portal/route.ts. Fall back
  // to IP only if there's no auth context (defence in depth: keeps the
  // bucket sane if requireIntegrationManager throws or the tenant
  // lookup fails before the actual handler body).
  const ip = req.headers.get("x-forwarded-for") ?? "anonymous";
  const rateKey = await resolveTenantRateKey(ip);
  const { success } = await checkRateLimit(rateKey, "api");
  if (!success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const { tenantId } = await requireIntegrationManager();
    const body = await req.json();
    const { business_account_id, phone_number_id, access_token } = body;

    if (!business_account_id || !phone_number_id || !access_token) {
      return NextResponse.json(
        { error: "business_account_id, phone_number_id, and access_token are required" },
        { status: 400 }
      );
    }

    const { error } = await upsertIntegration(tenantId, "whatsapp", {
      business_account_id,
      phone_number_id,
      access_token,
    });

    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("[whatsapp/setup]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
});

/**
 * GET /api/integrations/whatsapp/setup
 * Returns current WhatsApp config (without access_token).
 */
export const GET = withSentryFlush(async (_req: NextRequest) => {
  try {
    const { tenantId } = await requireIntegrationManager();
    const { getIntegration } = await import("@/lib/integrations");
    const integration = await getIntegration(tenantId, "whatsapp");

    if (!integration) {
      return NextResponse.json({ connected: false });
    }

    const cfg = integration.config as Record<string, unknown>;
    return NextResponse.json({
      connected: integration.status === "connected",
      business_account_id: cfg.business_account_id ?? null,
      phone_number_id: cfg.phone_number_id ?? null,
      // Never return the token to the client
      has_token: !!cfg.access_token,
      status: integration.status,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
});

/**
 * Resolve a tenant-scoped rate-limit key. Returns "tenant:<uuid>" for
 * authenticated tenant requests, falling back to "ip:<ip>" if there is
 * no auth context yet (e.g. cookie expired between page load and POST).
 *
 * Lookup pattern mirrors src/app/api/billing/portal/route.ts so the
 * RBAC-relevant routes use the same shape and a future
 * `users.tenant_id` schema change only has one canonical reader to
 * update.
 */
async function resolveTenantRateKey(ip: string): Promise<string> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return `ip:${ip}`;
    const admin = createAdminClient();
    const { data } = await admin
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();
    if (data?.tenant_id) return `tenant:${data.tenant_id}`;
    return `ip:${ip}`;
  } catch {
    return `ip:${ip}`;
  }
}
