import { redirect } from "next/navigation";

// /settings/users was the legacy URL for team management. It now lives
// at /settings/team (role + permission surface is richer there). This
// stub redirects any old bookmark / email link so the jeweller never
// sees the bare "Page not found" state on a settings URL.

export const dynamic = "force-dynamic";

export default function UsersSettingsAlias() {
  redirect("/settings/team");
}
