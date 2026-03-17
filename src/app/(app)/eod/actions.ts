"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
  let ctx;
  try { ctx = await getAuthContext(); } catch { return { error: "Not authenticated" }; }
  const { admin, tenantId } = ctx;

  const targetDate = date ?? new Date().toISOString().split("T")[0];
  const startOfDay = `${targetDate}T00:00:00.000Z`;
  const endOfDay = `${targetDate}T23:59:59.999Z`;

  // Fetch all sales for the day (optionally filtered by location)
  let salesQuery = admin
    .from("sales")
    .select("payment_method, total, status")
    .eq("tenant_id", tenantId)
    .gte("sale_date", startOfDay)
    .lte("sale_date", endOfDay)
    .in("status", ["paid", "completed"]);
  
  if (locationId) {
    salesQuery = salesQuery.eq("location_id", locationId);
  }
  
  const { data: sales } = await salesQuery;

  // Fetch refunds for the day (optionally filtered by location)
  let refundsQuery = admin
    .from("refunds")
    .select("refund_method, total")
    .eq("tenant_id", tenantId)
    .gte("created_at", startOfDay)
    .lte("created_at", endOfDay)
    .eq("status", "completed");
  
  if (locationId) {
    refundsQuery = refundsQuery.eq("location_id", locationId);
  }
  
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

  const totalRevenue = totalSalesCash + totalSalesCard + totalSalesTransfer +
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
  let ctx;
  try { ctx = await getAuthContext(); } catch { return { error: "Not authenticated" }; }
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

  if (params.summary.existingReconciliation) {
    const { data, error } = await admin
      .from("eod_reconciliations")
      .update(payload)
      .eq("id", params.summary.existingReconciliation.id)
      .select("id")
      .single();
    if (error) return { error: error.message };
    return { id: data?.id };
  } else {
    const { data, error } = await admin
      .from("eod_reconciliations")
      .insert(payload)
      .select("id")
      .single();
    if (error) return { error: error.message };
    return { id: data?.id };
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
  let ctx;
  try { ctx = await getAuthContext(); } catch { return { error: "Not authenticated" }; }
  const { admin, tenantId } = ctx;

  const { data, error } = await admin
    .from("eod_reconciliations")
    .select("id, reconciliation_date, total_revenue, transaction_count, cash_variance, status, submitted_at")
    .eq("tenant_id", tenantId)
    .order("reconciliation_date", { ascending: false })
    .limit(30);

  return { data: data ?? [], error: error?.message };
}
