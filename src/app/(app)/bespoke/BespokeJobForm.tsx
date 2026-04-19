"use client";

import { useState, useTransition } from "react";
import { createBespokeJob, updateBespokeJob } from "./actions";
import { SubmitButton } from "@/components/ui/submit-button";

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

interface Customer {
  id: string;
  full_name: string | null;
}

interface JobData {
  id?: string;
  job_number?: string;
  tracking_id?: string;
  customer_id?: string | null;
  title?: string;
  jewellery_type?: string | null;
  order_type?: string | null;
  metal_type?: string | null;
  metal_colour?: string | null;
  metal_purity?: string | null;
  metal_weight_grams?: number | null;
  stone_type?: string | null;
  stone_shape?: string | null;
  stone_carat?: number | null;
  stone_colour?: string | null;
  stone_clarity?: string | null;
  stone_origin?: string | null;
  stone_cert_number?: string | null;
  ring_size?: string | null;
  setting_style?: string | null;
  priority?: string;
  due_date?: string | null;
  deposit_due_date?: string | null;
  quoted_price?: number | null;
  deposit_amount?: number | null;
  deposit_received?: boolean;
  final_price?: number | null;
  description?: string | null;
  internal_notes?: string | null;
  client_notes?: string | null;
  // Tracking fields
  customer_email?: string | null;
  estimated_completion_date?: string | null;
}

interface Props {
  customers: Customer[];
  mode: "create" | "edit";
  job?: JobData;
  preselectedCustomerId?: string;
}

// ────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────

const RING_SIZES = [
  "A", "A½", "B", "B½", "C", "C½", "D", "D½", "E", "E½",
  "F", "F½", "G", "G½", "H", "H½", "I", "I½", "J", "J½",
  "K", "K½", "L", "L½", "M", "M½", "N", "N½", "O", "O½",
  "P", "P½", "Q", "Q½", "R", "R½", "S", "S½", "T", "T½",
  "U", "U½", "V", "V½", "W", "W½", "X", "X½", "Y", "Y½", "Z", "Z+1", "Z+2",
];

// ────────────────────────────────────────────────────────────────
// Shared UI helpers
// ────────────────────────────────────────────────────────────────

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-stone-900 mb-1">
      {children}
      {required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  );
}

const inputCls =
  "w-full px-3 py-2 text-sm bg-white border border-stone-200 rounded-lg text-stone-900 placeholder-stone-300 focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600 transition-colors";

