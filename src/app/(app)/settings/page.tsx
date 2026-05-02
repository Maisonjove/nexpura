"use client";

// SECURITY NOTE: This page lives inside the (app) layout which requires real Supabase
// session auth — unauthenticated requests are redirected to /login before reaching here.
// The review sandbox routes (/review/*) use a completely separate read-only layout and
// do NOT link to /settings — reviewers cannot access or mutate settings by design.

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  saveBusinessProfile,
  saveTaxCurrency,
  saveBanking,
  saveAccount,
  getBankingForSettings,
} from "./actions";
import LogoUpload from "./LogoUpload";
import SecurityTab from "./SecurityTab";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Check, CircleAlert, HelpCircle } from "lucide-react";

type Tenant = {
  id: string;
  name: string | null;
  business_name: string | null;
  business_type: string | null;
  business_mode: string | null;
  logo_url: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  abn: string | null;
  address_line1: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  country: string | null;
  currency: string | null;
  timezone: string | null;
  tax_name: string | null;
  tax_rate: number | null;
  tax_inclusive: boolean | null;
  bank_name: string | null;
  bank_bsb: string | null;
  bank_account: string | null;
  invoice_footer: string | null;
  invoice_accent_color: string | null;
};

type User = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  tenant_id: string | null;
};

type Subscription = {
  plan: string | null;
  status: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
};

