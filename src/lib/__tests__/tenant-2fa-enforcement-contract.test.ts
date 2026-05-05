import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Contract test for M-05 (narrow scope): tenant-level 2FA
 * enforcement for staff.
 *
 * Audit M-05 (desktop-Opus): "owner toggle → all staff blocked
 * from login until TOTP enrolled." Pre-fix there was no per-
 * tenant TOTP requirement — owners couldn't enforce 2FA on staff
 * without a separate sign-up rule.
 *
 * Post-fix:
 *   - tenants.require_2fa_for_staff column (default FALSE)
 *   - Login route: when tenant flag ON + user is staff (non-owner,
 *     non-allowlisted-admin) + totp_enabled=false, redirect to
 *     /settings/two-factor?enrolment_required=1 instead of the
 *     normal dashboard.
 *   - Owner action: setTenantRequire2faForStaff(boolean).
 */

const migrationFile = fs.readFileSync(
  path.resolve(__dirname, "../../../supabase/migrations/20260505_add_tenant_require_2fa_for_staff.sql"),
  "utf8",
);

const loginRoute = fs.readFileSync(
  path.resolve(__dirname, "../../app/api/auth/login/route.ts"),
  "utf8",
);

const teamActions = fs.readFileSync(
  path.resolve(__dirname, "../../app/(app)/settings/team/actions.ts"),
  "utf8",
);

describe("tenants migration — require_2fa_for_staff column", () => {
  it("adds the column with NOT NULL DEFAULT FALSE", () => {
    expect(migrationFile).toMatch(
      /ALTER TABLE public\.tenants[\s\S]*?ADD COLUMN[\s\S]*?require_2fa_for_staff[\s\S]*?BOOLEAN[\s\S]*?NOT NULL[\s\S]*?DEFAULT FALSE/i,
    );
  });
});

describe("login route — M-05 staff enforcement branch", () => {
  it("selects require_2fa_for_staff alongside existing tenant fields", () => {
    expect(loginRoute).toMatch(/tenants\([^)]*require_2fa_for_staff[^)]*\)/);
  });

  it("declares the flag in the profileTyped type", () => {
    expect(loginRoute).toMatch(/require_2fa_for_staff\?:\s*boolean\s*\|\s*null/);
  });

  it("blocks staff sign-in when flag is on + totp not enrolled", () => {
    // Branch must exclude owners and allowlisted admin.
    const block = loginRoute.match(
      /tenantRequires2fa[\s\S]{0,1000}?!profileTyped\?\.totp_enabled[\s\S]{0,200}?!isOwner[\s\S]{0,200}?!isAdmin/,
    );
    expect(block).not.toBeNull();
  });

  it("redirects to /settings/two-factor with enrolment_required flag", () => {
    expect(loginRoute).toMatch(
      /redirectTo:\s*["']\/settings\/two-factor\?enrolment_required=1["']/,
    );
  });
});

describe("settings/team/actions — setTenantRequire2faForStaff", () => {
  it("exports setTenantRequire2faForStaff", () => {
    expect(teamActions).toMatch(
      /export\s+async\s+function\s+setTenantRequire2faForStaff\s*\(/,
    );
  });

  it("requires owner-only role (NOT manager — staff lockout policy is owner's call)", () => {
    const block = teamActions.match(
      /setTenantRequire2faForStaff[\s\S]{0,1000}?requireRole\("owner"\)/,
    );
    expect(block).not.toBeNull();
  });

  it("updates tenants.require_2fa_for_staff scoped by tenant_id", () => {
    const block = teamActions.match(
      /setTenantRequire2faForStaff[\s\S]{0,2000}?\.from\("tenants"\)[\s\S]{0,300}?\.update\(\s*\{\s*require_2fa_for_staff:\s*enabled\s*\}\s*\)[\s\S]{0,200}?\.eq\("id",\s*userData\.tenant_id\)/,
    );
    expect(block).not.toBeNull();
  });

  it("logs an audit event with structured metadata", () => {
    expect(teamActions).toMatch(/setting:\s*["']require_2fa_for_staff["']/);
  });
});
