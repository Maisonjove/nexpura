import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Contract test for the L-06 settings/email test-send button.
 *
 * Audit (desktop-Opus 2.6): the email settings test surface must
 * NEVER render "Sent" without an explicit success signal from the
 * handler. The pre-fix surface (a) didn't exist or (b) had a fire-
 * and-forget pattern that rendered "Sent" before the SMTP attempt
 * resolved.
 *
 * Post-fix invariants (this test pins them):
 *
 *   1. The action `sendDomainTestEmail` returns a discriminated shape
 *      `{ success?, sentTo?, error? }` and NEVER `{ success: true }`
 *      when the underlying Resend call returned an error.
 *
 *   2. The action awaits `resend.emails.send` (no fire-and-forget)
 *      and surfaces Resend's error message verbatim.
 *
 *   3. The UI uses a 3-state result (sending / sent / error) and
 *      only renders the success copy when `testState.status === "sent"`
 *      AND the handler returned a confirmed `success: true` + non-
 *      empty `sentTo`.
 *
 *   4. The "ambiguous response" defensive branch (handler returns
 *      neither error nor success) renders an error, not a success.
 */

const actionsFile = fs.readFileSync(
  path.resolve(__dirname, "../../app/(app)/settings/email/actions.ts"),
  "utf8",
);

const clientFile = fs.readFileSync(
  path.resolve(__dirname, "../../app/(app)/settings/email/EmailDomainClient.tsx"),
  "utf8",
);

describe("settings/email — sendDomainTestEmail handler", () => {
  it("exports sendDomainTestEmail", () => {
    expect(actionsFile).toMatch(/export\s+async\s+function\s+sendDomainTestEmail\s*\(/);
  });

  it("awaits resend.emails.send (no fire-and-forget)", () => {
    expect(actionsFile).toMatch(/await\s+resend\.emails\.send\s*\(/);
  });

  it("destructures { data, error } and surfaces Resend error verbatim", () => {
    expect(actionsFile).toMatch(/const\s*\{\s*data,\s*error\s*\}\s*=\s*await\s+resend\.emails\.send/);
    expect(actionsFile).toMatch(/return\s*\{\s*error:\s*error\.message/);
  });

  it("treats success-without-id as failure, not as 'Sent'", () => {
    // The defensive branch — Resend signalled success but didn't return
    // an id. Rather than reporting "sent" optimistically we surface as
    // ambiguous failure. This is what L-06 explicitly forbids being
    // collapsed into "Sent".
    expect(actionsFile).toMatch(/if\s*\(\s*!\s*data\?\.id\s*\)/);
    expect(actionsFile).toMatch(/unexpected response/);
  });

  it("only returns success: true when Resend confirmed delivery + returned an id", () => {
    // Specifically: success: true must appear ONLY after we've passed
    // the error-check + the no-id-check.
    const sendBlock = actionsFile.match(
      /sendDomainTestEmail[\s\S]*?return\s*\{\s*success:\s*true,\s*sentTo:\s*recipient\s*\}/,
    );
    expect(sendBlock).not.toBeNull();
  });

  it("rejects unauth + restricts to owner/manager", () => {
    expect(actionsFile).toMatch(/Not authenticated/);
    expect(actionsFile).toMatch(/Only owners and managers can send test emails/);
  });

  it("never accepts the recipient from form input — pulls from auth.users only", () => {
    // No `formData` parameter, no `to:` argument that comes from input.
    const fnBody = actionsFile.match(
      /sendDomainTestEmail[\s\S]*?^export/m,
    )?.[0] ?? actionsFile.split("sendDomainTestEmail")[1] ?? "";
    expect(fnBody).not.toMatch(/formData\.get\(\s*["']to["']/);
    expect(fnBody).not.toMatch(/params\.to/);
    expect(fnBody).toMatch(/recipient\s*=\s*user\?\.email/);
  });
});

describe("settings/email — EmailDomainClient 3-state result", () => {
  it("imports the new action", () => {
    expect(clientFile).toMatch(/sendDomainTestEmail/);
  });

  it("models the 3 states (sending / sent / error)", () => {
    expect(clientFile).toMatch(/status:\s*"sending"/);
    expect(clientFile).toMatch(/status:\s*"sent"/);
    expect(clientFile).toMatch(/status:\s*"error"/);
  });

  it("only renders success copy when status === 'sent'", () => {
    expect(clientFile).toMatch(/testState\.status\s*===\s*"sent"/);
    // Adjacent success copy must reference Sent + a recipient — but
    // never appear outside the "sent" branch.
    const idleBlock = clientFile.match(
      /testState\.status\s*===\s*"idle"[\s\S]{0,500}/,
    );
    if (idleBlock) {
      expect(idleBlock[0]).not.toMatch(/Sent to/);
    }
  });

  it("renders an error message when status === 'error'", () => {
    expect(clientFile).toMatch(/testState\.status\s*===\s*"error"/);
    expect(clientFile).toMatch(/Send failed:\s*\{testState\.message\}/);
  });

  it("treats ambiguous handler response as error, not success", () => {
    // The defensive branch in the handler: when the action returns
    // neither an error nor a success+sentTo, the UI must render error.
    expect(clientFile).toMatch(/unexpected response/);
  });

  it("disables the button while sending (no double-fire)", () => {
    expect(clientFile).toMatch(/disabled=\{[^}]*testState\.status\s*===\s*"sending"/);
  });
});
