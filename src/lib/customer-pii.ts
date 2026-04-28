// Customer PII encryption helpers.
//
// W6-HIGH-14 (2026-04-28): encrypts the address bundle + notes +
// jewellery preferences into customers.pii_enc. See migration
// 20260428_customer_pii_encryption.sql for the column.
//
// In-scope fields (encrypted):
//   address_line1, suburb, state, postcode, country, address (legacy),
//   notes, ring_size, preferred_metal, preferred_stone
//
// Deferred (still plaintext):
//   - email / phone / mobile — need equality lookup → hash columns
//     (email_hash / phone_hash) for a future PR.
//   - full_name / first_name / last_name — used in ILIKE search.
//   - birthday / anniversary — date-range queried by /reminders.
//   - tags — array overlap query.
//
// Rollout pattern:
//   1. (this PR) add pii_enc, update writer to encrypt AND keep
//      plaintext. Readers continue to see plaintext, no UX impact.
//   2. (follow-up PR) update every reader to call decryptCustomerPii
//      after fetch.
//   3. (follow-up PR) writer stops writing plaintext; one-shot script
//      nulls existing plaintext columns.

import { encryptJson, decryptJson, type Sealed } from "@/lib/crypto/secretbox";
import logger from "@/lib/logger";

/** Fields encrypted into the pii_enc bundle. */
export interface CustomerPiiBundle {
  address_line1: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  country: string | null;
  address: string | null;
  notes: string | null;
  ring_size: string | null;
  preferred_metal: string | null;
  preferred_stone: string | null;
}

/** Customer-row shape this helper expects (plus pii_enc). */
export type CustomerPiiRow = Partial<CustomerPiiBundle> & { pii_enc?: Sealed | null };

const PII_FIELDS: Array<keyof CustomerPiiBundle> = [
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
];

function emptyBundle(): CustomerPiiBundle {
  return {
    address_line1: null, suburb: null, state: null, postcode: null,
    country: null, address: null, notes: null,
    ring_size: null, preferred_metal: null, preferred_stone: null,
  };
}

/**
 * Decrypt the sealed PII bundle and merge it onto a customer row.
 * Prefers the encrypted payload; falls back to plaintext columns
 * on this row when pii_enc is missing or fails to decrypt.
 *
 * Returns a new shallow-merged object — does not mutate the input.
 */
export async function decryptCustomerPii<T extends CustomerPiiRow>(row: T): Promise<T> {
  if (!row) return row;
  if (!row.pii_enc) return row;
  try {
    const bundle = await decryptJson<Partial<CustomerPiiBundle>>(row.pii_enc);
    if (!bundle) return row;
    const merged: T = { ...row };
    for (const f of PII_FIELDS) {
      const v = bundle[f];
      if (v !== undefined) (merged as Record<string, unknown>)[f] = v;
    }
    return merged;
  } catch (e) {
    logger.error("[customer-pii] decrypt failed", { error: e instanceof Error ? e.message : String(e) });
    return row;
  }
}

/** Same as decryptCustomerPii but for an array of rows. */
export async function decryptCustomerPiiList<T extends CustomerPiiRow>(rows: T[] | null | undefined): Promise<T[]> {
  if (!rows) return [];
  return Promise.all(rows.map(decryptCustomerPii));
}

/**
 * Build the row payload for a customer save. Encrypts all PII fields
 * into a single sealed bundle in pii_enc and writes NULL into the
 * plaintext mirror columns.
 *
 * Phase 3 (W6-HIGH-14): the plaintext mirror is now off — every
 * server-side reader was converted in Phase 2 (#59) and the backfill
 * sealed every existing row. Any reader still relying on the plain
 * columns will silently see nulls; that's the trip-wire that surfaces
 * a missed reader in QA.
 */
export async function buildEncryptedCustomerPiiUpdate(input: Partial<CustomerPiiBundle>): Promise<{
  pii_enc: Sealed;
  address_line1: null;
  suburb: null;
  state: null;
  postcode: null;
  country: null;
  address: null;
  notes: null;
  ring_size: null;
  preferred_metal: null;
  preferred_stone: null;
}> {
  const bundle: CustomerPiiBundle = { ...emptyBundle() };
  for (const f of PII_FIELDS) {
    const v = input[f];
    bundle[f] = (v ?? null) as CustomerPiiBundle[typeof f];
  }
  const pii_enc = await encryptJson(bundle);
  return {
    pii_enc,
    address_line1: null,
    suburb: null,
    state: null,
    postcode: null,
    country: null,
    address: null,
    notes: null,
    ring_size: null,
    preferred_metal: null,
    preferred_stone: null,
  };
}
