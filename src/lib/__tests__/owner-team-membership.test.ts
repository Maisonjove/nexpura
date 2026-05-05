import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Unit tests for the C-02 ensureOwnerTeamMembership helper.
 *
 * Idempotent contract: the helper must
 *   - SKIP the insert when a (tenant_id, user_id) row already exists
 *   - INSERT (and return inserted=true) when no row exists
 *   - THROW when the insert itself errors (caller owns rollback)
 *
 * The helper is the single point that closes the upstream gap in
 * (auth)/onboarding/actions.ts (the missing "step 2.5"). It's also
 * the same code path used by /onboarding's self-heal branch when an
 * already-onboarded user revisits — so existing affected tenants get
 * their row written without rerunning the standalone backfill script.
 */

vi.mock("@/lib/logger", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { ensureOwnerTeamMembership } from "../owner-team-membership";

interface FakeAdmin {
  from: (table: string) => unknown;
}

function buildAdmin(opts: {
  existingTeamMember: { id: string } | null;
  insertResult: { data: { id: string } | null; error: { message: string } | null };
}): { admin: FakeAdmin; insertCalls: unknown[] } {
  const insertCalls: unknown[] = [];

  const teamMembersBuilder = {
    select() {
      return {
        eq() {
          return {
            eq() {
              return {
                maybeSingle: () =>
                  Promise.resolve({ data: opts.existingTeamMember, error: null }),
              };
            },
          };
        },
      };
    },
    insert(payload: unknown) {
      insertCalls.push(payload);
      return {
        select() {
          return {
            single: () => Promise.resolve(opts.insertResult),
          };
        },
      };
    },
  };

  const admin: FakeAdmin = {
    from(table: string) {
      if (table === "team_members") return teamMembersBuilder;
      throw new Error(`unexpected from(${table})`);
    },
  };
  return { admin, insertCalls };
}

const PARAMS = {
  tenantId: "tenant-1",
  userId: "user-1",
  email: "owner@example.com",
  role: "owner" as const,
  sourceMarker: "test_source_marker",
};

describe("ensureOwnerTeamMembership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips insert when (tenant_id, user_id) row already exists", async () => {
    const { admin, insertCalls } = buildAdmin({
      existingTeamMember: { id: "existing-row-id" },
      insertResult: { data: null, error: null },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await ensureOwnerTeamMembership(admin as any, PARAMS);

    expect(result).toEqual({ inserted: false, rowId: "existing-row-id" });
    expect(insertCalls).toHaveLength(0);
  });

  it("inserts a new row with the canonical owner shape when none exists", async () => {
    const { admin, insertCalls } = buildAdmin({
      existingTeamMember: null,
      insertResult: { data: { id: "new-row-id" }, error: null },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await ensureOwnerTeamMembership(admin as any, PARAMS);

    expect(result).toEqual({ inserted: true, rowId: "new-row-id" });
    expect(insertCalls).toHaveLength(1);
    const payload = insertCalls[0] as Record<string, unknown>;
    expect(payload.tenant_id).toBe("tenant-1");
    expect(payload.user_id).toBe("user-1");
    expect(payload.role).toBe("owner");
    expect(payload.email).toBe("owner@example.com");
    // Owner gets all-access (canonical contract — null = all locations).
    expect(payload.allowed_location_ids).toBeNull();
    // Pre-existing relationship — not an outstanding invite.
    expect(payload.invite_accepted).toBe(true);
    // Audit-trail provenance written into permissions jsonb.
    expect(payload.permissions).toMatchObject({
      _provenance: expect.objectContaining({ source: "test_source_marker" }),
    });
  });

  it("throws when the insert itself errors (caller owns rollback)", async () => {
    const { admin } = buildAdmin({
      existingTeamMember: null,
      insertResult: { data: null, error: { message: "duplicate key value" } },
    });

    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ensureOwnerTeamMembership(admin as any, PARAMS),
    ).rejects.toThrow(/team_members insert failed: duplicate key value/);
  });

  it("uses 'Manager' name when role=manager", async () => {
    const { admin, insertCalls } = buildAdmin({
      existingTeamMember: null,
      insertResult: { data: { id: "row-id" }, error: null },
    });

    await ensureOwnerTeamMembership(admin as unknown as Parameters<typeof ensureOwnerTeamMembership>[0], {
      ...PARAMS,
      role: "manager",
    });

    const payload = insertCalls[0] as Record<string, unknown>;
    expect(payload.role).toBe("manager");
    expect(payload.name).toBe("Manager");
  });
});
