/**
 * One-time re-encryption pass for existing integration rows.
 *
 * W6-HIGH-12: after the 20260423 migration lands and the
 * `NEXPURA_INTEGRATIONS_ENCRYPTION_KEY` env var is set in prod,
 * run this script once against production to:
 *   1. Read every integration row that still has plaintext `config`
 *      and no `config_encrypted`.
 *   2. Split the config into public / secret per PUBLIC_FIELDS_BY_TYPE.
 *   3. Write `config_encrypted` = AES-GCM(secrets), `config` = public fields.
 *
 * Not run automatically. Joey executes manually once per environment.
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   NEXPURA_INTEGRATIONS_ENCRYPTION_KEY=... \
 *   npx tsx scripts/encrypt-integrations-config.ts [--dry-run]
 *
 * Idempotent: rows that already have `config_encrypted` set are skipped.
 */

import { createClient } from "@supabase/supabase-js";

const DRY_RUN = process.argv.includes("--dry-run");

const PUBLIC_FIELDS_BY_TYPE: Record<string, readonly string[]> = {
  shopify: ["shop", "store_url", "scope", "connected_at", "store_name"],
  woocommerce: ["store_url", "store_name", "wc_version", "connected_at"],
  xero: ["tenant_name", "expires_at", "connected_at"],
  mailchimp: ["dc", "server_prefix", "list_id", "connected_at"],
  google_calendar: ["calendar_id", "email", "connected_at"],
  whatsapp: ["phone_number_id", "business_id", "connected_at"],
  insurance: ["enabled", "provider", "connected_at"],
  twilio: ["account_sid", "phone_number", "connected_at"],
  square: ["merchant_id", "connected_at"],
};

function splitSecretsFromPublic(
  type: string,
  config: Record<string, unknown>,
): { publicFields: Record<string, unknown>; secrets: Record<string, unknown> } {
  const allow = new Set(PUBLIC_FIELDS_BY_TYPE[type] ?? []);
  const publicFields: Record<string, unknown> = {};
  const secrets: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(config ?? {})) {
    if (allow.has(k)) publicFields[k] = v;
    else secrets[k] = v;
  }
  return { publicFields, secrets };
}

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
    .from("integrations")
    .select("id, tenant_id, type, config, config_encrypted")
    .is("config_encrypted", null);
  if (error) {
    console.error("Query failed:", error.message);
    process.exit(1);
  }

  if (!rows || rows.length === 0) {
    console.log("No plaintext rows found. Nothing to do.");
    return;
  }

  console.log(`Found ${rows.length} plaintext rows.${DRY_RUN ? " (dry run)" : ""}`);

  let ok = 0;
  let skipped = 0;
  let fail = 0;
  for (const row of rows) {
    const cfg = (row.config ?? {}) as Record<string, unknown>;
    if (Object.keys(cfg).length === 0) {
      // No data to encrypt, still mark encrypted with empty sealed.
      const sealed = await encryptJson({}, keyBytes);
      if (DRY_RUN) {
        console.log(`[dry] ${row.id} (${row.type}): empty config, would seal empty`);
        ok++;
        continue;
      }
      const { error: upErr } = await sb
        .from("integrations")
        .update({ config_encrypted: sealed, config: {} })
        .eq("id", row.id);
      if (upErr) {
        console.error(`[fail] ${row.id}: ${upErr.message}`);
        fail++;
      } else {
        ok++;
      }
      continue;
    }
    const { publicFields, secrets } = splitSecretsFromPublic(row.type as string, cfg);
    const sealed = await encryptJson(secrets, keyBytes);
    if (DRY_RUN) {
      console.log(
        `[dry] ${row.id} (${row.type}): ${Object.keys(secrets).length} secret keys -> encrypted, ${Object.keys(publicFields).length} public keys kept`,
      );
      ok++;
      continue;
    }
    const { error: upErr } = await sb
      .from("integrations")
      .update({ config: publicFields, config_encrypted: sealed })
      .eq("id", row.id);
    if (upErr) {
      console.error(`[fail] ${row.id}: ${upErr.message}`);
      fail++;
    } else {
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
