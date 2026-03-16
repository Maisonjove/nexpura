"use client";

import { useState, useTransition } from "react";
import { updatePermission } from "./actions";
import type { PermissionKey, PermissionMap } from "@/lib/permissions";

const ROLE_LABELS: Record<string, string> = {
  manager: "Manager",
  salesperson: "Salesperson",
  workshop_jeweller: "Workshop Jeweller",
  repair_technician: "Repair Technician",
  inventory_manager: "Inventory Manager",
  accountant: "Accountant",
};

interface Props {
  tenantId: string;
  roles: string[];
  permissionKeys: PermissionKey[];
  permissionLabels: Record<PermissionKey, string>;
  permissionMatrix: Record<string, PermissionMap>;
}

export default function PermissionsMatrixClient({
  tenantId,
  roles,
  permissionKeys,
  permissionLabels,
  permissionMatrix,
}: Props) {
  const [matrix, setMatrix] = useState(permissionMatrix);
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function handleToggle(role: string, key: PermissionKey, currentValue: boolean) {
    const newValue = !currentValue;

    // Optimistic update
    setMatrix((prev) => ({
      ...prev,
      [role]: { ...prev[role], [key]: newValue },
    }));

    startTransition(async () => {
      const result = await updatePermission(tenantId, role, key, newValue);
      if (result?.error) {
        // Revert
        setMatrix((prev) => ({
          ...prev,
          [role]: { ...prev[role], [key]: currentValue },
        }));
        setMsg(`Error: ${result.error}`);
      } else {
        setMsg("Saved!");
        setTimeout(() => setMsg(null), 2000);
      }
    });
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Permission Matrix</h1>
        <p className="text-stone-500 mt-1 text-sm">
          Configure what each role can access. Owners always have full access.
        </p>
      </div>

      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <span className="text-amber-500 mt-0.5 flex-shrink-0">⚠️</span>
        <div>
          <p className="text-sm font-semibold text-amber-800">Partial Enforcement — Beta</p>
          <p className="text-sm text-amber-700 mt-0.5">
            Role-based access is currently enforced in reports, inventory cost prices, and billing. Granular enforcement across all modules is in progress. Some toggles here may not yet restrict access in every part of the app.
          </p>
        </div>
      </div>

      {msg && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
          {msg}
        </div>
      )}

      <div className="bg-white border border-stone-200 rounded-xl overflow-x-auto shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200">
              <th className="text-left px-5 py-4 font-semibold text-stone-700 w-44">Permission</th>
              {roles.map((role) => (
                <th key={role} className="px-3 py-4 font-semibold text-stone-700 text-center min-w-[120px]">
                  {ROLE_LABELS[role] || role}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {permissionKeys.map((key) => (
              <tr key={key} className="hover:bg-stone-50">
                <td className="px-5 py-3 text-stone-700 font-medium">{permissionLabels[key]}</td>
                {roles.map((role) => {
                  const enabled = matrix[role]?.[key] ?? false;
                  return (
                    <td key={role} className="px-3 py-3 text-center">
                      <button
                        onClick={() => handleToggle(role, key, enabled)}
                        disabled={isPending}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
                          enabled ? "bg-amber-700" : "bg-stone-200"
                        }`}
                        title={enabled ? "Click to disable" : "Click to enable"}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${
                            enabled ? "translate-x-4" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-stone-400">
        Changes take effect immediately for new sessions. Existing sessions may take a moment to update.
      </p>
    </div>
  );
}
