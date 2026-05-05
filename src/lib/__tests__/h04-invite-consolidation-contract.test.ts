import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Contract test for H-04a (consolidation) + H-04b (single canonical
 * invite surface).
 *
 * Pre-fix two `inviteTeamMember` actions existed:
 *   - settings/team/actions.ts — no email send
 *   - settings/roles/actions.ts — sends email
 * The /settings/team UI called the no-email twin, so a junior staff
 * member invited from that surface received nothing.
 *
 * Post-fix: ONE `inviteTeamMember` (settings/roles version, sends
 * email + has plan-limit gate folded in). settings/team/actions.ts
 * re-exports it so existing import paths keep working.
 */

const teamActions = fs.readFileSync(
  path.resolve(__dirname, "../../app/(app)/settings/team/actions.ts"),
  "utf8",
);

const rolesActions = fs.readFileSync(
  path.resolve(__dirname, "../../app/(app)/settings/roles/actions.ts"),
  "utf8",
);

const teamClient = fs.readFileSync(
  path.resolve(__dirname, "../../app/(app)/settings/team/TeamClient.tsx"),
  "utf8",
);

describe("H-04a — exactly one inviteTeamMember definition across settings/", () => {
  it("settings/team/actions.ts holds NO inviteTeamMember (canonical lives on roles)", () => {
    // Local `export async function inviteTeamMember` is gone.
    expect(teamActions).not.toMatch(/export\s+async\s+function\s+inviteTeamMember\s*\(/);
    // No re-export either — `export {x} from "y"` inside a "use server"
    // module breaks Next.js's server-action bundler (caught on the PR
    // #187 Vercel deploy: "The module has no exports at all"). Callers
    // import inviteTeamMember directly from ../roles/actions.
    expect(teamActions).not.toMatch(
      /export\s*\{\s*inviteTeamMember\s*\}\s*from\s*["']\.\.\/roles\/actions["']/,
    );
  });

  it("TeamClient.tsx imports inviteTeamMember directly from ../roles/actions", () => {
    // Allow co-imports (e.g. resendInvite from NEW-03) alongside;
    // the assertion is "this exact import path supplies inviteTeamMember",
    // not "inviteTeamMember is the only thing imported".
    expect(teamClient).toMatch(
      /import\s*\{[^}]*\binviteTeamMember\b[^}]*\}\s*from\s*["']\.\.\/roles\/actions["']/,
    );
  });

  it("settings/roles/actions.ts holds the canonical with email send", () => {
    expect(rolesActions).toMatch(/export\s+async\s+function\s+inviteTeamMember\s*\(/);
    expect(rolesActions).toMatch(/resend\.emails\.send/);
  });

  it("canonical has plan-limit enforcement (folded in from the deleted twin)", () => {
    expect(rolesActions).toMatch(/canAddStaff\s*\(/);
    expect(rolesActions).toMatch(/PLAN_FEATURES/);
  });

  it("canonical is owner-only (NOT manager)", () => {
    const block = rolesActions.match(
      /export\s+async\s+function\s+inviteTeamMember[\s\S]{0,500}?requireRole\("owner"\)/,
    );
    expect(block).not.toBeNull();
  });
});

describe("H-04b — invite surface available from /settings/team UI", () => {
  it("TeamClient calls the canonical (typed args, not formData)", () => {
    expect(teamClient).toMatch(
      /await\s+inviteTeamMember\(\s*inviteName,\s*inviteEmail,\s*inviteRole,\s*null,?\s*\)/,
    );
    // The pre-fix formData call shape is gone.
    expect(teamClient).not.toMatch(/await\s+inviteTeamMember\(\s*fd\s*\)/);
  });
});
