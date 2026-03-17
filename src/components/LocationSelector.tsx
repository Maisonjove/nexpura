"use client";

import { useState, useRef, useEffect } from "react";
import { MapPin, ChevronDown, Check, Building2 } from "lucide-react";
import { useLocation } from "@/contexts/LocationContext";

export default function LocationSelector() {
  const { locations, currentLocation, currentLocationId, setCurrentLocationId, hasMultipleLocations, isLoading } = useLocation();
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

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-stone-200 rounded-lg hover:border-stone-300 transition-colors text-sm"
      >
        <MapPin size={14} className="text-amber-600" />
        <span className="font-medium text-stone-700 max-w-[140px] truncate">
          {currentLocation?.name || "Select Store"}
        </span>
        <ChevronDown size={14} className={`text-stone-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-stone-200 rounded-xl shadow-lg z-50 py-1 overflow-hidden">
          <div className="px-3 py-2 border-b border-stone-100">
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Select Store</p>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {locations.map((location) => (
              <button
                key={location.id}
                onClick={() => {
                  setCurrentLocationId(location.id);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-stone-50 transition-colors ${
                  currentLocationId === location.id ? "bg-amber-50" : ""
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  currentLocationId === location.id ? "bg-amber-100" : "bg-stone-100"
                }`}>
                  <Building2 size={14} className={currentLocationId === location.id ? "text-amber-700" : "text-stone-500"} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${
                    currentLocationId === location.id ? "text-amber-700" : "text-stone-700"
                  }`}>
                    {location.name}
                  </p>
                  <p className="text-[10px] text-stone-400 capitalize">{location.type}</p>
                </div>
                {currentLocationId === location.id && (
                  <Check size={14} className="text-amber-600 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
