"use client";

import Image from "next/image";
import ImageUpload from "@/components/ui/ImageUpload";
import { saveInventoryItemImages } from "../actions";
import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  itemId: string;
  tenantId: string;
  /**
   * Storage paths persisted in DB (cleanup #18 — bucket is private).
   * Pre-signed display URLs are passed alongside for first render.
   */
  primaryImagePath: string | null;
  primaryImageDisplayUrl: string | null;
  additionalImagePaths: string[];
  additionalImageDisplayUrls: string[];
  readOnly?: boolean;
}

export default function InventoryPhotos({
  itemId,
  tenantId,
  primaryImagePath,
  primaryImageDisplayUrl,
  additionalImagePaths,
  additionalImageDisplayUrls,
  readOnly = false,
}: Props) {
  const [, startTransition] = useTransition();
  const router = useRouter();
  const [currentPrimary, setCurrentPrimary] = useState<string | null>(primaryImagePath);
  const [currentAdditional, setCurrentAdditional] = useState<string[]>(additionalImagePaths);

  function handlePrimaryUpload(paths: string[]) {
    const path = paths[0] ?? null;
    setCurrentPrimary(path);
    startTransition(async () => {
      await saveInventoryItemImages(itemId, path, currentAdditional);
      router.refresh();
    });
  }

  function handleAdditionalUpload(paths: string[]) {
    setCurrentAdditional(paths);
    startTransition(async () => {
      await saveInventoryItemImages(itemId, currentPrimary, paths);
      router.refresh();
    });
  }

  if (readOnly) {
    // Read-only renders the pre-signed display URLs we got from the server.
    const allDisplay = [primaryImageDisplayUrl, ...additionalImageDisplayUrls].filter(Boolean) as string[];
    if (allDisplay.length === 0) return null;
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-4">
        <h2 className="font-semibold text-lg text-stone-900">Photos</h2>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {allDisplay.map((url, i) => (
            <Image key={i} src={url} alt={i === 0 ? "Primary photo" : `Photo ${i + 1}`}
              width={200} height={200} unoptimized
              className={`w-full aspect-square object-cover rounded-lg border ${i === 0 ? "border-amber-300 ring-1 ring-amber-200" : "border-stone-200"}`} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-6">
      <h2 className="font-semibold text-lg font-semibold text-stone-900">Photos</h2>

      {/* Primary image */}
      <div>
        <p className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-3">Primary Photo</p>
        <ImageUpload
          bucket="inventory-photos"
          path={`${tenantId}/${itemId}/primary`}
          existingImages={currentPrimary ? [currentPrimary] : []}
          existingDisplayUrls={primaryImageDisplayUrl ? [primaryImageDisplayUrl] : []}
          maxImages={1}
          onUploadComplete={handlePrimaryUpload}
          variant="single"
          label="Shown on inventory grid cards"
        />
      </div>

      {/* Additional images */}
      <div className="border-t border-stone-200 pt-5">
        <p className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-3">Additional Photos</p>
        <ImageUpload
          bucket="inventory-photos"
          path={`${tenantId}/${itemId}/gallery`}
          existingImages={currentAdditional}
          existingDisplayUrls={additionalImageDisplayUrls}
          maxImages={10}
          onUploadComplete={handleAdditionalUpload}
          variant="multi"
        />
      </div>
    </div>
  );
}