function SectionCard({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
      <h2 className="text-base font-semibold text-stone-900">{title}</h2>
      {hint && <p className="text-xs text-stone-400 mt-0.5 mb-4">{hint}</p>}
      <div className={hint ? "" : "mt-4"}>{children}</div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Main Form
// ────────────────────────────────────────────────────────────────

export default function BespokeJobForm({ customers, mode, job, preselectedCustomerId }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Jewellery type drives conditional Ring Details section
  const [jewelleryType, setJewelleryType] = useState(job?.jewellery_type ?? "");
  const [showStone, setShowStone] = useState(
    !!(job?.stone_type || job?.stone_shape || job?.stone_carat)
  );

  // Customer search state — preselectedCustomerId takes priority (returned from "create customer" flow)
  const initialCustomerId = preselectedCustomerId || job?.customer_id || "";
  const [customerSearch, setCustomerSearch] = useState(
    customers.find((c) => c.id === initialCustomerId)?.full_name ?? ""
  );
  const [selectedCustomerId, setSelectedCustomerId] = useState(initialCustomerId);
  const [showCustomerList, setShowCustomerList] = useState(false);

  const filteredCustomers = customers.filter((c) =>
    (c.full_name ?? "").toLowerCase().includes(customerSearch.toLowerCase())
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("customer_id", selectedCustomerId);

    startTransition(async () => {
      try {
        if (mode === "create") {
          const result = await createBespokeJob(fd);
          if (result?.error) setError(result.error);
        } else if (job?.id) {
          const result = await updateBespokeJob(job.id, fd);
          if (result?.error) setError(result.error);
        }
      } catch (err) {
        // Preserve Next's redirect sentinel; surface everything else to the user
        // instead of letting the form look like it saved silently.
        if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) throw err;
        setError(err instanceof Error ? err.message : "Save failed. Please try again.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* ── 1. Customer ─────────────────────────────────────────── */}
      <SectionCard title="Customer" hint="Link this job to an existing customer">
        <input type="hidden" name="customer_id" value={selectedCustomerId} readOnly />
        <div className="relative">
          <FieldLabel>Customer</FieldLabel>
          <input
            type="text"
            value={customerSearch}
            onChange={(e) => {
              setCustomerSearch(e.target.value);
              setSelectedCustomerId("");
              setShowCustomerList(true);
            }}
            onFocus={() => setShowCustomerList(true)}
            onBlur={() => setTimeout(() => setShowCustomerList(false), 150)}
            placeholder="Search customers…"
            className={inputCls}
            autoComplete="off"
          />
          {showCustomerList && filteredCustomers.length > 0 && (
            <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-stone-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {filteredCustomers.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onMouseDown={() => {
                    setSelectedCustomerId(c.id);
                    setCustomerSearch(c.full_name ?? "");
                    setShowCustomerList(false);
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm text-stone-900 hover:bg-stone-50 transition-colors"
                >
                  {c.full_name}
                </button>
              ))}
            </div>
          )}
          <p className="mt-2 text-xs text-stone-400">
            Customer not listed?{" "}
            <a href="/customers/new?returnTo=/bespoke/new" className="text-amber-700 hover:underline">
              Add a new customer →
            </a>
          </p>
        </div>
      </SectionCard>

      {/* ── 2. Job Details ─────────────────────────────────────── */}
      <SectionCard title="Job Details">
        <div className="space-y-4">
          <div>
            <FieldLabel required>Title</FieldLabel>
            <input
              type="text"
              name="title"
              defaultValue={job?.title ?? ""}
              required
              placeholder="e.g. Oval Diamond Engagement Ring"
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel>Jewellery Type</FieldLabel>
              <select
                name="jewellery_type"
                value={jewelleryType}
                onChange={(e) => setJewelleryType(e.target.value)}
                className={inputCls}
              >
                <option value="">Select type</option>
                <option value="ring">Ring</option>
                <option value="bracelet">Bracelet</option>
                <option value="necklace">Necklace</option>
                <option value="earrings">Earrings</option>
                <option value="pendant">Pendant</option>
                <option value="bangle">Bangle</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <FieldLabel>Order Type</FieldLabel>
              <select name="order_type" defaultValue={job?.order_type ?? "bespoke"} className={inputCls}>
                <option value="bespoke">Bespoke</option>
                <option value="redesign">Redesign</option>
                <option value="modification">Modification</option>
                <option value="repair">Repair</option>
              </select>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ── 3. Metal ───────────────────────────────────────────── */}
      <SectionCard title="Metal">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <FieldLabel>Metal Type</FieldLabel>
            <select name="metal_type" defaultValue={job?.metal_type ?? ""} className={inputCls}>
              <option value="">Select metal</option>
              <option value="gold">Gold</option>
              <option value="platinum">Platinum</option>
              <option value="silver">Silver</option>
              <option value="rose_gold">Rose Gold</option>
              <option value="palladium">Palladium</option>
            </select>
          </div>
          <div>
            <FieldLabel>Metal Colour</FieldLabel>
            <select name="metal_colour" defaultValue={job?.metal_colour ?? ""} className={inputCls}>
              <option value="">Select colour</option>
              <option value="yellow">Yellow</option>
              <option value="white">White</option>
              <option value="rose">Rose</option>
              <option value="green">Green</option>
            </select>
          </div>
          <div>
            <FieldLabel>Purity</FieldLabel>
            <select name="metal_purity" defaultValue={job?.metal_purity ?? ""} className={inputCls}>
              <option value="">Select purity</option>
              {["18K", "14K", "9K", "750", "950", "925", "Other"].map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel>Weight (grams)</FieldLabel>
            <input
              type="number"
              name="metal_weight_grams"
              defaultValue={job?.metal_weight_grams ?? ""}
              step="0.01"
              min="0"
              placeholder="Optional"
              className={inputCls}
            />
          </div>
        </div>
      </SectionCard>

      {/* ── 4. Stone Details (collapsible) ─────────────────────── */}
      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
        <button
          type="button"
          onClick={() => setShowStone(!showStone)}
          className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-stone-50/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-stone-900">Stone Details</span>
            <span className="text-xs text-stone-400 bg-stone-200 px-2 py-0.5 rounded-full">optional</span>
          </div>
          <svg
            className={`w-5 h-5 text-stone-400 transition-transform ${showStone ? "rotate-180" : ""}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {showStone && (
          <div className="px-6 pb-6 border-t border-stone-200">
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <FieldLabel>Stone Type</FieldLabel>
                <select name="stone_type" defaultValue={job?.stone_type ?? ""} className={inputCls}>
                  <option value="">Select stone</option>
                  <option value="diamond">Diamond</option>
                  <option value="lab_diamond">Lab Diamond</option>
                  <option value="sapphire">Sapphire</option>
                  <option value="ruby">Ruby</option>
                  <option value="emerald">Emerald</option>
                  <option value="pearl">Pearl</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <FieldLabel>Shape</FieldLabel>
                <select name="stone_shape" defaultValue={job?.stone_shape ?? ""} className={inputCls}>
                  <option value="">Select shape</option>
                  <option value="round_brilliant">Round Brilliant</option>
                  <option value="oval">Oval</option>
                  <option value="cushion">Cushion</option>
                  <option value="princess">Princess</option>
                  <option value="emerald">Emerald</option>
                  <option value="pear">Pear</option>
                  <option value="marquise">Marquise</option>
                  <option value="radiant">Radiant</option>
                  <option value="asscher">Asscher</option>
                  <option value="heart">Heart</option>
                </select>
              </div>
              <div>
                <FieldLabel>Carat Weight</FieldLabel>
                <input
                  type="number"
                  name="stone_carat"
                  defaultValue={job?.stone_carat ?? ""}
                  step="0.01"
                  min="0"
                  placeholder="e.g. 1.50"
                  className={inputCls}
                />
              </div>
              <div>
                <FieldLabel>Colour</FieldLabel>
                <select name="stone_colour" defaultValue={job?.stone_colour ?? ""} className={inputCls}>
                  <option value="">Select colour</option>
                  {"DEFGHIJKLMNOPQRSTUVWXYZ".split("").map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel>Clarity</FieldLabel>
                <select name="stone_clarity" defaultValue={job?.stone_clarity ?? ""} className={inputCls}>
                  <option value="">Select clarity</option>
                  {["IF", "VVS1", "VVS2", "VS1", "VS2", "SI1", "SI2", "I1"].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel>Origin</FieldLabel>
                <input
                  type="text"
                  name="stone_origin"
                  defaultValue={job?.stone_origin ?? ""}
                  placeholder="e.g. Botswana (optional)"
                  className={inputCls}
                />
              </div>
              <div className="col-span-2">
                <FieldLabel>Certificate Number</FieldLabel>
                <input
                  type="text"
                  name="stone_cert_number"
                  defaultValue={job?.stone_cert_number ?? ""}
                  placeholder="GIA / IGI cert number (optional)"
                  className={inputCls}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 5. Ring Details (conditional) ──────────────────────── */}
      {jewelleryType === "ring" && (
        <SectionCard title="Ring Details">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel>Ring Size</FieldLabel>
              <select name="ring_size" defaultValue={job?.ring_size ?? ""} className={inputCls}>
                <option value="">Select size</option>
                {RING_SIZES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel>Setting Style</FieldLabel>
              <select name="setting_style" defaultValue={job?.setting_style ?? ""} className={inputCls}>
                <option value="">Select style</option>
                <option value="solitaire">Solitaire</option>
                <option value="pave">Pavé</option>
                <option value="channel">Channel</option>
                <option value="bezel">Bezel</option>
                <option value="tension">Tension</option>
                <option value="cluster">Cluster</option>
                <option value="halo">Halo</option>
                <option value="three_stone">Three-Stone</option>
              </select>
            </div>
          </div>
        </SectionCard>
      )}

      {/* ── 6. Timeline & Pricing ───────────────────────────────── */}
      <SectionCard title="Timeline & Pricing">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <FieldLabel>Due Date</FieldLabel>
            <input type="date" name="due_date" defaultValue={job?.due_date ?? ""} className={inputCls} />
          </div>
          <div>
            <FieldLabel>Priority</FieldLabel>
            <select name="priority" defaultValue={job?.priority ?? "normal"} className={inputCls}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div>
            <FieldLabel>Quoted Price</FieldLabel>
            <input type="number" name="quoted_price" defaultValue={job?.quoted_price ?? ""} step="0.01" min="0" placeholder="0.00" className={inputCls} />
          </div>
          <div>
            <FieldLabel>Deposit Amount</FieldLabel>
            <input type="number" name="deposit_amount" defaultValue={job?.deposit_amount ?? ""} step="0.01" min="0" placeholder="0.00" className={inputCls} />
          </div>
          <div>
            <FieldLabel>Deposit Due Date</FieldLabel>
            <input type="date" name="deposit_due_date" defaultValue={job?.deposit_due_date ?? ""} className={inputCls} />
          </div>
          <div>
            <FieldLabel>Final Price</FieldLabel>
            <input type="number" name="final_price" defaultValue={job?.final_price ?? ""} step="0.01" min="0" placeholder="0.00" className={inputCls} />
          </div>
          <div className="col-span-2 flex items-center gap-3 pt-1">
            <input
              type="checkbox"
              name="deposit_received"
              id="deposit_received"
              value="true"
              defaultChecked={job?.deposit_received ?? false}
              className="w-4 h-4 rounded border-stone-200 accent-sage cursor-pointer"
            />
            <label htmlFor="deposit_received" className="text-sm text-stone-900 cursor-pointer">
              Deposit received
            </label>
          </div>
        </div>
      </SectionCard>

      {/* ── 7. Customer Tracking ───────────────────────────────── */}
      <SectionCard title="Customer Tracking" hint="Send customers a tracking link to check their order status online">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <FieldLabel>Customer Email</FieldLabel>
            <input
              type="email"
              name="customer_email"
              defaultValue={job?.customer_email ?? ""}
              placeholder="customer@example.com"
              className={inputCls}
            />
            <p className="text-xs text-stone-400 mt-1">
              A tracking link will be emailed when the job is created
            </p>
          </div>
          <div>
            <FieldLabel>Est. Completion Date</FieldLabel>
            <input
              type="date"
              name="estimated_completion_date"
              defaultValue={job?.estimated_completion_date?.split("T")[0] ?? ""}
              className={inputCls}
            />
            <p className="text-xs text-stone-400 mt-1">
              Shown to customer on tracking page
            </p>
          </div>
        </div>
        {mode === "edit" && job?.tracking_id && (
          <div className="mt-4 p-3 bg-stone-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-stone-500 uppercase tracking-wider mb-1">
                  Tracking ID
                </p>
                <p className="font-mono font-semibold text-stone-900">
                  {job.tracking_id}
                </p>
              </div>
              <a
                href={`/track/${job.tracking_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-amber-700 hover:underline flex items-center gap-1"
              >
                View tracking page
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </div>
        )}
      </SectionCard>

      {/* ── 8. Notes ─────────────────────────────────────────────── */}
      <SectionCard title="Notes">
        <div className="space-y-4">
          <div>
            <FieldLabel>Description</FieldLabel>
            <p className="text-xs text-stone-400 mb-1.5">Shown to the client</p>
            <textarea
              name="description"
              defaultValue={job?.description ?? ""}
              placeholder="Describe the piece…"
              rows={3}
              className={inputCls + " resize-none"}
            />
          </div>
          <div>
            <FieldLabel>Internal Notes</FieldLabel>
            <p className="text-xs text-stone-400 mb-1.5">Staff only — never shared with client</p>
            <textarea
              name="internal_notes"
              defaultValue={job?.internal_notes ?? ""}
              placeholder="Internal notes…"
              rows={3}
              className={inputCls + " resize-none"}
            />
          </div>
          <div>
            <FieldLabel>Client Notes / Requests</FieldLabel>
            <textarea
              name="client_notes"
              defaultValue={job?.client_notes ?? ""}
              placeholder="Specific requests from the client…"
              rows={3}
              className={inputCls + " resize-none"}
            />
          </div>
        </div>
      </SectionCard>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pb-8">
        <a href="/bespoke" className="text-sm text-stone-500 hover:text-stone-900 transition-colors">
          Cancel
        </a>
        <SubmitButton
          isPending={isPending}
          idleLabel={mode === "create" ? "Create Job" : "Save Changes"}
          pendingLabel="Saving…"
          className="bg-amber-700 text-white text-sm font-medium px-6 py-2.5 rounded-lg hover:bg-amber-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>
    </form>
  );
}
