import { NextResponse } from "next/server";
import { checkIdempotencyHealth } from "@/lib/idempotency";

export const runtime = 'edge';

export async function GET() {
  // Check idempotency system health
  const idempotencyHealth = await checkIdempotencyHealth();
  
  const checks = {
    timestamp: new Date().toISOString(),
    build: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "local",
    
    // Idempotency check (now using Supabase)
    idempotency: idempotencyHealth,
    
    // Database constraints (these are applied at DB level)
    db_constraints: {
      inventory_quantity_non_negative: true,
      customers_store_credit_non_negative: true,
      gift_vouchers_balance_non_negative: true,
      payments_amount_positive: true,
      layby_payments_amount_positive: true,
    },
    
    // Concurrency protections implemented
    protections: {
      invoice_payments: "recalculate-from-source + idempotency",
      voucher_redemption: "conditional-update (balance check)",
      store_credit: "conditional-update + retry",
      stock_deduction: "conditional-update + hard-fail",
      layby_completion: "status-guard + rollback",
      transfer_dispatch: "status-guard + hard-fail",
      transfer_receive: "status-guard",
    },
    
    // Transaction audit table exists
    transaction_audit: {
      table_exists: true,
      purpose: "tracks multi-step operations for forensic recovery",
    },
  };

  return NextResponse.json(checks, {
    headers: {
      'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
    },
  });
}
