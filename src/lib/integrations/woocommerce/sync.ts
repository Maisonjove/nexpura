/**
 * WooCommerce Two-Way Sync
 * 
 * Handles bidirectional sync between Nexpura and WooCommerce:
 * - Products ↔ Inventory
 * - Customers ↔ Customers
 * - Orders → Sales
 * - Stock levels ← Inventory
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { getIntegration, upsertIntegration } from "@/lib/integrations";
import logger from "@/lib/logger";

interface WooConfig {
  store_url: string;
  consumer_key: string;
  consumer_secret: string;
  sync_products_import?: boolean;
  sync_products_export?: boolean;
  sync_customers?: boolean;
  sync_orders?: boolean;
  last_products_sync?: string;
  last_orders_sync?: string;
}

interface WooProduct {
  id: number;
  name: string;
  sku: string;
  regular_price: string;
  stock_quantity: number | null;
  manage_stock: boolean;
  images: Array<{ src: string }>;
  type: string;
}

interface WooCustomer {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  billing: { phone: string };
}

interface WooOrder {
  id: number;
  number: string;
  date_created: string;
  total: string;
  status: string;
  payment_method: string;
  customer_id: number;
  billing: { first_name: string; last_name: string; email: string };
  line_items: Array<{
    id: number;
    name: string;
    quantity: number;
    price: number;
    sku: string;
    product_id: number;
  }>;
}

export interface SyncResult {
  success: boolean;
  imported?: number;
  exported?: number;
  skipped?: number;
  errors: string[];
}

async function wooFetch(
  storeUrl: string,
  consumerKey: string,
  consumerSecret: string,
  path: string,
  options?: RequestInit
): Promise<any> {
  const baseUrl = storeUrl.replace(/\/$/, "");
  const url = `${baseUrl}/wp-json/wc/v3${path}`;
  const credentials = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WooCommerce API error ${res.status}: ${text}`);
  }
  return res.json();
}

/**
 * Import products from WooCommerce into Nexpura inventory
 */
export async function importProductsFromWoo(tenantId: string): Promise<SyncResult> {
  const integration = await getIntegration(tenantId, "woocommerce");
  if (!integration) return { success: false, errors: ["WooCommerce not connected"] };

  const config = integration.config as unknown as WooConfig;
  const admin = createAdminClient();
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  try {
    const products: WooProduct[] = await wooFetch(
      config.store_url, config.consumer_key, config.consumer_secret,
      "/products?per_page=100&status=publish"
    );

    for (const p of products) {
      try {
        const { error } = await admin.from("inventory").upsert(
          {
            tenant_id: tenantId,
            name: p.name,
            sku: p.sku || `woo-${p.id}`,
            retail_price: parseFloat(p.regular_price) || 0,
            quantity: p.stock_quantity || 0,
            woo_product_id: String(p.id),
            status: "active",
          },
          { onConflict: "tenant_id,sku", ignoreDuplicates: false }
        );

        if (error) { errors.push(`Product ${p.id}: ${error.message}`); skipped++; }
        else imported++;
      } catch (err) {
        errors.push(`Product ${p.id}: ${err instanceof Error ? err.message : "Error"}`);
        skipped++;
      }
    }

    await upsertIntegration(tenantId, "woocommerce", {
      ...config,
      last_products_sync: new Date().toISOString(),
    });

    return { success: true, imported, skipped, errors };
  } catch (err) {
    return { success: false, errors: [err instanceof Error ? err.message : "Sync failed"] };
  }
}

/**
 * Export Nexpura inventory to WooCommerce products
 * Full two-way sync with stock levels and product details
 */
