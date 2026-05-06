"use server";

/**
 * Manager PIN — set / verify / reset (owner-only) server actions.
 *
 * A1 Day 2 (2026-05-06): per-team_member PIN required for refunds
 * beyond the 30-day window or without an original sale.
 *
 * Three actions:
 *   - setManagerPin(pin)              — current user sets/changes own PIN
 *   - verifyManagerPin(pin)           — current user verifies own PIN
 *                                       (used by refund modal pre-call)
 *   - resetManagerPinForMember(id)    — owner-only; clears another
 *                                       member's PIN, audit-logged
 *
 * Permission posture:
 *   - setManagerPin: any authenticated team_member can set THEIR OWN
 *     PIN. No higher gate; the user already has tenant membership.
 *   - verifyManagerPin: same — verifies the calling user's own PIN.
 *   - resetManagerPinForMember: gated on requireRole("owner"). The
 *     reset clears the PIN; the affected member must self-set on
 *     next refund-needing-override (no recovery via owner).
 *
 * Rate limiting: verifyManagerPin is wrapped in a per-user
 * checkRateLimit(`manager-pin:${userId}`, "auth") to defeat online
 * brute-force. Set/reset are not rate-limited (they're not
 * brute-force surfaces).
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth, requireRole } from "@/lib/auth-context";
import { hashManagerPin, verifyManagerPin as verifyHash, isValidPinFormat } from "@/lib/manager-pin";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAuditEvent } from "@/lib/audit";
import logger from "@/lib/logger";
import { flushSentry } from "@/lib/sentry-flush";

export async function setManagerPin(
  pin: string,
): Promise<{ success?: boolean; error?: string }> {
  let ctx;
  try { ctx = await requireAuth(); }
  catch { return { error: "Not authenticated" }; }

  if (!isValidPinFormat(pin)) {
    return { error: "PIN must be 4–6 digits, numeric only." };
  }

  // Block trivially weak PINs. Not a security boundary — entropy
  // is intentionally low — but rejects "0000" / "1234" / "111111"
  // type values which are the first thing an attacker tries.
  const TRIVIAL = new Set([
    "0000", "1111", "2222", "3333", "4444", "5555",
    "6666", "7777", "8888", "9999",
    "1234", "12345", "123456",
    "0123", "01234", "012345",
    "9876", "98765", "987654",
  ]);
  if (TRIVIAL.has(pin)) {
    return {
      error:
        "PIN is too easy to guess. Pick one that isn't a sequential or repeated digit pattern.",
    };
  }

  const admin = createAdminClient();
  try {
    const hash = await hashManagerPin(pin);
    const { error } = await admin
      .from("team_members")
      .update({
        manager_pin_hash: hash,
        manager_pin_set_at: new Date().toISOString(),
      })
      .eq("user_id", ctx.userId)
      .eq("tenant_id", ctx.tenantId);
    if (error) {
      logger.error("[setManagerPin] update failed", { error, userId: ctx.userId });
      await flushSentry();
      return { error: "Failed to save PIN. Please retry." };
    }

    // Audit log — record the SET event but never the PIN itself.
    await logAuditEvent({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: "manager_pin_set",
      entityType: "team_member",
      entityId: ctx.userId,
      newData: { manager_pin_set: true },
    });

    return { success: true };
  } catch (err) {
    logger.error("[setManagerPin] unexpected error", { err });
    await flushSentry();
    return { error: "Failed to save PIN. Please retry." };
  }
}

export async function verifyManagerPin(
  pin: string,
): Promise<{ valid?: boolean; error?: string }> {
  let ctx;
  try { ctx = await requireAuth(); }
  catch { return { error: "Not authenticated" }; }

  // Per-user rate limit. Defeats online brute-force on the 10000-key
  // 4-digit PIN space; an attacker who hits the rate limit can't
  // make more than ~5 attempts/minute regardless of PIN choice.
  const { success: rlOk } = await checkRateLimit(
    `manager-pin:${ctx.userId}`,
    "auth",
  );
  if (!rlOk) {
    return { error: "Too many PIN attempts. Please wait a minute and retry." };
  }

  if (!isValidPinFormat(pin)) {
    // Same generic-ish error as a wrong PIN — don't tell the
    // attacker their input shape is the problem (limits enumeration
    // of valid PIN lengths).
    return { valid: false };
  }

  const admin = createAdminClient();
  const { data: member } = await admin
    .from("team_members")
    .select("manager_pin_hash")
    .eq("user_id", ctx.userId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();

  if (!member?.manager_pin_hash) {
    return { error: "No manager PIN configured. Set one in Settings → Profile." };
  }

  const ok = await verifyHash(pin, member.manager_pin_hash);
  return { valid: ok };
}

export async function resetManagerPinForMember(
  memberId: string,
): Promise<{ success?: boolean; error?: string }> {
  // Owner-only. Privilege escalation surface: anyone who can reset
  // another team_member's PIN can effectively bypass the 30-day
  // window guard for that member by getting them to re-set.
  try { await requireRole("owner"); }
  catch (err) {
    const msg = err instanceof Error ? err.message : "permission_denied";
    return {
      error: msg.startsWith("permission_denied")
        ? "Only the tenant owner can reset another member's PIN."
        : "Not authenticated",
    };
  }

  let ctx;
  try { ctx = await requireAuth(); }
  catch { return { error: "Not authenticated" }; }

  const admin = createAdminClient();
  // Capture old state for audit (PIN was set or not, when).
  const { data: oldMember } = await admin
    .from("team_members")
    .select("name, email, manager_pin_set_at")
    .eq("id", memberId)
    .eq("tenant_id", ctx.tenantId)
    .single();

  const { error } = await admin
    .from("team_members")
    .update({
      manager_pin_hash: null,
      manager_pin_set_at: null,
    })
    .eq("id", memberId)
    .eq("tenant_id", ctx.tenantId);
  if (error) {
    logger.error("[resetManagerPinForMember] update failed", {
      error,
      memberId,
      tenantId: ctx.tenantId,
    });
    await flushSentry();
    return { error: "Failed to reset PIN. Please retry." };
  }

  await logAuditEvent({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: "manager_pin_reset",
    entityType: "team_member",
    entityId: memberId,
    oldData: oldMember
      ? {
          had_pin: oldMember.manager_pin_set_at != null,
          pin_set_at: oldMember.manager_pin_set_at,
          name: oldMember.name,
          email: oldMember.email,
        }
      : undefined,
    newData: { had_pin: false },
  });

  return { success: true };
}
