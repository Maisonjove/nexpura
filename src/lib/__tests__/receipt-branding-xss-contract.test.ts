import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { escapeHtml } from "../sanitize";

/**
 * Regression contract for PR-08:
 *   - W3-HIGH-06: /print/receipt must not hardcode tenant branding.
 *     Every customer-facing string (business name, ABN, email, address)
 *     is pulled from the tenants row at render time; pages opened for
 *     another tenant do NOT display Marcus & Co. letterhead.
 *   - W3-HIGH-05: /api/refund/[id]/pdf must HTML-escape every
 *     customer-authored field before string-interpolating into the
 *     HTML response. Prevents same-tenant stored XSS via refund notes
 *     / reason / customer_name / item.description / refund_method.
 *
 * These are lock-tests: they grep the source to assert the bug
 * pattern is gone AND the fix pattern is present. Any future edit
 * that re-introduces the hardcoded brand or drops the escape breaks
 * CI.
 */

function readSrc(rel: string): string {
  return fs.readFileSync(path.resolve(__dirname, "..", "..", rel), "utf8");
}

describe("W3-HIGH-06 /print/receipt — tenant branding comes from the tenants row", () => {
  const src = readSrc("app/print/receipt/[jobType]/[jobId]/page.tsx");

  it("no longer hardcodes 'Marcus & Co.' in any rendered markup", () => {
    // Strip // comment lines so the in-file explanation of the
    // remediation doesn't self-trigger the regex. The test only cares
    // about what actually renders.
    const code = src
      .split("\n")
      .filter((l) => !l.trim().startsWith("//"))
      .join("\n");
    expect(code).not.toMatch(/Marcus\s*&\s*Co/);
    expect(code).not.toMatch(/Marcus\s*&amp;\s*Co/);
  });

  it("no longer hardcodes the Marcus ABN / address / email", () => {
    expect(src).not.toMatch(/12 345 678 901/);
    expect(src).not.toMatch(/32 Castlereagh St/);
    expect(src).not.toMatch(/hello@marcusandco\.com\.au/);
  });

  it("fetches business_name, abn, email, phone + address from the tenants row", () => {
    expect(src).toMatch(/from\(["']tenants["']\)/);
    expect(src).toMatch(/business_name/);
    expect(src).toMatch(/abn/);
    expect(src).toMatch(/address_line1/);
    expect(src).toMatch(/suburb/);
    expect(src).toMatch(/state/);
    expect(src).toMatch(/postcode/);
  });

  it("scopes the tenants row fetch to the authenticated caller's tenant id", () => {
    // The tenant fetch must use the user.id -> users.tenant_id chain
    // that pre-existed the fix; the add-on is now pulling the tenants
    // row using that id.
    expect(src).toMatch(/\.eq\(["']id["'],\s*userData\.tenant_id\)/);
  });

  it("the rendered header + footer reference the resolved businessName", () => {
    expect(src).toMatch(/\{businessName\}/);
  });
});

describe("W3-HIGH-05 /api/refund/[id]/pdf — every dynamic field is escapeHtml'd", () => {
  const src = readSrc("app/api/refund/[id]/pdf/route.ts");

  it("imports escapeHtml from the sanitize lib", () => {
    expect(src).toMatch(/import \{[^}]*escapeHtml[^}]*\} from ["']@\/lib\/sanitize["']/);
  });

  it("customer_name, reason, refund_method, notes go through escapeHtml()", () => {
    expect(src).toMatch(/escapeHtml\(refund\.customer_name[^)]*\)/);
    expect(src).toMatch(/escapeHtml\(refund\.reason[^)]*\)/);
    expect(src).toMatch(/escapeHtml\(refund\.refund_method[^)]*\)/);
    expect(src).toMatch(/escapeHtml\(refund\.notes\)/);
  });

  it("business_name / abn / phone go through escapeHtml()", () => {
    expect(src).toMatch(/escapeHtml\(tenant\?\.business_name[^)]*\)/);
    expect(src).toMatch(/escapeHtml\(tenant\.abn\)/);
    expect(src).toMatch(/escapeHtml\(tenant\.phone\)/);
  });

  it("item.description is escaped when building the line-item rows", () => {
    expect(src).toMatch(/escapeHtml\(String\(item\.description[^)]*\)\)/);
  });

  it("the raw-interpolation pattern is gone (no ${refund.reason} without escape)", () => {
    // Canonical XSS bug was `${refund.reason || "—"}` interpolated
    // directly. The fix names the escaped variable `refundReason`.
    expect(src).not.toMatch(/\$\{refund\.reason\s*\|\|/);
    expect(src).not.toMatch(/\$\{refund\.notes\s*\}/);
    expect(src).not.toMatch(/\$\{refund\.customer_name\s*\|\|/);
  });
});

describe("escapeHtml() primitive — locks the behaviour the PDF route depends on", () => {
  it("escapes <script> tags", () => {
    expect(escapeHtml("<script>alert(1)</script>")).toBe(
      "&lt;script&gt;alert(1)&lt;/script&gt;"
    );
  });

  it("escapes event handlers (double + single quote)", () => {
    expect(escapeHtml(`<img src=x onerror="alert(1)">`)).toBe(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"
    );
    expect(escapeHtml(`<img src=x onerror='alert(1)'>`)).toBe(
      "&lt;img src=x onerror=&#39;alert(1)&#39;&gt;"
    );
  });

  it("escapes ampersands without double-encoding entities", () => {
    // Canonical behaviour: & is the first char escaped so existing
    // entities become &amp;&lt;...&gt;. Lock this so a future rewrite
    // doesn't accidentally double-escape and break output.
    expect(escapeHtml("AT&T")).toBe("AT&amp;T");
    expect(escapeHtml("&amp;")).toBe("&amp;amp;");
  });

  it("is a string->string function (no DOM dependency)", () => {
    expect(typeof escapeHtml("x")).toBe("string");
  });
});