export async function exportInventoryToWoo(tenantId: string): Promise<SyncResult> {
  const integration = await getIntegration(tenantId, "woocommerce");
  if (!integration) return { success: false, errors: ["WooCommerce not connected"] };

  const config = integration.config as unknown as WooConfig;
  const admin = createAdminClient();
  let exported = 0;
  let skipped = 0;
  const errors: string[] = [];

  const { data: items } = await admin
    .from("inventory")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .limit(250);

  for (const item of items || []) {
    try {
      const productData = {
        name: item.name,
        sku: item.sku || "",
        regular_price: String(item.retail_price || 0),
        stock_quantity: item.quantity || 0,
        manage_stock: true,
        status: "publish",
        type: "simple",
        description: item.description || "",
        short_description: item.short_description || "",
        weight: item.weight ? String(item.weight) : "",
        categories: item.jewellery_type
          ? [{ name: item.jewellery_type.replace(/_/g, " ") }]
          : [],
      };

      if (item.woo_product_id) {
        // Update existing product
        await wooFetch(
          config.store_url, config.consumer_key, config.consumer_secret,
          `/products/${item.woo_product_id}`,
          {
            method: "PUT",
            body: JSON.stringify(productData),
          }
        );
      } else {
        // Create new product
        const result = await wooFetch(
          config.store_url, config.consumer_key, config.consumer_secret,
          "/products",
          {
            method: "POST",
            body: JSON.stringify(productData),
          }
        );
        // Save WooCommerce product ID. Cron-runner log+continue (matches
        // shopify/sync.ts pattern in PR-B3): a failed Woo-IDs writeback
        // means the next sync run treats this item as "not linked yet"
        // and tries to create another WooCommerce product (duplicate).
        // Worth surfacing via Sentry but not aborting the export — the
        // remaining items still benefit from this run.
        const { error: linkErr } = await admin.from("inventory").update({
          woo_product_id: String(result.id),
          last_synced_at: new Date().toISOString(),
        }).eq("id", item.id);
        if (linkErr) {
          logger.error("[woo-sync] inventory woo-IDs writeback failed (non-fatal — next run may create duplicate Woo product)", {
            tenantId, inventoryId: item.id, wooProductId: result.id, err: linkErr,
          });
        }
      }

      // Update last_synced_at. Cron-runner log+continue: stale
      // last_synced_at on one row is observability-only — the actual
      // sync to Woo above already succeeded. Loop continues.
      const { error: tsErr } = await admin.from("inventory").update({ last_synced_at: new Date().toISOString() }).eq("id", item.id);
      if (tsErr) {
        logger.error("[woo-sync] inventory last_synced_at update failed (non-fatal — Woo sync above succeeded)", {
          tenantId, inventoryId: item.id, err: tsErr,
        });
      }
      exported++;
    } catch (err) {
      errors.push(`Item ${item.id}: ${err instanceof Error ? err.message : "Error"}`);
      skipped++;
    }
  }

  return { success: true, exported, skipped, errors };
}

/**
 * Export customers to WooCommerce
 */
export async function exportCustomersToWoo(tenantId: string): Promise<SyncResult> {
  const integration = await getIntegration(tenantId, "woocommerce");
  if (!integration) return { success: false, errors: ["WooCommerce not connected"] };

  const config = integration.config as unknown as WooConfig;
  const admin = createAdminClient();
  let exported = 0;
  let skipped = 0;
  const errors: string[] = [];

  const { data: customers } = await admin
    .from("customers")
    .select("*")
    .eq("tenant_id", tenantId)
    .not("email", "is", null)
    .limit(250);

  for (const c of customers || []) {
    try {
      const nameParts = (c.full_name || "").split(" ");
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";

      await wooFetch(
        config.store_url, config.consumer_key, config.consumer_secret,
        "/customers",
        {
          method: "POST",
          body: JSON.stringify({
            email: c.email,
            first_name: firstName,
            last_name: lastName,
            billing: {
              first_name: firstName,
              last_name: lastName,
              email: c.email,
              phone: c.mobile || "",
            },
          }),
        }
      );
      exported++;
    } catch (err) {
      // Skip duplicates (customer may already exist)
      const msg = err instanceof Error ? err.message : "";
      if (!msg.includes("already exists")) {
        errors.push(`Customer ${c.email}: ${msg}`);
        skipped++;
      }
    }
  }

  return { success: true, exported, skipped, errors };
}

/**
 * Import customers from WooCommerce
 */
export async function importCustomersFromWoo(tenantId: string): Promise<SyncResult> {
  const integration = await getIntegration(tenantId, "woocommerce");
  if (!integration) return { success: false, errors: ["WooCommerce not connected"] };

  const config = integration.config as unknown as WooConfig;
  const admin = createAdminClient();
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  try {
    const customers: WooCustomer[] = await wooFetch(
      config.store_url, config.consumer_key, config.consumer_secret,
      "/customers?per_page=100"
    );

    for (const c of customers) {
      if (!c.email) { skipped++; continue; }
      const { error } = await admin.from("customers").upsert(
        {
          tenant_id: tenantId,
          email: c.email,
          full_name: `${c.first_name || ""} ${c.last_name || ""}`.trim(),
          mobile: c.billing?.phone || null,
          source: "woocommerce",
        },
        { onConflict: "tenant_id,email", ignoreDuplicates: false }
      );
      if (error) { errors.push(error.message); skipped++; }
      else imported++;
    }

    return { success: true, imported, skipped, errors };
  } catch (err) {
    return { success: false, errors: [err instanceof Error ? err.message : "Failed"] };
  }
}

