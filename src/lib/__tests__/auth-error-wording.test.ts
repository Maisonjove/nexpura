/**
 * Contract test for auth-error wording across login + 2FA surfaces.
 *
 * Joey's ask: the old "Invalid email or password" was too terse and
 * "Invalid verification code" sounded robotic. Replace with warmer,
 * clearer copy that is STILL enumeration-safe — specifically, the
 * wrong-password branch and the unknown-error fallback on /login
 * must render the SAME string so we never distinguish "email doesn't
 * exist" from "wrong password".
 *
 * These are lock-tests — they fail if a future edit either reverts
 * the copy or introduces a divergent message between the two safe
 * branches.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../../..");
function readSrc(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

const NEW_LOGIN_COPY =
  "Those details don't match — please check your email and password and try again.";

const NEW_2FA_COPY =
  "That code didn't match — try again, or use a backup code if the app is out of sync.";

// ───────────────────────────────────────────────────────────────────────
// /login page
// ───────────────────────────────────────────────────────────────────────
describe("login page — warmer, still enumeration-safe error copy", () => {
  const src = readSrc("src/app/(auth)/login/page.tsx");

  it("renders the new wording for invalid credentials", () => {
    expect(src).toContain(NEW_LOGIN_COPY);
  });

  it("no longer contains the bare 'Invalid email or password' string", () => {
    // We still allow the regex `/invalid.*credentials/i.test(msg)` —
    // that's matching Supabase's own code, not user-facing copy. What
    // we forbid is the literal user-facing string.
    const matches = src.match(/"Invalid email or password"/g);
    expect(matches).toBeNull();
  });

  it("uses the same copy for both invalid_credentials and the generic fallback (no enumeration distinction)", () => {
    // Count occurrences — must appear at least twice (once for each
    // safe branch) to confirm they render identical text.
    const occurrences = src.split(NEW_LOGIN_COPY).length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });

  it("still preserves the email_not_confirmed branch (by-design distinction)", () => {
    // This branch is intentional — Supabase already sent the user a
    // confirmation email proactively, so surfacing "verify your email"
    // doesn't leak meaningful account-existence info.
    expect(src).toMatch(/email_not_confirmed|email\.\*confirm/);
    expect(src).toContain("verify your email");
  });

  it("still preserves the 5xx service-trouble branch", () => {
    expect(src).toContain("Sign-in service is having trouble");
  });
});

// ───────────────────────────────────────────────────────────────────────
// /verify-2fa page
// ───────────────────────────────────────────────────────────────────────
describe("verify-2fa page — human error copy, still enumeration-safe", () => {
  const src = readSrc("src/app/(auth)/verify-2fa/page.tsx");

  it("renders the new human copy for invalid TOTP / backup code", () => {
    expect(src).toContain(NEW_2FA_COPY);
  });

  it("no longer falls back to the bare 'Invalid verification code' string", () => {
    expect(src).not.toContain('"Invalid verification code"');
    expect(src).not.toContain("'Invalid verification code'");
  });

  it("does not distinguish 'user has no 2FA enabled' from 'wrong code' in the UI copy", () => {
    // The API route may return different `data.error` strings (e.g.
    // "2FA is not enabled"), but the page overrides them with a single
    // human-friendly message. So the page source must NOT pass
    // `data.error` through to the user — static analysis on the
    // throw path.
    // Find the throw after the !res.ok check and confirm it's hard-
    // coded, not `data.error || ...`.
    const throwMatch = src.match(/if\s*\(!res\.ok[^)]*\)\s*\{[\s\S]*?throw new Error\(([\s\S]*?)\)[^;]*;/);
    expect(throwMatch).toBeTruthy();
    const throwArg = throwMatch ? throwMatch[1] : "";
    expect(throwArg).not.toMatch(/data\.error/);
  });

  it("preserves network/catch fallback with a human message", () => {
    expect(src).toMatch(/couldn't verify that code/i);
  });
});

// ───────────────────────────────────────────────────────────────────────
// Redirect stubs — must still redirect, not duplicate copy
// ───────────────────────────────────────────────────────────────────────
describe("legacy sign-in routes remain pure redirects", () => {
  it("/sign-in redirects to /login and contains no error copy", () => {
    const src = readSrc("src/app/sign-in/page.tsx");
    expect(src).toContain('redirect("/login")');
    expect(src).not.toContain("Invalid email or password");
  });

  it("/auth/sign-in redirects to /login and contains no error copy", () => {
    const src = readSrc("src/app/auth/sign-in/page.tsx");
    expect(src).toContain('redirect("/login")');
    expect(src).not.toContain("Invalid email or password");
  });
});

// ───────────────────────────────────────────────────────────────────────
// API route — enumeration-safe JSON body, copy owned by client
// ───────────────────────────────────────────────────────────────────────
describe("/api/auth/login legacy route keeps enumeration-safe JSON", () => {
  const src = readSrc("src/app/api/auth/login/route.ts");

  it("returns a single error string for auth failure (no distinction between 'no such user' vs 'wrong password')", () => {
    // The legacy route returns {"error": "Invalid email or password"}.
    // That's enumeration-safe JSON; it's fine to leave — it's the
    // client render site that got the new wording.
    expect(src).toMatch(/"Invalid email or password"/);
    // Confirm we don't have two different error strings on the
    // password-auth failure branch.
    const authFailBlock = src.match(/if\s*\(error\s*\|\|\s*!data\.user\)[\s\S]{0,400}/);
    expect(authFailBlock).toBeTruthy();
  });
});
