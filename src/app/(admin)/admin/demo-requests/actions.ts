"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAllowlistedAdmin } from "@/lib/admin-allowlist";
import { resend } from "@/lib/email/resend";
import logger from "@/lib/logger";

/**
 * /admin/demo-requests server actions.
 *
 * Auth gate mirrors src/app/(admin)/actions.ts: must be allowlisted
 * email AND row in super_admins. The (admin) layout already redirects
 * non-admins so a malicious caller would have to forge the action POST
 * directly — assertSuperAdmin() is the belt for those suspenders.
 *
 * Audit log: every state transition writes to admin_audit_logs with
 * `demo_request_id`, action, and metadata. Zoom URL is stored on the
 * row (zoom_link) but NOT echoed into the audit metadata — keep
 * meeting URLs out of the audit trail since admin_audit_logs is
 * platform-wide and the URL is sensitive (anyone with the link joins).
 */

const FROM_ADDR = process.env.RESEND_FROM_EMAIL || "support@nexpura.com";
const FROM = `Nexpura <${FROM_ADDR}>`;

async function assertSuperAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");
  if (!isAllowlistedAdmin(user.email)) throw new Error("Unauthorized");
  const adminClient = createAdminClient();
  const { data } = await adminClient
    .from("super_admins")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!data) throw new Error("Unauthorized");
  return { adminClient, adminUserId: user.id, adminEmail: user.email ?? "" };
}

