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
  it("settings/team/actions.ts re-exports the canonical (no local definition)", () => {
    expect(teamActions).toMatch(
      /export\s*\{\s*inviteTeamMember\s*\}\s*from\s*["']\.\.\/roles\/actions["']/,
    );
    // Local `export async function inviteTeamMember` is gone.
    expect(teamActions).not.toMatch(/export\s+async\s+function\s+inviteTeamMember\s*\(/);
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
