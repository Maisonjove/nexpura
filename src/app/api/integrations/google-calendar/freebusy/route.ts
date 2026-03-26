/**
 * POST /api/integrations/google-calendar/freebusy
 * 
 * Fetches busy/free times from Google Calendar to block appointment slots.
 * 
 * Body: { startDate: string, endDate: string }
 * Returns list of busy periods.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, getIntegration } from "@/lib/integrations";
import { refreshGoogleToken } from "@/lib/google-calendar";
import logger from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";

interface FreeBusyResponse {
  calendars: {
    [calendarId: string]: {
      busy: Array<{ start: string; end: string }>;
      errors?: Array<{ domain: string; reason: string }>;
    };
  };
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "anonymous";
  const { success } = await checkRateLimit(ip, "api");
  if (!success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const { tenantId } = await getAuthContext();
    const body = await req.json();
    const { startDate, endDate } = body;

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "startDate and endDate are required" },
        { status: 400 }
      );
    }

    const integration = await getIntegration(tenantId, "google_calendar");
    if (!integration || integration.status !== "connected") {
      return NextResponse.json(
        { error: "Google Calendar not connected" },
        { status: 400 }
      );
    }

    const config = integration.config as {
      access_token: string;
      refresh_token: string;
      expires_at: number;
      calendar_id: string;
    };

    // Refresh token if needed
    let accessToken = config.access_token;
    if (config.expires_at < Date.now() + 60000) {
      accessToken = await refreshGoogleToken(tenantId, config.refresh_token);
    }

    // Query free/busy
    const freeBusyResponse = await fetch(
      "https://www.googleapis.com/calendar/v3/freeBusy",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          timeMin: new Date(startDate).toISOString(),
          timeMax: new Date(endDate).toISOString(),
          items: [{ id: config.calendar_id }],
        }),
      }
    );

    if (!freeBusyResponse.ok) {
      const error = await freeBusyResponse.text();
      logger.error("[google-calendar/freebusy] Failed:", error);
      return NextResponse.json({ error: "Failed to fetch calendar availability" }, { status: 500 });
    }

    const freeBusyData: FreeBusyResponse = await freeBusyResponse.json();
    const calendarData = freeBusyData.calendars[config.calendar_id];

    if (calendarData?.errors?.length) {
      logger.warn("[google-calendar/freebusy] Calendar errors:", calendarData.errors);
    }

    const busyPeriods = calendarData?.busy || [];

    return NextResponse.json({
      success: true,
      busyPeriods: busyPeriods.map(period => ({
        start: period.start,
        end: period.end,
      })),
    });
  } catch (err) {
    logger.error("[google-calendar/freebusy]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch availability" },
      { status: 500 }
    );
  }
}
