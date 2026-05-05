import logger from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Idempotently ensure a `team_members` row exists for the tenant
 * owner / manager.
 *
 * Why this helper exists (C-02 fix, 2026-05-05):
 *
 * The original onboarding flow in `src/app/(auth)/onboarding/actions.ts`
 * inserts: tenant → user (role='owner') → subscription → location →
 * permissions. It NEVER writes a `team_members` row for the owner.
 * Every location-scoped read goes through `getUserLocationIds`, which
 * checked only `team_members` and returned `[]` for the no-row case.
 * Net: the tenant owner saw an empty list on /sales, /repairs, etc.
 *
 * The companion fix in `src/lib/locations.ts` adds a
 * `users.role`-based fallback so existing affected owners (the 10
 * pre-fix signups) and any racy edge cases are handled. This helper
 * closes the upstream side: every NEW signup writes the row directly.
 *
 * Idempotent contract: if a `team_members` row already exists for
 * (tenant_id, user_id), this is a no-op. There is no DB-level unique
 * constraint on (tenant_id, user_id) yet (managers in the invite-
 * pending state share user_id=null), so the helper does a SELECT-
 * then-INSERT rather than an upsert/ON CONFLICT.
 *
 * Returns the row id on insert, or null when a row already existed.
 * Throws on actual insert failure — caller is responsible for the
 * destructive-rollback chain (matches the existing onboarding policy
 * for tenants/users/subscriptions failures).
 */
export async function ensureOwnerTeamMembership(
  admin: SupabaseClient,
  params: {
    tenantId: string;
    userId: string;
    email: string;
    role: "owner" | "manager";
    /**
     * Optional source marker written into the `permissions` jsonb so
     * audit traces can distinguish onboarding writes from the one-shot
     * backfill script. Both pass through `metadata.source`.
     */
    sourceMarker?: string;
  },
): Promise<{ inserted: boolean; rowId: string | null }> {
  const { tenantId, userId, email, role, sourceMarker } = params;

  // Existence check — keeps the function safe to call from anywhere
  // in the onboarding flow without worrying about double-writes.
  const { data: existing } = await admin
    .from("team_members")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing?.id) {
    return { inserted: false, rowId: existing.id };
  }

  const { data: inserted, error } = await admin
    .from("team_members")
    .insert({
      tenant_id: tenantId,
      user_id: userId,
      role,
      // `name` is "Display name shown in the team UI". Onboarding
      // captures business name elsewhere; for the owner row "Owner"
      // is the safe default that matches what the user sees in /
      // settings/team for self.
      name: role === "owner" ? "Owner" : "Manager",
      email,
      // null = all locations (canonical contract — see
      // src/lib/locations.ts:getUserLocationIds).
      allowed_location_ids: null,
      // Pre-existing relationship (this is the tenant owner, not an
      // outstanding invite). invite_token / invite_expires_at stay
      // null so the row never matches an invite-acceptance lookup.
      invite_accepted: true,
      // Audit marker — written into the `permissions` jsonb so the
      // post-deploy verification can grep for it without adding a new
      // column. Cleared by the next legitimate permissions write.
      permissions: sourceMarker
        ? { _provenance: { source: sourceMarker, written_at: new Date().toISOString() } }
        : {},
    })
    .select("id")
    .single();

  if (error || !inserted?.id) {
    logger.error("[owner-team-membership] insert failed", {
      tenantId,
      userId,
      role,
      error,
    });
    throw new Error(
      `ensureOwnerTeamMembership: team_members insert failed: ${error?.message ?? "unknown"}`,
    );
  }

  logger.info("[owner-team-membership] inserted", {
    tenantId,
    userId,
    role,
    rowId: inserted.id,
    sourceMarker: sourceMarker ?? null,
  });

  return { inserted: true, rowId: inserted.id };
}
