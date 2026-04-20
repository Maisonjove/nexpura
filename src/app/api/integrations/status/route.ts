/**
 * GET /api/integrations/status
 *
 * Returns a summary of all integration statuses for the current tenant.
 * Used by the integrations page to show connected/disconnected badges.
 */

import { NextRequest, NextResponse } from "next/server";

// Cache for 30 seconds with stale-while-revalidate — integration status rarely changes
import { getAuthContext, getAllIntegrations } from "@/lib/integrations";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(_req: NextRequest) {
  const ip = _req.headers.get("x-forwarded-for") ?? "anonymous";
  const { success } = await checkRateLimit(ip, "api");
  if (!success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const { tenantId } = await getAuthContext();
    const integrations = await getAllIntegrations(tenantId);

    const xeroConfigured =
      !!(process.env.XERO_CLIENT_ID && process.env.XERO_CLIENT_SECRET && process.env.XERO_REDIRECT_URI);

    const byType = Object.fromEntries(integrations.map((i) => [i.type, i]));

    return NextResponse.json({
      xero: {
        status: byType.xero?.status ?? "disconnected",
        org_name: (byType.xero?.config as any)?.org_name ?? null,
        last_sync_at: byType.xero?.last_sync_at ?? null,
        configured: xeroConfigured,
      },
      whatsapp: {
        status: byType.whatsapp?.status ?? "disconnected",
        phone_number_id: (byType.whatsapp?.config as any)?.phone_number_id ?? null,
      },
      shopify: {
        status: byType.shopify?.status ?? "disconnected",
        store_url: (byType.shopify?.config as any)?.store_url ?? null,
        last_sync_at: byType.shopify?.last_sync_at ?? null,
      },
      insurance: {
        status: byType.insurance?.status ?? "disconnected",
        enabled: (byType.insurance?.config as any)?.enabled ?? false,
        appraiser_name: (byType.insurance?.config as any)?.appraiser_name ?? null,
      },
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
