/**
 * GET /api/integrations/shopify/callback
 *
 * OAuth callback from Shopify — exchanges the auth code for an access
 * token and stores credentials.
 *
 * ── cacheComponents migration notes ─────────────────────────────────────
 *
 * Blocker under global CC:
 *   Top-of-GET reads `req.headers.get("x-forwarded-for")` and
 *   `req.nextUrl.searchParams`, both request-scoped. Under CC the
 *   prerender pipeline enters the handler, bails on the header read,
 *   and the continuation (rate-limit Redis fetch, token exchange,
 *   upsertIntegration DB write) hangs post-prerender →
 *   HANGING_PROMISE_REJECTION.
 *
 * Fix: `await connection()` from `next/server` as the first statement
 * of GET. Same one-line template proven on /api/check-subdomain,
 * /api/health/concurrency, /api/warm, and the /connect initiators.
 *
 * OAuth safety:
 *   - state → tenantId decode is unchanged.
 *   - Code→token exchange unchanged. Shopify client creds stay
 *     server-side; nothing touches request cookies directly.
 *   - All redirect destinations unchanged.
 *   - No segment-config exports present on this route — nothing to
 *     remove.
 */

import { NextRequest, NextResponse } from "next/server";
import { connection } from "next/server";
import { upsertIntegration } from "@/lib/integrations";
import logger from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";

const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID!;
const SHOPIFY_CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET!;

export async function GET(req: NextRequest) {
  // CC-migration marker: defer to request time before any header/query
  // read. No-op under the current pre-CC model.
  await connection();

  const ip = req.headers.get("x-forwarded-for") ?? "anonymous";
  const { success } = await checkRateLimit(ip, "webhook");
  if (!success) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=rate_limited`
    );
  }

  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get("code");
  const shop = searchParams.get("shop");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    logger.error("[shopify/callback] OAuth error:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/website/connect?error=oauth_denied`
    );
  }

  if (!code || !shop || !state) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/website/connect?error=missing_params`
    );
  }

  try {
    // Decode state to get tenantId
    const { tenantId } = JSON.parse(Buffer.from(state, "base64").toString());
    
    if (!tenantId) {
      throw new Error("Invalid state - missing tenantId");
    }

    // Exchange code for access token
    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: SHOPIFY_CLIENT_ID,
        client_secret: SHOPIFY_CLIENT_SECRET,
        code,
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      logger.error("[shopify/callback] Token exchange failed:", error);
      throw new Error("Token exchange failed");
    }

    const tokens = await tokenResponse.json();
    
    // Get shop info
    const shopResponse = await fetch(`https://${shop}/admin/api/2024-01/shop.json`, {
      headers: {
        "X-Shopify-Access-Token": tokens.access_token,
      },
    });

    let shopName = shop;
    if (shopResponse.ok) {
      const shopData = await shopResponse.json();
      shopName = shopData.shop?.name || shop;
    }

    // Store credentials
    const { error: upsertError } = await upsertIntegration(
      tenantId,
      "shopify",
      {
        shop,
        shop_name: shopName,
        access_token: tokens.access_token,
        scope: tokens.scope,
        connected_at: new Date().toISOString(),
      },
      "connected"
    );

    if (upsertError) {
      throw new Error(upsertError);
    }

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/website/connect?success=shopify_connected`
    );
  } catch (err) {
    logger.error("[shopify/callback]", err);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/website/connect?error=callback_failed`
    );
  }
}
