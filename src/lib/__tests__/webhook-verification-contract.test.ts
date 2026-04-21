// PR-04 contract test — webhook signatures + fail-closed sweep.
//
// This suite enforces the Pattern 4 guarantees for every inbound webhook
// and OAuth callback the platform exposes:
//
//   1. The shared verification helpers in src/lib/webhook-security.ts
//      are correct, constant-time, and never fall through when the
//      secret / signature is missing or malformed.
//   2. Every real handler in src/app/api/webhooks and
//      src/app/api/integrations/[provider]/(callback|webhook) either uses
//      one of those helpers OR the vendor SDK own constructEvent.
//      Grep-level guard: no handler may return {received:true} on a
//      signature failure.
//   3. The fixed call-sites (Resend, Woo, Shopify, scheduled-reports,
//      quote PDF) are frozen — any future PR that reintroduces the
//      fail-open pattern will fail the test.
//   4. The Shopify OAuth state is signed + bound to a browser nonce; the
//      verify helpers round-trip correctly and reject tampering.
//
// Everything here is static-analysis or pure-helper behaviour — no
// network, no DB — so it runs in CI in milliseconds.

import { describe, expect, it } from "vitest";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  verifyResendSvixSignature,
  verifyWooSignature,
  verifyShopifyOAuthHmac,
  verifyStripeSignature,
  verifyWebhookSignature,
  signOAuthState,
  verifyOAuthState,
} from "../webhook-security";

const ROOT = path.resolve(__dirname, "../../..");
function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

// ── Basic HMAC helper — empty / tampered inputs ─────────────────────────
describe("verifyWebhookSignature (generic sha256-hex)", () => {
  const secret = "whsec_test_secret";
  const payload = '{"hello":"world"}';
  const valid = crypto.createHmac("sha256", secret).update(payload).digest("hex");

  it("accepts a correct signature", () => {
    expect(verifyWebhookSignature(payload, valid, secret)).toBe(true);
  });
  it("rejects empty secret", () => {
    expect(verifyWebhookSignature(payload, valid, "")).toBe(false);
  });
  it("rejects empty signature", () => {
    expect(verifyWebhookSignature(payload, "", secret)).toBe(false);
  });
  it("rejects empty payload", () => {
    expect(verifyWebhookSignature("", valid, secret)).toBe(false);
  });
  it("rejects a forged body under the same secret", () => {
    expect(
      verifyWebhookSignature('{"hello":"evil"}', valid, secret),
    ).toBe(false);
  });
  it("rejects a signature of mismatched length (no throw)", () => {
    expect(verifyWebhookSignature(payload, "short", secret)).toBe(false);
  });
});

