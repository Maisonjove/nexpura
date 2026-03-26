"use client";

import { useState, useEffect, useTransition } from "react";
import { X, Building2, Check, Layers } from "lucide-react";
import { updateTeamMemberLocations, getTeamMemberLocations } from "@/app/(app)/settings/team/actions";

interface Location {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Props {
  member: TeamMember;
  locations: Location[];
  onClose: () => void;
  onSave: () => void;
}

export default function TeamMemberLocationModal({ member, locations, onClose, onSave }: Props) {
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[] | null>(null);
  const [allLocations, setAllLocations] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load current assignments
  useEffect(() => {
    async function load() {
      setIsLoading(true);
      const result = await getTeamMemberLocations(member.id);
      if (result.data === null) {
        // null means all locations
        setAllLocations(true);
        setSelectedLocationIds([]);
      } else {
        setAllLocations(false);
        setSelectedLocationIds(result.data);
      }
      setIsLoading(false);
    }
    load();
  }, [member.id]);

  function toggleLocation(locationId: string) {
    if (allLocations) return;
    
    setSelectedLocationIds((prev) => {
      if (!prev) return [locationId];
      if (prev.includes(locationId)) {
        return prev.filter((id) => id !== locationId);
      }
      return [...prev, locationId];
    });
  }

  function toggleAllLocations() {
    setAllLocations(!allLocations);
    if (!allLocations) {
      // Switching to all locations
      setSelectedLocationIds([]);
    }
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await updateTeamMemberLocations(
        member.id,
        allLocations ? null : selectedLocationIds
      );
      if (result.error) {
        setError(result.error);
      } else {
        onSave();
        onClose();
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50" 
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-stone-900">Location Access</h2>
            <p className="text-sm text-stone-500">{member.name}</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
          >
            <X size={18} className="text-stone-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 bg-stone-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                  {error}
                </div>
              )}

              {/* All Locations Option */}
              <button
                onClick={toggleAllLocations}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                  allLocations 
                    ? "border-amber-500 bg-amber-50" 
                    : "border-stone-200 hover:border-stone-300"
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  allLocations ? "bg-amber-100" : "bg-stone-100"
                }`}>
                  <Layers size={18} className={allLocations ? "text-amber-700" : "text-stone-500"} />
                </div>
                <div className="flex-1 text-left">
                  <p className={`font-medium ${allLocations ? "text-amber-700" : "text-stone-700"}`}>
                    All Locations
                  </p>
                  <p className="text-xs text-stone-500">
                    Access to all current and future locations
                  </p>
                </div>
                {allLocations && (
                  <Check size={18} className="text-amber-600" />
                )}
              </button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-stone-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-stone-400">Or select specific locations</span>
                </div>
              </div>

              {/* Individual Locations */}
              {locations.map((location) => {
                const isSelected = !allLocations && selectedLocationIds?.includes(location.id);
                return (
                  <button
                    key={location.id}
                    onClick={() => toggleLocation(location.id)}
                    disabled={allLocations}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                      allLocations 
                        ? "opacity-50 cursor-not-allowed border-stone-100 bg-stone-50" 
                        : isSelected 
                          ? "border-amber-500 bg-amber-50" 
                          : "border-stone-200 hover:border-stone-300"
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      isSelected ? "bg-amber-100" : "bg-stone-100"
                    }`}>
                      <Building2 size={18} className={isSelected ? "text-amber-700" : "text-stone-500"} />
                    </div>
                    <div className="flex-1 text-left">
                      <p className={`font-medium ${isSelected ? "text-amber-700" : "text-stone-700"}`}>
                        {location.name}
                      </p>
                      <p className="text-xs text-stone-500 capitalize">{location.type}</p>
                    </div>
                    {isSelected && (
                      <Check size={18} className="text-amber-600" />
                    )}
                  </button>
                );
              })}

              {locations.length === 0 && (
                <div className="text-center py-8 text-stone-400">
                  <Building2 size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No locations configured</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-stone-200 flex items-center justify-between bg-stone-50">
          <p className="text-xs text-stone-500">
            {allLocations 
              ? "Full access to all locations" 
              : `${selectedLocationIds?.length || 0} location(s) selected`}
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-stone-500 hover:text-stone-900 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isPending || (!allLocations && (!selectedLocationIds || selectedLocationIds.length === 0))}
              className="px-4 py-2 bg-amber-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 hover:bg-amber-800 transition-colors"
            >
              {isPending ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
