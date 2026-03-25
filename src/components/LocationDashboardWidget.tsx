"use client";

import { useState, useEffect } from "react";
import { Building2, Package, Wrench, Calendar, AlertTriangle, TrendingUp, ChevronRight } from "lucide-react";
import Link from "next/link";
import logger from "@/lib/logger";

interface Location {
  id: string;
  name: string;
  type: string;
}

interface LocationHealth {
  locationId: string;
  lowStockCount: number;
  pendingRepairsCount: number;
  todayAppointmentsCount: number;
  needsAttention: boolean;
}

interface Props {
  locations: Location[];
  tenantId: string;
}

export default function LocationDashboardWidget({ locations, tenantId }: Props) {
  const [health, setHealth] = useState<LocationHealth[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadHealth() {
      try {
        const res = await fetch("/api/locations/health", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locationIds: locations.map(l => l.id) }),
        });
        
        if (res.ok) {
          const data = await res.json();
          setHealth(data.health || []);
        }
      } catch (error) {
        logger.error("Failed to load location health:", error);
      }
      setLoading(false);
    }

    if (locations.length > 1) {
      loadHealth();
    } else {
      setLoading(false);
    }
  }, [locations]);

  if (locations.length <= 1) return null;

  const locationsNeedingAttention = health.filter(h => h.needsAttention);

  return (
    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-sm">
      <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-stone-700 flex items-center gap-2">
          <Building2 size={16} className="text-amber-600" />
          Location Overview
        </h2>
        <Link 
          href="/settings/locations" 
          className="text-xs text-amber-700 font-medium hover:underline"
        >
          Manage locations →
        </Link>
      </div>

      {loading ? (
        <div className="p-6">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {locations.slice(0, 6).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-24 bg-stone-100 rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Attention Alert */}
          {locationsNeedingAttention.length > 0 && (
            <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-3">
              <AlertTriangle size={16} className="text-amber-600 flex-shrink-0" />
              <p className="text-sm text-amber-800">
                <span className="font-semibold">{locationsNeedingAttention.length}</span> location{locationsNeedingAttention.length !== 1 ? "s" : ""} need attention
              </p>
            </div>
          )}

          {/* Location Cards */}
          <div className="p-5">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {locations.map((location) => {
                const locationHealth = health.find(h => h.locationId === location.id);
                const needsAttention = locationHealth?.needsAttention || false;
                
                return (
                  <Link
                    key={location.id}
                    href={`/dashboard?location=${location.id}`}
                    className={`group p-4 rounded-xl border transition-all hover:shadow-md ${
                      needsAttention 
                        ? "border-amber-200 bg-amber-50/50 hover:border-amber-300" 
                        : "border-stone-200 bg-white hover:border-stone-300"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          needsAttention ? "bg-amber-100" : "bg-stone-100"
                        }`}>
                          <Building2 size={14} className={needsAttention ? "text-amber-700" : "text-stone-500"} />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-stone-900">{location.name}</h3>
                          <p className="text-[10px] text-stone-400 uppercase">{location.type}</p>
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-stone-300 group-hover:text-amber-600 transition-colors" />
                    </div>

                    <div className="space-y-1.5">
                      {/* Low Stock */}
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 text-stone-500">
                          <Package size={12} />
                          Low Stock
                        </span>
                        <span className={`font-medium ${
                          (locationHealth?.lowStockCount || 0) > 0 ? "text-amber-600" : "text-stone-600"
                        }`}>
                          {locationHealth?.lowStockCount || 0}
                        </span>
                      </div>

                      {/* Pending Repairs */}
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 text-stone-500">
                          <Wrench size={12} />
                          Active Repairs
                        </span>
                        <span className="font-medium text-stone-600">
                          {locationHealth?.pendingRepairsCount || 0}
                        </span>
                      </div>

                      {/* Today's Appointments */}
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 text-stone-500">
                          <Calendar size={12} />
                          Today
                        </span>
                        <span className="font-medium text-stone-600">
                          {locationHealth?.todayAppointmentsCount || 0} appt
                        </span>
                      </div>
                    </div>

                    {needsAttention && (
                      <div className="mt-3 pt-3 border-t border-amber-200">
                        <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider">
                          Needs attention
                        </span>
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Compare Button */}
          <div className="px-5 py-3 border-t border-stone-100 bg-stone-50">
            <Link
              href="/reports?view=comparison"
              className="flex items-center justify-center gap-2 text-sm font-medium text-amber-700 hover:text-amber-800"
            >
              <TrendingUp size={14} />
              Compare Locations
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
