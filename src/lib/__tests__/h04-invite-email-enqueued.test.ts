/**
 * Behavioural follow-up to h04-invite-consolidation-contract.test.ts.
 *
 * The H-04a QA spec required: "Add a test that asserts an email is
 * enqueued on every successful invite." The static-grep assertion in
 * the sibling contract test only proves the literal `resend.emails.send`
 * appears in the source — it does NOT prove the function gets called
 * on the success path, nor that it's skipped on the insert-failure path.
 *
 * This file drives the canonical `inviteTeamMember` server action
 * end-to-end with mocks for:
 *   - @/lib/email/resend (the Resend client)
 *   - @/lib/supabase/admin (the admin client; smart `from(...)` stub
 *     that returns table-specific chain shapes)
 *   - @/lib/supabase/server (the user-cookie client; supplies a fake
 *     authed user)
 *   - @/lib/auth-context (bypass requireRole)
 *   - @/lib/audit, @/lib/sentry-flush, @/lib/logger, next/cache,
 *     ../email/actions (getTenantEmailSender)
 *
 * Asserts:
 *   1. On success, resend.emails.send is invoked exactly once with the
 *      invitee email as the `to`, the rendered HTML contains the join
 *      URL with the freshly minted invite token, and the subject names
 *      the tenant.
 *   2. On insert failure, resend.emails.send is NOT invoked at all
 *      (the action returns early with the error message).
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";

// ────────────────────────────────────────────────────────────────────
// Mocks. Declared with hoist-safe vi.fn() handles before any module
// import that pulls them in.
// ────────────────────────────────────────────────────────────────────

const sendEmailMock = vi.fn();
vi.mock("@/lib/email/resend", () => ({
  resend: {
    emails: {
      send: (...args: unknown[]) => sendEmailMock(...args),
    },
  },
}));

// Bypass requireRole — no real tenant/role lookup needed.
vi.mock("@/lib/auth-context", () => ({
  requireRole: vi.fn().mockResolvedValue({}),
  requireAuth: vi.fn().mockResolvedValue({}),
}));

// Cookie-bound supabase client used by the action's private
// getAuthContext to read auth.getUser(). We hand back a stable user id;
// the rest of the auth context is sourced through the admin client.
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: { id: "user-1" } },
        error: null,
      }),
    },
  }),
}));

// Smart admin-client stub. Each `from(table)` returns a chainable that
// resolves to whatever the test pre-arranged for that table. We
// override per-test for the negative path (insert returns an error).
type TableHandlers = {
  selectSingle?: () => Promise<{ data: unknown; error: unknown }>;
  selectCount?: () => Promise<{ count: number; error: unknown }>;
  insert?: (row: unknown) => Promise<{ data: unknown; error: unknown }>;
};
const tableHandlers: Record<string, TableHandlers> = {};
const insertCallLog: Array<{ table: string; row: unknown }> = [];

function buildChain(table: string) {
  const handlers = tableHandlers[table] ?? {};
  // .select(cols, opts?).eq(...).eq(...).single() | (await chain)
  // We support both `.single()` and the count-only form
  // `.select("id", { count: "exact", head: true })` which is awaited
  // directly without `.single()`.
  // To keep the chain object thenable for the count case, we attach a
  // `then` that resolves with the count payload when no `.single()`
  // was called, but only if select was called with head:true.
  const make = (kind: "single" | "count") => {
    const obj: {
      eq: (...a: unknown[]) => typeof obj;
      single: () => Promise<{ data: unknown; error: unknown }>;
      then?: (
        onF: (v: { count: number; error: unknown }) => unknown,
      ) => Promise<unknown>;
    } = {
      eq: (..._a: unknown[]) => obj,
      single: async () => {
        if (handlers.selectSingle) return handlers.selectSingle();
        return { data: null, error: null };
      },
    };
    if (kind === "count") {
      obj.then = (onF) =>
        Promise.resolve(
          handlers.selectCount
            ? handlers.selectCount()
            : { count: 0, error: null },
        ).then(onF);
    }
    return obj;
  };

  return {
    select: (_cols?: unknown, opts?: { count?: string; head?: boolean }) => {
      const isCount = !!opts && opts.head === true;
      return make(isCount ? "count" : "single");
    },
    insert: async (row: unknown) => {
      insertCallLog.push({ table, row });
      if (handlers.insert) return handlers.insert(row);
      return { data: null, error: null };
    },
  };
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => buildChain(table),
  }),
}));

// getTenantEmailSender: bypass with a deterministic from/replyTo so the
// action's email payload assertions are stable.
vi.mock("@/app/(app)/settings/email/actions", () => ({
  getTenantEmailSender: async () => ({
    from: "Test Tenant <noreply@test.example>",
    replyTo: "support@test.example",
  }),
}));

vi.mock("@/lib/audit", () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/sentry-flush", () => ({
  flushSentry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/logger", () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Import the real action AFTER all mocks are registered.
import { inviteTeamMember } from "@/app/(app)/settings/roles/actions";

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

function arrangeHappyPath() {
  // users → tenant lookup
  tableHandlers["users"] = {
    selectSingle: async () => ({
      data: { tenant_id: "tenant-1" },
      error: null,
    }),
  };
  // subscriptions → plan
  tableHandlers["subscriptions"] = {
    selectSingle: async () => ({
      data: { plan: "boutique" },
      error: null,
    }),
  };
  // team_members count (head:true) + existing-email lookup + insert
  tableHandlers["team_members"] = {
    selectCount: async () => ({ count: 0, error: null }),
    selectSingle: async () => ({ data: null, error: null }), // no existing
    insert: async () => ({ data: null, error: null }), // success
  };
  // tenants → business name
  tableHandlers["tenants"] = {
    selectSingle: async () => ({
      data: { business_name: "Atelier Lumière" },
      error: null,
    }),
  };
}

beforeEach(() => {
  sendEmailMock.mockReset();
  sendEmailMock.mockResolvedValue({ data: { id: "msg-stub" }, error: null });
  for (const k of Object.keys(tableHandlers)) delete tableHandlers[k];
  insertCallLog.length = 0;
  arrangeHappyPath();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ────────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────────

describe("inviteTeamMember — email enqueue contract (H-04a behavioural)", () => {
  it("enqueues exactly one Resend email on a successful invite", async () => {
    const result = await inviteTeamMember(
      "Test User",
      "test@example.com",
      "staff",
      null,
    );

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(typeof result.inviteToken).toBe("string");

    // The behavioural assertion the QA spec asked for: send was actually
    // called, exactly once.
    expect(sendEmailMock).toHaveBeenCalledTimes(1);

    const payload = sendEmailMock.mock.calls[0][0] as {
      to: string;
      from: string;
      replyTo?: string;
      subject: string;
      html: string;
    };

    // Recipient is the invitee email, normalised to lowercase.
    expect(payload.to).toBe("test@example.com");

    // Sender comes from getTenantEmailSender (the mocked tenant config).
    expect(payload.from).toBe("Test Tenant <noreply@test.example>");
    expect(payload.replyTo).toBe("support@test.example");

    // Subject names the tenant from the tenants row lookup.
    expect(payload.subject).toContain("Atelier Lumière");

    // Body contains the join URL with the freshly minted invite token.
    expect(payload.html).toContain("/invite/");
    expect(payload.html).toContain(result.inviteToken!);
    // And the URL is anchored on the configured app URL fallback or the
    // env value — either way the path component is present.
    expect(payload.html).toMatch(/href="[^"]*\/invite\/[a-f0-9-]+"/i);
  });

  it("normalises the recipient email to lowercase", async () => {
    await inviteTeamMember(
      "Mixed Case",
      "Mixed.Case@Example.COM",
      "staff",
      null,
    );

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const payload = sendEmailMock.mock.calls[0][0] as { to: string };
    expect(payload.to).toBe("mixed.case@example.com");
  });

  it("does NOT enqueue an email when the team_members insert fails", async () => {
    // Arrange the failure path: insert returns an error.
    tableHandlers["team_members"] = {
      selectCount: async () => ({ count: 0, error: null }),
      selectSingle: async () => ({ data: null, error: null }),
      insert: async () => ({
        data: null,
        error: { message: "duplicate key value violates unique constraint" },
      }),
    };

    const result = await inviteTeamMember(
      "Doomed User",
      "doomed@example.com",
      "staff",
      null,
    );

    expect(result.error).toMatch(/duplicate key/i);
    expect(result.success).toBeUndefined();

    // Critical: the email path must be short-circuited if the row didn't
    // land. Otherwise the invitee receives a working-looking link that
    // resolves to no team_members row.
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("does NOT enqueue an email when the invitee email is already a member", async () => {
    // Arrange the duplicate-existing path: the existing-lookup .single()
    // returns a row, so the action returns early before insert+send.
    tableHandlers["team_members"] = {
      selectCount: async () => ({ count: 0, error: null }),
      selectSingle: async () => ({
        data: { id: "tm-existing" },
        error: null,
      }),
    };

    const result = await inviteTeamMember(
      "Already In",
      "exists@example.com",
      "staff",
      null,
    );

    expect(result.error).toMatch(/already exists/i);
    expect(sendEmailMock).not.toHaveBeenCalled();
    // And no insert should have been attempted either.
    expect(
      insertCallLog.find((c) => c.table === "team_members"),
    ).toBeUndefined();
  });
});
