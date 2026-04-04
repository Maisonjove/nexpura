import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import logger from "@/lib/logger";

/**
 * GDPR Data Deletion Request API
 * 
 * Submits a request to delete all tenant data.
 * This is a soft-delete that schedules deletion after 30 days.
 * During the 30-day window, the request can be cancelled.
 */
export async function POST(request: NextRequest) {
  // Auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get user's tenant
  const admin = createAdminClient();
  const { data: userData } = await admin
    .from("users")
    .select("tenant_id, role")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) {
    return NextResponse.json({ error: "No tenant found" }, { status: 403 });
  }

  // Only owners can request deletion
  if (userData.role !== "owner" && userData.role !== "admin") {
    return NextResponse.json({ error: "Only account owners can request data deletion" }, { status: 403 });
  }

  // Rate limiting
  const { success } = await checkRateLimit(`data-delete:${userData.tenant_id}`, "heavy");
  if (!success) {
    return NextResponse.json({ error: "Please wait before making another request" }, { status: 429 });
  }

  const tenantId = userData.tenant_id;
  const body = await request.json().catch(() => ({}));
  const { confirm, cancel } = body;

  try {
    // Get current tenant status
    const { data: tenant } = await admin
      .from("tenants")
      .select("id, name, deletion_requested_at, deletion_scheduled_for")
      .eq("id", tenantId)
      .single();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Cancel deletion request
    if (cancel === true) {
      if (!tenant.deletion_requested_at) {
        return NextResponse.json({ error: "No deletion request to cancel" }, { status: 400 });
      }

      await admin
        .from("tenants")
        .update({
          deletion_requested_at: null,
          deletion_scheduled_for: null,
        })
        .eq("id", tenantId);

      logger.info(`[data-delete] Deletion cancelled for tenant ${tenantId}`);

      return NextResponse.json({
        status: "cancelled",
        message: "Data deletion request has been cancelled",
      });
    }

    // Request deletion
    if (confirm !== "DELETE MY DATA") {
      return NextResponse.json({
        error: "Please confirm by sending { confirm: 'DELETE MY DATA' }",
        current_status: tenant.deletion_requested_at 
          ? {
              requested_at: tenant.deletion_requested_at,
              scheduled_for: tenant.deletion_scheduled_for,
              can_cancel: true,
            }
          : null,
      }, { status: 400 });
    }

    // Check if already requested
    if (tenant.deletion_requested_at) {
      return NextResponse.json({
        status: "already_requested",
        message: "Deletion already requested",
        requested_at: tenant.deletion_requested_at,
        scheduled_for: tenant.deletion_scheduled_for,
        can_cancel: true,
      });
    }

    // Schedule deletion for 30 days from now
    const now = new Date();
    const scheduledFor = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    await admin
      .from("tenants")
      .update({
        deletion_requested_at: now.toISOString(),
        deletion_scheduled_for: scheduledFor.toISOString(),
      })
      .eq("id", tenantId);

    logger.warn(`[data-delete] Deletion requested for tenant ${tenantId}, scheduled for ${scheduledFor.toISOString()}`);

    return NextResponse.json({
      status: "scheduled",
      message: "Data deletion scheduled",
      requested_at: now.toISOString(),
      scheduled_for: scheduledFor.toISOString(),
      days_until_deletion: 30,
      can_cancel: true,
      cancel_instructions: "Send POST with { cancel: true } to cancel",
    });
  } catch (error) {
    logger.error("[data-delete] Request failed:", error);
    return NextResponse.json({ error: "Request failed" }, { status: 500 });
  }
}

/**
 * Get deletion status
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: userData } = await admin
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) {
    return NextResponse.json({ error: "No tenant found" }, { status: 403 });
  }

  const { data: tenant } = await admin
    .from("tenants")
    .select("deletion_requested_at, deletion_scheduled_for")
    .eq("id", userData.tenant_id)
    .single();

  if (!tenant?.deletion_requested_at) {
    return NextResponse.json({ status: "active", deletion_requested: false });
  }

  const scheduledDate = new Date(tenant.deletion_scheduled_for);
  const daysRemaining = Math.ceil((scheduledDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000));

  return NextResponse.json({
    status: "pending_deletion",
    deletion_requested: true,
    requested_at: tenant.deletion_requested_at,
    scheduled_for: tenant.deletion_scheduled_for,
    days_remaining: daysRemaining,
    can_cancel: daysRemaining > 0,
  });
}
