/**
 * GET /api/integrations/xero/connect
 *
 * Initiates Xero OAuth 2.0 PKCE flow.
 * Redirects the browser to Xero's authorization URL.
 *
 * Required env vars:
 *   XERO_CLIENT_ID       - Your Xero app's client ID
 *   XERO_CLIENT_SECRET   - Your Xero app's client secret
 *   XERO_REDIRECT_URI    - Must match what's registered in Xero developer portal
 *                          e.g. https://yourdomain.com/api/integrations/xero/callback
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/integrations";

const XERO_AUTH_URL = "https://login.xero.com/identity/connect/authorize";
const XERO_SCOPES =
  "openid profile email accounting.transactions accounting.contacts offline_access";

export async function GET(_req: NextRequest) {
  try {
    await getAuthContext(); // ensure user is authenticated

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

    const state = crypto.randomUUID();
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: XERO_SCOPES,
      state,
    });

    const authUrl = `${XERO_AUTH_URL}?${params.toString()}`;
    return NextResponse.redirect(authUrl);
  } catch (err) {
    console.error("[xero/connect]", err);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
