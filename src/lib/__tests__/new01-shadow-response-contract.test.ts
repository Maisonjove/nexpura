/**
 * NEW-01 contract — Supabase signUp "shadow response" handling on the
 * invite flow.
 *
 * The bug: when /invite/[token] is opened by an email that already exists
 * in auth.users (soft-deleted tenant invite, abandoned signup, etc.),
 * Supabase's enumeration-protection returns a success response with
 * `data.user.identities = []` — no error is thrown, no confirmation
 * email queued. The old client showed "check your inbox" forever.
 *
 * Fix shape (locked in by this contract):
 *
 *   1. InviteClient.tsx inspects `data.user.identities` length after
 *      signUp and branches when it is zero.
 *   2. The shadow-detect branch redirects to
 *      `/login?redirectTo=/invite/${token}` so the user can sign in and
 *      re-hit the invite page with a real session.
 *   3. The legacy "already registered" string-match error branch is
 *      preserved as a fallback — some Supabase versions DO throw.
 *   4. The 403 email-mismatch path on /api/invite/accept (PR #189,
 *      NEW-02) is preserved — sessionEmail/inviteEmail keys still
 *      present, still returns 403.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

function readSrc(rel: string): string {
  return fs.readFileSync(path.resolve(__dirname, "..", "..", rel), "utf8");
}

describe("NEW-01 InviteClient — shadow-response handling", () => {
  const src = readSrc("app/invite/[token]/InviteClient.tsx");

  it("inspects data.user.identities length after signUp", () => {
    // The shadow signature is identities.length === 0. The check must
    // exist on the authData.user.identities path.
    expect(src).toMatch(/authData[\s\S]*?\.user[\s\S]*?\.identities/);
    expect(src).toMatch(/identities\.length\s*===\s*0/);
  });

  it("guards the shadow check against undefined identities (Array.isArray)", () => {
    // Defensive: identities could be undefined on older SDKs. Use
    // Array.isArray to avoid throwing on .length of undefined.
    expect(src).toMatch(/Array\.isArray\(\s*authData[\s\S]*?\.identities\s*\)/);
  });

  it("redirects to /login?redirectTo=/invite/${token} on shadow-detect", () => {
    // The push call must carry the redirectTo back to this invite page
    // so the user lands on accept after sign-in.
    expect(src).toMatch(
      /router\.push\(\s*[`'"]\/login\?redirectTo=\/invite\/\$\{token\}[`'"]\s*\)/
    );
  });

  it("preserves the legacy 'already registered' error-message branch as a fallback", () => {
    // Some Supabase versions throw on already-registered. Don't drop it.
    expect(src).toMatch(/already registered/);
    expect(src).toMatch(/signUpError\.message\.includes\(\s*["']already registered["']\s*\)/);
  });

  it("does not silently leave the user on the 'check your inbox' state when shadow is detected", () => {
    // Regression guard: in the handleSubmit handler, the shadow-detect
    // branch must early-return BEFORE the post-signUp `setUiState("waiting")`
    // is reached. We extract the handleSubmit body and assert the shadow
    // check + return appear before the waiting setter inside it.
    const handlerMatch = src.match(
      /async function handleSubmit\([\s\S]*?\n  \}\n/
    );
    expect(handlerMatch, "expected handleSubmit handler to exist").toBeTruthy();
    const handler = handlerMatch![0];
    const shadowIdx = handler.search(/identities\.length\s*===\s*0/);
    const waitingIdx = handler.search(/setUiState\(\s*["']waiting["']\s*\)/);
    expect(shadowIdx).toBeGreaterThan(-1);
    expect(waitingIdx).toBeGreaterThan(-1);
    expect(shadowIdx).toBeLessThan(waitingIdx);

    // And there must be a `return;` between the shadow check and the
    // waiting setter so we actually short-circuit.
    const between = handler.slice(shadowIdx, waitingIdx);
    expect(between).toMatch(/return;/);
  });
});

describe("NEW-01 — NEW-02 (PR #189) email-mismatch path is preserved", () => {
  const route = readSrc("app/api/invite/accept/route.ts");

  it("still references sessionEmail and inviteEmail with case-insensitive compare", () => {
    expect(route).toMatch(/sessionEmail/);
    expect(route).toMatch(/inviteEmail/);
    expect(route).toMatch(/\.toLowerCase\(\)/);
  });

  it("still returns 403 on session/invite email mismatch", () => {
    const mismatchBlock = route.match(
      /if\s*\([^)]*sessionEmail[\s\S]*?inviteEmail[\s\S]*?\)\s*\{[\s\S]*?status:\s*403[\s\S]*?\}/
    );
    expect(
      mismatchBlock,
      "expected the NEW-02 403 email-mismatch branch to remain intact"
    ).toBeTruthy();
  });
});
