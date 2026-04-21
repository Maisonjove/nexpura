import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Regression contract for PR-01 — Pattern 1 sweep: body-supplied tenantId
 * has been replaced with a session-derived tenant on 9 critical surfaces.
 *
 * Follows the repo's contract-test pattern: no Next runtime mocking, no
 * Supabase client stubbing. Instead we:
 *   - unit-test the shared helper (getSessionTenantId /
 *     assertCallerTenantMatches) with a mocked getAuthContext
 *   - lock the fix in place on each route by asserting the *absence* of
 *     the bug pattern (e.g. `tenant_id: tenantId` from body) and the
 *     *presence* of the session-derived guard (e.g. `auth.getUser()`
 *     plus `tenant_id` filter by the caller's id)
 *
 * The goal is a future edit that re-introduces any of these Pattern 1
 * bugs breaks CI.
 */

function readSrc(rel: string): string {
  return fs.readFileSync(path.resolve(__dirname, "..", "..", rel), "utf8");
}

// ───────────────────────────────────────────────────────────────────────
// Helper: unit tests for assert-tenant.ts
// ───────────────────────────────────────────────────────────────────────

// Mock the auth-context module so we can drive getSessionTenantId /
// assertCallerTenantMatches deterministically. This keeps the helper
// test hermetic without spinning up Supabase.
vi.mock("@/lib/auth-context", () => {
  const mockGetAuthContext = vi.fn();
  return {
    getAuthContext: mockGetAuthContext,
    // Re-export the non-mocked-shape symbols used transitively. The helper
    // only imports getAuthContext, so the rest are stubs.
    requireAuth: vi.fn(),
    requireActiveTenant: vi.fn(),
    requirePermission: vi.fn(),
    checkPermission: vi.fn(),
    checkAnyPermission: vi.fn(),
    isTenantActive: vi.fn(() => true),
    MUTATING_SUBSCRIPTION_STATES: new Set(["active"]),
  };
});

import { getAuthContext } from "@/lib/auth-context";
import { getSessionTenantId, assertCallerTenantMatches } from "@/lib/auth/assert-tenant";

const mockedGetAuthContext = vi.mocked(getAuthContext);

beforeEach(() => {
  mockedGetAuthContext.mockReset();
});

function mkCtx(tenantId: string) {
  return {
    userId: "u",
    email: null,
    tenantId,
    tenantName: null,
    businessName: null,
    currency: "AUD",
    taxRate: 0.1,
    taxName: "GST",
    taxInclusive: true,
    role: "owner",
    isOwner: true,
    isManager: true,
    permissions: {} as any,
    subscriptionStatus: "active",
  };
}

describe("getSessionTenantId()", () => {
  it("returns the session tenant id from getAuthContext", async () => {
    mockedGetAuthContext.mockResolvedValue(mkCtx("tenant-A") as any);
    await expect(getSessionTenantId()).resolves.toBe("tenant-A");
  });

  it("throws not_authenticated when there is no auth context", async () => {
    mockedGetAuthContext.mockResolvedValue(null);
    await expect(getSessionTenantId()).rejects.toThrow(/not_authenticated/);
  });

  it("throws tenant_required when the auth context has no tenant", async () => {
    mockedGetAuthContext.mockResolvedValue({ ...mkCtx("x"), tenantId: "" } as any);
    await expect(getSessionTenantId()).rejects.toThrow(/tenant_required/);
  });
});

describe("assertCallerTenantMatches()", () => {
  it("passes when caller tenant equals resource tenant", async () => {
    mockedGetAuthContext.mockResolvedValue(mkCtx("tenant-A") as any);
    await expect(assertCallerTenantMatches("tenant-A")).resolves.toBeUndefined();
  });

  it("rejects tenant_mismatch when caller tenant differs (cross-tenant attempt)", async () => {
    mockedGetAuthContext.mockResolvedValue(mkCtx("tenant-A") as any);
    await expect(assertCallerTenantMatches("tenant-B")).rejects.toThrow(/tenant_mismatch/);
  });

  it("rejects tenant_required when no resource tenant is supplied", async () => {
    mockedGetAuthContext.mockResolvedValue(mkCtx("tenant-A") as any);
    await expect(assertCallerTenantMatches(null)).rejects.toThrow(/tenant_required/);
    await expect(assertCallerTenantMatches(undefined)).rejects.toThrow(/tenant_required/);
    await expect(assertCallerTenantMatches("")).rejects.toThrow(/tenant_required/);
  });

  it("rejects not_authenticated when the caller has no session", async () => {
    mockedGetAuthContext.mockResolvedValue(null);
    await expect(assertCallerTenantMatches("tenant-A")).rejects.toThrow(/not_authenticated/);
  });
});

// ───────────────────────────────────────────────────────────────────────
// Route-shape contracts: the Pattern 1 fix is in place on each route.
// Each test pair asserts the bad pattern is gone AND the good pattern is
// present. These are the "lock" tests — they will break any future edit
// that re-introduces a body-supplied tenantId.
// ───────────────────────────────────────────────────────────────────────

describe("W4-XTENANT1 reports aggregator — session-derived tenant", () => {
  const src = readSrc("app/(app)/reports/actions.ts");

  it("imports the assert-tenant helper", () => {
    expect(src).toMatch(/getSessionTenantId/);
    expect(src).toMatch(/@\/lib\/auth\/assert-tenant/);
  });

  it("removes tenantId as a function argument on every exported aggregator", () => {
    // None of the exported aggregators should still take tenantId as an
    // argument. Grep pattern: `export async function ...(tenantId: string`
    expect(src).not.toMatch(/export async function \w+\([\s\S]{0,60}tenantId: string/);
  });

  it("every exported aggregator resolves tenant via getSessionTenantId", () => {
    // Each function body should contain a call to getSessionTenantId
    const bodies = src.split(/export async function /g).slice(1);
    for (const body of bodies) {
      expect(body).toMatch(/await getSessionTenantId\(\)/);
    }
  });
});

describe("W5-CRIT-001 shop appointment — subdomain-resolved tenant only", () => {
  const src = readSrc("app/api/shop/[subdomain]/appointment/route.ts");

  it("does not destructure tenant_id from the body", () => {
    expect(src).not.toMatch(/const \{[^}]*tenant_id[^}]*\} = body/);
  });

  it("resolves tenant only from the subdomain config table", () => {
    expect(src).toMatch(/from\(["']website_config["']\)/);
    expect(src).toMatch(/\.eq\(["']subdomain["'], subdomain\)/);
  });

  it("does not contain the previous 'tenant_id || body' fallback", () => {
    expect(src).not.toMatch(/let tenantId = tenant_id/);
  });
});

describe("W5-CRIT-001 shop repair-enquiry — subdomain-resolved tenant only", () => {
  const src = readSrc("app/api/shop/[subdomain]/repair-enquiry/route.ts");

  it("does not destructure tenant_id from the body", () => {
    expect(src).not.toMatch(/const \{[^}]*tenant_id[^}]*\} = body/);
  });

  it("resolves tenant only from the subdomain config table", () => {
    expect(src).toMatch(/from\(["']website_config["']\)/);
    expect(src).toMatch(/\.eq\(["']subdomain["'], subdomain\)/);
  });

  it("does not contain the previous 'tenant_id || body' fallback", () => {
    expect(src).not.toMatch(/let tenantId = tenant_id/);
  });
});

describe("W5-CRIT-002 migration/update-session — session-tenant scoping", () => {
  const src = readSrc("app/api/migration/update-session/route.ts");

  it("resolves the caller's tenant from the users table by session user id", () => {
    expect(src).toMatch(/auth\.getUser\(\)/);
    expect(src).toMatch(/from\(["']users["']\)/);
    expect(src).toMatch(/select\(['"]tenant_id['"]\)/);
    expect(src).toMatch(/\.eq\(['"]id['"], user\.id\)/);
  });

  it("rejects a cross-tenant sessionId with 403", () => {
    expect(src).toMatch(/existing\.tenant_id !== callerTenantId/);
    expect(src).toMatch(/status: 403/);
  });

  it("scopes the final update by the caller's tenant, not the body", () => {
    expect(src).toMatch(/\.eq\(['"]tenant_id['"], callerTenantId\)/);
  });
});

describe("W5-CRIT-002 migration/job-status — session-tenant scoping", () => {
  const src = readSrc("app/api/migration/job-status/route.ts");

  it("resolves the caller's tenant from the session on every handler", () => {
    expect(src).toMatch(/requireAuthContext/);
    expect(src).toMatch(/auth\.getUser\(\)/);
  });

  it("rejects a cross-tenant jobId with 403 on GET", () => {
    expect(src).toMatch(/job\.tenant_id !== ctx\.tenantId/);
    expect(src).toMatch(/status: 403/);
  });

  it("scopes the cancel update by the caller's tenant", () => {
    expect(src).toMatch(/\.eq\(['"]tenant_id['"], ctx\.tenantId\)/);
  });
});

describe("W6-CRIT-02 saveAccount — session-derived user id", () => {
  const src = readSrc("app/(app)/settings/actions.ts");

  it("ignores any caller-supplied user id", () => {
    expect(src).toMatch(/_unusedUserId/);
  });

  it("updates the users row by session user.id, not the argument", () => {
    // The saveAccount body should resolve user via getUser() and update
    // .eq("id", user.id).
    const body = src.split("export async function saveAccount")[1] ?? "";
    expect(body).toMatch(/auth\.getUser\(\)/);
    expect(body).toMatch(/\.eq\(['"]id['"], user\.id\)/);
  });
});

describe("W6-CRIT-03 getTenantEmailSender — zero-arg, session-derived", () => {
  const src = readSrc("app/(app)/settings/email/actions.ts");

  it("accepts no arguments (was previously tenantId: string)", () => {
    expect(src).toMatch(/export async function getTenantEmailSender\(\s*\)/);
  });

  it("resolves tenant from the local getAuthContext", () => {
    const body = src.split("export async function getTenantEmailSender")[1] ?? "";
    expect(body).toMatch(/getAuthContext\(\)/);
    expect(body).toMatch(/ctx\.tenantId/);
  });
});

describe("W6-CRIT-07 updatePermission — session-derived tenant only", () => {
  const src = readSrc("app/(app)/settings/team/permissions/actions.ts");

  it("ignores any caller-supplied tenantId argument", () => {
    expect(src).toMatch(/_unusedTenantId/);
  });

  it("uses the owner-context tenant for the mutation, not the argument", () => {
    expect(src).toMatch(/updateRolePermission\(ctx\.tenantId/);
  });

  it("still enforces the owner-only gate", () => {
    expect(src).toMatch(/userData\?\.role !== ['"]owner['"]/);
  });
});

describe("W7-CRIT-02 + W4-APR2 appraisal PDF — session auth + tenant match", () => {
  const src = readSrc("app/api/appraisals/[id]/pdf/route.tsx");

  it("now requires a logged-in user (previously had ZERO auth)", () => {
    expect(src).toMatch(/auth\.getUser\(\)/);
    expect(src).toMatch(/Unauthorized/);
  });

  it("returns 403 when appraisal.tenant_id does not match the caller's tenant", () => {
    expect(src).toMatch(/appraisal\.tenant_id !== callerTenantId/);
    expect(src).toMatch(/status: 403/);
  });

  it("no longer derives tenant silently from the appraisal record alone", () => {
    // Before the fix the route simply took appraisal.tenant_id and rendered
    // — the explicit comparison against callerTenantId is the fix.
    expect(src).toMatch(/callerTenantId/);
  });
});

describe("W7-CRIT-04 tracking/send-email — session-derived tenant", () => {
  const src = readSrc("app/api/tracking/send-email/route.ts");

  it("does not destructure tenantId from the body", () => {
    expect(src).not.toMatch(/const \{[^}]*tenantId[^}]*\} = body/);
  });

  it("requires authentication and resolves tenant from the session", () => {
    expect(src).toMatch(/auth\.getUser\(\)/);
    expect(src).toMatch(/Unauthorized/);
    expect(src).toMatch(/from\(["']users["']\)[\s\S]*?select\(["']tenant_id["']\)[\s\S]*?\.eq\(["']id["'], user\.id\)/);
  });

  it("the SendTrackingEmailRequest interface no longer carries tenantId", () => {
    expect(src).not.toMatch(/tenantId: string;/);
  });
});

describe("W7-CRIT-05 job-event — parent-derived tenant + session match", () => {
  const src = readSrc("app/api/job-event/route.ts");

  it("does not use the body tenantId as the scoping filter on the insert", () => {
    // The old pattern was `tenant_id: tenantId` (destructured from body).
    // The new pattern uses callerTenantId.
    expect(src).toMatch(/tenant_id: callerTenantId/);
    expect(src).not.toMatch(/tenant_id: tenantId[^A-Za-z_]/);
  });

  it("rejects when the parent job's tenant does not match the caller's session", () => {
    expect(src).toMatch(/parent\.tenant_id !== callerTenantId/);
    expect(src).toMatch(/status: 403/);
  });

  it("loads the parent job and uses its tenant as the source of truth", () => {
    expect(src).toMatch(/PARENT_TABLE_BY_JOB_TYPE/);
    expect(src).toMatch(/select\(["']tenant_id["']\)/);
  });
});

describe("W7-CRIT-05 job-attachment — parent-derived tenant + session match", () => {
  const src = readSrc("app/api/job-attachment/route.ts");

  it("does not use the body tenantId as the scoping filter on the insert", () => {
    expect(src).toMatch(/tenant_id: callerTenantId/);
    expect(src).not.toMatch(/tenant_id: tenantId[^A-Za-z_]/);
  });

  it("rejects when the parent job's tenant does not match the caller's session", () => {
    expect(src).toMatch(/parent\.tenant_id !== callerTenantId/);
    expect(src).toMatch(/status: 403/);
  });
});

describe("W7-CRIT-05 job-attachment/delete — session-tenant-scoped delete", () => {
  const src = readSrc("app/api/job-attachment/delete/route.ts");

  it("scopes the DELETE by the caller's tenant, not the body's tenantId", () => {
    expect(src).toMatch(/\.eq\(["']tenant_id["'], callerTenantId\)/);
  });

  it("does not pull tenantId out of the parse result into the filter", () => {
    // The old pattern: `const { attachmentId, tenantId, fileUrl } = ...; ... .eq("tenant_id", tenantId)`
    // The new pattern: `const { attachmentId, fileUrl } = ...`
    expect(src).not.toMatch(/const \{[^}]*tenantId[^}]*\} = parseResult\.data/);
  });
});

// ───────────────────────────────────────────────────────────────────────
// Schema contract: the Zod schemas that flow into the fixed routes no
// longer require tenantId (they treat it as optional/ignored so older
// clients don't hard-fail). Nothing else in the job schemas changed.
// ───────────────────────────────────────────────────────────────────────

describe("job schemas — tenantId demoted to optional (ignored server-side)", () => {
  const src = readSrc("lib/schemas/jobs.ts");

  it("jobEventSchema's tenantId is optional", () => {
    // Find the jobEventSchema block and assert tenantId is .optional()
    const block = src.match(/export const jobEventSchema = z\.object\(\{[\s\S]*?\}\);/)?.[0] ?? "";
    expect(block).toMatch(/tenantId: z\.string\(\)\.uuid\([^)]*\)\.optional\(\)/);
  });

  it("jobAttachmentSchema's tenantId is optional", () => {
    const block = src.match(/export const jobAttachmentSchema = z\.object\(\{[\s\S]*?\}\);/)?.[0] ?? "";
    expect(block).toMatch(/tenantId: z\.string\(\)\.uuid\([^)]*\)\.optional\(\)/);
  });

  it("jobAttachmentDeleteSchema's tenantId is optional", () => {
    const block = src.match(/export const jobAttachmentDeleteSchema = z\.object\(\{[\s\S]*?\}\);/)?.[0] ?? "";
    expect(block).toMatch(/tenantId: z\.string\(\)\.uuid\([^)]*\)\.optional\(\)/);
  });
});
