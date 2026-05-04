import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import logger from "@/lib/logger";
import { decryptCustomerPiiList } from "@/lib/customer-pii";

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

    // Joey 2026-05-03 P2-E audit: pre-fix this exported 16 tables.
    // information_schema query showed 105 tables have a tenant_id
    // column — 89 were missing from the export. Including
    // invoice_line_items (we exported invoices but not the line
    // items!), communications, passports, wishlists, refunds, etc.
    // Real GDPR Article 20 (right to data portability) gap.
    //
    // Fix: extend to every tenant-scoped table that holds USER data
    // — exclude system/internal tables that are noise to the data
    // subject (audit_logs, activity_log, pilot_issues,
    // support_access_requests, role_permissions, scheduled_report_logs,
    // tenant_dashboard_stats — denormalised stats, regenerated on
    // demand, not source data — and the migration_* tables which
    // are operational metadata about imports). Keep the
    // SUBSCRIPTIONS table out — Stripe handles billing-data export
    // via its own GDPR flow.
    //
    // Storage buckets are appended below the SQL pull as a list of
    // signed URLs (the user can download each file). Including raw
    // file content in the JSON would balloon the payload.

    // Tables verified at audit time via:
    //   SELECT table_name FROM information_schema.columns
    //    WHERE column_name='tenant_id' AND table_schema='public'
    const tenantDataTables = [
      // Existing 16
      "users", "customers", "inventory", "sales", "sale_items",
      "repairs", "bespoke_jobs", "invoices", "invoice_items",
      "payments", "suppliers", "purchase_orders", "tasks",
      "locations", "email_logs",
      // P2-E: missing from previous export
      "appointments", "appraisals", "bespoke_job_stages",
      "bespoke_milestones", "communications", "customer_communications",
      "customer_segments", "customer_store_credit_history",
      "email_campaigns", "email_domains", "email_sends",
      "email_templates", "employee_credentials", "eod_reconciliations",
      "expenses", "gift_voucher_redemptions", "gift_vouchers",
      "integrations", "invoice_line_items", "job_attachments",
      "job_events", "label_templates", "layby_payments",
      "loyalty_transactions", "marketing_automations", "memo_items",
      "notifications", "order_attachments", "order_messages",
      "order_status_history", "passport_events", "passports",
      "print_jobs", "printer_configs", "quotes", "refund_items",
      "refunds", "reminder_dismissals", "repair_stages",
      "scheduled_reports", "service_reminders", "settings",
      "shop_enquiries", "site_pages", "site_sections", "sms_sends",
      "stock_categories", "stock_movements", "stock_tag_templates",
      "stock_transfers", "stocktake_items", "stocktakes",
      "task_activities", "task_attachments", "task_comments",
      "task_templates", "team_members", "tenant_security_settings",
      "tenant_website_pages", "tenant_website_sections",
      "tenant_website_settings", "transaction_audit", "uploads",
      "user_notification_preferences", "website_config",
      "website_pages", "whatsapp_campaigns", "whatsapp_sends",
      "wishlists",
      // Intentionally excluded (admin/system internal — not user data
      // per GDPR scope): activity_log, audit_logs, pilot_issues,
      // support_access_requests, role_permissions, scheduled_report_logs,
      // tenant_dashboard_stats, migration_*, ai_conversations,
      // ai_messages, marketplace_*, jeweller_reviews, consumer_*.
    ];

    const tenantResult = await admin.from("tenants").select("*").eq("id", tenantId).single();
    // Pull every table in parallel.
    const tableResults = await Promise.all(
      tenantDataTables.map((tbl) => {
        // email_logs has historically been row-capped at 1000 to bound
        // the export size; preserve that. Other high-volume tables
        // could need similar treatment in the future but for now run
        // unbounded — most tenants are small enough.
        const q = admin.from(tbl).select("*").eq("tenant_id", tenantId);
        if (tbl === "email_logs") return q.limit(1000);
        return q;
      }),
    );
    const tableData: Record<string, unknown[]> = {};
    let totalRows = 0;
    for (let i = 0; i < tenantDataTables.length; i++) {
      const tbl = tenantDataTables[i];
      const data = tableResults[i].data || [];
      tableData[tbl] = data;
      totalRows += data.length;
    }

    // Storage buckets — list every tenant-prefixed object across
    // tenant-owned buckets. Signed URLs valid 1h so the data subject
    // can download each file. Same bucket list as the deletion cron.
    const TENANT_OWNED_BUCKETS = [
      "inventory-photos", "job-photos", "logos",
      "migration-files", "order-attachments", "passport-photos",
      "repair-photos",
    ];
    const storageManifest: Record<string, Array<{ path: string; signedUrl: string | null }>> = {};
    for (const bucket of TENANT_OWNED_BUCKETS) {
      try {
        const { data: files } = await admin.storage.from(bucket).list(tenantId, { limit: 1000 });
        if (!files || files.length === 0) {
          storageManifest[bucket] = [];
          continue;
        }
        const items: Array<{ path: string; signedUrl: string | null }> = [];
        for (const f of files) {
          const path = `${tenantId}/${f.name}`;
          const { data: signed } = await admin.storage.from(bucket).createSignedUrl(path, 3600);
          items.push({ path, signedUrl: signed?.signedUrl ?? null });
        }
        storageManifest[bucket] = items;
      } catch (e) {
        logger.error(`[data-export] storage list failed for ${bucket}`, { tenantId, err: e });
        storageManifest[bucket] = [];
      }
    }

    // Decrypt customer PII (the user's own data, GDPR allows
    // plaintext export to the data subject).
    const customersDecrypted = await decryptCustomerPiiList(
      (tableData["customers"] as Array<Record<string, unknown>>) || [],
    );
    tableData["customers"] = customersDecrypted;

    // Remove sensitive fields from tenant data
    const tenant = tenantResult.data;
    if (tenant) {
      delete (tenant as Record<string, unknown>).stripe_customer_id;
      delete (tenant as Record<string, unknown>).stripe_subscription_id;
    }

    const recordCounts: Record<string, number> = {};
    for (const tbl of tenantDataTables) {
      recordCounts[tbl] = (tableData[tbl] || []).length;
    }
    const storageCounts: Record<string, number> = {};
    for (const bucket of TENANT_OWNED_BUCKETS) {
      storageCounts[bucket] = (storageManifest[bucket] || []).length;
    }

    const exportData = {
      exported_at: new Date().toISOString(),
      tenant: tenant,
      ...tableData,
      // P2-E audit: GDPR Article 20 covers files. Storage buckets
      // listed as signed URLs (1h TTL) so the data subject can
      // download each. Buckets not yet expanded inline due to size.
      _storage_manifest: storageManifest,
      _meta: {
        format_version: "2.0",
        exported_by: user.email,
        tables_exported: tenantDataTables.length,
        total_rows: totalRows,
        storage_buckets_exported: TENANT_OWNED_BUCKETS.length,
        record_counts: recordCounts,
        storage_counts: storageCounts,
      },
    };

    logger.info(`[data-export] Export complete for tenant ${tenantId} — ${tenantDataTables.length} tables, ${totalRows} rows, ${Object.values(storageCounts).reduce((a, b) => a + b, 0)} files`);

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
