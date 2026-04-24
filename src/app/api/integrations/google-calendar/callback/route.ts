/**
 * GET /api/integrations/google-calendar/callback
 *
 * OAuth callback from Google. Exchanges code for tokens and stores
 * them alongside the primary calendar identifiers.
 *
 * ── cacheComponents migration notes ─────────────────────────────────────
 *
 * Twin to /api/integrations/shopify/callback. Same blocker shape:
 * top-of-GET reads request headers + query params, then performs an
 * async token exchange + Google API fetch + DB upsert. Under CC the
 * prerender pipeline would hit the header read, bail, and leak the
 * continuation as a hanging promise.
 *
 * Fix: `await connection()` as the first statement. OAuth correctness
 * unchanged — state decode, token exchange, calendar identifier fetch,
 * redirect destinations all preserved byte-for-byte.
 *
 * No segment-config exports present.
 */

import { NextRequest, NextResponse } from "next/server";
import { connection } from "next/server";
import crypto from "crypto";
import { upsertIntegration } from "@/lib/integrations";
import { getAuthContext } from "@/lib/integrations";
import { verifyOAuthState } from "@/lib/webhook-security";
import { safeCompare } from "@/lib/timing-safe-compare";
import logger from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET!;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/google-calendar/callback`;

function getStateSecret(): string {
  const base = process.env.GOOGLE_OAUTH_CLIENT_SECRET || "";
  if (!base) throw new Error("[google-calendar/callback] GOOGLE_OAUTH_CLIENT_SECRET not configured");
  return crypto.createHash("sha256").update(`gcal-oauth-state:${base}`).digest("hex");
}

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
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    logger.error("[google-calendar/callback] OAuth error:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=oauth_denied`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=missing_params`
    );
  }

  try {
    // Verify signed state + nonce cookie (mirrors the Xero/Shopify pattern).
    // Unsigned base64 state was a CSRF account-linking vector — a logged-in
    // attacker could craft a state blob with the victim's tenantId and
    // link their own calendar to the victim's tenant (or vice versa).
    const stateSecret = getStateSecret();
    const payload = verifyOAuthState<{ tenantId: string; nonce: string; issuedAt: number }>(
      state,
      stateSecret,
    );
    if (!payload || !payload.tenantId || !payload.nonce) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=invalid_state`,
      );
    }
    // State must be fresh — 10-minute window matches the nonce cookie TTL.
    if (Date.now() - payload.issuedAt > 10 * 60 * 1000) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=state_expired`,
      );
    }
    // Nonce must match the cookie set on /connect — proves the same
    // browser started this flow.
    const cookieNonce = req.cookies.get("gcal_oauth_nonce")?.value;
    if (!cookieNonce || !safeCompare(cookieNonce, payload.nonce)) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=nonce_mismatch`,
      );
    }
    // Session-tenant equality: the logged-in user's tenant must match
    // the tenantId embedded in the state. This catches the case where
    // an attacker initiates a flow on one tenant and the callback hits
    // a different tenant's session.
    const session = await getAuthContext();
    if (session.tenantId !== payload.tenantId) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=tenant_mismatch`,
      );
    }
    const { tenantId } = payload;

    // Exchange code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      logger.error("[google-calendar/callback] Token exchange failed:", error);
      throw new Error("Token exchange failed");
    }

    const tokens = await tokenResponse.json();
    
    // Get user's primary calendar ID
    const calendarResponse = await fetch(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList/primary",
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      }
    );

    let calendarId = "primary";
    let calendarEmail = "";
    
    if (calendarResponse.ok) {
      const calendarData = await calendarResponse.json();
      calendarId = calendarData.id || "primary";
      calendarEmail = calendarData.summary || calendarData.id || "";
    }

    // Store tokens in integrations table
    const { error: upsertError } = await upsertIntegration(
      tenantId,
      "google_calendar",
      {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_type: tokens.token_type,
        expires_at: Date.now() + tokens.expires_in * 1000,
        calendar_id: calendarId,
        calendar_email: calendarEmail,
        scope: tokens.scope,
      },
      "connected"
    );

    if (upsertError) {
      throw new Error(upsertError);
    }

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/integrations/google-calendar?success=connected`
    );
  } catch (err) {
    logger.error("[google-calendar/callback]", err);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=callback_failed`
    );
  }
}
