import { Suspense } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import InviteClient from "./InviteClient";
import { acceptInvite } from "@/lib/team-invites/accept-invite";
import { logAuditEvent } from "@/lib/audit";
import logger from "@/lib/logger";

/**
 * /invite/[token] — CC-ready invite-acceptance page.
 *
 * Sync top-level → Suspense → async body → pure `loadInviteByToken(token)`
 * loader. The async body handles three terminal states:
 *   1. Invalid / unknown token → render the "Invalid or Expired" error card.
 *   2. Already-accepted token → `redirect("/login")` (Next handles
 *      NEXT_REDIRECT during streaming so no partial invite UI leaks).
 *   3. Valid pending invite → render the InviteClient form.
 *
 * All three behaviours are preserved byte-for-byte from the previous
 * top-level-async version. No auth / cookies on this route — the token
 * itself is the auth credential, validated server-side against the
 * team_members.invite_token column via the service-role admin client.
 *
 * TODO(cacheComponents-flag): `loadInviteByToken` reads per-token
 * invite state which changes rarely (only on acceptance) but is
 * strongly tied to the token URL. When the flag flips, the loader
 * could add:
 *   'use cache';
 *   cacheLife('seconds');          // short TTL — acceptance invalidates
 *   cacheTag(`invite:${token}`);
 * Plus `revalidateTag(`invite:${token}`)` from the accept-invite server
 * action. For now the safer default is to leave it uncached.
 */

export const metadata = { title: "Accept Invitation — Nexpura" };

interface Props {
  params: Promise<{ token: string }>;
}

