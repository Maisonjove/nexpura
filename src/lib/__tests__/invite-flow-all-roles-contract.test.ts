import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Contract test for the all-roles invite-flow hotfix (2026-05-06).
 *
 * Covers four bugs Joey walked through inviting joeygermani11@icloud.com:
 *   1. Bug 1.5 — invite landing page rendered "Join Unknown Business"
 *      because the dogfood tenant 316a3313 has business_name=NULL.
 *   2. Bug 2 (CRITICAL) — manager email-verification redirect dropped
 *      the invitee on owner-onboarding. Submitting it would have
 *      created an orphan tenant.
 *   3. Q5 (DORMANT) — /api/invite/accept upserted users.role with
 *      invite.role verbatim. For invite.role='technician' this fails
 *      the users_role_check CHECK constraint (owner | manager | staff).
 *   4. Recovery — pending-invite gate makes joeygermani11@icloud.com
 *      (and any pre-fix user stuck mid-flow) recoverable on next sign-in.
 */

vi.mock("@/lib/logger", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { pendingInviteForEmail } from "../team-invites/pending-invite";

// ─────────────────────────────────────────────────────────────────────────
// Fake admin builder for pendingInviteForEmail unit tests.
// Mirrors the .from(...).select(...).ilike(...).eq(...).not(...).maybeSingle()
// chain the helper uses.
// ─────────────────────────────────────────────────────────────────────────
function buildAdmin(rows: Record<string, unknown> | null) {
  const builder = {
    select() { return builder; },
    ilike() { return builder; },
    eq() { return builder; },
    not() { return builder; },
    maybeSingle: () => Promise.resolve({ data: rows, error: null }),
  };
  return {
    from: (_table: string) => builder,
  };
}

const futureIso = () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
const pastIso = () => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

describe("pendingInviteForEmail helper", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the team_members row when invite_accepted=false, invite_token IS NOT NULL, not expired", async () => {
    const admin = buildAdmin({
      id: "tm-1",
      tenant_id: "tenant-a",
      invite_token: "tok-xyz",
      invite_expires_at: futureIso(),
      invite_accepted: false,
    });
    const result = await pendingInviteForEmail(
      admin as unknown as Parameters<typeof pendingInviteForEmail>[0],
      "manager@example.com",
    );
    expect(result).toMatchObject({
      id: "tm-1",
      tenant_id: "tenant-a",
      invite_token: "tok-xyz",
    });
  });

  it("treats invite_expires_at IS NULL as non-expired (legacy semantic)", async () => {
    const admin = buildAdmin({
      id: "tm-2",
      tenant_id: "tenant-b",
      invite_token: "tok-legacy",
      invite_expires_at: null,
      invite_accepted: false,
    });
    const result = await pendingInviteForEmail(
      admin as unknown as Parameters<typeof pendingInviteForEmail>[0],
      "legacy@example.com",
    );
    expect(result?.invite_token).toBe("tok-legacy");
  });

  it("returns null when invite_accepted=true", async () => {
    const admin = buildAdmin({
      id: "tm-3",
      tenant_id: "tenant-c",
      invite_token: "tok-old",
      invite_expires_at: futureIso(),
      invite_accepted: true,
    });
    const result = await pendingInviteForEmail(
      admin as unknown as Parameters<typeof pendingInviteForEmail>[0],
      "accepted@example.com",
    );
    expect(result).toBeNull();
  });

  it("returns null when invite_token IS NULL", async () => {
    const admin = buildAdmin({
      id: "tm-4",
      tenant_id: "tenant-d",
      invite_token: null,
      invite_expires_at: futureIso(),
      invite_accepted: false,
    });
    const result = await pendingInviteForEmail(
      admin as unknown as Parameters<typeof pendingInviteForEmail>[0],
      "notoken@example.com",
    );
    expect(result).toBeNull();
  });

  it("returns null when expired", async () => {
    const admin = buildAdmin({
      id: "tm-5",
      tenant_id: "tenant-e",
      invite_token: "tok-stale",
      invite_expires_at: pastIso(),
      invite_accepted: false,
    });
    const result = await pendingInviteForEmail(
      admin as unknown as Parameters<typeof pendingInviteForEmail>[0],
      "expired@example.com",
    );
    expect(result).toBeNull();
  });

  it("returns null when no row matches the email", async () => {
    const admin = buildAdmin(null);
    const result = await pendingInviteForEmail(
      admin as unknown as Parameters<typeof pendingInviteForEmail>[0],
      "nobody@example.com",
    );
    expect(result).toBeNull();
  });

  it("returns null on empty / whitespace-only email", async () => {
    const admin = buildAdmin({
      id: "tm-x",
      tenant_id: "tenant-x",
      invite_token: "tok-x",
      invite_expires_at: futureIso(),
      invite_accepted: false,
    });
    expect(
      await pendingInviteForEmail(
        admin as unknown as Parameters<typeof pendingInviteForEmail>[0],
        "   ",
      ),
    ).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Source-grep contract assertions (Bug 1.5 + Bug 2 + Q5).
// ─────────────────────────────────────────────────────────────────────────
const onboardingPage = fs.readFileSync(
  path.resolve(__dirname, "../../app/(auth)/onboarding/page.tsx"),
  "utf8",
);
const onboardingActions = fs.readFileSync(
  path.resolve(__dirname, "../../app/(auth)/onboarding/actions.ts"),
  "utf8",
);
const inviteAcceptRoute = fs.readFileSync(
  path.resolve(__dirname, "../../app/api/invite/accept/route.ts"),
  "utf8",
);
const inviteTokenPage = fs.readFileSync(
  path.resolve(__dirname, "../../app/invite/[token]/page.tsx"),
  "utf8",
);

describe("Bug 2 — onboarding page server-side gate", () => {
  it("imports pendingInviteForEmail from the helper module", () => {
    expect(onboardingPage).toMatch(
      /import\s+\{\s*pendingInviteForEmail\s*\}\s+from\s+["']@\/lib\/team-invites\/pending-invite["']/,
    );
  });

  it("calls redirect(`/invite/${...}`) in the matching branch", () => {
    expect(onboardingPage).toMatch(/redirect\(`\/invite\/\$\{[^`]+\}`\)/);
  });

  it("page is no longer marked 'use client' (it's a server component shim)", () => {
    // The first non-empty line of a client component is 'use client'.
    // The shim is a server component, so that pragma must not appear at
    // the top of the file.
    const head = onboardingPage.split("\n").slice(0, 3).join("\n");
    expect(head).not.toMatch(/^["']use client["'];?/m);
  });
});

describe("Bug 2 — completeOnboarding action belt", () => {
  it("imports pendingInviteForEmail at the top of actions.ts", () => {
    expect(onboardingActions).toMatch(
      /import\s+\{\s*pendingInviteForEmail\s*\}\s+from\s+["']@\/lib\/team-invites\/pending-invite["']/,
    );
  });

  it("calls pendingInviteForEmail before any tenant insert", () => {
    const pendingIdx = onboardingActions.indexOf("pendingInviteForEmail(");
    const tenantInsertIdx = onboardingActions.indexOf('.from("tenants")');
    expect(pendingIdx).toBeGreaterThan(0);
    expect(tenantInsertIdx).toBeGreaterThan(0);
    expect(pendingIdx).toBeLessThan(tenantInsertIdx);
  });

  it("returns the literal 'You have a pending invite for' error string in the matching branch", () => {
    expect(onboardingActions).toMatch(/You have a pending invite for/);
  });
});

describe("Q5 — technician → staff role mapping at users.role layer", () => {
  it("upsert payload remaps invite.role with the ternary at the role: field", () => {
    expect(inviteAcceptRoute).toMatch(
      /role:\s*invite\.role\s*===\s*['"]technician['"]\s*\?\s*['"]staff['"]\s*:\s*invite\.role/,
    );
  });

  it("adjacent comment explains the team_members-vs-users role split", () => {
    // Pulls the ~12 lines preceding the ternary so we assert the
    // explainer comment is co-located with the fix.
    const ternaryIdx = inviteAcceptRoute.indexOf("=== 'technician' ? 'staff' :");
    expect(ternaryIdx).toBeGreaterThan(0);
    const preceding = inviteAcceptRoute.slice(Math.max(0, ternaryIdx - 600), ternaryIdx);
    expect(preceding).toMatch(/users_role_check|users\.role|team_members\.role/);
    expect(preceding).toMatch(/technician/);
  });
});

describe("Bug 1.5 regression — /invite/[token] business-name fallback", () => {
  it("source contains the 'your team' fallback string", () => {
    expect(inviteTokenPage).toMatch(/"your team"|'your team'/);
  });

  it("source does NOT contain the old 'Unknown Business' literal", () => {
    expect(inviteTokenPage).not.toMatch(/Unknown Business/);
  });

  it("tenant select includes BOTH business_name AND name columns", () => {
    expect(inviteTokenPage).toMatch(/tenants!inner\(business_name,\s*name\)/);
  });
});
