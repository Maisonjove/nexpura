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
import crypto from "crypto";
import { upsertIntegration, getAuthContext } from "@/lib/integrations";
import {
  verifyShopifyOAuthHmac,
  verifyOAuthState,
} from "@/lib/webhook-security";
import logger from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";

const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID!;
const SHOPIFY_CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET!;

function getStateSecret(): string {
  const base = process.env.SHOPIFY_CLIENT_SECRET || "";
  if (!base) throw new Error("[shopify/callback] SHOPIFY_CLIENT_SECRET not configured");
  return crypto.createHash("sha256").update(`shopify-oauth-state:${base}`).digest("hex");
}

/** Shopify-allowed shop domains: `<handle>.myshopify.com`. */
function isValidShopDomain(shop: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shop);
}

const OAUTH_STATE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

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

  // W6-CRIT-08 hardening starts here: every one of these checks must
  // pass before we touch the integrations table with a tenant id.
  if (!isValidShopDomain(shop)) {
    logger.warn("[shopify/callback] rejected non-myshopify shop domain:", shop);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/website/connect?error=bad_shop`
    );
  }

  // 1. Shopify query-string HMAC — signed by the app client secret.
  if (!verifyShopifyOAuthHmac(searchParams, SHOPIFY_CLIENT_SECRET)) {
    logger.warn("[shopify/callback] Shopify HMAC verification failed");
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/website/connect?error=invalid_hmac`
    );
  }

  try {
    // 2. Verify our signed `state` and match it to the browser cookie set
    //    by /connect. This binds the OAuth hop to the browser that
    //    initiated it (same-browser check) and prevents a logged-in
    //    attacker from smuggling another tenant's state onto a victim
    //    session.
    const stateSecret = getStateSecret();
    const decoded = verifyOAuthState<{ tenantId: string; nonce: string; issuedAt: number }>(
      state,
      stateSecret
    );
    if (!decoded?.tenantId || !decoded?.nonce) {
      throw new Error("Invalid state signature");
    }
    if (typeof decoded.issuedAt !== "number" || Date.now() - decoded.issuedAt > OAUTH_STATE_MAX_AGE_MS) {
      throw new Error("State expired");
    }

    const cookieNonce = req.cookies.get("shopify_oauth_nonce")?.value;
    if (!cookieNonce) {
      throw new Error("Missing oauth nonce cookie");
    }
    const aBuf = Buffer.from(decoded.nonce);
    const bBuf = Buffer.from(cookieNonce);
    if (aBuf.length !== bBuf.length || !crypto.timingSafeEqual(aBuf, bBuf)) {
      throw new Error("Nonce mismatch");
    }

    // 3. Session tenant MUST match the tenant in the signed state. No
    //    cross-tenant install — even if a logged-in owner of tenant A
    //    somehow surfaces a state signed for tenant B, we bail.
    const { tenantId: sessionTenantId } = await getAuthContext();
    if (sessionTenantId !== decoded.tenantId) {
      logger.warn("[shopify/callback] tenant mismatch", {
        session: sessionTenantId,
        state: decoded.tenantId,
      });
      throw new Error("Tenant mismatch");
    }

    const tenantId = decoded.tenantId;

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

    const okRes = NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/website/connect?success=shopify_connected`
    );
    // Clear the nonce cookie — it's single-use.
    okRes.cookies.set("shopify_oauth_nonce", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return okRes;
  } catch (err) {
    logger.error("[shopify/callback]", err);
    const failRes = NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/website/connect?error=callback_failed`
    );
    failRes.cookies.set("shopify_oauth_nonce", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return failRes;
  }
}
