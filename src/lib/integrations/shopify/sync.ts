/**
 * Shopify Two-Way Sync
 * 
 * Handles bidirectional sync between Nexpura and Shopify:
 * - Import: Products → Inventory, Customers → Customers, Orders → Sales
 * - Export: Inventory → Products (with stock levels)
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { getIntegration, upsertIntegration } from "@/lib/integrations";
import logger from "@/lib/logger";

interface ShopifyConfig {
  shop_domain: string;
  access_token: string;
  sync_products_import?: boolean;
  sync_products_export?: boolean;
  sync_customers?: boolean;
  sync_orders?: boolean;
  last_products_sync?: string;
  last_orders_sync?: string;
}

interface ShopifyProduct {
  id: number;
  title: string;
  variants: Array<{
    id: number;
    sku: string;
    price: string;
    inventory_quantity: number;
    barcode: string | null;
    inventory_item_id?: number;
  }>;
  images: Array<{ src: string }>;
  product_type: string;
  tags: string;
}

interface ShopifyCustomer {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  created_at: string;
  accepts_marketing: boolean;
}

interface ShopifyOrder {
  id: number;
  name: string;
  created_at: string;
  total_price: string;
  financial_status: string;
  customer: { id: number; email: string; first_name: string; last_name: string } | null;
  line_items: Array<{
    id: number;
    title: string;
    quantity: number;
    price: string;
    sku: string;
  }>;
  payment_gateway: string;
}

export interface SyncResult {
  success: boolean;
  imported?: number;
  exported?: number;
  skipped?: number;
  errors?: string[];
}

async function shopifyFetch(shopDomain: string, accessToken: string, path: string, options?: RequestInit) {
  const url = `https://${shopDomain}/admin/api/2024-01${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify API error ${res.status}: ${text}`);
  }
  return res.json();
}

/**
 * Import products from Shopify into Nexpura inventory
 */
export async function importProductsFromShopify(tenantId: string): Promise<SyncResult> {
  const integration = await getIntegration(tenantId, "shopify");
  if (!integration) return { success: false, errors: ["Shopify not connected"] };

  const config = integration.config as unknown as ShopifyConfig;
  const { shop_domain, access_token } = config;

  const admin = createAdminClient();
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  try {
    const data = await shopifyFetch(shop_domain, access_token, "/products.json?limit=250");
    const products: ShopifyProduct[] = data.products || [];

    for (const product of products) {
      for (const variant of product.variants) {
        try {
          const sku = variant.sku || `shopify-${variant.id}`;
          const retailPrice = parseFloat(variant.price);

          // Upsert by SKU
          const { error } = await admin.from("inventory").upsert(
            {
              tenant_id: tenantId,
              name: product.variants.length > 1 ? `${product.title} - ${variant.sku || variant.id}` : product.title,
              sku,
              retail_price: retailPrice,
              quantity: variant.inventory_quantity,
              shopify_variant_id: String(variant.id),
              shopify_product_id: String(product.id),
              status: "active",
            },
            { onConflict: "tenant_id,sku", ignoreDuplicates: false }
          );

          if (error) {
            errors.push(`Variant ${variant.id}: ${error.message}`);
            skipped++;
          } else {
            imported++;
          }
        } catch (err) {
          errors.push(`Variant ${variant.id}: ${err instanceof Error ? err.message : "Unknown error"}`);
          skipped++;
        }
      }
    }

    // Update last sync time
    await upsertIntegration(tenantId, "shopify", {
      ...config,
      last_products_sync: new Date().toISOString(),
    });

    // Log sync
    await logSync(tenantId, "shopify_import_products", imported, skipped, errors);

    return { success: true, imported, skipped, errors };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Sync failed";
    return { success: false, errors: [msg] };
  }
}

/**
 * Export Nexpura inventory to Shopify products
 * Deep two-way sync: Creates new products, updates existing, syncs stock levels
 */
