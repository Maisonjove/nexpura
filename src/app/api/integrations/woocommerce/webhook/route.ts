/**
 * POST /api/integrations/woocommerce/webhook
 * 
 * Handles incoming webhooks from WooCommerce for real-time sync:
 * - product.created, product.updated, product.deleted
 * - order.created, order.updated
 * - customer.created, customer.updated
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { headers } from "next/headers";
import logger from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyWooSignature } from "@/lib/webhook-security";
import { getIntegration } from "@/lib/integrations";
import { eqOrValue } from "@/lib/db/or-escape";

/** Escapes special PostgreSQL LIKE pattern characters to prevent injection */
function sanitizeLikePattern(input: string): string {
  return input
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}

/**
 * Escape user-controlled values that flow into a PostgREST `.or()` filter
 * string. PostgREST parses `,` `.` `(` `)` as filter syntax, and `)` can
 * terminate the filter early. W6-CRIT-09 tactical guard; the broader
 * escape layer lands in PR-07.
 */
function sanitizeOrLiteral(input: string | number | null | undefined): string {
  if (input === null || input === undefined) return "";
  const s = String(input);
  // Only allow [A-Za-z0-9_-]. Anything else gets stripped so the filter
  // cannot be broken out of.
  return s.replace(/[^A-Za-z0-9_-]/g, "");
}

interface WooProduct {
  id: number;
  name: string;
  sku: string;
  regular_price: string;
  stock_quantity: number | null;
  manage_stock: boolean;
  status: string;
}

interface WooOrder {
  id: number;
  number: string;
  date_created: string;
  total: string;
  status: string;
  payment_method: string;
  billing: { first_name: string; last_name: string; email: string; phone?: string };
  line_items: Array<{
    id: number;
    name: string;
    quantity: number;
    price: number;
    sku: string;
    product_id: number;
  }>;
}

