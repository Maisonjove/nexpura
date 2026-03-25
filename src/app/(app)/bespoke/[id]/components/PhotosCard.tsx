"use client";

import { useState } from "react";
import JobPhotoUpload from "@/app/(app)/repairs/[id]/JobPhotoUpload";
import type { JobAttachment } from "./types";

interface PhotosCardProps {
  attachments: JobAttachment[];
  jobId: string;
  tenantId: string;
  readOnly: boolean;
  onPhotoUploaded: (att: JobAttachment) => void;
  onPhotoDeleted: (id: string) => void;
  onDeletePhoto: (attachment: JobAttachment) => Promise<void>;
}

export default function PhotosCard({
  attachments,
  jobId,
  tenantId,
  readOnly,
  onPhotoUploaded,
  onDeletePhoto,
}: PhotosCardProps) {
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);

  async function handleDelete(a: JobAttachment) {
    if (!confirm(`Remove "${a.caption ?? a.file_name}"?`)) return;
    setDeletingPhotoId(a.id);
    try {
      await onDeletePhoto(a);
    } finally {
      setDeletingPhotoId(null);
    }
  }

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
      <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">Photos &amp; Attachments</h2>
      {attachments.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 mb-3">
          {attachments.map(a => (
            <div key={a.id} className="relative group">
              <img
                src={a.file_url}
                alt={a.caption ?? a.file_name}
                className="w-full aspect-square object-cover rounded-lg cursor-pointer"
                onClick={() => window.open(a.file_url, "_blank")}
              />
              {!readOnly && (
                <button
                  onClick={() => handleDelete(a)}
                  disabled={deletingPhotoId === a.id}
                  className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 disabled:opacity-50"
                  title="Remove photo"
                >
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              {a.caption && <p className="text-xs text-stone-500 mt-1 truncate">{a.caption}</p>}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-stone-400 mb-3">No photos yet</p>
      )}
      {!readOnly && (
        <JobPhotoUpload
          jobType="bespoke"
          jobId={jobId}
          tenantId={tenantId}
          onUploaded={onPhotoUploaded}
        />
      )}
    </div>
  );
}