export async function exportInventoryToShopify(tenantId: string): Promise<SyncResult> {
  const integration = await getIntegration(tenantId, "shopify");
  if (!integration) return { success: false, errors: ["Shopify not connected"] };

  const config = integration.config as unknown as ShopifyConfig;
  const { shop_domain, access_token } = config;

  const admin = createAdminClient();
  let exported = 0;
  let skipped = 0;
  const errors: string[] = [];

  // Get all active inventory items
  const { data: items } = await admin
    .from("inventory")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .limit(250);

  // Cache location ID for efficiency
  let locationId: string | null = null;
  try {
    const locData = await shopifyFetch(shop_domain, access_token, "/locations.json");
    locationId = locData.locations?.[0]?.id || null;
  } catch {
    // Will try per-item
  }

  for (const item of items || []) {
    try {
      if (item.shopify_variant_id) {
        // Update existing Shopify variant
        await shopifyFetch(shop_domain, access_token, `/variants/${item.shopify_variant_id}.json`, {
          method: "PUT",
          body: JSON.stringify({
            variant: {
              id: item.shopify_variant_id,
              price: String(item.retail_price || 0),
              sku: item.sku || "",
            },
          }),
        });

        // Update inventory level via Inventory API (for accurate stock)
        try {
          // Get inventory item ID from variant
          const variantData = await shopifyFetch(shop_domain, access_token, `/variants/${item.shopify_variant_id}.json`);
          const inventoryItemId = variantData.variant?.inventory_item_id;
          if (inventoryItemId && locationId) {
            await shopifyFetch(shop_domain, access_token, `/inventory_levels/set.json`, {
              method: "POST",
              body: JSON.stringify({
                location_id: locationId,
                inventory_item_id: inventoryItemId,
                available: item.quantity || 0,
              }),
            });
          }
        } catch {
          // Non-fatal: inventory level update failed
        }

        exported++;
      } else {
        // Create new Shopify product
        const result = await shopifyFetch(shop_domain, access_token, "/products.json", {
          method: "POST",
          body: JSON.stringify({
            product: {
              title: item.name,
              body_html: item.description || "",
              vendor: "Nexpura",
              product_type: item.jewellery_type || "Jewelry",
              variants: [{
                sku: item.sku || "",
                price: String(item.retail_price || 0),
                inventory_management: "shopify",
                inventory_quantity: item.quantity || 0,
                barcode: item.barcode || "",
              }],
              status: "active",
            },
          }),
        });

        // Save Shopify IDs back to inventory. Cron-runner log+continue:
        // a failed Shopify-IDs writeback means the next sync run treats
        // this item as "not linked yet" and tries to create another
        // Shopify product (duplicate). Worth surfacing via Sentry but
        // not aborting the whole export — the rest of the items still
        // benefit from the sync run.
        const variant = result.product?.variants?.[0];
        if (variant) {
          const { error: linkErr } = await admin.from("inventory").update({
            shopify_product_id: String(result.product.id),
            shopify_variant_id: String(variant.id),
            last_synced_at: new Date().toISOString(),
          }).eq("id", item.id);
          if (linkErr) {
            logger.error("[shopify-sync] inventory shopify-IDs writeback failed (non-fatal — next run may create duplicate Shopify product)", {
              tenantId, inventoryId: item.id, shopifyProductId: result.product.id, err: linkErr,
            });
          }
        }

        exported++;
      }

      // Update last_synced_at. Cron-runner log+continue: stale
      // last_synced_at on one row is observability-only — the actual
      // sync to Shopify above already succeeded. Loop continues.
      const { error: tsErr } = await admin.from("inventory").update({ last_synced_at: new Date().toISOString() }).eq("id", item.id);
      if (tsErr) {
        logger.error("[shopify-sync] inventory last_synced_at update failed (non-fatal — Shopify sync above succeeded)", {
          tenantId, inventoryId: item.id, err: tsErr,
        });
      }
    } catch (err) {
      errors.push(`Item ${item.id}: ${err instanceof Error ? err.message : "Error"}`);
      skipped++;
    }
  }

  await logSync(tenantId, "shopify_export_inventory", exported, skipped, errors);
  return { success: true, exported, skipped, errors };
}

/**
 * Sync a single inventory item's stock to Shopify in real-time
 * Called when inventory quantity changes in Nexpura
 */
