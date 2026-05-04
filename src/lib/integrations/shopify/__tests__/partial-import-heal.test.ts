/**
 * Unit tests for the Shopify partial-import self-healing logic
 * (PR-13, Joey 2026-05-04).
 *
 * Asserts:
 *   1. importOrdersFromShopify marks a sale `import_status='complete'`
 *      when ALL line_items insert successfully.
 *   2. importOrdersFromShopify leaves a sale `import_status='incomplete'`
 *      when ANY line_item insert fails.
 *   3. On resync, an existing sale flagged 'incomplete' enters the
 *      heal path and (on success) gets flipped to 'reconciled'.
 *   4. On resync, an existing sale flagged 'complete' is skipped
 *      cleanly (no extra DB writes for line_items).
 *   5. reconcileIncompleteShopifySale uses the stored
 *      external_reference to fetch the source order + flips the
 *      sale's import_status to 'reconciled' on success.
 *
 * The Supabase admin client is fully mocked here — no DB calls. The
 * mock builds a thenable per-table query chain so the importer's
 * fluent .from(...).select(...).eq(...).maybeSingle() / .single() /
 * .insert(...).select(...).single() / .update(...).eq(...) calls all
 * resolve via the mock. Each test wires per-table behavior.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ----- Mock helper: builds a query-builder stub that records every
// terminal call (insert/update/select with terminal then maybeSingle/
// single) and lets the test assert what was sent.

type TableState = {
  selectResults?: { data: unknown; error: unknown };
  insertResults?: { data: unknown; error: unknown };
  insertResultsByCall?: Array<{ data: unknown; error: unknown }>;
  updateResults?: { data: unknown; error: unknown };
  inserts: unknown[];
  updates: Array<{ patch: unknown; eqArgs: Array<[string, unknown]> }>;
};

function makeAdminMock(tables: Record<string, TableState>) {
  // Per-table insert call counter so insertResultsByCall can advance.
  const insertCallCount: Record<string, number> = {};

  function builder(tableName: string) {
    const state = tables[tableName] || (tables[tableName] = { inserts: [], updates: [] });
    const eqArgs: Array<[string, unknown]> = [];
    let mode: "select" | "insert" | "update" | null = null;
    let pendingPatch: unknown = null;

    const chain: Record<string, (...args: unknown[]) => unknown> = {
      select: (..._args: unknown[]) => {
        if (mode === null) mode = "select";
        return chain;
      },
      eq: (col: string, val: unknown) => {
        eqArgs.push([col, val]);
        return chain;
      },
      like: (_col: string, _val: unknown) => chain,
      order: (_col: string, _opts: unknown) => chain,
      limit: (_n: number) => chain,
      is: (_col: string, _val: unknown) => chain,
      gt: (_col: string, _val: unknown) => chain,
      lt: (_col: string, _val: unknown) => chain,
      neq: (_col: string, _val: unknown) => chain,
      insert: (payload: unknown) => {
        mode = "insert";
        state.inserts.push(payload);
        return chain;
      },
      update: (patch: unknown) => {
        mode = "update";
        pendingPatch = patch;
        return chain;
      },
      // Terminals
      maybeSingle: () => Promise.resolve(state.selectResults ?? { data: null, error: null }),
      single: () => {
        if (mode === "insert") {
          if (state.insertResultsByCall) {
            const idx = insertCallCount[tableName] ?? 0;
            insertCallCount[tableName] = idx + 1;
            return Promise.resolve(state.insertResultsByCall[idx] ?? { data: null, error: null });
          }
          return Promise.resolve(state.insertResults ?? { data: null, error: null });
        }
        return Promise.resolve(state.selectResults ?? { data: null, error: null });
      },
      // Allow `await` on the chain itself for insert/update without .single()
      then: (resolve: (v: unknown) => unknown) => {
        if (mode === "update") {
          state.updates.push({ patch: pendingPatch, eqArgs: [...eqArgs] });
          return resolve(state.updateResults ?? { data: null, error: null });
        }
        if (mode === "insert") {
          if (state.insertResultsByCall) {
            const idx = insertCallCount[tableName] ?? 0;
            insertCallCount[tableName] = idx + 1;
            return resolve(state.insertResultsByCall[idx] ?? { data: null, error: null });
          }
          return resolve(state.insertResults ?? { data: null, error: null });
        }
        return resolve(state.selectResults ?? { data: null, error: null });
      },
    };

    return chain;
  }

  return {
    from: (tableName: string) => builder(tableName),
  } as unknown as ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>;
}

// ---- Mocks at module level — must be hoisted before importing the
// SUT.

const adminMockRef: { current: ReturnType<typeof makeAdminMock> } = {
  current: makeAdminMock({}),
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => adminMockRef.current,
}));

const upsertIntegrationMock = vi.fn().mockResolvedValue(undefined);
const getIntegrationMock = vi.fn();
vi.mock("@/lib/integrations", () => ({
  getIntegration: (...args: unknown[]) => getIntegrationMock(...args),
  upsertIntegration: (...args: unknown[]) => upsertIntegrationMock(...args),
}));

// Sentry — same shape as capture-amplification-alarm test. We don't
// care about flush in these unit tests, but logger.error → captureException
// must not error.
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
  withScope: (cb: (s: { setTag: () => void; setContext: () => void }) => void) =>
    cb({ setTag: () => {}, setContext: () => {} }),
}));

// Stub `fetch` for the Shopify API calls.
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const TENANT_ID = "00000000-0000-0000-0000-000000000001";

beforeEach(() => {
  vi.clearAllMocks();
  getIntegrationMock.mockResolvedValue({
    id: "int1",
    config: {
      shop_domain: "example.myshopify.com",
      access_token: "shpat_xxx",
    },
  });
});

afterEach(() => {
  vi.resetModules();
});

describe("Shopify partial-import self-healing", () => {
  it("marks import_status='complete' when every line_item insert succeeds", async () => {
    const orderPayload = {
      id: 9001,
      name: "#1001",
      created_at: "2026-05-04T00:00:00Z",
      total_price: "10.00",
      financial_status: "paid",
      customer: { id: 1, email: "a@b", first_name: "A", last_name: "B" },
      payment_gateway: "shopify_payments",
      line_items: [
        { id: 1, title: "T1", quantity: 1, price: "5.00", sku: "SKU1" },
        { id: 2, title: "T2", quantity: 1, price: "5.00", sku: "SKU2" },
      ],
    };

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ orders: [orderPayload] }),
    });

    const tables: Record<string, TableState> = {
      sales: {
        selectResults: { data: null, error: null },
        insertResults: { data: { id: "sale-uuid-1" }, error: null },
        updateResults: { data: null, error: null },
        inserts: [],
        updates: [],
      },
      sale_items: {
        insertResults: { data: null, error: null },
        inserts: [],
        updates: [],
      },
      inventory: {
        selectResults: { data: null, error: null },
        inserts: [],
        updates: [],
      },
      integrations: { updateResults: { data: null, error: null }, inserts: [], updates: [] },
      activity_log: { insertResults: { data: null, error: null }, inserts: [], updates: [] },
    };
    adminMockRef.current = makeAdminMock(tables);

    const { importOrdersFromShopify } = await import("../sync");
    const res = await importOrdersFromShopify(TENANT_ID);

    expect(res.success).toBe(true);
    expect(tables.sale_items.inserts.length).toBe(2);
    expect(tables.sales.inserts.length).toBe(1);
    expect((tables.sales.inserts[0] as { import_status: string }).import_status).toBe("incomplete");
    const completeUpdate = tables.sales.updates.find(
      (u) => (u.patch as { import_status?: string }).import_status === "complete",
    );
    expect(completeUpdate).toBeDefined();
  });

  it("leaves import_status='incomplete' when a line_item insert fails", async () => {
    const orderPayload = {
      id: 9002,
      name: "#1002",
      created_at: "2026-05-04T00:00:00Z",
      total_price: "10.00",
      financial_status: "paid",
      customer: null,
      payment_gateway: "shopify_payments",
      line_items: [
        { id: 1, title: "T1", quantity: 1, price: "5.00", sku: "SKU1" },
        { id: 2, title: "T2", quantity: 1, price: "5.00", sku: "SKU2" },
      ],
    };

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ orders: [orderPayload] }),
    });

    const tables: Record<string, TableState> = {
      sales: {
        selectResults: { data: null, error: null },
        insertResults: { data: { id: "sale-uuid-2" }, error: null },
        updateResults: { data: null, error: null },
        inserts: [],
        updates: [],
      },
      sale_items: {
        insertResultsByCall: [
          { data: null, error: null },
          { data: null, error: { message: "FK violation" } },
        ],
        inserts: [],
        updates: [],
      },
      inventory: { selectResults: { data: null, error: null }, inserts: [], updates: [] },
      integrations: { updateResults: { data: null, error: null }, inserts: [], updates: [] },
      activity_log: { insertResults: { data: null, error: null }, inserts: [], updates: [] },
    };
    adminMockRef.current = makeAdminMock(tables);

    const { importOrdersFromShopify } = await import("../sync");
    const res = await importOrdersFromShopify(TENANT_ID);

    expect(res.success).toBe(true);
    expect(tables.sale_items.inserts.length).toBe(2);
    expect((tables.sales.inserts[0] as { import_status: string }).import_status).toBe("incomplete");
    const completeUpdate = tables.sales.updates.find(
      (u) => (u.patch as { import_status?: string }).import_status === "complete",
    );
    expect(completeUpdate).toBeUndefined();
    expect(res.errors?.some((e) => e.includes("line 2"))).toBe(true);
  });

  it("skips an already-complete sale on resync (no line_item inserts)", async () => {
    const orderPayload = {
      id: 9003,
      name: "#1003",
      created_at: "2026-05-04T00:00:00Z",
      total_price: "10.00",
      financial_status: "paid",
      customer: null,
      payment_gateway: "shopify_payments",
      line_items: [{ id: 1, title: "T1", quantity: 1, price: "10.00", sku: "SKU1" }],
    };

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ orders: [orderPayload] }),
    });

    const tables: Record<string, TableState> = {
      sales: {
        selectResults: { data: { id: "sale-uuid-3", import_status: "complete" }, error: null },
        inserts: [],
        updates: [],
      },
      sale_items: { inserts: [], updates: [] },
      inventory: { selectResults: { data: null, error: null }, inserts: [], updates: [] },
      integrations: { updateResults: { data: null, error: null }, inserts: [], updates: [] },
      activity_log: { insertResults: { data: null, error: null }, inserts: [], updates: [] },
    };
    adminMockRef.current = makeAdminMock(tables);

    const { importOrdersFromShopify } = await import("../sync");
    const res = await importOrdersFromShopify(TENANT_ID);

    expect(res.success).toBe(true);
    expect(tables.sales.inserts.length).toBe(0);
    expect(tables.sale_items.inserts.length).toBe(0);
    expect(tables.sales.updates.length).toBe(0);
  });

  it("heals an existing 'incomplete' sale on resync (incomplete → reconciled)", async () => {
    const orderPayload = {
      id: 9004,
      name: "#1004",
      created_at: "2026-05-04T00:00:00Z",
      total_price: "20.00",
      financial_status: "paid",
      customer: null,
      payment_gateway: "shopify_payments",
      line_items: [
        { id: 1, title: "T1", quantity: 1, price: "10.00", sku: "SKU1" },
        { id: 2, title: "T2", quantity: 1, price: "10.00", sku: "SKU2" },
      ],
    };

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ orders: [orderPayload] }),
    });

    const tables: Record<string, TableState> = {
      sales: {
        selectResults: { data: { id: "sale-uuid-4", import_status: "incomplete" }, error: null },
        updateResults: { data: null, error: null },
        inserts: [],
        updates: [],
      },
      sale_items: {
        insertResults: { data: null, error: null },
        inserts: [],
        updates: [],
      },
      inventory: { selectResults: { data: null, error: null }, inserts: [], updates: [] },
      integrations: { updateResults: { data: null, error: null }, inserts: [], updates: [] },
      activity_log: { insertResults: { data: null, error: null }, inserts: [], updates: [] },
    };
    adminMockRef.current = makeAdminMock(tables);

    const { importOrdersFromShopify } = await import("../sync");
    const res = await importOrdersFromShopify(TENANT_ID);

    expect(res.success).toBe(true);
    expect(tables.sales.inserts.length).toBe(0);
    expect(tables.sale_items.inserts.length).toBe(2);
    const reconciledUpdate = tables.sales.updates.find(
      (u) => (u.patch as { import_status?: string }).import_status === "reconciled",
    );
    expect(reconciledUpdate).toBeDefined();
  });

  it("reconcileIncompleteShopifySale fetches by id and flips status to 'reconciled' on success", async () => {
    const orderPayload = {
      id: 9005,
      name: "#1005",
      created_at: "2026-05-04T00:00:00Z",
      total_price: "5.00",
      financial_status: "paid",
      customer: null,
      payment_gateway: "shopify_payments",
      line_items: [{ id: 1, title: "T1", quantity: 1, price: "5.00", sku: "SKU1" }],
    };

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ order: orderPayload }),
    });

    const tables: Record<string, TableState> = {
      sales: {
        updateResults: { data: null, error: null },
        inserts: [],
        updates: [],
      },
      sale_items: {
        insertResults: { data: null, error: null },
        inserts: [],
        updates: [],
      },
      inventory: { selectResults: { data: null, error: null }, inserts: [], updates: [] },
    };
    adminMockRef.current = makeAdminMock(tables);

    const { reconcileIncompleteShopifySale } = await import("../sync");
    const res = await reconcileIncompleteShopifySale(TENANT_ID, {
      id: "sale-uuid-5",
      external_reference: "shopify_9005",
    });

    expect(res.status).toBe("reconciled");
    expect(tables.sale_items.inserts.length).toBe(1);
    const reconciledUpdate = tables.sales.updates.find(
      (u) => (u.patch as { import_status?: string }).import_status === "reconciled",
    );
    expect(reconciledUpdate).toBeDefined();
  });

  it("reconcileIncompleteShopifySale returns 'unrecoverable' when external_reference is not shopify_*", async () => {
    const { reconcileIncompleteShopifySale } = await import("../sync");
    const res = await reconcileIncompleteShopifySale(TENANT_ID, {
      id: "sale-uuid-6",
      external_reference: null,
    });
    expect(res.status).toBe("unrecoverable");
  });
});
