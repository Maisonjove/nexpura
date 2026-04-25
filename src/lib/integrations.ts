/**
 * Shared integration helpers — server-side only.
 * Use createAdminClient() to bypass RLS for tenant-scoped lookups.
 *
 * W6-HIGH-12: OAuth tokens and webhook secrets used to live verbatim in
 * the `config` jsonb column. They now live encrypted in
 * `config_encrypted` (AES-GCM via lib/crypto/secretbox). The plaintext
 * `config` column survives one release as a legacy fallback — any row
 * with `config_encrypted IS NULL` falls through to `config` so the app
 * stays live while the re-encrypt script (scripts/encrypt-integrations-config.ts)
 * runs.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import {
  encryptJson,
  decryptJson,
  type Sealed,
} from "@/lib/crypto/secretbox";

export type IntegrationType =
  | "xero"
  | "whatsapp"
  | "shopify"
  | "insurance"
  | "google_calendar"
  | "twilio"
  | "square"
  | "woocommerce"
  | "mailchimp";

export interface Integration {
  id: string;
  tenant_id: string;
  type: IntegrationType;
  config: Record<string, unknown>;
  status: "connected" | "disconnected" | "error";
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Shape of a raw DB row as returned by Supabase before decryption. */
interface IntegrationRow {
  id: string;
  tenant_id: string;
  type: IntegrationType;
  config: Record<string, unknown> | null;
  config_encrypted: Sealed | null;
  status: Integration["status"];
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Rebuild the caller-visible config from an integration row.
 * - If `config_encrypted` is set: merge the decrypted secrets with the
 *   public (non-secret) fields that live in the plain `config` column.
 * - Otherwise (legacy pre-migration row): fall through to plaintext
 *   `config` as-is. This branch is removed by the follow-up cleanup
 *   migration once re-encrypt has been run everywhere.
 */
async function decryptRowConfig(row: IntegrationRow): Promise<Record<string, unknown>> {
  if (row.config_encrypted) {
    const secrets = (await decryptJson<Record<string, unknown>>(row.config_encrypted)) ?? {};
    const publicFields = (row.config ?? {}) as Record<string, unknown>;
    return { ...publicFields, ...secrets };
  }
  return (row.config ?? {}) as Record<string, unknown>;
}

/**
 * Get an integration record for a tenant by type.
 * Returns null if not found.
 */
export async function getIntegration(
  tenantId: string,
  type: IntegrationType
): Promise<Integration | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("integrations")
    .select("id, tenant_id, type, config, config_encrypted, status, last_sync_at, created_at, updated_at")
    .eq("tenant_id", tenantId)
    .eq("type", type)
    .single();
  if (!data) return null;
  const row = data as IntegrationRow;
  const config = await decryptRowConfig(row);
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    type: row.type,
    config,
    status: row.status,
    last_sync_at: row.last_sync_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Fields that are safe to leave un-encrypted on a given integration type.
 * Anything not in this list is treated as a secret and ends up in
 * `config_encrypted`. The public fields land in the plaintext `config`
 * column so existing filter paths (e.g. woocommerce webhook lookup by
 * `config->store_url`) still work.
 *
 * Audit rule: if in doubt, LEAVE IT OFF this list. Over-encryption is
 * fine; under-encryption is the bug.
 */
const PUBLIC_FIELDS_BY_TYPE: Record<IntegrationType, readonly string[]> = {
  shopify: ["shop", "store_url", "scope", "connected_at", "store_name"],
  woocommerce: ["store_url", "store_name", "wc_version", "connected_at"],
  xero: ["tenant_name", "expires_at", "connected_at"],
  mailchimp: ["dc", "server_prefix", "list_id", "connected_at"],
  google_calendar: ["calendar_id", "email", "connected_at"],
  // Setup + connect routes write `business_account_id` (the canonical
  // Meta WABA ID name); pre-fix the public list said `business_id`,
  // so the WABA ID was treated as a secret + AES-encrypted at rest.
  // Reads still worked because decryption merges public+secret, but
  // any future filter or upsert keyed on the public column would
  // miss. Align the list with what the routes actually write.
  whatsapp: ["phone_number_id", "business_account_id", "connected_at"],
  insurance: ["enabled", "provider", "connected_at"],
  twilio: ["account_sid", "phone_number", "connected_at"],
  square: ["merchant_id", "connected_at"],
};

function splitSecretsFromPublic(
  type: IntegrationType,
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

/**
 * Upsert an integration record for a tenant. Secret fields (access
 * tokens, consumer secrets, refresh tokens, API keys — everything not
 * in the per-type whitelist in `PUBLIC_FIELDS_BY_TYPE`) are encrypted
 * into `config_encrypted`. The plaintext `config` column keeps only
 * the whitelisted non-secret fields (used by webhook lookup filters).
 */
export async function upsertIntegration(
  tenantId: string,
  type: IntegrationType,
  config: Record<string, unknown>,
  status: "connected" | "disconnected" | "error" = "connected"
): Promise<{ error?: string }> {
  const admin = createAdminClient();
  const { publicFields, secrets } = splitSecretsFromPublic(type, config);
  let sealed: Sealed;
  try {
    sealed = await encryptJson(secrets);
  } catch (e) {
    return {
      error: `Failed to encrypt integration config: ${(e as Error).message}`,
    };
  }
  const { error } = await admin.from("integrations").upsert(
    {
      tenant_id: tenantId,
      type,
      config: publicFields,
      config_encrypted: sealed,
      status,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,type" }
  );
  return error ? { error: error.message } : {};
}

/**
 * Get all integrations for a tenant (status overview). Decrypts every
 * row. Callers only receive plaintext — the wire representation of
 * the row never leaves this helper.
 */
export async function getAllIntegrations(
  tenantId: string
): Promise<Integration[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("integrations")
    .select("id, tenant_id, type, config, config_encrypted, status, last_sync_at, created_at, updated_at")
    .eq("tenant_id", tenantId);
  if (!data) return [];
  const rows = data as IntegrationRow[];
  return Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      tenant_id: row.tenant_id,
      type: row.type,
      config: await decryptRowConfig(row),
      status: row.status,
      last_sync_at: row.last_sync_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    })),
  );
}

/**
 * Get tenant auth context from a server request.
 * Returns userId and tenantId or throws.
 */
export async function getAuthContext() {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const admin = createAdminClient();
  const { data: userData } = await admin
    .from("users")
    .select("tenant_id, role")
    .eq("id", user.id)
    .single();
  if (!userData?.tenant_id) throw new Error("No tenant");
  return {
    userId: user.id,
    tenantId: userData.tenant_id as string,
    role: userData.role as string,
  };
}
