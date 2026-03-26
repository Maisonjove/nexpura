"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { revokeAccess, getAccessRequests } from "./security-actions";
import { ShieldCheck, Smartphone, ChevronRight, MessageSquare } from "lucide-react";

interface AccessRequest {
  id: string;
  requested_by_email: string;
  reason: string | null;
  status: "pending" | "approved" | "denied" | "expired" | "revoked";
  approved_at: string | null;
  expires_at: string | null;
  created_at: string;
}

interface Props {
  tenantId: string;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTimeRemaining(expiresAt: string) {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diffMs = expiry.getTime() - now.getTime();

  if (diffMs <= 0) return "Expired";

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${minutes}m remaining`;
}

function StatusBadge({ status, expiresAt }: { status: string; expiresAt?: string | null }) {
  const isExpired = expiresAt && new Date(expiresAt) < new Date();
  const displayStatus = status === "approved" && isExpired ? "expired" : status;

  const colors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700",
    approved: "bg-green-100 text-green-700",
    denied: "bg-stone-100 text-stone-600",
    expired: "bg-stone-100 text-stone-500",
    revoked: "bg-red-100 text-red-700",
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${colors[displayStatus] || colors.expired}`}>
      {displayStatus}
    </span>
  );
}

export default function SecurityTab({ tenantId }: Props) {
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [smsPhone, setSmsPhone] = useState<string | null>(null);

  const loadRequests = async () => {
    const data = await getAccessRequests(tenantId);
    setRequests(data as AccessRequest[]);
    setLoading(false);
  };

  const loadTotpStatus = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("users")
        .select("totp_enabled, sms_2fa_enabled, sms_2fa_phone")
        .eq("id", user.id)
        .single();
      setTotpEnabled(data?.totp_enabled ?? false);
      setSmsEnabled(data?.sms_2fa_enabled ?? false);
      setSmsPhone(data?.sms_2fa_phone ?? null);
    }
  };

  useEffect(() => {
    loadRequests();
    loadTotpStatus();
  }, [tenantId]);

  const handleRevoke = (requestId: string) => {
    startTransition(async () => {
      const result = await revokeAccess(requestId);
      if (result.error) {
        setErrorMsg(result.error);
        setTimeout(() => setErrorMsg(null), 5000);
      } else {
        setSuccessMsg("Access revoked successfully");
        setTimeout(() => setSuccessMsg(null), 3000);
        loadRequests();
      }
    });
  };

  // Separate active and history
  const activeRequest = requests.find(
    (r) =>
      r.status === "approved" &&
      r.expires_at &&
      new Date(r.expires_at) > new Date()
  );

  const pendingRequest = requests.find((r) => r.status === "pending");
  const history = requests.filter(
    (r) =>
      r !== activeRequest &&
      r !== pendingRequest
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-stone-200 p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-stone-200 rounded w-48" />
            <div className="h-20 bg-stone-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Two-Factor Authentication */}
      <Link
        href="/settings/two-factor"
        className="block bg-white rounded-xl border border-stone-200 p-6 hover:border-amber-300 hover:shadow-sm transition-all group"
      >
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
            totpEnabled || smsEnabled ? 'bg-green-100' : 'bg-stone-100'
          }`}>
            {smsEnabled ? (
              <MessageSquare className="h-6 w-6 text-green-600" />
            ) : (
              <Smartphone className={`h-6 w-6 ${totpEnabled ? 'text-green-600' : 'text-stone-500'}`} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-stone-900">Two-Factor Authentication</h2>
              <ChevronRight className="h-5 w-5 text-stone-400 group-hover:text-amber-600 transition-colors" />
            </div>
            <p className="text-sm text-stone-500 mt-0.5">
              {totpEnabled 
                ? 'Your account is protected with an authenticator app'
                : smsEnabled
                ? `Your account is protected with SMS (${smsPhone?.slice(0, 4)}****${smsPhone?.slice(-2)})`
                : 'Add an extra layer of security to your account'
              }
            </p>
            <div className="mt-3">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                totpEnabled || smsEnabled
                  ? 'bg-green-100 text-green-700'
                  : 'bg-amber-100 text-amber-700'
              }`}>
                {totpEnabled ? (
                  <>
                    <ShieldCheck className="h-3 w-3" />
                    Authenticator App
                  </>
                ) : smsEnabled ? (
                  <>
                    <ShieldCheck className="h-3 w-3" />
                    SMS Verification
                  </>
                ) : (
                  'Not enabled'
                )}
              </span>
            </div>
          </div>
        </div>
      </Link>

      {/* Toast messages */}
      {successMsg && (
        <div className="flex items-center gap-3 bg-stone-100 border border-amber-600/30 text-amber-700 rounded-xl px-4 py-3 text-sm">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          {errorMsg}
        </div>
      )}

      {/* Active Support Access */}
      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-semibold text-stone-900">Support Access</h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Manage temporary access granted to Nexpura support team
            </p>
          </div>
        </div>

        {activeRequest ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    Active
                  </span>
                  <span className="text-xs text-green-600">
                    {formatTimeRemaining(activeRequest.expires_at!)}
                  </span>
                </div>
                <p className="text-sm text-green-800 font-medium">
                  {activeRequest.requested_by_email}
                </p>
                {activeRequest.reason && (
                  <p className="text-xs text-green-600 mt-1">
                    Reason: {activeRequest.reason}
                  </p>
                )}
                <p className="text-xs text-green-600 mt-2">
                  Approved: {formatDate(activeRequest.approved_at)}
                </p>
              </div>
              <button
                onClick={() => handleRevoke(activeRequest.id)}
                disabled={isPending}
                className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 border border-red-200 rounded-md hover:bg-red-200 transition-colors disabled:opacity-50"
              >
                {isPending ? "Revoking..." : "Revoke Access"}
              </button>
            </div>
          </div>
        ) : pendingRequest ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
                Pending
              </span>
            </div>
            <p className="text-sm text-yellow-800">
              <strong>{pendingRequest.requested_by_email}</strong> has requested access
            </p>
            {pendingRequest.reason && (
              <p className="text-xs text-yellow-600 mt-1">
                Reason: {pendingRequest.reason}
              </p>
            )}
            <p className="text-xs text-yellow-600 mt-2">
              Requested: {formatDate(pendingRequest.created_at)}
            </p>
            <p className="text-xs text-yellow-600 mt-2">
              Check your email to approve or deny this request.
            </p>
          </div>
        ) : (
          <div className="bg-stone-50 rounded-lg p-4 text-center">
            <p className="text-sm text-stone-500">No active support access</p>
            <p className="text-xs text-stone-400 mt-1">
              You'll receive an email if Nexpura support requests access
            </p>
          </div>
        )}
      </div>

      {/* Access History */}
      {history.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-stone-200">
            <h2 className="text-base font-semibold text-stone-900">Access History</h2>
          </div>
          <div className="divide-y divide-stone-100">
            {history.slice(0, 10).map((request) => (
              <div key={request.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-stone-900">
                        {request.requested_by_email}
                      </p>
                      <StatusBadge status={request.status} expiresAt={request.expires_at} />
                    </div>
                    {request.reason && (
                      <p className="text-xs text-stone-500 mt-1">
                        Reason: {request.reason}
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-stone-400">
                    {formatDate(request.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
