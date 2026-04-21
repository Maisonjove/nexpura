import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks -----------------------------------------------------------------
const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mockGetUser } }),
}));

// Keep a stateful mock for the admin client so the test can script the
// sequence of table lookups the action performs.
const singleImpls: Array<() => Promise<{ data: unknown }>> = [];
function queueSingle(impl: () => Promise<{ data: unknown }>) {
  singleImpls.push(impl);
}
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: () => (singleImpls.shift() ?? (async () => ({ data: null })))(),
          }),
          single: () => (singleImpls.shift() ?? (async () => ({ data: null })))(),
        }),
      }),
    }),
  }),
}));

const mockApproveSupportAccess = vi.fn();
vi.mock("@/lib/support-access", () => ({
  approveSupportAccess: (...a: unknown[]) => mockApproveSupportAccess(...a),
  denySupportAccess: vi.fn(),
  getSupportAccessByToken: async (token: string) =>
    token === "VALID"
      ? { tenant_id: "t1", requested_by_email: "support@example.com", tenants: { name: "Biz" } }
      : null,
}));
vi.mock("@/lib/email/send", () => ({ sendSupportAccessApprovedEmail: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/logger", () => ({ default: { error: vi.fn() } }));

import { approveAccess } from "@/app/support-access/actions";

describe("approveAccess (critical: unauthenticated approval path closed)", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockApproveSupportAccess.mockReset();
    singleImpls.length = 0;
  });

  it("REJECTS approval with no session — cannot be triggered via a phished link", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await approveAccess("VALID");
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/sign(ed)? in/i);
    expect(mockApproveSupportAccess).not.toHaveBeenCalled();
  });

  it("REJECTS approval when the authed user belongs to a different tenant", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    // First lookup: users row, tenant_id mismatch.
    queueSingle(async () => ({ data: { id: "u1", tenant_id: "DIFFERENT_TENANT" } }));
    const res = await approveAccess("VALID");
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/same tenant|tenant that received/i);
    expect(mockApproveSupportAccess).not.toHaveBeenCalled();
  });

  it("REJECTS approval when the user is in the right tenant but NOT an owner", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    queueSingle(async () => ({ data: { id: "u1", tenant_id: "t1" } }));
    queueSingle(async () => ({ data: { role: "salesperson" } }));
    const res = await approveAccess("VALID");
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/owner/i);
    expect(mockApproveSupportAccess).not.toHaveBeenCalled();
  });

  it("ACCEPTS approval only when user is the tenant owner", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    queueSingle(async () => ({ data: { id: "u1", tenant_id: "t1" } }));
    queueSingle(async () => ({ data: { role: "owner" } }));
    mockApproveSupportAccess.mockResolvedValue({ success: true });
    const res = await approveAccess("VALID");
    expect(res.success).toBe(true);
    expect(mockApproveSupportAccess).toHaveBeenCalledWith("VALID", "u1");
    // Critical invariant: approvedBy is the authed owner's uid, NEVER
    // undefined / the tenant_id fallback the old code used.
    expect(mockApproveSupportAccess.mock.calls[0][1]).toBe("u1");
  });
});
