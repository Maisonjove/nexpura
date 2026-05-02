"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { CollapsibleSection } from "./FormElements";
import { createClient } from "@/lib/supabase/client";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB per spec
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

interface Props {
  initialUrl?: string | null;
  /** Form field name written into the hidden input (default "primary_image"). */
  fieldName?: string;
}

/**
 * Upload an image into the public inventory-photos bucket and stash the
 * resulting URL into a hidden input under the form's primary_image
 * field name. Wired straight into Supabase Storage from the browser
 * (the bucket is public so reads don't need signed URLs).
 *
 * Validation matches Joey's spec:
 *   - reject > 10 MB
 *   - reject non-image types
 *   - "no image" is a valid state — the hidden input just stays blank.
 */
export default function ImageUploadSection({
  initialUrl,
  fieldName = "primary_image",
}: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(initialUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    if (file.size > MAX_BYTES) {
      setError(`File is ${(file.size / 1024 / 1024).toFixed(1)} MB. Max is 10 MB.`);
      return;
    }
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError(`Unsupported file type "${file.type}". Use JPEG, PNG, WEBP, or HEIC.`);
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("inventory-photos")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) {
        setError(upErr.message);
        return;
      }
      const { data } = supabase.storage.from("inventory-photos").getPublicUrl(path);
      setImageUrl(data.publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function clearImage() {
    setImageUrl(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  return (
    <CollapsibleSection title="Images">
      <input type="hidden" name={fieldName} value={imageUrl ?? ""} />
      {imageUrl ? (
        <div className="space-y-3">
          <div className="relative w-40 h-40 rounded-lg overflow-hidden border border-stone-200">
            <Image src={imageUrl} alt="Item" fill sizes="160px" className="object-cover" />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
              className="px-3 py-1.5 text-xs font-medium border border-stone-200 rounded-lg hover:bg-stone-50 disabled:opacity-50"
            >
              {uploading ? "Uploading…" : "Replace"}
            </button>
            <button
              type="button"
              onClick={clearImage}
              className="px-3 py-1.5 text-xs font-medium border border-stone-200 text-stone-500 rounded-lg hover:bg-stone-50"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={uploading}
          className="w-full border-2 border-dashed border-stone-200 rounded-xl p-8 text-center bg-stone-50/50 hover:border-amber-600/40 hover:bg-amber-50/40 transition-colors disabled:opacity-50"
        >
          <svg className="w-10 h-10 text-stone-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-sm text-stone-500">
            {uploading ? "Uploading…" : "Click to upload (JPEG, PNG, WEBP — max 10 MB)"}
          </p>
        </button>
      )}
      {error && (
        <p className="mt-2 text-sm text-nexpura-oxblood bg-nexpura-oxblood-bg border border-nexpura-oxblood/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      <input
        ref={fileInput}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        className="hidden"
        onChange={handleFile}
      />
    </CollapsibleSection>
  );
}
