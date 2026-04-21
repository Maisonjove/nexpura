import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks installed before the SUT is imported.
const mockSingle = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: mockSingle,
        }),
      }),
    }),
  }),
}));

import { assertTenantActive } from "@/lib/assert-tenant-active";
import { MUTATING_SUBSCRIPTION_STATES } from "@/lib/auth-context";

describe("assertTenantActive (paywall choke point)", () => {
  beforeEach(() => mockSingle.mockReset());

  it("accepts an active subscription", async () => {
    mockSingle.mockResolvedValue({ data: { subscription_status: "active" } });
    await expect(assertTenantActive("t1")).resolves.toBeUndefined();
  });

  it("accepts a trialing subscription", async () => {
    mockSingle.mockResolvedValue({ data: { subscription_status: "trialing" } });
    await expect(assertTenantActive("t1")).resolves.toBeUndefined();
  });

  it("accepts past_due within grace window (still mutating-allowed)", async () => {
    mockSingle.mockResolvedValue({ data: { subscription_status: "past_due" } });
    await expect(assertTenantActive("t1")).resolves.toBeUndefined();
  });

  it("accepts payment_required within grace", async () => {
    mockSingle.mockResolvedValue({ data: { subscription_status: "payment_required" } });
    await expect(assertTenantActive("t1")).resolves.toBeUndefined();
  });

  it("REJECTS suspended subscription — the bug this exists to prevent", async () => {
    mockSingle.mockResolvedValue({ data: { subscription_status: "suspended" } });
    await expect(assertTenantActive("t1")).rejects.toThrow("subscription_required");
  });

  it("REJECTS cancelled subscription", async () => {
    mockSingle.mockResolvedValue({ data: { subscription_status: "cancelled" } });
    await expect(assertTenantActive("t1")).rejects.toThrow("subscription_required");
  });

  it("REJECTS unpaid subscription", async () => {
    mockSingle.mockResolvedValue({ data: { subscription_status: "unpaid" } });
    await expect(assertTenantActive("t1")).rejects.toThrow("subscription_required");
  });

  it("does NOT break tenants with null subscription_status (pre-migration records)", async () => {
    mockSingle.mockResolvedValue({ data: { subscription_status: null } });
    await expect(assertTenantActive("t1")).resolves.toBeUndefined();
  });

  it("MUTATING_SUBSCRIPTION_STATES is the authoritative set", () => {
    expect(MUTATING_SUBSCRIPTION_STATES.has("active")).toBe(true);
    expect(MUTATING_SUBSCRIPTION_STATES.has("trialing")).toBe(true);
    expect(MUTATING_SUBSCRIPTION_STATES.has("suspended")).toBe(false);
    expect(MUTATING_SUBSCRIPTION_STATES.has("cancelled")).toBe(false);
  });
});
