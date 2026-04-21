import { describe, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Critical fix contract test: the tracking-table RLS migration must not
 * contain permissive `USING (true)` SELECT policies for the anon surface.
 *
 * The original policies on order_status_history + order_attachments were:
 *   FOR SELECT USING (true)
 *   FOR SELECT USING (is_public = true)
 * — anyone with the (public) Supabase anon key could dump both tables
 * cross-tenant via PostgREST.
 *
 * The lockdown migration 20260421_tracking_rls_tenant_scoped.sql drops
 * those policies and replaces them with TO authenticated + a tenant-
 * scoped USING clause. This test guards against reintroduction.
 *
 * (This is a static-analysis style test — it reads the migration file and
 * asserts the right shape. Full RLS behaviour is validated in the hostile-
 * verification pass via live PostgREST calls.)
 */

function readMigration(filename: string): string {
  const p = path.resolve(__dirname, "../../../supabase/migrations", filename);
  return fs.readFileSync(p, "utf8");
}

describe("tracking table RLS lockdown (critical)", () => {
  const migration = readMigration("20260421_tracking_rls_tenant_scoped.sql");

  it("drops the prior public status-history policy", () => {
    expect(migration).toMatch(/DROP POLICY[^;]*"Allow public read for status history"[^;]*;/);
  });

  it("drops the prior public attachments policy", () => {
    expect(migration).toMatch(/DROP POLICY[^;]*"Allow public read for public attachments"[^;]*;/);
  });

  it("replaces them with TO authenticated + tenant-scoped policies", () => {
    expect(migration).toMatch(/CREATE POLICY[^;]*"Authed tenant read status history"[^;]*TO authenticated/s);
    expect(migration).toMatch(/CREATE POLICY[^;]*"Authed tenant read attachments"[^;]*TO authenticated/s);
  });

  it("new policies reference tenant_id (not USING(true) and not is_public-only)", () => {
    expect(migration).toMatch(/USING\s*\(\s*\n?\s*tenant_id IN \(SELECT tenant_id FROM public\.users WHERE id = auth\.uid\(\)\)\s*\n?\s*\)/);
  });

  it("does NOT reintroduce USING(true) on the authenticated-role SELECT policies", () => {
    // The two NEW policies are the ones we care about — they must be
    // tenant-scoped. The separate "Service role full access" policies
    // elsewhere (added in the original migration) can remain USING(true)
    // because service role bypasses RLS anyway; this test specifically
    // protects the anon/authenticated surface.
    const authedPolicyBlocks = migration.match(
      /CREATE POLICY[^;]*"Authed tenant read (status history|attachments)"[^;]*;/gs,
    );
    expect(authedPolicyBlocks).not.toBeNull();
    for (const block of authedPolicyBlocks ?? []) {
      expect(block).not.toMatch(/USING\s*\(\s*true\s*\)/);
    }
  });

  it("re-asserts RLS is ENABLED (belt-and-suspenders)", () => {
    expect(migration).toMatch(/ALTER TABLE[^;]*order_status_history[^;]*ENABLE ROW LEVEL SECURITY/);
    expect(migration).toMatch(/ALTER TABLE[^;]*order_attachments[^;]*ENABLE ROW LEVEL SECURITY/);
  });
});

describe("order-attachments bucket lockdown (critical)", () => {
  const migration = readMigration("20260421_order_attachments_private_bucket.sql");

  it("flips the bucket to private", () => {
    expect(migration).toMatch(/UPDATE storage\.buckets SET public = false WHERE id = 'order-attachments'/);
  });

  it("drops the prior permissive Public read policy", () => {
    expect(migration).toMatch(/DROP POLICY[^;]*"Public read for order attachments"[^;]*ON storage\.objects/);
  });

  it("adds an authed-tenant-scoped read policy", () => {
    expect(migration).toMatch(/CREATE POLICY[^;]*"Authed tenant read order attachments"[^;]*TO authenticated/s);
    expect(migration).toMatch(/bucket_id = 'order-attachments'/);
  });
});

describe("billing/webhook duplicate route removed (critical)", () => {
  it("src/app/api/billing/webhook/route.ts no longer exists", () => {
    const p = path.resolve(__dirname, "../../app/api/billing/webhook/route.ts");
    expect(fs.existsSync(p)).toBe(false);
  });

  it("canonical webhook still exists at src/app/api/webhooks/stripe/route.ts", () => {
    const p = path.resolve(__dirname, "../../app/api/webhooks/stripe/route.ts");
    expect(fs.existsSync(p)).toBe(true);
  });

  it("canonical webhook uses atomic INSERT (not SELECT-then-INSERT)", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../../app/api/webhooks/stripe/route.ts"),
      "utf8",
    );
    // There should be exactly one idempotency_locks INSERT path and no
    // preceding SELECT from idempotency_locks before it.
    expect(src).toMatch(/\.from\("idempotency_locks"\)\s*\n?\s*\.insert/);
    // Explicitly: no SELECT pattern on idempotency_locks feeding a maybeSingle
    // used to gate the INSERT.
    const hasStaleSelectPattern =
      /\.from\("idempotency_locks"\)\s*\n?\s*\.select[^;]*\.eq\("key",\s*eventKey\)/.test(src) &&
      /if \(seenEvent\)/.test(src);
    expect(hasStaleSelectPattern).toBe(false);
  });
});

// The `expect` used above — vitest globals.
import { expect } from "vitest";
