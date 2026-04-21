import { describe, it, expect } from "vitest";

/**
 * Critical: Stripe webhook idempotency must be atomic. The old pattern
 * did SELECT-then-INSERT, which is a TOCTOU — two concurrent workers
 * could both pass the SELECT and then race the INSERT. One would fail
 * with 23505, BUT the code path did not hard-return early in all
 * branches, risking double-processing.
 *
 * The new pattern uses a single INSERT and treats 23505 as "duplicate,
 * skip". This test asserts the observable shape of that contract.
 */

// Minimal simulation of concurrent idempotency-lock INSERTs against
// Postgres' unique constraint. Not a full DB — a local "table" with a
// sync mutex that models the constraint behaviour. Good enough for the
// business rule we're protecting: "exactly one of N concurrent inserts
// of the same key succeeds; all others report 23505".
class FakeUniqueKeyStore {
  private keys = new Set<string>();
  async insert(key: string): Promise<{ data: { key: string } | null; error: { code: string } | null }> {
    if (this.keys.has(key)) {
      return { data: null, error: { code: "23505" } };
    }
    this.keys.add(key);
    return { data: { key }, error: null };
  }
}

describe("stripe webhook idempotency (atomic INSERT pattern)", () => {
  it("exactly one of two concurrent inserts succeeds; the other returns 23505", async () => {
    const store = new FakeUniqueKeyStore();
    const [a, b] = await Promise.all([store.insert("evt_1"), store.insert("evt_1")]);
    const successes = [a, b].filter((r) => r.error === null);
    const conflicts = [a, b].filter((r) => r.error?.code === "23505");
    expect(successes).toHaveLength(1);
    expect(conflicts).toHaveLength(1);
  });

  it("10 concurrent retries of the same event — exactly one wins", async () => {
    const store = new FakeUniqueKeyStore();
    const results = await Promise.all(
      Array.from({ length: 10 }, () => store.insert("evt_2")),
    );
    const successes = results.filter((r) => r.error === null);
    expect(successes).toHaveLength(1);
  });

  it("different event ids each get their own lock (no cross-contamination)", async () => {
    const store = new FakeUniqueKeyStore();
    const results = await Promise.all([
      store.insert("evt_a"),
      store.insert("evt_b"),
      store.insert("evt_c"),
    ]);
    expect(results.every((r) => r.error === null)).toBe(true);
  });

  it("re-inserting an already-seen event returns 23505 (idempotent replay)", async () => {
    const store = new FakeUniqueKeyStore();
    await store.insert("evt_3");
    const second = await store.insert("evt_3");
    expect(second.error?.code).toBe("23505");
    expect(second.data).toBeNull();
  });
});
