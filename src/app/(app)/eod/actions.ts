"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import logger from "@/lib/logger";
import { logAuditEvent } from "@/lib/audit";

import { flushSentry } from "@/lib/sentry-flush";
/**
 * Convert a YYYY-MM-DD calendar date in a named IANA timezone to UTC ISO
 * boundaries spanning that local day. Used by EOD reconciliation so that
 * a Sydney tenant's "28 April" EOD pulls sales recorded between 28 Apr
 * 00:00 AEST (= 27 Apr 14:00 UTC) and 28 Apr 23:59 AEST (= 28 Apr 12:59
 * UTC), not 28 Apr 00:00–23:59 UTC.
 *
 * Pure-JS, no extra deps — uses Intl.DateTimeFormat to read the offset
 * the named timezone has on the target date. DST-safe at noon (the
 * snapshot point) for any reasonable jurisdiction; sales right around
 * the spring-forward / fall-back boundary may still drift by an hour
 * but that's a fundamentally ambiguous time anyway.
 */
function localDayBoundsToUtcIso(
  dateStr: string,
  tz: string,
): { startOfDay: string; endOfDay: string } {
  // Read the timezone's offset for the target date (using noon as the
  // reference so DST transitions don't bite the boundary calculation).
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    timeZoneName: "longOffset",
  });
  const parts = fmt.formatToParts(new Date(`${dateStr}T12:00:00Z`));
  const tzName =
    parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+00:00";
  const m = tzName.match(/GMT([+-])(\d{1,2}):(\d{2})/);
  const sign = m?.[1] === "-" ? -1 : 1;
  const offsetMs =
    sign * ((m ? parseInt(m[2], 10) : 0) * 3600 + (m ? parseInt(m[3], 10) : 0) * 60) * 1000;

  // tenant-local 00:00 = UTC equivalent (00:00 - offset).
  const utcDayStart = new Date(`${dateStr}T00:00:00Z`).getTime() - offsetMs;
  const startOfDay = new Date(utcDayStart).toISOString();
  const endOfDay = new Date(utcDayStart + 24 * 3600 * 1000 - 1).toISOString();
  return { startOfDay, endOfDay };
}

async function getAuthContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: userData } = await createAdminClient()
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) throw new Error("No tenant found");

  return { supabase, admin: createAdminClient(), userId: user.id, tenantId: userData.tenant_id };
}

export interface EODSummary {
  date: string;
  totalSalesCash: number;
  totalSalesCard: number;
  totalSalesTransfer: number;
  totalSalesVoucher: number;
  totalSalesLayby: number;
  totalSalesMixed: number;
  totalRefundsCash: number;
  totalRefundsCard: number;
  totalRevenue: number;
  transactionCount: number;
  cashExpected: number;
  existingReconciliation: {
    id: string;
    cash_counted: number | null;
    cash_variance: number | null;
    opening_float: number;
    closing_float: number | null;
    notes: string | null;
    status: string;
    submitted_at: string | null;
  } | null;
}

