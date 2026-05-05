import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Contract test for M-04 repair intake quote email.
 *
 * Audit: "Repair intake quote email." Pre-fix createRepairFromIntake
 * created the repair + optionally an invoice but never emailed the
 * customer the quote — operators had to manually send via
 * /repairs/[id] after intake.
 *
 * Post-fix: when (quoted_price > 0 AND customer has email AND not
 * bounced/complained/opted-out), the QuoteEmail template fires
 * via Resend at the end of intake. Email failure is non-fatal and
 * surfaces to Sentry only — the repair + invoice rows are
 * already-committed state-of-record.
 */

const file = fs.readFileSync(
  path.resolve(__dirname, "../../app/(intake-workspace)/intake/actions.ts"),
  "utf8",
);

describe("createRepairFromIntake — M-04 quote email", () => {
  it("imports the resend client + QuoteEmail template", () => {
    expect(file).toMatch(/import\s*\{\s*resend\s*\}\s*from\s*["']@\/lib\/email\/resend["']/);
    expect(file).toMatch(/import\s+QuoteEmail\s+from\s+["']@\/lib\/email\/templates\/QuoteEmail["']/);
  });

  it("only sends when quoted_price > 0 AND customer_id is present", () => {
    expect(file).toMatch(/\(input\.quoted_price\s*\?\?\s*0\)\s*>\s*0\s*&&\s*input\.customer_id/);
  });

  it("loads customer scoped to tenantId (no probe surface)", () => {
    const block = file.match(
      /M-04[\s\S]{0,3000}?\.from\("customers"\)[\s\S]{0,500}?\.eq\("id",\s*input\.customer_id\)[\s\S]{0,200}?\.eq\("tenant_id",\s*tenantId\)/,
    );
    expect(block).not.toBeNull();
  });

  it("blocks send when email is bounced/complained/opted_out", () => {
    expect(file).toMatch(/email_status\s*!==\s*["']bounced["']/);
    expect(file).toMatch(/email_status\s*!==\s*["']complained["']/);
    expect(file).toMatch(/!customer\.email_opted_out/);
  });

  it("renders QuoteEmail with the repair number + quoted_price", () => {
    expect(file).toMatch(/react:\s*QuoteEmail\(\s*\{/);
    expect(file).toMatch(/quotedPrice:\s*input\.quoted_price/);
    expect(file).toMatch(/repairNumber:\s*data\.repair_number/);
  });

  it("treats send failure as non-fatal (logger only, no return error)", () => {
    expect(file).toMatch(/repair quote email send failed \(non-fatal\)/);
    // Verify the email block doesn't `return { error: ... }` on send failure.
    const block = file.match(
      /repair quote email[\s\S]{0,3000}?(?=\bafter\(\(\)\s*=>)/,
    );
    expect(block).not.toBeNull();
    if (block) {
      expect(block[0]).not.toMatch(/return\s*\{\s*error:/);
    }
  });
});
