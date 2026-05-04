/**
 * GET /api/integrations/xero/callback
 *
 * Xero OAuth 2.0 callback — exchanges auth code for tokens, fetches
 * connected tenant info (organisation in Xero's terminology), and
 * persists to DB.
 *
 * CRIT-6 hardening: we now verify the signed `state` parameter produced
 * by /connect AND match its nonce against the `xero_oauth_nonce`
 * HttpOnly cookie. Both must check out before we touch the
 * integrations table. Session tenant must also match the state's
 * tenantId so a logged-in attacker can't smuggle another tenant's
 * state onto a victim session. Mirrors the Shopify flow.
 *
 * ── cacheComponents migration notes ─────────────────────────────────────
 *
 * Superset blocker: reads request headers (x-forwarded-for) AND calls
 * `getAuthContext()` which hits `supabase.auth.getUser()` (cookies)
 * inside the try block. Under CC both are request-scoped dynamic reads
 * that would fire the prerender-bail and hang the subsequent token
 * exchange + upsert.
 *
 * Fix: `await connection()` as the first statement of GET. All
 * existing OAuth correctness preserved — code→token exchange,
 * organisation fetch, and the `?xero=connected&org=...` / `?xero=error`
 * redirect destinations are unchanged.
 *
 * No segment-config exports present on this route.
 */

import { NextRequest, NextResponse } from "next/server";
import { connection } from "next/server";
import crypto from "crypto";
import { requireIntegrationManager, upsertIntegration } from "@/lib/integrations";
import { verifyOAuthState } from "@/lib/webhook-security";
import logger from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { withSentryFlush } from "@/lib/sentry-flush";

const XERO_TOKEN_URL = "https://identity.xero.com/connect/token";
const XERO_CONNECTIONS_URL = "https://api.xero.com/connections";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://nexpura.com";
const OAUTH_STATE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

function getStateSecret(): string {
  const base = process.env.XERO_CLIENT_SECRET || "";
  if (!base) throw new Error("[xero/callback] XERO_CLIENT_SECRET not configured");
  return crypto.createHash("sha256").update(`xero-oauth-state:${base}`).digest("hex");
}

function clearNonceCookie(res: NextResponse): NextResponse {
  res.cookies.set("xero_oauth_nonce", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}

export const GET = withSentryFlush(async (req: NextRequest) => {
  // CC-migration marker: defer to request time before any header/cookie
  // read. No-op under the current pre-CC model.
  await connection();

  const ip = req.headers.get("x-forwarded-for") ?? "anonymous";
  const { success } = await checkRateLimit(ip, "webhook");
  if (!success) {
    return NextResponse.redirect(`${APP_URL}/integrations?error=rate_limited`);
  }

  try {
    const { tenantId: sessionTenantId } = await requireIntegrationManager();

    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error || !code) {
      return clearNonceCookie(
        NextResponse.redirect(
          `${APP_URL}/settings/integrations?xero=error&reason=${encodeURIComponent(error ?? "no_code")}`
        )
      );
    }

    // CRIT-6: state is mandatory and must be signed + nonce-matched.
    if (!state) {
      logger.warn("[xero/callback] missing state param");
      return clearNonceCookie(
        NextResponse.redirect(
          `${APP_URL}/settings/integrations?xero=error&reason=missing_state`
        )
      );
    }

    const stateSecret = getStateSecret();
    const decoded = verifyOAuthState<{ tenantId: string; nonce: string; issuedAt: number }>(
      state,
      stateSecret
    );
    if (!decoded?.tenantId || !decoded?.nonce) {
      logger.warn("[xero/callback] invalid state signature");
      return clearNonceCookie(
        NextResponse.redirect(
          `${APP_URL}/settings/integrations?xero=error&reason=invalid_state`
        )
      );
    }
    if (
      typeof decoded.issuedAt !== "number" ||
      Date.now() - decoded.issuedAt > OAUTH_STATE_MAX_AGE_MS
    ) {
      logger.warn("[xero/callback] state expired");
      return clearNonceCookie(
        NextResponse.redirect(
          `${APP_URL}/settings/integrations?xero=error&reason=state_expired`
        )
      );
    }

    const cookieNonce = req.cookies.get("xero_oauth_nonce")?.value;
    if (!cookieNonce) {
      logger.warn("[xero/callback] missing oauth nonce cookie");
      return clearNonceCookie(
        NextResponse.redirect(
          `${APP_URL}/settings/integrations?xero=error&reason=missing_nonce`
        )
      );
    }
    const aBuf = Buffer.from(decoded.nonce);
    const bBuf = Buffer.from(cookieNonce);
    if (aBuf.length !== bBuf.length || !crypto.timingSafeEqual(aBuf, bBuf)) {
      logger.warn("[xero/callback] nonce mismatch");
      return clearNonceCookie(
        NextResponse.redirect(
          `${APP_URL}/settings/integrations?xero=error&reason=nonce_mismatch`
        )
      );
    }

    // Tenant in signed state must match the session tenant — otherwise
    // a logged-in user of Tenant A is somehow carrying Tenant B's state.
    if (sessionTenantId !== decoded.tenantId) {
      logger.warn("[xero/callback] tenant mismatch", {
        session: sessionTenantId,
        state: decoded.tenantId,
      });
      return clearNonceCookie(
        NextResponse.redirect(
          `${APP_URL}/settings/integrations?xero=error&reason=tenant_mismatch`
        )
      );
    }

    const tenantId = decoded.tenantId;

    const clientId = process.env.XERO_CLIENT_ID!;
    const clientSecret = process.env.XERO_CLIENT_SECRET!;
    const redirectUri = process.env.XERO_REDIRECT_URI!;

    if (!clientId || !clientSecret || !redirectUri) {
      return clearNonceCookie(
        NextResponse.redirect(
          `${APP_URL}/settings/integrations?xero=error&reason=not_configured`
        )
      );
    }

    // Exchange code for tokens
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const tokenRes = await fetch(XERO_TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      logger.error("[xero/callback] Token exchange failed:", text);
      return clearNonceCookie(
        NextResponse.redirect(
          `${APP_URL}/settings/integrations?xero=error&reason=token_exchange_failed`
        )
      );
    }

    const tokens = await tokenRes.json();
    const { access_token, refresh_token, expires_in } = tokens;

    // Fetch connected organisations (tenants in Xero's terminology)
    const connectionsRes = await fetch(XERO_CONNECTIONS_URL, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const connections = await connectionsRes.json();
    const primaryTenant = connections?.[0];

    const xeroTenantId = primaryTenant?.tenantId ?? null;
    const orgName = primaryTenant?.tenantName ?? null;

    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    await upsertIntegration(tenantId, "xero", {
      access_token,
      refresh_token,
      xero_tenant_id: xeroTenantId,
      org_name: orgName,
      expires_at: expiresAt,
    });

    return clearNonceCookie(
      NextResponse.redirect(
        `${APP_URL}/settings/integrations?xero=connected&org=${encodeURIComponent(orgName ?? "Xero")}`
      )
    );
  } catch (err) {
    logger.error("[xero/callback]", err);
    return clearNonceCookie(
      NextResponse.redirect(
        `${APP_URL}/settings/integrations?xero=error&reason=server_error`
      )
    );
  }
});
