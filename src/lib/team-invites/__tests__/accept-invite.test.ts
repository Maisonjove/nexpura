/**
 * Helper unit tests for acceptInvite (Phase A follow-up, 2026-05-06).
 *
 * Coverage:
 *   - Happy path: valid manager invite → success
 *   - Role mapping: technician role → users.role='staff' (PR #208 Q5)
 *   - Pass-through roles: owner / manager / staff preserved
 *   - Error paths: users.upsert failure → {error, status:500}
 *   - Error paths: team_members.update failure → {error, status:500}
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { acceptInvite, type InviteRow } from "../accept-invite";

vi.mock("@/lib/logger", () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

const USER_ID = "11111111-1111-4111-8111-111111111111";
const TENANT_ID = "22222222-2222-4222-8222-222222222222";
const TEAM_MEMBER_ID = "33333333-3333-4333-8333-333333333333";

interface MockState {
  upsertCalls: Array<{ row: Record<string, unknown>; opts: unknown }>;
  upsertError: { message: string } | null;
  updateCalls: Array<{ patch: Record<string, unknown>; whereId: string }>;
  updateError: { message: string } | null;
}

function makeAdmin(state: MockState): SupabaseClient {
  return {
    from(table: string) {
      if (table === "users") {
        return {
          upsert: (
            row: Record<string, unknown>,
            opts: unknown,
          ) => {
            state.upsertCalls.push({ row, opts });
            return Promise.resolve({
              data: null,
              error: state.upsertError,
            });
          },
        } as unknown as ReturnType<SupabaseClient["from"]>;
      }
      if (table === "team_members") {
        return {
          update: (patch: Record<string, unknown>) => ({
            eq: (_col: string, val: string) => {
              state.updateCalls.push({ patch, whereId: val });
              return Promise.resolve({
                data: null,
                error: state.updateError,
              });
            },
          }),
        } as unknown as ReturnType<SupabaseClient["from"]>;
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  } as unknown as SupabaseClient;
}

function freshState(): MockState {
  return {
    upsertCalls: [],
    upsertError: null,
    updateCalls: [],
    updateError: null,
  };
}

function inviteFor(role: string): InviteRow {
  return {
    id: TEAM_MEMBER_ID,
    tenant_id: TENANT_ID,
    name: "Test User",
    email: "test@example.com",
    role,
  };
}

describe("acceptInvite — happy paths", () => {
  let state: MockState;
  beforeEach(() => {
    state = freshState();
  });

  it("returns success on valid manager invite + writes both rows", async () => {
    const result = await acceptInvite(
      makeAdmin(state),
      inviteFor("manager"),
      USER_ID,
      "server_gate",
    );
    expect(result).toEqual({ success: true });
    expect(state.upsertCalls).toHaveLength(1);
    expect(state.updateCalls).toHaveLength(1);
    expect(state.upsertCalls[0]!.row).toMatchObject({
      id: USER_ID,
      tenant_id: TENANT_ID,
      role: "manager",
      full_name: "Test User",
      email: "test@example.com",
    });
    expect(state.upsertCalls[0]!.opts).toEqual({ onConflict: "id" });
    expect(state.updateCalls[0]!.patch).toMatchObject({
      user_id: USER_ID,
      invite_accepted: true,
      invite_token: null,
      invite_token_hash: null,
    });
    expect(state.updateCalls[0]!.whereId).toBe(TEAM_MEMBER_ID);
  });
});

describe("acceptInvite — role mapping (PR #208 Q5)", () => {
  it("maps technician → users.role='staff' (team_members.role intact)", async () => {
    const state = freshState();
    const result = await acceptInvite(
      makeAdmin(state),
      inviteFor("technician"),
      USER_ID,
      "api_route",
    );
    expect(result).toEqual({ success: true });
    // users.role mapped to staff
    expect(state.upsertCalls[0]!.row.role).toBe("staff");
    // team_members update DOES NOT touch role; stays 'technician'
    expect(state.updateCalls[0]!.patch.role).toBeUndefined();
  });

  it.each(["owner", "manager", "staff"])(
    "passes %s role through unchanged",
    async (role) => {
      const state = freshState();
      const result = await acceptInvite(
        makeAdmin(state),
        inviteFor(role),
        USER_ID,
        "api_route",
      );
      expect(result).toEqual({ success: true });
      expect(state.upsertCalls[0]!.row.role).toBe(role);
    },
  );
});

describe("acceptInvite — error paths", () => {
  it("returns {error, status:500} when users.upsert fails", async () => {
    const state = freshState();
    state.upsertError = { message: "constraint violation" };
    const result = await acceptInvite(
      makeAdmin(state),
      inviteFor("manager"),
      USER_ID,
      "server_gate",
    );
    expect(result).toEqual({
      error: "Failed to link user to tenant",
      status: 500,
    });
    // team_members.update should NOT have been called after upsert failure.
    expect(state.updateCalls).toHaveLength(0);
  });

  it("returns {error, status:500} when team_members.update fails", async () => {
    const state = freshState();
    state.updateError = { message: "row not found" };
    const result = await acceptInvite(
      makeAdmin(state),
      inviteFor("manager"),
      USER_ID,
      "api_route",
    );
    expect(result).toEqual({
      error: "Failed to accept invitation",
      status: 500,
    });
    // users.upsert ran first (succeeded), then update failed.
    expect(state.upsertCalls).toHaveLength(1);
    expect(state.updateCalls).toHaveLength(1);
  });
});
