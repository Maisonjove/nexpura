/**
 * Contract test for /forgot-password.
 *
 * BUG-W1-004: the previous implementation called
 * `supabase.auth.resetPasswordForEmail` from the *browser* client, so
 * Supabase's platform rate-limit (~6/hr/email) tripped before our
 * Upstash limiter ever saw the request, and the raw "API rate limit
 * reached" string leaked to users.
 *
 * The fix moves the call to a server action (`requestPasswordReset`)
 * which:
 *   1. Validates input with zod (email format + length).
 *   2. Gates on the Upstash `auth` bucket (key = ip + normalised email).
 *   3. Calls `admin.auth.resetPasswordForEmail` server-side so we own
 *      the error path and translate platform RL → friendly copy.
 *   4. ALWAYS returns a generic success message (enumeration-safe).
 *
 * These tests lock in that contract:
 *   - Happy path returns generic success.
 *   - Nonexistent-email response is indistinguishable from the happy
 *     path (enumeration safety).
 *   - Upstash RL exceeded → 429 with retry copy.
 *   - Supabase platform RL → friendly "try again in a bit" copy, NOT
 *     the raw error string.
 *   - Malformed / missing email → 400 with "enter a valid email" — but
 *     phrased generically (no "email X not found").
 *   - Static-analysis: the /forgot-password page no longer imports
 *     `createClient` from `@supabase/supabase-js` or our browser
 *     client for the reset call.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../../..");
function readSrc(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

// ───────────────────────────────────────────────────────────────────────
// Static-analysis: client page must not import a Supabase client for
// the reset call. (It may still import other things from our helpers.)
// ───────────────────────────────────────────────────────────────────────
describe("forgot-password page — no direct Supabase reset from browser", () => {
  const pageSrc = readSrc("src/app/(auth)/forgot-password/page.tsx");

  it("does not import createClient from @supabase/supabase-js", () => {
    expect(pageSrc).not.toMatch(
      /from\s+["']@supabase\/supabase-js["']/
    );
  });

  it("does not import the browser supabase client from @/lib/supabase/client", () => {
    expect(pageSrc).not.toMatch(
      /from\s+["']@\/lib\/supabase\/client["']/
    );
  });

  it("does not call resetPasswordForEmail directly from the page", () => {
    expect(pageSrc).not.toMatch(/resetPasswordForEmail/);
  });

  it("delegates to the server action requestPasswordReset", () => {
    expect(pageSrc).toMatch(/requestPasswordReset/);
    expect(pageSrc).toMatch(/from\s+["']\.\/actions["']/);
  });
});

describe("forgot-password actions — server-side reset path", () => {
  const actionsSrc = readSrc("src/app/(auth)/forgot-password/actions.ts");

  it("is marked as a server module (use server)", () => {
    expect(actionsSrc).toMatch(/^["']use server["'];?/m);
  });

  it("validates input with a zod schema", () => {
    expect(actionsSrc).toMatch(/forgotPasswordSchema/);
  });

  it("uses the admin client to call resetPasswordForEmail", () => {
    expect(actionsSrc).toMatch(/createAdminClient/);
    expect(actionsSrc).toMatch(/resetPasswordForEmail/);
  });

  it("gates on the Upstash `auth` rate-limit bucket", () => {
    expect(actionsSrc).toMatch(/checkRateLimit\([^)]*["']auth["']\s*\)/);
  });

  it("keys the RL bucket by ip + normalised email", () => {
    // The exact key string is `forgot-password:${ip}:${email}`.
    expect(actionsSrc).toMatch(/forgot-password:/);
  });
});

// ───────────────────────────────────────────────────────────────────────
// Behavioural tests. We mock the RL + admin-client modules and drive
// the server action through its public signature.
// ───────────────────────────────────────────────────────────────────────

vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (name: string) => {
      if (name === "x-forwarded-for") return "127.0.0.1";
      if (name === "host") return "localhost:3000";
      if (name === "x-forwarded-proto") return "http";
      return null;
    },
  }),
}));

const checkRateLimitMock = vi.fn();
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimitMock(...args),
}));

const resetPasswordForEmailMock = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: {
      resetPasswordForEmail: (...args: unknown[]) =>
        resetPasswordForEmailMock(...args),
    },
  }),
}));

vi.mock("@/lib/logger", () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import { requestPasswordReset } from "../../app/(auth)/forgot-password/actions";

function fd(email: unknown): FormData {
  const f = new FormData();
  if (email !== undefined) f.set("email", String(email));
  return f;
}

describe("requestPasswordReset — behaviour", () => {
  beforeEach(() => {
    checkRateLimitMock.mockReset();
    resetPasswordForEmailMock.mockReset();
    checkRateLimitMock.mockResolvedValue({ success: true, remaining: 9 });
    resetPasswordForEmailMock.mockResolvedValue({ error: null });
  });

  afterEach(() => vi.restoreAllMocks());

  it("returns generic success for a normal reset request", async () => {
    const res = await requestPasswordReset(fd("user@example.com"));
    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
    expect(res.message).toMatch(/if an account exists/i);
    expect(resetPasswordForEmailMock).toHaveBeenCalledWith(
      "user@example.com",
      expect.objectContaining({
        redirectTo: expect.stringContaining("/reset-password"),
      })
    );
  });

  it("returns generic success for a nonexistent email (enumeration safe)", async () => {
    // Supabase's resetPasswordForEmail intentionally returns { error: null }
    // even when the email is unknown — to prevent enumeration. We must
    // NOT distinguish this from the happy path.
    resetPasswordForEmailMock.mockResolvedValue({ error: null });
    const res = await requestPasswordReset(fd("ghost@nowhere.test"));
    expect(res.ok).toBe(true);
    expect(res.message).toMatch(/if an account exists/i);
    // Crucially the message is identical to the known-email branch.
    const known = await requestPasswordReset(fd("user@example.com"));
    expect(res.message).toBe(known.message);
  });

  it("returns 429 with retry copy when Upstash RL window exceeded", async () => {
    checkRateLimitMock.mockResolvedValue({ success: false, remaining: 0 });
    const res = await requestPasswordReset(fd("user@example.com"));
    expect(res.ok).toBe(false);
    expect(res.status).toBe(429);
    expect(res.message).toMatch(/too many requests/i);
    expect(resetPasswordForEmailMock).not.toHaveBeenCalled();
  });

  it("surfaces friendly retry copy on Supabase platform RL (not raw error)", async () => {
    resetPasswordForEmailMock.mockResolvedValue({
      error: {
        code: "over_email_send_rate_limit",
        message: "Email rate limit exceeded",
        status: 429,
      },
    });
    const res = await requestPasswordReset(fd("user@example.com"));
    expect(res.ok).toBe(false);
    expect(res.status).toBe(429);
    expect(res.message).toMatch(/reset requests.*last hour/i);
    // Never leak the raw Supabase string.
    expect(res.message).not.toMatch(/Email rate limit exceeded/);
    expect(res.message).not.toMatch(/API rate limit/i);
  });

  it("maps generic Supabase errors to the friendly generic error (no leak)", async () => {
    resetPasswordForEmailMock.mockResolvedValue({
      error: {
        code: "unexpected_failure",
        message: "internal database crash at line 42",
        status: 500,
      },
    });
    const res = await requestPasswordReset(fd("user@example.com"));
    expect(res.ok).toBe(false);
    expect(res.status).toBe(500);
    expect(res.message).toMatch(/something went wrong/i);
    expect(res.message).not.toMatch(/database crash/);
  });

  it("returns 400 for malformed email — generic 'valid email' copy, no account-exists leak", async () => {
    const res = await requestPasswordReset(fd("not-an-email"));
    expect(res.ok).toBe(false);
    expect(res.status).toBe(400);
    expect(res.message).toMatch(/valid email/i);
    // Must not distinguish "email X doesn't exist" from "malformed"
    expect(res.message).not.toMatch(/exist/i);
    expect(res.message).not.toMatch(/not found/i);
    expect(resetPasswordForEmailMock).not.toHaveBeenCalled();
  });

  it("returns 400 for empty or missing email", async () => {
    const emptyRes = await requestPasswordReset(fd(""));
    expect(emptyRes.ok).toBe(false);
    expect(emptyRes.status).toBe(400);

    const missingRes = await requestPasswordReset(new FormData());
    expect(missingRes.ok).toBe(false);
    expect(missingRes.status).toBe(400);

    expect(resetPasswordForEmailMock).not.toHaveBeenCalled();
  });

  it("normalises email (trim + lowercase) before calling Supabase", async () => {
    await requestPasswordReset(fd("  User@Example.COM  "));
    expect(resetPasswordForEmailMock).toHaveBeenCalledWith(
      "user@example.com",
      expect.any(Object)
    );
  });

  it("catches unexpected throws from the admin client and returns generic error", async () => {
    resetPasswordForEmailMock.mockRejectedValue(new Error("network down"));
    const res = await requestPasswordReset(fd("user@example.com"));
    expect(res.ok).toBe(false);
    expect(res.status).toBe(500);
    expect(res.message).toMatch(/something went wrong/i);
    expect(res.message).not.toMatch(/network down/);
  });
});
