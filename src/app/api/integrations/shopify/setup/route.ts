/**
 * POST /api/integrations/shopify/setup
 *
 * Saves Shopify credentials.
 * Body: { store_url, access_token }
 *
 * GET returns current config (without access_token).
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, getIntegration, upsertIntegration } from "@/lib/integrations";
import logger from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { withSentryFlush } from "@/lib/sentry-flush";

export const POST = withSentryFlush(async (req: NextRequest) => {
  const ip = req.headers.get("x-forwarded-for") ?? "anonymous";
  const { success } = await checkRateLimit(ip, "api");
  if (!success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const { tenantId } = await getAuthContext();
    const body = await req.json();
    const { store_url, access_token } = body;

    if (!store_url || !access_token) {
      return NextResponse.json(
        { error: "store_url and access_token are required" },
        { status: 400 }
      );
    }

    // Normalise store URL — strip https:// and trailing slash
    const normalised = store_url
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, "")
      .toLowerCase();

    const { error } = await upsertIntegration(tenantId, "shopify", {
      store_url: normalised,
      access_token,
    });

    if (error) return NextResponse.json({ error }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("[shopify/setup]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
});

export const GET = withSentryFlush(async (_req: NextRequest) => {
  const ip = _req.headers.get("x-forwarded-for") ?? "anonymous";
  const { success } = await checkRateLimit(ip, "api");
  if (!success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const { tenantId } = await getAuthContext();
    const integration = await getIntegration(tenantId, "shopify");
    if (!integration) return NextResponse.json({ connected: false });

    const cfg = integration.config as Record<string, unknown>;
    return NextResponse.json({
      connected: integration.status === "connected",
      store_url: cfg.store_url ?? null,
      has_token: !!cfg.access_token,
      status: integration.status,
      last_sync_at: integration.last_sync_at,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
});
