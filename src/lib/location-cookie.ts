export const LOCATION_COOKIE = "nx_location";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

// Client-side cookie writer. Server-side readers live in src/lib/locations.ts
// (getSelectedLocationIdFromCookie) so RSC + server actions can resolve the
// selected location without hydration round-trips.
export function writeLocationCookie(locationId: string | null) {
  if (typeof document === "undefined") return;
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "; Secure"
      : "";
  if (locationId) {
    document.cookie = `${LOCATION_COOKIE}=${encodeURIComponent(locationId)}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax${secure}`;
  } else {
    document.cookie = `${LOCATION_COOKIE}=; path=/; max-age=0; SameSite=Lax${secure}`;
  }
}
