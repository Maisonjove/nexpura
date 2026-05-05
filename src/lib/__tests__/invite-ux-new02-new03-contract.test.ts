/**
 * NEW-02 + NEW-03 contract — invite UX improvements.
 *
 * NEW-02 (logout-and-retry):
 *   1. /api/invite/accept's 403 email-mismatch branch returns
 *      sessionEmail + inviteEmail in the JSON body so the client can
 *      render a meaningful prompt.
 *   2. The 403 branch tags the response with code: "EMAIL_MISMATCH" so
 *      the client doesn't have to string-match the error message.
 *   3. The invite client UI renders a dedicated email-mismatch surface
 *      with a "Sign out and try again" primary action that calls
 *      supabase.auth.signOut() and a "Back to dashboard" secondary
 *      action.
 *
 * NEW-03 (stale-invite history visibility):
 *   1. /settings/team selects invite_expires_at from team_members.
 *   2. TeamClient computes a 3-state invite status (active / pending /
 *      expired) from invite_accepted + invite_expires_at.
 *   3. The Status cell renders three visually distinct badge states.
 *   4. Expired rows render a "Resend invite" button that calls the
 *      existing resendInvite() server action.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

function readSrc(rel: string): string {
  return fs.readFileSync(path.resolve(__dirname, "..", "..", rel), "utf8");
}

// ───────────────────────────────────────────────────────────────────────
// NEW-02 — server contract
// ───────────────────────────────────────────────────────────────────────
describe("NEW-02 /api/invite/accept — 403 mismatch body shape", () => {
  const src = readSrc("app/api/invite/accept/route.ts");

  it("returns sessionEmail + inviteEmail in the 403 body", () => {
    // The mismatch branch must include both fields and the 403 status.
    const mismatchBlock = src.match(
      /if\s*\([^)]*sessionEmail[\s\S]*?inviteEmail[\s\S]*?\)\s*\{[\s\S]*?status:\s*403[\s\S]*?\}/
    );
    expect(mismatchBlock, "expected a 403 branch on session/invite email mismatch").toBeTruthy();
    const block = mismatchBlock![0];
    expect(block, "403 body must echo sessionEmail").toMatch(/sessionEmail/);
    expect(block, "403 body must echo inviteEmail").toMatch(/inviteEmail/);
  });

  it("tags the 403 response with a stable EMAIL_MISMATCH code", () => {
    expect(src).toMatch(/code:\s*["']EMAIL_MISMATCH["']/);
  });
});

// ───────────────────────────────────────────────────────────────────────
// NEW-02 — client contract
// ───────────────────────────────────────────────────────────────────────
describe("NEW-02 InviteClient — logout-and-retry surface", () => {
  const src = readSrc("app/invite/[token]/InviteClient.tsx");

  it("branches on a 403 EMAIL_MISMATCH response from /api/invite/accept", () => {
    expect(src).toMatch(/response\.status\s*===\s*403/);
    expect(src).toMatch(/EMAIL_MISMATCH/);
  });

  it("calls supabase.auth.signOut() in the retry handler", () => {
    expect(src).toMatch(/auth\.signOut\(\)/);
  });

  it("redirects back to the same /invite/<token> page after sign-out", () => {
    // Either window.location or router.push at /invite/${token} is fine;
    // the contract is that the token is preserved.
    expect(src).toMatch(/\/invite\/\$\{token\}/);
  });

  it("renders a primary 'Sign out and try again' action button", () => {
    expect(src).toMatch(/Sign out and try again/);
    expect(src).toMatch(/data-testid=["']invite-signout-retry["']/);
  });

  it("keeps a 'Back to dashboard' secondary action", () => {
    expect(src).toMatch(/Back to dashboard/);
  });

  it("renders the actual mismatched addresses in the prompt", () => {
    // Both the invite and session emails should be displayed so the
    // recipient sees what to switch to.
    expect(src).toMatch(/emailMismatch\.inviteEmail/);
    expect(src).toMatch(/emailMismatch\.sessionEmail/);
  });
});

// ───────────────────────────────────────────────────────────────────────
// NEW-03 — team list contract
// ───────────────────────────────────────────────────────────────────────
describe("NEW-03 /settings/team — stale-invite visibility", () => {
  const pageSrc = readSrc("app/(app)/settings/team/page.tsx");
  const clientSrc = readSrc("app/(app)/settings/team/TeamClient.tsx");

  it("page.tsx selects invite_expires_at from team_members", () => {
    // The select string must include invite_expires_at so the client
    // can compute the expired state.
    const selectMatch = pageSrc.match(
      /\.from\(\s*["']team_members["']\s*\)[\s\S]*?\.select\(\s*"([^"]+)"/
    );
    expect(selectMatch, "expected a team_members.select() call").toBeTruthy();
    expect(selectMatch![1]).toMatch(/invite_expires_at/);
  });

  it("TeamClient defines a 3-state invite status helper", () => {
    expect(clientSrc).toMatch(/getInviteStatus/);
    // All three states must appear as string literals.
    expect(clientSrc).toMatch(/["']active["']/);
    expect(clientSrc).toMatch(/["']pending["']/);
    expect(clientSrc).toMatch(/["']expired["']/);
  });

  it("status helper compares invite_expires_at against Date.now()", () => {
    // Lock in the expiry comparison so an expired invite is actually
    // detected (not just rendered as 'pending' forever).
    const helper = clientSrc.match(/function getInviteStatus[\s\S]*?\n\}/);
    expect(helper, "expected getInviteStatus function body").toBeTruthy();
    expect(helper![0]).toMatch(/invite_expires_at/);
    expect(helper![0]).toMatch(/Date\.now\(\)/);
  });

  it("renders three distinct badge labels: Active, Pending, Expired", () => {
    // Labels appear as JSX text content inside a <span>; allow surrounding
    // whitespace.
    expect(clientSrc).toMatch(/>\s*Active\s*</);
    expect(clientSrc).toMatch(/>\s*Pending\s*</);
    expect(clientSrc).toMatch(/>\s*Expired\s*</);
  });

  it("badges carry a data-status attribute for each of the 3 states", () => {
    expect(clientSrc).toMatch(/data-status=["']active["']/);
    expect(clientSrc).toMatch(/data-status=["']pending["']/);
    expect(clientSrc).toMatch(/data-status=["']expired["']/);
  });

  it("expired rows render a Resend invite button wired to resendInvite()", () => {
    expect(clientSrc).toMatch(/data-testid=["']invite-resend-button["']/);
    expect(clientSrc).toMatch(/Resend invite/);
    expect(clientSrc).toMatch(/import\s*\{\s*resendInvite\s*\}\s*from\s*["']\.\.\/roles\/actions["']/);
    expect(clientSrc).toMatch(/resendInvite\(/);
  });
});
