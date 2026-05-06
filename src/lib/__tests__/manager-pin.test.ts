/**
 * manager-pin.ts — hash + verify round-trip + format validation.
 *
 * A1 Day 2 component: per-team_member PIN for refunds beyond the
 * 30-day window or without an original sale.
 */
import { describe, it, expect } from "vitest";
import {
  hashManagerPin,
  verifyManagerPin,
  isValidPinFormat,
} from "../manager-pin";

describe("hashManagerPin + verifyManagerPin — round-trip", () => {
  it("verifies a correct PIN against its own hash", async () => {
    const hash = await hashManagerPin("1234");
    expect(await verifyManagerPin("1234", hash)).toBe(true);
  });

  it("rejects an incorrect PIN against the stored hash", async () => {
    const hash = await hashManagerPin("1234");
    expect(await verifyManagerPin("4321", hash)).toBe(false);
    expect(await verifyManagerPin("12345", hash)).toBe(false);
    expect(await verifyManagerPin("", hash)).toBe(false);
  });

  it("produces a different hash on each call (random salt)", async () => {
    const a = await hashManagerPin("1234");
    const b = await hashManagerPin("1234");
    expect(a).not.toBe(b);
    // Both still verify correctly.
    expect(await verifyManagerPin("1234", a)).toBe(true);
    expect(await verifyManagerPin("1234", b)).toBe(true);
  });

  it("returns false on null/undefined/empty stored hash (no throw)", async () => {
    expect(await verifyManagerPin("1234", null)).toBe(false);
    expect(await verifyManagerPin("1234", undefined)).toBe(false);
    expect(await verifyManagerPin("1234", "")).toBe(false);
  });

  it("returns false on malformed stored hash (no throw)", async () => {
    expect(await verifyManagerPin("1234", "not-a-hash")).toBe(false);
    expect(await verifyManagerPin("1234", "scrypt:N=16384")).toBe(false);
    expect(
      await verifyManagerPin(
        "1234",
        "scrypt:N=16384:r=8:p=1:salt=zzzz:hash=zzzz",
      ),
    ).toBe(false);
  });

  it("hash format is self-describing (scrypt + parameters + salt + hash)", async () => {
    const h = await hashManagerPin("1234");
    expect(h).toMatch(/^scrypt:N=16384:r=8:p=1:salt=[0-9a-f]{32}:hash=[0-9a-f]{64}$/);
  });

  it("rejects a stored hash with wrong scrypt parameters (rotation safety)", async () => {
    // Future rotation: if we change N/r/p, old hashes stop verifying
    // and the user is prompted to re-set. This test pins that
    // behaviour so a sloppy parameter change can't accidentally
    // grandfather weaker hashes.
    const tampered =
      "scrypt:N=8192:r=8:p=1:salt=00000000000000000000000000000000:hash=" +
      "0".repeat(64);
    expect(await verifyManagerPin("1234", tampered)).toBe(false);
  });
});

describe("isValidPinFormat — surface shape gate", () => {
  it("accepts 4-6 digits", () => {
    expect(isValidPinFormat("1234")).toBe(true);
    expect(isValidPinFormat("12345")).toBe(true);
    expect(isValidPinFormat("123456")).toBe(true);
  });

  it("rejects shorter / longer / non-numeric / empty / non-string", () => {
    expect(isValidPinFormat("123")).toBe(false);
    expect(isValidPinFormat("1234567")).toBe(false);
    expect(isValidPinFormat("12a4")).toBe(false);
    expect(isValidPinFormat("")).toBe(false);
    expect(isValidPinFormat(null)).toBe(false);
    expect(isValidPinFormat(undefined)).toBe(false);
    expect(isValidPinFormat(1234)).toBe(false);
    expect(isValidPinFormat({ pin: "1234" })).toBe(false);
  });
});
