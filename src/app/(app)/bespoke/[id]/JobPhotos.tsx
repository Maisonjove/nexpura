"use client";

import ImageUpload from "@/components/ui/ImageUpload";
import { saveBespokeJobImages } from "../actions";
import { useTransition } from "react";
import { useRouter } from "next/navigation";

interface Props {
  jobId: string;
  tenantId: string;
  existingImages: string[];
}

export default function JobPhotos({ jobId, tenantId, existingImages }: Props) {
  const [, startTransition] = useTransition();
  const router = useRouter();

  function handleUploadComplete(urls: string[]) {
    startTransition(async () => {
      await saveBespokeJobImages(jobId, urls);
      router.refresh();
    });
  }

  return (
    <div className="bg-white border border-platinum rounded-xl p-6 shadow-sm">
      <h2 className="font-fraunces text-base font-semibold text-forest mb-4">Photos</h2>
      <ImageUpload
        bucket="job-photos"
        path={`${tenantId}/${jobId}`}
        existingImages={existingImages}
        maxImages={10}
        onUploadComplete={handleUploadComplete}
      />
    </div>
  );
}
