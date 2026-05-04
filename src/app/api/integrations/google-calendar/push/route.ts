/**
 * POST /api/integrations/google-calendar/push
 * 
 * Pushes a Nexpura appointment to Google Calendar.
 * 
 * Body: { appointmentId: string } or { appointment: { ... } }
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, getIntegration } from "@/lib/integrations";
import { createAdminClient } from "@/lib/supabase/admin";
import { createCalendarEvent, updateCalendarEvent, refreshGoogleToken } from "@/lib/google-calendar";
import logger from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { withSentryFlush } from "@/lib/sentry-flush";

export const POST = withSentryFlush(async (req: NextRequest) => {
  const ip = req.headers.get("x-forwarded-for") ?? "anonymous";
  const { success } = await checkRateLimit(ip, "api");
  if (!success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const { tenantId } = await getAuthContext();
    const body = await req.json();
    const { appointmentId, appointment: directAppointment } = body;

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

    // Get appointment data
    let appointment = directAppointment;
    if (appointmentId && !appointment) {
      const { data, error } = await admin
        .from("appointments")
        .select("*, customers(name, email, mobile)")
        .eq("id", appointmentId)
        .eq("tenant_id", tenantId)
        .single();

      if (error || !data) {
        return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
      }
      appointment = data;
    }

    if (!appointment) {
      return NextResponse.json({ error: "Appointment data required" }, { status: 400 });
    }

    // Build calendar event
    const startDateTime = `${appointment.scheduled_date}T${appointment.scheduled_time || "09:00"}:00`;
    const endTime = appointment.scheduled_time
      ? addMinutes(appointment.scheduled_time, appointment.duration_minutes || 60)
      : "10:00";
    const endDateTime = `${appointment.scheduled_date}T${endTime}:00`;

    const eventData = {
      summary: `${appointment.appointment_type || "Appointment"}: ${appointment.customer_name || appointment.customers?.name || "Customer"}`,
      description: [
        appointment.notes || "",
        appointment.customers?.mobile ? `Phone: ${appointment.customers.mobile}` : "",
        appointment.customers?.email ? `Email: ${appointment.customers.email}` : "",
      ].filter(Boolean).join("\n"),
      start: { dateTime: startDateTime, timeZone: "UTC" },
      end: { dateTime: endDateTime, timeZone: "UTC" },
      location: appointment.location || undefined,
    };

    let eventId = appointment.google_calendar_event_id;
    let result;

    if (eventId) {
      // Update existing event
      result = await updateCalendarEvent(accessToken, config.calendar_id, eventId, eventData);
    } else {
      // Create new event
      result = await createCalendarEvent(accessToken, config.calendar_id, eventData);
      eventId = result?.id;

      // Save Google Calendar event ID back to appointment
      if (appointmentId && eventId) {
        // Kind B (server-action-style, destructive return-error). The
        // Google Calendar event was just created above; if we lose the
        // event_id <-> appointment_id linkage here, every subsequent
        // push will create a NEW event (the eventId column never gets
        // populated for matching) and the operator gets duplicate
        // calendar entries. Surface so the user retries before more
        // duplicates accumulate.
        const { error: linkErr } = await admin
          .from("appointments")
          .update({ google_calendar_event_id: eventId })
          .eq("id", appointmentId);
        if (linkErr) {
          return NextResponse.json(
            { error: `appointments link save failed: ${linkErr.message}` },
            { status: 500 },
          );
        }
      }
    }

    if (!result) {
      return NextResponse.json({ error: "Failed to sync to Google Calendar" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      eventId,
      message: appointment.google_calendar_event_id ? "Event updated" : "Event created",
    });
  } catch (err) {
    logger.error("[google-calendar/push]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to push to calendar" },
      { status: 500 }
    );
  }
});

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const totalMinutes = h * 60 + m + minutes;
  const newHours = Math.floor(totalMinutes / 60) % 24;
  const newMinutes = totalMinutes % 60;
  return `${String(newHours).padStart(2, "0")}:${String(newMinutes).padStart(2, "0")}`;
}
