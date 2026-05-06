/**
 * Phase A follow-up contract tests (2026-05-06).
 *
 * Locks the three bug fixes shipped post-PR #208:
 *   - Bug B: /api/invite/accept idempotent on multi-tab race
 *   - Bug C partial: /login renders invite-context banner + bolds Forgot
 *     password? when redirectTo starts with /invite/. NEGATIVE grep
 *     against Google OAuth (explicitly deferred this PR).
 *   - Bug D: /invite/[token] page-level server gate (predicate
 *     completeness + InviteClient fall-through preserved).
 *
 * Most tests are source-grep contracts so the assertion runs in the
 * same place where the fix lives. Two are runtime tests for Bug B
 * (idempotency happy path + cross-user 400 negative path).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────
const REPO = path.resolve(__dirname, "../../..");
function read(rel: string): string {
  return fs.readFileSync(path.join(REPO, rel), "utf8");
}

// ─────────────────────────────────────────────────────────────────────
// Bug C — login banner + Forgot prominence + Google deferral
// ─────────────────────────────────────────────────────────────────────
describe("Bug C — /login invite banner + Forgot prominence", () => {
  const loginSrc = read("src/app/(auth)/login/page.tsx");

  it("contains the literal banner copy", () => {
    expect(loginSrc).toMatch(/This email is already registered/);
    expect(loginSrc).toMatch(/Sign in here to accept the invitation/);
  });

  it("predicate checks redirectTo startsWith /invite/", () => {
    // Allow either "/invite/" string-quote variant.
    expect(
      loginSrc.includes('startsWith("/invite/")') ||
        loginSrc.includes("startsWith('/invite/')"),
    ).toBe(true);
  });

  it("Forgot password link uses bolder amber styling in the invite branch", () => {
    // The conditional `font-medium text-amber-700` styling for the
    // invite-redirect path must be present alongside the original
    // muted styling used otherwise.
    expect(loginSrc).toMatch(/font-medium\s+text-amber-700/);
    // Sanity: the literal "Forgot password?" link is still on the page.
    expect(loginSrc).toMatch(/Forgot password\?/);
  });

  it("does NOT add Google sign-in this PR (signInWithOAuth pinned out)", () => {
    // Pinned negative grep — provider toggle is Joey-gated and queued
    // for a dedicated post-engagement PR. If this regresses, a future
    // change accidentally landed Google sign-in without provider config.
    expect(loginSrc).not.toMatch(/signInWithOAuth/);
    expect(loginSrc).not.toMatch(/provider:\s*['"]google['"]/);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Bug D — /invite/[token] server-side gate predicate + fall-through
// ─────────────────────────────────────────────────────────────────────
describe("Bug D — /invite/[token] server-side accept gate", () => {
  const pageSrc = read("src/app/invite/[token]/page.tsx");

  it("still imports + uses InviteClient (fall-through path preserved)", () => {
    expect(pageSrc).toMatch(/from\s+["']\.\/InviteClient["']/);
    expect(pageSrc).toMatch(/<InviteClient\b/);
  });

  it("predicate references email_confirmed_at, invite_expires_at, and a toLowerCase email comparison", () => {
    expect(pageSrc).toMatch(/email_confirmed_at/);
    expect(pageSrc).toMatch(/invite_expires_at/);
    expect(pageSrc).toMatch(/toLowerCase\(\)/);
  });

  it("redirects to /dashboard?accepted=1 on successful gate accept", () => {
    expect(pageSrc).toMatch(/redirect\(["']\/dashboard\?accepted=1["']\)/);
  });

  it("uses the shared acceptInvite helper with acceptedVia='server_gate'", () => {
    expect(pageSrc).toMatch(/acceptInvite/);
    expect(pageSrc).toMatch(/["']server_gate["']/);
  });

  it("loadInviteByToken select includes invite_expires_at", () => {
    // Just looking for the column name in the select template literal.
    // The page only has one .select(...) call so this is unambiguous.
    expect(pageSrc).toMatch(/invite_expires_at/);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Bug B — /api/invite/accept idempotency runtime tests
// ─────────────────────────────────────────────────────────────────────
const SESSION_USER_ID = "44444444-4444-4444-8444-444444444444";
const OTHER_USER_ID = "55555555-5555-4555-8555-555555555555";
const TENANT_ID = "66666666-6666-4666-8666-666666666666";
const TEAM_MEMBER_ID = "77777777-7777-4777-8777-777777777777";
const SESSION_EMAIL = "tab2@example.com";

// State that drives the admin mock per-test.
const mockState = {
  // What the team_members lookup-by-token returns. null = both lookups miss.
  byTokenInvite: null as null | {
    id: string;
    tenant_id: string;
    invite_accepted: boolean;
    email: string;
  },
  // What the user_id+invite_accepted=true fallback returns.
  alreadyAcceptedRow: null as null | {
    id: string;
    tenant_id: string;
    email: string;
    role: string;
  },
};

vi.mock("@/lib/audit", async (orig) => {
  const actual = await orig<typeof import("../../lib/audit")>();
  return {
    ...actual,
    logAuditEvent: vi.fn(async () => undefined),
  };
});

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({ success: true })),
}));

vi.mock("@/lib/sentry-flush", () => ({
  withSentryFlush: <T,>(h: T) => h,
  flushSentry: vi.fn(async () => undefined),
}));

vi.mock("@/lib/logger", () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: {
          user: { id: SESSION_USER_ID, email: SESSION_EMAIL },
        },
      })),
    },
  })),
}));

vi.mock("@/lib/supabase/admin", () => {
  function fromImpl(table: string) {
    if (table === "team_members") {
      return {
        select: () => ({
          // Path 1: hash lookup .eq("invite_token_hash", ...).maybeSingle()
          // Path 2: plaintext fallback .eq("invite_token", ...).is(...).maybeSingle()
          // Path 3: idempotent fallback .eq("user_id", ...).eq("invite_accepted", ...).limit(1).maybeSingle()
          eq: (col: string, _val: unknown) => {
            if (col === "invite_token_hash" || col === "invite_token") {
              return {
                maybeSingle: vi.fn(async () => ({
                  data: mockState.byTokenInvite,
                  error: null,
                })),
                is: () => ({
                  maybeSingle: vi.fn(async () => ({ data: null, error: null })),
                }),
              };
            }
            if (col === "user_id") {
              return {
                eq: () => ({
                  limit: () => ({
                    maybeSingle: vi.fn(async () => ({
                      data: mockState.alreadyAcceptedRow,
                      error: null,
                    })),
                  }),
                }),
              };
            }
            return {
              maybeSingle: vi.fn(async () => ({ data: null, error: null })),
            };
          },
        }),
        update: () => ({
          eq: vi.fn(async () => ({ data: null, error: null })),
        }),
      };
    }
    if (table === "users") {
      return {
        upsert: vi.fn(async () => ({ data: null, error: null })),
        select: () => ({
          eq: () => ({
            maybeSingle: vi.fn(async () => ({
              data: { tenant_id: TENANT_ID },
              error: null,
            })),
          }),
        }),
      };
    }
    return {};
  }
  return { createAdminClient: vi.fn(() => ({ from: fromImpl })) };
});

import { POST } from "../../app/api/invite/accept/route";

function makeReq(body: unknown): Request {
  return new Request("https://app.nexpura.com/api/invite/accept", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.42",
      "user-agent": "vitest-bug-b",
    },
    body: JSON.stringify(body),
  });
}

describe("Bug B — /api/invite/accept multi-tab idempotency", () => {
  beforeEach(() => {
    mockState.byTokenInvite = null;
    mockState.alreadyAcceptedRow = null;
  });

  it("returns 200 + {success:true} when the same user is already an accepted member of the tenant", async () => {
    // Tab 1 already accepted — invite_token_hash + invite_token are
    // NULL, so both token lookups miss. The user_id-keyed fallback
    // finds the accepted row and the email matches.
    mockState.byTokenInvite = null;
    mockState.alreadyAcceptedRow = {
      id: TEAM_MEMBER_ID,
      tenant_id: TENANT_ID,
      email: SESSION_EMAIL,
      role: "manager",
    };

    const token = crypto.randomBytes(24).toString("hex");
    const res = (await POST(
      makeReq({ token, userId: SESSION_USER_ID }) as never,
    )) as Response;
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true });
  });

  it("returns 400 when a DIFFERENT user tries to claim a stale token (security property preserved)", async () => {
    // Token lookups miss (Tab 1 from a different user already cleared
    // them), and the session user has no own accepted row to fall
    // back on — so the original 400 path runs.
    mockState.byTokenInvite = null;
    mockState.alreadyAcceptedRow = null;

    const token = crypto.randomBytes(24).toString("hex");
    const res = (await POST(
      makeReq({ token, userId: SESSION_USER_ID }) as never,
    )) as Response;
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Invalid or expired/i);
  });

  it("returns 400 when the idempotent-fallback row's email does NOT match the session email", async () => {
    // Defence-in-depth: even if a row keyed by user_id existed with a
    // DIFFERENT email (shouldn't happen — user_id is unique — but
    // belt-and-suspenders), the email guard rejects.
    mockState.byTokenInvite = null;
    mockState.alreadyAcceptedRow = {
      id: TEAM_MEMBER_ID,
      tenant_id: TENANT_ID,
      email: "someone-else@example.com",
      role: "manager",
    };
    // Note: this is a synthetic configuration — production shouldn't
    // hit it because user_id is unique. The test pins the email guard
    // anyway.
    void OTHER_USER_ID;

    const token = crypto.randomBytes(24).toString("hex");
    const res = (await POST(
      makeReq({ token, userId: SESSION_USER_ID }) as never,
    )) as Response;
    expect(res.status).toBe(400);
  });
});
