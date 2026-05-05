/**
 * C-05 canary integration test.
 *
 * The QA agent's brief specifies:
 *   "When the activity-log middleware ships, the invite-accept handler
 *    needs to be on the allow-list of writes that emit. The very first
 *    thing the new manager does (accepting their invite) should show up
 *    in /settings/activity. That's our canary."
 *
 * This test stubs the Supabase admin + SSR clients to simulate a happy-
 * path invite acceptance, then asserts that:
 *   1. The handler returns 200.
 *   2. logAuditEvent was called exactly once.
 *   3. The emitted row has action="team_member_invite",
 *      entityType="team_member", entityId=invite row id,
 *      tenantId=invite.tenant_id, userId=session user id.
 *
 * If this test fails, the canary route is no longer auditing — which
 * means the wrapper or the route wiring is broken. Treat as a hard
 * regression gate.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "node:crypto";

// --- Mocks ---------------------------------------------------------
//
// Note: vi.mock factories are hoisted to the top of the file, so they
// cannot reference module-scope `const`s. Anything that needs to be
// shared between mock + test must be exposed via `vi.hoisted()`.

// UUIDs must be valid v1-v8 (zod's uuid validator); see RFC 4122. The
// version nibble is the first hex of the third group; `4xxx` is v4.
const hoisted = vi.hoisted(() => ({
  SESSION_USER_ID: "11111111-1111-4111-8111-111111111111",
  TENANT_ID: "22222222-2222-4222-8222-222222222222",
  TEAM_MEMBER_ID: "33333333-3333-4333-8333-333333333333",
  SESSION_EMAIL: "newmanager@example.com",
  mockedLogAuditEvent: vi.fn(async () => undefined),
}));

// SESSION_EMAIL only used inside hoisted mock factories — no top-level alias.
const {
  SESSION_USER_ID,
  TENANT_ID,
  TEAM_MEMBER_ID,
  mockedLogAuditEvent,
} = hoisted;

vi.mock("@/lib/audit", async (orig) => {
  const actual = await orig<typeof import("../../../../../lib/audit")>();
  return {
    ...actual,
    logAuditEvent: hoisted.mockedLogAuditEvent,
  };
});

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({ success: true })),
}));

vi.mock("@/lib/sentry-flush", () => ({
  // Identity wrapper — the real one drains the Sentry buffer; in tests
  // we just want the inner handler to run.
  withSentryFlush: <T,>(h: T) => h,
  flushSentry: vi.fn(async () => undefined),
}));

vi.mock("@/lib/logger", () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

// SSR client returns a session for the invited user.
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: {
          user: { id: hoisted.SESSION_USER_ID, email: hoisted.SESSION_EMAIL },
        },
      })),
    },
  })),
}));

// Admin client. We need:
//   - team_members.select(...).eq('invite_token_hash', ...).maybeSingle()
//     → returns the invite row.
//   - users.upsert(...)              → succeeds.
//   - team_members.update(...).eq()  → succeeds.
//   - users.select('tenant_id').eq().maybeSingle() → fallback path
//     for the wrapper if it ever needs it.
vi.mock("@/lib/supabase/admin", () => {
  const inviteRow = {
    id: hoisted.TEAM_MEMBER_ID,
    tenant_id: hoisted.TENANT_ID,
    name: "New Manager",
    email: hoisted.SESSION_EMAIL,
    role: "manager",
    permissions: {},
    allowed_location_ids: [],
    invite_accepted: false,
    invite_expires_at: new Date(Date.now() + 60_000).toISOString(),
    invite_token_hash: null as string | null,
  };

  function fromImpl(table: string) {
    if (table === "team_members") {
      return {
        select: () => ({
          eq: (_col: string, _val: string) => ({
            maybeSingle: vi.fn(async () => ({ data: inviteRow, error: null })),
            // Chained .is() after .eq() (legacy fallback path)
            is: () => ({
              maybeSingle: vi.fn(async () => ({ data: null, error: null })),
            }),
          }),
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
              data: { tenant_id: hoisted.TENANT_ID },
              error: null,
            })),
          }),
        }),
      };
    }
    return {};
  }

  return {
    createAdminClient: vi.fn(() => ({ from: fromImpl })),
  };
});

// --- Test ---------------------------------------------------------

import { POST } from "../route";

function makeReq(body: unknown): Request {
  return new Request("https://app.nexpura.com/api/invite/accept", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.42",
      "user-agent": "vitest-canary",
    },
    body: JSON.stringify(body),
  });
}

describe("C-05 canary — /api/invite/accept emits to audit_logs", () => {
  beforeEach(() => {
    mockedLogAuditEvent.mockClear();
  });

  it("emits team_member_invite on successful acceptance", async () => {
    // The route looks up by invite_token_hash first (sha256 of token).
    // We don't actually test the lookup — the admin mock returns the
    // invite row regardless of the hash — but we still pass a valid
    // token so the schema parser is happy.
    const token = crypto.randomBytes(24).toString("hex");
    const req = makeReq({ token, userId: SESSION_USER_ID });

    const res = (await POST(req as never)) as Response;
    expect(res.status).toBe(200);

    // Canary assertion — logAuditEvent called exactly once.
    expect(mockedLogAuditEvent).toHaveBeenCalledTimes(1);

    const emitted = mockedLogAuditEvent.mock.calls[0]![0];
    expect(emitted.action).toBe("team_member_invite");
    expect(emitted.entityType).toBe("team_member");
    expect(emitted.entityId).toBe(TEAM_MEMBER_ID);
    expect(emitted.tenantId).toBe(TENANT_ID);
    expect(emitted.userId).toBe(SESSION_USER_ID);
    // Metadata enriched by the wrapper.
    expect(emitted.metadata).toMatchObject({
      route: "/api/invite/accept",
      source: "route_wrapper",
      canary: "invite_accept",
    });
  });

  it("does NOT emit when the body fails schema validation", async () => {
    const res = (await POST(
      makeReq({ token: "x", userId: "not-a-uuid" }) as never
    )) as Response;
    expect(res.status).toBe(400);
    expect(mockedLogAuditEvent).not.toHaveBeenCalled();
  });
});
