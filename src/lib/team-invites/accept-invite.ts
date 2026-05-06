import type { SupabaseClient } from "@supabase/supabase-js";
import logger from "@/lib/logger";

/**
 * Shared invite-acceptance helper (Phase A follow-up, 2026-05-06).
 *
 * Single source of truth for the two invite-acceptance code paths:
 *   1. /api/invite/accept route — POST'd by the InviteClient form.
 *   2. /invite/[token] page-level server gate — fires when the
 *      visitor already has a confirmed session whose email matches
 *      the invite (Bug D recovery flow).
 *
 * Why centralise: prior to this PR the route did the upsert+update
 * inline, and the recovery flow (Bug D) relied on a client-side
 * useEffect inside InviteClient that proved unreliable in production.
 * Extracting the mutation lets both paths share identical role-mapping
 * (technician → users.role='staff'), identical token-clear logic,
 * identical error handling. Path identity is recorded in
 * audit_logs.metadata.accepted_via for forensic separability.
 *
 * The helper does NOT do auth / email-binding / expiry / rate-limit
 * checks. Those are caller-side because the two paths have different
 * security envelopes:
 *   - API route: rate-limit by IP, schema-validates body, hash-then-
 *     plaintext token lookup, email binding against session user.
 *   - Server gate: email binding done in the page predicate (the gate
 *     never fires unless email_confirmed_at AND email match), no
 *     rate-limit (already authenticated, navigation cost is the bound).
 *
 * Caller responsibility:
 *   - Validate the invite row is yours to accept (auth/email/expiry).
 *   - Pass `acceptedVia: 'api_route' | 'server_gate'` so audit emit
 *     can disambiguate paths in post-incident forensics.
 *
 * Helper responsibility:
 *   - users upsert with role-mapping (technician → staff).
 *   - team_members update: invite_accepted=true, clear both tokens.
 *   - Surface errors as `{ error, status }` for the caller's transport.
 */

export interface InviteRow {
  id: string;
  tenant_id: string;
  name: string | null;
  email: string | null;
  role: string | null;
}

export type AcceptedVia = "api_route" | "server_gate";

export type AcceptInviteResult =
  | { success: true }
  | { error: string; status: number };

/**
 * Apply the invite acceptance: write `users` + `team_members` rows.
 *
 * Pre-conditions enforced by caller:
 *   - `invite` is the row you intend to accept.
 *   - `invite.invite_accepted` is false.
 *   - `userId` is the authenticated session user.
 *   - The session user's email matches `invite.email` (case-insensitive).
 *   - `invite.invite_expires_at` is null or in the future.
 *
 * Side effects:
 *   - users.upsert({ id: userId, tenant_id, role, full_name, email })
 *     onConflict: "id" — idempotent for retries.
 *   - team_members.update({ user_id, invite_accepted=true,
 *     invite_token=null, invite_token_hash=null }) where id=invite.id.
 *
 * Role mapping (preserved from PR #208 Q5):
 *   The users.role CHECK constraint allows ['owner','manager','staff'].
 *   team_members.role=='technician' is a job-designation tier, not a
 *   permissions tier. Map technician → staff at the users layer; leave
 *   team_members.role intact for filtering (e.g. RepairsKanban
 *   "Assigned Technician").
 */
export async function acceptInvite(
  admin: SupabaseClient,
  invite: InviteRow,
  userId: string,
  // The 'acceptedVia' parameter is used by callers to record path
  // distinction in audit_logs.metadata. The helper itself does not
  // emit; callers are responsible for audit emission (api_route via
  // withAuditLog wrapper; server_gate via direct admin insert).
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _acceptedVia: AcceptedVia,
): Promise<AcceptInviteResult> {
  const mappedRole = invite.role === "technician" ? "staff" : invite.role;

  const { error: userError } = await admin
    .from("users")
    .upsert(
      {
        id: userId,
        tenant_id: invite.tenant_id,
        role: mappedRole,
        full_name: invite.name,
        email: invite.email,
      },
      { onConflict: "id" },
    );

  if (userError) {
    logger.error("[accept-invite] users upsert failed", {
      inviteId: invite.id,
      userId,
      err: userError,
    });
    return { error: "Failed to link user to tenant", status: 500 };
  }

  const { error: updateError } = await admin
    .from("team_members")
    .update({
      user_id: userId,
      invite_accepted: true,
      invite_token: null,
      invite_token_hash: null,
    })
    .eq("id", invite.id);

  if (updateError) {
    logger.error("[accept-invite] team_members update failed", {
      inviteId: invite.id,
      userId,
      err: updateError,
    });
    return { error: "Failed to accept invitation", status: 500 };
  }

  return { success: true };
}
