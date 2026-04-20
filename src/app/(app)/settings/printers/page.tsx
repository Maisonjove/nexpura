import { redirect } from "next/navigation";

// /settings/printers → /settings/printing. Legacy URL kept in sync.
export default function SettingsPrintersRedirect() {
  redirect("/settings/printing");
}
