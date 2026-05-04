/**
 * PUT /api/settings/notifications
 * 
 * Update tenant notification settings
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import logger from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { withSentryFlush } from "@/lib/sentry-flush";

export const PUT = withSentryFlush(async (req: NextRequest) => {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit keyed by user id, not IP — the IP bucket fell into "anonymous"
    // when x-forwarded-for was missing, which meant every click from every
    // user in the world shared one 100/min slot.
    const { success } = await checkRateLimit(user.id, "api");
    if (!success) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    // Get user's tenant
    const admin = createAdminClient();
    const { data: userData } = await admin
      .from("users")
      .select("tenant_id, role")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) {
      return NextResponse.json({ error: "No tenant" }, { status: 400 });
    }

    // Only owners/managers can change settings
    if (!["owner", "manager"].includes(userData.role)) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    const body = await req.json();
    const { notification_settings } = body;

    if (!notification_settings) {
      return NextResponse.json({ error: "Missing notification_settings" }, { status: 400 });
    }

    // Update tenant settings
    const { error } = await admin
      .from("tenants")
      .update({ notification_settings })
      .eq("id", userData.tenant_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("[settings/notifications PUT]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
});