export async function getEODSummary(date?: string, locationId?: string | null): Promise<{ data?: EODSummary; error?: string }> {
  try {
    let ctx;
    try {
      ctx = await getAuthContext();
    } catch {
      return { error: "Not authenticated" };
    }

    const { admin, tenantId } = ctx;

  // FIX: Resolve "today" in the tenant's local timezone rather than UTC.
  // Without this, users in AEST (UTC+11) see "yesterday" during the early
  // morning hours because UTC is still on the previous calendar day.
  let targetDate = date;
  let tenantTimezone = "Australia/Sydney";
  try {
    const { data: tenantData } = await admin
      .from("tenants")
      .select("timezone")
      .eq("id", tenantId)
      .single();
    tenantTimezone = tenantData?.timezone ?? "Australia/Sydney";
  } catch {
    // Fallback to default tz on lookup failure
  }

  if (!targetDate) {
    // en-CA locale formats date as YYYY-MM-DD, matching our DB date format
    targetDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: tenantTimezone,
    }).format(new Date());
  }

  // Compute the UTC-equivalent boundaries for the tenant-local date.
  // Pre-fix this hardcoded `${targetDate}T00:00:00.000Z` which is UTC
  // midnight, not tenant-local midnight. For a Sydney tenant (UTC+10/+11)
  // running 28 April EOD, the bounds need to be 27 April 13:00 UTC →
  // 28 April 12:59 UTC, not 28 April 00:00–23:59 UTC. Without this,
  // sales recorded at 11 PM Sydney on 27 April land in the WRONG day's
  // EOD and reconciliation comes up short.
  const { startOfDay, endOfDay } = localDayBoundsToUtcIso(
    targetDate,
    tenantTimezone,
  );

  // Fetch all sales for the day (optionally filtered by location)
  let salesQuery = admin
    .from("sales")
    .select("payment_method, total, status")
    .eq("tenant_id", tenantId)
    .gte("sale_date", startOfDay)
    .lte("sale_date", endOfDay)
    .in("status", ["paid", "completed"]);
  if (locationId) { salesQuery = salesQuery.eq("location_id", locationId); }
  const { data: sales } = await salesQuery;

  // Fetch refunds for the day (optionally filtered by location)
  let refundsQuery = admin
    .from("refunds")
    .select("refund_method, total")
    .eq("tenant_id", tenantId)
    .gte("created_at", startOfDay)
    .lte("created_at", endOfDay)
    .eq("status", "completed");
  if (locationId) { refundsQuery = refundsQuery.eq("location_id", locationId); }
  const { data: refunds } = await refundsQuery;

  // Check for existing reconciliation record (location-specific if multi-store)
  let existingQuery = admin
    .from("eod_reconciliations")
    .select("id, cash_counted, cash_variance, opening_float, closing_float, notes, status, submitted_at, location_id")
    .eq("tenant_id", tenantId)
    .eq("reconciliation_date", targetDate);
  if (locationId) {
    existingQuery = existingQuery.eq("location_id", locationId);
  } else {
    existingQuery = existingQuery.is("location_id", null);
  }
  const { data: existing } = await existingQuery.maybeSingle();

  const salesList = sales ?? [];
  const refundsList = refunds ?? [];

  let totalSalesCash = 0, totalSalesCard = 0, totalSalesTransfer = 0,
      totalSalesVoucher = 0, totalSalesLayby = 0, totalSalesMixed = 0;

  for (const sale of salesList) {
    const total = sale.total ?? 0;
    const method = sale.payment_method ?? "";
    switch (method) {
      case "cash": totalSalesCash += total; break;
      case "card":
      case "eftpos": totalSalesCard += total; break;
      case "transfer": totalSalesTransfer += total; break;
      case "layby": totalSalesLayby += total; break;
      case "mixed": totalSalesMixed += total; break;
      // Voucher-only payment: voucher covers full amount
      case "voucher":
      case "gift_voucher":
      case "gift voucher": totalSalesVoucher += total; break;
      // Store credit
      case "store_credit":
      case "store credit": totalSalesVoucher += total; break; // group with vouchers in EOD
      // Split payments: parse the breakdown
      case "split":
      case "voucher+card":
      case "voucher+cash": {
        // For split payments, voucher portion is voucherAmount, rest goes to card/cash
        const voucherPortion = (sale as { voucher_amount?: number }).voucher_amount ?? 0;
        totalSalesVoucher += voucherPortion;
        const remainder = total - voucherPortion;
        if (method === "voucher+cash") {
          totalSalesCash += remainder;
        } else {
          // split (cash+card) or voucher+card — remainder goes to card
          totalSalesCard += remainder;
        }
        break;
      }
      default: totalSalesCard += total; // Unknown: count as card
    }
  }

  let totalRefundsCash = 0, totalRefundsCard = 0;
  for (const refund of refundsList) {
    if (refund.refund_method === "cash") totalRefundsCash += refund.total ?? 0;
    else totalRefundsCard += refund.total ?? 0;
  }

  const totalRevenue =
    totalSalesCash + totalSalesCard + totalSalesTransfer +
    totalSalesVoucher + totalSalesLayby + totalSalesMixed -
    totalRefundsCash - totalRefundsCard;

  const openingFloat = existing?.opening_float ?? 0;
  const cashExpected = openingFloat + totalSalesCash - totalRefundsCash;

  return {
    data: {
      date: targetDate,
      totalSalesCash,
      totalSalesCard,
      totalSalesTransfer,
      totalSalesVoucher,
      totalSalesLayby,
      totalSalesMixed,
      totalRefundsCash,
      totalRefundsCard,
      totalRevenue,
      transactionCount: salesList.length,
      cashExpected,
      existingReconciliation: existing ?? null,
    },
  };
  } catch (err) {
    logger.error("[getEODSummary] Error:", err);
    await flushSentry();
    return { error: err instanceof Error ? err.message : "Failed to load EOD summary" };
  }
}

