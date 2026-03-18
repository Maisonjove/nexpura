/**
 * GET /api/integrations/google-calendar/callback
 * 
 * OAuth callback from Google.
 * Exchanges code for tokens and stores them.
 */

import { NextRequest, NextResponse } from "next/server";
import { upsertIntegration } from "@/lib/integrations";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET!;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/google-calendar/callback`;

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    console.error("[google-calendar/callback] OAuth error:", error);
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
    // Decode state to get tenantId
    const { tenantId } = JSON.parse(Buffer.from(state, "base64").toString());
    
    if (!tenantId) {
      throw new Error("Invalid state - missing tenantId");
    }

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
      console.error("[google-calendar/callback] Token exchange failed:", error);
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
    console.error("[google-calendar/callback]", err);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=callback_failed`
    );
  }
}
