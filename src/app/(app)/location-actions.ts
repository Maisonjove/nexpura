"use server";

import { cookies } from "next/headers";
import { LOCATION_COOKIE } from "@/lib/location-cookie";
import { requireAuth } from "@/lib/auth-context";
import { hasLocationAccess } from "@/lib/locations";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

// Server action invoked by LocationPicker when the user picks a location
// (or returns to "All Locations"). Doing the cookie write on the server
// — instead of relying on document.cookie alone — guarantees that:
//
//   1. The cookie is set authoritatively (not subject to client-side
//      races between localStorage hydration and the next server request).
//   2. The selection is access-checked server-side: a stale or tampered
//      cookie pointing at a location the user can't see is rejected
//      before it ever lands in the cookie store.
//
// Cache invalidation note: the prior implementation called
// `revalidatePath("/dashboard")` + 5 sibling list paths to flush the
// per-route data cache after a location change. Under Next 16's
// `cacheComponents: true` (the post-PPR cache model), `revalidatePath`
// against a route that has a prerendered postponed shell raises
// "Failed to parse postponed state" intermittently — we surfaced this
// repeatedly in the layby flow spec because it picks the location, then
// immediately POSTs another server action. The path-revalidation isn't
// strictly required: list pages don't sit behind a `use cache`
// boundary, the in-memory cache wrapper is a no-op since the
// Upstash/Redis removal, and the LocationContext on the client signals
// SWR-keyed re-fetches from `nx_location` cookie change. So the right
// move is to drop the path revalidations and let the next navigation
// fetch fresh against the new cookie value. If a future cache layer
// reintroduces stale-slice risk, prefer per-tenant `revalidateTag(...)`
// using `CACHE_TAGS` from src/lib/cache-tags.ts — that's compatible
// with cacheComponents where `revalidatePath` is not.
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

  return { ok: true };
}
