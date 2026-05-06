/**
 * A1 Day 4 backfill — synthetic refund rows for the 222 stale
 * "refunded"-status sales discovered during the Day 0 investigation.
 *
 * Background:
 *   - 223 sales with status='refunded' AND no refund row in
 *     `public.refunds.original_sale_id`.
 *   - 222 of them are from synthetic seed/QA tenants (10× *-v2 +
 *     11× *-qa naming patterns; bulk-imported 2026-03).
 *   - 1 of them (hello@nexpura sale b5b60d1a, $2,750) was real
 *     customer data on Joey's dogfood tenant and was already
 *     repaired separately (rolled back to status='completed' on
 *     2026-05-06; audit log id 88ad4620).
 *
 * This script handles the 222 synthetic seed rows. Per Joey's
 * scope lock: synthetic refund rows with `needs_review=true` +
 * provenance source='a1_seed_backfill'. Surfaces in /admin/health
 * for manual reconciliation if needed.
 *
 * Uses the §16 canonical 4-state outcome pattern (per
 * scripts/backfill-c02-decider.ts). Decider/reporter live in
 * scripts/backfill-a1-seed-refunds-decider.ts so the unit test can
 * import without env-var setup.
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     pnpm dlx tsx scripts/backfill-a1-seed-refunds.ts [--dry-run]
 */

import { createClient } from "@supabase/supabase-js";
import {
  decideBackfillStatus,
  formatBackfillMessage,
  type BackfillResult,
} from "./backfill-a1-seed-refunds-decider";

const DRY_RUN = process.argv.includes("--dry-run");
const SOURCE_MARKER = "a1_seed_backfill";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface AffectedSale {
  sale_id: string;
  tenant_id: string;
  tenant_slug: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  total: number;
  subtotal: number;
  tax_amount: number;
  created_at: string;
}

async function findAffected(): Promise<AffectedSale[]> {
  // Sales with status='refunded' AND no row in refunds.original_sale_id.
  // Two-step: pull all 'refunded' sales, then filter by absence in refunds.
  const { data: refundedSales, error: salesErr } = await admin
    .from("sales")
    .select(
      "id, tenant_id, customer_id, customer_name, customer_email, total, subtotal, tax_amount, created_at, tenants!inner(slug)",
    )
    .eq("status", "refunded");
  if (salesErr) {
    throw new Error(`findAffected: sales select failed: ${salesErr.message}`);
  }

  const candidates = (refundedSales ?? []) as Array<{
    id: string;
    tenant_id: string;
    customer_id: string | null;
    customer_name: string | null;
    customer_email: string | null;
    total: number | string;
    subtotal: number | string;
    tax_amount: number | string;
    created_at: string;
    tenants: unknown;
  }>;

  const out: AffectedSale[] = [];
  for (const s of candidates) {
    // Belt-and-suspenders existence check.
    const { data: existing } = await admin
      .from("refunds")
      .select("id")
      .eq("tenant_id", s.tenant_id)
      .eq("original_sale_id", s.id)
      .limit(1)
      .maybeSingle();
    if (existing?.id) continue;

    const tenantsField = Array.isArray(s.tenants) ? s.tenants[0] : s.tenants;
    const slug =
      tenantsField && typeof tenantsField === "object" && "slug" in tenantsField
        ? (tenantsField as { slug: string | null }).slug
        : null;

    out.push({
      sale_id: s.id,
      tenant_id: s.tenant_id,
      tenant_slug: slug,
      customer_id: s.customer_id,
      customer_name: s.customer_name,
      customer_email: s.customer_email,
      total: Number(s.total ?? 0),
      subtotal: Number(s.subtotal ?? 0),
      tax_amount: Number(s.tax_amount ?? 0),
      created_at: s.created_at,
    });
  }
  return out;
}

