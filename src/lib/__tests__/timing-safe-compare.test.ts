import { describe, it, expect } from "vitest";
import { safeCompare, safeBearerMatch } from "../timing-safe-compare";

/**
 * safeCompare / safeBearerMatch regression coverage.
 *
 * Audit finding (High): cron bearer-token and review/staff bypass
 * comparisons used plain `===` string equality, which returns as soon
 * as the first mismatching byte is found. A timing-attack could recover
 * the secret byte-by-byte from a responsive endpoint.
 */

describe("safeCompare", () => {
  it("returns true on exact match", () => {
    expect(safeCompare("abc123", "abc123")).toBe(true);
  });

  it("returns false on mismatch of same length", () => {
    expect(safeCompare("abc123", "abc124")).toBe(false);
  });

  it("returns false on length mismatch", () => {
    expect(safeCompare("abc", "abcdef")).toBe(false);
  });

  it("returns false when either side is null/undefined/empty", () => {
    expect(safeCompare(null, "abc")).toBe(false);
    expect(safeCompare("abc", null)).toBe(false);
    expect(safeCompare(undefined, "abc")).toBe(false);
    expect(safeCompare("", "")).toBe(false);
    expect(safeCompare("abc", "")).toBe(false);
  });

  it("handles multibyte utf8 correctly", () => {
    expect(safeCompare("café", "café")).toBe(true);
    expect(safeCompare("café", "cafe")).toBe(false);
  });
});

describe("safeBearerMatch", () => {
  it("returns true when header is 'Bearer <secret>'", () => {
    expect(safeBearerMatch("Bearer supersecret", "supersecret")).toBe(true);
  });

  it("returns false when prefix is wrong", () => {
    expect(safeBearerMatch("bearer supersecret", "supersecret")).toBe(false);
    expect(safeBearerMatch("Bearer  supersecret", "supersecret")).toBe(false);
    expect(safeBearerMatch("supersecret", "supersecret")).toBe(false);
  });

  it("returns false when token mismatches", () => {
    expect(safeBearerMatch("Bearer abc", "xyz")).toBe(false);
  });

  it("returns false when header or expected is missing", () => {
    expect(safeBearerMatch(null, "abc")).toBe(false);
    expect(safeBearerMatch("Bearer abc", null)).toBe(false);
    expect(safeBearerMatch("Bearer abc", undefined)).toBe(false);
  });
});
