"use client";

import ImageUpload from "@/components/ui/ImageUpload";
import { updateTenantLogo } from "./logo-actions";

interface Props {
  tenantId: string;
  currentLogoUrl: string | null;
  onLogoChange: (url: string | null) => void;
}

export default function LogoUpload({ tenantId, currentLogoUrl, onLogoChange }: Props) {
  async function handleUploadComplete(urls: string[]) {
    const url = urls[0] ?? null;
    // Save to tenants table via server action
    await updateTenantLogo(url);
    onLogoChange(url);
  }

  return (
    <ImageUpload
      bucket="logos"
      path={`${tenantId}/logo`}
      existingImages={currentLogoUrl ? [currentLogoUrl] : []}
      maxImages={1}
      onUploadComplete={handleUploadComplete}
      variant="single"
    />
  );
}
