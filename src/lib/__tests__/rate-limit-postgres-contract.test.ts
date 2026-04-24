import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Contract test locking in the Postgres-backed rate-limit replacement.
 * The prior Upstash limiter was removed with the rest of the Redis/Upstash
 * surface; this suite prevents drift — if someone re-adds an Upstash
 * import or drops the fail-closed posture, CI fails.
 */

const rateLimitSource = readFileSync(
  join(__dirname, "..", "rate-limit.ts"),
  "utf8",
);
const authSecuritySource = readFileSync(
  join(__dirname, "..", "auth-security.ts"),
  "utf8",
);
const cacheSource = readFileSync(
  join(__dirname, "..", "cache.ts"),
  "utf8",
);
const highScaleSource = readFileSync(
  join(__dirname, "..", "high-scale.ts"),
  "utf8",
);

describe("rate-limit.ts — Postgres-backed contract", () => {
  it("does not import @upstash/redis", () => {
    expect(rateLimitSource).not.toMatch(/@upstash\/redis/);
  });

  it("does not import @upstash/ratelimit", () => {
    expect(rateLimitSource).not.toMatch(/@upstash\/ratelimit/);
  });

  it("does not reference UPSTASH_REDIS_REST_URL or TOKEN env vars", () => {
    expect(rateLimitSource).not.toMatch(/UPSTASH_REDIS_REST_URL/);
    expect(rateLimitSource).not.toMatch(/UPSTASH_REDIS_REST_TOKEN/);
  });

  it("calls the Postgres RPC check_and_increment_rate_limit", () => {
    expect(rateLimitSource).toMatch(/check_and_increment_rate_limit/);
  });

  it("uses the admin Supabase client (service role, bypasses RLS)", () => {
    expect(rateLimitSource).toMatch(/createAdminClient/);
  });

  it("exports the same public surface (checkRateLimit, rateLimiters, ratelimit)", () => {
    expect(rateLimitSource).toMatch(/export async function checkRateLimit/);
    expect(rateLimitSource).toMatch(/export const rateLimiters/);
    expect(rateLimitSource).toMatch(/export const ratelimit/);
  });

  it("preserves the 7 bucket configs (api/auth/ai/webhook/heavy/pdf/export)", () => {
    for (const bucket of ["api", "auth", "ai", "webhook", "heavy", "pdf", "export"]) {
      expect(rateLimitSource).toMatch(new RegExp(`['"]?${bucket}['"]?\\s*:`));
    }
  });

  it("preserves the fail-closed posture: returns {success:false} on RPC error in prod", () => {
    // Regex picks up both error branches (RPC error + throw)
    expect(rateLimitSource).toMatch(/success:\s*false/);
    expect(rateLimitSource).toMatch(/denying request — RPC/i);
  });

  it("preserves the dev-only localhost allow-list", () => {
    expect(rateLimitSource).toMatch(/isLocalOrTest/);
  });
});

describe("rate-limit — runtime fail-closed behavior", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("fails closed in production when the RPC throws", async () => {
    vi.stubEnv("NODE_ENV", "production");

    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => ({
        rpc: async () => {
          throw new Error("db offline");
        },
      }),
    }));

    const { checkRateLimit } = await import("../rate-limit");
    const result = await checkRateLimit("prod-user-123", "auth");
    expect(result.success).toBe(false);
  });

  it("allows non-production localhost when RPC throws (dev/test only)", async () => {
    vi.stubEnv("NODE_ENV", "development");

    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => ({
        rpc: async () => {
          throw new Error("db offline");
        },
      }),
    }));

    const { checkRateLimit } = await import("../rate-limit");
    const result = await checkRateLimit("127.0.0.1", "auth");
    expect(result.success).toBe(true);
  });

  it("returns {success:true, remaining:N} when RPC returns success", async () => {
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => ({
        rpc: async () => ({
          data: { success: true, remaining: 9 },
          error: null,
        }),
      }),
    }));

    const { checkRateLimit } = await import("../rate-limit");
    const result = await checkRateLimit("user-abc", "auth");
    expect(result).toEqual({ success: true, remaining: 9 });
  });

  it("returns {success:false} when RPC returns limit-exceeded", async () => {
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => ({
        rpc: async () => ({
          data: { success: false, remaining: 0 },
          error: null,
        }),
      }),
    }));

    const { checkRateLimit } = await import("../rate-limit");
    const result = await checkRateLimit("user-abc", "auth");
    expect(result).toEqual({ success: false, remaining: 0 });
  });
});

