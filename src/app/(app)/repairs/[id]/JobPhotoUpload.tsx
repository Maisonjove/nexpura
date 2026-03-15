"use client";
import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

interface Props {
  jobType: "repair" | "bespoke";
  jobId: string;
  tenantId: string;
  onUploaded: (attachment: { id: string; file_url: string; file_name: string; caption: string | null; created_at: string }) => void;
}

// Client-side Canvas compression
async function compressImage(file: File, maxWidth = 1400, quality = 0.82): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      let { width, height } = img;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("no canvas")); return; }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (blob) resolve(blob);
          else reject(new Error("compression failed"));
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = reject;
    img.src = url;
  });
}

export default function JobPhotoUpload({ jobType, jobId, tenantId, onUploaded }: Props) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    const supabase = createClient();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgress(`Uploading ${i + 1} of ${files.length}…`);

      try {
        // Compress
        const blob = await compressImage(file, 1400, 0.82);
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${tenantId}/${jobType}/${jobId}/${crypto.randomUUID()}-${safeName}`;

        // Upload to Supabase Storage
        const { error: upErr } = await supabase.storage
          .from("job-photos")
          .upload(path, blob, { contentType: "image/jpeg", upsert: false });

        if (upErr) throw upErr;

        const { data: { publicUrl } } = supabase.storage
          .from("job-photos")
          .getPublicUrl(path);

        // Insert into job_attachments via API route
        const res = await fetch("/api/job-attachment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenantId,
            jobType,
            jobId,
            fileName: safeName,
            fileUrl: publicUrl,
            caption: null,
          }),
        });

        if (!res.ok) throw new Error("Failed to save attachment record");
        const { attachment } = await res.json();
        onUploaded(attachment);

      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Upload failed");
        break;
      }
    }

    setUploading(false);
    setProgress("");
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="mt-3">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
        id="job-photo-input"
      />
      <label
        htmlFor="job-photo-input"
        className={`flex items-center justify-center gap-2 w-full py-2 border-2 border-dashed rounded-lg text-sm cursor-pointer transition-colors ${
          uploading
            ? "border-stone-200 text-stone-300 cursor-not-allowed"
            : "border-stone-200 text-stone-500 hover:border-amber-400 hover:text-amber-700"
        }`}
      >
        {uploading ? (
          <span>{progress}</span>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
            </svg>
            Add Photos
          </>
        )}
      </label>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
