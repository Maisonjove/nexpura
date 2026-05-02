"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { UploadCloud, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { updateTenantLogo } from "./logo-actions";

interface Props {
  tenantId: string;
  currentLogoUrl: string | null;
  onLogoChange: (url: string | null) => void;
}

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB per Brief 2 §7.4
const ACCEPTED = ["image/png", "image/svg+xml"];

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function LogoUpload({ tenantId, currentLogoUrl, onLogoChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  async function handleFile(file: File) {
    setError(null);

    if (!ACCEPTED.includes(file.type)) {
      setError("Only PNG or SVG accepted.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("File must be under 2 MB.");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? (file.type === "image/svg+xml" ? "svg" : "png");
      const path = `${tenantId}/logo/${generateUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("logos")
        .upload(path, file, { upsert: false, contentType: file.type });

      if (uploadError) {
        setError(`Upload failed: ${uploadError.message}`);
        return;
      }

      const { data } = supabase.storage.from("logos").getPublicUrl(path);
      const url = data.publicUrl;
      await updateTenantLogo(url);
      onLogoChange(url);
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove() {
    if (!currentLogoUrl) return;
    try {
      const urlObj = new URL(currentLogoUrl);
      const parts = urlObj.pathname.split(`/storage/v1/object/public/logos/`);
      if (parts.length === 2) {
        await supabase.storage.from("logos").remove([parts[1]]);
      }
    } catch {
      // ignore — still clear from UI
    }
    await updateTenantLogo(null);
    onLogoChange(null);
  }

  function openPicker() {
    inputRef.current?.click();
  }

  // Preview state — uploaded logo with Replace / Remove ghost buttons
  if (currentLogoUrl) {
    return (
      <div className="space-y-3">
        <div className="border border-dashed border-nexpura-taupe-100 rounded-md p-6 flex items-center gap-5">
          <div className="relative w-20 h-20 rounded-md overflow-hidden bg-white border border-nexpura-taupe-100 flex-shrink-0">
            <Image
              src={currentLogoUrl}
              alt="Business logo"
              width={80}
              height={80}
              className="w-full h-full object-contain"
              unoptimized
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-nexpura-charcoal">Logo uploaded</p>
            <p className="text-[12px] text-nexpura-taupe-400 mt-0.5">PNG or SVG. Max 2 MB.</p>
            <div className="flex items-center gap-2 mt-3">
              <button
                type="button"
                onClick={openPicker}
                disabled={uploading}
                className="px-3 py-1.5 text-sm text-nexpura-charcoal hover:bg-nexpura-champagne rounded-md transition-colors disabled:opacity-50"
              >
                {uploading ? "Uploading…" : "Replace"}
              </button>
              <button
                type="button"
                onClick={handleRemove}
                disabled={uploading}
                className="px-3 py-1.5 text-sm text-nexpura-charcoal-500 hover:text-nexpura-charcoal hover:bg-nexpura-champagne rounded-md transition-colors disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
        {error && <p className="text-[12px] text-red-600">{error}</p>}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/svg+xml"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
      </div>
    );
  }

  // Empty state — dashed upload card
  return (
    <div className="space-y-3">
      <div className="border border-dashed border-nexpura-taupe-100 rounded-md px-6 py-8 flex flex-col items-center justify-center gap-3 bg-white">
        {uploading ? (
          <Loader2
            className="w-7 h-7 text-nexpura-bronze animate-spin"
            strokeWidth={1.5}
          />
        ) : (
          <UploadCloud
            className="w-7 h-7 text-nexpura-taupe-400"
            strokeWidth={1.5}
            aria-hidden="true"
          />
        )}
        <button
          type="button"
          onClick={openPicker}
          disabled={uploading}
          className="px-4 py-2 text-sm font-medium bg-nexpura-charcoal text-white rounded-md hover:bg-nexpura-charcoal-700 transition-colors disabled:opacity-50"
        >
          {uploading ? "Uploading…" : "Upload logo"}
        </button>
        <p className="text-[12px] text-nexpura-taupe-400">PNG or SVG. Max 2 MB.</p>
      </div>
      {error && <p className="text-[12px] text-red-600">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/svg+xml"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
    </div>
  );
}
