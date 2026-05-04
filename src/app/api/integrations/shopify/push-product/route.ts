/**
 * POST /api/integrations/shopify/push-product
 *
 * Creates or updates a product in Shopify from a Nexpura inventory item.
 *
 * Body: { inventory_id: string }
 *
 * If the item already has a shopify_product_id, it updates the product.
 * Otherwise, it creates a new one and stores the ID back on the inventory record.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, getIntegration } from "@/lib/integrations";
import { createAdminClient } from "@/lib/supabase/admin";
import logger from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { withSentryFlush } from "@/lib/sentry-flush";

export const POST = withSentryFlush(async (req: NextRequest) => {
  const ip = req.headers.get("x-forwarded-for") ?? "anonymous";
  const { success } = await checkRateLimit(ip, "api");
  if (!success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const { tenantId } = await getAuthContext();
    const body = await req.json();
    const { inventory_id } = body as { inventory_id: string };

    if (!inventory_id) {
      return NextResponse.json({ error: "inventory_id is required" }, { status: 400 });
    }

    const integration = await getIntegration(tenantId, "shopify");
    if (!integration || integration.status !== "connected") {
      return NextResponse.json({ error: "Shopify is not connected" }, { status: 400 });
    }

    const cfg = integration.config as Record<string, unknown>;
    const storeUrl = cfg.store_url as string;
    const accessToken = cfg.access_token as string;

    const admin = createAdminClient();
    const { data: item, error: itemErr } = await admin
      .from("inventory")
      .select("*")
      .eq("id", inventory_id)
      .eq("tenant_id", tenantId)
      .single();

    if (itemErr || !item) {
      return NextResponse.json({ error: "Inventory item not found" }, { status: 404 });
    }

    const product = {
      title: item.name ?? item.title ?? "Untitled Item",
      body_html: item.description ?? "",
      vendor: item.brand ?? "Nexpura",
      product_type: item.category ?? "Jewellery",
      variants: [
        {
          sku: item.sku ?? undefined,
          price: String(item.price ?? item.sale_price ?? "0.00"),
          inventory_quantity: item.quantity ?? item.stock_quantity ?? 0,
          fulfillment_service: "manual",
          inventory_management: "shopify",
        },
      ],
      images: Array.isArray(item.images)
        ? (item.images as string[]).slice(0, 10).map((src: string) => ({ src }))
        : [],
    };

    const existingShopifyId = item.shopify_product_id as string | null;

    let res: Response;
    if (existingShopifyId) {
      // Update existing product
      res = await fetch(
        `https://${storeUrl}/admin/api/2024-01/products/${existingShopifyId}.json`,
        {
          method: "PUT",
          headers: {
            "X-Shopify-Access-Token": accessToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ product }),
        }
      );
    } else {
      // Create new product
      res = await fetch(`https://${storeUrl}/admin/api/2024-01/products.json`, {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ product }),
      });
    }

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Shopify error: ${text.slice(0, 300)}` },
        { status: 400 }
      );
    }

    const data: any = await res.json();
    const shopifyProductId = String(data?.product?.id);

    // Store Shopify product ID back on the inventory item
    // Kind B (server-action-style, destructive return-error). Shopify
    // already created the product (irreversible from our side); if we
    // fail to store the linkage the next push of the same item will
    // create a duplicate Shopify product instead of updating. Surface
    // 500 so the operator retries (the linkage store is idempotent —
    // safe to retry against the same shopifyProductId).
    const { error: linkErr } = await admin
      .from("inventory")
      .update({
        shopify_product_id: shopifyProductId,
        shopify_synced_at: new Date().toISOString(),
      })
      .eq("id", inventory_id);
    if (linkErr) {
      return NextResponse.json(
        { error: `inventory shopify link save failed: ${linkErr.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      shopify_product_id: shopifyProductId,
      updated: !!existingShopifyId,
    });
  } catch (err) {
    logger.error("[shopify/push-product]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
});