interface WooCustomer {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  billing: { phone?: string };
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "anonymous";
  const { success } = await checkRateLimit(ip, "webhook");
  if (!success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const headersList = await headers();
    const signature = headersList.get("x-wc-webhook-signature");
    const source = headersList.get("x-wc-webhook-source");
    const topic = headersList.get("x-wc-webhook-topic");
    const webhookId = headersList.get("x-wc-webhook-id");

    if (!topic || !source) {
      return NextResponse.json({ error: "Missing webhook headers" }, { status: 400 });
    }

    // Get the raw body for signature verification
    const rawBody = await req.text();
    const body = JSON.parse(rawBody);

    // Find tenant by store URL (sanitize hostname to prevent LIKE injection).
    // `store_url` is a non-secret public field, so it lives in the plaintext
    // `config` column and is filterable. The consumer_secret lives in
    // `config_encrypted` and is loaded via getIntegration() below
    // (W6-HIGH-12).
    const admin = createAdminClient();
    const safeHostname = sanitizeLikePattern(new URL(source).hostname);
    const { data: integrationRow } = await admin
      .from("integrations")
      .select("tenant_id")
      .eq("type", "woocommerce")
      .eq("status", "connected")
      .filter("config->>store_url", "ilike", `%${safeHostname}%`)
      .single();

    if (!integrationRow) {
      logger.warn("[woo-webhook] No matching integration for source:", source);
      return NextResponse.json({ error: "Unknown store" }, { status: 404 });
    }

    const tenantId = integrationRow.tenant_id as string;
    // Decrypt secrets at the verification boundary only.
    const integration = await getIntegration(tenantId, "woocommerce");
    const consumer_secret = integration?.config?.consumer_secret as string | undefined;

    // W6-CRIT-09: fail-closed. The previous guard only verified the
    // signature when BOTH header and secret were present, so an attacker
    // could just drop the header and walk past the check. Now: secret
    // MUST be configured, signature header MUST be present, and the
    // HMAC MUST match in constant time. Any failure => 401.
    if (!consumer_secret) {
      logger.error("[woo-webhook] integration has no consumer_secret configured");
      return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
    }
    if (!signature) {
      logger.warn("[woo-webhook] missing x-wc-webhook-signature header");
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }
    if (!verifyWooSignature(rawBody, signature, consumer_secret)) {
      logger.warn("[woo-webhook] Invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Handle webhook by topic
    const [resource, event] = topic.split(".");
    
    switch (resource) {
      case "product":
        await handleProductWebhook(admin, tenantId, event, body);
        break;
      case "order":
        await handleOrderWebhook(admin, tenantId, event, body);
        break;
      case "customer":
        await handleCustomerWebhook(admin, tenantId, event, body);
        break;
      default:
        logger.info(`[woo-webhook] Unhandled topic: ${topic}`);
    }

    // Log webhook receipt
    await admin.from("activity_log").insert({
      tenant_id: tenantId,
      action: `woo_webhook_${topic}`,
      details: { webhook_id: webhookId, resource, event },
    });

    return NextResponse.json({ success: true, topic });
  } catch (err) {
    logger.error("[woo-webhook] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Webhook processing failed" },
      { status: 500 }
    );
  }
}

async function handleProductWebhook(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  event: string,
  product: WooProduct
) {
  if (event === "deleted") {
    // Mark as inactive rather than delete
    await admin
      .from("inventory")
      .update({ status: "inactive", updated_at: new Date().toISOString() })
      .eq("tenant_id", tenantId)
      .eq("woo_product_id", String(product.id));
    return;
  }

  // Create or update inventory item
  const sku = product.sku || `woo-${product.id}`;
  
  await admin.from("inventory").upsert(
    {
      tenant_id: tenantId,
      name: product.name,
      sku,
      retail_price: parseFloat(product.regular_price) || 0,
      quantity: product.stock_quantity || 0,
      woo_product_id: String(product.id),
      status: product.status === "publish" ? "active" : "inactive",
      last_synced_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,woo_product_id", ignoreDuplicates: false }
  );
}

async function handleOrderWebhook(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  event: string,
  order: WooOrder
) {
  // Check if already exists
  const { data: existing } = await admin
    .from("sales")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("external_reference", `woo_${order.id}`)
    .single();

  if (existing && event === "created") {
    // Already imported, skip
    return;
  }

  const total = parseFloat(order.total);
  const customerName = order.billing
    ? `${order.billing.first_name} ${order.billing.last_name}`.trim()
    : null;

  if (existing) {
    // Update existing sale status
    await admin
      .from("sales")
      .update({
        status: mapWooStatus(order.status),
        total,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else {
    // Create new sale
    const { data: sale } = await admin.from("sales").insert({
      tenant_id: tenantId,
      sale_number: `WOO-${order.number}`,
      total,
      subtotal: total,
      tax_amount: 0,
      discount_amount: 0,
      payment_method: order.payment_method || "woocommerce",
      customer_name: customerName,
      customer_email: order.billing?.email || null,
      external_reference: `woo_${order.id}`,
      created_at: order.date_created,
      status: mapWooStatus(order.status),
    }).select("id").single();

    if (sale) {
      // Insert line items
      for (const li of order.line_items) {
        // W2-004: route both sides of the .or() through eqOrValue so a
        // crafted product/sku string can't break out of PostgREST filter
        // syntax. Keep sanitizeOrLiteral as a sanity gate (strips non-
        // alphanumeric) on top of quoting.
        const safeSku = sanitizeOrLiteral(li.sku);
        const safeWooId = sanitizeOrLiteral(li.product_id);
        const orClauses: string[] = [];
        if (safeSku) orClauses.push(`sku.${eqOrValue(safeSku)}`);
        if (safeWooId) orClauses.push(`woo_product_id.${eqOrValue(safeWooId)}`);
        const { data: inventoryItem } = orClauses.length
          ? await admin
              .from("inventory")
              .select("id")
              .eq("tenant_id", tenantId)
              .or(orClauses.join(","))
              .maybeSingle()
          : { data: null };

        await admin.from("sale_items").insert({
          tenant_id: tenantId,
          sale_id: sale.id,
          inventory_id: inventoryItem?.id || null,
          quantity: li.quantity,
          unit_price: li.price,
          total: li.quantity * li.price,
        });

        // Decrement inventory if matched
        if (inventoryItem?.id) {
          await admin.rpc("decrement_inventory", {
            item_id: inventoryItem.id,
            qty: li.quantity,
          });
        }
      }
    }
  }
}

async function handleCustomerWebhook(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  event: string,
  customer: WooCustomer
) {
  if (!customer.email) return;

  await admin.from("customers").upsert(
    {
      tenant_id: tenantId,
      email: customer.email,
      full_name: `${customer.first_name || ""} ${customer.last_name || ""}`.trim(),
      mobile: customer.billing?.phone || null,
      source: "woocommerce",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,email", ignoreDuplicates: false }
  );
}

function mapWooStatus(wooStatus: string): string {
  const statusMap: Record<string, string> = {
    pending: "pending",
    processing: "pending",
    "on-hold": "pending",
    completed: "completed",
    cancelled: "cancelled",
    refunded: "refunded",
    failed: "cancelled",
  };
  return statusMap[wooStatus] || "pending";
}