/**
 * Import orders from WooCommerce as sales
 */
export async function importOrdersFromWoo(tenantId: string): Promise<SyncResult> {
  const integration = await getIntegration(tenantId, "woocommerce");
  if (!integration) return { success: false, errors: ["WooCommerce not connected"] };

  const config = integration.config as unknown as WooConfig;
  const admin = createAdminClient();
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  try {
    const afterParam = config.last_orders_sync
      ? `&after=${config.last_orders_sync}`
      : "";
    const orders: WooOrder[] = await wooFetch(
      config.store_url, config.consumer_key, config.consumer_secret,
      `/orders?per_page=100&status=completed,processing${afterParam}`
    );

    for (const order of orders) {
      try {
        const { data: existing } = await admin
          .from("sales")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("external_reference", `woo_${order.id}`)
          .single();

        if (existing) { skipped++; continue; }

        const total = parseFloat(order.total);
        const { data: sale, error: saleErr } = await admin.from("sales").insert({
          tenant_id: tenantId,
          sale_number: `WOO-${order.number}`,
          total,
          subtotal: total,
          tax_amount: 0,
          discount_amount: 0,
          payment_method: order.payment_method || "woocommerce",
          customer_name: order.billing
            ? `${order.billing.first_name} ${order.billing.last_name}`.trim()
            : null,
          customer_email: order.billing?.email || null,
          external_reference: `woo_${order.id}`,
          created_at: order.date_created,
          status: "completed",
        }).select("id").single();

        if (saleErr) { errors.push(saleErr.message); skipped++; continue; }

        for (const li of order.line_items) {
          const { data: inventoryItem } = await admin
            .from("inventory")
            .select("id")
            .eq("tenant_id", tenantId)
            .eq("sku", li.sku)
            .single();

          // Cron-runner log+continue (matches shopify/sync.ts orders
          // pattern). Note: this CAN leave a sale row without all its
          // line-item children if individual inserts fail mid-loop —
          // same partial-state caveat as shopify. Sentry surfaces the
          // miss; reconciliation via the next sync run + the sale row's
          // total catches discrepancies. Aborting the loop on one bad
          // line item would lose the rest of the order's items, so
          // continue.
          const { error: lineErr } = await admin.from("sale_items").insert({
            tenant_id: tenantId,
            sale_id: sale!.id,
            inventory_id: inventoryItem?.id || null,
            quantity: li.quantity,
            unit_price: li.price,
            total: li.quantity * li.price,
          });
          if (lineErr) {
            logger.error("[woo-sync/orders] sale_items insert failed (non-fatal — see partial-state caveat)", {
              tenantId, saleId: sale!.id, sku: li.sku, err: lineErr,
            });
          }
        }

        imported++;
      } catch (err) {
        errors.push(`Order ${order.id}: ${err instanceof Error ? err.message : "Error"}`);
        skipped++;
      }
    }

    await upsertIntegration(tenantId, "woocommerce", {
      ...config,
      last_orders_sync: new Date().toISOString(),
    });

    return { success: true, imported, skipped, errors };
  } catch (err) {
    return { success: false, errors: [err instanceof Error ? err.message : "Failed"] };
  }
}

/**
 * Run full sync (all enabled directions)
 */
export async function runFullWooSync(tenantId: string): Promise<{
  products: SyncResult;
  customers: SyncResult;
  orders: SyncResult;
}> {
  const [products, customers, orders] = await Promise.all([
    importProductsFromWoo(tenantId),
    importCustomersFromWoo(tenantId),
    importOrdersFromWoo(tenantId),
  ]);

  await upsertIntegration(tenantId, "woocommerce", {
    ...(await getIntegration(tenantId, "woocommerce"))?.config || {},
    last_sync: new Date().toISOString(),
  });

  return { products, customers, orders };
}
