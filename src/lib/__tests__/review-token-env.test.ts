/**
 * W7-HIGH-04 / W2-014: review + staff bypass tokens must come from env,
 * compare constant-time, and FAIL CLOSED when the env is unset.
 *
 * The previous implementation hardcoded `nexpura-review-2026` /
 * `nexpura-staff-2026` in source. Anyone with GitHub read access
 * could grab them and sidestep middleware's env-gate for the DEMO
 * tenant.
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { matchesReviewOrStaffToken } from "../auth/review";

const REVIEW_ENV = "NEXPURA_REVIEW_TOKEN";
const STAFF_ENV = "NEXPURA_STAFF_BYPASS_TOKEN";

const origReview = process.env[REVIEW_ENV];
const origStaff = process.env[STAFF_ENV];

afterAll(() => {
  if (origReview === undefined) delete process.env[REVIEW_ENV];
  else process.env[REVIEW_ENV] = origReview;
  if (origStaff === undefined) delete process.env[STAFF_ENV];
  else process.env[STAFF_ENV] = origStaff;
});

describe("matchesReviewOrStaffToken fail-closed when env unset", () => {
  beforeEach(() => {
    delete process.env[REVIEW_ENV];
    delete process.env[STAFF_ENV];
  });

  it("returns false when both env vars are unset (even for former hardcoded values)", () => {
    expect(matchesReviewOrStaffToken("nexpura-review-2026")).toBe(false);
    expect(matchesReviewOrStaffToken("nexpura-staff-2026")).toBe(false);
  });

  it("returns false when env vars are empty strings", () => {
    process.env[REVIEW_ENV] = "";
    process.env[STAFF_ENV] = "";
    expect(matchesReviewOrStaffToken("anything")).toBe(false);
  });

  it("returns false for null / undefined / empty input", () => {
    process.env[REVIEW_ENV] = "some-fresh-token-value";
    expect(matchesReviewOrStaffToken(null)).toBe(false);
    expect(matchesReviewOrStaffToken(undefined)).toBe(false);
    expect(matchesReviewOrStaffToken("")).toBe(false);
  });
});

describe("matchesReviewOrStaffToken with env set", () => {
  beforeEach(() => {
    process.env[REVIEW_ENV] = "fresh-review-abc-123";
    process.env[STAFF_ENV] = "fresh-staff-xyz-789";
  });

  it("returns true on correct review token", () => {
    expect(matchesReviewOrStaffToken("fresh-review-abc-123")).toBe(true);
  });

  it("returns true on correct staff token", () => {
    expect(matchesReviewOrStaffToken("fresh-staff-xyz-789")).toBe(true);
  });

  it("returns false on wrong token", () => {
    expect(matchesReviewOrStaffToken("wrong-value")).toBe(false);
  });

  it("returns false on the old hardcoded values (rotation proof)", () => {
    expect(matchesReviewOrStaffToken("nexpura-review-2026")).toBe(false);
    expect(matchesReviewOrStaffToken("nexpura-staff-2026")).toBe(false);
  });

  it("length-mismatch doesn't match (constant-time path returns false)", () => {
    expect(matchesReviewOrStaffToken("fresh-review-abc-12")).toBe(false);
    expect(matchesReviewOrStaffToken("fresh-review-abc-1234")).toBe(false);
  });
});

describe("matchesReviewOrStaffToken partial env configuration", () => {
  beforeEach(() => {
    delete process.env[REVIEW_ENV];
    delete process.env[STAFF_ENV];
  });

  it("only review env set: staff token rejected", () => {
    process.env[REVIEW_ENV] = "only-review-set";
    expect(matchesReviewOrStaffToken("only-review-set")).toBe(true);
    expect(matchesReviewOrStaffToken("any-staff-value")).toBe(false);
  });

  it("only staff env set: review token rejected", () => {
    process.env[STAFF_ENV] = "only-staff-set";
    expect(matchesReviewOrStaffToken("only-staff-set")).toBe(true);
    expect(matchesReviewOrStaffToken("any-review-value")).toBe(false);
  });
});
