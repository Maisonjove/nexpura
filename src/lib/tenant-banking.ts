// Tenant banking-detail decryption layer.
//
// 2026-04-28 audit finding: tenants.bank_bsb + tenants.bank_account were
// stored plaintext and rendered on every invoice PDF. A backup leak,
// support dump, or read-only DB compromise would expose every
// jeweller's customers' BSB/account banking info — direct compliance hit
// (PCI-DSS-adjacent + AU privacy obligations).
//
// Fix: new encrypted columns `bank_bsb_enc` + `bank_account_enc` (Sealed
// jsonb, AES-GCM-256, see src/lib/crypto/secretbox.ts). Code writes to
// *_enc and nulls the plain columns. This module reads + decrypts and
// falls back to the plain columns during the migration window so an
// invoice generated mid-rollout doesn't render blank values.

import { decryptJson, encryptJson, type Sealed } from "@/lib/crypto/secretbox";
import logger from "@/lib/logger";

export interface BankDetailsRow {
  bank_name: string | null;
  bank_bsb: string | null;
  bank_account: string | null;
  bank_bsb_enc: Sealed | null;
  bank_account_enc: Sealed | null;
}

export interface DisplayableBankDetails {
  bank_name: string | null;
  bank_bsb: string | null;
  bank_account: string | null;
}

/**
 * Decrypt a tenant row's banking columns into plain strings ready for
 * display. Prefers the encrypted column when present (post-migration);
 * falls back to the plaintext column during the rollout window.
 *
 * Decrypt failures (wrong key, tampered cipher) log + return null for
 * the affected field rather than failing the whole render.
 */
export async function decryptBankDetails(
  row: Pick<BankDetailsRow, "bank_name" | "bank_bsb" | "bank_account" | "bank_bsb_enc" | "bank_account_enc"> | null,
): Promise<DisplayableBankDetails> {
  if (!row) return { bank_name: null, bank_bsb: null, bank_account: null };

  let bsb: string | null = row.bank_bsb ?? null;
  if (row.bank_bsb_enc) {
    try {
      bsb = (await decryptJson<string>(row.bank_bsb_enc)) ?? bsb;
    } catch (e) {
      logger.error("[tenant-banking] bank_bsb_enc decrypt failed", { error: e instanceof Error ? e.message : String(e) });
    }
  }

  let account: string | null = row.bank_account ?? null;
  if (row.bank_account_enc) {
    try {
      account = (await decryptJson<string>(row.bank_account_enc)) ?? account;
    } catch (e) {
      logger.error("[tenant-banking] bank_account_enc decrypt failed", { error: e instanceof Error ? e.message : String(e) });
    }
  }

  return {
    bank_name: row.bank_name ?? null,
    bank_bsb: bsb,
    bank_account: account,
  };
}

/**
 * Build the row payload for a banking save. Encrypts BSB + account into
 * the *_enc columns and nulls the plain columns, so any caller that
 * still reads the plain columns gets nothing instead of stale data.
 *
 * `bank_name` stays plaintext — it's the bank's name (e.g.
 * "Commonwealth Bank"), which is not sensitive PII.
 */
export async function buildEncryptedBankUpdate(input: {
  bank_name: string | null;
  bank_bsb: string | null;
  bank_account: string | null;
}): Promise<{
  bank_name: string | null;
  bank_bsb: null;
  bank_account: null;
  bank_bsb_enc: Sealed | null;
  bank_account_enc: Sealed | null;
}> {
  const bsbEnc = input.bank_bsb && input.bank_bsb.trim() !== ""
    ? await encryptJson(input.bank_bsb.trim())
    : null;
  const accountEnc = input.bank_account && input.bank_account.trim() !== ""
    ? await encryptJson(input.bank_account.trim())
    : null;
  return {
    bank_name: input.bank_name,
    bank_bsb: null,
    bank_account: null,
    bank_bsb_enc: bsbEnc,
    bank_account_enc: accountEnc,
  };
}
