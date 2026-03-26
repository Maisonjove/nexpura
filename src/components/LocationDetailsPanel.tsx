"use client";

import { useState } from "react";
import { Building2, MapPin, Phone, Mail, Clock, ChevronDown, ChevronUp, X } from "lucide-react";
import { useLocation } from "@/contexts/LocationContext";

interface LocationDetails {
  id: string;
  name: string;
  type: string;
  address_line1: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  operating_hours: Record<string, { open: string; close: string; closed?: boolean }> | null;
  is_active: boolean;
}

interface Props {
  locationDetails: LocationDetails | null;
  isLoading?: boolean;
  onClose?: () => void;
  compact?: boolean;
}

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DAY_LABELS: Record<string, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

export default function LocationDetailsPanel({ locationDetails, isLoading, onClose, compact = false }: Props) {
  const [showHours, setShowHours] = useState(false);
  const { viewMode } = useLocation();

  // Don't show in "all locations" view
  if (viewMode === "all" || !locationDetails) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="bg-white border border-stone-200 rounded-xl p-4 animate-pulse">
        <div className="h-5 bg-stone-100 rounded w-32 mb-2" />
        <div className="h-4 bg-stone-100 rounded w-48" />
      </div>
    );
  }

  const formatAddress = () => {
    const parts = [
      locationDetails.address_line1,
      locationDetails.suburb,
      locationDetails.state,
      locationDetails.postcode,
      locationDetails.country,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : null;
  };

  const address = formatAddress();
  const hasOperatingHours = locationDetails.operating_hours && Object.keys(locationDetails.operating_hours).length > 0;

  if (compact) {
    return (
      <div className="bg-gradient-to-r from-amber-50 to-white border border-amber-200/50 rounded-xl px-4 py-3 mb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Building2 size={18} className="text-amber-700" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-stone-900 truncate">{locationDetails.name}</h3>
              <p className="text-xs text-stone-500 capitalize">{locationDetails.type}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-stone-500 flex-shrink-0">
            {locationDetails.phone && (
              <a href={`tel:${locationDetails.phone}`} className="flex items-center gap-1 hover:text-amber-700">
                <Phone size={12} />
                <span className="hidden sm:inline">{locationDetails.phone}</span>
              </a>
            )}
            {locationDetails.email && (
              <a href={`mailto:${locationDetails.email}`} className="flex items-center gap-1 hover:text-amber-700">
                <Mail size={12} />
                <span className="hidden sm:inline truncate max-w-[120px]">{locationDetails.email}</span>
              </a>
            )}
            {onClose && (
              <button onClick={onClose} className="p-1 hover:bg-stone-100 rounded">
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between bg-gradient-to-r from-amber-50 to-white">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
            <Building2 size={20} className="text-amber-700" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-stone-900">{locationDetails.name}</h2>
            <p className="text-sm text-stone-500 capitalize">{locationDetails.type}</p>
          </div>
        </div>
        {onClose && (
          <button 
            onClick={onClose}
            className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
          >
            <X size={16} className="text-stone-400" />
          </button>
        )}
      </div>

      {/* Details */}
      <div className="p-5 space-y-4">
        {/* Address */}
        {address && (
          <div className="flex items-start gap-3">
            <MapPin size={16} className="text-stone-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-stone-400 uppercase mb-1">Address</p>
              <p className="text-sm text-stone-700">{address}</p>
            </div>
          </div>
        )}

        {/* Contact */}
        <div className="flex flex-wrap gap-6">
          {locationDetails.phone && (
            <div className="flex items-start gap-3">
              <Phone size={16} className="text-stone-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-stone-400 uppercase mb-1">Phone</p>
                <a href={`tel:${locationDetails.phone}`} className="text-sm text-amber-700 hover:underline">
                  {locationDetails.phone}
                </a>
              </div>
            </div>
          )}
          {locationDetails.email && (
            <div className="flex items-start gap-3">
              <Mail size={16} className="text-stone-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-stone-400 uppercase mb-1">Email</p>
                <a href={`mailto:${locationDetails.email}`} className="text-sm text-amber-700 hover:underline">
                  {locationDetails.email}
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Operating Hours */}
        {hasOperatingHours && (
          <div className="border-t border-stone-100 pt-4">
            <button
              onClick={() => setShowHours(!showHours)}
              className="flex items-center gap-2 text-sm font-medium text-stone-700 hover:text-stone-900 transition-colors"
            >
              <Clock size={16} className="text-stone-400" />
              <span>Operating Hours</span>
              {showHours ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showHours && (
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                {DAYS.map((day) => {
                  const hours = locationDetails.operating_hours?.[day];
                  return (
                    <div key={day} className="px-3 py-2 bg-stone-50 rounded-lg">
                      <p className="text-xs font-medium text-stone-500">{DAY_LABELS[day]}</p>
                      {hours?.closed ? (
                        <p className="text-xs text-red-500">Closed</p>
                      ) : hours ? (
                        <p className="text-xs text-stone-700">{hours.open} - {hours.close}</p>
                      ) : (
                        <p className="text-xs text-stone-400">Not set</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* No address or contact info */}
        {!address && !locationDetails.phone && !locationDetails.email && (
          <p className="text-sm text-stone-400 italic">
            No contact details configured for this location.
          </p>
        )}
      </div>
    </div>
  );
}
