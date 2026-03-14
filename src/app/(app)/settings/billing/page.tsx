import { redirect } from "next/navigation";

// Redirect /settings/billing to /billing
export default function SettingsBillingRedirect() {
  redirect("/billing");
}
