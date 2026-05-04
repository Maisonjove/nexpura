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
import { logWebhookAudit } from "@/lib/webhook-audit";

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

    // Get the raw body up front so audit-log writes can hash it
    // regardless of which auth gate fails.
    const rawBody = await req.text();

    if (!topic || !source) {
      await logWebhookAudit({
        handlerName: "woocommerce",
        signatureStatus: "missing_headers",
        request: req,
        body: rawBody,
      });
      return NextResponse.json({ error: "Missing webhook headers" }, { status: 400 });
    }

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
      await logWebhookAudit({
        handlerName: "woocommerce",
        signatureStatus: "not_configured",
        request: req,
        body: rawBody,
        eventType: topic,
      });
      return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
    }
    if (!signature) {
      logger.warn("[woo-webhook] missing x-wc-webhook-signature header");
      await logWebhookAudit({
        handlerName: "woocommerce",
        signatureStatus: "missing_signature",
        request: req,
        body: rawBody,
        eventType: topic,
      });
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }
    if (!verifyWooSignature(rawBody, signature, consumer_secret)) {
      logger.warn("[woo-webhook] Invalid signature");
      await logWebhookAudit({
        handlerName: "woocommerce",
        signatureStatus: "invalid_signature",
        request: req,
        body: rawBody,
        eventType: topic,
      });
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Valid-signature audit row.
    await logWebhookAudit({
      handlerName: "woocommerce",
      signatureStatus: "valid",
      request: req,
      body: rawBody,
      eventId: webhookId,
      eventType: topic,
    });

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

    // Log webhook receipt. Policy: log-on-error, do NOT throw.
    // activity_log is observability not state-of-record; missing
    // a row here doesn't change tenant data integrity.
    const { error: actErr } = await admin.from("activity_log").insert({
      tenant_id: tenantId,
      action: `woo_webhook_${topic}`,
      details: { webhook_id: webhookId, resource, event },
    });
    if (actErr) {
      logger.error("[woo-webhook] activity_log insert failed (non-fatal)", { tenantId, topic, err: actErr });
    }

    return NextResponse.json({ success: true, topic });
  } catch (err) {
    // P2-F audit (Joey 2026-05-04): pre-fix this echoed
    // err.message verbatim into the response body — risked
    // leaking DB column names / internal paths to whatever can
    // hit this endpoint (Woo's webhook source = the merchant's
    // store, but a misconfigured webhook could land arbitrary
    // bodies). Now: generic copy in the response, full err in
    // the server log.
    logger.error("[woo-webhook] Error:", err);
    return NextResponse.json(
      { error: "Webhook processing failed" },
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
  // inventory has neither `woo_product_id` nor `last_synced_at` (verified
  // 2026-04-25). Pre-fix every Woo product webhook hit PGRST204 → handler
  // 500'd, Woo retried indefinitely. Use the existing `import_metadata`
  // JSONB column to carry the Woo product ID + sync timestamp.
  // P2-F audit (Joey 2026-05-04): every write below is destructive
  // (creates/updates/deactivates inventory). On error we throw — the
  // outer try/catch in POST() returns 500, Woo retries.
  if (event === "deleted") {
    // Mark as inactive rather than delete. Look up by import_metadata.
    const { data: existing } = await admin
      .from("inventory")
      .select("id, import_metadata")
      .eq("tenant_id", tenantId)
      .eq("import_metadata->>woo_product_id", String(product.id))
      .maybeSingle();
    if (existing) {
      const { error: deactErr } = await admin
        .from("inventory")
        .update({ status: "inactive", updated_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (deactErr) {
        throw new Error(`inventory deactivate (woo product.deleted) failed: ${deactErr.message}`);
      }
    }
    return;
  }

  const sku = product.sku || `woo-${product.id}`;

  const { error: upsertErr } = await admin.from("inventory").upsert(
    {
      tenant_id: tenantId,
      name: product.name,
      sku,
      retail_price: parseFloat(product.regular_price) || 0,
      quantity: product.stock_quantity || 0,
      status: product.status === "publish" ? "active" : "inactive",
      import_metadata: {
        source: "woocommerce",
        woo_product_id: String(product.id),
        synced_at: new Date().toISOString(),
      },
    },
    { onConflict: "tenant_id,sku", ignoreDuplicates: false }
  );
  if (upsertErr) {
    throw new Error(`inventory upsert (woo product) failed: ${upsertErr.message}`);
  }
}

async function handleOrderWebhook(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  event: string,
  order: WooOrder
) {
  // sales has no `external_reference` column (verified 2026-04-25).
  // Pre-fix this lookup PGRST204'd and handler 500'd. Use the
  // existing import_metadata JSONB instead.
  const { data: existing } = await admin
    .from("sales")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("import_metadata->>woo_order_id", String(order.id))
    .maybeSingle();

  // P2-F audit (Joey 2026-05-04): order.deleted path. Pre-fix this
  // fell through to the else-branch below and CREATED a phantom
  // sale row from the deleted order's payload, because `existing`
  // was null (we'd never imported it) and the early-return only
  // covered event === "created". Now: explicit handling — soft-
  // delete the matching sale if found, no-op otherwise.
  if (event === "deleted") {
    if (existing) {
      const { error: delErr } = await admin
        .from("sales")
        .update({
          status: "cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      if (delErr) {
        // Destructive — Woo deletion not propagating to our DB
        // means inventory + financials drift. Throw → 500 → retry.
        throw new Error(`sales cancel (woo order.deleted) failed: ${delErr.message}`);
      }
    }
    return;
  }

  if (existing && event === "created") {
    // Already imported, skip
    return;
  }

  const total = parseFloat(order.total);
  const customerName = order.billing
    ? `${order.billing.first_name} ${order.billing.last_name}`.trim()
    : null;

  if (existing) {
    // Update existing sale status. Destructive → throw on error.
    const { error: updErr } = await admin
      .from("sales")
      .update({
        status: mapWooStatus(order.status),
        total,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (updErr) {
      throw new Error(`sales status update failed: ${updErr.message}`);
    }
  } else {
    // Create new sale. Use import_metadata for the Woo correlation ID
    // since `sales.external_reference` doesn't exist.
    const { data: sale, error: saleInsErr } = await admin.from("sales").insert({
      tenant_id: tenantId,
      sale_number: `WOO-${order.number}`,
      total,
      subtotal: total,
      tax_amount: 0,
      discount_amount: 0,
      payment_method: order.payment_method || "woocommerce",
      customer_name: customerName,
      customer_email: order.billing?.email || null,
      import_metadata: {
        source: "woocommerce",
        woo_order_id: String(order.id),
      },
      created_at: order.date_created,
      status: mapWooStatus(order.status),
    }).select("id").single();
    if (saleInsErr || !sale) {
      throw new Error(`sales insert (woo order.created) failed: ${saleInsErr?.message ?? "no row returned"}`);
    }

    {
      // Insert line items
      for (const li of order.line_items) {
        // W2-004: route both sides of the .or() through eqOrValue so a
        // crafted product/sku string can't break out of PostgREST filter
        // syntax. Keep sanitizeOrLiteral as a sanity gate (strips non-
        // alphanumeric) on top of quoting.
        // inventory.woo_product_id doesn't exist; we now stash the woo
        // ID inside import_metadata. Match on SKU first (canonical
        // unique key) and fall back to import_metadata.woo_product_id.
        const safeSku = sanitizeOrLiteral(li.sku);
        let inventoryItem: { id: string } | null = null;
        if (safeSku) {
          const { data } = await admin
            .from("inventory")
            .select("id")
            .eq("tenant_id", tenantId)
            .eq("sku", safeSku)
            .maybeSingle();
          inventoryItem = (data as { id: string } | null) ?? null;
        }
        if (!inventoryItem && li.product_id) {
          const { data } = await admin
            .from("inventory")
            .select("id")
            .eq("tenant_id", tenantId)
            .eq("import_metadata->>woo_product_id", String(li.product_id))
            .maybeSingle();
          inventoryItem = (data as { id: string } | null) ?? null;
        }

        // sale_items column is `line_total`, not `total` (verified).
        // Destructive — line items are state-of-record. Throw → 500
        // → Woo retries the entire order.created event.
        const { error: lineErr } = await admin.from("sale_items").insert({
          tenant_id: tenantId,
          sale_id: sale.id,
          inventory_id: inventoryItem?.id || null,
          quantity: li.quantity,
          unit_price: li.price,
          line_total: li.quantity * li.price,
        });
        if (lineErr) {
          throw new Error(`sale_items insert failed: ${lineErr.message}`);
        }

        // Decrement inventory if matched. Destructive — getting stock
        // levels wrong is a P1 for the merchant. Throw → 500 → retry.
        if (inventoryItem?.id) {
          const { error: decErr } = await admin.rpc("decrement_inventory", {
            item_id: inventoryItem.id,
            qty: li.quantity,
          });
          if (decErr) {
            throw new Error(`decrement_inventory rpc failed: ${decErr.message}`);
          }
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

  // P2-F audit (Joey 2026-05-04): customer.deleted path. Pre-fix
  // ALL events fell through to the upsert below — so a Woo customer
  // deletion silently RE-CREATED the customer in our DB (undoing
  // any prior soft-delete + restoring opted-out CRM contacts). Now:
  // soft-delete on event=deleted, upsert otherwise.
  if (event === "deleted") {
    const { error: delErr } = await admin
      .from("customers")
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId)
      .eq("import_metadata->>woo_customer_id", String(customer.id ?? ""));
    if (delErr) {
      // Destructive — Woo deletion failing to propagate means the
      // customer stays alive locally despite GDPR-style erasure
      // upstream. Throw → 500 → Woo retries.
      throw new Error(`customer soft-delete failed: ${delErr.message}`);
    }
    return;
  }

  // customers has no `source` column (verified 2026-04-25). Pre-fix
  // every Woo customer.* webhook PGRST204'd. Stash the source in the
  // existing import_metadata JSONB column. Destructive (state-of-
  // record sync) — throw on error.
  const { error: upsertErr } = await admin.from("customers").upsert(
    {
      tenant_id: tenantId,
      email: customer.email,
      full_name: `${customer.first_name || ""} ${customer.last_name || ""}`.trim(),
      mobile: customer.billing?.phone || null,
      import_metadata: {
        source: "woocommerce",
        woo_customer_id: String(customer.id ?? ""),
        synced_at: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,email", ignoreDuplicates: false }
  );
  if (upsertErr) {
    throw new Error(`customer upsert failed: ${upsertErr.message}`);
  }
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
