"use server";

/**
 * W6-CRIT-06: scheduled_reports were previously written from the client
 * directly against Supabase. RLS scoped them to the tenant but did NOT
 * restrict by role — any staff member who could reach the page (or POST
 * from Postman with their session) could create/edit/delete scheduled
 * report distributions. Because these reports carry revenue/P&L/PII to
 * caller-supplied email addresses, wiring here is a direct data-exfil
 * vector ("schedule a daily revenue.csv to my personal gmail").
 *
 * Remediation: move all writes behind server actions gated on `owner`.
 * Reads stay on the client for latency (RLS still enforces tenant scope).
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit";
import { requireRole } from "@/lib/auth-context";

export interface ScheduledReportInput {
  name: string;
  report_type: string;
  schedule_type: string;
  schedule_day: number | null;
  schedule_time: string | null;
  recipients: string[];
  include_csv: boolean;
  include_pdf: boolean;
  next_run_at: string;
}

export async function createScheduledReport(
  data: ScheduledReportInput
): Promise<{ success?: boolean; error?: string; id?: string }> {
  let ctx;
  try {
    ctx = await requireRole("owner");
  } catch {
    return { error: "Only the account owner can create scheduled reports." };
  }

  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("scheduled_reports")
    .insert({
      tenant_id: ctx.tenantId,
      name: data.name,
      report_type: data.report_type,
      schedule_type: data.schedule_type,
      schedule_day: data.schedule_day,
      schedule_time: data.schedule_time,
      recipients: data.recipients,
      include_csv: data.include_csv,
      include_pdf: data.include_pdf,
      next_run_at: data.next_run_at,
      is_active: true,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await logAuditEvent({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: "settings_update",
    entityType: "settings",
    entityId: row.id,
    newData: { name: data.name, report_type: data.report_type, recipients: data.recipients },
  });

  revalidatePath("/settings/reports");
  return { success: true, id: row.id };
}

export async function updateScheduledReport(
  id: string,
  data: ScheduledReportInput
): Promise<{ success?: boolean; error?: string }> {
  let ctx;
  try {
    ctx = await requireRole("owner");
  } catch {
    return { error: "Only the account owner can update scheduled reports." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("scheduled_reports")
    .update({
      name: data.name,
      report_type: data.report_type,
      schedule_type: data.schedule_type,
      schedule_day: data.schedule_day,
      schedule_time: data.schedule_time,
      recipients: data.recipients,
      include_csv: data.include_csv,
      include_pdf: data.include_pdf,
      next_run_at: data.next_run_at,
    })
    .eq("id", id)
    .eq("tenant_id", ctx.tenantId);

  if (error) return { error: error.message };

  await logAuditEvent({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: "settings_update",
    entityType: "settings",
    entityId: id,
    newData: { name: data.name, recipients: data.recipients },
  });

  revalidatePath("/settings/reports");
  return { success: true };
}

export async function toggleScheduledReportActive(
  id: string,
  isActive: boolean
): Promise<{ success?: boolean; error?: string }> {
  let ctx;
  try {
    ctx = await requireRole("owner");
  } catch {
    return { error: "Only the account owner can pause or resume scheduled reports." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("scheduled_reports")
    .update({ is_active: isActive })
    .eq("id", id)
    .eq("tenant_id", ctx.tenantId);

  if (error) return { error: error.message };

  revalidatePath("/settings/reports");
  return { success: true };
}

export async function deleteScheduledReport(
  id: string
): Promise<{ success?: boolean; error?: string }> {
  let ctx;
  try {
    ctx = await requireRole("owner");
  } catch {
    return { error: "Only the account owner can delete scheduled reports." };
  }

  const admin = createAdminClient();

  const { data: old } = await admin
    .from("scheduled_reports")
    .select("name, recipients")
    .eq("id", id)
    .eq("tenant_id", ctx.tenantId)
    .single();

  const { error } = await admin
    .from("scheduled_reports")
    .delete()
    .eq("id", id)
    .eq("tenant_id", ctx.tenantId);

  if (error) return { error: error.message };

  await logAuditEvent({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: "settings_update",
    entityType: "settings",
    entityId: id,
    oldData: old || undefined,
  });

  revalidatePath("/settings/reports");
  return { success: true };
}
