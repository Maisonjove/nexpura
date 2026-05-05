import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Contract test for Section 4 #4 (test-send/dry-run on quotes +
 * invoices).
 *
 * Pre-fix emailQuote + emailInvoice shipped directly to the
 * customer — typo in body / broken link / wrong subject went
 * straight to the recipient with no preview path. This PR adds
 * a `sendToOperator` option that routes the rendered email to
 * the authed user's inbox + prefixes subject `[TEST]`. UI exposes
 * "Send test to me" buttons next to the existing Send buttons.
 */

const emailQuote = fs.readFileSync(
  path.resolve(__dirname, "../../app/(app)/quotes/emailQuote.ts"),
  "utf8",
);

const emailInvoice = fs.readFileSync(
  path.resolve(__dirname, "../../app/(app)/invoices/[id]/emailInvoice.ts"),
  "utf8",
);

const quoteClient = fs.readFileSync(
  path.resolve(__dirname, "../../app/(app)/quotes/QuoteDetailClient.tsx"),
  "utf8",
);

const invoiceButton = fs.readFileSync(
  path.resolve(__dirname, "../../app/(app)/invoices/[id]/components/EmailInvoiceButton.tsx"),
  "utf8",
);

describe("emailQuote — sendToOperator option", () => {
  it("declares EmailQuoteOptions with sendToOperator", () => {
    expect(emailQuote).toMatch(/EmailQuoteOptions[\s\S]{0,200}sendToOperator\?:\s*boolean/);
  });

  it("recipient defaults to customer email; switches to user.email when sendToOperator", () => {
    expect(emailQuote).toMatch(
      /options\.sendToOperator\s*\?\s*user\.email\s*\?\?\s*null\s*:\s*customerEmail/,
    );
  });

  it("subject is prefixed [TEST] on operator sends", () => {
    expect(emailQuote).toMatch(
      /options\.sendToOperator\s*\?\s*`\[TEST\]\s*\$\{subjectBase\}`\s*:\s*subjectBase/,
    );
  });

  it("returns sentTo on success so the UI can confirm to the user", () => {
    expect(emailQuote).toMatch(/return\s*\{\s*success:\s*true,\s*sentTo:\s*recipient\s*\}/);
  });
});

describe("emailInvoice — sendToOperator option", () => {
  it("declares EmailInvoiceOptions with sendToOperator", () => {
    expect(emailInvoice).toMatch(/EmailInvoiceOptions[\s\S]{0,200}sendToOperator\?:\s*boolean/);
  });

  it("recipient defaults to customer email; switches to user.email when sendToOperator", () => {
    expect(emailInvoice).toMatch(
      /options\.sendToOperator\s*\?\s*user\.email\s*\?\?\s*null\s*:\s*customerEmail/,
    );
  });

  it("subject is prefixed [TEST] on operator sends", () => {
    expect(emailInvoice).toMatch(
      /options\.sendToOperator\s*\?\s*`\[TEST\]\s*\$\{subjectBase\}`\s*:\s*subjectBase/,
    );
  });

  it("test-send branch SKIPS the draft→unpaid status flip + customer_communications insert", () => {
    // Both side effects are state-of-record changes that should
    // only fire on real customer sends.
    expect(emailInvoice).toMatch(
      /if\s*\(\s*options\.sendToOperator\s*\)\s*\{[\s\S]{0,200}?return\s*\{\s*success:\s*true,\s*sentTo/,
    );
  });

  it("returns sentTo on success so the UI can confirm", () => {
    expect(emailInvoice).toMatch(/return\s*\{\s*success:\s*true,\s*sentTo:\s*recipient\s*\}/);
  });
});

describe("QuoteDetailClient — Send test to me button", () => {
  it("declares handleEmailQuoteTest that calls emailQuote with sendToOperator", () => {
    expect(quoteClient).toMatch(/async\s+function\s+handleEmailQuoteTest/);
    expect(quoteClient).toMatch(/emailQuote\(quote\.id,\s*\{\s*sendToOperator:\s*true\s*\}\)/);
  });

  it("renders a Send test to me button alongside Email Quote", () => {
    expect(quoteClient).toMatch(/Send test to me/);
  });
});

describe("EmailInvoiceButton — Send test to me button", () => {
  it("declares handleSendToMe that calls emailInvoice with sendToOperator", () => {
    expect(invoiceButton).toMatch(/async\s+function\s+handleSendToMe/);
    expect(invoiceButton).toMatch(/emailInvoice\(invoiceId,\s*\{\s*sendToOperator:\s*true\s*\}\)/);
  });

  it("test button works even when customerEmail is null (recipient is operator)", () => {
    // Pre-fix the existing button required customerEmail. The new
    // test path doesn't require it — ensure the disabled gate
    // allows the test action when no customer email is on file.
    const handleBlock = invoiceButton.match(
      /handleSendToMe[\s\S]{0,300}?\}/,
    );
    expect(handleBlock).not.toBeNull();
    if (handleBlock) {
      expect(handleBlock[0]).not.toMatch(/customerEmail/);
    }
  });
});
