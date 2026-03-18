/**
 * Google Calendar integration helpers
 */

import { upsertIntegration, getIntegration } from "@/lib/integrations";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET!;

/**
 * Refresh an expired Google OAuth token
 */
export async function refreshGoogleToken(
  tenantId: string,
  refreshToken: string
): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("[google-calendar] Token refresh failed:", error);
    throw new Error("Token refresh failed");
  }

  const tokens = await response.json();

  // Update stored tokens
  const integration = await getIntegration(tenantId, "google_calendar");
  if (integration) {
    const config = integration.config as Record<string, unknown>;
    await upsertIntegration(
      tenantId,
      "google_calendar",
      {
        ...config,
        access_token: tokens.access_token,
        expires_at: Date.now() + tokens.expires_in * 1000,
        // refresh_token might not be returned on refresh, keep existing
        refresh_token: tokens.refresh_token || config.refresh_token,
      },
      "connected"
    );
  }

  return tokens.access_token;
}

/**
 * Get a valid access token, refreshing if necessary
 */
export async function getValidAccessToken(tenantId: string): Promise<string | null> {
  const integration = await getIntegration(tenantId, "google_calendar");
  if (!integration || integration.status !== "connected") {
    return null;
  }

  const config = integration.config as {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };

  // Refresh if token expires in less than 5 minutes
  if (config.expires_at < Date.now() + 300000) {
    return refreshGoogleToken(tenantId, config.refresh_token);
  }

  return config.access_token;
}

/**
 * Create a calendar event
 */
export async function createCalendarEvent(
  accessToken: string,
  calendarId: string,
  event: {
    summary: string;
    description?: string;
    start: { dateTime?: string; date?: string; timeZone?: string };
    end: { dateTime?: string; date?: string; timeZone?: string };
    location?: string;
  }
) {
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("[google-calendar] Event create failed:", error);
    return null;
  }

  return response.json();
}

/**
 * Delete a calendar event
 */
export async function deleteCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string
) {
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  return response.ok;
}

/**
 * Update a calendar event
 */
export async function updateCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  event: {
    summary?: string;
    description?: string;
    start?: { dateTime?: string; date?: string; timeZone?: string };
    end?: { dateTime?: string; date?: string; timeZone?: string };
    location?: string;
  }
) {
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("[google-calendar] Event update failed:", error);
    return null;
  }

  return response.json();
}
