import { redirect } from "next/navigation";

// /settings/profile was never a first-class page in this app — profile
// fields live in the main /settings overview. Redirect old bookmarks
// there instead of showing a "Page not found".

export default function ProfileSettingsAlias() {
  redirect("/settings");
}
