import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Regression for the location-scoped read helper.
 * Audit finding (High): location-restricted users (allowed_location_ids
 * = ['A']) could see cross-location data on list/read paths because
 * loadMoreCustomers / inventory / repairs list queries only filtered
 * by tenant_id. Fixed by routing every list query through
 * resolveReadLocationScope() / locationScopeFilter().
 */

const mockGetUserLocationIds = vi.fn();
vi.mock("@/lib/locations", () => ({
  getUserLocationIds: (...a: unknown[]) => mockGetUserLocationIds(...a),
}));

import { resolveReadLocationScope, locationScopeFilter } from "../location-read-scope";

describe("resolveReadLocationScope", () => {
  beforeEach(() => mockGetUserLocationIds.mockReset());

  it("returns all-access when user has null allowed_location_ids (owner/manager)", async () => {
    mockGetUserLocationIds.mockResolvedValue(null);
    const r = await resolveReadLocationScope("u1", "t1");
    expect(r).toEqual({ all: true });
  });

  it("returns scoped when user has specific allowed_location_ids", async () => {
    mockGetUserLocationIds.mockResolvedValue(["loc-A", "loc-B"]);
    const r = await resolveReadLocationScope("u1", "t1");
    expect(r).toEqual({ all: false, allowedIds: ["loc-A", "loc-B"] });
  });

  it("returns scoped + empty when user has no location access", async () => {
    mockGetUserLocationIds.mockResolvedValue([]);
    const r = await resolveReadLocationScope("u1", "t1");
    expect(r).toEqual({ all: false, allowedIds: [] });
  });
});

describe("locationScopeFilter", () => {
  beforeEach(() => mockGetUserLocationIds.mockReset());

  it("returns null for all-access users (caller skips filter)", async () => {
    mockGetUserLocationIds.mockResolvedValue(null);
    expect(await locationScopeFilter("u1", "t1")).toBeNull();
  });

  it("builds PostgREST .or() filter for restricted user with allowed locations", async () => {
    mockGetUserLocationIds.mockResolvedValue(["a-uuid", "b-uuid"]);
    const filter = await locationScopeFilter("u1", "t1");
    expect(filter).toMatch(/location_id\.in\.\(a-uuid,b-uuid\)/);
    // Must also include legacy-NULL fallthrough so pre-column rows
    // remain visible to the restricted user within their tenant.
    expect(filter).toMatch(/location_id\.is\.null/);
  });

  it("collapses zero-allowed to an impossible-UUID match (empty result set)", async () => {
    mockGetUserLocationIds.mockResolvedValue([]);
    const filter = await locationScopeFilter("u1", "t1");
    expect(filter).toBe("location_id.eq.00000000-0000-0000-0000-000000000000");
  });
});
