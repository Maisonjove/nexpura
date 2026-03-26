"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { 
  Plus, Search, Package, ArrowRight, Truck, CheckCircle2, 
  Clock, X, Filter, ChevronDown, ChevronRight 
} from "lucide-react";
import NewTransferModal from "./NewTransferModal";

interface Location {
  id: string;
  name: string;
  type?: string;
}

interface InventoryItem {
  id: string;
  name: string;
  sku: string | null;
  quantity: number;
  location_id: string | null;
}

interface TransferItem {
  id: string;
  quantity: number;
  received_quantity: number | null;
  inventory: { id: string; name: string; sku: string | null } | null;
}

interface Transfer {
  id: string;
  tenant_id: string;
  from_location_id: string | null;
  to_location_id: string | null;
  status: "pending" | "in_transit" | "completed" | "cancelled";
  notes: string | null;
  created_at: string;
  dispatched_at: string | null;
  received_at: string | null;
  from_location: { id: string; name: string } | null;
  to_location: { id: string; name: string } | null;
  created_by_user: { email: string } | null;
  dispatched_by_user: { email: string } | null;
  received_by_user: { email: string } | null;
  items: TransferItem[];
}

interface Props {
  tenantId: string;
  userId: string;
  initialTransfers: Transfer[];
  locations: Location[];
  inventory: InventoryItem[];
  isOwnerOrManager: boolean;
  allowedLocationIds: string[] | null;
}

const STATUS_CONFIG = {
  pending: { 
    label: "Pending", 
    color: "bg-amber-50 text-amber-700 border-amber-200",
    icon: Clock 
  },
  in_transit: { 
    label: "In Transit", 
    color: "bg-blue-50 text-blue-700 border-blue-200",
    icon: Truck 
  },
  completed: { 
    label: "Completed", 
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: CheckCircle2 
  },
  cancelled: { 
    label: "Cancelled", 
    color: "bg-stone-50 text-stone-500 border-stone-200",
    icon: X 
  },
};