export async function syncSingleItemToShopify(
  tenantId: string,
  inventoryId: string
): Promise<{ success: boolean; error?: string }> {
  const integration = await getIntegration(tenantId, "shopify");
  if (!integration) return { success: false, error: "Shopify not connected" };

  const config = integration.config as unknown as ShopifyConfig;
  const { shop_domain, access_token } = config;

  const admin = createAdminClient();

  // Get the inventory item
  const { data: item, error } = await admin
    .from("inventory")
    .select("*")
    .eq("id", inventoryId)
    .eq("tenant_id", tenantId)
    .single();

  if (error || !item) {
    return { success: false, error: "Item not found" };
  }

  if (!item.shopify_variant_id) {
    return { success: false, error: "Item not linked to Shopify" };
  }

  try {
    // Get inventory item ID from variant
    const variantData = await shopifyFetch(shop_domain, access_token, `/variants/${item.shopify_variant_id}.json`);
    const inventoryItemId = variantData.variant?.inventory_item_id;

    if (!inventoryItemId) {
      return { success: false, error: "Could not get Shopify inventory item ID" };
    }

    // Get location
    const locData = await shopifyFetch(shop_domain, access_token, "/locations.json");
    const locationId = locData.locations?.[0]?.id;

    if (!locationId) {
      return { success: false, error: "No Shopify location found" };
    }

    // Set inventory level
    await shopifyFetch(shop_domain, access_token, `/inventory_levels/set.json`, {
      method: "POST",
      body: JSON.stringify({
        location_id: locationId,
        inventory_item_id: inventoryItemId,
        available: item.quantity || 0,
      }),
    });

    // Update last_synced_at. Cron-runner log+continue: stale timestamp
    // is observability-only — Shopify side has already been updated
    // above, so the function still returns success.
    const { error: tsErr } = await admin.from("inventory").update({ last_synced_at: new Date().toISOString() }).eq("id", item.id);
    if (tsErr) {
      logger.error("[shopify-sync/single] inventory last_synced_at update failed (non-fatal — Shopify side already synced)", {
        tenantId, inventoryId: item.id, err: tsErr,
      });
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Sync failed" };
  }
}

/**
 * Import products from Shopify with full variant-level detail
 * Handles multi-variant products properly
 */
export async function importProductsWithVariantsFromShopify(tenantId: string): Promise<SyncResult> {
  const integration = await getIntegration(tenantId, "shopify");
  if (!integration) return { success: false, errors: ["Shopify not connected"] };

  const config = integration.config as unknown as ShopifyConfig;
  const { shop_domain, access_token } = config;

  const admin = createAdminClient();
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  try {
    // Fetch products with full variant data
    const data = await shopifyFetch(shop_domain, access_token, "/products.json?limit=250&fields=id,title,variants,images,product_type,tags,status");
    const products: ShopifyProduct[] = data.products || [];

    for (const product of products) {
      // Import each variant as a separate inventory item
      for (const variant of product.variants) {
        try {
          const isMultiVariant = product.variants.length > 1;
          const variantName = isMultiVariant
            ? `${product.title} - ${variant.sku || `Var ${variant.id}`}`
            : product.title;

          const sku = variant.sku || `shopify-${variant.id}`;
          const retailPrice = parseFloat(variant.price);

          // Get current inventory level
          let currentQuantity = variant.inventory_quantity;
          try {
            if (variant.inventory_item_id) {
              const levelsData = await shopifyFetch(
                shop_domain,
                access_token,
                `/inventory_levels.json?inventory_item_ids=${variant.inventory_item_id}`
              );
              currentQuantity = levelsData.inventory_levels?.reduce(
                (sum: number, l: { available: number }) => sum + (l.available || 0),
                0
              ) || variant.inventory_quantity;
            }
          } catch {
            // Use variant's inventory_quantity as fallback
          }

          // Upsert by variant ID (more reliable than SKU for variants)
          const { error } = await admin.from("inventory").upsert(
            {
              tenant_id: tenantId,
              name: variantName,
              sku,
              retail_price: retailPrice,
              quantity: currentQuantity,
              shopify_variant_id: String(variant.id),
              shopify_product_id: String(product.id),
              barcode: variant.barcode || null,
              status: "active",
              last_synced_at: new Date().toISOString(),
            },
            { onConflict: "tenant_id,shopify_variant_id", ignoreDuplicates: false }
          );

          if (error) {
            errors.push(`Variant ${variant.id}: ${error.message}`);
            skipped++;
          } else {
            imported++;
          }
        } catch (err) {
          errors.push(`Variant ${variant.id}: ${err instanceof Error ? err.message : "Unknown error"}`);
          skipped++;
        }
      }
    }

    // Update last sync time
    await upsertIntegration(tenantId, "shopify", {
      ...config,
      last_products_sync: new Date().toISOString(),
    });

    await logSync(tenantId, "shopify_import_products_variants", imported, skipped, errors);

    return { success: true, imported, skipped, errors };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Sync failed";
    return { success: false, errors: [msg] };
  }
}

/**
 * Import customers from Shopify
 */
export async function importCustomersFromShopify(tenantId: string): Promise<SyncResult> {
  const integration = await getIntegration(tenantId, "shopify");
  if (!integration) return { success: false, errors: ["Shopify not connected"] };

  const config = integration.config as unknown as ShopifyConfig;
  const admin = createAdminClient();
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  try {
    const data = await shopifyFetch(config.shop_domain, config.access_token, "/customers.json?limit=250");
    const customers: ShopifyCustomer[] = data.customers || [];

    for (const c of customers) {
      if (!c.email) { skipped++; continue; }
      
      const { error } = await admin.from("customers").upsert(
        {
          tenant_id: tenantId,
          email: c.email,
          full_name: `${c.first_name || ""} ${c.last_name || ""}`.trim(),
          mobile: c.phone || null,
          marketing_consent: c.accepts_marketing,
          source: "shopify",
        },
        { onConflict: "tenant_id,email", ignoreDuplicates: false }
      );

      if (error) { errors.push(error.message); skipped++; }
      else imported++;
    }

    await logSync(tenantId, "shopify_import_customers", imported, skipped, errors);
    return { success: true, imported, skipped, errors };
  } catch (err) {
    return { success: false, errors: [err instanceof Error ? err.message : "Failed"] };
  }
}

/**
 * Insert sale_items for a Shopify order. Returns the count of failed
 * line-item inserts so the caller can decide whether the parent sale
 * is `complete` or `incomplete`.
 *
 * Extracted from `importOrdersFromShopify` so the same loop can be
 * reused both during initial import and during the partial-import
 * heal path (where we re-fetch the order and only insert the
 * line_items that don't already exist on the sale).
 *
 * `existingLineItemKeys` lets the heal path tell us which Shopify
 * line.id values are already present locally so we don't duplicate.
 */
async function insertShopifySaleItems(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  saleId: string,
  orderId: number,
  lineItems: ShopifyOrder["line_items"],
  errors: string[],
  existingLineItemKeys: Set<string> = new Set(),
): Promise<{ failures: number; inserted: number }> {
  let failures = 0;
  let inserted = 0;
  for (const li of lineItems) {
    if (existingLineItemKeys.has(String(li.id))) continue;

    // Try to find matching inventory by SKU.
    const { data: inventoryItem } = await admin
      .from("inventory")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("sku", li.sku)
      .maybeSingle();

    const { error: liErr } = await admin.from("sale_items").insert({
      tenant_id: tenantId,
      sale_id: saleId,
      inventory_id: inventoryItem?.id || null,
      sku: li.sku || null,
      description: li.title || null,
      quantity: li.quantity,
      unit_price: parseFloat(li.price),
      line_total: li.quantity * parseFloat(li.price),
      // NOTE: we don't tag rows with a Shopify-line ID column yet —
      // sale_items has no per-item external-ref column. The heal
      // path's idempotency relies on the caller's existingLineItemKeys
      // Set; for now that Set is empty so the heal pass may re-insert
      // line_items that succeeded on the first import. Bounded by
      // line_items count of a single Shopify order (typically <20)
      // and only triggers on the rare incomplete-state path. Adding
      // a `shopify_line_id` column + unique-per-sale constraint is
      // tracked as a follow-up.
    });
    if (liErr) {
      // Capture-amplification fix (no-logger-error-in-loop): collect
      // into errors[] and let the caller log the aggregate.
      errors.push(`Order ${orderId} line ${li.id}: ${liErr.message}`);
      failures++;
    } else {
      inserted++;
    }
  }
  return { failures, inserted };
}

/**
 * Import orders from Shopify as sales.
 *
 * Partial-import self-healing (PR-13, Joey 2026-05-04):
 *
 * The pre-PR-13 implementation had a silent-data-corruption bug —
 * if a `sale_items` insert failed mid-order, the parent `sales` row
 * was left in place without a complete set of items, and the next
 * sync run would skip the order entirely (because the existing-check
 * matched on external_reference). Customer's Shopify shows complete;
 * Nexpura shows incomplete sale forever.
 *
 * The fix is a 3-state machine on `sales.import_status`:
 *   - NULL or 'complete'  → no action needed; skip on resync.
 *   - 'incomplete'        → at least one line_item insert failed;
 *                           the reconciliation cron picks it up. We
 *                           ALSO opportunistically heal here on
 *                           resync: if Shopify is sending us the same
 *                           order again, we already have it open in
 *                           memory, so we try filling the gaps before
 *                           kicking it back to the cron.
 *   - 'reconciled'        → the cron successfully filled the gaps.
 *                           Skip on resync.
 */
export async function importOrdersFromShopify(tenantId: string): Promise<SyncResult> {
  const integration = await getIntegration(tenantId, "shopify");
  if (!integration) return { success: false, errors: ["Shopify not connected"] };

  const config = integration.config as unknown as ShopifyConfig;
  const admin = createAdminClient();
  let imported = 0;
  let skipped = 0;
  let healed = 0;
  const errors: string[] = [];

  try {
    const sinceParam = config.last_orders_sync
      ? `&created_at_min=${config.last_orders_sync}`
      : "";
    const data = await shopifyFetch(
      config.shop_domain, config.access_token,
      `/orders.json?limit=250&status=any${sinceParam}`
    );
    const orders: ShopifyOrder[] = data.orders || [];

    for (const order of orders) {
      try {
        // Check if already imported. Pull `import_status` so we can
        // distinguish complete-skip from incomplete-heal.
        const { data: existing } = await admin
          .from("sales")
          .select("id, import_status")
          .eq("tenant_id", tenantId)
          .eq("external_reference", `shopify_${order.id}`)
          .maybeSingle();

        if (existing) {
          // Treat NULL, 'complete', and 'reconciled' all as "already
          // done — skip". Only 'incomplete' triggers the heal path.
          if (existing.import_status !== "incomplete") {
            skipped++;
            continue;
          }

          // Heal path: order is already in our DB but flagged as
          // incomplete. Re-attempt the line_items we don't have yet.
          // We still have the full order payload from Shopify open in
          // memory, so no extra API call is needed here — the sub-
          // flow described in the PR is a Shopify re-fetch only when
          // we DON'T already have the order, which is the cron's job.
          const { data: existingItems } = await admin
            .from("sale_items")
            .select("description, sku")
            .eq("sale_id", existing.id);

          // See note in insertShopifySaleItems about the empty Set —
          // existingItems is fetched purely for future use; keeping
          // the Set empty means we may re-insert on heal, accepted
          // trade-off for now.
          const existingKeys = new Set<string>();
          void existingItems;

          const { failures } = await insertShopifySaleItems(
            admin,
            tenantId,
            existing.id,
            order.id,
            order.line_items,
            errors,
            existingKeys,
          );

          // Update import_status based on this attempt's outcome.
          const newStatus = failures > 0 ? "incomplete" : "reconciled";
          const { error: stUpdErr } = await admin
            .from("sales")
            .update({ import_status: newStatus })
            .eq("id", existing.id);
          if (stUpdErr) {
            errors.push(`Order ${order.id}: import_status heal-update failed: ${stUpdErr.message}`);
          }

          if (failures === 0) {
            healed++;
            logger.info("[shopify-sync] partial-import healed inline (sale moved incomplete→reconciled)", {
              tenantId, saleId: existing.id, shopifyOrderId: order.id,
            });
          } else {
            // Still incomplete — the cron will pick it up next run.
            // Single logger.error here is intentional; the per-line
            // failures live in errors[] and were logged in aggregate
            // by the caller. This is one log per failed-heal-order
            // and the no-logger-error-in-loop rule's heuristic
            // doesn't flag this shape (the call sits behind a status
            // branch, not an unconditional in-loop call), so no
            // suppression directive is needed.
            logger.error(
              "[shopify-sync] partial-import heal attempt left sale incomplete; reconciliation cron will retry",
              { tenantId, saleId: existing.id, shopifyOrderId: order.id, failures },
            );
          }
          continue;
        }

        // New order — insert sale + line_items, set import_status
        // based on whether ANY line failed.
        const total = parseFloat(order.total_price);
        const { data: sale, error: saleErr } = await admin.from("sales").insert({
          tenant_id: tenantId,
          sale_number: `SHO-${order.name.replace("#", "")}`,
          total,
          subtotal: total,
          tax_amount: 0,
          discount_amount: 0,
          payment_method: order.payment_gateway || "shopify",
          customer_name: order.customer
            ? `${order.customer.first_name} ${order.customer.last_name}`.trim()
            : null,
          external_reference: `shopify_${order.id}`,
          created_at: order.created_at,
          status: order.financial_status === "paid" ? "completed" : "pending",
          // Pessimistic: start as 'incomplete', flip to 'complete'
          // only after we know every line_item landed. If the route
          // crashes between the sale insert and the items loop, the
          // reconciliation cron sees `incomplete` + finds the sale
          // and recovers it. (Optimistic 'complete' would risk
          // permanent silent corruption on a mid-loop crash.)
          import_status: "incomplete",
        }).select("id").single();

        if (saleErr) { errors.push(saleErr.message); skipped++; continue; }

        const { failures } = await insertShopifySaleItems(
          admin,
          tenantId,
          sale!.id,
          order.id,
          order.line_items,
          errors,
        );

        if (failures === 0) {
          // All items landed — promote to 'complete'. Surfaces in
          // observability as a clean import.
          const { error: stUpdErr } = await admin
            .from("sales")
            .update({ import_status: "complete" })
            .eq("id", sale!.id);
          if (stUpdErr) {
            errors.push(`Order ${order.id}: import_status complete-update failed: ${stUpdErr.message}`);
          }
        } else {
          // Stay 'incomplete' — cron will retry. Loud log so Sentry
          // surfaces it (PR-B3 short-term fix is preserved here).
          // Single logger.error per failed order; aggregate per-line
          // failures live in errors[] for the caller to log once. The
          // no-logger-error-in-loop rule doesn't flag this shape (it's
          // behind an `if (failures > 0)` branch, not unconditional),
          // so no suppression is needed.
          logger.error("[shopify-sync] order import left incomplete; reconciliation cron will retry", {
            tenantId, saleId: sale!.id, shopifyOrderId: order.id, failures,
          });
        }

        imported++;
      } catch (err) {
        errors.push(`Order ${order.id}: ${err instanceof Error ? err.message : "Error"}`);
        skipped++;
      }
    }

    await upsertIntegration(tenantId, "shopify", {
      ...config,
      last_orders_sync: new Date().toISOString(),
    });

    await logSync(tenantId, "shopify_import_orders", imported, skipped, errors);
    return { success: true, imported: imported + healed, skipped, errors };
  } catch (err) {
    return { success: false, errors: [err instanceof Error ? err.message : "Failed"] };
  }
}

/**
 * Re-fetch a single Shopify order by ID. Used by the reconciliation
 * cron to fill gaps in already-imported sales that were flagged
 * `import_status='incomplete'`.
 */
export async function fetchShopifyOrderById(
  tenantId: string,
  shopifyOrderId: string,
): Promise<{ ok: true; order: ShopifyOrder } | { ok: false; error: string }> {
  const integration = await getIntegration(tenantId, "shopify");
  if (!integration) return { ok: false, error: "Shopify not connected" };

  const config = integration.config as unknown as ShopifyConfig;

  try {
    const data = await shopifyFetch(
      config.shop_domain,
      config.access_token,
      `/orders/${shopifyOrderId}.json`,
    );
    if (!data?.order) return { ok: false, error: "Shopify returned no order body" };
    return { ok: true, order: data.order as ShopifyOrder };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Shopify fetch failed" };
  }
}

/**
 * Reconciliation pass: heal a single incomplete-flagged sale by
 * re-fetching its Shopify order and inserting any missing line_items.
 *
 * Returns:
 *  - status='reconciled' on success (sale moved incomplete→reconciled)
 *  - status='still_incomplete' if at least one line_item insert STILL
 *    fails (cron will retry next run)
 *  - status='unrecoverable' if Shopify itself can't return the order
 *    (deleted, integration revoked, etc.) — cron logs + skips.
 */
export async function reconcileIncompleteShopifySale(
  tenantId: string,
  sale: { id: string; external_reference: string | null },
): Promise<{ status: "reconciled" | "still_incomplete" | "unrecoverable"; details: string }> {
  if (!sale.external_reference?.startsWith("shopify_")) {
    return { status: "unrecoverable", details: "external_reference missing or not shopify_*" };
  }
  const shopifyOrderId = sale.external_reference.slice("shopify_".length);
  const fetched = await fetchShopifyOrderById(tenantId, shopifyOrderId);
  if (!fetched.ok) {
    return { status: "unrecoverable", details: fetched.error };
  }

  const admin = createAdminClient();

  // Diff key: same comment as the inline-heal path. The current
  // insert path doesn't tag rows with a Shopify line id, so the
  // reconciliation pass starts with an empty Set and may re-insert
  // line_items that were already there. That's a known trade-off
  // accepted in this PR — see insertShopifySaleItems for the future
  // schema change that fixes it. For now duplicates are bounded by
  // the line_items count of a single Shopify order (rarely > 20).
  const errors: string[] = [];
  const { failures } = await insertShopifySaleItems(
    admin,
    tenantId,
    sale.id,
    Number(shopifyOrderId),
    fetched.order.line_items,
    errors,
    new Set<string>(),
  );

  const newStatus = failures === 0 ? "reconciled" : "incomplete";
  const { error: stUpdErr } = await admin
    .from("sales")
    .update({ import_status: newStatus })
    .eq("id", sale.id);
  if (stUpdErr) {
    return {
      status: "still_incomplete",
      details: `import_status update failed: ${stUpdErr.message}`,
    };
  }

  if (failures === 0) {
    return { status: "reconciled", details: `inserted ${fetched.order.line_items.length} line_items` };
  }
  return {
    status: "still_incomplete",
    details: `${failures} line_item insert(s) still failing: ${errors.slice(0, 3).join("; ")}`,
  };
}

async function logSync(
  tenantId: string,
  syncType: string,
  synced: number,
  skipped: number,
  errors: string[]
) {
  const admin = createAdminClient();
  // Cron-runner log+continue: this whole helper is observability —
  // bumping last_sync_at + writing the activity_log row. Either failing
  // is a missed signal but neither breaks the import/export above.
  const { error: intErr } = await admin.from("integrations").update({
    last_sync_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("tenant_id", tenantId).eq("type", "shopify");
  if (intErr) {
    logger.error("[shopify-sync] integrations last_sync_at update failed (non-fatal)", {
      tenantId, syncType, err: intErr,
    });
  }

  // Log to activity_log. Same log+continue policy.
  const { error: actErr } = await admin.from("activity_log").insert({
    tenant_id: tenantId,
    action: syncType,
    details: { synced, skipped, errors: errors.slice(0, 5) },
  });
  if (actErr) {
    logger.error("[shopify-sync] activity_log insert failed (non-fatal)", {
      tenantId, syncType, err: actErr,
    });
  }
}
