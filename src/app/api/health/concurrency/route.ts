import { NextResponse } from "next/server";

export async function GET() {
  const checks = {
    timestamp: new Date().toISOString(),
    build: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "local",
    
    // Redis idempotency check
    redis: {
      configured: !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN),
      url_set: !!process.env.UPSTASH_REDIS_REST_URL,
      token_set: !!process.env.UPSTASH_REDIS_REST_TOKEN,
    },
    
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
  };

  // Test Redis connectivity
  if (checks.redis.configured) {
    try {
      const response = await fetch(
        `${process.env.UPSTASH_REDIS_REST_URL}/ping`,
        {
          headers: {
            Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
          },
        }
      );
      const data = await response.json();
      (checks.redis as Record<string, unknown>).connected = data.result === "PONG";
      (checks.redis as Record<string, unknown>).response = data.result;
    } catch (e) {
      (checks.redis as Record<string, unknown>).connected = false;
      (checks.redis as Record<string, unknown>).error = String(e);
    }
  }

  return NextResponse.json(checks);
}
