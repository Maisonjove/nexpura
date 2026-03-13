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
}

export default function InventoryPhotos({
  itemId,
  tenantId,
  primaryImage,
  additionalImages,
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
