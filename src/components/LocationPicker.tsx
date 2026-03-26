"use client";

import { useState, useRef, useEffect } from "react";
import { MapPin, ChevronDown, Check, Building2, Layers, Info } from "lucide-react";
import { useLocation } from "@/contexts/LocationContext";
import Link from "next/link";

interface Props {
  showAllOption?: boolean;
  compact?: boolean;
  showDetailsLink?: boolean;
}

export default function LocationPicker({ showAllOption = true, compact = false, showDetailsLink = true }: Props) {
  const { 
    locations, 
    currentLocation, 
    currentLocationId, 
    setCurrentLocationId, 
    hasMultipleLocations, 
    isLoading,
    viewMode,
    setViewMode 
  } = useLocation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Don't show if only one location or no locations
  if (isLoading || locations.length <= 1) {
    return null;
  }

  const isAllLocationsView = viewMode === "all" || !currentLocationId;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 bg-white border border-stone-200 rounded-lg hover:border-stone-300 transition-colors ${
          compact ? "px-2 py-1.5" : "px-3 py-2"
        }`}
      >
        {isAllLocationsView ? (
          <>
            <Layers size={14} className="text-amber-600" />
            <span className={`font-medium text-stone-700 ${compact ? "text-xs" : "text-sm"}`}>
              All Locations
            </span>
          </>
        ) : (
          <>
            <MapPin size={14} className="text-amber-600" />
            <span className={`font-medium text-stone-700 max-w-[120px] truncate ${compact ? "text-xs" : "text-sm"}`}>
              {currentLocation?.name || "Select Store"}
            </span>
          </>
        )}
        <ChevronDown size={14} className={`text-stone-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 w-64 bg-white border border-stone-200 rounded-xl shadow-lg z-50 py-1 overflow-hidden">
          <div className="px-3 py-2 border-b border-stone-100">
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Switch Location</p>
          </div>

          {/* All Locations Option */}
          {showAllOption && (
            <>
              <button
                onClick={() => {
                  setViewMode("all");
                  setCurrentLocationId(null);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-stone-50 transition-colors ${
                  isAllLocationsView ? "bg-amber-50" : ""
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  isAllLocationsView ? "bg-amber-100" : "bg-stone-100"
                }`}>
                  <Layers size={14} className={isAllLocationsView ? "text-amber-700" : "text-stone-500"} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${
                    isAllLocationsView ? "text-amber-700" : "text-stone-700"
                  }`}>
                    All Locations
                  </p>
                  <p className="text-[10px] text-stone-400">View consolidated data</p>
                </div>
                {isAllLocationsView && (
                  <Check size={14} className="text-amber-600 flex-shrink-0" />
                )}
              </button>
              <div className="mx-3 my-1 border-t border-stone-100" />
            </>
          )}

          {/* Individual Locations */}
          <div className="max-h-64 overflow-y-auto">
            {locations.map((location) => {
              const isSelected = viewMode === "single" && currentLocationId === location.id;
              return (
                <button
                  key={location.id}
                  onClick={() => {
                    setViewMode("single");
                    setCurrentLocationId(location.id);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-stone-50 transition-colors ${
                    isSelected ? "bg-amber-50" : ""
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isSelected ? "bg-amber-100" : "bg-stone-100"
                  }`}>
                    <Building2 size={14} className={isSelected ? "text-amber-700" : "text-stone-500"} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${
                      isSelected ? "text-amber-700" : "text-stone-700"
                    }`}>
                      {location.name}
                    </p>
                    <p className="text-[10px] text-stone-400 capitalize">{location.type}</p>
                  </div>
                  {isSelected && (
                    <Check size={14} className="text-amber-600 flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {/* View Details Link */}
          {showDetailsLink && currentLocationId && viewMode === "single" && (
            <>
              <div className="mx-3 my-1 border-t border-stone-100" />
              <Link
                href={`/settings/locations/${currentLocationId}`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-xs text-amber-700 hover:bg-amber-50 transition-colors"
              >
                <Info size={12} />
                <span>View location details</span>
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
