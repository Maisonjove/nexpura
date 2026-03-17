"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

interface Location {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
}

interface LocationContextType {
  locations: Location[];
  currentLocationId: string | null;
  currentLocation: Location | null;
  setCurrentLocationId: (id: string | null) => void;
  isLoading: boolean;
  hasMultipleLocations: boolean;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

const STORAGE_KEY = "nexpura_current_location";

export function LocationProvider({ 
  children, 
  initialLocations = [],
  initialCurrentLocationId = null 
}: { 
  children: ReactNode;
  initialLocations?: Location[];
  initialCurrentLocationId?: string | null;
}) {
  const [locations, setLocations] = useState<Location[]>(initialLocations);
  const [currentLocationId, setCurrentLocationIdState] = useState<string | null>(initialCurrentLocationId);
  const [isLoading, setIsLoading] = useState(!initialLocations.length);
  const supabase = createClient();

  // Load locations if not provided
  useEffect(() => {
    if (initialLocations.length > 0) return;
    
    async function loadLocations() {
      const { data } = await supabase
        .from("locations")
        .select("id, name, type, is_active")
        .eq("is_active", true)
        .order("name");
      
      if (data) {
        setLocations(data);
        // Auto-select first location if none selected
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored && data.find(l => l.id === stored)) {
          setCurrentLocationIdState(stored);
        } else if (data.length === 1) {
          setCurrentLocationIdState(data[0].id);
        }
      }
      setIsLoading(false);
    }
    
    loadLocations();
  }, [initialLocations.length, supabase]);

  // Restore from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && locations.find(l => l.id === stored)) {
      setCurrentLocationIdState(stored);
    }
  }, [locations]);

  function setCurrentLocationId(id: string | null) {
    setCurrentLocationIdState(id);
    if (id) {
      localStorage.setItem(STORAGE_KEY, id);
      // Also update team_member's current_location_id in database
      supabase.rpc("set_current_location", { location_id: id }).catch(() => {});
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  const currentLocation = locations.find(l => l.id === currentLocationId) || null;
  const hasMultipleLocations = locations.length > 1;

  return (
    <LocationContext.Provider value={{
      locations,
      currentLocationId,
      currentLocation,
      setCurrentLocationId,
      isLoading,
      hasMultipleLocations,
    }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error("useLocation must be used within a LocationProvider");
  }
  return context;
}
