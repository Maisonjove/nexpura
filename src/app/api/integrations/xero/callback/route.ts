/**
 * GET /api/integrations/xero/callback
 *
 * Xero OAuth 2.0 callback — exchanges auth code for tokens, fetches
 * connected tenant info (organisation in Xero's terminology), and
 * persists to DB.
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
import { getAuthContext, upsertIntegration } from "@/lib/integrations";
import logger from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";

const XERO_TOKEN_URL = "https://identity.xero.com/connect/token";
const XERO_CONNECTIONS_URL = "https://api.xero.com/connections";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://nexpura.com";

export async function GET(req: NextRequest) {
  // CC-migration marker: defer to request time before any header/cookie
  // read. No-op under the current pre-CC model.
  await connection();

  const ip = req.headers.get("x-forwarded-for") ?? "anonymous";
  const { success } = await checkRateLimit(ip, "webhook");
  if (!success) {
    return NextResponse.redirect(`${APP_URL}/integrations?error=rate_limited`);
  }

  try {
    const { tenantId } = await getAuthContext();

    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error || !code) {
      return NextResponse.redirect(
        `${APP_URL}/settings/integrations?xero=error&reason=${encodeURIComponent(error ?? "no_code")}`
      );
    }

    const clientId = process.env.XERO_CLIENT_ID!;
    const clientSecret = process.env.XERO_CLIENT_SECRET!;
    const redirectUri = process.env.XERO_REDIRECT_URI!;

    if (!clientId || !clientSecret || !redirectUri) {
      return NextResponse.redirect(
        `${APP_URL}/settings/integrations?xero=error&reason=not_configured`
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
      return NextResponse.redirect(
        `${APP_URL}/settings/integrations?xero=error&reason=token_exchange_failed`
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

    return NextResponse.redirect(
      `${APP_URL}/settings/integrations?xero=connected&org=${encodeURIComponent(orgName ?? "Xero")}`
    );
  } catch (err) {
    logger.error("[xero/callback]", err);
    return NextResponse.redirect(
      `${APP_URL}/settings/integrations?xero=error&reason=server_error`
    );
  }
}
