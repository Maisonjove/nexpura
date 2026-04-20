import { redirect } from "next/navigation";

// /settings/email-domain → /settings/email. Legacy URL kept in sync.
export default function SettingsEmailDomainRedirect() {
  redirect("/settings/email");
}
