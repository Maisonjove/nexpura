"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit";

/**
 * Reminder action server actions — Group 14 audit.
 *
 * /reminders aggregates from multiple source tables and has no first-
 * class reminder record. Snooze/dismiss/complete state lives in the
 * new reminder_dismissals table keyed by reminder_key (e.g.
 * "task:<id>", "repair:<id>", "customer_birthday:<customer_id>").
 *
 * The /reminders page filters its aggregated list against this table
 * — keys with dismissed_at set OR snoozed_until > now() are hidden.
 */

interface ActionResult { success?: boolean; error?: string }

async function ctx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const admin = createAdminClient();
  const { data: userData } = await admin
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  if (!userData?.tenant_id) throw new Error("No tenant found");
  return { admin, userId: user.id, tenantId: userData.tenant_id as string };
}

export async function snoozeReminder(reminderKey: string, days: number): Promise<ActionResult> {
  let c;
  try { c = await ctx(); } catch (e) { return { error: e instanceof Error ? e.message : "Auth failed" }; }
  if (!reminderKey) return { error: "reminderKey required" };
  const validDays = Math.max(1, Math.min(90, Math.floor(days)));
  const snoozedUntil = new Date(Date.now() + validDays * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await c.admin
    .from("reminder_dismissals")
    .upsert({
      tenant_id: c.tenantId,
      user_id: c.userId,
      reminder_key: reminderKey,
      action: "snooze",
      snoozed_until: snoozedUntil,
      dismissed_at: null,
    }, { onConflict: "user_id,reminder_key" });
  if (error) return { error: error.message };

  revalidatePath("/reminders");
  return { success: true };
}

export async function dismissReminder(reminderKey: string): Promise<ActionResult> {
  let c;
  try { c = await ctx(); } catch (e) { return { error: e instanceof Error ? e.message : "Auth failed" }; }
  if (!reminderKey) return { error: "reminderKey required" };

  const { error } = await c.admin
    .from("reminder_dismissals")
    .upsert({
      tenant_id: c.tenantId,
      user_id: c.userId,
      reminder_key: reminderKey,
      action: "dismiss",
      snoozed_until: null,
      dismissed_at: new Date().toISOString(),
    }, { onConflict: "user_id,reminder_key" });
  if (error) return { error: error.message };

  // Audit the dismissal so a manager can see who silenced what.
  await logAuditEvent({
    tenantId: c.tenantId,
    userId: c.userId,
    action: "settings_update",
    entityType: "settings",
    entityId: reminderKey,
    newData: { kind: "reminder_dismiss", reminder_key: reminderKey },
  });

  revalidatePath("/reminders");
  return { success: true };
}

/**
 * Complete: shortcut to mark the underlying entity complete without
 * navigating away from /reminders. Currently supports task reminders
 * (key shape "task:<uuid>") — flips tasks.status to 'completed'.
 * Other reminder types route to source page via the existing link;
 * Joey's spec calls out task as the canonical case.
 */
export async function completeReminder(reminderKey: string): Promise<ActionResult> {
  let c;
  try { c = await ctx(); } catch (e) { return { error: e instanceof Error ? e.message : "Auth failed" }; }
  if (!reminderKey) return { error: "reminderKey required" };

  const [type, id] = reminderKey.split(":");
  if (type === "task" && id) {
    const { error } = await c.admin
      .from("tasks")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("tenant_id", c.tenantId);
    if (error) return { error: error.message };
    revalidatePath("/reminders");
    revalidatePath("/tasks");
    return { success: true };
  }
  return { error: `complete is only supported for task reminders (got '${type}'). Use the source page for other types.` };
}
