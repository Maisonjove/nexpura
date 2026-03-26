/**
 * Shopify Two-Way Sync
 * 
 * Handles bidirectional sync between Nexpura and Shopify:
 * - Import: Products → Inventory, Customers → Customers, Orders → Sales
 * - Export: Inventory → Products (with stock levels)
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { getIntegration, upsertIntegration } from "@/lib/integrations";

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

  const { data: items } = await admin
    .from("inventory")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .not("shopify_variant_id", "is", null);

  if (!items?.length) {
    // No items with Shopify IDs, try to push all
    const { data: allItems } = await admin
      .from("inventory")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .limit(50);
    
    for (const item of allItems || []) {
      try {
        await shopifyFetch(shop_domain, access_token, "/products.json", {
          method: "POST",
          body: JSON.stringify({
            product: {
              title: item.name,
              variants: [{
                sku: item.sku || "",
                price: String(item.retail_price || 0),
                inventory_quantity: item.quantity || 0,
              }],
            },
          }),
        });
        exported++;
      } catch (err) {
        errors.push(`Item ${item.id}: ${err instanceof Error ? err.message : "Error"}`);
        skipped++;
      }
    }
  } else {
    // Update existing Shopify variants
    for (const item of items) {
      try {
        await shopifyFetch(shop_domain, access_token, `/variants/${item.shopify_variant_id}.json`, {
          method: "PUT",
          body: JSON.stringify({
            variant: {
              id: item.shopify_variant_id,
              price: String(item.retail_price || 0),
              inventory_quantity: item.quantity || 0,
            },
          }),
        });
        exported++;
      } catch (err) {
        errors.push(`Item ${item.id}: ${err instanceof Error ? err.message : "Error"}`);
        skipped++;
      }
    }
  }

  await logSync(tenantId, "shopify_export_inventory", exported, skipped, errors);
  return { success: true, exported, skipped, errors };
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
 * Import orders from Shopify as sales
 */
export async function importOrdersFromShopify(tenantId: string): Promise<SyncResult> {
  const integration = await getIntegration(tenantId, "shopify");
  if (!integration) return { success: false, errors: ["Shopify not connected"] };

  const config = integration.config as unknown as ShopifyConfig;
  const admin = createAdminClient();
  let imported = 0;
  let skipped = 0;
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
        // Check if already imported
        const { data: existing } = await admin
          .from("sales")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("external_reference", `shopify_${order.id}`)
          .single();

        if (existing) { skipped++; continue; }

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
        }).select("id").single();

        if (saleErr) { errors.push(saleErr.message); skipped++; continue; }

        // Insert sale items
        for (const li of order.line_items) {
          // Try to find matching inventory
          const { data: inventoryItem } = await admin
            .from("inventory")
            .select("id")
            .eq("tenant_id", tenantId)
            .eq("sku", li.sku)
            .single();

          await admin.from("sale_items").insert({
            tenant_id: tenantId,
            sale_id: sale!.id,
            inventory_id: inventoryItem?.id || null,
            quantity: li.quantity,
            unit_price: parseFloat(li.price),
            total: li.quantity * parseFloat(li.price),
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
    return { success: true, imported, skipped, errors };
  } catch (err) {
    return { success: false, errors: [err instanceof Error ? err.message : "Failed"] };
  }
}

async function logSync(
  tenantId: string,
  syncType: string,
  synced: number,
  skipped: number,
  errors: string[]
) {
  const admin = createAdminClient();
  await admin.from("integrations").update({
    last_sync_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("tenant_id", tenantId).eq("type", "shopify");

  // Log to activity_log if the column exists
  await admin.from("activity_log").insert({
    tenant_id: tenantId,
    action: syncType,
    details: { synced, skipped, errors: errors.slice(0, 5) },
  });
}