describe("auth-security.ts — Postgres-backed contract", () => {
  it("does not import @upstash/redis", () => {
    expect(authSecuritySource).not.toMatch(/@upstash\/redis/);
  });

  it("does not reference UPSTASH_REDIS env vars", () => {
    expect(authSecuritySource).not.toMatch(/UPSTASH_REDIS_REST_URL/);
    expect(authSecuritySource).not.toMatch(/UPSTASH_REDIS_REST_TOKEN/);
  });

  it("calls the Postgres lockout RPCs", () => {
    expect(authSecuritySource).toMatch(/check_login_allowed/);
    expect(authSecuritySource).toMatch(/record_failed_login/);
    expect(authSecuritySource).toMatch(/clear_login_lockouts/);
  });

  it("hashes the identifier before storing (no raw PII in DB)", () => {
    expect(authSecuritySource).toMatch(/createHash\(['"]sha256['"]\)/);
  });

  it("preserves the 5-strike → 15-minute lockout constants", () => {
    expect(authSecuritySource).toMatch(/MAX_ATTEMPTS\s*=\s*5/);
    expect(authSecuritySource).toMatch(/LOCKOUT_SECONDS\s*=\s*15\s*\*\s*60/);
  });
});

describe("cache.ts — Redis-free pass-through contract", () => {
  it("does not import @upstash/redis", () => {
    expect(cacheSource).not.toMatch(/@upstash\/redis/);
  });

  it("does not reference UPSTASH_REDIS env vars", () => {
    expect(cacheSource).not.toMatch(/UPSTASH_REDIS_REST_URL/);
    expect(cacheSource).not.toMatch(/UPSTASH_REDIS_REST_TOKEN/);
  });

  it("exports the compatibility API (getCached/invalidateCache/invalidateCachePattern/invalidateTenantCache/tenantCacheKey)", () => {
    expect(cacheSource).toMatch(/export async function getCached/);
    expect(cacheSource).toMatch(/export async function invalidateCache/);
    expect(cacheSource).toMatch(/export async function invalidateCachePattern/);
    expect(cacheSource).toMatch(/export async function invalidateTenantCache/);
    expect(cacheSource).toMatch(/export function tenantCacheKey/);
  });

  it("getCached is a pass-through to the fetcher (no shared cache layer)", async () => {
    const { getCached } = await import("../cache");
    let calls = 0;
    const fetcher = async () => {
      calls += 1;
      return "fresh";
    };
    const first = await getCached("k1", fetcher);
    const second = await getCached("k1", fetcher);
    expect(first).toBe("fresh");
    expect(second).toBe("fresh");
    // No memoisation — fetcher runs every call. This is deliberate:
    // a shared tenant cache is a tenant-leak surface we don't want.
    expect(calls).toBe(2);
  });
});

describe("high-scale.ts — Redis-free contract", () => {
  it("does not import @upstash/redis", () => {
    expect(highScaleSource).not.toMatch(/@upstash\/redis/);
  });

  it("keeps coalesceRequest (in-memory, no Redis needed)", () => {
    expect(highScaleSource).toMatch(/export async function coalesceRequest/);
  });

  it("keeps checkDatabaseHealth (Supabase-only probe)", () => {
    expect(highScaleSource).toMatch(/export async function checkDatabaseHealth/);
  });

  it("removes Redis-dependent dead code (setLoadLevel/getLoadLevel/shouldEnableFeature/getSWR)", () => {
    // Comments in the file may still mention the removed names; assert
    // only that there is no `export ... function <name>` declaration.
    expect(highScaleSource).not.toMatch(/export\s+(async\s+)?function\s+setLoadLevel\b/);
    expect(highScaleSource).not.toMatch(/export\s+(async\s+)?function\s+getLoadLevel\b/);
    expect(highScaleSource).not.toMatch(/export\s+(async\s+)?function\s+shouldEnableFeature\b/);
    expect(highScaleSource).not.toMatch(/export\s+(async\s+)?function\s+getSWR\b/);
  });
});

describe("package.json — no Upstash packages", () => {
  const packageJson = JSON.parse(
    readFileSync(join(__dirname, "..", "..", "..", "package.json"), "utf8"),
  );

  it("@upstash/redis is not in dependencies", () => {
    expect(packageJson.dependencies?.["@upstash/redis"]).toBeUndefined();
  });

  it("@upstash/ratelimit is not in dependencies", () => {
    expect(packageJson.dependencies?.["@upstash/ratelimit"]).toBeUndefined();
  });

  it("no @upstash/* packages anywhere", () => {
    const allDeps = {
      ...(packageJson.dependencies ?? {}),
      ...(packageJson.devDependencies ?? {}),
      ...(packageJson.optionalDependencies ?? {}),
      ...(packageJson.peerDependencies ?? {}),
    };
    const upstashEntries = Object.keys(allDeps).filter((k) =>
      k.startsWith("@upstash/"),
    );
    expect(upstashEntries).toEqual([]);
  });
});
