-- inventory-photos storage bucket policies — Group 14 audit.
--
-- Why: the inventory-photos bucket exists (public=true) and is used by
-- /expenses receipts and the new /tasks/[id] +Upload feature, but has
-- ZERO RLS policies on storage.objects. Without an authenticated-insert
-- policy every upload returns 403 "new row violates row-level security
-- policy" — the user clicks +Upload, the storage put fails, and the
-- task_attachments row never gets created. Surfaced live during the
-- prod evidence pass for Joey's Group 14 rejection issue #2-a.
--
-- Other tenant-scoped buckets (job-photos, repair-photos, passport-photos,
-- order-attachments) all have these three policies defined; the
-- inventory-photos bucket was missed when the original storage policies
-- were laid down.
--
-- Pattern matches the existing buckets:
--   INSERT: authenticated role only (server checks tenant via the row
--     it inserts into the destination metadata table — task_attachments
--     here, expense_receipts elsewhere)
--   DELETE: authenticated role only
--   SELECT: bucket is public=true so storage.serveFile bypasses RLS for
--     anonymous reads; the explicit policy below makes the authenticated
--     /storage/v1 list/get path also work without a separate flag.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polname = 'inventory_photos_authenticated_insert'
      AND polrelid = 'storage.objects'::regclass
  ) THEN
    CREATE POLICY inventory_photos_authenticated_insert ON storage.objects
      FOR INSERT
      WITH CHECK (bucket_id = 'inventory-photos' AND auth.role() = 'authenticated');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polname = 'inventory_photos_authenticated_delete'
      AND polrelid = 'storage.objects'::regclass
  ) THEN
    CREATE POLICY inventory_photos_authenticated_delete ON storage.objects
      FOR DELETE
      USING (bucket_id = 'inventory-photos' AND auth.role() = 'authenticated');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polname = 'inventory_photos_public_select'
      AND polrelid = 'storage.objects'::regclass
  ) THEN
    CREATE POLICY inventory_photos_public_select ON storage.objects
      FOR SELECT
      USING (bucket_id = 'inventory-photos');
  END IF;
END $$;
