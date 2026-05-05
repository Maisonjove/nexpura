/**
 * One-shot backfill for the C-02 missing-team_members bug.
 *
 * Audit ID C-02 (2026-05-05): the (auth)/onboarding/actions.ts flow
 * inserts tenant + user (role='owner') + subscription + location +
 * permissions but never wrote a `team_members` row for the owner.
 * Result: getUserLocationIds returned [] for those owners, every
 * location-scoped read collapsed to an impossible-UUID filter, and
 * the tenant owner saw an empty /sales (and /repairs, /invoices, etc.)
 * despite having data.
 *
 * The PR-C02-fix bundle ships THREE corrective layers:
 *   1. CODE FALLBACK in src/lib/locations.ts — getUserLocationIds
 *      now returns null (all-access) when no team_members row exists
 *      AND public.users.role IN ('owner','manager').
 *   2. UPSTREAM ONBOARDING FIX in src/app/(auth)/onboarding/actions.ts
 *      — every NEW signup writes the team_members row inline (with
 *      destructive-rollback chain).
 *   3. THIS SCRIPT — backfills the team_members row for every existing
 *      affected (user, tenant) pair. Idempotent; safe to re-run.
 *
 * Pre-flight investigation finding (Mgmt API SQL, 2026-05-05):
 *   - 10 owners affected (0 managers — managers come via invite-accept
 *     which writes team_members correctly).
 *   - Temporal window: 5 in 2026-03, 5 in 2026-04. user.created_at
 *     ≈ tenant.created_at in every case (signup flow created both in
 *     the same transaction).
 *   - Real customers: teo@astry, demo@nexpura, support@maisonjove,
 *     teodagher@gmail, germanijack@yahoo, kaitlynmoghab, hello@nexpura.
 *   - Synthetic test accounts: pilot-sim, intake, attack (3).
 *
 * Each backfilled row:
 *   role                  = users.role from public.users
 *   name                  = "Owner" / "Manager"
 *   email                 = auth.users.email (canonical)
 *   allowed_location_ids  = NULL (all access, matches the canonical
 *                           contract for owners/managers)
 *   invite_accepted       = TRUE (pre-existing relationship, not
 *                           an outstanding invite)
 *   permissions           = { _provenance: { source:
 *                           "c02_backfill_2026_05_05",
 *                           written_at: <ISO> } } — audit trail.
 *
 * Idempotency: existence check via SELECT before each INSERT, so a
 * re-run is a no-op for already-backfilled rows.
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     npx tsx scripts/backfill-team-members-c02.ts [--dry-run]
 *
 * Output goes to stdout — capture for the PR description as evidence.
 */

import { createClient } from "@supabase/supabase-js";

const DRY_RUN = process.argv.includes("--dry-run");
const SOURCE_MARKER = "c02_backfill_2026_05_05";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface AffectedRow {
  user_id: string;
  user_email: string;
  user_role: "owner" | "manager";
  tenant_id: string;
  tenant_name: string | null;
  tenant_slug: string | null;
}

async function findAffected(): Promise<AffectedRow[]> {
  // Mirror the investigation query: every (user, tenant) pair where
  // public.users says they're owner/manager of a non-deleted tenant
  // but no team_members row exists for them on that tenant.
  //
  // PostgREST can't express NOT EXISTS directly in a single .from()
  // call, so do it in two phases:
  //   1. Pull all (user, tenant) pairs matching the role + tenant
  //      criteria.
  //   2. Filter out those with an existing team_members row.
  const { data: users, error: uErr } = await admin
    .from("users")
    .select("id, email, role, tenant_id, tenants!inner(id, name, slug, deleted_at)")
    .in("role", ["owner", "manager"])
    .not("tenant_id", "is", null);
  if (uErr) throw new Error(`findAffected: users select failed: ${uErr.message}`);

  // PostgREST embeds related rows as either an object or an array
  // depending on the relationship cardinality. The `tenants!inner`
  // join returns a single tenant row but the generated types model it
  // as `unknown[] | unknown` — normalise to a single object here.
  type RawRow = {
    id: string;
    email: string | null;
    role: string;
    tenant_id: string;
    tenants: unknown;
  };
  type TenantSlim = {
    id: string;
    name: string | null;
    slug: string | null;
    deleted_at: string | null;
  };
  function pickTenant(t: unknown): TenantSlim | null {
    if (!t) return null;
    if (Array.isArray(t)) return (t[0] as TenantSlim | undefined) ?? null;
    return t as TenantSlim;
  }
  const candidates: AffectedRow[] = (users as unknown as RawRow[] | null ?? [])
    .map((u) => ({ ...u, _t: pickTenant(u.tenants) }))
    .filter((u) => u._t && u._t.deleted_at === null)
    .map((u) => ({
      user_id: u.id,
      user_email: u.email ?? "",
      user_role: (u.role === "manager" ? "manager" : "owner") as "owner" | "manager",
      tenant_id: u.tenant_id,
      tenant_name: u._t?.name ?? null,
      tenant_slug: u._t?.slug ?? null,
    }));

  const out: AffectedRow[] = [];
  for (const c of candidates) {
    const { data: existing } = await admin
      .from("team_members")
      .select("id")
      .eq("tenant_id", c.tenant_id)
      .eq("user_id", c.user_id)
      .maybeSingle();
    if (!existing?.id) out.push(c);
  }
  return out;
}

