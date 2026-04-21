import { redirect } from "next/navigation";

// Legacy URL kept around as a redirect — the canonical route is
// /settings/email-domain (singular). Same reason as /settings/users →
// /settings/team: a bookmarked plural URL shouldn't surface the generic
// "Page not found" body on a settings surface.

export const dynamic = "force-dynamic";

export default function EmailDomainsSettingsAlias() {
  redirect("/settings/email-domain");
}
