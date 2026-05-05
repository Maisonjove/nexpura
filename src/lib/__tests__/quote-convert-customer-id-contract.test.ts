import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Contract test for M-02 quote→sale customer_id propagation.
 *
 * Audit: "Quotes → convert to sale loses customer attachment.
 * Notes: Pass customer_id through the conversion mutation."
 *
 * Pre-fix the convertQuoteToSale handler dereferenced the embedded
 * customers row to name+email strings but DROPPED the customer_id
 * link on the sale insert. Result: the new sale's customer_history
 * lookups missed it.
 */

const file = fs.readFileSync(
  path.resolve(__dirname, "../../app/(app)/quotes/actions-server.ts"),
  "utf8",
);

describe("convertQuoteToSale — M-02 customer_id propagation", () => {
  it("reads customer_id from the loaded quote row", () => {
    expect(file).toMatch(
      /customerId\s*=[\s\S]{0,80}fullQuote[\s\S]{0,80}customer_id/,
    );
  });

  it("includes customer_id in the sales insert", () => {
    // The insert object must include `customer_id: customerId`.
    const insertBlock = file.match(
      /\.from\("sales"\)\s*\.insert\(\{[\s\S]{0,1500}\}\)/,
    );
    expect(insertBlock).not.toBeNull();
    expect(insertBlock?.[0]).toMatch(/customer_id:\s*customerId/);
  });

  it("preserves the existing customer_name + customer_email copy", () => {
    // Denormalised copies for receipts must not regress.
    const insertBlock = file.match(
      /\.from\("sales"\)\s*\.insert\(\{[\s\S]{0,1500}\}\)/,
    );
    expect(insertBlock?.[0]).toMatch(/customer_name:/);
    expect(insertBlock?.[0]).toMatch(/customer_email:/);
  });
});
