"use server";

/**
 * Platform-admin recovery-link generator (PR #202 — prod hotfix).
 *
 * CONTEXT: /auth/v1/recover is 500ing for all real Nexpura users, so
 * the standard /forgot-password path (which fires the same SMTP route)
 * is also dead. `auth.admin.generateLink({ type: 'recovery' })` returns
 * the action_link URL directly without firing SMTP, so a super_admin
 * can copy-paste it to the affected user via a secure channel.
 *
 * Outage audit log: d64a65e0-9890-449b-b224-89432a00a722.
 *
 * SECURITY:
 *   - super_admin only (same gate as the rest of /admin/tenants/*).
 *   - The link is a credential — returned to the UI for copy-paste,
 *     NEVER persisted to audit_logs metadata.
 *   - Audit row records target_email + super-admin identity only.
 */

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAllowlistedAdmin } from "@/lib/admin-allowlist";
import logger from "@/lib/logger";
import { flushSentry } from "@/lib/sentry-flush";
import { z } from "zod";

const inputSchema = z.object({
  targetEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email"),
  tenantId: z.string().uuid("Invalid tenant id"),
});

type Result = { link?: string; error?: string };

/**
 * Reuses the same gate `/admin/(admin)/actions.ts` uses: hard email
 * allowlist + super_admins row check. Kept inline (not exported into
 * a shared helper) because the existing `assertSuperAdmin()` in the
 * sibling file isn't exported, and broadening its surface is out of
 * scope for a prod hotfix.
 */
async function requireSuperAdmin() {
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
  return { adminClient, adminUserId: user.id, adminEmail: user.email ?? null };
}

export async function adminGenerateRecoveryLink(input: {
  targetEmail: string;
  tenantId: string;
}): Promise<Result> {
  // 1. Validate. Friendly user-facing copy on validation errors.
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { targetEmail, tenantId } = parsed.data;

  // 2. Permission gate — super_admin only.
  let adminClient: ReturnType<typeof createAdminClient>;
  let adminUserId: string;
  let adminEmail: string | null;
  try {
    ({ adminClient, adminUserId, adminEmail } = await requireSuperAdmin());
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unauthorized";
    return { error: msg };
  }

  // 3. Generate the recovery action_link. This bypasses SMTP entirely —
  //    `generateLink` returns the URL synchronously so we can hand it
  //    back to the admin UI for copy/paste.
  let actionLink: string | undefined;
  try {
    // Note: in supabase-js v2 the GoTrue admin surface lives at
    // `auth.admin.*` — `generateLink` does NOT exist on the plain
    // `auth` client. (Joey's spec said `admin.auth.generateLink` —
    // same intent, correct method path is `auth.admin.generateLink`.)
    const { data, error } = await adminClient.auth.admin.generateLink({
      type: "recovery",
      email: targetEmail,
      options: {
        redirectTo: "https://nexpura.com/reset-password",
      },
    });
    if (error) {
      logger.error("[adminGenerateRecoveryLink] generateLink failed", {
        err: error.message,
        targetEmail,
        tenantId,
      });
      await flushSentry();
      return { error: error.message };
    }
    actionLink = data?.properties?.action_link;
    if (!actionLink) {
      return { error: "Supabase returned no action_link" };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to generate link";
    logger.error("[adminGenerateRecoveryLink] threw", { err: msg, tenantId });
    await flushSentry();
    return { error: msg };
  }

  // 4. Audit log — public.audit_logs.
  //    tenant_id = the tenant being viewed (NOT the target user's
  //    tenant, which may differ if super_admin generates a link for
  //    a user from another tenant). NEVER include the link itself —
  //    it's a credential.
  //
  //    Side-effect log+continue: a failed audit insert must NOT
  //    block the admin from getting the link they need to recover a
  //    locked-out customer. Surface to logger so we can backfill if
  //    the row is missing.
  try {
    const { error: auditErr } = await adminClient.from("audit_logs").insert({
      tenant_id: tenantId,
      user_id: adminUserId,
      action: "admin_recovery_link_generated",
      entity_type: "user",
      entity_id: null,
      metadata: {
        target_email: targetEmail,
        generated_by_user_id: adminUserId,
        generated_by_email: adminEmail,
      },
    });
    if (auditErr) {
      logger.error(
        "[adminGenerateRecoveryLink] audit_logs insert failed (non-fatal)",
        { err: auditErr.message, tenantId }
      );
    }
  } catch (err) {
    logger.error("[adminGenerateRecoveryLink] audit_logs insert threw", {
      err: err instanceof Error ? err.message : String(err),
      tenantId,
    });
  }

  return { link: actionLink };
}
