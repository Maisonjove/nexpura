"use client";

import ImageUpload from "@/components/ui/ImageUpload";
import { saveInventoryItemImages } from "../actions";
import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  itemId: string;
  tenantId: string;
  primaryImage: string | null;
  additionalImages: string[];
  readOnly?: boolean;
}

export default function InventoryPhotos({
  itemId,
  tenantId,
  primaryImage,
  additionalImages,
  readOnly = false,
}: Props) {
  const [, startTransition] = useTransition();
  const router = useRouter();
  const [currentPrimary, setCurrentPrimary] = useState<string | null>(primaryImage);
  const [currentAdditional, setCurrentAdditional] = useState<string[]>(additionalImages);

  function handlePrimaryUpload(urls: string[]) {
    const url = urls[0] ?? null;
    setCurrentPrimary(url);
    startTransition(async () => {
      await saveInventoryItemImages(itemId, url, currentAdditional);
      router.refresh();
    });
  }

  function handleAdditionalUpload(urls: string[]) {
    setCurrentAdditional(urls);
    startTransition(async () => {
      await saveInventoryItemImages(itemId, currentPrimary, urls);
      router.refresh();
    });
  }

  if (readOnly) {
    const allImages = [currentPrimary, ...currentAdditional].filter(Boolean) as string[];
    if (allImages.length === 0) return null;
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-4">
        <h2 className="font-semibold text-lg text-stone-900">Photos</h2>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {allImages.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={url} alt={i === 0 ? "Primary photo" : `Photo ${i + 1}`}
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
          maxImages={10}
          onUploadComplete={handleAdditionalUpload}
          variant="multi"
        />
      </div>
    </div>
  );
}
