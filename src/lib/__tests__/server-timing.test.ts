import { describe, it, expect } from "vitest";
import { ServerTiming } from "../server-timing";

/**
 * Unit tests for the Phase E Server-Timing helper.
 */

describe("ServerTiming", () => {
  it("emits empty string when no metrics recorded", () => {
    const t = new ServerTiming();
    expect(t.toHeader()).toBe("");
  });

  it("renders single metric in W3C format", () => {
    const t = new ServerTiming();
    t.record("auth", 12.34);
    expect(t.toHeader()).toBe("auth;dur=12.34");
  });

  it("comma-separates multiple metrics with no extra whitespace beyond ', '", () => {
    const t = new ServerTiming();
    t.record("auth", 5);
    t.record("db", 17);
    t.record("render", 3);
    expect(t.toHeader()).toBe("auth;dur=5, db;dur=17, render;dur=3");
  });

  it("rounds duration to 2 decimal places", () => {
    const t = new ServerTiming();
    t.record("compute", 12.345678);
    expect(t.toHeader()).toBe("compute;dur=12.35");
  });

  it("clamps negative durations to 0", () => {
    const t = new ServerTiming();
    t.record("clock_skew", -5);
    expect(t.toHeader()).toBe("clock_skew;dur=0");
  });

  it("rejects metric names with invalid characters", () => {
    const t = new ServerTiming();
    expect(() => t.record("bad name", 1)).toThrow(/invalid metric name/);
    expect(() => t.record("bad;semi", 1)).toThrow();
    expect(() => t.record("", 1)).toThrow();
  });

  it("rejects metric names longer than 64 chars", () => {
    const t = new ServerTiming();
    expect(() => t.record("x".repeat(65), 1)).toThrow();
  });

  it("times an async function via measure() and records the duration", async () => {
    const t = new ServerTiming();
    const result = await t.measure("work", async () => {
      await new Promise((r) => setTimeout(r, 5));
      return "done";
    });
    expect(result).toBe("done");
    const m = t.snapshot()[0];
    expect(m.name).toBe("work");
    expect(m.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("records the duration even when the wrapped fn throws", async () => {
    const t = new ServerTiming();
    await expect(
      t.measure("explodes", async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(t.snapshot()).toHaveLength(1);
    expect(t.snapshot()[0].name).toBe("explodes");
  });

  it("times sync functions via measureSync()", () => {
    const t = new ServerTiming();
    const r = t.measureSync("compute", () => 1 + 1);
    expect(r).toBe(2);
    expect(t.snapshot()[0].name).toBe("compute");
  });
});
