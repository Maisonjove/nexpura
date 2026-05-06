import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { checkRateLimit } from "@/lib/rate-limit";
import logger from "@/lib/logger";
import { inviteAcceptSchema } from "@/lib/schemas";
import { withSentryFlush } from "@/lib/sentry-flush";
import { withAuditLog, setAuditContext } from "@/lib/audit-wrapper";
import { acceptInvite } from "@/lib/team-invites/accept-invite";

/**
 * POST /api/invite/accept
 *
 * CRIT-7 hardening:
 *   1. Email binding — the session user's email MUST match invite.email.
 *      Previously any logged-in user who found/guessed the token could
 *      claim the invite.
 *   2. Expiry — invite_expires_at must be in the future. Rejects with
 *      410 Gone otherwise.
 *   3. Hashed compare — new invites store sha256(token) in
 *      invite_token_hash. We hash the inbound token and look up by hash
 *      first, then fall back to plaintext lookup for legacy rows where
 *      invite_token_hash IS NULL (transition window).
 *   4. Post-accept, clear both invite_token AND invite_token_hash so
 *      the link can't be replayed.
 *
 * C-05 canary: this is the first thing a new manager does. The audit
 * wrapper emits action="team_member_invite" on a 200, with entityId =
 * the team_members row. The QA agent's brief calls this the canary —
 * when this stops emitting, the wrapper itself is broken.
 */
