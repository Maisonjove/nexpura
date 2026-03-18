"use client";

import { useState } from "react";
import { Building2, Layers, ChevronDown } from "lucide-react";

interface Location {
  id: string;
  name: string;
}

interface Props {
  locations: Location[];
  selectedLocationId: string | null;
  onLocationChange: (locationId: string | null) => void;
}

export default function ReportsLocationFilter({ locations, selectedLocationId, onLocationChange }: Props) {
  const [open, setOpen] = useState(false);

  if (locations.length <= 1) return null;

  const selectedLocation = locations.find(l => l.id === selectedLocationId);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-4 py-2.5 bg-white border border-stone-200 rounded-xl hover:border-stone-300 transition-colors"
      >
        {selectedLocationId ? (
          <>
            <Building2 size={16} className="text-amber-600" />
            <span className="font-medium text-stone-700">{selectedLocation?.name}</span>
          </>
        ) : (
          <>
            <Layers size={16} className="text-amber-600" />
            <span className="font-medium text-stone-700">All Locations</span>
          </>
        )}
        <ChevronDown size={16} className={`text-stone-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-stone-200 rounded-xl shadow-lg z-50 py-2 overflow-hidden">
            <div className="px-3 py-1.5 border-b border-stone-100">
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Filter by Location</p>
            </div>

            {/* All Locations option */}
            <button
              onClick={() => {
                onLocationChange(null);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-stone-50 ${
                !selectedLocationId ? "bg-amber-50" : ""
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                !selectedLocationId ? "bg-amber-100" : "bg-stone-100"
              }`}>
                <Layers size={14} className={!selectedLocationId ? "text-amber-700" : "text-stone-500"} />
              </div>
              <span className={`text-sm font-medium ${!selectedLocationId ? "text-amber-700" : "text-stone-700"}`}>
                All Locations
              </span>
            </button>

            <div className="mx-3 my-1 border-t border-stone-100" />

            {/* Individual locations */}
            {locations.map((location) => (
              <button
                key={location.id}
                onClick={() => {
                  onLocationChange(location.id);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-stone-50 ${
                  selectedLocationId === location.id ? "bg-amber-50" : ""
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  selectedLocationId === location.id ? "bg-amber-100" : "bg-stone-100"
                }`}>
                  <Building2 size={14} className={selectedLocationId === location.id ? "text-amber-700" : "text-stone-500"} />
                </div>
                <span className={`text-sm font-medium ${
                  selectedLocationId === location.id ? "text-amber-700" : "text-stone-700"
                }`}>
                  {location.name}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
