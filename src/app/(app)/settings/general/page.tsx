import { redirect } from "next/navigation";

// /settings/general → /settings. General business profile + tax + banking +
// account + security tabs all live on the Settings index page.
export default function SettingsGeneralRedirect() {
  redirect("/settings");
}
