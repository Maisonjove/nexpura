"use client";

import { useState } from "react";
import { CheckCircle, XCircle, Circle, ExternalLink } from "lucide-react";

type Status = "pending" | "pass" | "fail";

interface CheckItem {
  id: string;
  route: string;
  category: string;
  whatToCheck: string[];
  passLooksLike: string;
  failLooksLike: string;
  status: Status;
  notes: string;
}

const initialChecks: CheckItem[] = [
  // A. Login + Dashboard
  {
    id: "a1",
    route: "/dashboard",
    category: "A. Login + Dashboard",
    whatToCheck: [
      "Page loads after login",
      "No broken widgets or empty shells",
      "Counts look coherent (repairs, bespoke, invoices)",
      "Navigation sidebar works",
      "Quick actions are clickable",
    ],
    passLooksLike: "Dashboard renders with data, no console errors, navigation works",
    failLooksLike: "Blank page, infinite loader, broken widgets, console errors",
    status: "pending",
    notes: "",
  },
  // B. POS
  {
    id: "b1",
    route: "/pos",
    category: "B. POS",
    whatToCheck: [
      "Page loads",
      "Inventory items appear (if seeded)",
      "Can search for items",
      "Can add item to cart",
      "Can search/select customer",
      "Can click through to payment",
      "Payment methods show",
    ],
    passLooksLike: "POS is usable, items load, cart works, payment flow opens",
    failLooksLike: "Blank page, items don't load, cart broken, payment modal fails",
    status: "pending",
    notes: "",
  },
  // C. Invoices
  {
    id: "c1",
    route: "/invoices",
    category: "C. Invoices List",
    whatToCheck: [
      "List page loads",
      "Invoices appear (if any exist)",
      "Status badges show correctly",
      "Can click into an invoice",
    ],
    passLooksLike: "List renders, invoices show, navigation to detail works",
    failLooksLike: "Blank list, infinite loader, click does nothing",
    status: "pending",
    notes: "",
  },
  {
    id: "c2",
    route: "/invoices/[id]",
    category: "C. Invoice Detail",
    whatToCheck: [
      "Detail page loads",
      "Line items visible",
      "Amount paid / balance due coherent",
      "Payment history visible (if payments exist)",
      "Can record payment (if unpaid)",
    ],
    passLooksLike: "Detail renders, amounts correct, payment history shows",
    failLooksLike: "Blank page, amounts wrong, payment history missing",
    status: "pending",
    notes: "",
  },
  // D. Repairs
  {
    id: "d1",
    route: "/repairs",
    category: "D. Repairs List",
    whatToCheck: [
      "List page loads",
      "Repairs appear (if any exist)",
      "Status/stage badges show",
      "Can click into a repair",
    ],
    passLooksLike: "List renders, repairs show, navigation works",
    failLooksLike: "Blank list, infinite loader, no data",
    status: "pending",
    notes: "",
  },
  {
    id: "d2",
    route: "/repairs/[id]",
    category: "D. Repair Detail (Command Center)",
    whatToCheck: [
      "Detail page loads",
      "Finance rail visible (quote, deposit, balance)",
      "Stage/status visible",
      "Linked invoice visible (if created)",
      "Payment history visible",
      "Can change stage",
      "Document uploads section visible",
    ],
    passLooksLike: "Full command center renders, finance linkage works",
    failLooksLike: "Missing finance rail, no invoice link, blank sections",
    status: "pending",
    notes: "",
  },
  // E. Bespoke
  {
    id: "e1",
    route: "/bespoke",
    category: "E. Bespoke List",
    whatToCheck: [
      "List page loads",
      "Bespoke jobs appear (if any exist)",
      "Status/stage badges show",
      "Can click into a job",
    ],
    passLooksLike: "List renders, jobs show, navigation works",
    failLooksLike: "Blank list, infinite loader, no data",
    status: "pending",
    notes: "",
  },
  {
    id: "e2",
    route: "/bespoke/[id]",
    category: "E. Bespoke Detail (Command Center)",
    whatToCheck: [
      "Detail page loads",
      "Finance rail visible (quote, deposit, balance)",
      "Stage/status visible",
      "Linked invoice visible (if created)",
      "Payment history visible",
      "Can change stage",
      "Document uploads section visible",
    ],
    passLooksLike: "Full command center renders, finance linkage works",
    failLooksLike: "Missing finance rail, no invoice link, blank sections",
    status: "pending",
    notes: "",
  },
  // F. Inventory
  {
    id: "f1",
    route: "/inventory",
    category: "F. Inventory List",
    whatToCheck: [
      "List page loads",
      "Items appear (if seeded)",
      "Can search/filter",
      "Can click into item detail",
    ],
    passLooksLike: "List renders, items show, search works",
    failLooksLike: "Blank list, search broken, no items when expected",
    status: "pending",
    notes: "",
  },
  {
    id: "f2",
    route: "/inventory/[id]",
    category: "F. Inventory Detail",
    whatToCheck: [
      "Detail page loads",
      "Item info shows",
      "Stock quantity visible",
      "Can edit stock/details",
    ],
    passLooksLike: "Detail renders, quantity correct, edit works",
    failLooksLike: "Blank page, wrong data, edit fails",
    status: "pending",
    notes: "",
  },
  // G. Customers
  {
    id: "g1",
    route: "/customers",
    category: "G. Customers List",
    whatToCheck: [
      "List page loads",
      "Customers appear (if any exist)",
      "Can search",
      "Can click into customer detail",
    ],
    passLooksLike: "List renders, customers show, search works",
    failLooksLike: "Blank list, search broken, no data",
    status: "pending",
    notes: "",
  },
  {
    id: "g2",
    route: "/customers/[id]",
    category: "G. Customer Detail",
    whatToCheck: [
      "Detail page loads",
      "Customer info shows",
      "Store credit visible",
      "Order history visible",
      "Can edit customer",
    ],
    passLooksLike: "Detail renders, history shows, edit works",
    failLooksLike: "Blank page, missing history, edit fails",
    status: "pending",
    notes: "",
  },
  // H. Website Builder
  {
    id: "h1",
    route: "/website/builder",
    category: "H. Website Builder",
    whatToCheck: [
      "Builder page loads",
      "Preview visible",
      "Can edit sections",
      "Can save changes",
    ],
    passLooksLike: "Builder renders, editing works, saves successfully",
    failLooksLike: "Blank page, editing broken, save fails",
    status: "pending",
    notes: "",
  },
  // I. Billing
  {
    id: "i1",
    route: "/billing",
    category: "I. Billing",
    whatToCheck: [
      "Billing page loads",
      "Current plan visible",
      "Usage stats visible (if applicable)",
      "Can access upgrade/manage options",
    ],
    passLooksLike: "Billing renders, plan info shows",
    failLooksLike: "Blank page, no plan info, errors",
    status: "pending",
    notes: "",
  },
  // J. Unified Intake - Repair Path
  {
    id: "j1",
    route: "/intake",
    category: "J1. Intake — Repair Path (CRITICAL)",
    whatToCheck: [
      "1. Navigate to /intake",
      "2. Confirm 'Repair' tab is selected by default",
      "3. Search for existing customer OR create new inline customer",
      "4. Select Item Type (e.g., Ring)",
      "5. Enter Item Description (e.g., 'Gold wedding band')",
      "6. Enter Quoted Price (e.g., 150)",
      "7. Enter Deposit Amount (e.g., 50)",
      "8. Enter Payment Received (e.g., 50)",
      "9. Click 'Create Repair' button",
      "10. Verify success screen shows with job number",
      "11. Click 'Go to Repair Detail' and verify command center loads",
    ],
    passLooksLike: "Success screen shows REP-XXXX, command center loads with correct data, invoice is linked",
    failLooksLike: "Error message on submit, blank screen, stuck loading state, no job number, wrong redirect",
    status: "pending",
    notes: "",
  },
  // J2. Intake - Bespoke Path
  {
    id: "j2",
    route: "/intake",
    category: "J2. Intake — Bespoke Path (CRITICAL)",
    whatToCheck: [
      "1. Navigate to /intake",
      "2. Click 'Bespoke' tab",
      "3. Search/select customer (optional)",
      "4. Enter Title (e.g., 'Custom engagement ring')",
      "5. Select Jewellery Type (e.g., Ring)",
      "6. Enter Quoted Price (e.g., 5000)",
      "7. Enter Deposit Amount (e.g., 2000)",
      "8. Enter Payment Received (e.g., 2000)",
      "9. Click 'Create Job' button",
      "10. Verify success screen shows with job number",
      "11. Click 'Go to Bespoke Detail' and verify command center loads",
    ],
    passLooksLike: "Success screen shows JOB-XXXX, command center loads with deposit recorded, invoice linked",
    failLooksLike: "Error on submit, stuck state, no job number, command center blank",
    status: "pending",
    notes: "",
  },
  // J3. Intake - Stock Sale Path
  {
    id: "j3",
    route: "/intake",
    category: "J3. Intake — Stock Sale Path (CRITICAL)",
    whatToCheck: [
      "1. Navigate to /intake",
      "2. Click 'Stock Item' tab",
      "3. Search for existing inventory item (type SKU or name)",
      "4. Select an item from dropdown",
      "5. Verify price auto-fills from retail_price",
      "6. Optionally search/select customer",
      "7. Enter Payment Received (full amount for immediate sale)",
      "8. Click 'Create Sale' button",
      "9. Verify success screen shows with sale number",
      "10. Click 'Go to Sale Detail' and verify sale loads",
      "11. Check inventory quantity decreased by 1",
    ],
    passLooksLike: "Success screen shows SALE-XXXX, sale detail loads, inventory quantity reduced",
    failLooksLike: "Error on submit (esp. out of stock), quantity not deducted, no sale number",
    status: "pending",
    notes: "",
  },
  // J4. Intake Error States
  {
    id: "j4",
    route: "/intake",
    category: "J4. Intake — Error Handling",
    whatToCheck: [
      "1. Try to create repair without Item Type → validation error shown",
      "2. Try to create repair without Item Description → validation error shown",
      "3. Try to create bespoke without Title → validation error shown",
      "4. Try to create stock sale without selecting item → validation error shown",
      "5. Enter deposit > quoted price → validation error shown",
      "6. Double-click submit button → only one job created (no duplicates)",
      "7. If server error occurs → error banner shows with clear message",
    ],
    passLooksLike: "Clear validation messages, no duplicate submits, server errors are human-readable",
    failLooksLike: "Silent failures, console errors only, duplicates created, cryptic error messages",
    status: "pending",
    notes: "",
  },
  // J5. Intake Success Screen
  {
    id: "j5",
    route: "/intake (success screen)",
    category: "J5. Intake — Success Screen Actions",
    whatToCheck: [
      "1. After create, success screen shows",
      "2. 'Print Invoice' button opens PDF in new tab",
      "3. 'Print Receipt' button opens thermal PDF (if invoice exists)",
      "4. 'Email Customer' button sends email (if customer has email)",
      "5. 'Go to Detail' navigates to correct command center",
      "6. 'View Invoice' navigates to invoice detail",
      "7. 'View in Workshop' navigates to workshop (repairs/bespoke only)",
      "8. 'View Customer' navigates to customer detail",
      "9. 'Create Another Job' resets form to blank state",
    ],
    passLooksLike: "All buttons work, PDFs open, navigation is correct, reset clears form",
    failLooksLike: "Buttons fail, PDF errors, wrong navigation, reset leaves stale data",
    status: "pending",
    notes: "",
  },
  // K. Created repair appears
  {
    id: "k1",
    route: "/repairs + /tasks/workshop + /dashboard",
    category: "K. Created Repair Appears",
    whatToCheck: [
      "After creating repair via intake, it appears in /repairs list",
      "It appears in /tasks/workshop view",
      "Dashboard counts update",
    ],
    passLooksLike: "New repair visible in all expected places",
    failLooksLike: "Repair missing from list, workshop, or dashboard",
    status: "pending",
    notes: "",
  },
  // L. Created bespoke appears
  {
    id: "l1",
    route: "/bespoke + /tasks/workshop + /dashboard",
    category: "L. Created Bespoke Appears",
    whatToCheck: [
      "After creating bespoke via intake, it appears in /bespoke list",
      "It appears in /tasks/workshop view",
      "Dashboard counts update",
    ],
    passLooksLike: "New bespoke visible in all expected places",
    failLooksLike: "Bespoke missing from list, workshop, or dashboard",
    status: "pending",
    notes: "",
  },
  // M. Invoice/payment linkage
  {
    id: "m1",
    route: "/repairs/[id] or /bespoke/[id]",
    category: "M. Invoice/Payment Linkage",
    whatToCheck: [
      "From command center, linked invoice is visible",
      "Payment history shows deposits/payments",
      "Balance due is correct",
      "Can record payment from command center",
    ],
    passLooksLike: "Finance rail shows invoice, payments, correct balance",
    failLooksLike: "No invoice link, payments missing, wrong balance",
    status: "pending",
    notes: "",
  },
  // N. Tasks/Workshop
  {
    id: "n1",
    route: "/tasks/workshop",
    category: "N. Workshop View",
    whatToCheck: [
      "Workshop page loads",
      "Jobs grouped by stage/status",
      "Can drag/move jobs (if Kanban)",
      "Can click into job detail",
    ],
    passLooksLike: "Workshop renders, jobs visible, interaction works",
    failLooksLike: "Blank page, no jobs, dragging broken",
    status: "pending",
    notes: "",
  },
  // O. Settings
  {
    id: "o1",
    route: "/settings",
    category: "O. Settings",
    whatToCheck: [
      "Settings page loads",
      "Can view/edit store info",
      "Can view/edit tax settings",
      "Can manage team (if applicable)",
    ],
    passLooksLike: "Settings render, forms work, saves successfully",
    failLooksLike: "Blank page, forms broken, save fails",
    status: "pending",
    notes: "",
  },
];

