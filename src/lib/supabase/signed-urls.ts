import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Signed-URL helpers for the `inventory-photos` Supabase Storage bucket
 * (and any other bucket flipped to private as part of cleanup #18).
 *
 * Storage shape — Joey's audit Phase-2 decision:
 *   - On WRITE we now persist the bare *storage path* (e.g. "abc-123.jpg",
 *     not the full https:// URL). New code that uploads is responsible
 *     for stripping the bucket prefix before stashing into the DB column.
 *   - On READ we resolve the path to a signed URL with `signStoragePath`
 *     in the server-side data fetcher, so the URL never leaves the server
 *     stale.
 *
 * Backwards compatibility — existing rows from before this PR still hold
 * a full public URL ("https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>").
 * `extractStoragePath` recognises both shapes so we don't need a
 * destructive backfill migration. Once every row has been re-uploaded
 * (or backfilled in a follow-up) the URL branch becomes dead code.
 */

const PUBLIC_URL_PREFIX = "/storage/v1/object/public/";

/**
 * Extract the storage path from a value that might be either:
 *   - a bare path (e.g. "tenant/uuid/primary/abc.jpg") → returned as-is
 *   - a legacy public URL produced by `getPublicUrl` → bucket prefix stripped
 *   - an external URL or malformed value → returns null (skip signing)
 */
export function extractStoragePath(value: string, bucket: string): string | null {
  if (!value) return null;
  // Legacy public URL → strip prefix.
  if (value.startsWith("http://") || value.startsWith("https://")) {
    const marker = `${PUBLIC_URL_PREFIX}${bucket}/`;
    const idx = value.indexOf(marker);
    if (idx === -1) {
      // External URL we don't own — caller should use as-is.
      return null;
    }
    return value.slice(idx + marker.length);
  }
  // Already a path. Strip a leading slash if present.
  return value.startsWith("/") ? value.slice(1) : value;
}

/**
 * Resolve a stored value to a signed URL for client display.
 *
 * Returns the original value unchanged if it's an external URL we don't
 * recognise (defensive — keeps `<img src="…">` behaviour for any hand-
 * entered URL still floating around in legacy rows).
 *
 * On signing error returns null so callers can render an empty state.
 */
export async function signStoragePath(
  supabase: SupabaseClient,
  bucket: string,
  value: string | null | undefined,
  expirySec: number = 60 * 60 * 24 * 7,
): Promise<string | null> {
  if (!value) return null;
  const path = extractStoragePath(value, bucket);
  if (path === null) {
    // External URL — pass through.
    if (value.startsWith("http://") || value.startsWith("https://")) return value;
    return null;
  }
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expirySec);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/**
 * Batch-resolve a list of stored values. Order preserved (failed entries
 * stay null in-place — callers can `.filter(Boolean)` if they want a
 * dense array).
 */
export async function signStoragePaths(
  supabase: SupabaseClient,
  bucket: string,
  values: ReadonlyArray<string | null | undefined>,
  expirySec: number = 60 * 60 * 24 * 7,
): Promise<Array<string | null>> {
  return Promise.all(values.map((v) => signStoragePath(supabase, bucket, v, expirySec)));
}
