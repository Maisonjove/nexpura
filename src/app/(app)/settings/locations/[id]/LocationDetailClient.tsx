"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  Building2, 
  MapPin, 
  Phone, 
  Mail, 
  Clock, 
  Users, 
  Edit2, 
  Save,
  X,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { updateLocation } from "../actions";

interface Location {
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

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  allowed_location_ids: string[] | null;
}

interface Props {
  location: Location;
  assignedMembers: TeamMember[];
  isOwner: boolean;
}

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DAY_LABELS: Record<string, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  manager: "Manager",
  salesperson: "Salesperson",
  workshop_jeweller: "Workshop Jeweller",
  repair_technician: "Repair Technician",
  inventory_manager: "Inventory Manager",
  accountant: "Accountant",
  staff: "Staff",
  technician: "Technician",
};

export default function LocationDetailClient({ location, assignedMembers, isOwner }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [showHours, setShowHours] = useState(true);
  const [showTeam, setShowTeam] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: location.name,
    type: location.type,
    address_line1: location.address_line1 || "",
    suburb: location.suburb || "",
    state: location.state || "",
    postcode: location.postcode || "",
    country: location.country || "",
    phone: location.phone || "",
    email: location.email || "",
  });

  const [hours, setHours] = useState<Record<string, { open: string; close: string; closed: boolean }>>(
    DAYS.reduce((acc, day) => {
      const existing = location.operating_hours?.[day];
      acc[day] = {
        open: existing?.open || "09:00",
        close: existing?.close || "17:00",
        closed: existing?.closed || false,
      };
      return acc;
    }, {} as Record<string, { open: string; close: string; closed: boolean }>)
  );

  const formatAddress = () => {
    const parts = [
      location.address_line1,
      location.suburb,
      location.state,
      location.postcode,
      location.country,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : null;
  };

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await updateLocation(location.id, {
        ...form,
        operating_hours: hours,
      });
      if (result.error) {
        setError(result.error);
      } else {
        setIsEditing(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Main Details Card */}
      <div className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-gradient-to-r from-amber-50 to-white">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-amber-100 flex items-center justify-center">
              <Building2 size={24} className="text-amber-700" />
            </div>
            <div>
              {isEditing ? (
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="text-xl font-semibold text-stone-900 border border-stone-200 rounded-lg px-3 py-1 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              ) : (
                <h2 className="text-xl font-semibold text-stone-900">{location.name}</h2>
              )}
              <p className="text-sm text-stone-500 capitalize">{location.type}</p>
            </div>
          </div>
          {isOwner && (
            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
                  >
                    <X size={18} />
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isPending}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-700 text-white text-sm font-medium rounded-lg hover:bg-amber-800 disabled:opacity-50 transition-colors"
                  >
                    <Save size={14} />
                    {isPending ? "Saving..." : "Save"}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2 px-3 py-2 text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
                >
                  <Edit2 size={14} />
                  <span className="text-sm">Edit</span>
                </button>
              )}
            </div>
          )}
        </div>

        <div className="p-6 space-y-6">
          {/* Address */}
          <div className="flex items-start gap-4">
            <MapPin size={18} className="text-stone-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-medium text-stone-400 uppercase mb-2">Address</p>
              {isEditing ? (
                <div className="space-y-3">
                  <input
                    placeholder="Street Address"
                    value={form.address_line1}
                    onChange={(e) => setForm({ ...form, address_line1: e.target.value })}
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      placeholder="City / Suburb"
                      value={form.suburb}
                      onChange={(e) => setForm({ ...form, suburb: e.target.value })}
                      className="border border-stone-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                    <input
                      placeholder="State / Province"
                      value={form.state}
                      onChange={(e) => setForm({ ...form, state: e.target.value })}
                      className="border border-stone-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      placeholder="Postcode / ZIP"
                      value={form.postcode}
                      onChange={(e) => setForm({ ...form, postcode: e.target.value })}
                      className="border border-stone-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                    <input
                      placeholder="Country"
                      value={form.country}
                      onChange={(e) => setForm({ ...form, country: e.target.value })}
                      className="border border-stone-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-stone-700">
                  {formatAddress() || <span className="text-stone-400 italic">No address set</span>}
                </p>
              )}
            </div>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-start gap-4">
              <Phone size={18} className="text-stone-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-medium text-stone-400 uppercase mb-2">Phone</p>
                {isEditing ? (
                  <input
                    placeholder="+61 2 9000 0000"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                ) : (
                  <p className="text-sm text-stone-700">
                    {location.phone ? (
                      <a href={`tel:${location.phone}`} className="text-amber-700 hover:underline">
                        {location.phone}
                      </a>
                    ) : (
                      <span className="text-stone-400 italic">Not set</span>
                    )}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-4">
              <Mail size={18} className="text-stone-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-medium text-stone-400 uppercase mb-2">Email</p>
                {isEditing ? (
                  <input
                    type="email"
                    placeholder="store@example.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                ) : (
                  <p className="text-sm text-stone-700">
                    {location.email ? (
                      <a href={`mailto:${location.email}`} className="text-amber-700 hover:underline">
                        {location.email}
                      </a>
                    ) : (
                      <span className="text-stone-400 italic">Not set</span>
                    )}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Operating Hours */}
      <div className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
        <button
          onClick={() => setShowHours(!showHours)}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-stone-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Clock size={18} className="text-stone-400" />
            <h3 className="font-semibold text-stone-900">Operating Hours</h3>
          </div>
          {showHours ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        {showHours && (
          <div className="px-6 pb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {DAYS.map((day) => (
                <div 
                  key={day} 
                  className={`px-4 py-3 rounded-lg ${
                    hours[day].closed ? "bg-stone-100" : "bg-amber-50"
                  }`}
                >
                  <p className="text-xs font-semibold text-stone-600 mb-2">{DAY_LABELS[day]}</p>
                  {isEditing ? (
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={hours[day].closed}
                          onChange={(e) => setHours({
                            ...hours,
                            [day]: { ...hours[day], closed: e.target.checked }
                          })}
                          className="rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                        />
                        <span className="text-xs text-stone-500">Closed</span>
                      </label>
                      {!hours[day].closed && (
                        <div className="flex items-center gap-1">
                          <input
                            type="time"
                            value={hours[day].open}
                            onChange={(e) => setHours({
                              ...hours,
                              [day]: { ...hours[day], open: e.target.value }
                            })}
                            className="text-xs border border-stone-200 rounded px-2 py-1 w-20"
                          />
                          <span className="text-stone-400">-</span>
                          <input
                            type="time"
                            value={hours[day].close}
                            onChange={(e) => setHours({
                              ...hours,
                              [day]: { ...hours[day], close: e.target.value }
                            })}
                            className="text-xs border border-stone-200 rounded px-2 py-1 w-20"
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className={`text-sm ${hours[day].closed ? "text-red-600" : "text-stone-700"}`}>
                      {hours[day].closed ? "Closed" : `${hours[day].open} - ${hours[day].close}`}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Team Members */}
      <div className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
        <button
          onClick={() => setShowTeam(!showTeam)}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-stone-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Users size={18} className="text-stone-400" />
            <h3 className="font-semibold text-stone-900">Team Members</h3>
            <span className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full">
              {assignedMembers.length}
            </span>
          </div>
          {showTeam ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        {showTeam && (
          <div className="px-6 pb-6">
            {assignedMembers.length === 0 ? (
              <div className="text-center py-6 text-stone-400">
                <Users size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">No team members assigned to this location</p>
                <Link 
                  href="/settings/team"
                  className="text-xs text-amber-700 hover:underline mt-2 inline-block"
                >
                  Manage team assignments →
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-stone-100">
                {assignedMembers.map((member) => (
                  <div key={member.id} className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center">
                        <span className="text-sm font-medium text-stone-600">
                          {member.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-stone-900">{member.name}</p>
                        <p className="text-xs text-stone-500">{member.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-stone-100 text-stone-600 px-2 py-1 rounded-full">
                        {ROLE_LABELS[member.role] || member.role}
                      </span>
                      {member.allowed_location_ids === null && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">
                          All locations
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
