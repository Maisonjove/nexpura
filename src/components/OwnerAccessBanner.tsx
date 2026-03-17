"use client";

import { useState, useTransition } from "react";
import { Shield, Check, X, Clock, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { approveAccess, denyAccess, revokeAccess } from "@/app/(app)/dashboard/access-actions";

type AccessRequest = {
  id: string;
  status: "pending" | "approved" | "denied" | "expired" | "revoked";
  requestedAt: string;
  expiresAt: string | null;
};

interface OwnerAccessBannerProps {
  accessRequest: AccessRequest | null;
}

export default function OwnerAccessBanner({ accessRequest }: OwnerAccessBannerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState<"approve" | "deny" | "revoke" | null>(null);

  if (!accessRequest) return null;

  const isActive = accessRequest.status === "approved" && 
    (!accessRequest.expiresAt || new Date(accessRequest.expiresAt) > new Date());

  function formatTimeRemaining(expiresAt: string | null) {
    if (!expiresAt) return "";
    const expires = new Date(expiresAt);
    const now = new Date();
    const diffMs = expires.getTime() - now.getTime();
    
    if (diffMs <= 0) return "Expired";
    
    const hours = Math.floor(diffMs / 3600000);
    const minutes = Math.floor((diffMs % 3600000) / 60000);
    
    if (hours > 0) return `${hours}h ${minutes}m remaining`;
    return `${minutes}m remaining`;
  }

  async function handleApprove() {
    setLoading("approve");
    try {
      await approveAccess(accessRequest!.id);
      startTransition(() => router.refresh());
    } catch (err) {
      console.error(err);
    }
    setLoading(null);
  }

  async function handleDeny() {
    setLoading("deny");
    try {
      await denyAccess(accessRequest!.id);
      startTransition(() => router.refresh());
    } catch (err) {
      console.error(err);
    }
    setLoading(null);
  }

  async function handleRevoke() {
    setLoading("revoke");
    try {
      await revokeAccess(accessRequest!.id);
      startTransition(() => router.refresh());
    } catch (err) {
      console.error(err);
    }
    setLoading(null);
  }

  // Pending request
  if (accessRequest.status === "pending") {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
            <Shield size={20} className="text-amber-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-amber-800">Platform Owner Access Request</h3>
            <p className="text-sm text-amber-700 mt-1">
              The platform owner has requested temporary access to view your dashboard for support purposes.
              Access will expire after 24 hours if approved.
            </p>
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={handleApprove}
                disabled={loading !== null}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {loading === "approve" ? (
                  <>
                    <Clock size={14} className="animate-spin" />
                    Approving...
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    Approve Access
                  </>
                )}
              </button>
              <button
                onClick={handleDeny}
                disabled={loading !== null}
                className="inline-flex items-center gap-2 px-4 py-2 bg-stone-200 text-stone-700 text-sm font-medium rounded-lg hover:bg-stone-300 transition-colors disabled:opacity-50"
              >
                {loading === "deny" ? (
                  <>
                    <Clock size={14} className="animate-spin" />
                    Denying...
                  </>
                ) : (
                  <>
                    <X size={14} />
                    Deny
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Active access
  if (isActive) {
    const timeRemaining = formatTimeRemaining(accessRequest.expiresAt);
    
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
              <Shield size={20} className="text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-emerald-800">Owner Access Active</h3>
              <p className="text-xs text-emerald-600">{timeRemaining}</p>
            </div>
          </div>
          <button
            onClick={handleRevoke}
            disabled={loading !== null}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-emerald-200 text-emerald-700 text-sm font-medium rounded-lg hover:bg-emerald-50 transition-colors disabled:opacity-50"
          >
            {loading === "revoke" ? (
              <>
                <Clock size={14} className="animate-spin" />
                Revoking...
              </>
            ) : (
              <>
                <X size={14} />
                Revoke Access
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return null;
}
