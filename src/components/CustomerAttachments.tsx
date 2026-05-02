"use client";

import { useState, useCallback } from "react";
import { File, Image as ImageIcon, FileText, Palette } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Attachment {
  id: string;
  file_url: string;
  file_name: string;
  file_type: string | null;
  description: string | null;
  is_public: boolean;
  created_at: string;
}

interface Props {
  orderId: string;
  orderType: "repair" | "bespoke";
  trackingId?: string;
}

export function CustomerAttachments({ orderId, orderType, trackingId }: Props) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Load attachments on mount
  const loadAttachments = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("order_attachments")
      .select("*")
      .eq("order_type", orderType)
      .eq("order_id", orderId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to load attachments:", error);
      setError("Failed to load attachments");
    } else {
      setAttachments(data || []);
    }
    setIsLoading(false);
  }, [orderId, orderType]);

  // Load on mount
  useState(() => {
    loadAttachments();
  });

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setError(null);
    const supabase = createClient();

    try {
      for (const file of Array.from(files)) {
        // Upload to storage
        const fileExt = file.name.split(".").pop();
        const fileName = `${orderId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("order-attachments")
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: urlData } = supabase.storage
          .from("order-attachments")
          .getPublicUrl(fileName);

        // Get tenant_id from the order
        const table = orderType === "repair" ? "repairs" : "bespoke_jobs";
        const { data: orderData } = await supabase
          .from(table)
          .select("tenant_id")
          .eq("id", orderId)
          .single();

        // Create attachment record
        const { error: insertError } = await supabase
          .from("order_attachments")
          .insert({
            tenant_id: orderData?.tenant_id,
            order_type: orderType,
            order_id: orderId,
            file_url: urlData.publicUrl,
            file_name: file.name,
            file_type: file.type,
            file_size: file.size,
            is_public: true,
          });

        if (insertError) throw insertError;
      }

      // Reload attachments
      await loadAttachments();
    } catch (err) {
      console.error("Upload failed:", err);
      setError("Failed to upload file. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (attachment: Attachment) => {
    if (!confirm("Delete this attachment?")) return;

    const supabase = createClient();
    
    // Delete from storage
    const filePath = attachment.file_url.split("/order-attachments/")[1];
    if (filePath) {
      await supabase.storage.from("order-attachments").remove([filePath]);
    }

    // Delete record
    const { error } = await supabase
      .from("order_attachments")
      .delete()
      .eq("id", attachment.id);

    if (error) {
      setError("Failed to delete attachment");
    } else {
      setAttachments((prev) => prev.filter((a) => a.id !== attachment.id));
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleUpload(e.dataTransfer.files);
  };

  const getFileIcon = (fileType: string | null) => {
    if (!fileType) return <File className="w-4 h-4" strokeWidth={1.5} />;
    if (fileType.startsWith("image/")) return <ImageIcon className="w-4 h-4" strokeWidth={1.5} />;
    if (fileType.includes("pdf")) return <FileText className="w-4 h-4" strokeWidth={1.5} />;
    if (fileType.includes("cad") || fileType.includes("dwg") || fileType.includes("stl"))
      return <Palette className="w-4 h-4" strokeWidth={1.5} />;
    return <File className="w-4 h-4" strokeWidth={1.5} />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-5 h-5 border-2 border-stone-300 border-t-nexpura-bronze rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Upload area */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-xl p-6 text-center transition-colors
          ${dragActive ? "border-amber-500 bg-amber-50" : "border-stone-200 hover:border-stone-300"}
          ${isUploading ? "opacity-50 pointer-events-none" : ""}
        `}
      >
        <input
          type="file"
          multiple
          onChange={(e) => handleUpload(e.target.files)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          accept="image/*,.pdf,.dwg,.stl,.obj,.3dm"
        />
        <div className="space-y-2">
          <div className="w-10 h-10 mx-auto rounded-full bg-stone-100 flex items-center justify-center">
            {isUploading ? (
              <div className="w-5 h-5 border-2 border-stone-300 border-t-nexpura-bronze rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            )}
          </div>
          <p className="text-sm font-medium text-stone-700">
            {isUploading ? "Uploading..." : "Drop files here or click to upload"}
          </p>
          <p className="text-xs text-stone-400">
            CAD files, images, PDFs • Max 10MB per file
          </p>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2 rounded-lg">
          {error}
        </div>
      )}

      {/* Attachments list */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">
            Shared with Customer ({attachments.length})
          </p>
          <div className="space-y-2">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center gap-3 p-3 bg-stone-50 rounded-lg group"
              >
                <span className="text-nexpura-taupe-400">{getFileIcon(attachment.file_type)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-stone-900 truncate">
                    {attachment.file_name}
                  </p>
                  <p className="text-xs text-stone-400">
                    {new Date(attachment.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a
                    href={attachment.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 text-stone-400 hover:text-amber-600 transition-colors"
                    title="View"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </a>
                  <button
                    onClick={() => handleDelete(attachment)}
                    className="p-1.5 text-stone-400 hover:text-red-600 transition-colors"
                    title="Delete"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {attachments.length === 0 && !isLoading && (
        <p className="text-sm text-stone-400 text-center py-2">
          No files shared yet. Upload CAD designs or photos to share with your customer.
        </p>
      )}
    </div>
  );
}

export default CustomerAttachments;
