"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createCustomer, updateCustomer } from "./actions";

type CustomerData = {
  id?: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  mobile?: string | null;
  phone?: string | null;
  address_line1?: string | null;
  suburb?: string | null;
  state?: string | null;
  postcode?: string | null;
  country?: string | null;
  ring_size?: string | null;
  preferred_metal?: string | null;
  birthday?: string | null;
  anniversary?: string | null;
  tags?: string[] | null;
  notes?: string | null;
  is_vip?: boolean | null;
};

interface Props {
  mode: "create" | "edit";
  customer?: CustomerData;
  returnTo?: string;
}

const RING_SIZES = [
  "A", "A½", "B", "B½", "C", "C½", "D", "D½", "E", "E½",
  "F", "F½", "G", "G½", "H", "H½", "I", "I½", "J", "J½",
  "K", "K½", "L", "L½", "M", "M½", "N", "N½", "O", "O½",
  "P", "P½", "Q", "Q½", "R", "R½", "S", "S½", "T", "T½",
  "U", "U½", "V", "V½", "W", "W½", "X", "X½", "Y", "Y½", "Z", "Z+",
];

const METALS = ["Yellow Gold", "White Gold", "Rose Gold", "Platinum", "Silver"];
const STANDARD_TAGS = ["VIP", "Wholesale", "Trade", "Regular"];

const TAG_COLORS: Record<string, string> = {
  VIP: "bg-amber-700/10 text-amber-700 border-amber-600/30",
  Wholesale: "bg-stone-100 text-amber-700 border-amber-600/30",
  Trade: "bg-stone-900/10 text-stone-900 border-stone-900/30",
  Regular: "bg-stone-200 text-stone-500 border-stone-200",
};