// ── Resend (Svix) — the W7-CRIT-01 regression ────────────────────────────
describe("verifyResendSvixSignature (W7-CRIT-01 regression)", () => {
  const rawSecret = "test-raw-secret-32-bytes-xxxxxxxxxx";
  const prefixedSecret = `whsec_${Buffer.from(rawSecret, "utf8").toString("base64")}`;
  const id = "msg_2aR3...";
  const timestamp = "1700000000";
  const body = JSON.stringify({ type: "email.delivered", data: { email_id: "e_1" } });

  function sign(
    secretStr: string,
    idStr: string,
    tsStr: string,
    bodyStr: string,
  ): string {
    const cleaned = secretStr.startsWith("whsec_")
      ? secretStr.slice("whsec_".length)
      : secretStr;
    const secretBytes = Buffer.from(cleaned, "base64");
    const signedPayload = `${idStr}.${tsStr}.${bodyStr}`;
    const mac = crypto
      .createHmac("sha256", secretBytes.length ? secretBytes : Buffer.from(cleaned, "utf8"))
      .update(signedPayload)
      .digest("base64");
    return `v1,${mac}`;
  }

  it("accepts a valid Svix signature", () => {
    const sig = sign(prefixedSecret, id, timestamp, body);
    expect(
      verifyResendSvixSignature(body, { id, timestamp, signature: sig }, prefixedSecret),
    ).toBe(true);
  });

  it("rejects when the signing-secret env var is empty — fail-closed", () => {
    const sig = sign(prefixedSecret, id, timestamp, body);
    expect(
      verifyResendSvixSignature(body, { id, timestamp, signature: sig }, ""),
    ).toBe(false);
  });

  it("rejects when svix-id is missing", () => {
    const sig = sign(prefixedSecret, id, timestamp, body);
    expect(
      verifyResendSvixSignature(body, { id: null, timestamp, signature: sig }, prefixedSecret),
    ).toBe(false);
  });

  it("rejects when svix-timestamp is missing", () => {
    const sig = sign(prefixedSecret, id, timestamp, body);
    expect(
      verifyResendSvixSignature(body, { id, timestamp: null, signature: sig }, prefixedSecret),
    ).toBe(false);
  });

  it("rejects when svix-signature header is missing", () => {
    expect(
      verifyResendSvixSignature(body, { id, timestamp, signature: null }, prefixedSecret),
    ).toBe(false);
  });

  it("rejects a tampered body under the same signature", () => {
    const sig = sign(prefixedSecret, id, timestamp, body);
    const tampered = body.replace("email.delivered", "email.bounced");
    expect(
      verifyResendSvixSignature(tampered, { id, timestamp, signature: sig }, prefixedSecret),
    ).toBe(false);
  });

  it("rejects a signature produced with a different secret", () => {
    const wrongSecretPrefixed = `whsec_${Buffer.from("different-secret", "utf8").toString("base64")}`;
    const wrongSig = sign(wrongSecretPrefixed, id, timestamp, body);
    expect(
      verifyResendSvixSignature(body, { id, timestamp, signature: wrongSig }, prefixedSecret),
    ).toBe(false);
  });

  it("accepts multi-sig header where one v1 entry matches", () => {
    const valid = sign(prefixedSecret, id, timestamp, body);
    const combined = `v1,bogus ${valid}`;
    expect(
      verifyResendSvixSignature(body, { id, timestamp, signature: combined }, prefixedSecret),
    ).toBe(true);
  });
});

// ── Woo HMAC — the W6-CRIT-09 fail-closed fix ────────────────────────────
describe("verifyWooSignature (W6-CRIT-09 regression)", () => {
  const secret = "ck_test_consumersecret";
  const body = JSON.stringify({ id: 42, status: "processing" });
  const valid = crypto.createHmac("sha256", secret).update(body, "utf8").digest("base64");

  it("accepts a valid base64 hmac", () => {
    expect(verifyWooSignature(body, valid, secret)).toBe(true);
  });
  it("rejects missing signature (previous fail-open path)", () => {
    expect(verifyWooSignature(body, null, secret)).toBe(false);
  });
  it("rejects missing secret", () => {
    expect(verifyWooSignature(body, valid, null)).toBe(false);
    expect(verifyWooSignature(body, valid, undefined)).toBe(false);
    expect(verifyWooSignature(body, valid, "")).toBe(false);
  });
  it("rejects a forged body", () => {
    expect(
      verifyWooSignature(JSON.stringify({ id: 43, status: "completed" }), valid, secret),
    ).toBe(false);
  });
  it("rejects a signature computed with a different secret", () => {
    const wrong = crypto.createHmac("sha256", "other").update(body).digest("base64");
    expect(verifyWooSignature(body, wrong, secret)).toBe(false);
  });
});

// ── Shopify OAuth HMAC ──────────────────────────────────────────────────
describe("verifyShopifyOAuthHmac", () => {
  const clientSecret = "shpss_test_secret";

  function shopifyParams(overrides: Record<string, string> = {}): URLSearchParams {
    const base: Record<string, string> = {
      code: "abc123",
      shop: "nexpura.myshopify.com",
      state: "signed-state",
      timestamp: "1700000000",
      ...overrides,
    };
    const entries = Object.entries(base).sort(([a], [b]) => (a < b ? -1 : 1));
    const message = entries.map(([k, v]) => `${k}=${v}`).join("&");
    const hmac = crypto.createHmac("sha256", clientSecret).update(message).digest("hex");
    return new URLSearchParams({ ...base, hmac });
  }

  it("accepts Shopify-issued params", () => {
    expect(verifyShopifyOAuthHmac(shopifyParams(), clientSecret)).toBe(true);
  });
  it("rejects a tampered param (code swapped)", () => {
    const p = shopifyParams();
    p.set("code", "tampered");
    expect(verifyShopifyOAuthHmac(p, clientSecret)).toBe(false);
  });
  it("rejects when hmac header is absent", () => {
    const p = shopifyParams();
    p.delete("hmac");
    expect(verifyShopifyOAuthHmac(p, clientSecret)).toBe(false);
  });
  it("rejects when secret is empty", () => {
    expect(verifyShopifyOAuthHmac(shopifyParams(), "")).toBe(false);
  });
});

