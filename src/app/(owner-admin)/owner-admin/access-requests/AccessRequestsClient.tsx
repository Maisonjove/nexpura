"use client";

import { useState } from "react";
import { 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Eye,
  ExternalLink,
  RefreshCw
} from "lucide-react";
import { requestAccessAgain } from "./actions";
import { useRouter } from "next/navigation";

type AccessRequest = {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string | null;
  status: "pending" | "approved" | "denied" | "expired" | "revoked";
  requestedAt: string;
  approvedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  notes: string | null;
};

interface AccessRequestsClientProps {
  requests: AccessRequest[];
}

export default function AccessRequestsClient({ requests }: AccessRequestsClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  // Group requests by status
  const pending = requests.filter((r) => r.status === "pending");
  const approved = requests.filter((r) => r.status === "approved");
  const other = requests.filter((r) => !["pending", "approved"].includes(r.status));

  function formatDate(dateStr: string | null | undefined) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getTimeRemaining(expiresAt: string | null) {
    if (!expiresAt) return null;
    const expires = new Date(expiresAt);
    const now = new Date();
    const diffMs = expires.getTime() - now.getTime();
    
    if (diffMs <= 0) return "Expired";
    
    const hours = Math.floor(diffMs / 3600000);
    const minutes = Math.floor((diffMs % 3600000) / 60000);
    
    if (hours > 0) return `${hours}h ${minutes}m remaining`;
    return `${minutes}m remaining`;
  }

  function viewDashboard(tenantId: string) {
    window.open(`/dashboard?owner_view=${tenantId}`, "_blank");
  }

  async function handleRequestAgain(tenantId: string) {
    setLoading(tenantId);
    try {
      await requestAccessAgain(tenantId);
      router.refresh();
    } catch (err) {
      console.error(err);
    }
    setLoading(null);
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Access Requests</h1>
        <p className="text-stone-400 text-sm mt-1">
          Request and manage dashboard access to tenant accounts
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard icon={Clock} label="Pending" value={pending.length} color="text-amber-400" />
        <StatCard icon={CheckCircle2} label="Approved" value={approved.length} color="text-emerald-400" />
        <StatCard icon={XCircle} label="Denied" value={requests.filter((r) => r.status === "denied").length} color="text-red-400" />
        <StatCard icon={AlertTriangle} label="Expired/Revoked" value={other.length} color="text-stone-400" />
      </div>

      {/* Pending Requests */}
      {pending.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-amber-400 uppercase tracking-wide mb-4 flex items-center gap-2">
            <Clock size={16} />
            Pending Requests ({pending.length})
          </h2>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl overflow-hidden">
            <div className="divide-y divide-amber-500/10">
              {pending.map((request) => (
                <div key={request.id} className="px-6 py-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white">{request.tenantName}</p>
                    <p className="text-xs text-stone-400">Requested {formatDate(request.requestedAt)}</p>
                  </div>
                  <span className="px-3 py-1.5 bg-amber-500/20 text-amber-400 rounded-lg text-xs font-medium">
                    Awaiting tenant approval
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Approved (Active) Access */}
      {approved.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-emerald-400 uppercase tracking-wide mb-4 flex items-center gap-2">
            <CheckCircle2 size={16} />
            Active Access ({approved.length})
          </h2>
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl overflow-hidden">
            <div className="divide-y divide-emerald-500/10">
              {approved.map((request) => {
                const timeRemaining = getTimeRemaining(request.expiresAt);
                const isExpired = timeRemaining === "Expired";

                return (
                  <div key={request.id} className="px-6 py-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-white">{request.tenantName}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <p className="text-xs text-stone-400">Approved {formatDate(request.approvedAt)}</p>
                        {timeRemaining && (
                          <span className={`text-xs font-medium ${isExpired ? 'text-red-400' : 'text-emerald-400'}`}>
                            {timeRemaining}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isExpired ? (
                        <button
                          onClick={() => handleRequestAgain(request.tenantId)}
                          disabled={loading === request.tenantId}
                          className="flex items-center gap-2 px-4 py-2 bg-white/10 text-stone-300 rounded-lg text-sm font-medium hover:bg-white/20 transition-colors disabled:opacity-50"
                        >
                          <RefreshCw size={14} className={loading === request.tenantId ? "animate-spin" : ""} />
                          Request Again
                        </button>
                      ) : (
                        <button
                          onClick={() => viewDashboard(request.tenantId)}
                          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
                        >
                          <Eye size={14} />
                          View Dashboard
                          <ExternalLink size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* History */}
      {other.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-stone-400 uppercase tracking-wide mb-4">
            History
          </h2>
          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="text-left px-6 py-3 text-xs font-medium text-stone-400 uppercase">Tenant</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-stone-400 uppercase">Status</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-stone-400 uppercase">Requested</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-stone-400 uppercase">Notes</th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-stone-400 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {other.map((request) => (
                  <tr key={request.id} className="hover:bg-white/5">
                    <td className="px-6 py-4 text-white">{request.tenantName}</td>
                    <td className="px-6 py-4">
                      <StatusBadge status={request.status} />
                    </td>
                    <td className="px-6 py-4 text-stone-400">{formatDate(request.requestedAt)}</td>
                    <td className="px-6 py-4 text-stone-500">{request.notes || "—"}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleRequestAgain(request.tenantId)}
                        disabled={loading === request.tenantId}
                        className="text-amber-500 hover:text-amber-400 text-xs font-medium disabled:opacity-50"
                      >
                        {loading === request.tenantId ? "Requesting..." : "Request Again"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Empty state */}
      {requests.length === 0 && (
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/5 mb-4">
            <Eye size={32} className="text-stone-500" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">No access requests yet</h3>
          <p className="text-stone-400 text-sm max-w-md mx-auto">
            Go to the Memberships page to request dashboard access for any tenant.
          </p>
        </div>
      )}
    </div>
  );
}

function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  color 
}: { 
  icon: React.ElementType; 
  label: string; 
  value: number;
  color: string;
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={16} className={color} />
        <span className="text-xs text-stone-400">{label}</span>
      </div>
      <p className={`text-2xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-amber-500/20 text-amber-400",
    approved: "bg-emerald-500/20 text-emerald-400",
    denied: "bg-red-500/20 text-red-400",
    expired: "bg-stone-500/20 text-stone-400",
    revoked: "bg-red-500/20 text-red-400",
  };
  
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium capitalize ${styles[status] ?? styles.pending}`}>
      {status}
    </span>
  );
}
