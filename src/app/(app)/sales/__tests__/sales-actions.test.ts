import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Regression tests for C-02 — Sales list page broken.
 *
 * The bug: every list-query failure (legacy service-role JWT revoked,
 * RLS rejection, schema drift, transient PostgREST 5xx) was silently
 * swallowed by `const { data: sales } = await query;` so the UI rendered
 * the empty state, indistinguishable from a tenant with no sales.
 *
 * These tests lock the contract so a future edit can't reintroduce the
 * silent-empty pattern.
 */

// --- Mocks -----------------------------------------------------------------
let mockTenantId: string | null = "tenant-A";
let mockUserId: string | null = "user-1";
const mockHeaders = {
  get: (key: string) => {
    if (key === "x-auth-tenant-id") return mockTenantId;
    if (key === "x-auth-user-id") return mockUserId;
    return null;
  },
};
vi.mock("next/headers", () => ({
  headers: async () => mockHeaders,
}));

// Capture every from(...) call so we can assert tenant scoping.
type FromCall = {
  table: string;
  filters: Array<[string, unknown, unknown?]>;
  selectArgs?: [string, Record<string, unknown>?];
  limit?: number;
  orderCalls?: Array<[string, { ascending: boolean }]>;
};
let lastFromCalls: FromCall[] = [];
let mockFromImpl: (table: string) => unknown = () => ({});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => mockFromImpl(table),
  }),
}));

const mockGetUserLocationIds = vi.fn();
vi.mock("@/lib/locations", () => ({
  getUserLocationIds: (...a: unknown[]) => mockGetUserLocationIds(...a),
}));

