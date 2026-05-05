"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";
import { requireAuth, requireRole } from "@/lib/auth-context";

import { flushSentry } from "@/lib/sentry-flush";

/**
 * Audit ID M-08 (desktop-Opus): "Automations test-run mode."
 *
 * This file's previewAutomationMatches export is the "Test run"
 * affordance — a non-destructive query that tells the operator
 * "if this automation fired right now, here's how many customers
 * would receive it" without actually sending any email.
 *
 * Why count-only (instead of send-to-self): the configured cron
 * runners that actually fire these automations don't exist yet
 * (marketing_automations rows are configured but never read by
 * any cron handler in src/app/api/cron). Until a runner lands,
 * showing the matcher count is the most honest "test run": it
 * tells the operator which customers WOULD be picked when a
 * runner is wired up, without faking a send.
 *
 * Supported types in this PR:
 *   - birthday: customers with `birthday` matching today + N
 *     calendar days where N comes from settings.days_before.
 *   - anniversary: customers with `anniversary` matching today +
 *     N days.
 *
 * Other automation types (repair_ready_reminder, win_back, etc.)
 * return { unsupported: true } — the matcher logic for those
 * depends on cross-table joins that should land alongside the
 * runner. UI surfaces "Test run not available yet for this type."
 */
const TEST_RUN_SUPPORTED = new Set(["birthday", "anniversary"]);

export interface AutomationTestRunResult {
  matchedCount?: number;
  unsupported?: boolean;
  reason?: string;
  error?: string;
}
export async function updateAutomation(
  automationType: string,
  data: { enabled?: boolean; settings?: Record<string, unknown>; template_id?: string | null }
) {
  try {
    // W5-CRIT-004: automations fire customer-facing emails on our behalf —
    // toggling them or swapping the template is marketing-admin. Owner/manager.
    await requireRole("owner", "manager");

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    const admin = createAdminClient();
    const { data: userData } = await admin
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) return { error: "Tenant not found" };

    // Check if automation exists, if not create it
    const { data: existing } = await admin
      .from("marketing_automations")
      .select("id")
      .eq("tenant_id", userData.tenant_id)
      .eq("automation_type", automationType)
      .single();

    if (existing) {
      // Update existing
      const { error } = await admin
        .from("marketing_automations")
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (error) return { error: error.message };
    } else {
      // Create new
      const { error } = await admin.from("marketing_automations").insert({
        tenant_id: userData.tenant_id,
        automation_type: automationType,
        enabled: data.enabled ?? false,
        settings: data.settings ?? {},
        template_id: data.template_id ?? null,
      });

      if (error) return { error: error.message };
    }

    revalidatePath("/marketing/automations");
    return { success: true };
  } catch (error) {
    logger.error("updateAutomation failed", { error });
    await flushSentry();
    return { error: "Operation failed" };
  }
}

export async function toggleAutomation(automationType: string, enabled: boolean) {
  try {
    return await updateAutomation(automationType, { enabled });
  } catch (error) {
    logger.error("toggleAutomation failed", { error });
    await flushSentry();
    return { error: "Operation failed" };
  }
}

/**
 * M-08: dry-run preview of an automation. Returns the count of
 * customers that would match the automation's filter today,
 * given the currently-saved settings. Never sends email.
 *
 * Auth: owner/manager (matches updateAutomation gate).
 *
 * Behaviour by type:
 *   birthday: customers whose `birthday` MM-DD matches today + N
 *     calendar days where N = settings.days_before (default 0).
 *   anniversary: customers whose `anniversary` MM-DD matches
 *     today + N days where N = settings.days_before (default 0).
 *   other: { unsupported: true, reason }.
 */
export async function previewAutomationMatches(
  automationType: string,
): Promise<AutomationTestRunResult> {
  try {
    await requireRole("owner", "manager");
  } catch {
    return { error: "Only owner or manager can run automation previews." };
  }

  if (!TEST_RUN_SUPPORTED.has(automationType)) {
    return {
      unsupported: true,
      reason:
        "Test run is not yet available for this automation type. The matcher logic ships alongside the runner.",
    };
  }

  const auth = await requireAuth();
  const admin = createAdminClient();

  // Look up current settings to read days_before. Default 0 (today).
  const { data: automation } = await admin
    .from("marketing_automations")
    .select("settings")
    .eq("tenant_id", auth.tenantId)
    .eq("automation_type", automationType)
    .maybeSingle();

  const settings = (automation?.settings as Record<string, unknown> | null) ?? {};
  const daysBefore = typeof settings.days_before === "number" ? settings.days_before : 0;

  // Compute target MM-DD by adding daysBefore to today (UTC — keeps
  // semantics simple; tenant-tz refinement is a follow-up).
  const target = new Date();
  target.setUTCDate(target.getUTCDate() + daysBefore);
  const mm = String(target.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(target.getUTCDate()).padStart(2, "0");
  const targetMmDd = `${mm}-${dd}`;
  const targetCol = automationType === "birthday" ? "birthday" : "anniversary";

  // Match by extracting MM-DD from the date column. Postgres
  // to_char with 'MM-DD' is locale-stable + index-friendly when an
  // expression index exists; if not, this is still O(N) per tenant
  // which is fine for the tenant-scoped count we need here.
  const { data, error } = await admin
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", auth.tenantId)
    .is("deleted_at", null)
    .filter(targetCol, "not.is", null)
    .gte(targetCol, "1900-01-01")
    .filter(`${targetCol}::text`, "ilike", `%-${targetMmDd}`);

  void data;
  if (error) {
    logger.error("previewAutomationMatches failed", {
      automationType,
      err: error,
    });
    return { error: "Failed to compute match count." };
  }

  // Some PostgREST builds don't expose count on filter; fall back
  // to the response.count field on the result via a second query
  // form when needed. For now, the head-count above returns count
  // via the response shape — supabase-js exposes it on the result
  // object. The upstream caller reads .matchedCount.
  // (We use `as { count?: number | null }` because the head:true
  // count is typed loosely.)
  const headResult = (await admin
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", auth.tenantId)
    .is("deleted_at", null)
    .filter(targetCol, "not.is", null)
    .filter(`${targetCol}::text`, "ilike", `%-${targetMmDd}`)) as unknown as {
    count: number | null;
  };

  return { matchedCount: headResult.count ?? 0 };
}
