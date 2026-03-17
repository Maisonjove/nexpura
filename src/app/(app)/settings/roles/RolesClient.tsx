"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  Users, Shield, MapPin, ChevronRight, Check, X, 
  Building2, Eye, Edit3, ShoppingCart, Wrench, 
  BarChart2, DollarSign, Settings, UserCog
} from "lucide-react";
import { 
  updateMemberRole, 
  updateMemberPermissions, 
  updateMemberLocationAccess,
  updateMemberDefaultLocation,
  DEFAULT_PERMISSIONS,
  PermissionSet 
} from "./actions";

interface TeamMember {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: string;
  permissions: PermissionSet | null;
  allowed_location_ids: string[] | null;
  default_location_id: string | null;
  invite_accepted: boolean;
}

interface Location {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
}

interface Props {
  members: TeamMember[];
  locations: Location[];
  isOwnerOrManager: boolean;
  tenantId: string;
}

const ROLE_OPTIONS = [
  { value: "owner", label: "Owner", desc: "Full access to everything" },
  { value: "manager", label: "Manager", desc: "Manage team & daily operations" },
  { value: "salesperson", label: "Salesperson", desc: "POS, customers, sales" },
  { value: "workshop_jeweller", label: "Workshop Jeweller", desc: "Repairs, bespoke, inventory" },
  { value: "repair_technician", label: "Repair Technician", desc: "Repairs only" },
  { value: "inventory_manager", label: "Inventory Manager", desc: "Stock & inventory" },
  { value: "accountant", label: "Accountant", desc: "Reports, financials, EOD" },
  { value: "staff", label: "Staff", desc: "Basic POS & customer access" },
];

const PERMISSION_GROUPS = [
  {
    label: "View Access",
    icon: Eye,
    permissions: [
      { key: "canViewDashboard", label: "Dashboard" },
      { key: "canViewInventory", label: "Inventory" },
      { key: "canViewCustomers", label: "Customers" },
      { key: "canViewSales", label: "Sales" },
      { key: "canViewRepairs", label: "Repairs" },
      { key: "canViewBespoke", label: "Bespoke Jobs" },
      { key: "canViewReports", label: "Reports" },
      { key: "canViewFinancials", label: "Financials" },
    ],
  },
  {
    label: "Actions",
    icon: Edit3,
    permissions: [
      { key: "canCreateSales", label: "Create Sales" },
      { key: "canEditInventory", label: "Edit Inventory" },
      { key: "canManageCustomers", label: "Manage Customers" },
      { key: "canProcessRefunds", label: "Process Refunds" },
      { key: "canManageRepairs", label: "Manage Repairs" },
      { key: "canManageBespoke", label: "Manage Bespoke" },
      { key: "canCloseEOD", label: "Close End of Day" },
    ],
  },
  {
    label: "Admin",
    icon: Settings,
    permissions: [
      { key: "canManageTeam", label: "Manage Team" },
      { key: "canManageSettings", label: "Manage Settings" },
      { key: "canViewAllLocations", label: "View All Locations" },
    ],
  },
];

