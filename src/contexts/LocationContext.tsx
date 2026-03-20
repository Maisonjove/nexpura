"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

interface Location {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
}

type ViewMode = "all" | "single";

interface LocationContextType {
  locations: Location[];
  currentLocationId: string | null;
  currentLocation: Location | null;
  setCurrentLocationId: (id: string | null) => void;
  isLoading: boolean;
  hasMultipleLocations: boolean;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  // Helper for queries - returns location IDs to filter by, or null for all
  getFilterLocationIds: () => string[] | null;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

const STORAGE_KEY = "nexpura_current_location";
const VIEW_MODE_KEY = "nexpura_location_view_mode";

export function LocationProvider({
  children,
  initialLocations = [],
  initialCurrentLocationId = null,
  allowedLocationIds = null, // null = all access, array = restricted
}: {
  children: ReactNode;
  initialLocations?: Location[];
  initialCurrentLocationId?: string | null;
  allowedLocationIds?: string[] | null;
}) {
  const [locations, setLocations] = useState<Location[]>(initialLocations);
  const [currentLocationId, setCurrentLocationIdState] = useState<string | null>(initialCurrentLocationId);
  const [viewMode, setViewModeState] = useState<ViewMode>("all");
  const [isLoading, setIsLoading] = useState(!initialLocations.length);

  const supabase = createClient();

  // Load locations if not provided
  useEffect(() => {
    if (initialLocations.length > 0) return;

    async function loadLocations() {
      let query = supabase
        .from("locations")
        .select("id, name, type, is_active")
        .eq("is_active", true)
        .order("name");

      // Filter by allowed locations if restricted
      if (allowedLocationIds !== null && allowedLocationIds.length > 0) {
        query = query.in("id", allowedLocationIds);
      }

      const { data } = await query;
      if (data) {
        setLocations(data);

        // Restore saved state
        const storedId = localStorage.getItem(STORAGE_KEY);
        const storedMode = localStorage.getItem(VIEW_MODE_KEY) as ViewMode | null;

        if (storedMode) {
          setViewModeState(storedMode);
        }

        if (storedId && data.find(l => l.id === storedId)) {
          // Stored location still exists — restore it
          setCurrentLocationIdState(storedId);
          if (!storedMode) setViewModeState("single");
        } else {
          // Stale or missing — clear the invalid stored ID
          if (storedId) localStorage.removeItem(STORAGE_KEY);

          if (data.length === 1) {
            // Auto-select if only one location
            setCurrentLocationIdState(data[0].id);
            setViewModeState("single");
          }
        }
      }
      setIsLoading(false);
    }

    loadLocations();
  }, [initialLocations.length, supabase, allowedLocationIds]);

  // Restore from localStorage on mount (when initialLocations are passed server-side)
  useEffect(() => {
    if (initialLocations.length > 0) {
      const storedId = localStorage.getItem(STORAGE_KEY);
      const storedMode = localStorage.getItem(VIEW_MODE_KEY) as ViewMode | null;

      if (storedMode) {
        setViewModeState(storedMode);
      }

      if (storedId && initialLocations.find(l => l.id === storedId)) {
        // Stored location still valid
        setCurrentLocationIdState(storedId);
      } else if (storedId) {
        // Location no longer exists (deleted/deactivated) — clear stale entry
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, [initialLocations]);

  function setCurrentLocationId(id: string | null) {
    setCurrentLocationIdState(id);
    if (id) {
      localStorage.setItem(STORAGE_KEY, id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  function setViewMode(mode: ViewMode) {
    setViewModeState(mode);
    localStorage.setItem(VIEW_MODE_KEY, mode);
    // If switching to "all", clear current location
    if (mode === "all") {
      setCurrentLocationId(null);
    }
  }

  // Get location IDs to use in queries
  function getFilterLocationIds(): string[] | null {
    if (viewMode === "all") {
      // Return all allowed locations (null means no filter)
      return allowedLocationIds;
    }
    // Single location mode
    if (currentLocationId) {
      return [currentLocationId];
    }
    // Fallback to all allowed
    return allowedLocationIds;
  }

  const currentLocation = locations.find(l => l.id === currentLocationId) || null;
  const hasMultipleLocations = locations.length > 1;

  return (
    <LocationContext.Provider
      value={{
        locations,
        currentLocationId,
        currentLocation,
        setCurrentLocationId,
        isLoading,
        hasMultipleLocations,
        viewMode,
        setViewMode,
        getFilterLocationIds,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation(): LocationContextType {
  const context = useContext(LocationContext);

  // Return safe defaults if used outside provider (for static pages like /review)
  if (context === undefined) {
    return {
      locations: [],
      currentLocationId: null,
      currentLocation: null,
      setCurrentLocationId: () => {},
      isLoading: false,
      hasMultipleLocations: false,
      viewMode: "all",
      setViewMode: () => {},
      getFilterLocationIds: () => null,
    };
  }

  return context;
}
