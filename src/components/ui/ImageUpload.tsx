"use client";

import { useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

interface ImageUploadProps {
  bucket: string;
  path: string;
  existingImages?: string[];
  maxImages?: number;
  onUploadComplete: (urls: string[]) => void;
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

export default function ImageUpload({
  bucket,
  path,
  existingImages = [],
  maxImages = 10,
  onUploadComplete,
  label,
  variant = "multi",
}: ImageUploadProps) {
  const [images, setImages] = useState<string[]>(existingImages);
  const [uploading, setUploading] = useState<UploadingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const isSingle = variant === "single";
  const currentImages = isSingle ? images.slice(0, 1) : images;

  async function uploadFile(file: File) {
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

    const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
    return data.publicUrl;
  }

  async function handleFiles(files: FileList | File[]) {
    setError(null);
    const fileArray = Array.from(files);
    const remaining = isSingle ? 1 - currentImages.length : maxImages - currentImages.length;
    if (remaining <= 0) {
      setError(isSingle ? "Replace the existing image first." : `Maximum ${maxImages} images allowed.`);
      return;
    }
    const toUpload = fileArray.slice(0, remaining);

    const newUrls: string[] = [];
    for (const file of toUpload) {
      const url = await uploadFile(file);
      if (url) newUrls.push(url);
    }

    if (newUrls.length > 0) {
      const updated = isSingle ? newUrls : [...images, ...newUrls];
      setImages(updated);
      onUploadComplete(updated);
    }
  }

  async function handleRemove(url: string) {
    // Extract storage path from URL
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split(`/storage/v1/object/public/${bucket}/`);
      if (pathParts.length === 2) {
        await supabase.storage.from(bucket).remove([pathParts[1]]);
      }
    } catch {
      // silently fail — still remove from UI
    }
    const updated = images.filter((img) => img !== url);
    setImages(updated);
    onUploadComplete(updated);
  }

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [images]
  );

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const onDragLeave = () => setIsDragging(false);

  // ─── Single variant ───────────────────────────────────────────
  if (isSingle) {
    const singleUrl = currentImages[0] ?? null;
    return (
      <div className="space-y-2">
        {label && (
          <p className="text-xs font-medium text-forest/60 uppercase tracking-wide">{label}</p>
        )}
        {singleUrl ? (
          <div className="relative w-32 h-32 rounded-xl overflow-hidden border border-platinum group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={singleUrl} alt="Uploaded" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="bg-white text-forest text-xs font-medium px-2.5 py-1 rounded-lg shadow"
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
              isDragging ? "border-sage bg-sage/5" : "border-platinum hover:border-sage/60 hover:bg-sage/5"
            } disabled:opacity-50`}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
          >
            {uploading.length > 0 ? (
              <div className="w-6 h-6 rounded-full border-2 border-sage border-t-transparent animate-spin" />
            ) : (
              <>
                <svg className="w-7 h-7 text-forest/25" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-[10px] text-forest/40 text-center leading-tight px-2">Click or drag to upload</span>
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
        <p className="text-sm font-medium text-forest">{label}</p>
      )}

      {/* Thumbnail grid */}
      {currentImages.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {currentImages.map((url) => (
            <div key={url} className="relative w-[120px] h-[120px] rounded-xl overflow-hidden border border-platinum group flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="Uploaded" className="w-full h-full object-cover" />
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
              className="w-[120px] h-[120px] rounded-xl border border-platinum flex items-center justify-center bg-ivory flex-shrink-0"
            >
              <div className="flex flex-col items-center gap-2">
                <div className="w-6 h-6 rounded-full border-2 border-sage border-t-transparent animate-spin" />
                <span className="text-[10px] text-forest/40 text-center px-1 truncate max-w-full">{u.name}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload zone */}
      {currentImages.length < maxImages && (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
            isDragging ? "border-sage bg-sage/5" : "border-platinum hover:border-sage/60 hover:bg-sage/5"
          }`}
        >
          {uploading.length > 0 ? (
            <div className="flex items-center justify-center gap-3">
              <div className="w-5 h-5 rounded-full border-2 border-sage border-t-transparent animate-spin" />
              <span className="text-sm text-forest/50">Uploading {uploading.length} file{uploading.length > 1 ? "s" : ""}…</span>
            </div>
          ) : (
            <>
              <svg className="w-9 h-9 text-forest/20 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm text-forest/40">
                Drag & drop or <span className="text-sage font-medium">click to upload</span>
              </p>
              <p className="text-xs text-forest/30 mt-1">JPG, PNG, WebP · up to 10MB each · max {maxImages} images</p>
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