const mockLoggerError = vi.fn();
vi.mock("@/lib/logger", () => ({
  default: { error: (...a: unknown[]) => mockLoggerError(...a), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
  logger: { error: (...a: unknown[]) => mockLoggerError(...a), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/lib/sentry-flush", () => ({
  flushSentry: async () => {},
}));

// Helper to build a chainable query mock that records every step.
function makeQueryMock(rows: unknown[] | null, error: { message: string } | null = null, count: number | null = null) {
  const call: FromCall = { table: "", filters: [], orderCalls: [] };
  const chain: Record<string, unknown> = {
    select: (cols: string, opts?: Record<string, unknown>) => {
      call.selectArgs = [cols, opts];
      return chain;
    },
    eq: (col: string, val: unknown) => {
      call.filters.push(["eq", col, val]);
      return chain;
    },
    is: (col: string, val: unknown) => {
      call.filters.push(["is", col, val]);
      return chain;
    },
    in: (col: string, val: unknown) => {
      call.filters.push(["in", col, val]);
      return chain;
    },
    lt: (col: string, val: unknown) => {
      call.filters.push(["lt", col, val]);
      return chain;
    },
    not: (col: string, op: string, val: unknown) => {
      call.filters.push(["not", col, [op, val]]);
      return chain;
    },
    order: (col: string, opts: { ascending: boolean }) => {
      call.orderCalls!.push([col, opts]);
      return chain;
    },
    limit: (n: number) => {
      call.limit = n;
      return chain;
    },
    then: (resolve: (val: { data: unknown[] | null; error: unknown; count?: number | null }) => void) => {
      resolve({ data: rows, error, count });
    },
  };
  return { call, chain };
}

// --- Tests -----------------------------------------------------------------
describe("getSalesPage — C-02 regression contract", () => {
  beforeEach(() => {
    mockTenantId = "tenant-A";
    mockUserId = "user-1";
    lastFromCalls = [];
    mockGetUserLocationIds.mockReset();
    mockLoggerError.mockReset();
  });

  function wireFrom(scriptedResults: Array<{ rows: unknown[] | null; error?: { message: string } | null }>) {
    const queue = [...scriptedResults];
    mockFromImpl = (table: string) => {
      const next = queue.shift() ?? { rows: [] };
      const { call, chain } = makeQueryMock(next.rows, next.error ?? null);
      call.table = table;
      lastFromCalls.push(call);
      return chain;
    };
  }

  it("THROWS instead of silently returning empty list when sales query errors", async () => {
    // The pre-fix bug: error was swallowed and an empty array was returned,
    // making the UI render the empty state. Now we throw so the page's
    // ErrorBoundary surfaces a real failure.
    mockGetUserLocationIds.mockResolvedValue(null); // owner — all-access
    wireFrom([
      { rows: [], error: null }, // locations lookup (showLocationNames=true)
      { rows: null, error: { message: "Legacy API keys are disabled" } }, // sales query
    ]);

    const { getSalesPage } = await import("../sales-actions");
    await expect(getSalesPage(null)).rejects.toThrow(/Failed to load sales/);
    // Sentry telemetry must have fired with required context
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.stringContaining("[sales/list] sales query failed"),
      expect.objectContaining({
        tenantId: "tenant-A",
        userId: "user-1",
        route: "/sales",
        payload_hash: expect.any(String),
      }),
    );
  });

  it("scopes EVERY sales query to the caller's tenant_id (cross-tenant integration)", async () => {
    // Set tenant-A's headers, prove the .eq tenant_id filter is applied
    // and matches A. Then flip to tenant-B and prove B is isolated.
    mockGetUserLocationIds.mockResolvedValue(null);
    wireFrom([
      { rows: [], error: null }, // locations
      { rows: [], error: null }, // sales
    ]);

    const { getSalesPage } = await import("../sales-actions");
    await getSalesPage(null);

    const salesCall = lastFromCalls.find((c) => c.table === "sales");
    expect(salesCall).toBeTruthy();
    expect(salesCall!.filters).toContainEqual(["eq", "tenant_id", "tenant-A"]);
    expect(salesCall!.filters).toContainEqual(["is", "deleted_at", null]);
    // Locations lookup must also be tenant-scoped.
    const locCall = lastFromCalls.find((c) => c.table === "locations");
    expect(locCall!.filters).toContainEqual(["eq", "tenant_id", "tenant-A"]);

    // Switch tenants — same code path, different tenant_id binding.
    mockTenantId = "tenant-B";
    lastFromCalls = [];
    wireFrom([
      { rows: [], error: null }, // locations
      { rows: [], error: null }, // sales
    ]);
    await getSalesPage(null);
    const bCall = lastFromCalls.find((c) => c.table === "sales");
    expect(bCall!.filters).toContainEqual(["eq", "tenant_id", "tenant-B"]);
    // Critical: tenant-B query MUST NOT carry tenant-A's id.
    expect(bCall!.filters).not.toContainEqual(["eq", "tenant_id", "tenant-A"]);
  });

  it("requires authentication — throws when no tenant header", async () => {
    mockTenantId = null;
    const { getSalesPage } = await import("../sales-actions");
    await expect(getSalesPage(null)).rejects.toThrow(/Not authenticated/);
  });

  it("returns empty page (no leak) when location-restricted user has zero allowed locations", async () => {
    // Restricted user with empty allow-list — must NOT fall through to
    // the unfiltered query. Pre-fix: returned [] silently with no marker.
    // Post-fix: still returns empty page (correct behaviour) but the
    // contract is explicit: hasMore=false, nextCursor=null.
    mockGetUserLocationIds.mockResolvedValue([]);
    // With a single (impossible-UUID) allowed location, showLocationNames
    // is false so only the sales query runs.
    wireFrom([
      { rows: [], error: null }, // sales query — filtered to impossible UUID
    ]);

    const { getSalesPage } = await import("../sales-actions");
    const result = await getSalesPage(null);
    expect(result.sales).toEqual([]);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
    // Critical: verify the impossible UUID was actually used (no leak).
    const salesCall = lastFromCalls.find((c) => c.table === "sales");
    expect(salesCall!.filters).toContainEqual([
      "eq",
      "location_id",
      "00000000-0000-0000-0000-000000000000",
    ]);
  });

  it("intersects client-supplied locations with allow-list (restricted user can't widen)", async () => {
    // User allowed = [A, B]; client requests [B, C]; intersection = [B].
    // Pre-fix: same behaviour. Locked here so it doesn't regress.
    mockGetUserLocationIds.mockResolvedValue(["loc-A", "loc-B"]);
    wireFrom([
      { rows: [], error: null }, // locations
      { rows: [], error: null }, // sales
    ]);

    const { getSalesPage } = await import("../sales-actions");
    await getSalesPage(["loc-B", "loc-C"]);
    const salesCall = lastFromCalls.find((c) => c.table === "sales");
    // Single allowed → .eq("location_id", "loc-B")
    expect(salesCall!.filters).toContainEqual(["eq", "location_id", "loc-B"]);
    // Must NEVER carry loc-C even though the client asked for it.
    const allLocFilters = salesCall!.filters.filter((f) => f[1] === "location_id");
    expect(JSON.stringify(allLocFilters)).not.toContain("loc-C");
  });

  it("computes hasMore + nextCursor from limit+1 keyset pagination", async () => {
    // Ask for limit=2; mock returns 3 rows. Expect 2 visible + hasMore=true.
    mockGetUserLocationIds.mockResolvedValue(null);
    const rows = [
      { id: "s3", sale_number: "SALE-3", customer_name: null, customer_email: null, status: "paid", payment_method: "cash", total: 100, amount_paid: 100, sale_date: "2026-05-05", created_at: "2026-05-05T03:00:00Z", location_id: null },
      { id: "s2", sale_number: "SALE-2", customer_name: null, customer_email: null, status: "paid", payment_method: "cash", total: 50, amount_paid: 50, sale_date: "2026-05-04", created_at: "2026-05-04T02:00:00Z", location_id: null },
      { id: "s1", sale_number: "SALE-1", customer_name: null, customer_email: null, status: "paid", payment_method: "cash", total: 25, amount_paid: 25, sale_date: "2026-05-03", created_at: "2026-05-03T01:00:00Z", location_id: null },
    ];
    wireFrom([
      { rows: [], error: null }, // locations
      { rows, error: null }, // sales
    ]);

    const { getSalesPage } = await import("../sales-actions");
    const page = await getSalesPage(null, { limit: 2 });
    expect(page.sales).toHaveLength(2);
    expect(page.sales[0].id).toBe("s3");
    expect(page.sales[1].id).toBe("s2");
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toBe("2026-05-04T02:00:00Z");

    // Verify the limit was sent as limit + 1 (we asked for 2, query gets 3).
    const salesCall = lastFromCalls.find((c) => c.table === "sales");
    expect(salesCall!.limit).toBe(3);
  });

  it("applies cursor as a `lt(created_at, cursor)` filter on subsequent pages", async () => {
    mockGetUserLocationIds.mockResolvedValue(null);
    wireFrom([{ rows: [], error: null }]);

    const { getSalesPage } = await import("../sales-actions");
    await getSalesPage(null, { cursor: "2026-05-04T02:00:00Z", limit: 10 });
    const salesCall = lastFromCalls.find((c) => c.table === "sales");
    expect(salesCall!.filters).toContainEqual(["lt", "created_at", "2026-05-04T02:00:00Z"]);
  });

  it("returns hasMore=false + null cursor when result fits in one page", async () => {
    mockGetUserLocationIds.mockResolvedValue(null);
    wireFrom([
      { rows: [], error: null }, // locations
      { rows: [
        { id: "s1", sale_number: "SALE-1", customer_name: null, customer_email: null, status: "paid", payment_method: "cash", total: 25, amount_paid: 25, sale_date: "2026-05-03", created_at: "2026-05-03T01:00:00Z", location_id: null },
      ], error: null },
    ]);

    const { getSalesPage } = await import("../sales-actions");
    const page = await getSalesPage(null, { limit: 50 });
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
  });

  it("orders by created_at desc with id desc tiebreaker (deterministic pagination)", async () => {
    mockGetUserLocationIds.mockResolvedValue(null);
    wireFrom([
      { rows: [], error: null }, // locations
      { rows: [], error: null }, // sales
    ]);

    const { getSalesPage } = await import("../sales-actions");
    await getSalesPage(null);
    const salesCall = lastFromCalls.find((c) => c.table === "sales");
    expect(salesCall!.orderCalls).toEqual([
      ["created_at", { ascending: false }],
      ["id", { ascending: false }],
    ]);
  });

  it("excludes soft-deleted sales (deleted_at IS NULL)", async () => {
    mockGetUserLocationIds.mockResolvedValue(null);
    wireFrom([
      { rows: [], error: null }, // locations
      { rows: [], error: null }, // sales
    ]);

    const { getSalesPage } = await import("../sales-actions");
    await getSalesPage(null);
    const salesCall = lastFromCalls.find((c) => c.table === "sales");
    expect(salesCall!.filters).toContainEqual(["is", "deleted_at", null]);
  });

  it("logs telemetry (Sentry) with payload_hash but no PII before throwing", async () => {
    // The audit directive: failures must emit Sentry with tenant_id,
    // user_id, route, payload_hash. payload_hash must be a sha256 prefix
    // — short enough to dedupe events, NOT the full payload.
    mockGetUserLocationIds.mockResolvedValue(null);
    wireFrom([
      { rows: [], error: null }, // locations
      { rows: null, error: { message: "boom" } }, // sales
    ]);

    const { getSalesPage } = await import("../sales-actions");
    await expect(getSalesPage(null)).rejects.toThrow();
    expect(mockLoggerError).toHaveBeenCalled();
    const call = mockLoggerError.mock.calls[0];
    const ctx = call[1] as Record<string, unknown>;
    expect(ctx.tenantId).toBe("tenant-A");
    expect(ctx.userId).toBe("user-1");
    expect(ctx.route).toBe("/sales");
    expect(typeof ctx.payload_hash).toBe("string");
    // payload_hash is a 16-char hex prefix of a sha256 — never the raw payload
    expect(ctx.payload_hash).toMatch(/^[a-f0-9]{16}$/);
  });
});

describe("getSales (legacy wrapper) — backwards compat", () => {
  beforeEach(() => {
    mockTenantId = "tenant-A";
    mockUserId = "user-1";
    lastFromCalls = [];
    mockGetUserLocationIds.mockReset();
    mockLoggerError.mockReset();
  });

  function wireFromHere(scriptedResults: Array<{ rows: unknown[] | null; error?: { message: string } | null }>) {
    const queue = [...scriptedResults];
    mockFromImpl = (table: string) => {
      const next = queue.shift() ?? { rows: [] };
      const { call, chain } = makeQueryMock(next.rows, next.error ?? null);
      call.table = table;
      lastFromCalls.push(call);
      return chain;
    };
  }

  it("returns just the rows array (not the page envelope)", async () => {
    mockGetUserLocationIds.mockResolvedValue(null);
    wireFromHere([
      { rows: [], error: null }, // locations
      {
        rows: [
          { id: "s1", sale_number: "SALE-1", customer_name: "Alice", customer_email: null, status: "paid", payment_method: "cash", total: 100, amount_paid: 100, sale_date: "2026-05-05", created_at: "2026-05-05T03:00:00Z", location_id: null },
        ],
        error: null,
      },
    ]);

    const { getSales } = await import("../sales-actions");
    const result = await getSales(null);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("s1");
  });

  it("propagates throws from the underlying query (no longer swallowed)", async () => {
    mockGetUserLocationIds.mockResolvedValue(null);
    wireFromHere([
      { rows: [], error: null }, // locations
      { rows: null, error: { message: "boom" } }, // sales
    ]);

    const { getSales } = await import("../sales-actions");
    await expect(getSales(null)).rejects.toThrow(/Failed to load sales/);
  });
});
