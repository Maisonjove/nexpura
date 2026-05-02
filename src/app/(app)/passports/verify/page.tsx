import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth-context";
import VerifyPassportClient from "./VerifyPassportClient";

export const metadata = { title: "Verify Passport — Nexpura" };

// Section 10.2 (Kaitlyn 2026-05-02 redesign brief). The brief calls this
// /digital/passports/verify but the existing app uses /passports — keep
// the established convention. Server action runs per-submit so the page
// itself stays dynamic-on-demand without a force-dynamic export.
export default async function VerifyPassportPage() {
  // Auth/tenant scoping — same shape as /passports/page.tsx. Without
  // a session the form would still call the server action which itself
  // returns { found: false }, but bouncing here gives a cleaner UX.
  const auth = await getAuthContext();
  if (!auth) redirect("/login");

  return <VerifyPassportClient />;
}