function sha256Hex(s: string): string {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

async function handleInviteAccept(request: NextRequest): Promise<NextResponse> {
  try {
    // Rate limit by IP to prevent token brute-forcing
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "anonymous";
    const { success } = await checkRateLimit(`invite-accept:${ip}`);
    if (!success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    // SECURITY: Verify the caller has an active session
    const supabase = await createClient();
    const { data: { user: sessionUser } } = await supabase.auth.getUser();
    if (!sessionUser) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json();
    const parseResult = inviteAcceptSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues }, { status: 400 });
    }
    const { token, userId } = parseResult.data;

    // SECURITY: Verify the userId matches the authenticated session
    if (userId !== sessionUser.id) {
      return NextResponse.json({ error: "User ID mismatch" }, { status: 403 });
    }

    const admin = createAdminClient();

    // CRIT-7: Look the invite up by hashed token first (new rows). Fall
    // back to plaintext lookup for legacy rows where invite_token_hash
    // IS NULL — this is the transition window and is deliberately
    // narrow: one release, then legacy fallback can be removed.
    const tokenHash = sha256Hex(token);

    type InviteRow = {
      id: string;
      tenant_id: string;
      name: string | null;
      email: string | null;
      role: string | null;
      permissions: unknown;
      allowed_location_ids: unknown;
      invite_accepted: boolean | null;
      invite_expires_at: string | null;
      invite_token_hash: string | null;
    };
    let invite: InviteRow | null = null;

    const { data: byHash } = await admin
      .from("team_members")
      .select(
        "id, tenant_id, name, email, role, permissions, allowed_location_ids, invite_accepted, invite_expires_at, invite_token_hash"
      )
      .eq("invite_token_hash", tokenHash)
      .maybeSingle();

    if (byHash) {
      invite = byHash as unknown as InviteRow;
    } else {
      // Legacy fallback: pre-migration rows only carry plaintext
      // invite_token. Only match rows where invite_token_hash IS NULL so
      // a row with a valid hash cannot be matched by plaintext.
      const { data: byPlain } = await admin
        .from("team_members")
        .select(
          "id, tenant_id, name, email, role, permissions, allowed_location_ids, invite_accepted, invite_expires_at, invite_token_hash"
        )
        .eq("invite_token", token)
        .is("invite_token_hash", null)
        .maybeSingle();
      invite = byPlain ? (byPlain as unknown as InviteRow) : null;
    }

    if (!invite) {
      // Bug B (multi-tab race) — idempotent fallback.
      //
      // Symptom pre-fix: User opens the invite link in two tabs. Tab 1
      // accepts successfully (clears invite_token + invite_token_hash).
      // Tab 2 POSTs the same token a moment later — both lookups miss
      // (tokens are now NULL on the row) and Tab 2 receives a 400
      // "Invalid or expired invitation" despite already being a valid
      // member of the tenant.
      //
      // Fallback: if the session user is already a team_member with
      // invite_accepted=true (any tenant), and that row's email matches
      // the session user's email, return 200 idempotent success. The
      // email-match guard preserves the security property — a user
      // can't piggyback on someone else's already-accepted invite by
      // brute-forcing the token.
      const { data: alreadyAccepted } = await admin
        .from("team_members")
        .select("id, tenant_id, email, role")
        .eq("user_id", sessionUser.id)
        .eq("invite_accepted", true)
        .limit(1)
        .maybeSingle();
      if (alreadyAccepted) {
        const acceptedEmail = ((alreadyAccepted as { email?: string | null }).email ?? "")
          .trim()
          .toLowerCase();
        const sessionEmail = (sessionUser.email ?? "").trim().toLowerCase();
        if (sessionEmail && acceptedEmail && sessionEmail === acceptedEmail) {
          // Idempotent success — same shape as a fresh accept (just
          // {success:true}; the audit wrapper does not double-emit
          // because there's no setAuditContext call on this path —
          // there's nothing new to record, the original accept already
          // emitted on Tab 1's request).
          return NextResponse.json({ success: true });
        }
      }
      return NextResponse.json({ error: "Invalid or expired invitation" }, { status: 400 });
    }

    if (invite.invite_accepted) {
      return NextResponse.json({ error: "This invitation has already been accepted" }, { status: 400 });
    }

    // CRIT-7: expiry check. If invite_expires_at is set and in the past,
    // reject 410 Gone. Rows with invite_expires_at IS NULL are legacy
    // (pre-migration); we allow those through for the one-release
    // transition window so outstanding invites aren't silently broken.
    if (invite.invite_expires_at) {
      const expiresAt = new Date(invite.invite_expires_at).getTime();
      if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
        return NextResponse.json({ error: "This invitation has expired" }, { status: 410 });
      }
    }

    // CRIT-7: session user's email MUST equal invite.email (case-insensitive).
    // Prevents a stray logged-in user from hijacking an invite intended
    // for a specific email address.
    const sessionEmail = (sessionUser.email ?? "").trim().toLowerCase();
    const inviteEmail = (invite.email ?? "").trim().toLowerCase();
    if (!sessionEmail || !inviteEmail || sessionEmail !== inviteEmail) {
      logger.warn("invite accept email mismatch", {
        sessionEmail,
        inviteEmail,
        inviteId: invite.id,
      });
      // NEW-02: include both addresses in the 403 body so the client can
      // render a meaningful "you're signed in as X, this invite is for Y"
      // prompt with a logout-and-retry path. Enumeration-safe: this only
      // fires AFTER the caller is authenticated via cookie session AND
      // their token hashed to a real invite row. It's not a generic
      // probe surface.
      return NextResponse.json(
        {
          error: "This invitation is not for your account",
          code: "EMAIL_MISMATCH",
          sessionEmail,
          inviteEmail,
        },
        { status: 403 }
      );
    }

    // Delegate the actual mutation to the shared helper. Identical
    // behaviour to the prior inline code:
    //   - users.upsert with technician → staff role mapping (PR #208 Q5)
    //   - team_members.update: invite_accepted=true, both tokens cleared
    // The helper is the single source of truth for both this route AND
    // the new /invite/[token] server-side gate (Bug D fix).
    const result = await acceptInvite(
      admin,
      {
        id: invite.id,
        tenant_id: invite.tenant_id,
        name: invite.name,
        email: invite.email,
        role: invite.role,
      },
      userId,
      "api_route",
    );
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    // C-05 canary: stash audit context for the wrapper. The wrapper
    // reads this header, deletes it, then emits to audit_logs with the
    // resolved tenant + team_members row id so the activity feed links
    // straight to the new manager's record.
    const okResponse = NextResponse.json({ success: true });
    setAuditContext(okResponse, {
      tenantId: invite.tenant_id,
      entityId: invite.id,
      userIdOverride: userId,
      newData: {
        team_member_id: invite.id,
        email: invite.email,
        role: invite.role,
      },
      metadata: {
        canary: "invite_accept",
        accepted_via: "api_route",
      },
    });
    return okResponse;
  } catch (error) {
    logger.error("Invite accept error:", error);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}

export const POST = withSentryFlush(
  withAuditLog(handleInviteAccept, {
    action: "team_member_invite",
    entityType: "team_member",
  })
);
