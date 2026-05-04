/**
 * POST /api/integrations/woocommerce/setup-webhooks
 * 
 * Creates webhooks in WooCommerce for real-time sync.
 * Called after connecting WooCommerce integration.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, getIntegration, upsertIntegration } from "@/lib/integrations";
import logger from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { withSentryFlush } from "@/lib/sentry-flush";

interface WooConfig {
  store_url: string;
  consumer_key: string;
  consumer_secret: string;
  webhook_ids?: string[];
}

const WEBHOOK_TOPICS = [
  "product.created",
  "product.updated",
  "product.deleted",
  "order.created",
  "order.updated",
  "customer.created",
  "customer.updated",
];

export const POST = withSentryFlush(async (req: NextRequest) => {
  const ip = req.headers.get("x-forwarded-for") ?? "anonymous";
  const { success } = await checkRateLimit(ip, "api");
  if (!success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const { tenantId } = await getAuthContext();
    
    const integration = await getIntegration(tenantId, "woocommerce");
    if (!integration) {
      return NextResponse.json({ error: "WooCommerce not connected" }, { status: 400 });
    }

    const config = integration.config as unknown as WooConfig;
    const { store_url, consumer_key, consumer_secret } = config;

    // Build webhook delivery URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.nexpura.com";
    const deliveryUrl = `${appUrl}/api/integrations/woocommerce/webhook`;

    const baseUrl = store_url.replace(/\/$/, "");
    const credentials = Buffer.from(`${consumer_key}:${consumer_secret}`).toString("base64");

    const createdWebhooks: string[] = [];
    const errors: string[] = [];

    // First, check existing webhooks to avoid duplicates
    try {
      const existingRes = await fetch(`${baseUrl}/wp-json/wc/v3/webhooks?per_page=100`, {
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/json",
        },
      });

      if (existingRes.ok) {
        const existing = await existingRes.json();
        
        // Delete existing Nexpura webhooks (by delivery_url)
        for (const webhook of existing) {
          if (webhook.delivery_url === deliveryUrl) {
            await fetch(`${baseUrl}/wp-json/wc/v3/webhooks/${webhook.id}?force=true`, {
              method: "DELETE",
              headers: {
                Authorization: `Basic ${credentials}`,
              },
            });
          }
        }
      }
    } catch (err) {
      logger.warn("[woo-setup-webhooks] Could not clean up existing webhooks:", err);
    }

    // Create webhooks for each topic
    for (const topic of WEBHOOK_TOPICS) {
      try {
        const res = await fetch(`${baseUrl}/wp-json/wc/v3/webhooks`, {
          method: "POST",
          headers: {
            Authorization: `Basic ${credentials}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: `Nexpura - ${topic}`,
            topic,
            delivery_url: deliveryUrl,
            secret: consumer_secret, // Use consumer secret for signature
            status: "active",
          }),
        });

        if (res.ok) {
          const webhook = await res.json();
          createdWebhooks.push(webhook.id);
        } else {
          const error = await res.text();
          errors.push(`${topic}: ${error}`);
        }
      } catch (err) {
        errors.push(`${topic}: ${err instanceof Error ? err.message : "Failed"}`);
      }
    }

    // Save webhook IDs to integration config
    await upsertIntegration(tenantId, "woocommerce", {
      ...config,
      webhook_ids: createdWebhooks,
      webhooks_setup_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: errors.length === 0,
      created: createdWebhooks.length,
      errors,
      message: `Created ${createdWebhooks.length}/${WEBHOOK_TOPICS.length} webhooks`,
    });
  } catch (err) {
    logger.error("[woo-setup-webhooks]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to set up webhooks" },
      { status: 500 }
    );
  }
});

/**
 * DELETE - Remove all Nexpura webhooks from WooCommerce
 */
export const DELETE = withSentryFlush(async (req: NextRequest) => {
  try {
    const { tenantId } = await getAuthContext();
    
    const integration = await getIntegration(tenantId, "woocommerce");
    if (!integration) {
      return NextResponse.json({ error: "WooCommerce not connected" }, { status: 400 });
    }

    const config = integration.config as unknown as WooConfig;
    const { store_url, consumer_key, consumer_secret, webhook_ids = [] } = config;

    const baseUrl = store_url.replace(/\/$/, "");
    const credentials = Buffer.from(`${consumer_key}:${consumer_secret}`).toString("base64");

    let deleted = 0;

    for (const webhookId of webhook_ids) {
      try {
        const res = await fetch(`${baseUrl}/wp-json/wc/v3/webhooks/${webhookId}?force=true`, {
          method: "DELETE",
          headers: {
            Authorization: `Basic ${credentials}`,
          },
        });
        if (res.ok) deleted++;
      } catch {
        // Ignore individual deletion errors
      }
    }

    // Clear webhook IDs from config
    await upsertIntegration(tenantId, "woocommerce", {
      ...config,
      webhook_ids: [],
      webhooks_setup_at: null,
    });

    return NextResponse.json({ success: true, deleted });
  } catch (err) {
    logger.error("[woo-setup-webhooks] DELETE error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to remove webhooks" },
      { status: 500 }
    );
  }
});
