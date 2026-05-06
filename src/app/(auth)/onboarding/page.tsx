import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pendingInviteForEmail } from "@/lib/team-invites/pending-invite";
import OnboardingForm from "./OnboardingForm";

/**
 * /onboarding — server-component shim (Bug 2 fix, 2026-05-06).
 *
 * Pre-fix this route was a client component that unconditionally
 * rendered the jeweller-onboarding form. When a manager / staff /
 * technician clicked their email-verification link, the existing
 * post-confirm bounce dropped them on /onboarding — and the form
 * invited them to "set up your jewellery business". Submitting it
 * created an orphan tenant.
 *
 * The shim runs server-side BEFORE any client JS:
 *   1. Read the session user (createClient — server, cookie-bound).
 *   2. Look up a pending team_members invite by the user's email
 *      (createAdminClient — service-role, bypasses RLS so we can
 *      see invite-pending rows where user_id IS NULL).
 *   3. If a pending invite exists → redirect to /invite/{token},
 *      where the existing accept-invite UI takes over.
 *   4. Otherwise render the existing OnboardingForm client component
 *      (the unchanged jeweller-onboarding wizard).
 *
 * Belt-and-suspenders: completeOnboarding (the server action) ALSO
 * runs the pending-invite check before any tenant insert, so even
 * if someone bypasses the page-level redirect (direct API hit, race),
 * no orphan tenant is created.
 */
export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user?.email) {
    const admin = createAdminClient();
    const pending = await pendingInviteForEmail(admin, user.email);
    if (pending?.invite_token) {
      redirect(`/invite/${pending.invite_token}`);
    }
  }

  return <OnboardingForm />;
}