async function backfill(row: AffectedSale): Promise<BackfillResult> {
  // Existence re-check at insert time as a small race guard.
  const { data: existing } = await admin
    .from("refunds")
    .select("id")
    .eq("tenant_id", row.tenant_id)
    .eq("original_sale_id", row.sale_id)
    .limit(1)
    .maybeSingle();
  const existingId = existing?.id ?? null;
  const status = decideBackfillStatus(existingId, DRY_RUN);

  if (status === "exists" || status === "skip_exists" || status === "would_insert") {
    return { status, existing: existingId, insertedId: null };
  }

  // status === "inserted" — write the synthetic row.
  // Construct a unique refund_number — `BF-A1-<sale_id-tail>` so it
  // doesn't collide with the tenant's normal sequence.
  const refundNumber = `BF-A1-${row.sale_id.slice(0, 8)}`;

  const { data: inserted, error } = await admin
    .from("refunds")
    .insert({
      tenant_id: row.tenant_id,
      refund_number: refundNumber,
      original_sale_id: row.sale_id,
      customer_id: row.customer_id,
      customer_name: row.customer_name,
      customer_email: row.customer_email,
      reason: "Synthetic backfill — sale was status='refunded' without a refund row pre-A1",
      refund_method: "other",
      refund_type: "full",
      subtotal: row.subtotal,
      tax_amount: row.tax_amount,
      total: row.total,
      status: "completed",
      processed_by: null,
      needs_review: true,
      completed_at: row.created_at, // best-available proxy
      notes: `[a1_seed_backfill] Synthetic refund row for stale 'refunded'-status sale ${row.sale_id} from tenant ${row.tenant_slug ?? row.tenant_id}. Pre-A1 the parent sale was flipped to 'refunded' without a corresponding refund row (likely seed-data import; tenant pattern matches synthetic *-v2 / *-qa naming). Backfilled 2026-05-06 to satisfy the H-02 reconciliation contract: status='refunded' must always correspond to an existing refund row. needs_review=true so /admin/health surfaces these for manual confirmation.`,
    })
    .select("id")
    .single();

  if (error || !inserted?.id) {
    return {
      status: "skip_exists",
      existing: null,
      insertedId: null,
      error: error?.message ?? "unknown",
    };
  }
  return { status: "inserted", existing: null, insertedId: inserted.id };
}

async function main(): Promise<void> {
  console.log(
    `[backfill-a1-seed] mode=${DRY_RUN ? "DRY-RUN" : "WRITE"} marker=${SOURCE_MARKER}`,
  );

  const affected = await findAffected();
  console.log(`[backfill-a1-seed] affected stale-refunded sales: ${affected.length}`);
  if (affected.length === 0) {
    console.log("[backfill-a1-seed] nothing to do.");
    return;
  }

  console.log("\n[backfill-a1-seed] plan (first 10):");
  for (const r of affected.slice(0, 10)) {
    console.log(
      `  • sale_id=${r.sale_id.slice(0, 8)} tenant=${r.tenant_slug ?? r.tenant_id} total=${r.total.toFixed(2)} created=${r.created_at.slice(0, 10)}`,
    );
  }
  if (affected.length > 10) console.log(`  ... and ${affected.length - 10} more`);

  const counts = { inserted: 0, would_insert: 0, exists: 0, skip_exists: 0 };
  let failed = 0;

  for (const r of affected) {
    const result = await backfill(r);
    if (result.error) {
      failed += 1;
      console.error(`[backfill-a1-seed] FAIL sale_id=${r.sale_id.slice(0, 8)}: ${result.error}`);
      continue;
    }
    counts[result.status] += 1;
    console.log(
      formatBackfillMessage(result, {
        sale_id: r.sale_id,
        tenant_id: r.tenant_id,
      }),
    );
  }

  if (DRY_RUN) {
    console.log(
      `\n[backfill-a1-seed] DRY-RUN summary: would_insert=${counts.would_insert} exists=${counts.exists} total=${affected.length}`,
    );
  } else {
    console.log(
      `\n[backfill-a1-seed] summary: inserted=${counts.inserted} skip_exists=${counts.skip_exists} failed=${failed} total=${affected.length}`,
    );
  }
  if (failed > 0) process.exit(2);
}

main().catch((err) => {
  console.error("[backfill-a1-seed] fatal:", err);
  process.exit(1);
});
