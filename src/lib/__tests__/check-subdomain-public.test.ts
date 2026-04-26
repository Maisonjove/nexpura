/**
 * QA-005 regression — `/api/check-subdomain` must be in the
 * `isAlwaysPublicApiPath()` allow-list inside
 * `src/lib/supabase/middleware.ts`.
 *
 * Why static analysis instead of importing the function: middleware.ts
 * imports `@/lib/supabase/jwt-verify`, which evaluates
 * `new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!)` at module load — that
 * throws at import-time inside the vitest harness where the env isn't
 * set. The wider PR-05 contract test
 * (`aal-enforcement-contract.test.ts`) uses the same source-scan pattern
 * for the same reason.
 *
 * The signup page (src/app/(auth)/signup/page.tsx) calls
 * `/api/check-subdomain?subdomain=…` to confirm the chosen subdomain is
 * free *before* the user submits the form — so the caller is, by
 * definition, unauthenticated. The Phase 1 SITEMAP marks this route as
 * Tier A (always public).
 *
 * Pre-fix bug: `isAlwaysPublicApiPath()` did not list the route, so the
 * AAL2 enforcement branch in `_updateSessionInner`
 * (`pathname.startsWith("/api/") && !isAlwaysPublicApiPath(pathname)`)
 * treated the request as protected and returned 401 to every guest.
 *
 * This test pins the contract: any future edit that drops the entry
 * breaks the build instead of silently regressing the signup flow.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../../..");
function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

describe("isAlwaysPublicApiPath — QA-005 /api/check-subdomain", () => {
  const mw = read("src/lib/supabase/middleware.ts");

  // Carve out just the function body so we don't accidentally pass on a
  // match that lives in a comment further down the file.
  const fnStart = mw.indexOf("function isAlwaysPublicApiPath(");
  const fnEnd = mw.indexOf(
    "\n}",
    mw.indexOf("{", fnStart),
  );
  const fnBody = mw.slice(fnStart, fnEnd);

  it("locates the isAlwaysPublicApiPath function", () => {
    expect(fnStart).toBeGreaterThan(-1);
    expect(fnEnd).toBeGreaterThan(fnStart);
  });

  it("includes /api/check-subdomain in the public allow-list", () => {
    // Match the existing convention: pathname.startsWith("/api/check-subdomain")
    expect(fnBody).toMatch(
      /pathname\.startsWith\(\s*['"]\/api\/check-subdomain['"]\s*\)/,
    );
  });

  it("the matching route handler exists and is a public route (no auth check)", () => {
    const route = read("src/app/api/check-subdomain/route.ts");
    // No supabase.auth.getUser() / authentication guard — the route is
    // explicitly designed for unauth callers (signup-page availability
    // probe). Catches a future edit that adds an auth check inside the
    // handler without removing the public allow-list entry (or vice versa).
    expect(route).not.toMatch(/auth\.getUser\(/);
    expect(route).not.toMatch(/requireAuth\(/);
  });
});
