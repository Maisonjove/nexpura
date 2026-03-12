"use client";

import ImageUpload from "@/components/ui/ImageUpload";
import { savePassportPrimaryImage, savePassportImages } from "../actions";
import { useTransition } from "react";
import { useRouter } from "next/navigation";

interface Props {
  passportId: string;
  tenantId: string;
  primaryImage: string | null;
  additionalImages: string[];
}

export default function PassportPhotos({
  passportId,
  tenantId,
  primaryImage,
  additionalImages,
}: Props) {
  const [, startTransition] = useTransition();
  const router = useRouter();

  function handlePrimaryUpload(urls: string[]) {
    const url = urls[0] ?? null;
    startTransition(async () => {
      await savePassportPrimaryImage(passportId, url);
      router.refresh();
    });
  }

  function handleAdditionalUpload(urls: string[]) {
    startTransition(async () => {
      await savePassportImages(passportId, urls);
      router.refresh();
    });
  }

  return (
    <div className="bg-white border border-platinum rounded-xl p-6 shadow-sm space-y-6">
      <h2 className="font-fraunces text-base font-semibold text-forest">Photos</h2>

      {/* Primary image */}
      <div>
        <p className="text-xs font-medium text-forest/50 uppercase tracking-wider mb-3">Primary Photo</p>
        <ImageUpload
          bucket="passport-photos"
          path={`${tenantId}/${passportId}/primary`}
          existingImages={primaryImage ? [primaryImage] : []}
          maxImages={1}
          onUploadComplete={handlePrimaryUpload}
          variant="single"
          label="Main photo (shown on verify page)"
        />
      </div>

      {/* Additional images */}
      <div className="border-t border-platinum pt-5">
        <p className="text-xs font-medium text-forest/50 uppercase tracking-wider mb-3">Additional Photos</p>
        <ImageUpload
          bucket="passport-photos"
          path={`${tenantId}/${passportId}/gallery`}
          existingImages={additionalImages}
          maxImages={10}
          onUploadComplete={handleAdditionalUpload}
          variant="multi"
        />
      </div>
    </div>
  );
}
