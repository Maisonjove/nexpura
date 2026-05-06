import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Pending-invite lookup for a given email address.
 *
 * Why this helper exists (Bug 2 fix, 2026-05-06):
 *
 * The original /onboarding flow was a client component that
 * unconditionally rendered the jeweller-onboarding form. When a
 * manager/staff/technician clicked their email-verification link,
 * the existing post-confirm bounce dropped them on /onboarding —
 * and the form invited them to "set up your jewellery business".
 * If they submitted, an orphan tenant was created instead of the
 * invite being accepted.
 *
 * This helper centralises the gate query so both the page-level
 * server-component shim AND the completeOnboarding server action
 * (belt-and-suspenders) call the same predicate. Returns the
 * pending team_members row when one exists, or null.
 *
 * Pending = `invite_accepted=false`, `invite_token IS NOT NULL`,
 * AND (`invite_expires_at IS NULL OR invite_expires_at > NOW()`).
 * Matches the same semantic the /api/invite/accept route uses for
 * the legacy-row transition window.
 */
export interface PendingInviteRow {
  id: string;
  tenant_id: string;
  invite_token: string;
  invite_expires_at: string | null;
}

export async function pendingInviteForEmail(
  admin: SupabaseClient,
  email: string,
): Promise<PendingInviteRow | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  const { data } = await admin
    .from("team_members")
    .select("id, tenant_id, invite_token, invite_expires_at, invite_accepted")
    .ilike("email", normalized)
    .eq("invite_accepted", false)
    .not("invite_token", "is", null)
    .maybeSingle();

  if (!data) return null;
  const row = data as {
    id: string;
    tenant_id: string;
    invite_token: string | null;
    invite_expires_at: string | null;
    invite_accepted: boolean | null;
  };

  if (!row.invite_token) return null;
  if (row.invite_accepted === true) return null;

  // Expiry filter — IS NULL is allowed (legacy / unset), but a
  // non-null value must be in the future.
  if (row.invite_expires_at) {
    const expiresAt = new Date(row.invite_expires_at).getTime();
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      return null;
    }
  }

  return {
    id: row.id,
    tenant_id: row.tenant_id,
    invite_token: row.invite_token,
    invite_expires_at: row.invite_expires_at,
  };
}