const TABS = ["Business Profile", "Tax & Currency", "Banking", "Account", "Security"] as const;
type Tab = (typeof TABS)[number];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Business Profile");
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      const { data: userData } = await supabase
        .from("users")
        .select("*")
        .eq("id", authUser.id)
        .single();

      if (userData) {
        setUser(userData as User);

        const { data: tenantData } = await supabase
          .from("tenants")
          .select("*")
          .eq("id", userData.tenant_id)
          .single();

        if (tenantData) {
          // W6-HIGH-13: bank_bsb + bank_account are encrypted at rest.
          // Fetch decrypted values via server action (the AES key is
          // server-only) and merge over the raw tenant row before
          // hydrating the form.
          const banking = await getBankingForSettings();
          const merged: Tenant = {
            ...(tenantData as Tenant),
            bank_name: banking.data?.bank_name ?? tenantData.bank_name ?? null,
            bank_bsb: banking.data?.bank_bsb ?? null,
            bank_account: banking.data?.bank_account ?? null,
          };
          setTenant(merged);
          if (tenantData.logo_url) setLogoPreview(tenantData.logo_url);
        }

        const { data: subData } = await supabase
          .from("subscriptions")
          .select("plan, status, trial_ends_at, current_period_end")
          .eq("tenant_id", userData.tenant_id)
          .single();

        if (subData) setSubscription(subData as Subscription);
      }
      setLoading(false);
    }
    load();
  }, []);

  function showSuccess(msg: string) {
    setSuccessMsg(msg);
    setErrorMsg(null);
    setTimeout(() => setSuccessMsg(null), 3000);
  }

  function showError(msg: string) {
    setErrorMsg(msg);
    setSuccessMsg(null);
    setTimeout(() => setErrorMsg(null), 5000);
  }

  async function handleBusinessSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    if (!tenant) return;
    startTransition(async () => {
      const result = await saveBusinessProfile(tenant.id, formData);
      if (result.error) showError(result.error);
      else showSuccess("Business profile saved!");
    });
  }

  async function handleTaxSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    if (!tenant) return;
    startTransition(async () => {
      const result = await saveTaxCurrency(tenant.id, formData);
      if (result.error) showError(result.error);
      else showSuccess("Tax & currency settings saved!");
    });
  }

  async function handleBankingSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    if (!tenant) return;
    startTransition(async () => {
      const result = await saveBanking(tenant.id, formData);
      if (result.error) showError(result.error);
      else showSuccess("Banking details saved!");
    });
  }

  async function handleAccountSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    if (!user) return;
    startTransition(async () => {
      // saveAccount resolves the acting user from the session; the id is no
      // longer trusted from the client (PR-01 / W6-CRIT-02).
      const result = await saveAccount(undefined, formData);
      if (result.error) showError(result.error);
      else {
        showSuccess("Account details saved!");
        setUser((prev) => prev ? { ...prev, full_name: formData.get("full_name") as string } : prev);
      }
    });
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Static header — renders on SSR so the page never looks blank */}
        <div>
          <h1 className="font-serif text-[28px] leading-tight text-nexpura-charcoal">Settings</h1>
          <p className="text-nexpura-charcoal-500 mt-1 text-sm">Manage workspace preferences.</p>
        </div>
        <div className="animate-pulse space-y-4">
          <div className="h-12 bg-nexpura-taupe-100 rounded" />
          <div className="h-64 bg-nexpura-taupe-100 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-serif text-[28px] leading-tight text-nexpura-charcoal">Settings</h1>
        <p className="text-nexpura-charcoal-500 mt-1 text-sm">Manage workspace preferences.</p>
      </div>

      {/* Toast */}
      {successMsg && (
        <div className="flex items-center gap-3 bg-nexpura-ivory-elevated border border-nexpura-taupe-100 text-nexpura-charcoal-700 rounded-xl px-4 py-3 text-sm">
          <Check className="w-4 h-4 flex-shrink-0 text-nexpura-bronze" strokeWidth={1.5} />
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          <CircleAlert className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
          {errorMsg}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-nexpura-taupe-100">
        <nav className="flex gap-1 -mb-px">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-nexpura-bronze text-nexpura-charcoal"
                  : "border-transparent text-nexpura-taupe-400 hover:text-nexpura-charcoal hover:border-nexpura-taupe-100"
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Business Profile Tab */}
      {activeTab === "Business Profile" && (
        <form onSubmit={handleBusinessSubmit} className="space-y-6">
          {/* Logo */}
          <div className="bg-nexpura-ivory-elevated rounded-xl border border-nexpura-taupe-100 p-6 space-y-4">
            <h2 className="text-base font-semibold text-nexpura-charcoal">Business Logo</h2>
            {tenant?.id && (
              <LogoUpload
                tenantId={tenant.id}
                currentLogoUrl={logoPreview}
                onLogoChange={(url) => {
                  setLogoPreview(url);
                  setTenant((prev) => prev ? { ...prev, logo_url: url } : prev);
                }}
              />
            )}
          </div>

          {/* Business info */}
          <div className="bg-nexpura-ivory-elevated rounded-xl border border-nexpura-taupe-100 p-6 space-y-4">
            <h2 className="text-base font-semibold text-nexpura-charcoal">Business Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-nexpura-charcoal-700">Business Name</label>
                <input
                  name="business_name"
                  defaultValue={tenant?.business_name || tenant?.name || ""}
                  className="w-full h-10 px-3 text-sm border border-nexpura-taupe-100 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-nexpura-bronze focus:ring-offset-2 focus:border-nexpura-bronze"
                  placeholder="My Jewellery Studio"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-nexpura-charcoal-700">Business Type</label>
                <select
                  name="business_type"
                  defaultValue={tenant?.business_type || ""}
                  className="w-full h-10 px-3 text-sm border border-nexpura-taupe-100 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-nexpura-bronze focus:ring-offset-2 focus:border-nexpura-bronze"
                >
                  <option value="">Select type…</option>
                  <option value="jeweller">Jeweller</option>
                  <option value="watchmaker">Watchmaker</option>
                  <option value="goldsmith">Goldsmith</option>
                  <option value="silversmith">Silversmith</option>
                  <option value="designer">Designer / Studio</option>
                  <option value="retailer">Retailer</option>
                  <option value="wholesaler">Wholesaler</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-nexpura-charcoal-700">Workspace Mode</label>
                <select
                  name="business_mode"
                  defaultValue={tenant?.business_mode || "full"}
                  className="w-full h-10 px-3 text-sm border border-nexpura-taupe-100 rounded-md bg-white font-medium text-nexpura-charcoal focus:outline-none focus:ring-2 focus:ring-nexpura-bronze focus:ring-offset-2 focus:border-nexpura-bronze"
                >
                  <option value="full">Full (All Features)</option>
                  <option value="retail">Retail Focus (POS + Inventory)</option>
                  <option value="workshop">Workshop Focus (Repairs + Calendar)</option>
                  <option value="bespoke">Bespoke Focus (Custom Jobs)</option>
                </select>
                <p className="text-[12px] text-nexpura-taupe-400">Tailors the dashboard and navigation to your workflow.</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-nexpura-charcoal-700">Phone</label>
                <input
                  name="phone"
                  type="tel"
                  defaultValue={tenant?.phone || ""}
                  className="w-full h-10 px-3 text-sm border border-nexpura-taupe-100 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-nexpura-bronze focus:ring-offset-2 focus:border-nexpura-bronze"
                  placeholder="+61 2 9000 0000"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-nexpura-charcoal-700">Email</label>
                <input
                  name="email"
                  type="email"
                  defaultValue={tenant?.email || ""}
                  className="w-full h-10 px-3 text-sm border border-nexpura-taupe-100 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-nexpura-bronze focus:ring-offset-2 focus:border-nexpura-bronze"
                  placeholder="hello@mybusiness.com"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-nexpura-charcoal-700">Website</label>
                <input
                  name="website"
                  type="url"
                  defaultValue={tenant?.website || ""}
                  className="w-full h-10 px-3 text-sm border border-nexpura-taupe-100 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-nexpura-bronze focus:ring-offset-2 focus:border-nexpura-bronze"
                  placeholder="https://mybusiness.com"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-nexpura-charcoal-700">ABN</label>
                <input
                  name="abn"
                  defaultValue={tenant?.abn || ""}
                  className="w-full h-10 px-3 text-sm border border-nexpura-taupe-100 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-nexpura-bronze focus:ring-offset-2 focus:border-nexpura-bronze"
                  placeholder="12 345 678 901"
                />
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="bg-nexpura-ivory-elevated rounded-xl border border-nexpura-taupe-100 p-6 space-y-4">
            <h2 className="text-base font-semibold text-nexpura-charcoal">Business Address</h2>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-nexpura-charcoal-700">Street Address</label>
                <input
                  name="address_line1"
                  defaultValue={tenant?.address_line1 || ""}
                  className="w-full h-10 px-3 text-sm border border-nexpura-taupe-100 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-nexpura-bronze focus:ring-offset-2 focus:border-nexpura-bronze"
                  placeholder="123 Main Street"
                />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="col-span-2 sm:col-span-1 space-y-1.5">
                  <label className="text-[12px] font-medium text-nexpura-charcoal-700">Suburb</label>
                  <input
                    name="suburb"
                    defaultValue={tenant?.suburb || ""}
                    className="w-full h-10 px-3 text-sm border border-nexpura-taupe-100 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-nexpura-bronze focus:ring-offset-2 focus:border-nexpura-bronze"
                    placeholder="Sydney"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-nexpura-charcoal-700">State</label>
                  <select
                    name="state"
                    defaultValue={tenant?.state || ""}
                    className="w-full h-10 px-3 text-sm border border-nexpura-taupe-100 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-nexpura-bronze focus:ring-offset-2 focus:border-nexpura-bronze"
                  >
                    <option value="">State</option>
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
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-nexpura-charcoal-700">Postcode</label>
                  <input
                    name="postcode"
                    defaultValue={tenant?.postcode || ""}
                    className="w-full h-10 px-3 text-sm border border-nexpura-taupe-100 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-nexpura-bronze focus:ring-offset-2 focus:border-nexpura-bronze"
                    placeholder="2000"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-nexpura-charcoal-700">Country</label>
                  <select
                    name="country"
                    defaultValue={tenant?.country || "Australia"}
                    className="w-full h-10 px-3 text-sm border border-nexpura-taupe-100 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-nexpura-bronze focus:ring-offset-2 focus:border-nexpura-bronze"
                  >
                    <option value="Australia">Australia</option>
                    <option value="New Zealand">New Zealand</option>
                    <option value="United Kingdom">United Kingdom</option>
                    <option value="United States">United States</option>
                    <option value="Canada">Canada</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Invoice Customization */}
          <div className="bg-nexpura-ivory-elevated rounded-xl border border-nexpura-taupe-100 p-6 space-y-4">
            <h2 className="text-base font-semibold text-nexpura-charcoal">Invoice Customization</h2>
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-nexpura-charcoal-700">
                Accent Colour
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  name="invoice_accent_color"
                  defaultValue={tenant?.invoice_accent_color || '#1e3a5f'}
                  className="w-10 h-10 rounded cursor-pointer border border-nexpura-taupe-100"
                />
                <span className="text-[12px] text-nexpura-taupe-400">Used on invoice titles and totals.</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isPending}
              className="px-6 py-2.5 bg-nexpura-charcoal text-white text-sm font-medium rounded-lg hover:bg-nexpura-charcoal-700 transition-colors disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      )}

      {/* Tax & Currency Tab */}
      {activeTab === "Tax & Currency" && (
        <form onSubmit={handleTaxSubmit} className="space-y-6">
          <div className="bg-nexpura-ivory-elevated rounded-xl border border-nexpura-taupe-100 p-6 space-y-4">
            <h2 className="text-base font-semibold text-nexpura-charcoal">Currency & Timezone</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-nexpura-charcoal-700">Currency</label>
                <select
                  name="currency"
                  defaultValue={tenant?.currency || "AUD"}
                  className="w-full h-10 px-3 text-sm border border-nexpura-taupe-100 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-nexpura-bronze focus:ring-offset-2 focus:border-nexpura-bronze"
                >
                  <option value="AUD">AUD — Australian Dollar</option>
                  <option value="NZD">NZD — New Zealand Dollar</option>
                  <option value="USD">USD — US Dollar</option>
                  <option value="GBP">GBP — British Pound</option>
                  <option value="EUR">EUR — Euro</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-nexpura-charcoal-700">Timezone</label>
                <select
                  name="timezone"
                  defaultValue={tenant?.timezone || "Australia/Sydney"}
                  className="w-full h-10 px-3 text-sm border border-nexpura-taupe-100 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-nexpura-bronze focus:ring-offset-2 focus:border-nexpura-bronze"
                >
                  <option value="Australia/Sydney">Australia/Sydney (AEDT)</option>
                  <option value="Australia/Melbourne">Australia/Melbourne (AEDT)</option>
                  <option value="Australia/Brisbane">Australia/Brisbane (AEST)</option>
                  <option value="Australia/Adelaide">Australia/Adelaide (ACDT)</option>
                  <option value="Australia/Perth">Australia/Perth (AWST)</option>
                  <option value="Australia/Darwin">Australia/Darwin (ACST)</option>
                  <option value="Australia/Hobart">Australia/Hobart (AEDT)</option>
                  <option value="Pacific/Auckland">Pacific/Auckland (NZDT)</option>
                  <option value="Europe/London">Europe/London (GMT/BST)</option>
                  <option value="America/New_York">America/New_York (EST/EDT)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-nexpura-ivory-elevated rounded-xl border border-nexpura-taupe-100 p-6 space-y-4">
            <h2 className="text-base font-semibold text-nexpura-charcoal">Tax Settings</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-nexpura-charcoal-700">Tax Name</label>
                <select
                  name="tax_name"
                  defaultValue={tenant?.tax_name || "GST"}
                  className="w-full h-10 px-3 text-sm border border-nexpura-taupe-100 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-nexpura-bronze focus:ring-offset-2 focus:border-nexpura-bronze"
                >
                  <option value="GST">GST</option>
                  <option value="VAT">VAT</option>
                  <option value="Tax">Tax</option>
                  <option value="None">None</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <label className="text-[12px] font-medium text-nexpura-charcoal-700">Tax Rate (%)</label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <HelpCircle className="h-3.5 w-3.5 text-nexpura-taupe-400" strokeWidth={1.5} />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>The tax rate applied to all sales. In Australia this is GST at 10%. Adjust for your local tax jurisdiction.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <input
                  name="tax_rate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  defaultValue={tenant?.tax_rate != null ? (tenant.tax_rate * 100).toFixed(0) : "10"}
                  className="w-full h-10 px-3 text-sm border border-nexpura-taupe-100 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-nexpura-bronze focus:ring-offset-2 focus:border-nexpura-bronze"
                  placeholder="10"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-nexpura-charcoal-700">Tax Inclusive</label>
                <div className="flex items-center h-[38px]">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      name="tax_inclusive"
                      type="checkbox"
                      defaultChecked={tenant?.tax_inclusive ?? false}
                      value="true"
                      className="w-4 h-4 accent-sage rounded"
                    />
                    <span className="text-sm text-nexpura-charcoal">Prices include tax</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isPending}
              className="px-6 py-2.5 bg-nexpura-charcoal text-white text-sm font-medium rounded-lg hover:bg-nexpura-charcoal-700 transition-colors disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      )}

      {/* Banking Tab */}
      {activeTab === "Banking" && (
        <form onSubmit={handleBankingSubmit} className="space-y-6">
          <div className="bg-nexpura-ivory-elevated rounded-xl border border-nexpura-taupe-100 p-6 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-nexpura-charcoal">Banking Details</h2>
              <p className="text-[12px] text-nexpura-taupe-400 mt-0.5">These appear on your invoices for direct deposit payments.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-[12px] font-medium text-nexpura-charcoal-700">Bank Name</label>
                <input
                  name="bank_name"
                  defaultValue={tenant?.bank_name || ""}
                  className="w-full h-10 px-3 text-sm border border-nexpura-taupe-100 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-nexpura-bronze focus:ring-offset-2 focus:border-nexpura-bronze"
                  placeholder="Commonwealth Bank"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-nexpura-charcoal-700">BSB</label>
                <input
                  name="bank_bsb"
                  defaultValue={tenant?.bank_bsb || ""}
                  className="w-full h-10 px-3 text-sm border border-nexpura-taupe-100 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-nexpura-bronze focus:ring-offset-2 focus:border-nexpura-bronze"
                  placeholder="062-000"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-nexpura-charcoal-700">Account Number</label>
                <input
                  name="bank_account"
                  defaultValue={tenant?.bank_account || ""}
                  className="w-full h-10 px-3 text-sm border border-nexpura-taupe-100 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-nexpura-bronze focus:ring-offset-2 focus:border-nexpura-bronze"
                  placeholder="1234 5678"
                />
              </div>
            </div>
          </div>

          <div className="bg-nexpura-ivory-elevated rounded-xl border border-nexpura-taupe-100 p-6 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-nexpura-charcoal">Invoice Footer</h2>
              <p className="text-[12px] text-nexpura-taupe-400 mt-0.5">This message appears at the bottom of every invoice PDF.</p>
            </div>
            <div className="space-y-1.5">
              <textarea
                name="invoice_footer"
                defaultValue={tenant?.invoice_footer || ""}
                rows={3}
                className="w-full px-3 py-2 text-sm border border-nexpura-taupe-100 rounded-md bg-white resize-none focus:outline-none focus:ring-2 focus:ring-nexpura-bronze focus:ring-offset-2 focus:border-nexpura-bronze"
                placeholder="Thank you for your business. Payment due within 7 days."
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isPending}
              className="px-6 py-2.5 bg-nexpura-charcoal text-white text-sm font-medium rounded-lg hover:bg-nexpura-charcoal-700 transition-colors disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      )}

      {/* Account Tab */}
      {activeTab === "Account" && (
        <div className="space-y-6">
          {/* Plan */}
          <div className="bg-nexpura-ivory-elevated rounded-xl border border-nexpura-taupe-100 p-6">
            <h2 className="text-base font-semibold text-nexpura-charcoal mb-4">Current Plan</h2>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${
                  subscription?.plan === "atelier" || subscription?.plan === "group" || subscription?.plan === "ultimate"
                    ? "bg-nexpura-charcoal text-white border border-nexpura-charcoal"
                    : subscription?.plan === "studio" || subscription?.plan === "pro"
                    ? "bg-nexpura-champagne text-nexpura-charcoal-700 border border-nexpura-taupe-100"
                    : "bg-nexpura-ivory text-nexpura-charcoal-500 border border-nexpura-taupe-100"
                }`}>
                  {subscription?.plan === "atelier" || subscription?.plan === "group" || subscription?.plan === "ultimate" ? "Atelier" :
                   subscription?.plan === "studio" || subscription?.plan === "pro" ? "Studio" : "Boutique"}
                </div>
                <span className="text-sm text-nexpura-charcoal-500">
                  {subscription?.status === "trialing"
                    ? `Trial ends ${new Date(subscription.trial_ends_at!).toLocaleDateString("en-AU")}`
                    : subscription?.status === "active"
                    ? `Renews ${new Date(subscription.current_period_end!).toLocaleDateString("en-AU")}`
                    : "No active subscription"}
                </span>
              </div>
              {subscription?.plan !== "atelier" && subscription?.plan !== "group" && subscription?.plan !== "ultimate" && (
                <Link href="/billing" className="px-4 py-2 text-sm font-medium bg-nexpura-charcoal text-white rounded-lg hover:bg-nexpura-charcoal-700 transition-colors text-center">
                  Upgrade plan
                </Link>
              )}
            </div>
          </div>

          {/* Account details */}
          <form onSubmit={handleAccountSubmit} className="space-y-6">
            <div className="bg-nexpura-ivory-elevated rounded-xl border border-nexpura-taupe-100 p-6 space-y-4">
              <h2 className="text-base font-semibold text-nexpura-charcoal">Account Details</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-[12px] font-medium text-nexpura-charcoal-700">Full Name</label>
                  <input
                    name="full_name"
                    defaultValue={user?.full_name || ""}
                    className="w-full h-10 px-3 text-sm border border-nexpura-taupe-100 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-nexpura-bronze focus:ring-offset-2 focus:border-nexpura-bronze"
                  />
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-[12px] font-medium text-nexpura-charcoal-700">Email</label>
                  <input
                    value={user?.email || ""}
                    readOnly
                    className="w-full h-10 px-3 text-sm border border-nexpura-taupe-100 rounded-md bg-nexpura-ivory text-nexpura-charcoal-500 cursor-not-allowed"
                  />
                  <p className="text-[12px] text-nexpura-taupe-400">Email cannot be changed here.</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                className="text-sm text-nexpura-charcoal-500 hover:text-nexpura-charcoal underline transition-colors"
                onClick={() => {
                  const supabase = createClient();
                  supabase.auth.resetPasswordForEmail(user?.email || "", {
                    redirectTo: `${window.location.origin}/auth/confirm?next=/settings`,
                  }).then(() => showSuccess("Password reset email sent!"));
                }}
              >
                Change password
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-6 py-2.5 bg-nexpura-charcoal text-white text-sm font-medium rounded-lg hover:bg-nexpura-charcoal-700 transition-colors disabled:opacity-50"
              >
                {isPending ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>

          {/* Data Export (GDPR) */}
          <div className="bg-nexpura-ivory-elevated rounded-xl border border-nexpura-taupe-100 p-6">
            <h2 className="text-base font-semibold text-nexpura-charcoal mb-2">Your Data</h2>
            <p className="text-sm text-nexpura-charcoal-500 mb-4">
              Download a copy of all your business data including customers, inventory, sales, repairs, and more.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={async () => {
                  setErrorMsg(null);
                  try {
                    const response = await fetch("/api/data-export", { method: "POST" });
                    if (!response.ok) throw new Error("Export failed");
                    const blob = await response.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `nexpura-export-${new Date().toISOString().split("T")[0]}.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    showSuccess("Data export downloaded!");
                  } catch {
                    setErrorMsg("Failed to export data. Please try again.");
                  }
                }}
                className="px-4 py-2 text-sm font-medium border border-nexpura-taupe-100 rounded-md text-nexpura-charcoal hover:bg-nexpura-ivory transition-colors"
              >
                Export all data
              </button>
              <span className="text-[12px] text-nexpura-taupe-400">JSON format · May take a minute for large accounts.</span>
            </div>
          </div>

          {/* Account Deletion (GDPR) */}
          <div className="bg-nexpura-ivory-elevated rounded-xl border border-red-200 p-6">
            <h2 className="text-base font-semibold text-red-900 mb-2">Delete Account</h2>
            <p className="text-sm text-nexpura-charcoal-500 mb-4">
              Permanently delete your account and all associated data. This action is irreversible after 30 days.
            </p>
            <button
              type="button"
              onClick={() => {
                if (confirm("Are you sure you want to delete your account? Your data will be permanently deleted after 30 days. You can cancel during this period.")) {
                  fetch("/api/data-delete", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ confirm: "DELETE MY DATA" }),
                  })
                    .then(res => res.json())
                    .then(data => {
                      if (data.status === "scheduled") {
                        showSuccess(`Account deletion scheduled for ${new Date(data.scheduled_for).toLocaleDateString()}. You can cancel this in Settings.`);
                      } else if (data.error) {
                        setErrorMsg(data.error);
                      }
                    })
                    .catch(() => setErrorMsg("Failed to request deletion"));
                }
              }}
              className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
            >
              Request account deletion
            </button>
          </div>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === "Security" && tenant && (
        <SecurityTab tenantId={tenant.id} />
      )}
    </div>
  );
}
