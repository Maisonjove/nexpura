import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import logger from "@/lib/logger";

/**
 * Data Export API (GDPR Compliant)
 * 
 * Exports all tenant data in JSON format.
 * Rate limited to 3 exports per minute (heavy operation).
 */
export async function POST(request: NextRequest) {
  // Auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get user's tenant
  const admin = createAdminClient();
  const { data: userData } = await admin
    .from("users")
    .select("tenant_id, role")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) {
    return NextResponse.json({ error: "No tenant found" }, { status: 403 });
  }

  // Only admins/managers can export
  if (!["admin", "manager", "owner"].includes(userData.role || "")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  // Rate limiting - heavy operation
  const { success } = await checkRateLimit(`data-export:${userData.tenant_id}`, "export");
  if (!success) {
    return NextResponse.json({ error: "Please wait before exporting again" }, { status: 429 });
  }

  const tenantId = userData.tenant_id;

  try {
    logger.info(`[data-export] Starting export for tenant ${tenantId}`);

    // Fetch all data in parallel
    const [
      tenantResult,
      usersResult,
      customersResult,
      inventoryResult,
      salesResult,
      saleItemsResult,
      repairsResult,
      bespokeResult,
      invoicesResult,
      invoiceItemsResult,
      paymentsResult,
      suppliersResult,
      purchaseOrdersResult,
      tasksResult,
      locationsResult,
      emailLogsResult,
    ] = await Promise.all([
      admin.from("tenants").select("*").eq("id", tenantId).single(),
      admin.from("users").select("id, full_name, email, role, created_at").eq("tenant_id", tenantId),
      admin.from("customers").select("*").eq("tenant_id", tenantId),
      admin.from("inventory").select("*").eq("tenant_id", tenantId),
      admin.from("sales").select("*").eq("tenant_id", tenantId),
      admin.from("sale_items").select("*").eq("tenant_id", tenantId),
      admin.from("repairs").select("*").eq("tenant_id", tenantId),
      admin.from("bespoke_jobs").select("*").eq("tenant_id", tenantId),
      admin.from("invoices").select("*").eq("tenant_id", tenantId),
      admin.from("invoice_items").select("*").eq("tenant_id", tenantId),
      admin.from("payments").select("*").eq("tenant_id", tenantId),
      admin.from("suppliers").select("*").eq("tenant_id", tenantId),
      admin.from("purchase_orders").select("*").eq("tenant_id", tenantId),
      admin.from("tasks").select("*").eq("tenant_id", tenantId),
      admin.from("locations").select("*").eq("tenant_id", tenantId),
      admin.from("email_logs").select("*").eq("tenant_id", tenantId).limit(1000),
    ]);

    // Remove sensitive fields from tenant data
    const tenant = tenantResult.data;
    if (tenant) {
      delete (tenant as Record<string, unknown>).stripe_customer_id;
      delete (tenant as Record<string, unknown>).stripe_subscription_id;
    }

    const exportData = {
      exported_at: new Date().toISOString(),
      tenant: tenant,
      users: usersResult.data || [],
      customers: customersResult.data || [],
      inventory: inventoryResult.data || [],
      sales: salesResult.data || [],
      sale_items: saleItemsResult.data || [],
      repairs: repairsResult.data || [],
      bespoke_jobs: bespokeResult.data || [],
      invoices: invoicesResult.data || [],
      invoice_items: invoiceItemsResult.data || [],
      payments: paymentsResult.data || [],
      suppliers: suppliersResult.data || [],
      purchase_orders: purchaseOrdersResult.data || [],
      tasks: tasksResult.data || [],
      locations: locationsResult.data || [],
      email_logs: emailLogsResult.data || [],
      _meta: {
        format_version: "1.0",
        exported_by: user.email,
        record_counts: {
          customers: customersResult.data?.length || 0,
          inventory: inventoryResult.data?.length || 0,
          sales: salesResult.data?.length || 0,
          repairs: repairsResult.data?.length || 0,
          bespoke_jobs: bespokeResult.data?.length || 0,
          invoices: invoicesResult.data?.length || 0,
        },
      },
    };

    logger.info(`[data-export] Export complete for tenant ${tenantId} - ${JSON.stringify(exportData._meta.record_counts)}`);

    // Return as downloadable JSON
    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="nexpura-export-${new Date().toISOString().split("T")[0]}.json"`,
      },
    });
  } catch (error) {
    logger.error("[data-export] Export failed:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
