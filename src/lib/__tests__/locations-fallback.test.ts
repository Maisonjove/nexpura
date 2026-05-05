import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Contract test for the C-02 fallback in getUserLocationIds.
 *
 * Pre-fix: getUserLocationIds returned [] when no team_members row
 * existed for (user_id, tenant_id), regardless of public.users.role.
 * That [] propagated through resolveReadLocationScope into getSales
 * (sales-actions.ts:51) where the empty-array branch substituted the
 * impossible UUID '00000000-…' as the location filter — collapsing
 * the list to zero rows for any tenant owner created by onboarding
 * before this PR landed.
 *
 * Post-fix: when no team_members row exists, we look up
 * public.users.role for the same user; if owner/manager AND the row's
 * tenant_id matches the requested tenant, treat as all-access (return
 * null). Anyone else still gets the existing zero-allow-list behaviour.
 *
 * The 4 cases below cover the surface area Joey asked for in the
 * spec — see the PR description for the full diagnosis.
 */

// ── Mock surface ──────────────────────────────────────────────────
//
// getUserLocationIds reads from two tables (team_members and users)
// via createAdminClient(). We mock the from(table).select(...).eq(...)
// .maybeSingle()/.single() chains directly so each test can stage the
// rows it cares about without touching a real DB.

interface FromShape {
  table: string;
  selectArg?: string;
  eqs: Array<{ col: string; val: unknown }>;
  result: { data: unknown; error: unknown };
}

let stagedQueries: FromShape[] = [];

function makeBuilder(table: string): {
  select: (s?: string) => unknown;
} {
  // Per-call shape; we look up the matching staged result by .eq() chain.
  const eqs: Array<{ col: string; val: unknown }> = [];
  let selectArg: string | undefined;

  const builder = {
    select(s?: string) {
      selectArg = s;
      return chain;
    },
  };

  const chain = {
    eq(col: string, val: unknown) {
      eqs.push({ col, val });
      return chain;
    },
    single() {
      return resolveStaged();
    },
    maybeSingle() {
      return resolveStaged();
    },
  };

  function resolveStaged() {
    const match = stagedQueries.find(
      (q) =>
        q.table === table &&
        eqs.every((e) =>
          q.eqs.some((qe) => qe.col === e.col && qe.val === e.val),
        ) &&
        eqs.length === q.eqs.length,
    );
    if (!match) {
      return Promise.resolve({ data: null, error: null });
    }
    void selectArg; // tracked for potential future asserts
    return Promise.resolve(match.result);
  }

  return builder as unknown as { select: (s?: string) => unknown };
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => makeBuilder(table),
  }),
}));

vi.mock("@/lib/logger", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { getUserLocationIds } from "../locations";

const USER_ID = "user-1111-1111";
const TENANT_ID = "tenant-2222-2222";
const OTHER_TENANT_ID = "tenant-9999-9999";

describe("getUserLocationIds — C-02 fallback", () => {
  beforeEach(() => {
    stagedQueries = [];
  });

  it("returns null (all-access) when no team_members row + users.role=owner + tenant matches", async () => {
    // No team_members row staged → builder returns { data: null }.
    stagedQueries.push({
      table: "users",
      eqs: [{ col: "id", val: USER_ID }],
      result: { data: { role: "owner", tenant_id: TENANT_ID }, error: null },
    });

    const r = await getUserLocationIds(USER_ID, TENANT_ID);
    expect(r).toBeNull();
  });

  it("returns null when no team_members row + users.role=manager + tenant matches", async () => {
    stagedQueries.push({
      table: "users",
      eqs: [{ col: "id", val: USER_ID }],
      result: { data: { role: "manager", tenant_id: TENANT_ID }, error: null },
    });

    const r = await getUserLocationIds(USER_ID, TENANT_ID);
    expect(r).toBeNull();
  });

  it("returns [] when no team_members row + users.role=staff (NOT owner/manager)", async () => {
    // Staff role without team_members row — the fallback must NOT
    // grant all-access. Caller produces empty result.
    stagedQueries.push({
      table: "users",
      eqs: [{ col: "id", val: USER_ID }],
      result: { data: { role: "staff", tenant_id: TENANT_ID }, error: null },
    });

    const r = await getUserLocationIds(USER_ID, TENANT_ID);
    expect(r).toEqual([]);
  });

  it("returns [] when no team_members row + users.role=owner BUT tenant_id mismatches", async () => {
    // Cross-tenant safety: owner of tenant A asking about tenant B's
    // scope must NOT be treated as all-access on B. Without this
    // check the fallback would leak access across tenants.
    stagedQueries.push({
      table: "users",
      eqs: [{ col: "id", val: USER_ID }],
      result: { data: { role: "owner", tenant_id: OTHER_TENANT_ID }, error: null },
    });

    const r = await getUserLocationIds(USER_ID, TENANT_ID);
    expect(r).toEqual([]);
  });

  it("returns [] when no team_members row + users row also missing", async () => {
    // No fallback signal — same legacy behaviour, returns [].
    const r = await getUserLocationIds(USER_ID, TENANT_ID);
    expect(r).toEqual([]);
  });

  it("returns null when team_members.role=owner (legacy all-access path unchanged)", async () => {
    stagedQueries.push({
      table: "team_members",
      eqs: [
        { col: "user_id", val: USER_ID },
        { col: "tenant_id", val: TENANT_ID },
      ],
      result: { data: { role: "owner", allowed_location_ids: null }, error: null },
    });

    const r = await getUserLocationIds(USER_ID, TENANT_ID);
    expect(r).toBeNull();
  });

  it("returns array when team_members.role=staff with allowed_location_ids set", async () => {
    stagedQueries.push({
      table: "team_members",
      eqs: [
        { col: "user_id", val: USER_ID },
        { col: "tenant_id", val: TENANT_ID },
      ],
      result: {
        data: { role: "staff", allowed_location_ids: ["loc-A", "loc-B"] },
        error: null,
      },
    });

    const r = await getUserLocationIds(USER_ID, TENANT_ID);
    expect(r).toEqual(["loc-A", "loc-B"]);
  });
});
