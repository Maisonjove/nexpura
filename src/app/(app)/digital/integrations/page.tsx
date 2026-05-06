import { redirect } from "next/navigation";

/**
 * R6.5-F14 (item 19): /digital/integrations was 404'ing while
 * /integrations worked. Round 4 calibration locked the app on flat
 * top-level routes, and the Digital hub page (../page.tsx) links to
 * /integrations directly — but a customer/staffer who infers the nested
 * path (or has it bookmarked from the legacy hub design) hit a dead end.
 *
 * Server-side redirect to the canonical top-level route. Same pattern
 * applied to /digital/website and /digital/passports — see sibling
 * folders. If a future iteration *does* want a nested settings page
 * under /digital, replace this redirect with the real component.
 */
export default function DigitalIntegrationsRedirect() {
  redirect("/integrations");
}