async function logAudit(
  adminClient: ReturnType<typeof createAdminClient>,
  adminUserId: string,
  action: string,
  metadata: Record<string, unknown>,
) {
  try {
    await adminClient.from("admin_audit_logs").insert({
      admin_user_id: adminUserId,
      action,
      metadata,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    logger.error("[admin/demo-requests] audit log failed", { err, action });
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isAllowedZoomUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    return host === "zoom.us" || host.endsWith(".zoom.us") || host === "zoom.com" || host.endsWith(".zoom.com");
  } catch {
    return false;
  }
}

function formatScheduledHuman(iso: string): string {
  return new Date(iso).toLocaleString("en-AU", {
    timeZone: "Australia/Sydney",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }) + " (Sydney)";
}

function buildIcs(opts: {
  uid: string;
  startUtcIso: string;
  durationMin: number;
  summary: string;
  description: string;
  url: string;
}): string {
  const dt = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "").replace(/Z$/, "Z");
  const start = dt(new Date(opts.startUtcIso).toISOString());
  const end = dt(new Date(new Date(opts.startUtcIso).getTime() + opts.durationMin * 60_000).toISOString());
  const escapeIcs = (s: string) => s.replace(/[\\;,]/g, (m) => `\\${m}`).replace(/\r?\n/g, "\\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Nexpura//Demo//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${opts.uid}`,
    `DTSTAMP:${dt(new Date().toISOString())}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeIcs(opts.summary)}`,
    `DESCRIPTION:${escapeIcs(opts.description)}`,
    `URL:${opts.url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

interface DemoRequestRow {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string;
  business_name: string | null;
  status: string;
}

async function loadRequest(
  adminClient: ReturnType<typeof createAdminClient>,
  id: string,
): Promise<DemoRequestRow> {
  const { data, error } = await adminClient
    .from("demo_requests")
    .select("id, first_name, last_name, email, business_name, status")
    .eq("id", id)
    .single();
  if (error || !data) throw new Error("Demo request not found");
  return data as DemoRequestRow;
}

// ─────────────────────────────────────────────────────────────────────────
// Schedule. Validates Zoom URL + datetime → status 'scheduled', sends
// email with .ics attachment, logs audit entry.
// ─────────────────────────────────────────────────────────────────────────
export async function scheduleDemoRequest(
  id: string,
  scheduledAtIso: string,
  zoomLink: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  let ctx: Awaited<ReturnType<typeof assertSuperAdmin>>;
  try {
    ctx = await assertSuperAdmin();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  const { adminClient, adminUserId } = ctx;

  if (!zoomLink || !isAllowedZoomUrl(zoomLink)) {
    return { ok: false, error: "Zoom URL must be an https link on zoom.us or zoom.com" };
  }
  const scheduledDate = new Date(scheduledAtIso);
  if (isNaN(scheduledDate.getTime())) {
    return { ok: false, error: "Invalid scheduled date" };
  }
  if (scheduledDate.getTime() < Date.now() - 60_000) {
    return { ok: false, error: "Scheduled time must be in the future" };
  }

  const req = await loadRequest(adminClient, id);

  const { error: updErr } = await adminClient
    .from("demo_requests")
    .update({
      status: "scheduled",
      scheduled_at: scheduledDate.toISOString(),
      zoom_link: zoomLink,
    })
    .eq("id", id);
  if (updErr) {
    logger.error("[admin/demo-requests] schedule update failed", { id, err: updErr });
    return { ok: false, error: "Database update failed" };
  }

  const fullName = [req.first_name, req.last_name].filter(Boolean).join(" ");
  const human = formatScheduledHuman(scheduledDate.toISOString());
  const ics = buildIcs({
    uid: `demo-${id}@nexpura.com`,
    startUtcIso: scheduledDate.toISOString(),
    durationMin: 30,
    summary: "Nexpura demo",
    description: `Join via Zoom: ${zoomLink}`,
    url: zoomLink,
  });

  const html = `
    <p>Hi ${escapeHtml(req.first_name)},</p>
    <p>Your Nexpura demo is confirmed for <strong>${escapeHtml(human)}</strong>.</p>
    <p><a href="${escapeHtml(zoomLink)}">Join the Zoom call →</a></p>
    <p>The calendar invite is attached. If the time no longer works, just reply to this email and we'll find another slot.</p>
    <p>— Nexpura</p>
  `;

  try {
    const r = await resend.emails.send({
      from: FROM,
      to: req.email,
      replyTo: "hello@nexpura.com",
      subject: `Your Nexpura demo — ${human}`,
      html,
      attachments: [
        {
          filename: "nexpura-demo.ics",
          content: Buffer.from(ics, "utf8").toString("base64"),
        },
      ],
    });
    if (r.error) {
      logger.error("[admin/demo-requests] schedule email failed", { id, err: r.error });
    }
  } catch (err) {
    logger.error("[admin/demo-requests] schedule email threw", { id, err });
  }

  await logAudit(adminClient, adminUserId, "demo_request.scheduled", {
    demo_request_id: id,
    email: req.email,
    business_name: req.business_name,
    full_name: fullName,
    scheduled_at: scheduledDate.toISOString(),
    // zoom_link intentionally omitted — see file header comment.
  });

  revalidatePath("/admin/demo-requests");
  revalidatePath(`/admin/demo-requests/${id}`);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────
// Complete. Marks the request 'completed' and logs. No email — the
// demo already happened.
// ─────────────────────────────────────────────────────────────────────────
export async function completeDemoRequest(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  let ctx: Awaited<ReturnType<typeof assertSuperAdmin>>;
  try {
    ctx = await assertSuperAdmin();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  const { adminClient, adminUserId } = ctx;

  const req = await loadRequest(adminClient, id);

  const { error: updErr } = await adminClient
    .from("demo_requests")
    .update({ status: "completed" })
    .eq("id", id);
  if (updErr) {
    logger.error("[admin/demo-requests] complete update failed", { id, err: updErr });
    return { ok: false, error: "Database update failed" };
  }

  await logAudit(adminClient, adminUserId, "demo_request.completed", {
    demo_request_id: id,
    email: req.email,
    business_name: req.business_name,
  });

  revalidatePath("/admin/demo-requests");
  revalidatePath(`/admin/demo-requests/${id}`);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────
// Decline. Optional reason → free text, status 'declined', send email,
// audit log.
// ─────────────────────────────────────────────────────────────────────────
export async function declineDemoRequest(
  id: string,
  reason: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  let ctx: Awaited<ReturnType<typeof assertSuperAdmin>>;
  try {
    ctx = await assertSuperAdmin();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  const { adminClient, adminUserId } = ctx;

  const trimmedReason = (reason || "").trim().slice(0, 1000);

  const req = await loadRequest(adminClient, id);

  const { error: updErr } = await adminClient
    .from("demo_requests")
    .update({
      status: "declined",
      decline_reason: trimmedReason || null,
    })
    .eq("id", id);
  if (updErr) {
    logger.error("[admin/demo-requests] decline update failed", { id, err: updErr });
    return { ok: false, error: "Database update failed" };
  }

  const html = `
    <p>Hi ${escapeHtml(req.first_name)},</p>
    <p>Thanks for your interest in Nexpura. Unfortunately we won't be able to schedule a demo at this time${
      trimmedReason ? ` — ${escapeHtml(trimmedReason)}` : ""
    }.</p>
    <p>If anything changes our way please feel free to reach out at <a href="mailto:hello@nexpura.com">hello@nexpura.com</a>.</p>
    <p>— Nexpura</p>
  `;

  try {
    const r = await resend.emails.send({
      from: FROM,
      to: req.email,
      replyTo: "hello@nexpura.com",
      subject: "About your Nexpura demo request",
      html,
    });
    if (r.error) {
      logger.error("[admin/demo-requests] decline email failed", { id, err: r.error });
    }
  } catch (err) {
    logger.error("[admin/demo-requests] decline email threw", { id, err });
  }

  await logAudit(adminClient, adminUserId, "demo_request.declined", {
    demo_request_id: id,
    email: req.email,
    business_name: req.business_name,
    reason: trimmedReason || null,
  });

  revalidatePath("/admin/demo-requests");
  revalidatePath(`/admin/demo-requests/${id}`);
  return { ok: true };
}
