import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Contract test for M-06 customer-page 1:1 email send.
 *
 * Audit: "1:1 email send modal from customer page" — desktop-Opus
 * spec entry. Pre-fix the customer detail page had no surface for
 * sending an ad-hoc one-off email; staff had to drop into the
 * marketing/bulk-email surface or copy/paste the email externally.
 *
 * Post-fix:
 *   - sendCustomerEmail server action in customers/actions.ts
 *   - Modal in CustomerDetailClient with subject + body
 *   - 3-state result UI (idle / sent / error)
 *   - Recipient pulled from auth.tenantId-scoped customer row,
 *     never from form input — no probe surface for unrelated emails
 *   - Bounced / opt-out / complained customers explicitly blocked
 */

const actionsFile = fs.readFileSync(
  path.resolve(__dirname, "../../app/(app)/customers/actions.ts"),
  "utf8",
);

const clientFile = fs.readFileSync(
  path.resolve(__dirname, "../../app/(app)/customers/[id]/CustomerDetailClient.tsx"),
  "utf8",
);

describe("customers/actions — sendCustomerEmail handler", () => {
  it("exports sendCustomerEmail", () => {
    expect(actionsFile).toMatch(/export\s+async\s+function\s+sendCustomerEmail\s*\(/);
  });

  it("restricts to owner/manager via requireRole", () => {
    const block = actionsFile.match(
      /sendCustomerEmail[\s\S]{0,2000}?requireRole\("owner",\s*"manager"\)/,
    );
    expect(block).not.toBeNull();
  });

  it("loads the customer scoped to auth.tenantId (no client-supplied email)", () => {
    const block = actionsFile.match(
      /sendCustomerEmail[\s\S]{0,3000}?\.from\("customers"\)[\s\S]{0,500}?\.eq\("id",\s*customerId\)[\s\S]{0,200}?\.eq\("tenant_id",\s*auth\.tenantId\)/,
    );
    expect(block).not.toBeNull();
  });

  it("blocks send when customer.email is missing/bounced/complained/opted-out", () => {
    expect(actionsFile).toMatch(/no email address on file/);
    expect(actionsFile).toMatch(/email has bounced/);
    expect(actionsFile).toMatch(/marked emails as spam/);
    expect(actionsFile).toMatch(/opted out of marketing emails/);
  });

  it("delegates the actual send to sendMarketingEmail (no campaignId key)", () => {
    const block = actionsFile.match(
      /sendCustomerEmail[\s\S]{0,4000}?await\s+sendMarketingEmail\(\s*\{[\s\S]{0,300}?\}/,
    );
    expect(block).not.toBeNull();
    // No campaignId KEY in the call argument — keeps this send out
    // of campaign analytics. Look for the key:value pattern, not
    // the bare token (which appears in the surrounding comment).
    expect(block?.[0]).not.toMatch(/campaignId\s*:/);
  });

  it("validates subject + body length bounds", () => {
    expect(actionsFile).toMatch(/Subject is too long/);
    expect(actionsFile).toMatch(/Body is too long/);
  });
});

describe("CustomerDetailClient — M-06 modal", () => {
  it("imports sendCustomerEmail", () => {
    expect(clientFile).toMatch(/sendCustomerEmail/);
  });

  it("models a 3-state email result (idle / sent / error)", () => {
    expect(clientFile).toMatch(/kind:\s*"idle"/);
    expect(clientFile).toMatch(/kind:\s*"sent"/);
    expect(clientFile).toMatch(/kind:\s*"error"/);
  });

  it("renders Sent copy ONLY in the 'sent' branch", () => {
    expect(clientFile).toMatch(/emailResult\.kind\s*===\s*"sent"/);
  });

  it("renders error copy in the 'error' branch", () => {
    expect(clientFile).toMatch(/emailResult\.kind\s*===\s*"error"/);
  });

  it("ambiguous handler response treated as error (not silent success)", () => {
    expect(clientFile).toMatch(/unexpected response/);
  });

  it("Send-email button gated on customer.email present", () => {
    expect(clientFile).toMatch(/customer\.email\s*&&/);
    expect(clientFile).toMatch(/Send email/);
  });
});
