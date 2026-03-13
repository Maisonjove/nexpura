"use client";

import ImageUpload from "@/components/ui/ImageUpload";
import { saveRepairIntakePhotos } from "../actions";
import { useTransition } from "react";
import { useRouter } from "next/navigation";

interface Props {
  repairId: string;
  tenantId: string;
  existingPhotos: string[];
}

export default function RepairPhotos({ repairId, tenantId, existingPhotos }: Props) {
  const [, startTransition] = useTransition();
  const router = useRouter();

  function handleUploadComplete(urls: string[]) {
    startTransition(async () => {
      await saveRepairIntakePhotos(repairId, urls);
      router.refresh();
    });
  }

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
      <h2 className="text-base font-semibold text-stone-900 mb-4">Intake Photos</h2>
      <ImageUpload
        bucket="repair-photos"
        path={`${tenantId}/${repairId}`}
        existingImages={existingPhotos}
        maxImages={10}
        onUploadComplete={handleUploadComplete}
      />
    </div>
  );
}
