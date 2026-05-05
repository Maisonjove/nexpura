import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Contract test for the L-05 billing trial-end TZ fix.
 *
 * Pre-fix the BillingClient rendered trial_ends_at + current_period_end
 * with `new Date(iso).toLocaleDateString("en-AU", {...})` — no
 * timeZone option, so the formatter defaulted to the user's browser
 * TZ. For tenants whose business runs in a different TZ from the
 * person viewing the page, the displayed date could disagree with
 * Stripe's billing cycle at the day boundary.
 *
 * Post-fix:
 *   - billing/page.tsx selects tenants.timezone alongside currency
 *   - BillingClient accepts tenantTimezone: string | null prop
 *   - the date formatter pins timeZone: tenantTimezone when set
 *   - null falls back to the user's browser TZ (pre-fix behaviour)
 *
 * This test pins the surface so a future refactor can't drop the
 * timeZone option silently.
 */

const pageFile = fs.readFileSync(
  path.resolve(__dirname, "../../app/(app)/billing/page.tsx"),
  "utf8",
);

const clientFile = fs.readFileSync(
  path.resolve(__dirname, "../../app/(app)/billing/BillingClient.tsx"),
  "utf8",
);

describe("billing/page.tsx — selects + passes tenant timezone", () => {
  it("selects tenants.timezone alongside currency", () => {
    expect(pageFile).toMatch(
      /\.from\(["']tenants["']\)\s*\.select\(["'][^"']*timezone[^"']*["']\)/,
    );
  });

  it("passes tenantTimezone prop into BillingClient", () => {
    expect(pageFile).toMatch(
      /tenantTimezone=\{tenantRow\.data\?\.timezone\s*\?\?\s*null\}/,
    );
  });
});

describe("BillingClient — formats dates in tenant timezone", () => {
  it("declares tenantTimezone prop on BillingClientProps", () => {
    expect(clientFile).toMatch(/tenantTimezone:\s*string\s*\|\s*null/);
  });

  it("destructures tenantTimezone from props", () => {
    const sigBlock = clientFile.match(
      /export default function BillingClient\(\{[^}]*\}/,
    );
    expect(sigBlock).not.toBeNull();
    expect(sigBlock?.[0]).toMatch(/tenantTimezone/);
  });

  it("includes timeZone option in date formatter when tenantTimezone is set", () => {
    // Look for the inline-conditional spread pattern.
    expect(clientFile).toMatch(
      /tenantTimezone\s*\?\s*\{\s*timeZone:\s*tenantTimezone\s*\}\s*:\s*\{\s*\}/,
    );
  });

  it("does NOT have any toLocaleDateString call without a shared options object", () => {
    // The pre-fix sites used inline { day, month, year } literals
    // twice. Post-fix all date renders go through formatDate() which
    // applies the shared options including timeZone. So no inline
    // `{ day: "numeric", month: "long", year: "numeric" }` should
    // appear in toLocaleDateString call sites in this file.
    const inlineLiterals = clientFile.match(
      /toLocaleDateString\([^)]*\{\s*day:[^}]*month:[^}]*year:[^}]*\}\s*\)/g,
    );
    expect(inlineLiterals).toBeNull();
  });

  it("uses formatDate() helper for both trialEndsAt and currentPeriodEnd", () => {
    expect(clientFile).toMatch(/formatDate\(trialEndsAt\)/);
    expect(clientFile).toMatch(/formatDate\(currentPeriodEnd\)/);
  });
});
