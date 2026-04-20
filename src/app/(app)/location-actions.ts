"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LOCATION_COOKIE } from "@/lib/location-cookie";
import { requireAuth } from "@/lib/auth-context";
import { hasLocationAccess } from "@/lib/locations";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

// Server action invoked by LocationPicker when the user picks a location
// (or returns to "All Locations"). Doing the cookie write + revalidation
// on the server — instead of relying on document.cookie + router.refresh()
// alone — guarantees that:
//
//   1. The cookie is set authoritatively (not subject to client-side races
//      between localStorage hydration and the next server request).
//   2. revalidatePath() invalidates Next.js's data cache for the dashboard
//      and other location-aware list pages so the next render genuinely
//      re-fetches with the new filter, instead of replaying a cached slice.
//   3. The selection is access-checked server-side: a stale or tampered
//      cookie pointing at a location the user can't see is rejected
//      before it ever lands in the cookie store.
export async function setSelectedLocation(
  locationId: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireAuth();

  if (locationId) {
    const allowed = await hasLocationAccess(auth.userId, auth.tenantId, locationId);
    if (!allowed) {
      return { ok: false, error: "No access to that location" };
    }
  }

  const store = await cookies();
  if (locationId) {
    store.set(LOCATION_COOKIE, locationId, {
      path: "/",
      maxAge: ONE_YEAR_SECONDS,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      // httpOnly intentionally false: the client mirrors the value into
      // LocationContext / SWR keys via document.cookie, and the value is
      // only a location UUID (not a credential).
      httpOnly: false,
    });
  } else {
    store.delete(LOCATION_COOKIE);
  }

  // Blow away the cached server renderings of every page that filters by
  // location. Without these, the next visit to /dashboard could serve a
  // stale slice from the previous selection.
  revalidatePath("/dashboard");
  revalidatePath("/sales");
  revalidatePath("/repairs");
  revalidatePath("/bespoke");
  revalidatePath("/inventory");
  revalidatePath("/invoices");

  return { ok: true };
}