export default function CustomerForm({ mode, customer, returnTo }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [duplicateId, setDuplicateId] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>(
    customer?.tags?.filter((t) => STANDARD_TAGS.includes(t)) || []
  );
  const [customTags, setCustomTags] = useState(
    customer?.tags?.filter((t) => !STANDARD_TAGS.includes(t)).join(", ") || ""
  );

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setDuplicateId(null);
    const formData = new FormData(e.currentTarget);

    // Add selected tags
    selectedTags.forEach((t) => formData.append("tags", t));
    formData.set("custom_tags", customTags);

    startTransition(async () => {
      try {
        if (mode === "create") {
          const result = await createCustomer(formData);
          if (result.error) {
            setError(result.error);
            if (result.duplicateId) setDuplicateId(result.duplicateId);
          } else if (result.id) {
            // If there's a returnTo URL (e.g. coming from bespoke/repair new form),
            // redirect back there with the new customer pre-selected
            if (returnTo) {
              router.push(`${returnTo}?customer_id=${result.id}`);
            } else {
              router.push(`/customers/${result.id}`);
            }
          } else {
            // Action returned neither error nor id - don't leave the user staring
            // at a silent form. This shouldn't happen under normal flow.
            setError("Save did not complete. Please try again.");
          }
        } else if (mode === "edit" && customer?.id) {
          const result = await updateCustomer(customer.id, formData);
          if (result.error) {
            setError(result.error);
          } else {
            router.push(`/customers/${customer.id}`);
          }
        }
      } catch (err) {
        // Preserve Next's redirect sentinel; surface everything else to the user
        // so saves never look silently successful when they weren't.
        if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) throw err;
        setError(err instanceof Error ? err.message : "Save failed. Please try again.");
      }
    });
  }

  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <h2 className="text-base font-semibold text-stone-900 mb-4">{children}</h2>
  );

  const Label = ({ children }: { children: React.ReactNode }) => (
    <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">
      {children}
    </label>
  );

  const inputClass = "w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-amber-600 bg-white";
  const selectClass = "w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-amber-600 bg-white";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <div className="flex-1">
            {error}
            {duplicateId && (
              <>
                {" "}
                <Link
                  href={`/customers/${duplicateId}`}
                  className="underline font-medium hover:text-red-900"
                >
                  View existing customer →
                </Link>
              </>
            )}
          </div>
        </div>
      )}

      {/* Personal Details */}
      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <SectionTitle>Personal Details</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>First Name</Label>
            <input name="first_name" defaultValue={customer?.first_name || ""} className={inputClass} placeholder="Jane" />
          </div>
          <div>
            <Label>Last Name</Label>
            <input name="last_name" defaultValue={customer?.last_name || ""} className={inputClass} placeholder="Smith" />
          </div>
          <div>
            <Label>Email</Label>
            <input name="email" type="email" defaultValue={customer?.email || ""} className={inputClass} placeholder="jane@example.com" />
          </div>
          <div>
            <Label>Mobile</Label>
            <input name="mobile" type="tel" defaultValue={customer?.mobile || ""} className={inputClass} placeholder="+61 400 000 000" />
          </div>
          <div>
            <Label>Phone (landline)</Label>
            <input name="phone" type="tel" defaultValue={customer?.phone || ""} className={inputClass} placeholder="+61 2 9000 0000" />
          </div>
        </div>
      </div>

      {/* Address */}
      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <SectionTitle>Address</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Label>Street Address</Label>
            <input name="address_line1" defaultValue={customer?.address_line1 || ""} className={inputClass} placeholder="123 Main Street" />
          </div>
          <div>
            <Label>Suburb</Label>
            <input name="suburb" defaultValue={customer?.suburb || ""} className={inputClass} placeholder="Sydney" />
          </div>
          <div>
            <Label>State</Label>
            <select name="state" defaultValue={customer?.state || ""} className={selectClass}>
              <option value="">Select state</option>
              <option value="NSW">NSW</option>
              <option value="VIC">VIC</option>
              <option value="QLD">QLD</option>
              <option value="WA">WA</option>
              <option value="SA">SA</option>
              <option value="TAS">TAS</option>
              <option value="ACT">ACT</option>
              <option value="NT">NT</option>
            </select>
          </div>
          <div>
            <Label>Postcode</Label>
            <input name="postcode" defaultValue={customer?.postcode || ""} className={inputClass} placeholder="2000" />
          </div>
          <div>
            <Label>Country</Label>
            <select name="country" defaultValue={customer?.country || "Australia"} className={selectClass}>
              <option value="Australia">Australia</option>
              <option value="New Zealand">New Zealand</option>
              <option value="United Kingdom">United Kingdom</option>
              <option value="United States">United States</option>
              <option value="Canada">Canada</option>
            </select>
          </div>
        </div>
      </div>

      {/* Jewellery Preferences */}
      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <SectionTitle>Jewellery Preferences</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Ring Size</Label>
            <select name="ring_size" defaultValue={customer?.ring_size || ""} className={selectClass}>
              <option value="">Select size…</option>
              {RING_SIZES.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Preferred Metal</Label>
            <select name="preferred_metal" defaultValue={customer?.preferred_metal || ""} className={selectClass}>
              <option value="">Select metal…</option>
              {METALS.map((metal) => (
                <option key={metal} value={metal}>{metal}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Important Dates */}
      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <SectionTitle>Important Dates</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Birthday</Label>
            <input
              name="birthday"
              type="date"
              defaultValue={customer?.birthday ? customer.birthday.split("T")[0] : ""}
              className={inputClass}
            />
          </div>
          <div>
            <Label>Anniversary</Label>
            <input
              name="anniversary"
              type="date"
              defaultValue={customer?.anniversary ? customer.anniversary.split("T")[0] : ""}
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* Tags */}
      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <SectionTitle>Tags</SectionTitle>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {STANDARD_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-all ${
                  selectedTags.includes(tag)
                    ? `${TAG_COLORS[tag] || "bg-stone-100 text-amber-700 border-amber-600/30"} shadow-sm`
                    : "bg-white text-stone-500 border-stone-200 hover:border-stone-900/30"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
          <div>
            <Label>Custom Tags (comma-separated)</Label>
            <input
              value={customTags}
              onChange={(e) => setCustomTags(e.target.value)}
              className={inputClass}
              placeholder="e.g. Corporate, Bridal, Collector"
            />
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <SectionTitle>Notes</SectionTitle>
        <textarea
          name="notes"
          defaultValue={customer?.notes || ""}
          rows={4}
          className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-amber-600 bg-white resize-none"
          placeholder="Any special notes about this customer…"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-5 py-2.5 text-sm font-medium border border-stone-900/20 text-stone-900 rounded-lg hover:border-stone-900/40 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="px-6 py-2.5 bg-amber-700 text-white text-sm font-medium rounded-lg hover:bg-amber-800 transition-colors disabled:opacity-50"
        >
          {isPending
            ? mode === "create" ? "Creating…" : "Saving…"
            : mode === "create" ? "Create Customer" : "Save Changes"
          }
        </button>
      </div>
    </form>
  );
}
