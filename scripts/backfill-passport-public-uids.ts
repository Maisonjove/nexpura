/**
 * M-10 Phase 1 backfill: populate public_uid on every passport row
 * that doesn't have one. Idempotent (skips rows already filled).
 *
 * Audit: enumerable sequential passport_uid lets external scrapers
 * iterate /verify/[uid] across all tenants. Phase 1 adds public_uid
 * (UUID v4 from crypto.randomUUID()), wires it into the verify
 * ladder + share URLs + QR codes, and audits legacy hits so the
 * 90-day sunset (2026-08-05) is data-driven.
 *
 * NEW passports get public_uid at insert time via
 * src/app/(app)/passports/actions.ts (and any future create paths
 * — keep an eye on api/migration/* + integration sync paths).
 *
 * EXISTING passports need this script. Run once post-deploy.
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     npx tsx scripts/backfill-passport-public-uids.ts [--dry-run]
 */

import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const DRY_RUN = process.argv.includes("--dry-run");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface PassportRow {
  id: string;
  passport_uid: string | null;
  public_uid: string | null;
  tenant_id: string;
}

const PAGE_SIZE = 500;

async function fetchPage(offset: number): Promise<PassportRow[]> {
  const { data, error } = await admin
    .from("passports")
    .select("id, passport_uid, public_uid, tenant_id")
    .is("public_uid", null)
    .order("created_at", { ascending: true })
    .range(offset, offset + PAGE_SIZE - 1);
  if (error) throw new Error(`fetchPage(${offset}) failed: ${error.message}`);
  return (data as PassportRow[] | null) ?? [];
}

async function main() {
  console.log(`[backfill-passport-public-uids] mode=${DRY_RUN ? "DRY-RUN" : "WRITE"}`);

  let totalProcessed = 0;
  let totalUpdated = 0;
  let totalErrors = 0;
  let offset = 0;

  while (true) {
    // We're filtering by `public_uid IS NULL` — after each successful
    // batch the offset stays at 0 because the matching rows shrink.
    // Track only on dry-run where we don't actually narrow the set.
    const rows = await fetchPage(DRY_RUN ? offset : 0);
    if (rows.length === 0) break;

    for (const row of rows) {
      totalProcessed += 1;
      if (DRY_RUN) {
        console.log(`[backfill] would set public_uid on passport ${row.id} (legacy passport_uid=${row.passport_uid ?? "null"})`);
        continue;
      }

      const newPublicUid = randomUUID();
      const { error } = await admin
        .from("passports")
        .update({ public_uid: newPublicUid })
        .eq("id", row.id)
        .is("public_uid", null);
      if (error) {
        totalErrors += 1;
        console.error(`[backfill] FAIL passport=${row.id}: ${error.message}`);
      } else {
        totalUpdated += 1;
        console.log(`[backfill] passport=${row.id} → public_uid=${newPublicUid}`);
      }
    }

    if (DRY_RUN) offset += PAGE_SIZE;
    if (rows.length < PAGE_SIZE) break;
  }

  console.log(
    `\n[backfill-passport-public-uids] summary: processed=${totalProcessed} updated=${totalUpdated} failed=${totalErrors}`,
  );
  if (totalErrors > 0) process.exit(2);
}

main().catch((err) => {
  console.error("[backfill-passport-public-uids] fatal:", err);
  process.exit(1);
});
