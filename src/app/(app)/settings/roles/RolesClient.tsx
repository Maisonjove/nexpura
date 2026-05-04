"use client";

import { useState, useTransition, Suspense, Fragment } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  UsersIcon,
  ShieldCheckIcon,
  MapPinIcon,
  CheckIcon,
  XMarkIcon,
  BuildingOffice2Icon,
  EyeIcon,
  PencilSquareIcon,
  Cog6ToothIcon,
  UserCircleIcon,
  PlusIcon,
  EnvelopeIcon,
  TrashIcon,
  ArrowPathIcon,
  PhoneIcon,
  ChatBubbleLeftRightIcon,
  BellIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
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
    icon: EyeIcon,
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
    icon: PencilSquareIcon,
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
    icon: Cog6ToothIcon,
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
  onUpdate,
}: {
  member: TeamMember;
  canEdit: boolean;
  isPending: boolean;
  onUpdate: (key: string, value: boolean) => void;
}) {
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
    <div className="space-y-8">
      {/* WhatsApp Master Toggle */}
      <div className="border border-stone-200 rounded-2xl p-5 bg-stone-50/50">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            <ChatBubbleLeftRightIcon className="w-5 h-5 text-stone-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="font-serif text-base text-stone-900 tracking-tight">WhatsApp Notifications</p>
              <p className="text-sm text-stone-500 mt-1 leading-relaxed">
                {member.phone_number
                  ? `Sending to ${member.phone_number}`
                  : "Add a phone number to enable WhatsApp delivery"}
              </p>
            </div>
          </div>
          <button
            onClick={() => canEdit && member.phone_number && onUpdate("whatsapp_enabled", !member.whatsapp_notifications_enabled)}
            disabled={!canEdit || !member.phone_number || isPending}
            className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${
              member.whatsapp_notifications_enabled && member.phone_number ? "bg-nexpura-bronze" : "bg-stone-300"
            } ${canEdit && member.phone_number ? "cursor-pointer" : "cursor-default opacity-60"}`}
          >
            <span
              className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                member.whatsapp_notifications_enabled && member.phone_number ? "right-1" : "left-1"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Individual Notification Toggles */}
      <div>
        <p className="text-xs uppercase tracking-luxury text-stone-500 mb-4 flex items-center gap-2">
          <BellIcon className="w-3.5 h-3.5" />
          Notification Triggers
        </p>
        <div className="space-y-2">
          {NOTIFICATION_OPTIONS.map((opt) => {
            const isEnabled = notifs[opt.key] ?? true;
            return (
              <div
                key={opt.key}
                className="flex items-center justify-between gap-4 p-4 rounded-xl border border-stone-200 bg-white"
              >
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${isEnabled ? "text-stone-900" : "text-stone-500"}`}>
                    {opt.label}
                  </p>
                  <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">{opt.desc}</p>
                </div>
                <button
                  onClick={() => canEdit && onUpdate(opt.key, !isEnabled)}
                  disabled={!canEdit || isPending}
                  className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${
                    isEnabled ? "bg-nexpura-bronze" : "bg-stone-300"
                  } ${canEdit ? "cursor-pointer" : "cursor-default opacity-60"}`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      isEnabled ? "right-1" : "left-1"
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-stone-400 text-center">
        Notifications are sent via WhatsApp when enabled, otherwise email.
      </p>
    </div>
  );
}

function RolesClientInner({ members, locations, isOwnerOrManager }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const activeTab = (searchParams.get("tab") || "permissions") as "permissions" | "locations" | "notifications";
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
    const member = members.find((m) => m.id === memberId);
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
      newAllowed = locations.filter((l) => l.id !== locationId).map((l) => l.id);
    } else if (currentAllowed.includes(locationId)) {
      newAllowed = currentAllowed.filter((id) => id !== locationId);
      if (newAllowed.length === 0) newAllowed = [];
    } else {
      newAllowed = [...currentAllowed, locationId];
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
    if (member.allowed_location_ids === null) return true;
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
        invitePhone.trim() || null,
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
        setSaveMsg({ type: "ok", text: "Invitation resent" });
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

  function getRoleLabel(role: string) {
    return ROLE_OPTIONS.find((r) => r.value === role)?.label || role.replace(/_/g, " ");
  }

  return (
    <div className="bg-nexpura-ivory min-h-screen -mx-4 sm:-mx-6 lg:-mx-8 -my-6 lg:-my-8">
      <div className="max-w-[1200px] mx-auto px-6 sm:px-10 lg:px-16 py-12 lg:py-16">
        {/* Page Header */}
        <div className="flex items-start justify-between gap-6 mb-14">
          <div>
            <p className="text-xs uppercase tracking-luxury text-stone-500 mb-3">Settings</p>
            <h1 className="font-serif text-4xl sm:text-5xl text-stone-900 leading-[1.08] tracking-tight">
              Roles &amp; Permissions
            </h1>
            <p className="text-stone-500 mt-4 max-w-xl leading-relaxed">
              Control what each team member can see and do across stores, repairs, and reports.
            </p>
          </div>
          {isOwnerOrManager && (
            <button
              onClick={() => setShowInviteModal(true)}
              className="nx-btn-primary inline-flex items-center gap-2 shrink-0"
            >
              <PlusIcon className="w-4 h-4" />
              Invite Team Member
            </button>
          )}
        </div>

        {saveMsg && (
          <div
            role="status"
            className={`mb-8 border-l-2 pl-4 py-1 text-sm leading-relaxed ${
              saveMsg.type === "ok"
                ? "border-nexpura-bronze text-stone-700"
                : "border-red-400 text-red-600"
            }`}
          >
            {saveMsg.text}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Team Members List */}
          <div className="lg:col-span-1">
            <div className="bg-white border border-stone-200 rounded-2xl p-6 lg:p-8">
              <div className="mb-6">
                <p className="text-xs uppercase tracking-luxury text-stone-500 mb-2 flex items-center gap-2">
                  <UsersIcon className="w-3.5 h-3.5" />
                  Team
                </p>
                <h2 className="font-serif text-2xl text-stone-900 tracking-tight">Members</h2>
              </div>
              <div className="border-t border-stone-200 pt-2">
                {members.length === 0 ? (
                  <div className="py-10 text-center text-sm text-stone-500">No team members yet</div>
                ) : (
                  <ul className="divide-y divide-stone-100">
                    {members.map((member) => {
                      const isActive = selectedMember?.id === member.id;
                      return (
                        <li key={member.id}>
                          <button
                            onClick={() => setSelectedMember(member)}
                            className={`w-full text-left py-4 transition-colors group ${
                              isActive ? "" : "hover:bg-stone-50/60"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className={`font-serif text-base tracking-tight truncate ${
                                  isActive ? "text-nexpura-bronze" : "text-stone-900"
                                }`}>
                                  {member.name}
                                </p>
                                <p className="text-xs text-stone-500 truncate mt-0.5">{member.email}</p>
                              </div>
                              <span
                                className={
                                  member.role === "owner"
                                    ? "nx-badge-neutral whitespace-nowrap"
                                    : member.role === "manager"
                                    ? "nx-badge-warning whitespace-nowrap"
                                    : "nx-badge-neutral whitespace-nowrap"
                                }
                              >
                                {getRoleLabel(member.role)}
                              </span>
                            </div>
                            {!member.invite_accepted && (
                              <p className="text-[11px] text-nexpura-bronze mt-2 tracking-wide">
                                Pending invite
                              </p>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Member Details */}
          <div className="lg:col-span-2">
            {selectedMember ? (
              <div className="bg-white border border-stone-200 rounded-2xl p-6 lg:p-8">
                {/* Member Header */}
                <div className="mb-6">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-luxury text-stone-500 mb-2">
                        {getRoleLabel(selectedMember.role)}
                      </p>
                      <h2 className="font-serif text-3xl text-stone-900 tracking-tight">
                        {selectedMember.name}
                      </h2>
                      <p className="text-sm text-stone-500 mt-1.5">{selectedMember.email}</p>
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        {selectedMember.phone_number ? (
                          <span className="text-xs text-stone-500 flex items-center gap-1.5">
                            <PhoneIcon className="w-3.5 h-3.5" />
                            {selectedMember.phone_number}
                            {selectedMember.whatsapp_notifications_enabled && (
                              <ChatBubbleLeftRightIcon className="w-3.5 h-3.5 text-nexpura-bronze ml-0.5" />
                            )}
                          </span>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingPhoneMember(selectedMember);
                              setEditPhone("");
                            }}
                            className="text-xs text-nexpura-bronze hover:text-nexpura-bronze-hover flex items-center gap-1.5 transition-colors"
                          >
                            <PhoneIcon className="w-3.5 h-3.5" />
                            Add phone for WhatsApp
                          </button>
                        )}
                        {selectedMember.phone_number && isOwnerOrManager && (
                          <button
                            onClick={() => {
                              setEditingPhoneMember(selectedMember);
                              setEditPhone(selectedMember.phone_number || "");
                            }}
                            className="text-xs text-stone-500 hover:text-stone-700"
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    </div>
                    {isOwnerOrManager && selectedMember.role !== "owner" && (
                      <select
                        value={selectedMember.role}
                        onChange={(e) => handleRoleChange(selectedMember.id, e.target.value)}
                        disabled={isPending}
                        className="text-sm border border-stone-200 rounded-md px-3 py-2 bg-white focus:outline-none focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 transition-colors"
                      >
                        {ROLE_OPTIONS.filter((r) => r.value !== "owner").map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  {/* Action buttons */}
                  {isOwnerOrManager && selectedMember.role !== "owner" && (
                    <div className="flex items-center gap-2 mt-5 pt-5 border-t border-stone-200">
                      {!selectedMember.invite_accepted && (
                        <button
                          onClick={() => handleResendInvite(selectedMember.id)}
                          disabled={isPending}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-nexpura-bronze hover:text-nexpura-bronze-hover px-3 py-1.5 rounded-md border border-stone-200 hover:border-stone-300 transition-colors disabled:opacity-50"
                        >
                          <ArrowPathIcon className={`w-3.5 h-3.5 ${isPending ? "animate-spin" : ""}`} />
                          Resend Invite
                        </button>
                      )}
                      <button
                        onClick={() => handleRemoveMember(selectedMember.id)}
                        disabled={isPending}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-500 hover:text-red-600 hover:bg-red-50/60 px-3 py-1.5 rounded-md transition-colors ml-auto disabled:opacity-50"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                        Remove
                      </button>
                    </div>
                  )}
                </div>

                {/* Tabs */}
                <div className="border-b border-stone-200 -mx-6 lg:-mx-8 px-6 lg:px-8">
                  <div className="flex gap-1">
                    <button
                      onClick={() => router.replace(pathname)}
                      className={`px-4 py-3 text-sm font-medium transition-colors inline-flex items-center gap-2 border-b-2 -mb-px ${
                        activeTab === "permissions"
                          ? "text-nexpura-bronze border-nexpura-bronze"
                          : "text-stone-500 hover:text-stone-700 border-transparent"
                      }`}
                    >
                      <ShieldCheckIcon className="w-4 h-4" />
                      Permissions
                    </button>
                    {hasMultipleLocations && (
                      <button
                        onClick={() => router.replace(pathname + "?tab=locations")}
                        className={`px-4 py-3 text-sm font-medium transition-colors inline-flex items-center gap-2 border-b-2 -mb-px ${
                          activeTab === "locations"
                            ? "text-nexpura-bronze border-nexpura-bronze"
                            : "text-stone-500 hover:text-stone-700 border-transparent"
                        }`}
                      >
                        <MapPinIcon className="w-4 h-4" />
                        Store Access
                      </button>
                    )}
                    <button
                      onClick={() => router.replace(pathname + "?tab=notifications")}
                      className={`px-4 py-3 text-sm font-medium transition-colors inline-flex items-center gap-2 border-b-2 -mb-px ${
                        activeTab === "notifications"
                          ? "text-nexpura-bronze border-nexpura-bronze"
                          : "text-stone-500 hover:text-stone-700 border-transparent"
                      }`}
                    >
                      <BellIcon className="w-4 h-4" />
                      Notifications
                    </button>
                  </div>
                </div>

                {/* Tab Content */}
                <div className="pt-8">
                  {activeTab === "permissions" && (
                    <div className="overflow-hidden border border-stone-200 rounded-xl">
                      <table className="w-full">
                        <tbody>
                          {PERMISSION_GROUPS.map((group, groupIdx) => {
                            const Icon = group.icon;
                            const perms = getMemberPermissions(selectedMember);
                            const canEdit = isOwnerOrManager && selectedMember.role !== "owner";
                            return (
                              <Fragment key={group.label}>
                                <tr className={groupIdx > 0 ? "border-t border-stone-200" : ""}>
                                  <td colSpan={2} className="bg-stone-50/60 px-5 py-3">
                                    <p className="text-xs uppercase tracking-luxury text-stone-500 flex items-center gap-2">
                                      <Icon className="w-3.5 h-3.5" />
                                      {group.label}
                                    </p>
                                  </td>
                                </tr>
                                {group.permissions.map((perm) => {
                                  const isEnabled = perms[perm.key as keyof PermissionSet] as boolean;
                                  return (
                                    <tr key={perm.key} className="border-t border-stone-100">
                                      <td className="px-5 py-3 text-sm text-stone-700">{perm.label}</td>
                                      <td className="px-5 py-3 text-right w-20">
                                        <label
                                          className={`inline-flex items-center justify-center ${
                                            canEdit ? "cursor-pointer" : "cursor-default"
                                          }`}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={isEnabled}
                                            disabled={!canEdit || isPending}
                                            onChange={() =>
                                              canEdit &&
                                              handlePermissionToggle(selectedMember.id, perm.key, isEnabled)
                                            }
                                            className="h-4 w-4 rounded border-stone-300 accent-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 disabled:opacity-50"
                                          />
                                        </label>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {activeTab === "locations" && hasMultipleLocations && (
                    <div className="space-y-8">
                      {/* All Locations Toggle */}
                      <div className="flex items-center justify-between gap-4 p-5 border border-stone-200 rounded-2xl bg-stone-50/50">
                        <div>
                          <p className="font-serif text-base text-stone-900 tracking-tight">Access to all stores</p>
                          <p className="text-sm text-stone-500 mt-1 leading-relaxed">
                            Can view and work at any location
                          </p>
                        </div>
                        <button
                          onClick={() => handleSetAllLocations(selectedMember.id)}
                          disabled={!isOwnerOrManager || selectedMember.role === "owner" || isPending}
                          className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 ${
                            selectedMember.allowed_location_ids === null
                              ? "nx-btn-primary"
                              : "border border-stone-200 text-stone-700 hover:border-stone-300 hover:bg-stone-50"
                          }`}
                        >
                          {selectedMember.allowed_location_ids === null ? (
                            <>
                              <CheckIcon className="w-4 h-4" />
                              Enabled
                            </>
                          ) : (
                            "Enable"
                          )}
                        </button>
                      </div>

                      {/* Individual Locations */}
                      <div>
                        <p className="text-xs uppercase tracking-luxury text-stone-500 mb-4">
                          Or select specific stores
                        </p>
                        <div className="space-y-2">
                          {locations.map((location) => {
                            const isAllowed = isLocationAllowed(selectedMember, location.id);
                            const isDefault = selectedMember.default_location_id === location.id;
                            const canEdit = isOwnerOrManager && selectedMember.role !== "owner";
                            return (
                              <div
                                key={location.id}
                                className="flex items-center justify-between gap-4 p-4 rounded-xl border border-stone-200 bg-white"
                              >
                                <div className="flex items-center gap-4 min-w-0">
                                  <BuildingOffice2Icon className="w-5 h-5 text-stone-400 shrink-0" />
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p className={`text-sm font-medium ${isAllowed ? "text-stone-900" : "text-stone-500"}`}>
                                        {location.name}
                                      </p>
                                      {isDefault && (
                                        <span className="nx-badge-neutral text-[10px]">Default</span>
                                      )}
                                    </div>
                                    <p className="text-xs text-stone-500 capitalize mt-0.5">{location.type}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  {isAllowed && !isDefault && canEdit && (
                                    <button
                                      onClick={() =>
                                        handleDefaultLocationChange(selectedMember.id, location.id)
                                      }
                                      className="text-xs text-nexpura-bronze hover:text-nexpura-bronze-hover font-medium transition-colors"
                                    >
                                      Set Default
                                    </button>
                                  )}
                                  <button
                                    onClick={() =>
                                      canEdit &&
                                      handleLocationToggle(
                                        selectedMember.id,
                                        location.id,
                                        selectedMember.allowed_location_ids,
                                      )
                                    }
                                    disabled={!canEdit || isPending}
                                    className={`w-12 h-6 rounded-full transition-colors relative ${
                                      isAllowed ? "bg-nexpura-bronze" : "bg-stone-300"
                                    } ${canEdit ? "cursor-pointer" : "cursor-default opacity-60"}`}
                                  >
                                    <span
                                      className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                                        isAllowed ? "right-1" : "left-1"
                                      }`}
                                    />
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
                            const result = await updateMemberWhatsAppEnabled(
                              selectedMember.id,
                              value as boolean,
                            );
                            if (result.error) setSaveMsg({ type: "err", text: result.error });
                            else router.refresh();
                          } else {
                            const result = await updateMemberNotifications(selectedMember.id, {
                              [key]: value,
                            });
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
              <div className="bg-white border border-stone-200 rounded-2xl p-12 lg:p-16 text-center">
                <UserCircleIcon className="w-12 h-12 mx-auto text-stone-300 mb-4" />
                <h3 className="font-serif text-2xl text-stone-900 tracking-tight">Select a team member</h3>
                <p className="text-sm text-stone-500 mt-2 leading-relaxed max-w-sm mx-auto">
                  Choose someone from the list to review and adjust their permissions, store access, and notifications.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Invite Modal */}
        {showInviteModal && (
          <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-stone-200">
              {inviteSuccess ? (
                <div className="p-10 text-center">
                  <CheckCircleIcon className="w-12 h-12 text-nexpura-bronze mx-auto mb-4" />
                  <h3 className="font-serif text-2xl text-stone-900 tracking-tight">Invitation Sent</h3>
                  <p className="text-sm text-stone-500 mt-3 leading-relaxed">
                    An email has been sent to {inviteEmail} with instructions to join your team.
                  </p>
                </div>
              ) : (
                <>
                  <div className="px-6 lg:px-8 py-5 border-b border-stone-200 flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-luxury text-stone-500 mb-1">Team</p>
                      <h3 className="font-serif text-2xl text-stone-900 tracking-tight">Invite Team Member</h3>
                    </div>
                    <button
                      onClick={() => setShowInviteModal(false)}
                      className="text-stone-400 hover:text-stone-700 transition-colors"
                      aria-label="Close"
                    >
                      <XMarkIcon className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="p-6 lg:p-8 space-y-5 max-h-[60vh] overflow-y-auto">
                    {/* Name */}
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1.5">Full Name</label>
                      <input
                        type="text"
                        value={inviteName}
                        onChange={(e) => setInviteName(e.target.value)}
                        placeholder="John Smith"
                        className="w-full px-4 py-2.5 border border-stone-200 rounded-md bg-white text-sm focus:outline-none focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 transition-colors"
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
                        className="w-full px-4 py-2.5 border border-stone-200 rounded-md bg-white text-sm focus:outline-none focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 transition-colors"
                      />
                    </div>

                    {/* Phone */}
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1.5">
                        Phone Number <span className="text-stone-400 font-normal">(optional)</span>
                      </label>
                      <input
                        type="tel"
                        value={invitePhone}
                        onChange={(e) => setInvitePhone(e.target.value)}
                        placeholder="+44 7700 900000"
                        className="w-full px-4 py-2.5 border border-stone-200 rounded-md bg-white text-sm focus:outline-none focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 transition-colors"
                      />
                      <p className="text-xs text-stone-500 mt-1.5">For WhatsApp task notifications</p>
                    </div>

                    {/* Role */}
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1.5">Role</label>
                      <select
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value)}
                        className="w-full px-4 py-2.5 border border-stone-200 rounded-md bg-white text-sm focus:outline-none focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 transition-colors"
                      >
                        {ROLE_OPTIONS.filter((r) => r.value !== "owner").map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label} — {r.desc}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Store Access */}
                    {hasMultipleLocations && (
                      <div>
                        <label className="block text-sm font-medium text-stone-700 mb-1.5">Store Access</label>
                        <div className="space-y-2">
                          <label className="flex items-center gap-3 p-3 border border-stone-200 rounded-md cursor-pointer hover:bg-stone-50 transition-colors">
                            <input
                              type="radio"
                              name="locationAccess"
                              checked={inviteLocations === null}
                              onChange={() => setInviteLocations(null)}
                              className="accent-nexpura-bronze"
                            />
                            <span className="text-sm text-stone-700">All stores</span>
                          </label>
                          <label className="flex items-center gap-3 p-3 border border-stone-200 rounded-md cursor-pointer hover:bg-stone-50 transition-colors">
                            <input
                              type="radio"
                              name="locationAccess"
                              checked={inviteLocations !== null}
                              onChange={() => setInviteLocations([])}
                              className="accent-nexpura-bronze"
                            />
                            <span className="text-sm text-stone-700">Specific stores only</span>
                          </label>
                          {inviteLocations !== null && (
                            <div className="ml-2 space-y-2 pt-2">
                              {locations.map((loc) => (
                                <label
                                  key={loc.id}
                                  className="flex items-center gap-3 p-3 bg-white rounded-md cursor-pointer hover:bg-stone-50 border border-stone-200 transition-colors"
                                >
                                  <input
                                    type="checkbox"
                                    checked={inviteLocations.includes(loc.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setInviteLocations([...inviteLocations, loc.id]);
                                      } else {
                                        setInviteLocations(inviteLocations.filter((id) => id !== loc.id));
                                      }
                                    }}
                                    className="h-4 w-4 rounded border-stone-300 accent-nexpura-bronze"
                                  />
                                  <span className="text-sm text-stone-700">{loc.name}</span>
                                  <span className="text-xs text-stone-500 capitalize">({loc.type})</span>
                                </label>
                              ))}
                              {inviteLocations.length === 0 && (
                                <p className="text-xs text-nexpura-bronze">Select at least one store</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="px-6 lg:px-8 py-4 bg-stone-50/60 border-t border-stone-200 flex justify-end gap-3">
                    <button
                      onClick={() => setShowInviteModal(false)}
                      className="px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleInvite}
                      disabled={
                        isPending ||
                        !inviteName.trim() ||
                        !inviteEmail.trim() ||
                        (hasMultipleLocations && inviteLocations !== null && inviteLocations.length === 0)
                      }
                      className="nx-btn-primary inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isPending ? (
                        <>
                          <ArrowPathIcon className="w-4 h-4 animate-spin" />
                          Sending…
                        </>
                      ) : (
                        <>
                          <EnvelopeIcon className="w-4 h-4" />
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
          <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full overflow-hidden border border-stone-200">
              <div className="px-6 lg:px-8 py-5 border-b border-stone-200 flex items-center justify-between">
                <h3 className="font-serif text-xl text-stone-900 tracking-tight">
                  {editingPhoneMember.phone_number ? "Edit Phone Number" : "Add Phone Number"}
                </h3>
                <button
                  onClick={() => setEditingPhoneMember(null)}
                  className="text-stone-400 hover:text-stone-700 transition-colors"
                  aria-label="Close"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 lg:p-8 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">
                    Phone Number for {editingPhoneMember.name}
                  </label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="+44 7700 900000"
                    className="w-full px-4 py-2.5 border border-stone-200 rounded-md bg-white text-sm focus:outline-none focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 transition-colors"
                  />
                  <p className="text-xs text-stone-500 mt-1.5">
                    Include country code for WhatsApp notifications
                  </p>
                </div>
              </div>
              <div className="px-6 lg:px-8 py-4 bg-stone-50/60 border-t border-stone-200 flex justify-between gap-3">
                {editingPhoneMember.phone_number && (
                  <button
                    onClick={() => {
                      handleUpdatePhone(editingPhoneMember.id);
                      setEditPhone("");
                    }}
                    disabled={isPending}
                    className="px-4 py-2 text-sm font-medium text-stone-500 hover:text-red-600 transition-colors disabled:opacity-50"
                  >
                    Remove Number
                  </button>
                )}
                <div className="flex gap-3 ml-auto">
                  <button
                    onClick={() => setEditingPhoneMember(null)}
                    className="px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleUpdatePhone(editingPhoneMember.id)}
                    disabled={isPending || !editPhone.trim()}
                    className="nx-btn-primary inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isPending ? (
                      <ArrowPathIcon className="w-4 h-4 animate-spin" />
                    ) : (
                      <PhoneIcon className="w-4 h-4" />
                    )}
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function RolesClient(props: Parameters<typeof RolesClientInner>[0]) {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-stone-500">Loading…</div>}>
      <RolesClientInner {...props} />
    </Suspense>
  );
}
