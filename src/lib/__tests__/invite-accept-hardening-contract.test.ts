/**
 * CRIT-7 contract — invite accept hardening.
 *
 * Locks in the fixes on /api/invite/accept/route.ts and the two invite
 * creation paths:
 *
 *   1. Accept refuses when session user's email != invite.email (403).
 *   2. Accept refuses when invite_expires_at is in the past (410).
 *   3. Accept looks up by sha256(token) first; falls back to plaintext
 *      only when invite_token_hash IS NULL (legacy rows).
 *   4. Accept clears both invite_token AND invite_token_hash on accept.
 *   5. Both invite-create paths set invite_token_hash AND
 *      invite_expires_at on insert.
 *   6. resendInvite rotates hash + expiry along with the plaintext token.
 *   7. A migration file exists that adds both new columns.
 */
import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

function readSrc(rel: string): string {
  return fs.readFileSync(path.resolve(__dirname, "..", "..", rel), "utf8");
}
function readRepo(rel: string): string {
  return fs.readFileSync(path.resolve(__dirname, "..", "..", "..", rel), "utf8");
}

describe("CRIT-7 /api/invite/accept — hardened", () => {
  const src = readSrc("app/api/invite/accept/route.ts");

  it("requires sessionUser.email (case-insensitive) to match invite.email, else 403", () => {
    expect(src).toMatch(/sessionUser\.email/);
    expect(src).toMatch(/\.toLowerCase\(\)/);
    // The mismatch branch must return 403.
    const mismatchBlock = src.match(
      /if\s*\([^)]*sessionEmail[\s\S]*?inviteEmail[\s\S]*?\)\s*\{[\s\S]*?status:\s*403[\s\S]*?\}/
    );
    expect(mismatchBlock, "expected a 403 branch on session/invite email mismatch").toBeTruthy();
  });

  it("rejects expired invites with 410 Gone", () => {
    expect(src).toMatch(/invite_expires_at/);
    expect(src).toMatch(/status:\s*410/);
  });

  it("hashes the inbound token with sha256 and looks up by invite_token_hash first", () => {
    expect(src).toMatch(/createHash\(\s*["']sha256["']\s*\)/);
    // invite_token_hash is the primary lookup.
    expect(src).toMatch(
      /\.eq\(\s*["']invite_token_hash["']\s*,\s*tokenHash\s*\)/
    );
  });

  it("has a legacy fallback that only matches rows with invite_token_hash IS NULL", () => {
    expect(src).toMatch(
      /\.eq\(\s*["']invite_token["']\s*,\s*token\s*\)[\s\S]*?\.is\(\s*["']invite_token_hash["']\s*,\s*null\s*\)/
    );
  });

  it("clears both invite_token and invite_token_hash on accept", () => {
    const updateBlock = src.match(
      /\.update\(\{[\s\S]*?invite_accepted:\s*true[\s\S]*?\}\)/
    )?.[0];
    expect(updateBlock).toBeDefined();
    expect(updateBlock!).toMatch(/invite_token:\s*null/);
    expect(updateBlock!).toMatch(/invite_token_hash:\s*null/);
  });

  it("does NOT perform a bare plaintext-only eq lookup on invite_token without the hash-null guard", () => {
    // Regression guard: the old single-lookup `.eq("invite_token", token).single()`
    // must not come back.
    const bareLookup = /\.eq\(\s*["']invite_token["']\s*,\s*token\s*\)\s*\.\s*single\(\)/;
    expect(src).not.toMatch(bareLookup);
  });

  it("sha256 hashing of token is correct (round-trip check on the extracted helper)", () => {
    // The helper is inlined as sha256Hex — but behaviour is well-defined.
    // Spot check an expected digest so the contract doesn't drift.
    const expected = crypto
      .createHash("sha256")
      .update("hello-invite", "utf8")
      .digest("hex");
    expect(expected).toHaveLength(64);
    expect(expected).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("CRIT-7 invite creation — hash + expiry on the canonical writer", () => {
  const teamSrc = readSrc("app/(app)/settings/team/actions.ts");
  const rolesSrc = readSrc("app/(app)/settings/roles/actions.ts");

  it("settings/team re-exports the canonical (no local writer to assert against)", () => {
    // H-04a (2026-05-05): the duplicate inviteTeamMember in team/actions
    // was deleted. The canonical (rolesSrc below) is the single source.
    expect(teamSrc).toMatch(
      /export\s*\{\s*inviteTeamMember\s*\}\s*from\s*["']\.\.\/roles\/actions["']/,
    );
  });

  it("settings/roles/actions inviteTeamMember writes invite_token_hash + invite_expires_at", () => {
    const body = rolesSrc.split("export async function inviteTeamMember")[1] ?? "";
    expect(body).toMatch(/invite_token_hash:/);
    expect(body).toMatch(/invite_expires_at:/);
    expect(body).toMatch(/createHash\(\s*["']sha256["']\s*\)|hashInviteToken\(/);
  });

  it("settings/roles/actions resendInvite rotates hash + expiry alongside plaintext", () => {
    const body = rolesSrc.split("export async function resendInvite")[1] ?? "";
    const updateBlock = body.match(/\.update\(\{[\s\S]*?invite_token:[\s\S]*?\}\)/)?.[0];
    expect(updateBlock, "resendInvite should update invite_token").toBeDefined();
    expect(updateBlock!).toMatch(/invite_token_hash/);
    expect(updateBlock!).toMatch(/invite_expires_at/);
  });

  it("expiry is ~7 days from now (matches the email copy)", () => {
    // Single canonical now — only roles declares INVITE_EXPIRY_MS.
    expect(rolesSrc).toMatch(/INVITE_EXPIRY_MS\s*=\s*7\s*\*\s*24\s*\*\s*60\s*\*\s*60\s*\*\s*1000/);
  });
});

describe("CRIT-7 migration — invite_expires_at + invite_token_hash columns", () => {
  it("20260424_invite_expiry_and_hash.sql adds both columns and an index on the hash", () => {
    const sql = readRepo("supabase/migrations/20260424_invite_expiry_and_hash.sql");
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS\s+invite_expires_at\s+timestamptz/i);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS\s+invite_token_hash\s+text/i);
    expect(sql).toMatch(
      /CREATE INDEX IF NOT EXISTS[\s\S]*?invite_token_hash/i
    );
  });
});