export default function RolesClient({ members, locations, isOwnerOrManager, tenantId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [activeTab, setActiveTab] = useState<"permissions" | "locations">("permissions");
  const [saveMsg, setSaveMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const hasMultipleLocations = locations.length > 1;

  function getMemberPermissions(member: TeamMember): PermissionSet {
    if (member.permissions) return member.permissions;
    return DEFAULT_PERMISSIONS[member.role] || DEFAULT_PERMISSIONS.staff;
  }

  async function handleRoleChange(memberId: string, role: string) {
    setSaveMsg(null);
    startTransition(async () => {
      const result = await updateMemberRole(memberId, role);
      if (result.error) {
        setSaveMsg({ type: "err", text: result.error });
      } else {
        setSaveMsg({ type: "ok", text: "Role updated" });
        router.refresh();
      }
    });
  }

  async function handlePermissionToggle(memberId: string, permKey: string, currentValue: boolean) {
    const member = members.find(m => m.id === memberId);
    if (!member) return;
    
    const currentPerms = getMemberPermissions(member);
    const newPerms = { ...currentPerms, [permKey]: !currentValue };
    
    startTransition(async () => {
      const result = await updateMemberPermissions(memberId, newPerms);
      if (result.error) {
        setSaveMsg({ type: "err", text: result.error });
      } else {
        router.refresh();
      }
    });
  }

  async function handleLocationToggle(memberId: string, locationId: string, currentAllowed: string[] | null) {
    let newAllowed: string[] | null;
    
    if (currentAllowed === null) {
      // Was "all locations", now restrict to just this one NOT selected
      newAllowed = locations.filter(l => l.id !== locationId).map(l => l.id);
    } else if (currentAllowed.includes(locationId)) {
      // Remove this location
      newAllowed = currentAllowed.filter(id => id !== locationId);
      if (newAllowed.length === 0) newAllowed = []; // Empty = no access
    } else {
      // Add this location
      newAllowed = [...currentAllowed, locationId];
      // If all locations now selected, set to null (all access)
      if (newAllowed.length === locations.length) newAllowed = null;
    }
    
    startTransition(async () => {
      const result = await updateMemberLocationAccess(memberId, newAllowed);
      if (result.error) {
        setSaveMsg({ type: "err", text: result.error });
      } else {
        router.refresh();
      }
    });
  }

  async function handleSetAllLocations(memberId: string) {
    startTransition(async () => {
      const result = await updateMemberLocationAccess(memberId, null);
      if (result.error) {
        setSaveMsg({ type: "err", text: result.error });
      } else {
        router.refresh();
      }
    });
  }

  async function handleDefaultLocationChange(memberId: string, locationId: string | null) {
    startTransition(async () => {
      const result = await updateMemberDefaultLocation(memberId, locationId);
      if (result.error) {
        setSaveMsg({ type: "err", text: result.error });
      } else {
        router.refresh();
      }
    });
  }

  function isLocationAllowed(member: TeamMember, locationId: string): boolean {
    if (member.allowed_location_ids === null) return true; // null = all locations
    return member.allowed_location_ids.includes(locationId);
  }

  return (
    <div className="max-w-6xl mx-auto py-10 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 text-sm text-stone-500 mb-2">
            <Link href="/settings" className="hover:text-stone-700">Settings</Link>
            <ChevronRight size={14} />
            <span className="text-stone-900">Roles & Permissions</span>
          </div>
          <h1 className="text-2xl font-semibold text-stone-900">Roles & Permissions</h1>
          <p className="text-stone-500 text-sm mt-1">Control what each team member can see and do</p>
        </div>
      </div>

      {saveMsg && (
        <div className={`mb-6 px-4 py-3 rounded-lg text-sm font-medium ${
          saveMsg.type === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
        }`}>
          {saveMsg.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Team Members List */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-stone-100 bg-stone-50">
              <h2 className="text-sm font-semibold text-stone-700 flex items-center gap-2">
                <Users size={14} />
                Team Members
              </h2>
            </div>
            <div className="divide-y divide-stone-100">
              {members.map(member => (
                <button
                  key={member.id}
                  onClick={() => setSelectedMember(member)}
                  className={`w-full px-4 py-3 text-left hover:bg-stone-50 transition-colors ${
                    selectedMember?.id === member.id ? "bg-amber-50 border-l-2 border-amber-500" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-stone-900">{member.name}</p>
                      <p className="text-xs text-stone-500">{member.email}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                      member.role === "owner" ? "bg-stone-800 text-white" :
                      member.role === "manager" ? "bg-amber-100 text-amber-700" :
                      "bg-stone-100 text-stone-600"
                    }`}>
                      {member.role.replace("_", " ")}
                    </span>
                  </div>
                  {!member.invite_accepted && (
                    <span className="text-[10px] text-amber-600 mt-1 block">Pending invite</span>
                  )}
                </button>
              ))}
              {members.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-stone-400">
                  No team members yet
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Member Details */}
        <div className="lg:col-span-2">
          {selectedMember ? (
            <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
              {/* Member Header */}
              <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-stone-900">{selectedMember.name}</h2>
                  <p className="text-sm text-stone-500">{selectedMember.email}</p>
                </div>
                {isOwnerOrManager && selectedMember.role !== "owner" && (
                  <select
                    value={selectedMember.role}
                    onChange={(e) => handleRoleChange(selectedMember.id, e.target.value)}
                    disabled={isPending}
                    className="text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-600"
                  >
                    {ROLE_OPTIONS.filter(r => r.value !== "owner").map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Tabs */}
              <div className="border-b border-stone-100">
                <div className="flex">
                  <button
                    onClick={() => setActiveTab("permissions")}
                    className={`px-6 py-3 text-sm font-medium transition-colors ${
                      activeTab === "permissions" 
                        ? "text-amber-700 border-b-2 border-amber-600" 
                        : "text-stone-500 hover:text-stone-700"
                    }`}
                  >
                    <Shield size={14} className="inline mr-2" />
                    Permissions
                  </button>
                  {hasMultipleLocations && (
                    <button
                      onClick={() => setActiveTab("locations")}
                      className={`px-6 py-3 text-sm font-medium transition-colors ${
                        activeTab === "locations" 
                          ? "text-amber-700 border-b-2 border-amber-600" 
                          : "text-stone-500 hover:text-stone-700"
                      }`}
                    >
                      <MapPin size={14} className="inline mr-2" />
                      Store Access
                    </button>
                  )}
                </div>
              </div>

              {/* Tab Content */}
              <div className="p-6">
                {activeTab === "permissions" && (
                  <div className="space-y-6">
                    {PERMISSION_GROUPS.map(group => {
                      const Icon = group.icon;
                      const perms = getMemberPermissions(selectedMember);
                      return (
                        <div key={group.label}>
                          <h3 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <Icon size={12} />
                            {group.label}
                          </h3>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {group.permissions.map(perm => {
                              const isEnabled = perms[perm.key as keyof PermissionSet] as boolean;
                              const canEdit = isOwnerOrManager && selectedMember.role !== "owner";
                              return (
                                <button
                                  key={perm.key}
                                  onClick={() => canEdit && handlePermissionToggle(selectedMember.id, perm.key, isEnabled)}
                                  disabled={!canEdit || isPending}
                                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                                    isEnabled 
                                      ? "bg-green-50 text-green-700 border border-green-200" 
                                      : "bg-stone-50 text-stone-400 border border-stone-200"
                                  } ${canEdit ? "hover:opacity-80 cursor-pointer" : "cursor-default"}`}
                                >
                                  {isEnabled ? <Check size={14} /> : <X size={14} />}
                                  {perm.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {activeTab === "locations" && hasMultipleLocations && (
                  <div className="space-y-6">
                    {/* All Locations Toggle */}
                    <div className="flex items-center justify-between p-4 bg-stone-50 rounded-xl">
                      <div>
                        <p className="text-sm font-medium text-stone-900">Access to all stores</p>
                        <p className="text-xs text-stone-500">Can view and work at any location</p>
                      </div>
                      <button
                        onClick={() => handleSetAllLocations(selectedMember.id)}
                        disabled={!isOwnerOrManager || selectedMember.role === "owner" || isPending}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          selectedMember.allowed_location_ids === null
                            ? "bg-green-600 text-white"
                            : "bg-stone-200 text-stone-600 hover:bg-stone-300"
                        }`}
                      >
                        {selectedMember.allowed_location_ids === null ? "✓ Enabled" : "Enable"}
                      </button>
                    </div>

                    {/* Individual Locations */}
                    <div>
                      <h3 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-3">
                        Or select specific stores
                      </h3>
                      <div className="space-y-2">
                        {locations.map(location => {
                          const isAllowed = isLocationAllowed(selectedMember, location.id);
                          const isDefault = selectedMember.default_location_id === location.id;
                          const canEdit = isOwnerOrManager && selectedMember.role !== "owner";
                          return (
                            <div
                              key={location.id}
                              className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${
                                isAllowed ? "bg-white border-green-200" : "bg-stone-50 border-stone-200"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                  isAllowed ? "bg-green-100" : "bg-stone-100"
                                }`}>
                                  <Building2 size={18} className={isAllowed ? "text-green-600" : "text-stone-400"} />
                                </div>
                                <div>
                                  <p className={`text-sm font-medium ${isAllowed ? "text-stone-900" : "text-stone-500"}`}>
                                    {location.name}
                                    {isDefault && (
                                      <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">
                                        DEFAULT
                                      </span>
                                    )}
                                  </p>
                                  <p className="text-xs text-stone-400 capitalize">{location.type}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {isAllowed && !isDefault && canEdit && (
                                  <button
                                    onClick={() => handleDefaultLocationChange(selectedMember.id, location.id)}
                                    className="text-xs text-amber-600 hover:text-amber-700 font-medium"
                                  >
                                    Set Default
                                  </button>
                                )}
                                <button
                                  onClick={() => canEdit && handleLocationToggle(selectedMember.id, location.id, selectedMember.allowed_location_ids)}
                                  disabled={!canEdit || isPending}
                                  className={`w-12 h-6 rounded-full transition-colors relative ${
                                    isAllowed ? "bg-green-500" : "bg-stone-300"
                                  } ${canEdit ? "cursor-pointer" : "cursor-default opacity-60"}`}
                                >
                                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                                    isAllowed ? "right-1" : "left-1"
                                  }`} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-stone-200 rounded-xl p-12 text-center">
              <UserCog size={48} className="mx-auto text-stone-300 mb-4" />
              <h3 className="text-lg font-medium text-stone-700 mb-2">Select a team member</h3>
              <p className="text-sm text-stone-500">Click on a team member to view and edit their permissions</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
