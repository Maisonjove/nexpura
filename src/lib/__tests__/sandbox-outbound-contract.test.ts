/**
 * PR-03 contract test — sandbox-outbound-comms sweep.
 *
 * This suite enforces three things that the sandbox guard buys us:
 *
 *   1. The central `resend` client in `src/lib/email/resend.ts` short-
 *      circuits in sandbox mode: zero network calls, synthetic
 *      `{ data: { id: "sandbox-suppressed" } }` response.
 *   2. Every call-site fixed by PR-03 imports a sandbox-aware helper
 *      (`@/lib/email/resend`, `@/lib/email-sender`, `@/lib/twilio-sms`,
 *      or `@/lib/twilio-whatsapp`) rather than constructing a raw
 *      `new Resend(...)` or hand-rolling a `fetch("https://api.twilio.com/…")`.
 *   3. The `sendCommunication` action HTML-escapes customer-supplied
 *      `customer_name` + `body` (W5-CRIT-005) before interpolating into
 *      the template, and requires the customer_email to actually belong
 *      to the caller's tenant.
 *
 * These are static-code + behavioural contracts. They fire on every test
 * run so a future PR cannot silently reintroduce a raw-fetch call-site.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../../..");

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

// ─── Static-analysis block ────────────────────────────────────────────────
//
// Each call-site listed in the PR-03 ticket gets a tiny guard here. A raw
// `new Resend(` or `fetch("https://api.resend.com/emails"` anywhere in
// the file means the sandbox gate is bypassable; a `fetch("https://api.twilio.com/"`
// likewise. The allow-list (central helpers) is excluded by path.

const CALL_SITES_NO_RAW_RESEND = [
  "src/app/(app)/communications/actions.ts",
  "src/app/(app)/repairs/[id]/actions.ts",
  "src/app/(app)/bespoke/[id]/actions.ts",
  "src/app/(app)/invoices/[id]/emailInvoice.ts",
  "src/app/(app)/quotes/emailQuote.ts",
  "src/app/(app)/settings/roles/actions.ts",
  "src/app/api/repair/notify-ready/route.ts",
  "src/app/api/repair/[id]/email-receipt/route.ts",
  "src/app/api/bespoke/send-approval/route.ts",
  "src/app/api/bespoke/[id]/email-receipt/route.ts",
  "src/app/api/appraisals/[id]/insurance-send/route.ts",
  "src/app/api/cron/daily-tasks-digest/route.ts",
  "src/app/api/ai/chat/route.ts",
  "src/lib/invoices/overdue-automation.ts",
  "src/lib/session-manager.ts",
  "src/lib/marketing/email.ts",
];

const CALL_SITES_NO_RAW_TWILIO_FETCH = [
  "src/app/(app)/repairs/[id]/actions.ts",
];

describe("PR-03 static-analysis: no raw Resend construction at fixed call-sites", () => {
  for (const rel of CALL_SITES_NO_RAW_RESEND) {
    it(`${rel} does not instantiate Resend directly`, () => {
      const src = read(rel);
      // A bare `new Resend(` anywhere in this file means someone bypassed
      // the central sandbox-aware client. The one allowed path is the
      // `tracking/send-email` route, which is NOT in this list; it uses a
      // dedicated key with an explicit `isSandbox()` gate inline and is
      // audited separately.
      expect(src).not.toMatch(/new Resend\(/);
    });

    it(`${rel} does not POST raw to api.resend.com/emails`, () => {
      const src = read(rel);
      expect(src).not.toMatch(/fetch\(\s*["'`]https:\/\/api\.resend\.com\/emails/);
    });
  }
});

describe("PR-03 static-analysis: no raw Twilio REST fetch at fixed call-sites", () => {
  for (const rel of CALL_SITES_NO_RAW_TWILIO_FETCH) {
    it(`${rel} does not POST raw to api.twilio.com`, () => {
      const src = read(rel);
      // Neither a direct URL literal nor a templated
      // `https://api.twilio.com/2010-04-01/Accounts/${…}` construction
      // should appear — route it through the sandbox-aware helpers in
      // `src/lib/twilio-sms.ts` / `src/lib/twilio-whatsapp.ts`.
      expect(src).not.toMatch(/https:\/\/api\.twilio\.com\//);
    });
  }
});

// ─── Sandbox-client behavioural contract ──────────────────────────────────
//
// The central `resend` client must short-circuit to a synthetic response
// whenever `isSandbox()` is true, AND must still hit the real Resend SDK
// when sandbox mode is off (verified with a stubbed Resend constructor).
//
// We can't easily intercept the SDK's internal HTTP; the Resend npm pkg
// does its own `fetch`. So we mock the `resend` npm module directly and
// assert the wrapper calls `emails.send` (or not) based on sandbox state.

const sendSpy = vi.fn(async (args: unknown) => ({
  data: { id: "real-resend-id" },
  error: null,
  args,
}));

class MockResend {
  emails = { send: sendSpy };
  // Constructor signature compat — takes an API key, we ignore it.
  constructor(_key?: string) {
    void _key;
  }
}

vi.mock("resend", () => ({
  Resend: MockResend,
}));

vi.mock("@/lib/logger", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe("PR-03 behavioural contract: sandbox short-circuit on @/lib/email/resend", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    sendSpy.mockClear();
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns a synthetic sandbox-suppressed id and NEVER hits the SDK when SANDBOX_MODE=true", async () => {
    process.env.SANDBOX_MODE = "true";
    delete process.env.SANDBOX_REDIRECT_EMAIL;

    const { resend } = await import("@/lib/email/resend");
    const result = await resend.emails.send({
      from: "Test <test@nexpura.com>",
      to: "customer@example.com",
      subject: "hello",
      html: "<p>hi</p>",
    });

    expect(sendSpy).not.toHaveBeenCalled();
    // Shape matches what Resend returns on a real success so callers
    // reading `data.id` continue to work.
    expect(result).toMatchObject({
      data: { id: "sandbox-suppressed" },
      error: null,
    });
  });

  it("redirects to SANDBOX_REDIRECT_EMAIL with a [SANDBOX] banner when set", async () => {
    process.env.SANDBOX_MODE = "true";
    process.env.SANDBOX_REDIRECT_EMAIL = "qa@nexpura.com";

    const { resend } = await import("@/lib/email/resend");
    await resend.emails.send({
      from: "Test <test@nexpura.com>",
      to: "customer@example.com",
      subject: "original",
      html: "<p>body</p>",
    });

    expect(sendSpy).toHaveBeenCalledTimes(1);
    const call = sendSpy.mock.calls[0][0] as {
      to: string; subject: string; html: string;
    };
    expect(call.to).toBe("qa@nexpura.com");
    expect(call.subject).toMatch(/^\[SANDBOX\]/);
    expect(call.html).toMatch(/\[SANDBOX\].*Originally intended for: customer@example\.com/s);
  });

  it("hits the underlying Resend SDK when sandbox mode is OFF", async () => {
    delete process.env.SANDBOX_MODE;
    process.env.NODE_ENV = "production";
    process.env.VERCEL_ENV = "production";

    const { resend } = await import("@/lib/email/resend");
    const args = {
      from: "Test <test@nexpura.com>",
      to: "customer@example.com",
      subject: "real",
      html: "<p>real</p>",
    };
    const result = await resend.emails.send(args);

    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy.mock.calls[0][0]).toMatchObject(args);
    expect(result).toMatchObject({ data: { id: "real-resend-id" } });
  });
});

describe("PR-03 behavioural contract: sandbox short-circuit on @/lib/twilio-sms", () => {
  const originalEnv = { ...process.env };
  const fetchSpy = vi.fn();

  beforeEach(() => {
    fetchSpy.mockReset();
    vi.resetModules();
    global.fetch = fetchSpy as unknown as typeof fetch;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("NEVER fetches api.twilio.com when SANDBOX_MODE=true", async () => {
    process.env.SANDBOX_MODE = "true";
    const { sendTwilioSms } = await import("@/lib/twilio-sms");
    const result = await sendTwilioSms("+61400000000", "test");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true, messageId: "sandbox-suppressed" });
  });

  it("calls api.twilio.com when sandbox is off", async () => {
    delete process.env.SANDBOX_MODE;
    process.env.NODE_ENV = "production";
    process.env.VERCEL_ENV = "production";
    process.env.TWILIO_ACCOUNT_SID = "ACtest";
    process.env.TWILIO_AUTH_TOKEN = "token";
    process.env.TWILIO_SMS_NUMBER_AU = "+61400000001";

    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ sid: "SMtest" }),
    });

    const { sendTwilioSms } = await import("@/lib/twilio-sms");
    const result = await sendTwilioSms("+61400000000", "test");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toMatch(/^https:\/\/api\.twilio\.com\/2010-04-01\/Accounts\/ACtest\/Messages\.json$/);
    expect(result).toEqual({ success: true, messageId: "SMtest" });
  });
});

describe("PR-03 behavioural contract: sandbox short-circuit on @/lib/twilio-whatsapp", () => {
  const originalEnv = { ...process.env };
  const fetchSpy = vi.fn();

  beforeEach(() => {
    fetchSpy.mockReset();
    vi.resetModules();
    global.fetch = fetchSpy as unknown as typeof fetch;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("NEVER fetches api.twilio.com when SANDBOX_MODE=true", async () => {
    process.env.SANDBOX_MODE = "true";
    const { sendTwilioWhatsApp } = await import("@/lib/twilio-whatsapp");
    const result = await sendTwilioWhatsApp("+61400000000", "test");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true, messageId: "sandbox-suppressed" });
  });
});

// ─── @/lib/email-sender contract ──────────────────────────────────────────

describe("PR-03 behavioural contract: sandbox short-circuit on @/lib/email-sender", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    sendSpy.mockClear();
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("sendSystemEmail returns sandbox-suppressed and never calls Resend SDK in sandbox mode", async () => {
    process.env.SANDBOX_MODE = "true";
    delete process.env.SANDBOX_REDIRECT_EMAIL;

    const { sendSystemEmail } = await import("@/lib/email-sender");
    const result = await sendSystemEmail({
      to: "customer@example.com",
      subject: "hi",
      html: "<p>body</p>",
    });

    expect(sendSpy).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true, messageId: "sandbox-suppressed" });
  });
});

// ─── sendCommunication HTML-escape + customer_email verify (W5-CRIT-005) ──
//
// Static guard: the file must import `escapeHtml` and must invoke it on
// the customer-supplied `customerName` and `body` before the HTML is
// assembled. We don't spin up a full integration, but we do assert that
// the escape function is actually threaded through the template — a
// common regression mode is "import but never use".

describe("W5-CRIT-005: sendCommunication HTML escape + customer_email tenant scoping", () => {
  const src = read("src/app/(app)/communications/actions.ts");

  it("imports escapeHtml from @/lib/sanitize", () => {
    expect(src).toMatch(
      /import\s*\{[^}]*\bescapeHtml\b[^}]*\}\s*from\s*["']@\/lib\/sanitize["']/,
    );
  });

  it("calls escapeHtml on user-supplied customerName before interpolation", () => {
    expect(src).toMatch(/escapeHtml\(\s*customerName\s*\)/);
  });

  it("calls escapeHtml on user-supplied body before interpolation", () => {
    expect(src).toMatch(/escapeHtml\(\s*body\s*\)/);
  });

  it("does NOT interpolate raw ${customerName} into the outbound HTML string", () => {
    // The interpolation template must use the escaped local variable.
    expect(src).not.toMatch(/<p>Hi \$\{customerName\},<\/p>/);
  });

  it("verifies customer_email belongs to the caller's tenant before sending", () => {
    expect(src).toMatch(/customerEmailBelongsToTenant/);
    // And the helper itself scopes on tenant_id + email.
    expect(src).toMatch(/\.eq\("tenant_id",\s*tenantId\)/);
  });
});

// ─── W6-HIGH-13: whatsapp/send RBAC gate ──────────────────────────────────

describe("W6-HIGH-13: /api/notifications/whatsapp requires owner/manager role", () => {
  const src = read("src/app/api/notifications/whatsapp/route.ts");

  it("calls requireRole with owner and manager", () => {
    expect(src).toMatch(/requireRole\(\s*["']owner["']\s*,\s*["']manager["']\s*\)/);
  });

  it("translates role_denied into a 403 response", () => {
    expect(src).toMatch(/role_denied/);
    expect(src).toMatch(/status:\s*403/);
  });
});

// ─── ESLint rule sanity check ─────────────────────────────────────────────

describe("ESLint config bans raw resend/twilio/sendgrid imports outside the comms layer", () => {
  const cfg = read("eslint.config.mjs");

  it("no-restricted-imports bans 'resend'", () => {
    expect(cfg).toMatch(/no-restricted-imports/);
    expect(cfg).toMatch(/name:\s*["']resend["']/);
  });

  it("no-restricted-imports bans 'twilio'", () => {
    expect(cfg).toMatch(/name:\s*["']twilio["']/);
  });

  it("no-restricted-imports bans @sendgrid/* via patterns", () => {
    expect(cfg).toMatch(/@sendgrid\/\*/);
  });

  it("whitelists the central comms files", () => {
    expect(cfg).toMatch(/src\/lib\/email\/resend\.ts/);
    expect(cfg).toMatch(/src\/lib\/email-sender\.ts/);
    expect(cfg).toMatch(/src\/lib\/twilio-sms\.ts/);
    expect(cfg).toMatch(/src\/lib\/twilio-whatsapp\.ts/);
  });
});
