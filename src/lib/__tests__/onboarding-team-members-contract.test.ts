import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Contract test for the C-02 upstream onboarding fix.
 *
 * Pre-fix the (auth)/onboarding/actions.ts flow inserted: tenant →
 * user (role='owner') → subscription → location → permissions. It
 * never wrote a team_members row for the owner, so every NEW signup
 * inherited the C-02 bug. The investigation found 10 affected owners
 * created between 2026-03-13 and 2026-04-28.
 *
 * Post-fix BOTH onboarding paths (Stripe-paid link + pre-Stripe
 * create) call ensureOwnerTeamMembership inline, with the
 * destructive-rollback chain extended so a failure at any step still
 * unwinds cleanly.
 *
 * This contract test pins the structural invariants. Behavioural
 * unit tests for the helper itself live in
 * owner-team-membership.test.ts. The locations.ts fallback is the
 * read-time safety net for cases where this write somehow gets
 * skipped (which would now require all rollbacks to also fail).
 */

const file = fs.readFileSync(
  path.resolve(__dirname, "../../app/(auth)/onboarding/actions.ts"),
  "utf8",
);

describe("onboarding/actions.ts — C-02 upstream fix", () => {
  it("imports ensureOwnerTeamMembership from owner-team-membership", () => {
    expect(file).toMatch(
      /import\s+\{\s*ensureOwnerTeamMembership\s*\}\s+from\s+["']@\/lib\/owner-team-membership["']/,
    );
  });

  it("calls ensureOwnerTeamMembership in the Stripe-paid link path", () => {
    // The Stripe-paid path was the regression vector for the
    // 2026-04-28 duplicate-tenant bug; we want its team_members write
    // tagged with a distinct source marker for audit traces.
    expect(file).toMatch(
      /sourceMarker:\s*["']onboarding_stripe_paid_link_2026_05_05["']/,
    );
  });

  it("calls ensureOwnerTeamMembership in the pre-Stripe create path", () => {
    expect(file).toMatch(
      /sourceMarker:\s*["']onboarding_pre_stripe_create_2026_05_05["']/,
    );
  });

  it("self-heals already-onboarded users on revisit", () => {
    // If a user's signup completed before this PR landed, the next
    // /onboarding visit (typically a no-op slug return) writes the
    // missing row. Idempotent — no DB write if the row exists.
    expect(file).toMatch(
      /sourceMarker:\s*["']onboarding_existing_user_selfheal_2026_05_05["']/,
    );
  });

  it("extends the subscriptions-failure rollback chain to delete the team_members row", () => {
    // Subscription failure used to roll back: users.delete + tenants.delete.
    // Post-fix it must roll back: team_members.delete + users.delete +
    // tenants.delete (in that order — most-recent insert first).
    expect(file).toMatch(/team_members[\s\S]{0,80}rollback delete/);
    expect(file).toMatch(
      /\.from\(["']team_members["']\)[\s\S]{0,100}\.delete\(\)/,
    );
  });

  it("rolls back BOTH user and tenant when team_members insert itself fails", () => {
    // Step 2.5 failure rollback chain: delete user, then tenant.
    const tmFailureBlock = file.match(
      /Team member \(owner\) creation error[\s\S]{0,2000}Failed to create owner membership/,
    );
    expect(tmFailureBlock).not.toBeNull();
    if (!tmFailureBlock) return;
    expect(tmFailureBlock[0]).toMatch(
      /\.from\(["']users["']\)[\s\S]{0,200}\.delete\(\)/,
    );
    expect(tmFailureBlock[0]).toMatch(
      /\.from\(["']tenants["']\)[\s\S]{0,200}\.delete\(\)/,
    );
  });
});
