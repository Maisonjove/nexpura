import { createAdminClient } from "@/lib/supabase/admin";
import logger from "@/lib/logger";

/**
 * Turn a raw file_url pointing at the (now private) order-attachments
 * bucket into a short-lived signed URL that a customer's browser can
 * fetch. Returns the original url back unchanged if the string doesn't
 * match the expected shape (defensive — doesn't break callers that
 * happen to store an absolute external URL).
 *
 * Used by the /track/[id] page (service role) and CustomerAttachments
 * (authed user, via the browser client helper). See migration
 * 20260421_order_attachments_private_bucket.sql for why the bucket is
 * private now.
 */
const ONE_HOUR = 60 * 60;
const BUCKET = "order-attachments";

function extractObjectPath(fileUrl: string): string | null {
  // Supabase Storage public URL shape:
  //   https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
  // Private URL shape (from signed URLs):
  //   https://<project>.supabase.co/storage/v1/object/sign/<bucket>/<path>?token=...
  // We care only about the path after /<bucket>/ in either form.
  const marker = `/${BUCKET}/`;
  const idx = fileUrl.indexOf(marker);
  if (idx === -1) return null;
  const rest = fileUrl.slice(idx + marker.length);
  // Strip any existing query params (from previously-signed URLs).
  const q = rest.indexOf("?");
  return q === -1 ? rest : rest.slice(0, q);
}

export async function signOrderAttachmentUrl(
  fileUrl: string,
  expiresIn: number = ONE_HOUR,
): Promise<string> {
  const path = extractObjectPath(fileUrl);
  if (!path) return fileUrl;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(path, expiresIn);
    if (error || !data?.signedUrl) {
      logger.error("[signOrderAttachmentUrl] sign failed", { path, error });
      return fileUrl;
    }
    return data.signedUrl;
  } catch (err) {
    logger.error("[signOrderAttachmentUrl] threw", { path, error: err });
    return fileUrl;
  }
}

/**
 * Batch version — concurrent signing for a list of attachments. Any
 * row with an unsignable/extractable url keeps its original file_url
 * (defensive non-break).
 */
export async function signOrderAttachments<T extends { file_url: string }>(
  rows: T[],
  expiresIn: number = ONE_HOUR,
): Promise<T[]> {
  if (rows.length === 0) return rows;
  const signed = await Promise.all(rows.map((r) => signOrderAttachmentUrl(r.file_url, expiresIn)));
  return rows.map((r, i) => ({ ...r, file_url: signed[i] }));
}