async function backfill(row: AffectedRow): Promise<{ inserted: boolean; rowId: string | null; error?: string }> {
  // Re-check existence at insert-time as a small race guard; a
  // concurrent invite-accept write is unlikely on prod for the
  // affected accounts but the cost is one round-trip.
  const { data: existing } = await admin
    .from("team_members")
    .select("id")
    .eq("tenant_id", row.tenant_id)
    .eq("user_id", row.user_id)
    .maybeSingle();
  if (existing?.id) {
    return { inserted: false, rowId: existing.id };
  }

  if (DRY_RUN) {
    return { inserted: false, rowId: null };
  }

  const { data: inserted, error } = await admin
    .from("team_members")
    .insert({
      tenant_id: row.tenant_id,
      user_id: row.user_id,
      role: row.user_role,
      name: row.user_role === "owner" ? "Owner" : "Manager",
      email: row.user_email,
      allowed_location_ids: null,
      invite_accepted: true,
      permissions: {
        _provenance: { source: SOURCE_MARKER, written_at: new Date().toISOString() },
      },
    })
    .select("id")
    .single();

  if (error || !inserted?.id) {
    return { inserted: false, rowId: null, error: error?.message ?? "unknown" };
  }
  return { inserted: true, rowId: inserted.id };
}

async function main() {
  console.log(`[backfill-c02] mode=${DRY_RUN ? "DRY-RUN" : "WRITE"} marker=${SOURCE_MARKER}`);

  const affected = await findAffected();
  console.log(`[backfill-c02] affected (user, tenant) pairs: ${affected.length}`);
  if (affected.length === 0) {
    console.log("[backfill-c02] nothing to do.");
    return;
  }

  // Print plan first — useful as PR description evidence.
  console.log("\n[backfill-c02] plan:");
  for (const r of affected) {
    console.log(`  • ${r.user_email}  →  tenant_id=${r.tenant_id} (${r.tenant_slug ?? "<no-slug>"} / ${r.tenant_name ?? "<no-name>"})  role=${r.user_role}`);
  }

  let inserted = 0;
  let alreadyPresent = 0;
  let failed = 0;
  for (const r of affected) {
    const result = await backfill(r);
    if (result.error) {
      failed += 1;
      console.error(`[backfill-c02] FAIL ${r.user_email} → ${r.tenant_id}: ${result.error}`);
    } else if (result.inserted) {
      inserted += 1;
      console.log(`[backfill-c02] inserted row=${result.rowId} for ${r.user_email} → ${r.tenant_id}`);
    } else {
      alreadyPresent += 1;
      console.log(`[backfill-c02] skipped ${r.user_email} → ${r.tenant_id}: row already exists (${result.rowId ?? "dry-run"})`);
    }
  }

  console.log(`\n[backfill-c02] summary: inserted=${inserted} skipped=${alreadyPresent} failed=${failed} total=${affected.length}`);
  if (failed > 0) process.exit(2);
}

main().catch((err) => {
  console.error("[backfill-c02] fatal:", err);
  process.exit(1);
});
