"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

interface ImageUploadProps {
  bucket: string;
  path: string;
  /**
   * Existing storage paths (cleanup #18 — buckets are private). The
   * page-level data fetcher should hand us bare paths going forward;
   * legacy rows containing a full https:// URL are accepted for
   * backwards-compat.
   */
  existingImages?: string[];
  /**
   * Optional pre-resolved signed URLs for `existingImages`, in matching
   * order. Avoids a re-sign round-trip on first render. If absent the
   * component will sign the existing items itself on mount.
   */
  existingDisplayUrls?: string[];
  maxImages?: number;
  /**
   * Receives an array of storage PATHS (the persistable shape). Bucket
   * was previously public so this used to be public URLs — callers
   * have been migrated alongside this change.
   */
  onUploadComplete: (paths: string[]) => void;
  label?: string;
  variant?: "multi" | "single";
}

interface UploadingFile {
  name: string;
  progress: number;
}

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Strip the legacy public-URL prefix from a stored value so it round-
 * trips through `createSignedUrl`. Mirrors `extractStoragePath` in
 * src/lib/supabase/signed-urls.ts but inlined here to keep the client
 * bundle independent of the server-only signed-urls module.
 */
function stripBucketPrefix(value: string, bucket: string): string {
  if (!value.startsWith("http://") && !value.startsWith("https://")) {
    return value.startsWith("/") ? value.slice(1) : value;
  }
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = value.indexOf(marker);
  return idx === -1 ? value : value.slice(idx + marker.length);
}

