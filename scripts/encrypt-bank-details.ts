/**
 * One-time re-encryption pass for existing tenants.bank_bsb / bank_account.
 *
 * W6-HIGH-13: after the 20260428 migration adds bank_bsb_enc + bank_account_enc
 * and the NEXPURA_INTEGRATIONS_ENCRYPTION_KEY env var is set in prod, run this
 * script once against production to:
 *   1. Read every tenants row that still has a non-null plaintext bank_bsb
 *      or bank_account.
 *   2. Encrypt the value with AES-GCM-256 into the matching *_enc column.
 *   3. Null the plaintext column so a future DB leak doesn't re-expose it.
 *
 * Idempotent: rows that already have *_enc set OR that have no plaintext are
 * skipped on a per-field basis.
 *
 * Not run automatically. Joey/Teo executes manually.
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   NEXPURA_INTEGRATIONS_ENCRYPTION_KEY=... \
 *   npx tsx scripts/encrypt-bank-details.ts [--dry-run]
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
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    keyBytes as BufferSource,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const pt = new TextEncoder().encode(JSON.stringify(value ?? null));
  const ct = await globalThis.crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, pt);
  const u8 = (x: Uint8Array) => {
    let s = "";
    for (let i = 0; i < x.length; i++) s += String.fromCharCode(x[i]);
    return btoa(s);
  };
  return { v: 1, c: u8(new Uint8Array(ct)), i: u8(iv) };
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const encKey = process.env.NEXPURA_INTEGRATIONS_ENCRYPTION_KEY;
  if (!url || !key) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  if (!encKey) {
    console.error("Set NEXPURA_INTEGRATIONS_ENCRYPTION_KEY");
    process.exit(1);
  }
  const keyBytes = decodeKey(encKey);
  const sb = createClient(url, key, { auth: { persistSession: false } });

  const { data: rows, error } = await sb
    .from("tenants")
    .select("id, name, bank_bsb, bank_account, bank_bsb_enc, bank_account_enc");
  if (error) {
    console.error("Query failed:", error.message);
    process.exit(1);
  }

  let ok = 0;
  let skipped = 0;
  let fail = 0;

  for (const row of rows ?? []) {
    const update: Record<string, unknown> = {};
    let touched = false;

    if (row.bank_bsb && !row.bank_bsb_enc) {
      update.bank_bsb_enc = await encryptJson(String(row.bank_bsb), keyBytes);
      update.bank_bsb = null;
      touched = true;
    }
    if (row.bank_account && !row.bank_account_enc) {
      update.bank_account_enc = await encryptJson(String(row.bank_account), keyBytes);
      update.bank_account = null;
      touched = true;
    }

    if (!touched) {
      skipped++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`[dry] ${row.id} (${row.name}): would encrypt ${Object.keys(update).join(", ")}`);
      ok++;
      continue;
    }

    const { error: upErr } = await sb.from("tenants").update(update).eq("id", row.id);
    if (upErr) {
      console.error(`[fail] ${row.id}: ${upErr.message}`);
      fail++;
    } else {
      console.log(`[ok] ${row.id} (${row.name})`);
      ok++;
    }
  }

  console.log(`Done. ok=${ok} skipped=${skipped} fail=${fail}`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
