/**
 * Encryption-key rotation walker.
 *
 * Re-encrypts every sealed column under a NEW key, after which the old
 * key can be retired.
 *
 * Runbook (production):
 *   1. Generate the new key:
 *        openssl rand -base64 32
 *   2. In Vercel prod env, set:
 *        NEXPURA_INTEGRATIONS_ENCRYPTION_KEY = <new>
 *        NEXPURA_INTEGRATIONS_ENCRYPTION_KEY_PREVIOUS = <old>   ← grace
 *      Redeploy. The app now ENCRYPTS with the new key but can still
 *      DECRYPT old rows by falling back to the previous key.
 *   3. Run this script (also pass both keys via env):
 *        NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *        NEXPURA_INTEGRATIONS_ENCRYPTION_KEY=<new> \
 *        NEXPURA_INTEGRATIONS_ENCRYPTION_KEY_PREVIOUS=<old> \
 *        npx tsx scripts/rotate-encryption-key.ts [--dry-run]
 *      It walks every sealed row in:
 *        - integrations.config_encrypted
 *        - tenants.bank_bsb_enc
 *        - tenants.bank_account_enc
 *      For each it reads the value (decrypt under whichever key works)
 *      and writes it back encrypted under the new key.
 *   4. Once the script reports `fail=0`, remove
 *      NEXPURA_INTEGRATIONS_ENCRYPTION_KEY_PREVIOUS from Vercel and
 *      redeploy. The old key is now dead.
 *
 * Idempotent: re-running after a partial failure re-processes every
 * row but only changes the IV — the plaintext round-trips identically.
 *
 * NOT autorun. Operator only.
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

async function importKey(bytes: Uint8Array, usages: KeyUsage[]): Promise<CryptoKey> {
  const buf = new ArrayBuffer(32);
  new Uint8Array(buf).set(bytes);
  return globalThis.crypto.subtle.importKey("raw", buf, { name: "AES-GCM" }, false, usages);
}

interface Sealed { v: 1; c: string; i: string }

function b64ToU8(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function u8ToB64(u8: Uint8Array): string {
  let s = "";
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s);
}

function toBuf(u8: Uint8Array): ArrayBuffer {
  const b = new ArrayBuffer(u8.length);
  new Uint8Array(b).set(u8);
  return b;
}

async function decryptWithFallback(sealed: Sealed, primary: CryptoKey, fallback: CryptoKey | null): Promise<string> {
  const iv = b64ToU8(sealed.i);
  const ct = b64ToU8(sealed.c);
  try {
    const pt = await globalThis.crypto.subtle.decrypt({ name: "AES-GCM", iv: toBuf(iv) }, primary, toBuf(ct));
    return new TextDecoder().decode(pt);
  } catch (e) {
    if (!fallback) throw e;
    const pt = await globalThis.crypto.subtle.decrypt({ name: "AES-GCM", iv: toBuf(iv) }, fallback, toBuf(ct));
    return new TextDecoder().decode(pt);
  }
}

async function encryptWith(key: CryptoKey, plain: string): Promise<Sealed> {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const pt = new TextEncoder().encode(plain);
  const ct = await globalThis.crypto.subtle.encrypt({ name: "AES-GCM", iv: toBuf(iv) }, key, toBuf(pt));
  return { v: 1, c: u8ToB64(new Uint8Array(ct)), i: u8ToB64(iv) };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

async function rotateRows(
  table: string,
  pkColumn: string,
  cipherColumn: string,
  newKey: CryptoKey,
  prevKey: CryptoKey | null,
  sb: SB,
): Promise<{ ok: number; skipped: number; fail: number }> {
  const { data: rows, error } = await sb.from(table).select(`${pkColumn}, ${cipherColumn}`).not(cipherColumn, "is", null);
  if (error) {
    console.error(`[${table}.${cipherColumn}] query failed: ${error.message}`);
    return { ok: 0, skipped: 0, fail: 1 };
  }
  let ok = 0, skipped = 0, fail = 0;
  for (const row of (rows ?? []) as Array<Record<string, unknown>>) {
    const r = row;
    const sealed = r[cipherColumn] as Sealed | null;
    const id = r[pkColumn] as string;
    if (!sealed || typeof sealed !== "object" || (sealed as Sealed).v !== 1) {
      skipped++;
      continue;
    }
    try {
      const plain = await decryptWithFallback(sealed, newKey, prevKey);
      const reSealed = await encryptWith(newKey, plain);
      if (DRY_RUN) {
        console.log(`[dry] ${table}.${cipherColumn} id=${id}: would re-seal`);
        ok++;
        continue;
      }
      const { error: upErr } = await sb.from(table).update({ [cipherColumn]: reSealed }).eq(pkColumn, id);
      if (upErr) {
        console.error(`[fail] ${table}.${cipherColumn} id=${id}: ${upErr.message}`);
        fail++;
      } else {
        ok++;
      }
    } catch (e) {
      console.error(`[fail] ${table}.${cipherColumn} id=${id}: ${e instanceof Error ? e.message : String(e)}`);
      fail++;
    }
  }
  console.log(`[${table}.${cipherColumn}] ok=${ok} skipped=${skipped} fail=${fail}`);
  return { ok, skipped, fail };
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const newKeyEnv = process.env.NEXPURA_INTEGRATIONS_ENCRYPTION_KEY;
  const prevKeyEnv = process.env.NEXPURA_INTEGRATIONS_ENCRYPTION_KEY_PREVIOUS;
  if (!url || !svc) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  if (!newKeyEnv) {
    console.error("Set NEXPURA_INTEGRATIONS_ENCRYPTION_KEY to the NEW key");
    process.exit(1);
  }
  const newKey = await importKey(decodeKey(newKeyEnv), ["encrypt", "decrypt"]);
  const prevKey = prevKeyEnv ? await importKey(decodeKey(prevKeyEnv), ["decrypt"]) : null;
  if (!prevKey) {
    console.warn("No NEXPURA_INTEGRATIONS_ENCRYPTION_KEY_PREVIOUS set. Existing rows must already decrypt under the new key (i.e. no real rotation in progress).");
  }
  const sb = createClient(url, svc, { auth: { persistSession: false } });

  const targets: Array<[string, string, string]> = [
    ["integrations", "id", "config_encrypted"],
    ["tenants", "id", "bank_bsb_enc"],
    ["tenants", "id", "bank_account_enc"],
  ];

  let totalFail = 0;
  for (const [table, pk, col] of targets) {
    const r = await rotateRows(table, pk, col, newKey, prevKey, sb);
    totalFail += r.fail;
  }
  if (totalFail > 0) {
    console.error(`Rotation completed with ${totalFail} failures. Investigate before clearing PREVIOUS key.`);
    process.exit(1);
  }
  console.log("Rotation complete. Once verified, unset NEXPURA_INTEGRATIONS_ENCRYPTION_KEY_PREVIOUS in Vercel and redeploy.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
