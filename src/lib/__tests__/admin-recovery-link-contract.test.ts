/**
 * Contract test for the platform-admin recovery-link generator (PR #202).
 *
 * CONTEXT: /auth/v1/recover is 500ing for all real Nexpura users, and
 * `resetPasswordForEmail()` (which fires the same SMTP path) is also
 * dead. The admin-side generator calls `admin.auth.generateLink` which
 * returns the action_link URL synchronously without firing SMTP, so a
 * super_admin can copy-paste it to a locked-out user via DM.
 *
 * Audit trail: outage log d64a65e0-9890-449b-b224-89432a00a722.
 *
 * This is a SOURCE-GREP contract test (matches the style of
 * forgot-password-contract.test.ts) — locks in:
 *   - The action exists and is exported as `adminGenerateRecoveryLink`.
 *   - It calls `admin.auth.generateLink` with `type: 'recovery'`.
 *   - It does NOT call `resetPasswordForEmail` (the broken path).
 *   - It writes an audit_logs row with action='admin_recovery_link_generated'.
 *   - It does NOT include the link itself in audit metadata
 *     (the link is a credential).
 *   - It is super_admin-gated (`isAllowlistedAdmin` + `super_admins`
 *     row check, mirroring the rest of /admin/(admin)/actions.ts).
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../../..");
function readSrc(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

const ACTION_PATH = "src/app/(admin)/admin/tenants/[id]/actions.ts";

describe("admin recovery-link action — file contract", () => {
  let actionsSrc: string;
  it("file exists at the expected path", () => {
    expect(() => {
      actionsSrc = readSrc(ACTION_PATH);
    }).not.toThrow();
    expect(actionsSrc!.length).toBeGreaterThan(0);
  });
});

describe("admin recovery-link action — server module discipline", () => {
  const actionsSrc = readSrc(ACTION_PATH);

  it("is marked as a server module (use server)", () => {
    expect(actionsSrc).toMatch(/^["']use server["'];?/m);
  });

  it("exports adminGenerateRecoveryLink", () => {
    expect(actionsSrc).toMatch(
      /export\s+async\s+function\s+adminGenerateRecoveryLink\s*\(/
    );
  });
});

describe("admin recovery-link action — auth path discipline", () => {
  const actionsSrc = readSrc(ACTION_PATH);

  it("uses generateLink with type: 'recovery' (NOT the broken /auth/v1/recover SMTP path)", () => {
    // The whole point of this hotfix: bypass the broken SMTP route.
    // Method path is `auth.admin.generateLink` in supabase-js v2.
    expect(actionsSrc).toMatch(/auth\.admin\.generateLink\s*\(/);
    expect(actionsSrc).toMatch(/type:\s*["']recovery["']/);
  });

  it("does NOT call resetPasswordForEmail (the broken path)", () => {
    expect(actionsSrc).not.toMatch(/resetPasswordForEmail/);
  });

  it("returns the action_link URL string", () => {
    // The returned shape from generateLink is `data.properties.action_link`.
    expect(actionsSrc).toMatch(/properties\??\.action_link/);
  });

  it("uses createAdminClient from @/lib/supabase/admin (service role)", () => {
    expect(actionsSrc).toMatch(/createAdminClient/);
    expect(actionsSrc).toMatch(/from\s+["']@\/lib\/supabase\/admin["']/);
  });

  it("redirects to /reset-password on the production origin", () => {
    expect(actionsSrc).toMatch(/redirectTo\s*:\s*["']https:\/\/nexpura\.com\/reset-password["']/);
  });
});

describe("admin recovery-link action — super_admin gate", () => {
  const actionsSrc = readSrc(ACTION_PATH);

  it("imports the email allowlist gate (isAllowlistedAdmin)", () => {
    expect(actionsSrc).toMatch(/isAllowlistedAdmin/);
    expect(actionsSrc).toMatch(/from\s+["']@\/lib\/admin-allowlist["']/);
  });

  it("checks the super_admins table for the requesting user_id", () => {
    expect(actionsSrc).toMatch(/from\s*\(\s*["']super_admins["']\s*\)/);
    expect(actionsSrc).toMatch(/eq\s*\(\s*["']user_id["']/);
  });

  it("rejects unauthenticated callers", () => {
    expect(actionsSrc).toMatch(/Unauthenticated/);
  });

  it("rejects non-super-admin callers", () => {
    expect(actionsSrc).toMatch(/Unauthorized/);
  });
});

describe("admin recovery-link action — audit trail", () => {
  const actionsSrc = readSrc(ACTION_PATH);

  it("writes to public.audit_logs", () => {
    expect(actionsSrc).toMatch(/from\s*\(\s*["']audit_logs["']\s*\)/);
    expect(actionsSrc).toMatch(/\.insert\s*\(/);
  });

  it("uses action='admin_recovery_link_generated'", () => {
    expect(actionsSrc).toMatch(/action\s*:\s*["']admin_recovery_link_generated["']/);
  });

  it("records target_email + super-admin identity in metadata", () => {
    expect(actionsSrc).toMatch(/target_email/);
    expect(actionsSrc).toMatch(/generated_by_user_id/);
    expect(actionsSrc).toMatch(/generated_by_email/);
  });

  it("does NOT persist the link itself in metadata (link is a credential)", () => {
    // Pull just the audit-insert payload and assert no `link`/`action_link`
    // key is present in the metadata block. The action_link string is
    // referenced elsewhere (returned to caller) — we only care that it
    // isn't stored to the DB row.
    const metadataMatch = actionsSrc.match(/metadata\s*:\s*\{[\s\S]*?\}/);
    expect(metadataMatch).not.toBeNull();
    const metadataBlock = metadataMatch![0];
    expect(metadataBlock).not.toMatch(/\baction_link\b/);
    expect(metadataBlock).not.toMatch(/\blink\b\s*:/);
  });
});

describe("admin recovery-link action — UI surface (TenantActions)", () => {
  const tenantActionsSrc = readSrc(
    "src/app/(admin)/admin/tenants/[id]/TenantActions.tsx"
  );

  it("imports the new server action", () => {
    expect(tenantActionsSrc).toMatch(/adminGenerateRecoveryLink/);
    expect(tenantActionsSrc).toMatch(/from\s+["']\.\/actions["']/);
  });

  it("renders the credential warning string verbatim", () => {
    expect(tenantActionsSrc).toMatch(/bypasses email delivery/);
    expect(tenantActionsSrc).toMatch(/Treat the URL as a credential/);
  });

  it("offers a copy-to-clipboard button", () => {
    expect(tenantActionsSrc).toMatch(/clipboard\.writeText/);
  });
});
