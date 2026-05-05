/**
 * Contract: Server-Timing rollout to additional hot routes.
 *
 * Phase E observability — pin which routes have been instrumented so a
 * future refactor can't silently strip the header. Each assertion proves
 * the route imports ServerTiming, instantiates one per request, and
 * stamps the canonical header on its responses.
 *
 * Routes covered by this contract:
 *   - /api/auth/login          (rate_limit, supabase_auth, profile_lookup, shell_cookie_sign)
 *   - /api/billing/portal      (rate_limit, auth_getuser, role_lookup, sub_lookup, stripe_portal_create)
 *   - /api/billing/invoices    (rate_limit, auth_getuser, user_lookup, sub_lookup, stripe_invoices_list)
 *
 * Existing /api/dashboard/stats coverage lives in the original
 * server-timing-contract.test.ts (Phase E first cut).
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

function readSrc(rel: string): string {
  return fs.readFileSync(path.resolve(__dirname, "..", "..", rel), "utf8");
}

const ROUTES = [
  {
    label: "/api/auth/login",
    src: () => readSrc("app/api/auth/login/route.ts"),
    metrics: ["rate_limit", "supabase_auth", "profile_lookup", "shell_cookie_sign"],
  },
  {
    label: "/api/billing/portal",
    src: () => readSrc("app/api/billing/portal/route.ts"),
    metrics: ["rate_limit", "auth_getuser", "role_lookup", "sub_lookup", "stripe_portal_create"],
  },
  {
    label: "/api/billing/invoices",
    src: () => readSrc("app/api/billing/invoices/route.ts"),
    metrics: ["rate_limit", "auth_getuser", "user_lookup", "sub_lookup", "stripe_invoices_list"],
  },
];

describe("Server-Timing rollout — instrumented hot routes", () => {
  for (const route of ROUTES) {
    describe(route.label, () => {
      it("imports ServerTiming from the canonical lib path", () => {
        expect(route.src()).toMatch(
          /import\s*\{[^}]*\bServerTiming\b[^}]*\}\s*from\s*["']@\/lib\/server-timing["']/,
        );
      });

      it("instantiates a ServerTiming once per request inside the handler", () => {
        expect(route.src()).toMatch(/new\s+ServerTiming\(\s*\)/);
      });

      it("stamps the Server-Timing header on responses", () => {
        // Either via a withTimingHeader helper or inline header set.
        const src = route.src();
        const stamped =
          /withTimingHeader\s*\(\s*timing\s*,/.test(src) ||
          /headers\.set\(\s*["']Server-Timing["']/.test(src) ||
          /res\.headers\.set\(\s*["']Server-Timing["']/.test(src);
        expect(stamped, `${route.label} must stamp Server-Timing header`).toBe(true);
      });

      it("records each declared metric via timing.measure(name, …)", () => {
        const src = route.src();
        for (const metric of route.metrics) {
          const re = new RegExp(
            `timing\\.measure\\(\\s*["']${metric}["']\\s*,`,
          );
          expect(src, `${route.label} should measure "${metric}"`).toMatch(re);
        }
      });
    });
  }

  it("metric names obey W3C token rules (alphanumeric + underscore, ≤64)", () => {
    const re = /^[A-Za-z0-9_]{1,64}$/;
    for (const route of ROUTES) {
      for (const metric of route.metrics) {
        expect(metric, `metric "${metric}" violates W3C token`).toMatch(re);
      }
    }
  });
});