export default function ImageUpload({
  bucket,
  path,
  existingImages = [],
  existingDisplayUrls,
  maxImages = 10,
  onUploadComplete,
  label,
  variant = "multi",
}: ImageUploadProps) {
  // `paths` is what we persist (parent gets these via onUploadComplete).
  // `displayUrls` is what we render in <Image src=…/>; signed URLs with
  // a 7-day expiry — well past the lifetime of a page session.
  const [paths, setPaths] = useState<string[]>(existingImages);
  const [displayUrls, setDisplayUrls] = useState<string[]>(existingDisplayUrls ?? []);
  const [uploading, setUploading] = useState<UploadingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const isSingle = variant === "single";
  const currentDisplayUrls = isSingle ? displayUrls.slice(0, 1) : displayUrls;

  // If the parent didn't pre-sign existingImages, sign them ourselves on
  // mount so the thumbnails render. One round-trip per existing path.
  useEffect(() => {
    if (existingDisplayUrls && existingDisplayUrls.length > 0) return;
    if (existingImages.length === 0) return;
    let cancelled = false;
    (async () => {
      const signed = await Promise.all(
        existingImages.map(async (raw) => {
          const p = stripBucketPrefix(raw, bucket);
          const { data, error: e } = await supabase.storage.from(bucket).createSignedUrl(p, 60 * 60 * 24 * 7);
          if (e || !data?.signedUrl) return null;
          return data.signedUrl;
        }),
      );
      if (cancelled) return;
      setDisplayUrls(signed.filter((u): u is string => !!u));
    })();
    return () => {
      cancelled = true;
    };
    // Intentionally empty — only sign once on mount; subsequent updates
    // come from upload/remove handlers which manage state directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function uploadFile(file: File): Promise<{ path: string; signedUrl: string } | null> {
    // Validate
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Only JPG, PNG, and WebP images are accepted.");
      return null;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("File must be under 10MB.");
      return null;
    }

    const ext = file.name.split(".").pop() ?? "jpg";
    const uuid = generateUUID();
    const filePath = `${path}/${uuid}.${ext}`;

    setUploading((prev) => [...prev, { name: file.name, progress: 0 }]);

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, { upsert: false, contentType: file.type });

    setUploading((prev) => prev.filter((u) => u.name !== file.name));

    if (uploadError) {
      setError("Upload failed: " + uploadError.message);
      return null;
    }

    const { data, error: signErr } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, 60 * 60 * 24 * 7);
    if (signErr || !data?.signedUrl) {
      setError("Could not generate signed URL: " + (signErr?.message ?? "unknown"));
      return null;
    }
    return { path: filePath, signedUrl: data.signedUrl };
  }

  async function handleFiles(files: FileList | File[]) {
    setError(null);
    const fileArray = Array.from(files);
    const remaining = isSingle ? 1 - currentDisplayUrls.length : maxImages - currentDisplayUrls.length;
    if (remaining <= 0) {
      setError(isSingle ? "Replace the existing image first." : `Maximum ${maxImages} images allowed.`);
      return;
    }
    const toUpload = fileArray.slice(0, remaining);

    const newPaths: string[] = [];
    const newDisplay: string[] = [];
    for (const file of toUpload) {
      const result = await uploadFile(file);
      if (result) {
        newPaths.push(result.path);
        newDisplay.push(result.signedUrl);
      }
    }

    if (newPaths.length > 0) {
      const updatedPaths = isSingle ? newPaths : [...paths, ...newPaths];
      const updatedDisplay = isSingle ? newDisplay : [...displayUrls, ...newDisplay];
      setPaths(updatedPaths);
      setDisplayUrls(updatedDisplay);
      onUploadComplete(updatedPaths);
    }
  }

  async function handleRemove(displayUrl: string) {
    // Find the index of the url being removed so we can drop the
    // matching path entry. (We can't reverse-map a signed URL to its
    // path the way the old getPublicUrl→path inversion worked.)
    const idx = displayUrls.indexOf(displayUrl);
    if (idx === -1) return;
    const targetPath = paths[idx];
    if (targetPath) {
      try {
        await supabase.storage.from(bucket).remove([stripBucketPrefix(targetPath, bucket)]);
      } catch {
        // silently fail — still remove from UI
      }
    }
    const updatedPaths = paths.filter((_, i) => i !== idx);
    const updatedDisplay = displayUrls.filter((_, i) => i !== idx);
    setPaths(updatedPaths);
    setDisplayUrls(updatedDisplay);
    onUploadComplete(updatedPaths);
  }

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [paths]
  );

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const onDragLeave = () => setIsDragging(false);

  // ─── Single variant ───────────────────────────────────────────
  if (isSingle) {
    const singleUrl = currentDisplayUrls[0] ?? null;
    return (
      <div className="space-y-2">
        {label && (
          <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">{label}</p>
        )}
        {singleUrl ? (
          <div className="relative w-32 h-32 rounded-xl overflow-hidden border border-stone-200 group">
            <Image src={singleUrl} alt="Uploaded" width={128} height={128} className="w-full h-full object-cover" unoptimized />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="bg-white text-stone-900 text-xs font-medium px-2.5 py-1 rounded-lg shadow"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={() => handleRemove(singleUrl)}
                className="bg-red-500 text-white text-xs font-medium px-2.5 py-1 rounded-lg shadow"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading.length > 0}
            className={`w-32 h-32 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-colors ${
              isDragging ? "border-amber-600 bg-amber-700/5" : "border-stone-200 hover:border-amber-600/60 hover:bg-amber-700/5"
            } disabled:opacity-50`}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
          >
            {uploading.length > 0 ? (
              <div className="w-6 h-6 rounded-full border-2 border-amber-600 border-t-transparent animate-spin" />
            ) : (
              <>
                <svg className="w-7 h-7 text-stone-900/25" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-[10px] text-stone-400 text-center leading-tight px-2">Click or drag to upload</span>
              </>
            )}
          </button>
        )}
        {error && <p className="text-xs text-red-500">{error}</p>}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </div>
    );
  }

  // ─── Multi variant ────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {label && (
        <p className="text-sm font-medium text-stone-900">{label}</p>
      )}

      {/* Thumbnail grid */}
      {currentDisplayUrls.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {currentDisplayUrls.map((url) => (
            <div key={url} className="relative w-[120px] h-[120px] rounded-xl overflow-hidden border border-stone-200 group flex-shrink-0">
              <Image src={url} alt="Uploaded" width={120} height={120} className="w-full h-full object-cover" unoptimized />
              <button
                type="button"
                onClick={() => handleRemove(url)}
                className="absolute top-1.5 right-1.5 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow text-xs font-bold leading-none"
                aria-label="Remove image"
              >
                ×
              </button>
            </div>
          ))}

          {/* Uploading indicators */}
          {uploading.map((u) => (
            <div
              key={u.name}
              className="w-[120px] h-[120px] rounded-xl border border-stone-200 flex items-center justify-center bg-stone-50 flex-shrink-0"
            >
              <div className="flex flex-col items-center gap-2">
                <div className="w-6 h-6 rounded-full border-2 border-amber-600 border-t-transparent animate-spin" />
                <span className="text-[10px] text-stone-400 text-center px-1 truncate max-w-full">{u.name}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload zone */}
      {currentDisplayUrls.length < maxImages && (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
            isDragging ? "border-amber-600 bg-amber-700/5" : "border-stone-200 hover:border-amber-600/60 hover:bg-amber-700/5"
          }`}
        >
          {uploading.length > 0 ? (
            <div className="flex items-center justify-center gap-3">
              <div className="w-5 h-5 rounded-full border-2 border-amber-600 border-t-transparent animate-spin" />
              <span className="text-sm text-stone-500">Uploading {uploading.length} file{uploading.length > 1 ? "s" : ""}…</span>
            </div>
          ) : (
            <>
              <svg className="w-9 h-9 text-stone-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm text-stone-400">
                Drag & drop or <span className="text-amber-700 font-medium">click to upload</span>
              </p>
              <p className="text-xs text-stone-400 mt-1">JPG, PNG, WebP · up to 10MB each · max {maxImages} images</p>
            </>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple={!isSingle}
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />
    </div>
  );
}
