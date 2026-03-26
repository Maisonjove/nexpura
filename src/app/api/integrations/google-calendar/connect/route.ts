/**
 * GET /api/integrations/google-calendar/connect
 * 
 * Initiates OAuth flow with Google Calendar.
 * Redirects user to Google's OAuth consent screen.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/integrations";
import { checkRateLimit } from "@/lib/rate-limit";
import logger from "@/lib/logger";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID!;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/google-calendar/callback`;

export async function GET(req: NextRequest) {
  try {
    const { tenantId } = await getAuthContext();

    // Rate limit OAuth initiations
    const { success: rateLimitOk } = await checkRateLimit(`gcal-connect:${tenantId}`);
    if (!rateLimitOk) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=rate_limited`
      );
    }
    
    // Build OAuth URL
    const scopes = [
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/calendar.readonly",
    ];
    
    const state = Buffer.from(JSON.stringify({ tenantId })).toString("base64");
    
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: scopes.join(" "),
      access_type: "offline",
      prompt: "consent",
      state,
    });
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    
    return NextResponse.redirect(authUrl);
  } catch (err) {
    logger.error("[google-calendar/connect]", err);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=auth_failed`
    );
  }
}
