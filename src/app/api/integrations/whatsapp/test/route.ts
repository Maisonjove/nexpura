/**
 * POST /api/integrations/whatsapp/test
 *
 * Tests the WhatsApp Business API connection by calling
 * GET https://graph.facebook.com/v18.0/{phone_number_id}
 *
 * Returns { success, phone_number, display_name } on success.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, getIntegration, upsertIntegration } from "@/lib/integrations";
import logger from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { withSentryFlush } from "@/lib/sentry-flush";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const POST = withSentryFlush(async (_req: NextRequest) => {
  // Cleanup #31: rate-limit by tenant_id instead of IP. See
  // src/app/api/integrations/whatsapp/setup/route.ts for full
  // rationale — same problem on this companion route. Fall back to IP
  // only if there's no auth context.
  const ip = _req.headers.get("x-forwarded-for") ?? "anonymous";
  const rateKey = await resolveTenantRateKey(ip);
  const { success } = await checkRateLimit(rateKey, "api");
  if (!success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const { tenantId } = await getAuthContext();
    const integration = await getIntegration(tenantId, "whatsapp");

    if (!integration) {
      return NextResponse.json({ error: "WhatsApp is not configured" }, { status: 400 });
    }

    const cfg = integration.config as Record<string, unknown>;
    const phoneNumberId = cfg.phone_number_id as string;
    const accessToken = cfg.access_token as string;

    if (!phoneNumberId || !accessToken) {
      return NextResponse.json(
        { error: "Missing phone_number_id or access_token" },
        { status: 400 }
      );
    }

    const res = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      }
    );

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const msg = (errData as any)?.error?.message ?? `HTTP ${res.status}`;

      // Mark as error
      await upsertIntegration(tenantId, "whatsapp", cfg, "error");
      return NextResponse.json({ success: false, error: msg }, { status: 400 });
    }

    const data: any = await res.json();

    // Mark as connected
    await upsertIntegration(tenantId, "whatsapp", cfg, "connected");

    return NextResponse.json({
      success: true,
      display_phone_number: data.display_phone_number ?? null,
      verified_name: data.verified_name ?? null,
    });
  } catch (err) {
    logger.error("[whatsapp/test]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
});

/**
 * Resolve a tenant-scoped rate-limit key. Mirror of the helper in the
 * sibling /setup route — kept colocated so each route is independently
 * readable. Lookup shape matches src/app/api/billing/portal/route.ts.
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
