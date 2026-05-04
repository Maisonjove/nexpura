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
import { checkRateLimit } from "@/lib/rate-limit";
import { withSentryFlush } from "@/lib/sentry-flush";

export const POST = withSentryFlush(async (req: NextRequest) => {
  const ip = req.headers.get("x-forwarded-for") ?? "anonymous";
  const { success } = await checkRateLimit(ip, "heavy");
  if (!success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

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
    const synced = { appointments: 0, repairs: 0 };

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

    // Sync repair due dates. Pre-fix queried `jobs` (table doesn't
    // exist — only `repairs` and `bespoke_jobs`) and selected
    // `customers(name)` (column is `full_name`) and `estimated_completion`
    // (real column is `due_date` on repairs / `estimated_completion_date`
    // on bespoke). Whole branch 500'd. Use `repairs` with the real
    // columns; `bespoke_jobs` are out of scope for this branch.
    if (type === "repairs" || type === "all") {
      const { data: jobs } = await admin
        .from("repairs")
        .select("id, repair_number, repair_type, item_description, due_date, google_calendar_event_id, stage, customers(full_name)")
        .eq("tenant_id", tenantId)
        .not("due_date", "is", null)
        .is("google_calendar_event_id", null)
        .in("stage", ["intake", "assessed", "quoted", "approved", "in_progress"]);

      for (const job of jobs || []) {
        const customer = Array.isArray(job.customers) ? job.customers[0] : job.customers;
        const customerName = customer?.full_name || "Customer";
        const event = await createCalendarEvent(accessToken, config.calendar_id, {
          summary: `Repair Due: ${job.repair_type || "Job"} - ${customerName}`,
          description: `Job #${job.repair_number}\n${job.item_description || ""}`,
          start: {
            date: job.due_date,
          },
          end: {
            date: job.due_date,
          },
        });

        if (event?.id) {
          await admin
            .from("repairs")
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
});

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
