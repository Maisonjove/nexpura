"use client";

import { Eye, X } from "lucide-react";
import { useRouter } from "next/navigation";

interface OwnerViewBannerProps {
  tenantName: string;
}

export default function OwnerViewBanner({ tenantName }: OwnerViewBannerProps) {
  const router = useRouter();

  function exitOwnerView() {
    // Navigate back to owner admin portal
    router.push("/owner-admin/memberships");
  }

  return (
    <div className="bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-lg rounded-xl mb-6">
      <div className="px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <Eye size={16} />
          </div>
          <div>
            <p className="text-sm font-medium">
              You are viewing <span className="font-bold">{tenantName}</span>&apos;s dashboard as owner
            </p>
            <p className="text-xs text-amber-100">This is a read-only view for support purposes</p>
          </div>
        </div>
        <button
          onClick={exitOwnerView}
          className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
        >
          <X size={16} />
          Exit Owner View
        </button>
      </div>
    </div>
  );
}
