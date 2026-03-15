/**
 * POST /api/integrations/shopify/test
 *
 * Tests Shopify connection by calling the shop endpoint.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, getIntegration, upsertIntegration } from "@/lib/integrations";

export async function POST(_req: NextRequest) {
  try {
    const { tenantId } = await getAuthContext();
    const integration = await getIntegration(tenantId, "shopify");

    if (!integration) {
      return NextResponse.json({ error: "Shopify is not configured" }, { status: 400 });
    }

    const cfg = integration.config as Record<string, unknown>;
    const storeUrl = cfg.store_url as string;
    const accessToken = cfg.access_token as string;

    if (!storeUrl || !accessToken) {
      return NextResponse.json(
        { error: "Missing store_url or access_token" },
        { status: 400 }
      );
    }

    const res = await fetch(
      `https://${storeUrl}/admin/api/2024-01/shop.json`,
      {
        headers: {
          "X-Shopify-Access-Token": accessToken,
          Accept: "application/json",
        },
      }
    );

    if (!res.ok) {
      const text = await res.text();
      await upsertIntegration(tenantId, "shopify", cfg, "error");
      return NextResponse.json(
        { success: false, error: `Shopify returned ${res.status}: ${text.slice(0, 200)}` },
        { status: 400 }
      );
    }

    const data: any = await res.json();
    await upsertIntegration(tenantId, "shopify", cfg, "connected");

    return NextResponse.json({
      success: true,
      shop_name: data?.shop?.name ?? null,
      shop_domain: data?.shop?.domain ?? null,
    });
  } catch (err) {
    console.error("[shopify/test]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
