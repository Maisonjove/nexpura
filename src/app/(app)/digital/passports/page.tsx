import { redirect } from "next/navigation";

/**
 * R6.5-F14 (item 19): nested-path redirect — see
 * src/app/(app)/digital/integrations/page.tsx for the rationale.
 * Flat top-level routes are canonical; /digital/passports is a stray
 * inferred path that 404'd pre-fix.
 */
export default function DigitalPassportsRedirect() {
  redirect("/passports");
}
