/**
 * GET /api/integrations/xero/connect
 *
 * Initiates Xero OAuth 2.0 flow.
 * Redirects the browser to Xero's authorization URL.
 *
 * Required env vars:
 *   XERO_CLIENT_ID       - Your Xero app's client ID
 *   XERO_CLIENT_SECRET   - Your Xero app's client secret
 *   XERO_REDIRECT_URI    - Must match what's registered in Xero developer portal
 *                          e.g. https://yourdomain.com/api/integrations/xero/callback
 *
 * CRIT-6 hardening: the previous implementation generated a random
 * `state` but never persisted it, and the callback never read it. A
 * logged-in attacker could trick a victim (Tenant A's owner) into
 * hitting the callback with the attacker's `code`, linking the
 * attacker's Xero org to the victim's tenant. We now:
 *   - sign a state blob {tenantId, nonce, issuedAt} with an HMAC secret
 *     derived from XERO_CLIENT_SECRET (no new env var required — same
 *     convention as the Shopify flow).
 *   - set a single-use `xero_oauth_nonce` HttpOnly cookie bound to the
 *     browser that initiated the flow.
 *   - callback verifies the signed state AND matches the nonce cookie
 *     before touching the integrations table.
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { requireIntegrationManager } from "@/lib/integrations";
import { checkRateLimit } from "@/lib/rate-limit";
import { signOAuthState } from "@/lib/webhook-security";
import logger from "@/lib/logger";
import { withSentryFlush } from "@/lib/sentry-flush";

const XERO_AUTH_URL = "https://login.xero.com/identity/connect/authorize";
const XERO_SCOPES =
  "openid profile email accounting.transactions accounting.contacts offline_access";

/**
 * Secret used to HMAC-sign the OAuth `state` and the companion nonce
 * cookie. Derived from XERO_CLIENT_SECRET so no new env var is needed,
 * but namespaced so a leak of a signed state can't forge arbitrary data
 * under a sibling flow (Shopify's state uses its own namespace).
 */
function getStateSecret(): string {
  const base = process.env.XERO_CLIENT_SECRET || "";
  if (!base) throw new Error("[xero/connect] XERO_CLIENT_SECRET not configured");
  return crypto.createHash("sha256").update(`xero-oauth-state:${base}`).digest("hex");
}

export const GET = withSentryFlush(async (_req: NextRequest) => {
  const ip = _req.headers.get("x-forwarded-for") ?? "anonymous";
  const { success } = await checkRateLimit(ip, "api");
  if (!success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const { tenantId } = await requireIntegrationManager();

    const clientId = process.env.XERO_CLIENT_ID;
    const redirectUri = process.env.XERO_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return NextResponse.json(
        {
          error:
            "Xero is not configured. Set XERO_CLIENT_ID and XERO_REDIRECT_URI environment variables.",
          configured: false,
        },
        { status: 400 }
      );
    }

    // CRIT-6: signed state + nonce cookie, matching the Shopify pattern.
    const nonce = crypto.randomBytes(24).toString("base64url");
    const stateSecret = getStateSecret();
    const state = signOAuthState(
      { tenantId, nonce, issuedAt: Date.now() },
      stateSecret
    );

    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: XERO_SCOPES,
      state,
    });

    const authUrl = `${XERO_AUTH_URL}?${params.toString()}`;
    const res = NextResponse.redirect(authUrl);
    res.cookies.set("xero_oauth_nonce", nonce, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 60, // 10 minutes
    });
    return res;
  } catch (err) {
    logger.error("[xero/connect]", err);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
});