export default function VerificationPage() {
  const [checks, setChecks] = useState<CheckItem[]>(initialChecks);
  const [build] = useState("05d84cb");

  const updateStatus = (id: string, status: Status) => {
    setChecks((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status } : c))
    );
  };

  const updateNotes = (id: string, notes: string) => {
    setChecks((prev) =>
      prev.map((c) => (c.id === id ? { ...c, notes } : c))
    );
  };

  const passed = checks.filter((c) => c.status === "pass").length;
  const failed = checks.filter((c) => c.status === "fail").length;
  const pending = checks.filter((c) => c.status === "pending").length;

  const getReadinessLevel = () => {
    if (failed > 0) return "Needs more hardening before any real pilot";
    if (pending > 0) return "Incomplete — finish all checks first";
    return "Safe for controlled pilot with monitoring";
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Live Production Verification Checklist
          </h1>
          <p className="text-gray-600 mb-4">
            Domain: <strong>nexpura.com</strong> | Build: <strong>{build}</strong>
          </p>
          
          <div className="flex gap-6 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span>Pass: {passed}</span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-500" />
              <span>Fail: {failed}</span>
            </div>
            <div className="flex items-center gap-2">
              <Circle className="w-5 h-5 text-gray-400" />
              <span>Pending: {pending}</span>
            </div>
          </div>

          <div className="mt-4 p-4 bg-gray-100 rounded-lg">
            <strong>Readiness Level:</strong> {getReadinessLevel()}
          </div>
        </div>

        <div className="space-y-4">
          {checks.map((check) => (
            <div
              key={check.id}
              className={`bg-white rounded-lg shadow-sm border p-4 ${
                check.status === "pass"
                  ? "border-green-300"
                  : check.status === "fail"
                  ? "border-red-300"
                  : "border-gray-200"
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{check.category}</h3>
                  <a
                    href={check.route.includes("[") ? "#" : check.route}
                    className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                  >
                    {check.route}
                    {!check.route.includes("[") && <ExternalLink className="w-3 h-3" />}
                  </a>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => updateStatus(check.id, "pass")}
                    className={`px-3 py-1 rounded text-sm font-medium ${
                      check.status === "pass"
                        ? "bg-green-500 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-green-100"
                    }`}
                  >
                    Pass
                  </button>
                  <button
                    onClick={() => updateStatus(check.id, "fail")}
                    className={`px-3 py-1 rounded text-sm font-medium ${
                      check.status === "fail"
                        ? "bg-red-500 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-red-100"
                    }`}
                  >
                    Fail
                  </button>
                  <button
                    onClick={() => updateStatus(check.id, "pending")}
                    className={`px-3 py-1 rounded text-sm font-medium ${
                      check.status === "pending"
                        ? "bg-gray-500 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    Reset
                  </button>
                  {check.status === "fail" && (
                    <a
                      href={`/admin/pilot-issues?prefill=true&title=${encodeURIComponent(`[Verification] ${check.category} failed`)}&route_path=${encodeURIComponent(check.route)}&category=ux_frontend&steps_to_reproduce=${encodeURIComponent(check.whatToCheck.join("\n"))}&expected_result=${encodeURIComponent(check.passLooksLike)}&actual_result=${encodeURIComponent(check.failLooksLike + (check.notes ? `\n\nNotes: ${check.notes}` : ""))}`}
                      className="px-3 py-1 rounded text-sm font-medium bg-amber-100 text-amber-700 hover:bg-amber-200"
                    >
                      → Report as Pilot Issue
                    </a>
                  )}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="font-medium text-gray-700 mb-1">What to Check:</h4>
                  <ul className="list-disc list-inside text-gray-600 space-y-0.5">
                    {check.whatToCheck.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="space-y-2">
                  <div>
                    <span className="font-medium text-green-700">Pass looks like: </span>
                    <span className="text-gray-600">{check.passLooksLike}</span>
                  </div>
                  <div>
                    <span className="font-medium text-red-700">Fail looks like: </span>
                    <span className="text-gray-600">{check.failLooksLike}</span>
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <input
                  type="text"
                  placeholder="Notes (optional)"
                  value={check.notes}
                  onChange={(e) => updateNotes(check.id, e.target.value)}
                  className="w-full px-3 py-2 border rounded text-sm"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6 mt-6">
          <h2 className="text-lg font-bold mb-4">Summary</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Scenario</th>
                <th className="text-center py-2">Status</th>
                <th className="text-left py-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {checks.map((check) => (
                <tr key={check.id} className="border-b">
                  <td className="py-2">{check.category}</td>
                  <td className="py-2 text-center">
                    {check.status === "pass" && (
                      <span className="text-green-600 font-medium">✓ Pass</span>
                    )}
                    {check.status === "fail" && (
                      <span className="text-red-600 font-medium">✗ Fail</span>
                    )}
                    {check.status === "pending" && (
                      <span className="text-gray-400">Pending</span>
                    )}
                  </td>
                  <td className="py-2 text-gray-600">{check.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h3 className="font-semibold text-yellow-800 mb-2">Final Readiness Assessment</h3>
            <p className="text-yellow-700">
              {failed === 0 && pending === 0 ? (
                <>
                  All checks passed. The application is{" "}
                  <strong>Safe for controlled pilot with monitoring</strong>.
                  <br />
                  <br />
                  Conditions:
                  <ul className="list-disc list-inside mt-2">
                    <li>Single store pilot only</li>
                    <li>Low/medium transaction volume</li>
                    <li>Monitor /api/health/concurrency weekly</li>
                    <li>Review transaction_audit table for any failures</li>
                    <li>Browser concurrency testing still recommended before multi-user load</li>
                  </ul>
                </>
              ) : failed > 0 ? (
                <>
                  <strong>{failed} check(s) failed.</strong> The application{" "}
                  <strong>needs more hardening before any real pilot</strong>.
                  <br />
                  Fix the failed items before proceeding.
                </>
              ) : (
                <>
                  <strong>{pending} check(s) remaining.</strong> Complete all checks to determine
                  readiness level.
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