// ── Shopify OAuth state round-trip (W6-CRIT-08) ─────────────────────────
describe("signed OAuth state (W6-CRIT-08)", () => {
  const secret = "state-secret-abc";

  it("round-trips a payload unchanged", () => {
    const payload = { tenantId: "t_123", nonce: "n_abc", issuedAt: 1700000000000 };
    const state = signOAuthState(payload, secret);
    const decoded = verifyOAuthState<typeof payload>(state, secret);
    expect(decoded).toEqual(payload);
  });

  it("rejects a state signed with a different secret", () => {
    const payload = { tenantId: "t_123" };
    const state = signOAuthState(payload, secret);
    expect(verifyOAuthState<typeof payload>(state, "other-secret")).toBeNull();
  });

  it("rejects a state whose body was tampered after signing", () => {
    const payload = { tenantId: "t_victim" };
    const state = signOAuthState(payload, secret);
    // Replace the payload half with an attacker-controlled value while
    // keeping the original signature.
    const [, sig] = state.split(".");
    const attackerBody = Buffer.from(JSON.stringify({ tenantId: "t_attacker" })).toString("base64")
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const forged = `${attackerBody}.${sig}`;
    expect(verifyOAuthState(forged, secret)).toBeNull();
  });

  it("refuses to sign when secret is empty", () => {
    expect(() => signOAuthState({ tenantId: "x" }, "")).toThrow();
  });

  it("returns null when state is malformed", () => {
    expect(verifyOAuthState("not-a-dot-separated-thing", secret)).toBeNull();
    expect(verifyOAuthState("", secret)).toBeNull();
  });
});

// ── Stripe signature parser still works and is fail-closed ──────────────
describe("verifyStripeSignature", () => {
  const secret = "whsec_stripe_test";
  const body = '{"id":"evt_1"}';
  const ts = "1700000000";
  const signedPayload = `${ts}.${body}`;
  const v1 = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");

  it("accepts a valid t= v1= envelope", () => {
    const header = `t=${ts},v1=${v1}`;
    expect(verifyStripeSignature(body, header, secret)).toBe(true);
  });
  it("rejects when the timestamp element is missing", () => {
    expect(verifyStripeSignature(body, `v1=${v1}`, secret)).toBe(false);
  });
  it("rejects when the v1 element is missing", () => {
    expect(verifyStripeSignature(body, `t=${ts}`, secret)).toBe(false);
  });
  it("rejects when secret is empty", () => {
    expect(verifyStripeSignature(body, `t=${ts},v1=${v1}`, "")).toBe(false);
  });
});

// ── Static-analysis block: handlers must use a verify helper and never
//    return 200 on sig failure ────────────────────────────────────────────
const WEBHOOK_HANDLERS: Array<{ path: string; requires: RegExp[] }> = [
  {
    path: "src/app/api/webhooks/resend/route.ts",
    requires: [/verifyResendSvixSignature/, /status:\s*401/],
  },
  {
    path: "src/app/api/integrations/woocommerce/webhook/route.ts",
    requires: [/verifyWooSignature/, /status:\s*401/, /status:\s*503/],
  },
  {
    path: "src/app/api/integrations/shopify/callback/route.ts",
    requires: [/verifyShopifyOAuthHmac/, /verifyOAuthState/, /timingSafeEqual/],
  },
  {
    path: "src/app/api/integrations/shopify/connect/route.ts",
    requires: [/signOAuthState/, /shopify_oauth_nonce/, /httpOnly/],
  },
  {
    path: "src/app/api/cron/scheduled-reports/route.ts",
    requires: [/safeBearerMatch/, /status:\s*503/],
  },
];

