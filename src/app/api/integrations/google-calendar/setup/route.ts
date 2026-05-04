/**
 * GET /api/integrations/google-calendar/setup
 * Returns current Google Calendar config (without tokens).
 * 
 * DELETE /api/integrations/google-calendar/setup
 * Disconnects Google Calendar integration.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, getIntegration } from "@/lib/integrations";
import { createAdminClient } from "@/lib/supabase/admin";
import logger from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { withSentryFlush } from "@/lib/sentry-flush";

export const GET = withSentryFlush(async (_req: NextRequest) => {
  const ip = _req.headers.get("x-forwarded-for") ?? "anonymous";
  const { success } = await checkRateLimit(ip, "api");
  if (!success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const { tenantId } = await getAuthContext();
    const integration = await getIntegration(tenantId, "google_calendar");

    if (!integration) {
      return NextResponse.json({ connected: false });
    }

    const cfg = integration.config as Record<string, unknown>;
    return NextResponse.json({
      connected: integration.status === "connected",
      calendar_id: cfg.calendar_id ?? null,
      calendar_email: cfg.calendar_email ?? null,
      has_token: !!cfg.access_token,
      status: integration.status,
      last_sync_at: integration.last_sync_at,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
});

export const DELETE = withSentryFlush(async (_req: NextRequest) => {
  const ip = _req.headers.get("x-forwarded-for") ?? "anonymous";
  const { success } = await checkRateLimit(ip, "api");
  if (!success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const { tenantId } = await getAuthContext();
    const admin = createAdminClient();
    
    // Delete the integration
    const { error } = await admin
      .from("integrations")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("type", "google_calendar");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Clear google_calendar_event_id from appointments and jobs
    // Kind C (best-effort observability log+continue). The integration
    // row was already deleted above — the user's calendar is now
    // disconnected. These two clears are cleanup of stale event_id
    // pointers; if either fails the next reconnect+push will create
    // duplicate events because old IDs still match. Log loudly so ops
    // can run a manual sweep, but don't 500 the disconnect itself.
    const { error: aptClearErr } = await admin
      .from("appointments")
      .update({ google_calendar_event_id: null })
      .eq("tenant_id", tenantId);
    if (aptClearErr) {
      logger.error("[google-calendar/setup DELETE] appointments event_id clear failed; manual sweep needed before reconnect to avoid duplicate events", {
        tenantId,
        err: aptClearErr,
      });
    }

    // Kind C (best-effort observability log+continue). Same rationale
    // as the appointments clear above.
    const { error: jobsClearErr } = await admin
      .from("jobs")
      .update({ google_calendar_event_id: null })
      .eq("tenant_id", tenantId);
    if (jobsClearErr) {
      logger.error("[google-calendar/setup DELETE] jobs event_id clear failed; manual sweep needed before reconnect to avoid duplicate events", {
        tenantId,
        err: jobsClearErr,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("[google-calendar/setup DELETE]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
});
