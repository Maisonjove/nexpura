/**
 * Contract test for /api/cron/totp-pending-sweep.
 *
 * Asserts:
 *   1. Without a valid bearer matching CRON_SECRET → 401.
 *   2. With a valid bearer:
 *      - a Supabase update is issued against `users` with both
 *        totp_pending_secret + totp_pending_at set to NULL,
 *      - filtered by `totp_pending_at < cutoff` where the cutoff is
 *        Date.now() − PENDING_TTL_MS (10 minutes),
 *      - and a `not is null` guard on totp_pending_at so rows that
 *        never had a pending in the first place aren't pointlessly
 *        rewritten.
 *      - response includes the swept row count.
 *   3. PENDING_TTL_MS is exactly 10 minutes (no drift from the spec).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const updateMock = vi.fn();
const ltMock = vi.fn();
const notMock = vi.fn();
const selectMock = vi.fn();
const fromMock = vi.fn();
const safeBearerMatchMock = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: fromMock }),
}));

vi.mock("@/lib/timing-safe-compare", () => ({
  safeBearerMatch: (...args: unknown[]) => safeBearerMatchMock(...args),
}));

vi.mock("@/lib/sentry-flush", () => ({
  withSentryFlush: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
}));

vi.mock("@/lib/logger", () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

function buildRequest(authHeader: string | null): Request {
  const headers = new Headers();
  if (authHeader) headers.set("authorization", authHeader);
  return new Request("https://nexpura.com/api/cron/totp-pending-sweep", { headers });
}

describe("/api/cron/totp-pending-sweep — SQL contract", () => {
  beforeEach(() => {
    updateMock.mockReset();
    ltMock.mockReset();
    notMock.mockReset();
    selectMock.mockReset();
    fromMock.mockReset();
    safeBearerMatchMock.mockReset();
    vi.resetModules();

    // .from('users').update(...).lt(...).not(...).select('id')
    selectMock.mockResolvedValue({ data: [{ id: "u1" }, { id: "u2" }], error: null });
    notMock.mockReturnValue({ select: selectMock });
    ltMock.mockReturnValue({ not: notMock });
    updateMock.mockReturnValue({ lt: ltMock });
    fromMock.mockReturnValue({ update: updateMock });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects requests without a matching bearer (401)", async () => {
    safeBearerMatchMock.mockReturnValue(false);
    vi.stubEnv("CRON_SECRET", "right-secret");
    const { GET } = await import("../../app/api/cron/totp-pending-sweep/route");
    const res = (await (GET as (r: Request) => Promise<Response>)(buildRequest("Bearer wrong"))) as Response;
    expect(res.status).toBe(401);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("PENDING_TTL_MS is exactly 10 minutes", async () => {
    const { PENDING_TTL_MS } = await import("../../app/api/cron/totp-pending-sweep/route");
    expect(PENDING_TTL_MS).toBe(10 * 60 * 1000);
  });

  it("with a valid bearer, issues the expected update + filters and returns swept count", async () => {
    safeBearerMatchMock.mockReturnValue(true);
    vi.stubEnv("CRON_SECRET", "right-secret");

    // Pin time so we can assert the exact cutoff value.
    const fixedNow = new Date("2026-05-05T12:00:00.000Z").getTime();
    vi.spyOn(Date, "now").mockReturnValue(fixedNow);

    const { GET } = await import("../../app/api/cron/totp-pending-sweep/route");
    const res = (await (GET as (r: Request) => Promise<Response>)(buildRequest("Bearer right-secret"))) as Response;
    const body = (await res.json()) as { ok: boolean; swept: number; cutoff: string };

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.swept).toBe(2);

    // Hit the right table.
    expect(fromMock).toHaveBeenCalledWith("users");

    // Update clears BOTH pending columns, nothing else.
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock.mock.calls[0][0]).toEqual({
      totp_pending_secret: null,
      totp_pending_at: null,
    });

    // Cutoff filter: lt('totp_pending_at', now - 10 min).
    expect(ltMock).toHaveBeenCalledTimes(1);
    const [ltCol, ltVal] = ltMock.mock.calls[0];
    expect(ltCol).toBe("totp_pending_at");
    const expectedCutoff = new Date(fixedNow - 10 * 60 * 1000).toISOString();
    expect(ltVal).toBe(expectedCutoff);
    expect(body.cutoff).toBe(expectedCutoff);

    // Guard: skip rows that never had a pending (totp_pending_at IS NOT NULL).
    expect(notMock).toHaveBeenCalledWith("totp_pending_at", "is", null);

    // Returns affected ids so we can count.
    expect(selectMock).toHaveBeenCalledWith("id");
  });

  it("surfaces a 500 with sweep_failed on update error", async () => {
    safeBearerMatchMock.mockReturnValue(true);
    vi.stubEnv("CRON_SECRET", "right-secret");

    selectMock.mockResolvedValue({ data: null, error: { message: "boom" } });

    const { GET } = await import("../../app/api/cron/totp-pending-sweep/route");
    const res = (await (GET as (r: Request) => Promise<Response>)(buildRequest("Bearer right-secret"))) as Response;
    const body = (await res.json()) as { ok: boolean; error: string };

    expect(res.status).toBe(500);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("sweep_failed");
  });
});
