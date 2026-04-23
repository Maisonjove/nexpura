/**
 * W2-005 / W2-006: location scope guard regression coverage.
 *
 * A location-restricted staff member at L1 must not be able to fetch
 * a PDF or trigger an email for a resource belonging to L2 (same
 * tenant). Tenant-only checks in the previous routes let attackers
 * (and misconfigured stores) cross the location boundary.
 *
 * This contract test:
 *   1. Exercises assertUserCanAccessLocation() directly with mocked
 *      team_members rows — unit-level proof.
 *   2. Greps the affected route files to prove each one imports
 *      `assertUserCanAccessLocation` or documents the tenant-global
 *      exception inline.
 */
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

import {
  assertUserCanAccessLocation,
  userCanAccessLocation,
  LocationAccessDeniedError,
} from "../auth/assert-location";

// Mock getUserLocationIds from the locations module.
vi.mock("@/lib/locations", async () => {
  return {
    getUserLocationIds: vi.fn(),
  };
});

import { getUserLocationIds } from "@/lib/locations";

describe("assertUserCanAccessLocation — unit", () => {
  const uid = "user-a";
  const tid = "tenant-t";

  it("owner/manager (null allowed_location_ids) passes through any location", async () => {
    (getUserLocationIds as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    await expect(
      assertUserCanAccessLocation(uid, tid, "L1-uuid"),
    ).resolves.toBeUndefined();
  });

  it("restricted user with matching location passes", async () => {
    (getUserLocationIds as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      "L1-uuid",
      "L3-uuid",
    ]);
    await expect(
      assertUserCanAccessLocation(uid, tid, "L1-uuid"),
    ).resolves.toBeUndefined();
  });

  it("restricted user hitting a non-allowed location throws", async () => {
    (getUserLocationIds as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      "L1-uuid",
    ]);
    await expect(
      assertUserCanAccessLocation(uid, tid, "L2-uuid"),
    ).rejects.toBeInstanceOf(LocationAccessDeniedError);
  });

  it("null/undefined location_id (legacy row) passes through", async () => {
    // No getUserLocationIds call expected — short-circuit.
    (getUserLocationIds as ReturnType<typeof vi.fn>).mockClear();
    await expect(
      assertUserCanAccessLocation(uid, tid, null),
    ).resolves.toBeUndefined();
    await expect(
      assertUserCanAccessLocation(uid, tid, undefined),
    ).resolves.toBeUndefined();
    expect(getUserLocationIds).not.toHaveBeenCalled();
  });

  it("empty allowed set denies when resource has a location", async () => {
    (getUserLocationIds as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
    await expect(
      assertUserCanAccessLocation(uid, tid, "L1-uuid"),
    ).rejects.toBeInstanceOf(LocationAccessDeniedError);
  });

  it("userCanAccessLocation boolean wrapper mirrors assert", async () => {
    (getUserLocationIds as ReturnType<typeof vi.fn>).mockResolvedValueOnce(["L1"]);
    expect(await userCanAccessLocation(uid, tid, "L1")).toBe(true);

    (getUserLocationIds as ReturnType<typeof vi.fn>).mockResolvedValueOnce(["L1"]);
    expect(await userCanAccessLocation(uid, tid, "L2")).toBe(false);
  });
});

// ─── Contract: every location-scoped PDF/email route imports the guard ───
const ROOT = resolve(__dirname, "../../..");

const LOCATION_SCOPED_ROUTES: readonly string[] = [
  "src/app/api/repair/[id]/pdf/route.ts",
  "src/app/api/repair/[id]/email-receipt/route.ts",
  "src/app/api/repair/notify-ready/route.ts",
  "src/app/api/invoice/[id]/pdf/route.ts",
  "src/app/api/invoices/[id]/email/route.ts",
  "src/app/api/bespoke/[id]/pdf/route.ts",
  "src/app/api/bespoke/[id]/email-receipt/route.ts",
  "src/app/api/bespoke/send-approval/route.ts",
  "src/app/api/refund/[id]/pdf/route.ts",
  "src/app/api/tracking/send-email/route.ts",
];

const TENANT_GLOBAL_ROUTES: readonly string[] = [
  "src/app/api/passport/[id]/pdf/route.ts",
  "src/app/api/quote/[id]/pdf/route.ts",
  "src/app/api/appraisals/[id]/insurance-send/route.ts",
];

describe("W2-005/W2-006 contract: PDF/email routes enforce location scope", () => {
  for (const rel of LOCATION_SCOPED_ROUTES) {
    it(`${rel} imports assertUserCanAccessLocation or equivalent`, () => {
      const src = readFileSync(resolve(ROOT, rel), "utf8");
      const hasGuard =
        /assertUserCanAccessLocation|getUserLocationIds/.test(src) &&
        /location_id/.test(src);
      expect(hasGuard, `missing location guard in ${rel}`).toBe(true);
    });
  }

  for (const rel of TENANT_GLOBAL_ROUTES) {
    it(`${rel} documents tenant-global exception inline`, () => {
      const src = readFileSync(resolve(ROOT, rel), "utf8");
      const hasNote = /tenant-global|W2-005 note|W2-006 note/.test(src);
      expect(hasNote, `missing tenant-global note in ${rel}`).toBe(true);
    });
  }
});
