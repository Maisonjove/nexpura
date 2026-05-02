"use client";

import { useState, useTransition , Suspense } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { 
  Users, Shield, MapPin, ChevronRight, Check, X, 
  Building2, Eye, Edit3, Settings, UserCog, Plus,
  Mail, Trash2, RefreshCw, Loader2, Phone, MessageSquare, Bell
} from "lucide-react";
import { 
  updateMemberRole, 
  updateMemberPermissions, 
  updateMemberLocationAccess,
  updateMemberDefaultLocation,
  inviteTeamMember,
  resendInvite,
  removeMember,
  updateMemberPhone,
  updateMemberNotifications,
  updateMemberWhatsAppEnabled,
} from "./actions";
import {
  DEFAULT_PERMISSIONS,
  type PermissionSet,
  type NotificationPreferences,
} from "./_constants";

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
  phone_number: string | null;
  whatsapp_notifications_enabled: boolean;
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

// Notifications Tab Component
function NotificationsTab({ 
  member, 
  canEdit, 
  isPending,
  onUpdate 
}: { 
  member: TeamMember; 
  canEdit: boolean; 
  isPending: boolean;
  onUpdate: (key: string, value: boolean) => void;
}) {
  // Get notification preferences from permissions object
  const perms = (member.permissions as unknown as Record<string, unknown>) || {};
  const notifs = (perms.notifications || {}) as Record<string, boolean>;
  
  const NOTIFICATION_OPTIONS = [
    { key: "notifyNewRepairs", label: "New repair jobs", desc: "Get notified when a new repair is created" },
    { key: "notifyNewBespoke", label: "New bespoke/custom orders", desc: "Get notified when a new custom order is placed" },
    { key: "notifyRepairReady", label: "Repairs ready for collection", desc: "Get notified when repairs are marked ready" },
    { key: "notifyBespokeReady", label: "Bespoke jobs ready", desc: "Get notified when custom orders are complete" },
    { key: "notifyNewSales", label: "New sales", desc: "Get notified when a sale is made" },
  ];

  return (
    <div className="space-y-6">
      {/* WhatsApp Master Toggle */}
      <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <MessageSquare size={20} className="text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-stone-900">WhatsApp Notifications</p>
              <p className="text-xs text-stone-500">
                {member.phone_number 
                  ? `Sending to ${member.phone_number}` 
                  : "Add phone number to enable"}
              </p>
            </div>
          </div>
          <button
            onClick={() => canEdit && member.phone_number && onUpdate("whatsapp_enabled", !member.whatsapp_notifications_enabled)}
            disabled={!canEdit || !member.phone_number || isPending}
            className={`w-12 h-6 rounded-full transition-colors relative ${
              member.whatsapp_notifications_enabled && member.phone_number ? "bg-green-500" : "bg-stone-300"
            } ${canEdit && member.phone_number ? "cursor-pointer" : "cursor-default opacity-60"}`}
          >
            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
              member.whatsapp_notifications_enabled && member.phone_number ? "right-1" : "left-1"
            }`} />
          </button>
        </div>
      </div>

      {/* Individual Notification Toggles */}
      <div>
        <h3 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Bell size={12} />
          Notification Triggers
        </h3>
        <div className="space-y-2">
          {NOTIFICATION_OPTIONS.map(opt => {
            const isEnabled = notifs[opt.key] ?? true; // Default to true
            return (
              <div
                key={opt.key}
                className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${
                  isEnabled ? "bg-white border-amber-200" : "bg-stone-50 border-stone-200"
                }`}
              >
                <div>
                  <p className={`text-sm font-medium ${isEnabled ? "text-stone-900" : "text-stone-500"}`}>
                    {opt.label}
                  </p>
                  <p className="text-xs text-stone-400">{opt.desc}</p>
                </div>
                <button
                  onClick={() => canEdit && onUpdate(opt.key, !isEnabled)}
                  disabled={!canEdit || isPending}
                  className={`w-12 h-6 rounded-full transition-colors relative ${
                    isEnabled ? "bg-amber-500" : "bg-stone-300"
                  } ${canEdit ? "cursor-pointer" : "cursor-default opacity-60"}`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    isEnabled ? "right-1" : "left-1"
                  }`} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-stone-400 text-center">
        Notifications will be sent via WhatsApp if enabled, or email otherwise.
      </p>
    </div>
  );
}

function RolesClientInner({ members, locations, isOwnerOrManager, tenantId }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const activeTab = (searchParams.get('tab') || 'permissions') as "permissions" | "locations" | "notifications";
  const [saveMsg, setSaveMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  
  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteRole, setInviteRole] = useState("staff");
  const [inviteLocations, setInviteLocations] = useState<string[] | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  
  // Edit phone modal state
  const [editingPhoneMember, setEditingPhoneMember] = useState<TeamMember | null>(null);
  const [editPhone, setEditPhone] = useState("");

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

  async function handleInvite() {
    if (!inviteName.trim() || !inviteEmail.trim()) {
      setSaveMsg({ type: "err", text: "Name and email are required" });
      return;
    }
    
    startTransition(async () => {
      const result = await inviteTeamMember(
        inviteName.trim(),
        inviteEmail.trim(),
        inviteRole,
        inviteLocations,
        invitePhone.trim() || null
      );
      if (result.error) {
        setSaveMsg({ type: "err", text: result.error });
      } else {
        setInviteSuccess(true);
        setTimeout(() => {
          setShowInviteModal(false);
          setInviteName("");
          setInviteEmail("");
          setInvitePhone("");
          setInviteRole("staff");
          setInviteLocations(null);
          setInviteSuccess(false);
          router.refresh();
        }, 2000);
      }
    });
  }

  async function handleUpdatePhone(memberId: string) {
    startTransition(async () => {
      const result = await updateMemberPhone(memberId, editPhone.trim() || null);
      if (result.error) {
        setSaveMsg({ type: "err", text: result.error });
      } else {
        setSaveMsg({ type: "ok", text: "Phone number updated" });
        setEditingPhoneMember(null);
        setEditPhone("");
        router.refresh();
      }
    });
  }

  async function handleResendInvite(memberId: string) {
    startTransition(async () => {
      const result = await resendInvite(memberId);
      if (result.error) {
        setSaveMsg({ type: "err", text: result.error });
      } else {
        setSaveMsg({ type: "ok", text: "Invitation resent!" });
      }
    });
  }

  async function handleRemoveMember(memberId: string) {
    if (!confirm("Are you sure you want to remove this team member?")) return;
    
    startTransition(async () => {
      const result = await removeMember(memberId);
      if (result.error) {
        setSaveMsg({ type: "err", text: result.error });
      } else {
        setSelectedMember(null);
        router.refresh();
      }
    });
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
        {isOwnerOrManager && (
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-2 bg-stone-800 hover:bg-stone-900 text-white px-4 py-2.5 rounded-lg font-medium transition-colors"
          >
            <Plus size={18} />
            Invite Team Member
          </button>
        )}
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
              <div className="px-6 py-4 border-b border-stone-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-stone-900">{selectedMember.name}</h2>
                    <p className="text-sm text-stone-500">{selectedMember.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {selectedMember.phone_number ? (
                        <span className="text-xs text-stone-500 flex items-center gap-1">
                          <Phone size={10} />
                          {selectedMember.phone_number}
                          {selectedMember.whatsapp_notifications_enabled && (
                            <MessageSquare size={10} className="text-green-500 ml-1" />
                          )}
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingPhoneMember(selectedMember);
                            setEditPhone("");
                          }}
                          className="text-xs text-amber-600 hover:text-amber-700 flex items-center gap-1"
                        >
                          <Phone size={10} />
                          Add phone for WhatsApp
                        </button>
                      )}
                      {selectedMember.phone_number && isOwnerOrManager && (
                        <button
                          onClick={() => {
                            setEditingPhoneMember(selectedMember);
                            setEditPhone(selectedMember.phone_number || "");
                          }}
                          className="text-xs text-stone-400 hover:text-stone-600"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isOwnerOrManager && selectedMember.role !== "owner" && (
                      <select
                        value={selectedMember.role}
                        onChange={(e) => handleRoleChange(selectedMember.id, e.target.value)}
                        disabled={isPending}
                        className="text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-nexpura-bronze"
                      >
                        {ROLE_OPTIONS.filter(r => r.value !== "owner").map(r => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
                {/* Action buttons for pending invites or removal */}
                {isOwnerOrManager && selectedMember.role !== "owner" && (
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-stone-100">
                    {!selectedMember.invite_accepted && (
                      <button
                        onClick={() => handleResendInvite(selectedMember.id)}
                        disabled={isPending}
                        className="flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-700 font-medium px-3 py-1.5 bg-amber-50 rounded-lg"
                      >
                        {isPending ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                        Resend Invite
                      </button>
                    )}
                    <button
                      onClick={() => handleRemoveMember(selectedMember.id)}
                      disabled={isPending}
                      className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 font-medium px-3 py-1.5 bg-red-50 rounded-lg ml-auto"
                    >
                      <Trash2 size={12} />
                      Remove
                    </button>
                  </div>
                )}
              </div>

              {/* Tabs */}
              <div className="border-b border-stone-100">
                <div className="flex">
                  <button
                    onClick={() => router.replace(pathname)}
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
                      onClick={() => router.replace(pathname + '?tab=locations')}
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
                  <button
                    onClick={() => router.replace(pathname + '?tab=notifications')}
                    className={`px-6 py-3 text-sm font-medium transition-colors ${
                      activeTab === "notifications" 
                        ? "text-amber-700 border-b-2 border-amber-600" 
                        : "text-stone-500 hover:text-stone-700"
                    }`}
                  >
                    <Bell size={14} className="inline mr-2" />
                    Notifications
                  </button>
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

                {activeTab === "notifications" && (
                  <NotificationsTab
                    member={selectedMember}
                    canEdit={isOwnerOrManager && selectedMember.role !== "owner"}
                    isPending={isPending}
                    onUpdate={(key, value) => {
                      startTransition(async () => {
                        if (key === "whatsapp_enabled") {
                          const result = await updateMemberWhatsAppEnabled(selectedMember.id, value as boolean);
                          if (result.error) setSaveMsg({ type: "err", text: result.error });
                          else router.refresh();
                        } else {
                          const result = await updateMemberNotifications(selectedMember.id, { [key]: value });
                          if (result.error) setSaveMsg({ type: "err", text: result.error });
                          else router.refresh();
                        }
                      });
                    }}
                  />
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

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
            {inviteSuccess ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check size={32} className="text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-stone-900 mb-2">Invitation Sent!</h3>
                <p className="text-stone-500 text-sm">
                  An email has been sent to {inviteEmail} with instructions to join your team.
                </p>
              </div>
            ) : (
              <>
                <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-stone-900">Invite Team Member</h3>
                  <button onClick={() => setShowInviteModal(false)} className="text-stone-400 hover:text-stone-600">
                    <X size={20} />
                  </button>
                </div>
                <div className="p-6 space-y-4">
                  {/* Name */}
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">Full Name</label>
                    <input
                      type="text"
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      placeholder="John Smith"
                      className="w-full px-4 py-2.5 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-nexpura-bronze"
                    />
                  </div>
                  
                  {/* Email */}
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">Email Address</label>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="john@example.com"
                      className="w-full px-4 py-2.5 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-nexpura-bronze"
                    />
                  </div>

                  {/* Phone (optional) */}
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">
                      Phone Number <span className="text-stone-400 font-normal">(optional)</span>
                    </label>
                    <input
                      type="tel"
                      value={invitePhone}
                      onChange={(e) => setInvitePhone(e.target.value)}
                      placeholder="+44 7700 900000"
                      className="w-full px-4 py-2.5 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-nexpura-bronze"
                    />
                    <p className="text-xs text-stone-400 mt-1">For WhatsApp task notifications</p>
                  </div>
                  
                  {/* Role */}
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">Role</label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="w-full px-4 py-2.5 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-nexpura-bronze"
                    >
                      {ROLE_OPTIONS.filter(r => r.value !== "owner").map(r => (
                        <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>
                      ))}
                    </select>
                  </div>

                  {/* Store Access (if multiple locations) */}
                  {hasMultipleLocations && (
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1.5">Store Access</label>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 p-3 bg-stone-50 rounded-lg cursor-pointer hover:bg-stone-100">
                          <input
                            type="radio"
                            name="locationAccess"
                            checked={inviteLocations === null}
                            onChange={() => setInviteLocations(null)}
                            className="text-amber-600 focus:ring-nexpura-bronze"
                          />
                          <span className="text-sm text-stone-700">All stores</span>
                        </label>
                        <label className="flex items-center gap-2 p-3 bg-stone-50 rounded-lg cursor-pointer hover:bg-stone-100">
                          <input
                            type="radio"
                            name="locationAccess"
                            checked={inviteLocations !== null}
                            onChange={() => setInviteLocations([])}
                            className="text-amber-600 focus:ring-nexpura-bronze"
                          />
                          <span className="text-sm text-stone-700">Specific stores only</span>
                        </label>
                        {inviteLocations !== null && (
                          <div className="ml-6 space-y-2 pt-2">
                            {locations.map(loc => (
                              <label key={loc.id} className="flex items-center gap-2 p-2 bg-white rounded-lg cursor-pointer hover:bg-stone-50 border border-stone-200">
                                <input
                                  type="checkbox"
                                  checked={inviteLocations.includes(loc.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setInviteLocations([...inviteLocations, loc.id]);
                                    } else {
                                      setInviteLocations(inviteLocations.filter(id => id !== loc.id));
                                    }
                                  }}
                                  className="text-amber-600 focus:ring-nexpura-bronze"
                                />
                                <span className="text-sm text-stone-700">{loc.name}</span>
                                <span className="text-xs text-stone-400 capitalize">({loc.type})</span>
                              </label>
                            ))}
                            {inviteLocations.length === 0 && (
                              <p className="text-xs text-amber-600">Select at least one store</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div className="px-6 py-4 bg-stone-50 border-t border-stone-100 flex justify-end gap-3">
                  <button
                    onClick={() => setShowInviteModal(false)}
                    className="px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleInvite}
                    disabled={isPending || !inviteName.trim() || !inviteEmail.trim() || (hasMultipleLocations && inviteLocations !== null && inviteLocations.length === 0)}
                    className="flex items-center gap-2 bg-stone-800 hover:bg-stone-900 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
                  >
                    {isPending ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail size={16} />
                        Send Invitation
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Edit Phone Modal */}
      {editingPhoneMember && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-stone-900">
                {editingPhoneMember.phone_number ? "Edit Phone Number" : "Add Phone Number"}
              </h3>
              <button onClick={() => setEditingPhoneMember(null)} className="text-stone-400 hover:text-stone-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">
                  Phone Number for {editingPhoneMember.name}
                </label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="+44 7700 900000"
                  className="w-full px-4 py-2.5 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-nexpura-bronze"
                />
                <p className="text-xs text-stone-400 mt-1">
                  Include country code for WhatsApp notifications
                </p>
              </div>
            </div>
            <div className="px-6 py-4 bg-stone-50 border-t border-stone-100 flex justify-between gap-3">
              {editingPhoneMember.phone_number && (
                <button
                  onClick={() => {
                    handleUpdatePhone(editingPhoneMember.id);
                    setEditPhone("");
                  }}
                  disabled={isPending}
                  className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700"
                >
                  Remove Number
                </button>
              )}
              <div className="flex gap-3 ml-auto">
                <button
                  onClick={() => setEditingPhoneMember(null)}
                  className="px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-800"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleUpdatePhone(editingPhoneMember.id)}
                  disabled={isPending || !editPhone.trim()}
                  className="flex items-center gap-2 bg-stone-800 hover:bg-stone-900 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
                >
                  {isPending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Phone size={16} />
                  )}
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default function RolesClient(props: Parameters<typeof RolesClientInner>[0]) {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>}>
      <RolesClientInner {...props} />
    </Suspense>
  );
}
