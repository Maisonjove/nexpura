"use client";

import { useLocation } from "@/contexts/LocationContext";
import { Building2, AlertCircle } from "lucide-react";
import POSClient from "./POSClient";
import type { Customer } from "./components/types";

interface InventoryItem {
  id: string;
  name: string;
  sku: string | null;
  retail_price: number;
  quantity: number;
  primary_image: string | null;
  jewellery_type: string | null;
  item_type: string | null;
  status: string;
}

interface Props {
  tenantId: string;
  userId: string;
  inventoryItems: InventoryItem[];
  customers: Customer[];
  taxRate: number;
  businessName: string;
  hasStripe: boolean;
}

export default function POSWrapper({
  tenantId,
  userId,
  inventoryItems,
  customers,
  taxRate,
  businessName,
  hasStripe,
}: Props) {
  const { viewMode, currentLocationId, currentLocation, locations, setViewMode, setCurrentLocationId, hasMultipleLocations } = useLocation();

  // If user has multiple locations and is in "all locations" mode, prompt them to select one
  if (hasMultipleLocations && (viewMode === "all" || !currentLocationId)) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4">
        <div className="bg-white border border-amber-200 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-amber-50 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-amber-600" />
          </div>
          <h2 className="text-xl font-semibold text-stone-900 mb-2">Select a Location</h2>
          <p className="text-stone-500 mb-8">
            Please select a specific location to use the Point of Sale. Sales must be recorded at a single location.
          </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {locations.map((location) => (
              <button
                key={location.id}
                onClick={() => {
                  setViewMode("single");
                  setCurrentLocationId(location.id);
                }}
                className="flex items-center gap-3 p-4 bg-stone-50 border border-stone-200 rounded-xl hover:border-amber-400 hover:bg-amber-50 transition-all text-left group"
              >
                <div className="w-10 h-10 rounded-lg bg-white border border-stone-200 flex items-center justify-center group-hover:border-amber-300 group-hover:bg-amber-100 transition-colors">
                  <Building2 className="w-5 h-5 text-stone-400 group-hover:text-amber-600" />
                </div>
                <div>
                  <p className="font-medium text-stone-900">{location.name}</p>
                  <p className="text-xs text-stone-400 capitalize">{location.type}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <POSClient
      tenantId={tenantId}
      userId={userId}
      inventoryItems={inventoryItems}
      customers={customers}
      taxRate={taxRate}
      businessName={businessName}
      hasStripe={hasStripe}
    />
  );
}