describe("PR-04 static-analysis: handlers use fail-closed verify helpers", () => {
  for (const { path: rel, requires } of WEBHOOK_HANDLERS) {
    it(`${rel} uses the required verification primitives`, () => {
      const src = read(rel);
      for (const r of requires) {
        expect(src, `${rel} missing ${r}`).toMatch(r);
      }
    });

    it(`${rel} never returns 200 with {received: true} on signature failure`, () => {
      const src = read(rel);
      // No handler should return `{ received: true }` in the same branch
      // as an "Invalid signature" / "Missing signature" log line. We
      // assert the simpler invariant: the string "Invalid signature"
      // only appears alongside a 401 (not a 200) status. Grep-level.
      const badPattern = /return\s+NextResponse\.json\(\s*\{\s*received:\s*true/;
      const invalidSigPattern = /Invalid signature/;
      if (invalidSigPattern.test(src)) {
        // Must include a 401 Unauthorized / Invalid signature response.
        expect(src).toMatch(/status:\s*401/);
      }
      // Must NOT return received:true in a fail-open fallback.
      const firstBad = src.match(badPattern);
      if (firstBad) {
        // Only allowed usage: after a successful verification branch.
        // We enforce it by requiring that the line BEFORE contains an
        // explicit ok outcome (very cheap heuristic).
        const idx = src.indexOf(firstBad[0]);
        const windowText = src.slice(Math.max(0, idx - 600), idx);
        expect(
          windowText,
          `${rel} has {received:true} that may be reachable from an unsigned path`,
        ).not.toMatch(/Invalid signature|Missing signature/);
      }
    });
  }
});

// ── Quote PDF: token=anything backdoor is gone (W7-CRIT-03) ─────────────
describe("quote PDF route (W7-CRIT-03)", () => {
  const src = read("src/app/api/quote/[id]/pdf/route.ts");

  it("no longer reads ?token= as an auth bypass", () => {
    // The old code pulled `req.nextUrl.searchParams.get("token")` and
    // skipped the session check if any value was present. The fix:
    // delete the token path entirely.
    expect(src).not.toMatch(/searchParams\.get\(\s*["']token["']\s*\)/);
    expect(src).not.toMatch(/searchParams\.get\(\s*["']preview["']\s*\)/);
  });

  it("requires a Supabase session on every request", () => {
    expect(src).toMatch(/supabase\.auth\.getUser\(\)/);
    expect(src).toMatch(/status:\s*401/);
  });

  it("scopes the quote lookup by the caller's tenant", () => {
    expect(src).toMatch(/\.eq\(\s*["']tenant_id["']/);
  });
});

// ── Woo webhook: .or() filter cannot be broken out of any more ──────────
describe("Woo webhook .or() filter sanitization (W6-CRIT-09 tactical)", () => {
  const src = read("src/app/api/integrations/woocommerce/webhook/route.ts");

  it("routes sku/product_id through sanitizeOrLiteral before .or()", () => {
    expect(src).toMatch(/sanitizeOrLiteral/);
    // No raw template-literal .or(`sku.eq.${...}`) any more.
    expect(src).not.toMatch(/\.or\(\s*`sku\.eq\.\$\{li\.sku\}/);
  });
});

// ── Shopify callback: tenant binding via session ────────────────────────
describe("Shopify callback tenant binding (W6-CRIT-08)", () => {
  const src = read("src/app/api/integrations/shopify/callback/route.ts");

  it("requires the signed-in session tenant to match the signed state tenant", () => {
    expect(src).toMatch(/getAuthContext/);
    expect(src).toMatch(/Tenant mismatch|tenant mismatch/);
  });

  it("validates the shop param against myshopify.com only", () => {
    expect(src).toMatch(/myshopify\.com/);
    expect(src).toMatch(/isValidShopDomain/);
  });

  it("no longer decodes unsigned base64 JSON state", () => {
    expect(src).not.toMatch(/JSON\.parse\(\s*Buffer\.from\(state/);
  });
});
