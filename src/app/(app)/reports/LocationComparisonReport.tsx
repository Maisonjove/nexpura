"use client";

import { useState, useEffect } from "react";
import { Building2, TrendingUp, Package, Wrench, Users, DollarSign } from "lucide-react";
import logger from "@/lib/logger";

interface Location {
  id: string;
  name: string;
}

interface LocationStats {
  locationId: string;
  salesTotal: number;
  repairsCompleted: number;
  stockValue: number;
  staffCount: number;
}

interface Props {
  locations: Location[];
  tenantId: string;
}

function fmtCurrency(amount: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function LocationComparisonReport({ locations, tenantId }: Props) {
  const [period, setPeriod] = useState<"week" | "month" | "quarter" | "year">("month");
  const [stats, setStats] = useState<LocationStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      setLoading(true);
      try {
        const now = new Date();
        let startDate: Date;
        
        switch (period) {
          case "week":
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case "month":
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
          case "quarter":
            const quarter = Math.floor(now.getMonth() / 3);
            startDate = new Date(now.getFullYear(), quarter * 3, 1);
            break;
          case "year":
            startDate = new Date(now.getFullYear(), 0, 1);
            break;
        }

        const res = await fetch("/api/reports/location-comparison", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            locationIds: locations.map(l => l.id),
            startDate: startDate.toISOString(),
            endDate: now.toISOString(),
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setStats(data.stats || []);
        }
      } catch (error) {
        logger.error("Failed to load location stats:", error);
      }
      setLoading(false);
    }

    if (locations.length > 0) {
      loadStats();
    }
  }, [locations, period, tenantId]);

  if (locations.length < 2) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-8 text-center">
        <Building2 size={40} className="mx-auto text-stone-300 mb-3" />
        <p className="text-stone-500">Add more locations to compare performance</p>
      </div>
    );
  }

  // Calculate totals for comparison
  const totals = stats.reduce((acc, s) => ({
    salesTotal: acc.salesTotal + s.salesTotal,
    repairsCompleted: acc.repairsCompleted + s.repairsCompleted,
    stockValue: acc.stockValue + s.stockValue,
    staffCount: acc.staffCount + s.staffCount,
  }), { salesTotal: 0, repairsCompleted: 0, stockValue: 0, staffCount: 0 });

  // Find top performer
  const topBySales = stats.length > 0 
    ? stats.reduce((max, s) => s.salesTotal > max.salesTotal ? s : max, stats[0])
    : null;

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-stone-900">Location Comparison</h3>
        <div className="flex gap-1 bg-stone-100 p-1 rounded-lg">
          {(["week", "month", "quarter", "year"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                period === p
                  ? "bg-white text-stone-900 shadow-sm"
                  : "text-stone-500 hover:text-stone-700"
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Totals Summary */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={16} className="text-amber-600" />
            <span className="text-xs font-medium text-amber-600 uppercase">Total Sales</span>
          </div>
          <p className="text-2xl font-semibold text-amber-900">{fmtCurrency(totals.salesTotal)}</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
          <div className="flex items-center gap-2 mb-2">
            <Wrench size={16} className="text-blue-600" />
            <span className="text-xs font-medium text-blue-600 uppercase">Repairs Done</span>
          </div>
          <p className="text-2xl font-semibold text-blue-900">{totals.repairsCompleted}</p>
        </div>
        <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
          <div className="flex items-center gap-2 mb-2">
            <Package size={16} className="text-emerald-600" />
            <span className="text-xs font-medium text-emerald-600 uppercase">Stock Value</span>
          </div>
          <p className="text-2xl font-semibold text-emerald-900">{fmtCurrency(totals.stockValue)}</p>
        </div>
        <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
          <div className="flex items-center gap-2 mb-2">
            <Users size={16} className="text-purple-600" />
            <span className="text-xs font-medium text-purple-600 uppercase">Total Staff</span>
          </div>
          <p className="text-2xl font-semibold text-purple-900">{totals.staffCount}</p>
        </div>
      </div>

      {/* Location Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          // Loading skeletons
          Array.from({ length: locations.length }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-stone-200 p-5 animate-pulse">
              <div className="h-5 bg-stone-200 rounded w-24 mb-4" />
              <div className="space-y-3">
                <div className="h-4 bg-stone-100 rounded w-full" />
                <div className="h-4 bg-stone-100 rounded w-3/4" />
                <div className="h-4 bg-stone-100 rounded w-1/2" />
              </div>
            </div>
          ))
        ) : (
          locations.map((location) => {
            const locationStats = stats.find(s => s.locationId === location.id);
            const isTopPerformer = topBySales?.locationId === location.id && stats.length > 1;
            const salesPercent = totals.salesTotal > 0 
              ? ((locationStats?.salesTotal || 0) / totals.salesTotal * 100).toFixed(1)
              : "0";

            return (
              <div
                key={location.id}
                className={`bg-white rounded-xl border p-5 transition-shadow hover:shadow-md ${
                  isTopPerformer ? "border-amber-300 ring-1 ring-amber-100" : "border-stone-200"
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      isTopPerformer ? "bg-amber-100" : "bg-stone-100"
                    }`}>
                      <Building2 size={18} className={isTopPerformer ? "text-amber-700" : "text-stone-500"} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-stone-900">{location.name}</h4>
                      {isTopPerformer && (
                        <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">
                          Top Performer
                        </span>
                      )}
                    </div>
                  </div>
                  {isTopPerformer && (
                    <TrendingUp size={18} className="text-amber-500" />
                  )}
                </div>

                {/* Stats */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-stone-500">Sales</span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-stone-900">
                        {fmtCurrency(locationStats?.salesTotal || 0)}
                      </span>
                      <span className="text-xs text-stone-400">({salesPercent}%)</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-stone-500">Repairs Completed</span>
                    <span className="font-semibold text-stone-900">{locationStats?.repairsCompleted || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-stone-500">Stock Value</span>
                    <span className="font-semibold text-stone-900">
                      {fmtCurrency(locationStats?.stockValue || 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-stone-500">Staff</span>
                    <span className="font-semibold text-stone-900">{locationStats?.staffCount || 0}</span>
                  </div>
                </div>

                {/* Sales Bar */}
                <div className="mt-4 pt-4 border-t border-stone-100">
                  <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isTopPerformer ? "bg-amber-500" : "bg-stone-400"
                      }`}
                      style={{ width: `${salesPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