export default function InvitePage({ params }: Props) {
  return (
    <Suspense fallback={<InviteSkeleton />}>
      <InviteBody paramsPromise={params} />
    </Suspense>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Dynamic body. Resolves the token, looks up the invite, then branches
// to one of three terminal render/redirect paths.
// ─────────────────────────────────────────────────────────────────────────
async function InviteBody({ paramsPromise }: { paramsPromise: Promise<{ token: string }> }) {
  const { token } = await paramsPromise;
  const invite = await loadInviteByToken(token);

  if (!invite) {
    return <InviteInvalid />;
  }

  if (invite.invite_accepted) {
    redirect("/login");
  }

  // ───────────────────────────────────────────────────────────────────
  // Bug D — server-side accept gate (2026-05-06).
  //
  // Symptom pre-fix: joeygermani11 had a verified auth.users row +
  // password (single email identity, NOT OAuth) but public.users was
  // empty and the team_members invite was still pending. Signing in
  // landed on the InviteClient page where a client-side useEffect
  // auto-accept proved unreliable — audit_logs showed zero
  // team_member_invite emit attempts for the uid despite a successful
  // last_sign_in_at, so the useEffect never fired its POST.
  //
  // Fix: server-side mirror of the /onboarding shim pattern. After
  // loading the invite, check the SSR session. If the visitor:
  //   1. Has a confirmed email (email_confirmed_at != null), AND
  //   2. Their session email matches the invite email (case-insensitive), AND
  //   3. The invite is still pending (already true above), AND
  //   4. The invite has not expired (or expires_at IS NULL — legacy)
  // …then accept the invite right here on the server and redirect to
  // /dashboard. The client-side useEffect in InviteClient is retained
  // as defense-in-depth for the email-confirm bounce path where the
  // session is freshly set on the same render.
  //
  // Audit emit: this path does not pass through withAuditLog (the
  // wrapper is route-only). Write the audit row directly with
  // accepted_via='server_gate' for forensic separability.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const sessionEmail = (user?.email ?? "").trim().toLowerCase();
  const inviteEmail = (invite.email ?? "").trim().toLowerCase();
  const emailMatches =
    !!sessionEmail && !!inviteEmail && sessionEmail === inviteEmail;
  const emailConfirmed = user?.email_confirmed_at != null;
  const notExpired =
    invite.invite_expires_at == null ||
    new Date(invite.invite_expires_at).getTime() > Date.now();

  if (user && emailConfirmed && emailMatches && notExpired) {
    const admin = createAdminClient();
    const result = await acceptInvite(
      admin,
      {
        id: invite.id,
        tenant_id: invite.tenant_id,
        name: invite.name,
        email: invite.email,
        role: invite.role,
      },
      user.id,
      "server_gate",
    );
    if ("success" in result) {
      try {
        await logAuditEvent({
          tenantId: invite.tenant_id,
          userId: user.id,
          action: "team_member_invite",
          entityType: "team_member",
          entityId: invite.id,
          newData: {
            team_member_id: invite.id,
            email: invite.email,
            role: invite.role,
          },
          metadata: {
            canary: "invite_accept",
            accepted_via: "server_gate",
            source: "page_gate",
            route: `/invite/${token}`,
          },
        });
      } catch (err) {
        // Audit is observability — never break the redirect on emit failure.
        logger.error("[invite-page-gate] audit emit failed (non-fatal)", {
          inviteId: invite.id,
          userId: user.id,
          err: err instanceof Error ? err.message : String(err),
        });
      }
      redirect("/dashboard?accepted=1");
    }
    // Mutation failed — fall through to render InviteClient so the
    // user gets a recoverable form rather than a blank page. The
    // client-side accept will surface a real error if it persists.
    logger.error("[invite-page-gate] acceptInvite failed; falling through to client", {
      inviteId: invite.id,
      userId: user.id,
      error: result.error,
      status: result.status,
    });
  }

  // Fallback chain: tenants.business_name → tenants.name → "your team".
  // Many tenants (e.g. dogfood `316a3313`) only have `name` set and leave
  // `business_name` NULL — pre-fix the placeholder rendered as the literal
  // "Join <unknown>" headline (Bug 1.5, hit 2026-05-06 inviting
  // joeygermani11@icloud.com).
  const tenants = invite.tenants as
    | { business_name?: string | null; name?: string | null }
    | null;
  const businessName =
    tenants?.business_name?.trim() ||
    tenants?.name?.trim() ||
    "your team";

  return (
    <InviteClient
      token={token}
      invite={{
        id: invite.id,
        name: invite.name,
        email: invite.email,
        role: invite.role,
        businessName,
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Cacheable per-token loader. Pure w.r.t. its input.
// ─────────────────────────────────────────────────────────────────────────
interface InviteRow {
  id: string;
  name: string;
  email: string;
  role: string;
  invite_accepted: boolean;
  invite_expires_at: string | null;
  tenant_id: string;
  tenants: { business_name: string | null; name: string | null } | null;
}

async function loadInviteByToken(token: string): Promise<InviteRow | null> {
  const admin = createAdminClient();
  // Note: select extended to include `invite_expires_at` — required by
  // the Bug D server-side accept gate predicate. Legacy rows where
  // invite_expires_at IS NULL are still treated as not-expired (matches
  // the same one-release transition window the API route honors).
  const { data } = await admin
    .from("team_members")
    .select(`
      id,
      name,
      email,
      role,
      invite_accepted,
      invite_expires_at,
      tenant_id,
      tenants!inner(business_name, name)
    `)
    .eq("invite_token", token)
    .single();
  return (data as InviteRow | null) ?? null;
}

// ─────────────────────────────────────────────────────────────────────────
// Invalid / expired invite render. Unchanged from prior inline version.
// ─────────────────────────────────────────────────────────────────────────
function InviteInvalid() {
  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-stone-900 mb-2">Invalid or Expired Invitation</h1>
        <p className="text-stone-500 mb-6">This invitation link is no longer valid. Please contact your employer for a new invite.</p>
        <a href="/login" className="text-amber-600 hover:text-amber-700 font-medium">
          Go to Login →
        </a>
      </div>
    </div>
  );
}

function InviteSkeleton() {
  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-stone-100 rounded-full mx-auto mb-4 animate-pulse" />
        <div className="h-6 w-48 bg-stone-100 rounded mx-auto mb-2 animate-pulse" />
        <div className="h-4 w-64 bg-stone-100 rounded mx-auto mb-6 animate-pulse" />
        <div className="h-10 w-32 bg-stone-100 rounded-lg mx-auto animate-pulse" />
      </div>
    </div>
  );
}
