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

export async function GET(_req: NextRequest) {
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
}

export async function DELETE(_req: NextRequest) {
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
    await admin
      .from("appointments")
      .update({ google_calendar_event_id: null })
      .eq("tenant_id", tenantId);
      
    await admin
      .from("jobs")
      .update({ google_calendar_event_id: null })
      .eq("tenant_id", tenantId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[google-calendar/setup DELETE]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
