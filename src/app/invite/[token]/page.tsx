import { Suspense } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import InviteClient from "./InviteClient";

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
  tenant_id: string;
  tenants: { business_name: string | null; name: string | null } | null;
}

async function loadInviteByToken(token: string): Promise<InviteRow | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("team_members")
    .select(`
      id,
      name,
      email,
      role,
      invite_accepted,
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
