"use client";

import Image from "next/image";
import ImageUpload from "@/components/ui/ImageUpload";
import { saveRepairIntakePhotos } from "../actions";
import { useTransition } from "react";
import { useRouter } from "next/navigation";

interface Props {
  repairId: string;
  tenantId: string;
  existingPhotos: string[];
  readOnly?: boolean;
}

export default function RepairPhotos({ repairId, tenantId, existingPhotos, readOnly = false }: Props) {
  const [, startTransition] = useTransition();
  const router = useRouter();

  function handleUploadComplete(urls: string[]) {
    startTransition(async () => {
      await saveRepairIntakePhotos(repairId, urls);
      router.refresh();
    });
  }

  if (readOnly) {
    if (existingPhotos.length === 0) return null;
    return (
      <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
        <h2 className="text-base font-semibold text-stone-900 mb-4">Intake Photos</h2>
        <div className="grid grid-cols-3 gap-3">
          {existingPhotos.map((url, i) => (
            <Image key={i} src={url} alt={`Photo ${i + 1}`} width={200} height={200} unoptimized className="w-full aspect-square object-cover rounded-lg border border-stone-200" />
          ))}
        </div>
      </div>
    );
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
