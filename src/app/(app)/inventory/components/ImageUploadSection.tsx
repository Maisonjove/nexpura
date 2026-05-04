"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { PhotoIcon } from "@heroicons/react/24/outline";
import { CollapsibleSection } from "./FormElements";
import { createClient } from "@/lib/supabase/client";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB per spec
const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

interface Props {
  initialUrl?: string | null;
  /** Form field name written into the hidden input (default "primary_image"). */
  fieldName?: string;
}

/**
 * Upload an image into the inventory-photos bucket and stash the storage
 * PATH (not the URL — bucket is private as of cleanup #18) into a hidden
 * input under the form's primary_image field name.
 *
 * Two-state shape because the bucket is private:
 *   - `imagePath` is what's submitted with the form (DB persisted)
 *   - `displayUrl` is the short-lived signed URL we render in the preview
 *     thumbnail; expires in 1h which is plenty for the create flow.
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
  // initialUrl historically came from the inventory edit flow as a public
  // URL. Going forward it's a path. Existing rows containing a full URL
  // will fail to render in the preview until they're re-uploaded — an
  // acceptable edge for the edit-only path; create works first-class.
  const [imagePath, setImagePath] = useState<string | null>(initialUrl ?? null);
  const [displayUrl, setDisplayUrl] = useState<string | null>(initialUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    if (file.size > MAX_BYTES) {
      setError(
        `File is ${(file.size / 1024 / 1024).toFixed(1)} MB. Max is 10 MB.`
      );
      return;
    }
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError(
        `Unsupported file type "${file.type}". Use JPEG, PNG, WEBP, or HEIC.`
      );
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
      const { data, error: signErr } = await supabase.storage
        .from("inventory-photos")
        .createSignedUrl(path, 60 * 60);
      if (signErr || !data?.signedUrl) {
        setError(signErr?.message ?? "Could not generate display URL.");
        return;
      }
      setImagePath(path);
      setDisplayUrl(data.signedUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function clearImage() {
    setImagePath(null);
    setDisplayUrl(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  return (
    <CollapsibleSection
      eyebrow="Step 08"
      title="Images"
      description="Upload a primary photo of the piece. JPEG, PNG, WEBP, or HEIC, up to 10 MB."
    >
      <input type="hidden" name={fieldName} value={imagePath ?? ""} />
      {imagePath ? (
        <div className="space-y-5">
          <div className="relative w-44 h-44 rounded-xl overflow-hidden border border-stone-200 bg-stone-50">
            {displayUrl ? (
              <Image
                src={displayUrl}
                alt="Item"
                fill
                sizes="176px"
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-stone-400">
                Image attached
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
              className="px-4 py-2 rounded-md text-[0.8125rem] font-medium border border-stone-200 text-stone-700 bg-white hover:bg-stone-50 hover:border-stone-300 transition-all duration-200 disabled:opacity-50"
            >
              {uploading ? "Uploading…" : "Replace"}
            </button>
            <button
              type="button"
              onClick={clearImage}
              className="px-4 py-2 rounded-md text-[0.8125rem] font-medium text-stone-500 hover:text-stone-700 transition-colors duration-200"
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
          className="w-full border border-dashed border-stone-200 rounded-xl py-12 text-center bg-white hover:border-stone-300 hover:bg-stone-50/40 transition-all duration-200 disabled:opacity-50 group"
        >
          <PhotoIcon
            className="w-8 h-8 text-stone-300 group-hover:text-stone-400 mx-auto mb-4 transition-colors duration-300"
            strokeWidth={1.5}
          />
          <p className="text-[0.8125rem] text-stone-500 leading-relaxed">
            {uploading
              ? "Uploading…"
              : "Click to upload — JPEG, PNG, WEBP up to 10 MB"}
          </p>
        </button>
      )}
      {error && (
        <p
          role="alert"
          className="mt-4 border-l-2 border-red-400 pl-4 py-1 text-sm text-red-600 leading-relaxed"
        >
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