export default function TransfersClient({
  tenantId,
  userId,
  initialTransfers,
  locations,
  inventory,
  isOwnerOrManager,
  allowedLocationIds,
}: Props) {
  const router = useRouter();
  const [transfers, setTransfers] = useState(initialTransfers);
  const [showNewModal, setShowNewModal] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Filter transfers
  const filteredTransfers = useMemo(() => {
    return transfers.filter(t => {
      // Status filter
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        const fromMatch = t.from_location?.name.toLowerCase().includes(searchLower);
        const toMatch = t.to_location?.name.toLowerCase().includes(searchLower);
        const itemMatch = t.items.some(item => 
          item.inventory?.name.toLowerCase().includes(searchLower) ||
          item.inventory?.sku?.toLowerCase().includes(searchLower)
        );
        if (!fromMatch && !toMatch && !itemMatch) return false;
      }
      
      return true;
    });
  }, [transfers, statusFilter, search]);

  // Check if user can dispatch from a location
  function canDispatchFrom(locationId: string | null): boolean {
    if (!locationId) return false;
    if (allowedLocationIds === null) return true; // All access
    return allowedLocationIds.includes(locationId);
  }

  // Check if user can receive at a location
  function canReceiveAt(locationId: string | null): boolean {
    if (!locationId) return false;
    if (allowedLocationIds === null) return true; // All access
    return allowedLocationIds.includes(locationId);
  }

  async function handleDispatch(transferId: string) {
    setActionLoading(transferId);
    try {
      const res = await fetch("/api/inventory/transfers/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transferId }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to dispatch transfer");
        return;
      }
      
      router.refresh();
    } catch (err) {
      alert("Failed to dispatch transfer");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReceive(transferId: string, items: { itemId: string; receivedQty: number }[]) {
    setActionLoading(transferId);
    try {
      const res = await fetch("/api/inventory/transfers/receive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transferId, items }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to receive transfer");
        return;
      }
      
      router.refresh();
    } catch (err) {
      alert("Failed to receive transfer");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCancel(transferId: string) {
    if (!confirm("Are you sure you want to cancel this transfer?")) return;
    
    setActionLoading(transferId);
    try {
      const res = await fetch("/api/inventory/transfers/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transferId }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to cancel transfer");
        return;
      }
      
      router.refresh();
    } catch (err) {
      alert("Failed to cancel transfer");
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="max-w-6xl mx-auto py-10 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900 flex items-center gap-2">
            Stock Transfers
          </h1>
          <p className="text-sm text-stone-500 mt-0.5">
            Move inventory between locations with full tracking
          </p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-amber-700 text-white text-sm font-medium rounded-lg hover:bg-amber-800 transition-colors"
        >
          <Plus size={16} />
          New Transfer
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Search transfers, items, or locations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-stone-200 rounded-lg text-sm outline-none focus:border-amber-500"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-stone-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white outline-none focus:border-amber-500"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="in_transit">In Transit</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-4 gap-4">
        {(["pending", "in_transit", "completed", "cancelled"] as const).map(status => {
          const count = transfers.filter(t => t.status === status).length;
          const config = STATUS_CONFIG[status];
          const Icon = config.icon;
          return (
            <button
              key={status}
              onClick={() => setStatusFilter(statusFilter === status ? "all" : status)}
              className={`p-4 rounded-xl border transition-all ${
                statusFilter === status 
                  ? "border-amber-500 bg-amber-50" 
                  : "border-stone-200 bg-white hover:border-stone-300"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${config.color}`}>
                  <Icon size={18} />
                </div>
                <div className="text-left">
                  <p className="text-2xl font-semibold text-stone-900">{count}</p>
                  <p className="text-xs text-stone-500">{config.label}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Transfers List */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-sm">
        {filteredTransfers.length === 0 ? (
          <div className="py-16 text-center">
            <Package size={40} className="mx-auto text-stone-300 mb-3" />
            <p className="text-stone-500">No transfers found</p>
            <button
              onClick={() => setShowNewModal(true)}
              className="mt-4 text-amber-700 text-sm font-medium hover:underline"
            >
              Create your first transfer →
            </button>
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {filteredTransfers.map((transfer) => {
              const config = STATUS_CONFIG[transfer.status];
              const Icon = config.icon;
              const isExpanded = expandedId === transfer.id;
              const isLoading = actionLoading === transfer.id;
              
              return (
                <div key={transfer.id} className="bg-white">
                  {/* Transfer Row */}
                  <div 
                    className="px-6 py-4 flex items-center gap-4 cursor-pointer hover:bg-stone-50 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : transfer.id)}
                  >
                    {/* Expand Icon */}
                    <button className="text-stone-400">
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                    
                    {/* Status Badge */}
                    <div className={`px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 border ${config.color}`}>
                      <Icon size={12} />
                      {config.label}
                    </div>
                    
                    {/* Route */}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="font-medium text-stone-900 truncate">
                        {transfer.from_location?.name || "Unknown"}
                      </span>
                      <ArrowRight size={14} className="text-stone-400 flex-shrink-0" />
                      <span className="font-medium text-stone-900 truncate">
                        {transfer.to_location?.name || "Unknown"}
                      </span>
                    </div>
                    
                    {/* Items Count */}
                    <div className="text-sm text-stone-500">
                      {transfer.items.length} item{transfer.items.length !== 1 ? "s" : ""}
                    </div>
                    
                    {/* Date */}
                    <div className="text-sm text-stone-400 w-24 text-right">
                      {format(new Date(transfer.created_at), "dd MMM yyyy")}
                    </div>
                    
                    {/* Actions */}
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      {transfer.status === "pending" && canDispatchFrom(transfer.from_location_id) && (
                        <button
                          onClick={() => handleDispatch(transfer.id)}
                          disabled={isLoading}
                          className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
                        >
                          <Truck size={12} />
                          Dispatch
                        </button>
                      )}
                      
                      {transfer.status === "in_transit" && canReceiveAt(transfer.to_location_id) && (
                        <button
                          onClick={() => {
                            const items = transfer.items.map(item => ({
                              itemId: item.id,
                              receivedQty: item.quantity
                            }));
                            handleReceive(transfer.id, items);
                          }}
                          disabled={isLoading}
                          className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5"
                        >
                          <CheckCircle2 size={12} />
                          Receive
                        </button>
                      )}
                      
                      {(transfer.status === "pending" || transfer.status === "in_transit") && isOwnerOrManager && (
                        <button
                          onClick={() => handleCancel(transfer.id)}
                          disabled={isLoading}
                          className="px-3 py-1.5 bg-stone-100 text-stone-600 text-xs font-medium rounded-lg hover:bg-stone-200 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-6 pb-4 pt-0 bg-stone-50 border-t border-stone-100">
                      <div className="grid grid-cols-3 gap-6 py-4">
                        {/* Items */}
                        <div className="col-span-2">
                          <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">
                            Transfer Items
                          </h4>
                          <div className="space-y-2">
                            {transfer.items.map((item) => (
                              <div 
                                key={item.id} 
                                className="flex items-center justify-between bg-white rounded-lg border border-stone-200 px-4 py-3"
                              >
                                <div className="flex items-center gap-3">
                                  <Package size={16} className="text-stone-400" />
                                  <div>
                                    <p className="font-medium text-stone-900">
                                      {item.inventory?.name || "Unknown Item"}
                                    </p>
                                    {item.inventory?.sku && (
                                      <p className="text-xs text-stone-500">SKU: {item.inventory.sku}</p>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="font-medium text-stone-900">Qty: {item.quantity}</p>
                                  {item.received_quantity !== null && (
                                    <p className="text-xs text-emerald-600">
                                      Received: {item.received_quantity}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        {/* Timeline */}
                        <div>
                          <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">
                            Timeline
                          </h4>
                          <div className="space-y-3">
                            <div className="flex gap-3">
                              <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5" />
                              <div>
                                <p className="text-sm font-medium text-stone-900">Created</p>
                                <p className="text-xs text-stone-500">
                                  {format(new Date(transfer.created_at), "dd MMM yyyy, HH:mm")}
                                </p>
                                {transfer.created_by_user && (
                                  <p className="text-xs text-stone-400">{transfer.created_by_user.email}</p>
                                )}
                              </div>
                            </div>
                            
                            {transfer.dispatched_at && (
                              <div className="flex gap-3">
                                <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5" />
                                <div>
                                  <p className="text-sm font-medium text-stone-900">Dispatched</p>
                                  <p className="text-xs text-stone-500">
                                    {format(new Date(transfer.dispatched_at), "dd MMM yyyy, HH:mm")}
                                  </p>
                                  {transfer.dispatched_by_user && (
                                    <p className="text-xs text-stone-400">{transfer.dispatched_by_user.email}</p>
                                  )}
                                </div>
                              </div>
                            )}
                            
                            {transfer.received_at && (
                              <div className="flex gap-3">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5" />
                                <div>
                                  <p className="text-sm font-medium text-stone-900">Received</p>
                                  <p className="text-xs text-stone-500">
                                    {format(new Date(transfer.received_at), "dd MMM yyyy, HH:mm")}
                                  </p>
                                  {transfer.received_by_user && (
                                    <p className="text-xs text-stone-400">{transfer.received_by_user.email}</p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                          
                          {/* Notes */}
                          {transfer.notes && (
                            <div className="mt-4 pt-4 border-t border-stone-200">
                              <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
                                Notes
                              </h4>
                              <p className="text-sm text-stone-600 italic">{transfer.notes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New Transfer Modal */}
      {showNewModal && (
        <NewTransferModal
          locations={locations}
          inventory={inventory}
          tenantId={tenantId}
          allowedLocationIds={allowedLocationIds}
          onClose={() => setShowNewModal(false)}
          onSuccess={() => {
            setShowNewModal(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