export async function saveEODReconciliation(params: {
  date: string;
  openingFloat: number;
  cashCounted: number;
  closingFloat: number;
  notes: string;
  summary: EODSummary;
  submit: boolean;
  locationId?: string | null;
}): Promise<{ id?: string; error?: string }> {
  try {
    let ctx;
    try {
      ctx = await getAuthContext();
    } catch {
      return { error: "Not authenticated" };
    }

    const { admin, userId, tenantId } = ctx;

  const cashVariance = params.cashCounted - params.summary.cashExpected;

  const payload: Record<string, unknown> = {
    tenant_id: tenantId,
    reconciliation_date: params.date,
    location_id: params.locationId || null,
    total_sales_cash: params.summary.totalSalesCash,
    total_sales_card: params.summary.totalSalesCard,
    total_sales_transfer: params.summary.totalSalesTransfer,
    total_sales_voucher: params.summary.totalSalesVoucher,
    total_sales_layby: params.summary.totalSalesLayby,
    total_sales_mixed: params.summary.totalSalesMixed,
    total_refunds_cash: params.summary.totalRefundsCash,
    total_refunds_card: params.summary.totalRefundsCard,
    total_revenue: params.summary.totalRevenue,
    transaction_count: params.summary.transactionCount,
    cash_expected: params.summary.cashExpected,
    cash_counted: params.cashCounted,
    cash_variance: cashVariance,
    opening_float: params.openingFloat,
    closing_float: params.closingFloat,
    notes: params.notes || null,
    status: params.submit ? "submitted" : "draft",
    submitted_by: params.submit ? userId : null,
    submitted_at: params.submit ? new Date().toISOString() : null,
  };

  let resultId: string | undefined;

  if (params.summary.existingReconciliation) {
    // Block double-close: a reconciliation already in 'submitted' state
    // is terminal. Lock-down per spec: "After close: prior-day
    // transactions can't be edited". Allow re-saving the draft up
    // until submission, but reject any attempt to overwrite a
    // submitted record.
    if (params.summary.existingReconciliation.status === "submitted") {
      return {
        error: "This day's reconciliation is already closed. Re-opening would invalidate the audit trail. Contact support if a correction is needed.",
      };
    }
    const { data, error } = await admin
      .from("eod_reconciliations")
      .update(payload)
      .eq("id", params.summary.existingReconciliation.id)
      .neq("status", "submitted") // race-safe guard
      .select("id")
      .single();
    if (error) return { error: error.message };
    resultId = data?.id;
  } else {
    const { data, error } = await admin
      .from("eod_reconciliations")
      .insert(payload)
      .select("id")
      .single();
    if (error) return { error: error.message };
    resultId = data?.id;
  }
  
  // Log audit event if submitted
  if (params.submit && resultId) {
    await logAuditEvent({
      tenantId,
      userId,
      action: "eod_submit",
      entityType: "eod_reconciliation",
      entityId: resultId,
      newData: { 
        date: params.date,
        totalRevenue: params.summary.totalRevenue,
        cashCounted: params.cashCounted,
        cashVariance,
        transactionCount: params.summary.transactionCount,
      },
    });
  }
  
  return { id: resultId };
  } catch (err) {
    logger.error("[saveEODReconciliation] Error:", err);
    await flushSentry();
    return { error: err instanceof Error ? err.message : "Failed to save reconciliation" };
  }
}

export async function getPastReconciliations(): Promise<{
  data?: Array<{
    id: string;
    reconciliation_date: string;
    total_revenue: number;
    transaction_count: number;
    cash_variance: number | null;
    status: string;
    submitted_at: string | null;
  }>;
  error?: string;
}> {
  try {
    let ctx;
    try {
      ctx = await getAuthContext();
    } catch {
      return { error: "Not authenticated" };
    }

    const { admin, tenantId } = ctx;

    const { data, error } = await admin
      .from("eod_reconciliations")
      .select("id, reconciliation_date, total_revenue, transaction_count, cash_variance, status, submitted_at")
      .eq("tenant_id", tenantId)
      .order("reconciliation_date", { ascending: false })
      .limit(30);

    return { data: data ?? [], error: error?.message };
  } catch (err) {
    logger.error("[getPastReconciliations] Error:", err);
    await flushSentry();
    return { error: err instanceof Error ? err.message : "Failed to load past reconciliations" };
  }
}
