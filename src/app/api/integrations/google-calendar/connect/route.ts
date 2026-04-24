/**
 * GET /api/integrations/google-calendar/connect
 *
 * Initiates OAuth flow with Google Calendar. Redirects user to Google's
 * OAuth consent screen.
 *
 * CRIT-6-equivalent hardening (same pattern the Xero flow uses post
 * commit fc9f336):
 *   - signs a state blob {tenantId, nonce, issuedAt} with an HMAC secret
 *     derived from GOOGLE_OAUTH_CLIENT_SECRET (no new env var).
 *   - sets a single-use `gcal_oauth_nonce` HttpOnly cookie bound to the
 *     browser that initiated the flow.
 *   - callback verifies the signed state AND matches the nonce cookie
 *     before linking the Google Calendar tokens to any tenant.
 *
 * Prior impl used `state = base64(JSON.stringify({tenantId}))` — a
 * logged-in attacker could forge a state blob with the victim's
 * tenantId and trick them through Google's consent screen to link
 * the attacker's calendar to the victim's tenant (or vice versa).
 */

import { NextRequest, NextResponse } from "next/server";
import { connection } from "next/server";
import crypto from "crypto";
import { getAuthContext } from "@/lib/integrations";
import { checkRateLimit } from "@/lib/rate-limit";
import { signOAuthState } from "@/lib/webhook-security";
import logger from "@/lib/logger";

const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/google-calendar/callback`;

function getStateSecret(): string {
  const base = process.env.GOOGLE_OAUTH_CLIENT_SECRET || "";
  if (!base) throw new Error("[google-calendar/connect] GOOGLE_OAUTH_CLIENT_SECRET not configured");
  return crypto.createHash("sha256").update(`gcal-oauth-state:${base}`).digest("hex");
}

export async function GET(_req: NextRequest) {
  // CC-migration marker: defer to request time.
  await connection();

  try {
    const { tenantId } = await getAuthContext();

    // Rate limit OAuth initiations
    const { success: rateLimitOk } = await checkRateLimit(`gcal-connect:${tenantId}`);
    if (!rateLimitOk) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=rate_limited`
      );
    }

    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    if (!clientId) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=not_configured`
      );
    }

    const scopes = [
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/calendar.readonly",
    ];

    const nonce = crypto.randomBytes(24).toString("base64url");
    const stateSecret = getStateSecret();
    const state = signOAuthState(
      { tenantId, nonce, issuedAt: Date.now() },
      stateSecret,
    );

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: scopes.join(" "),
      access_type: "offline",
      prompt: "consent",
      state,
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    const res = NextResponse.redirect(authUrl);
    res.cookies.set("gcal_oauth_nonce", nonce, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 60, // 10 minutes
    });
    return res;
  } catch (err) {
    logger.error("[google-calendar/connect]", err);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=auth_failed`
    );
  }
}
