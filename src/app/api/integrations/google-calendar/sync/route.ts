/**
 * POST /api/integrations/google-calendar/sync
 * 
 * Syncs appointments and repair due dates to Google Calendar.
 * Body: { type: "appointments" | "repairs" | "all" }
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, getIntegration } from "@/lib/integrations";
import { createAdminClient } from "@/lib/supabase/admin";
import { refreshGoogleToken } from "@/lib/google-calendar";
import logger from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const { tenantId } = await getAuthContext();
    const body = await req.json();
    const { type = "all" } = body;
    
    // Get integration
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

    const admin = createAdminClient();
    let synced = { appointments: 0, repairs: 0 };

    // Sync appointments
    if (type === "appointments" || type === "all") {
      const { data: appointments } = await admin
        .from("appointments")
        .select("*")
        .eq("tenant_id", tenantId)
        .gte("scheduled_date", new Date().toISOString().split("T")[0])
        .is("google_calendar_event_id", null);

      for (const apt of appointments || []) {
        const event = await createCalendarEvent(accessToken, config.calendar_id, {
          summary: `Appointment: ${apt.customer_name || "Customer"}`,
          description: apt.notes || "",
          start: {
            dateTime: `${apt.scheduled_date}T${apt.scheduled_time || "09:00"}:00`,
            timeZone: "UTC",
          },
          end: {
            dateTime: `${apt.scheduled_date}T${apt.scheduled_time ? addHour(apt.scheduled_time) : "10:00"}:00`,
            timeZone: "UTC",
          },
        });

        if (event?.id) {
          await admin
            .from("appointments")
            .update({ google_calendar_event_id: event.id })
            .eq("id", apt.id);
          synced.appointments++;
        }
      }
    }

    // Sync repair due dates
    if (type === "repairs" || type === "all") {
      const { data: jobs } = await admin
        .from("jobs")
        .select("*, customers(name)")
        .eq("tenant_id", tenantId)
        .not("estimated_completion", "is", null)
        .is("google_calendar_event_id", null)
        .in("status", ["pending", "in_progress"]);

      for (const job of jobs || []) {
        const event = await createCalendarEvent(accessToken, config.calendar_id, {
          summary: `Repair Due: ${job.repair_type || "Job"} - ${job.customers?.name || "Customer"}`,
          description: `Job #${job.job_number}\n${job.description || ""}`,
          start: {
            date: job.estimated_completion,
          },
          end: {
            date: job.estimated_completion,
          },
        });

        if (event?.id) {
          await admin
            .from("jobs")
            .update({ google_calendar_event_id: event.id })
            .eq("id", job.id);
          synced.repairs++;
        }
      }
    }

    // Update last_sync_at
    await admin
      .from("integrations")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("tenant_id", tenantId)
      .eq("type", "google_calendar");

    return NextResponse.json({ 
      success: true, 
      synced,
      message: `Synced ${synced.appointments} appointments and ${synced.repairs} repairs`
    });
  } catch (err) {
    logger.error("[google-calendar/sync]", err);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}

async function createCalendarEvent(
  accessToken: string,
  calendarId: string,
  event: Record<string, unknown>
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
    logger.error("[google-calendar] Event create failed:", error);
    return null;
  }

  return response.json();
}

function addHour(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const newHour = (h + 1) % 24;
  return `${String(newHour).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
