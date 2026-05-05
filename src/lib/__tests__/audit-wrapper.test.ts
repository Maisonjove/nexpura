/**
 * Unit tests for withAuditLog (C-05).
 *
 * The wrapper is the route-level half of the audit log auto-emit.
 * Behaviour we lock in:
 *   1. 2xx response → emits exactly one logAuditEvent call.
 *   2. Non-2xx response → no emit (the user's request didn't actually
 *      mutate; we don't want failed POSTs in the activity feed).
 *   3. Handler throws → no emit, error propagates.
 *   4. extract() returning null → emit is suppressed (explicit no-op).
 *   5. AUDIT_CONTEXT_HEADER set by handler → wrapper reads it, then
 *      strips it from the response before returning.
 *   6. logAuditEvent throwing → wrapper swallows, response unchanged.
 *   7. metadata is merged with route + source markers.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted module mocks. Wrapper imports logAuditEvent and the SSR
// supabase client; both are stubbed so the test runs offline.
vi.mock("../audit", () => ({
  logAuditEvent: vi.fn(async () => undefined),
}));

vi.mock("../supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: "user-abc-123" } },
      })),
    },
  })),
}));

vi.mock("../supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: vi.fn(async () => ({
            data: { tenant_id: "tenant-fallback" },
          })),
        }),
      }),
    }),
  })),
}));

vi.mock("../logger", () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

// Import AFTER the mocks so the wrapper picks up the mocked deps.
import {
  withAuditLog,
  setAuditContext,
  AUDIT_CONTEXT_HEADER,
  AUDIT_OPT_IN_ROUTES,
} from "../audit-wrapper";
import { logAuditEvent } from "../audit";

const mockedEmit = vi.mocked(logAuditEvent);

function makeRequest(url = "https://app.nexpura.com/api/invite/accept") {
  // Minimal NextRequest-shaped stub. The wrapper only reads `.url`.
  return { url } as unknown as Parameters<
    Parameters<typeof withAuditLog>[0]
  >[0];
}

describe("withAuditLog", () => {
  beforeEach(() => {
    mockedEmit.mockClear();
  });

  it("emits one audit row on a 200 response", async () => {
    const handler = vi.fn(async () => {
      const r = new Response(JSON.stringify({ ok: true }), { status: 200 });
      setAuditContext(r, {
        tenantId: "tenant-1",
        entityId: "row-1",
        newData: { foo: "bar" },
      });
      return r;
    });

    const wrapped = withAuditLog(handler, {
      action: "team_member_invite",
      entityType: "team_member",
    });

    const res = await wrapped(makeRequest());
    expect(res.status).toBe(200);
    expect(mockedEmit).toHaveBeenCalledTimes(1);

    const call = mockedEmit.mock.calls[0]![0];
    expect(call.action).toBe("team_member_invite");
    expect(call.entityType).toBe("team_member");
    expect(call.tenantId).toBe("tenant-1");
    expect(call.entityId).toBe("row-1");
    // userId resolved from session
    expect(call.userId).toBe("user-abc-123");
    // metadata enriched with route + source
    expect(call.metadata).toMatchObject({
      route: "/api/invite/accept",
      source: "route_wrapper",
    });
  });

  it("does NOT emit on non-2xx responses (4xx)", async () => {
    const handler = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: "bad" }), { status: 400 })
    );
    const wrapped = withAuditLog(handler, {
      action: "team_member_invite",
      entityType: "team_member",
    });
    await wrapped(makeRequest());
    expect(mockedEmit).not.toHaveBeenCalled();
  });

  it("does NOT emit on non-2xx responses (5xx)", async () => {
    const handler = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: "boom" }), { status: 500 })
    );
    const wrapped = withAuditLog(handler, {
      action: "team_member_invite",
      entityType: "team_member",
    });
    await wrapped(makeRequest());
    expect(mockedEmit).not.toHaveBeenCalled();
  });

  it("does NOT emit when handler throws — re-throws the error", async () => {
    const handler = vi.fn(async () => {
      throw new Error("kaboom");
    });
    const wrapped = withAuditLog(handler, {
      action: "team_member_invite",
      entityType: "team_member",
    });
    await expect(wrapped(makeRequest())).rejects.toThrow("kaboom");
    expect(mockedEmit).not.toHaveBeenCalled();
  });

  it("respects extract() returning null (explicit skip)", async () => {
    const handler = vi.fn(
      async () => new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const wrapped = withAuditLog(handler, {
      action: "team_member_invite",
      entityType: "team_member",
      extract: () => null,
    });
    await wrapped(makeRequest());
    expect(mockedEmit).not.toHaveBeenCalled();
  });

  it("strips the AUDIT_CONTEXT_HEADER from the response before returning", async () => {
    const handler = vi.fn(async () => {
      const r = new Response(null, { status: 200 });
      setAuditContext(r, { tenantId: "tenant-1" });
      return r;
    });
    const wrapped = withAuditLog(handler, {
      action: "team_member_invite",
      entityType: "team_member",
    });
    const res = await wrapped(makeRequest());
    // Header should NOT leak to the public response.
    expect(res.headers.get(AUDIT_CONTEXT_HEADER)).toBeNull();
  });

  it("falls back to user.tenant_id when no extractor and no header", async () => {
    const handler = vi.fn(
      async () => new Response(null, { status: 200 })
    );
    const wrapped = withAuditLog(handler, {
      action: "settings_update",
      entityType: "settings",
    });
    await wrapped(makeRequest());
    expect(mockedEmit).toHaveBeenCalledTimes(1);
    expect(mockedEmit.mock.calls[0]![0].tenantId).toBe("tenant-fallback");
  });

  it("swallows logAuditEvent errors — response is unchanged", async () => {
    mockedEmit.mockRejectedValueOnce(new Error("audit insert failed"));
    const handler = vi.fn(async () => {
      const r = new Response(JSON.stringify({ ok: true }), { status: 200 });
      setAuditContext(r, { tenantId: "tenant-1" });
      return r;
    });
    const wrapped = withAuditLog(handler, {
      action: "team_member_invite",
      entityType: "team_member",
    });
    // Should NOT throw — audit is observability.
    const res = await wrapped(makeRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("uses userIdOverride when provided", async () => {
    const handler = vi.fn(async () => {
      const r = new Response(null, { status: 200 });
      setAuditContext(r, {
        tenantId: "tenant-1",
        userIdOverride: "delegated-user-789",
      });
      return r;
    });
    const wrapped = withAuditLog(handler, {
      action: "team_member_invite",
      entityType: "team_member",
    });
    await wrapped(makeRequest());
    expect(mockedEmit.mock.calls[0]![0].userId).toBe("delegated-user-789");
  });

  it("AUDIT_OPT_IN_ROUTES contains the invite-accept canary", () => {
    // Documentation invariant — the canary route must appear in the
    // allow-list constant or future contributors lose the breadcrumb.
    const canary = AUDIT_OPT_IN_ROUTES.find(
      (r) => r.path === "/api/invite/accept"
    );
    expect(canary).toBeDefined();
    expect(canary?.action).toBe("team_member_invite");
  });
});
