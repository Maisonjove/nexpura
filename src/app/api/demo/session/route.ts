import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";

/**
 * GET /api/demo/session — DISABLED.
 *
 * Previously signed in as demo@nexpura.com using a hardcoded password.
 * Audit finding (High): the prod-gate was ENABLE_DEMO_MODE=true |
 * VERCEL_ENV.includes("preview") — a single env-var typo in production
 * scope made the hardcoded-password login available on nexpura.com.
 *
 * Fixed by removing the sign-in path entirely. Demo access is now only
 * available via the /review/ and /staff/ bypass cookies (middleware)
 * with timing-safe compare, which can be revoked centrally.
 *
 * Return 410 Gone so old links surface a clear message.
 */
export async function GET(_request: NextRequest) {
  logger.warn("[demo/session] Endpoint permanently disabled");
  return NextResponse.json(
    { error: "Demo session endpoint has been removed. Use a magic-link invite for demo access." },
    { status: 410 },
  );
}
