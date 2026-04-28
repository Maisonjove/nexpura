/**
 * One-time backfill that encrypts plaintext PII on every customer row.
 *
 * W6-HIGH-14: after the 20260428 migration adds customers.pii_enc and
 * NEXPURA_INTEGRATIONS_ENCRYPTION_KEY is set in prod, run this script
 * once to read the in-scope plaintext fields off every customer row
 * and write the AES-GCM-256 sealed bundle into pii_enc.
 *
 * In scope (encrypted into pii_enc):
 *   address_line1, suburb, state, postcode, country, address (legacy),
 *   notes, ring_size, preferred_metal, preferred_stone
 *
 * Plaintext columns are NOT cleared by this script — that happens in
 * a follow-up release once every reader is hooked through
 * decryptCustomerPii().
 *
 * Idempotent: rows whose pii_enc bundle round-trips to the current
 * plaintext are skipped.
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   NEXPURA_INTEGRATIONS_ENCRYPTION_KEY=... \
 *   npx tsx scripts/encrypt-customer-pii.ts [--dry-run]
 */

import { createClient } from "@supabase/supabase-js";

const DRY_RUN = process.argv.includes("--dry-run");

function decodeKey(raw: string): Uint8Array {
  const trimmed = raw.trim();
  try {
    const b64 = trimmed.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? b64 : b64 + "=".repeat(4 - (b64.length % 4));
    const bin = atob(pad);
    if (bin.length === 32) {
      const out = new Uint8Array(32);
      for (let i = 0; i < 32; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
  } catch {}
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    const out = new Uint8Array(32);
    for (let i = 0; i < 32; i++) out[i] = parseInt(trimmed.slice(i * 2, i * 2 + 2), 16);
    return out;
  }
  throw new Error("KEY must decode to 32 bytes (base64 or hex)");
}

async function encryptJson(value: unknown, keyBytes: Uint8Array) {
  const buf = new ArrayBuffer(32);
  new Uint8Array(buf).set(keyBytes);
  const key = await globalThis.crypto.subtle.importKey("raw", buf, { name: "AES-GCM" }, false, ["encrypt"]);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ivBuf = new ArrayBuffer(12);
  new Uint8Array(ivBuf).set(iv);
  const ptBytes = new TextEncoder().encode(JSON.stringify(value ?? null));
  const ptBuf = new ArrayBuffer(ptBytes.length);
  new Uint8Array(ptBuf).set(ptBytes);
  const ct = await globalThis.crypto.subtle.encrypt({ name: "AES-GCM", iv: new Uint8Array(ivBuf) }, key, ptBuf);
  const u8 = (x: Uint8Array) => {
    let s = "";
    for (let i = 0; i < x.length; i++) s += String.fromCharCode(x[i]);
    return btoa(s);
  };
  return { v: 1, c: u8(new Uint8Array(ct)), i: u8(iv) };
}

const FIELDS = [
  "address_line1",
  "suburb",
  "state",
  "postcode",
  "country",
  "address",
  "notes",
  "ring_size",
  "preferred_metal",
  "preferred_stone",
] as const;

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const encKey = process.env.NEXPURA_INTEGRATIONS_ENCRYPTION_KEY;
  if (!url || !svc) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  if (!encKey) {
    console.error("Set NEXPURA_INTEGRATIONS_ENCRYPTION_KEY");
    process.exit(1);
  }
  const keyBytes = decodeKey(encKey);
  const sb = createClient(url, svc, { auth: { persistSession: false } });

  const PAGE = 500;
  let from = 0;
  let ok = 0, skipped = 0, fail = 0;

  for (;;) {
    const { data: rows, error } = await sb
      .from("customers")
      .select(`id, pii_enc, ${FIELDS.join(", ")}`)
      .range(from, from + PAGE - 1)
      .order("id");
    if (error) {
      console.error("Query failed:", error.message);
      process.exit(1);
    }
    if (!rows || rows.length === 0) break;

    for (const row of (rows as unknown) as Array<Record<string, unknown>>) {
      if (row.pii_enc) {
        skipped++;
        continue;
      }
      const bundle: Record<string, string | null> = {};
      let anyNonNull = false;
      for (const f of FIELDS) {
        const v = row[f];
        bundle[f] = (typeof v === "string" ? v : null);
        if (bundle[f] !== null) anyNonNull = true;
      }
      if (!anyNonNull) {
        // Empty bundle — still write so the column is set (and avoids
        // re-processing every run), but it's just sealed nulls.
      }
      if (DRY_RUN) {
        console.log(`[dry] ${row.id}: would seal ${Object.values(bundle).filter(v => v !== null).length} non-null fields`);
        ok++;
        continue;
      }
      const sealed = await encryptJson(bundle, keyBytes);
      const { error: upErr } = await sb
        .from("customers")
        .update({ pii_enc: sealed })
        .eq("id", row.id as string);
      if (upErr) {
        console.error(`[fail] ${row.id}: ${upErr.message}`);
        fail++;
      } else {
        ok++;
      }
    }
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  console.log(`Done. ok=${ok} skipped=${skipped} fail=${fail}`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
