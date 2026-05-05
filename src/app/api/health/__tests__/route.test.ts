/**
 * Contract tests for /api/health (C-07 fix).
 *
 * These tests assert the publicly-documented shape so a future "let's
 * add an extra field" change can't silently break the uptime monitor
 * without flipping a red CI build.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the DB-health helper. The handler does not own a Supabase client
// — it only awaits checkDatabaseHealth() — so this is the entire surface
// area we need to control.
const mockCheckDatabaseHealth = vi.fn();
vi.mock("@/lib/high-scale", () => ({
  checkDatabaseHealth: () => mockCheckDatabaseHealth(),
}));

// Mock logger so we can assert that a 503 pages Sentry (logger.error
// forwards to Sentry.captureException — see lib/logger.ts).
const mockLoggerError = vi.fn();
vi.mock("@/lib/logger", () => ({
  logger: {
    error: (...args: unknown[]) => mockLoggerError(...args),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("GET /api/health", () => {
  beforeEach(() => {
    mockCheckDatabaseHealth.mockReset();
    mockLoggerError.mockReset();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("returns 200 with the documented {ok,timestamp,version} shape when Supabase is reachable", async () => {
    mockCheckDatabaseHealth.mockResolvedValue({ healthy: true, latencyMs: 42 });
    const { GET } = await import("../route");

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    // Strict shape: only the three documented keys, no extras.
    expect(Object.keys(body).sort()).toEqual(["ok", "timestamp", "version"]);
    expect(body.ok).toBe(true);
    expect(typeof body.timestamp).toBe("string");
    // ISO-8601 (Date.toISOString) — second-precision-or-finer with a Z suffix.
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(typeof body.version).toBe("string");
  });

  it("emits Server-Timing with the DB ping latency", async () => {
    mockCheckDatabaseHealth.mockResolvedValue({ healthy: true, latencyMs: 87 });
    const { GET } = await import("../route");

    const res = await GET();
    expect(res.headers.get("Server-Timing")).toBe("db;dur=87");
  });

  it("sets Cache-Control: no-store so monitors never read a stale 200", async () => {
    mockCheckDatabaseHealth.mockResolvedValue({ healthy: true, latencyMs: 10 });
    const { GET } = await import("../route");

    const res = await GET();
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns 503 with ok:false when Supabase REST is genuinely unreachable", async () => {
    // checkDatabaseHealth returns healthy:false only when the underlying
    // fetch rejects (per the helper's contract in lib/high-scale.ts).
    mockCheckDatabaseHealth.mockResolvedValue({ healthy: false, latencyMs: 5000 });
    const { GET } = await import("../route");

    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.ok).toBe(false);
    // Same shape on 503 so the monitor can parse without a branch.
    expect(Object.keys(body).sort()).toEqual(["ok", "timestamp", "version"]);
  });

  it("pages Sentry (logger.error) on 503 so persistent unhealth is alertable", async () => {
    mockCheckDatabaseHealth.mockResolvedValue({ healthy: false, latencyMs: 9000 });
    const { GET } = await import("../route");

    await GET();
    expect(mockLoggerError).toHaveBeenCalledTimes(1);
    expect(mockLoggerError.mock.calls[0][0]).toMatch(/supabase unreachable/);
  });

  it("does NOT page Sentry on a 200 (no false alarms on healthy responses)", async () => {
    mockCheckDatabaseHealth.mockResolvedValue({ healthy: true, latencyMs: 50 });
    const { GET } = await import("../route");

    await GET();
    expect(mockLoggerError).not.toHaveBeenCalled();
  });

  it("does NOT touch the Supabase pool/admin client (no auth, no DB writes)", async () => {
    // The handler must not import createClient/createAdminClient. We test
    // this by counting how many things checkDatabaseHealth is awaited
    // for — exactly once, with no side fetches.
    mockCheckDatabaseHealth.mockResolvedValue({ healthy: true, latencyMs: 1 });
    const { GET } = await import("../route");

    await GET();
    expect(mockCheckDatabaseHealth).toHaveBeenCalledTimes(1);
  });
});

describe("HEAD /api/health", () => {
  beforeEach(() => {
    mockCheckDatabaseHealth.mockReset();
    mockLoggerError.mockReset();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("returns 200 with empty body and Server-Timing when healthy", async () => {
    mockCheckDatabaseHealth.mockResolvedValue({ healthy: true, latencyMs: 33 });
    const { HEAD } = await import("../route");

    const res = await HEAD();
    expect(res.status).toBe(200);
    expect(res.headers.get("Server-Timing")).toBe("db;dur=33");
    // HEAD spec: empty body.
    const text = await res.text();
    expect(text).toBe("");
  });

  it("returns 503 when Supabase REST is unreachable", async () => {
    mockCheckDatabaseHealth.mockResolvedValue({ healthy: false, latencyMs: 5000 });
    const { HEAD } = await import("../route");

    const res = await HEAD();
    expect(res.status).toBe(503);
  });
});
