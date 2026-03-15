import { createAdminClient } from "@/lib/supabase/admin";
import EODClient from "@/app/(app)/eod/EODClient";
import type { EODSummary } from "@/app/(app)/eod/actions";

const TENANT_ID = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";

export const revalidate = 60;

export default async function ReviewEODPage() {
  const admin = createAdminClient();
  const today = new Date().toISOString().split("T")[0];
  const startOfDay = `${today}T00:00:00.000Z`;
  const endOfDay = `${today}T23:59:59.999Z`;

  let totalSalesCash = 0, totalSalesCard = 0, totalSalesTransfer = 0,
    totalSalesVoucher = 0, totalSalesLayby = 0, totalSalesMixed = 0;
  let totalRefundsCash = 0, totalRefundsCard = 0;
  let transactionCount = 0;

  // Fetch today's sales (graceful fallback)
  try {
    const { data: sales } = await admin
      .from("sales")
      .select("payment_method, total, status")
      .eq("tenant_id", TENANT_ID)
      .gte("sale_date", startOfDay)
      .lte("sale_date", endOfDay)
      .in("status", ["paid", "completed"]);

    for (const sale of sales ?? []) {
      const total = sale.total ?? 0;
      const method = sale.payment_method ?? "";
      switch (method) {
        case "cash": totalSalesCash += total; break;
        case "card": case "eftpos": totalSalesCard += total; break;
        case "transfer": totalSalesTransfer += total; break;
        case "layby": totalSalesLayby += total; break;
        case "mixed": totalSalesMixed += total; break;
        default: totalSalesCard += total; break;
      }
      transactionCount++;
    }
  } catch {
    // sales table may not exist
  }

  // Fetch today's refunds (graceful fallback)
  try {
    const { data: refunds } = await admin
      .from("refunds")
      .select("refund_method, total")
      .eq("tenant_id", TENANT_ID)
      .gte("created_at", startOfDay)
      .lte("created_at", endOfDay)
      .eq("status", "completed");

    for (const refund of refunds ?? []) {
      const total = refund.total ?? 0;
      if (refund.refund_method === "cash") totalRefundsCash += total;
      else totalRefundsCard += total;
    }
  } catch {
    // refunds table may not exist
  }

  const totalRevenue = totalSalesCash + totalSalesCard + totalSalesTransfer + totalSalesVoucher + totalSalesLayby + totalSalesMixed;
  const cashExpected = totalSalesCash - totalRefundsCash;

  // Check existing reconciliation (graceful fallback)
  let existingReconciliation: EODSummary["existingReconciliation"] = null;
  try {
    const { data: existing } = await admin
      .from("eod_reconciliations")
      .select("id, cash_counted, cash_variance, opening_float, closing_float, notes, status, submitted_at")
      .eq("tenant_id", TENANT_ID)
      .eq("reconciliation_date", today)
      .maybeSingle();
    existingReconciliation = existing ?? null;
  } catch {
    // table may not exist
  }

  // Past records (graceful fallback)
  let pastRecords: Array<{
    id: string;
    reconciliation_date: string;
    total_revenue: number;
    transaction_count: number;
    cash_variance: number | null;
    status: string;
    submitted_at: string | null;
  }> = [];
  try {
    const { data: past } = await admin
      .from("eod_reconciliations")
      .select("id, reconciliation_date, total_revenue, transaction_count, cash_variance, status, submitted_at")
      .eq("tenant_id", TENANT_ID)
      .order("reconciliation_date", { ascending: false })
      .limit(30);
    pastRecords = past ?? [];
  } catch {
    // table may not exist — show empty
  }

  const todaySummary: EODSummary = {
    date: today,
    totalSalesCash,
    totalSalesCard,
    totalSalesTransfer,
    totalSalesVoucher,
    totalSalesLayby,
    totalSalesMixed,
    totalRefundsCash,
    totalRefundsCard,
    totalRevenue,
    transactionCount,
    cashExpected,
    existingReconciliation,
  };

  return (
    <EODClient
      todaySummary={todaySummary}
      pastRecords={pastRecords}
    />
  );
}
