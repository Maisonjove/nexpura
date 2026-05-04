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
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  QuestionMarkCircleIcon,
} from "@heroicons/react/24/outline";

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

const INPUT_CLASS =
  "w-full h-10 px-3 text-sm border border-stone-200 rounded-lg bg-white text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200";

const LABEL_CLASS = "text-xs font-medium text-stone-700";

const CARD_CLASS =
  "bg-white border border-stone-200 rounded-2xl p-6 lg:p-8";

const SECTION_HEADING_CLASS = "font-serif text-xl text-stone-900 leading-tight";

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
      <div className="bg-nexpura-ivory min-h-screen -mx-4 sm:-mx-6 lg:-mx-8 -my-6 lg:-my-8">
        <div className="max-w-[1100px] mx-auto px-6 sm:px-10 lg:px-16 py-12 lg:py-16">
          {/* Page Header — renders on SSR so the page never looks blank */}
          <div className="mb-14">
            <p className="text-xs uppercase tracking-luxury text-stone-500 mb-3">
              Settings
            </p>
            <h1 className="font-serif text-4xl sm:text-5xl tracking-tight text-stone-900 leading-[1.08]">
              Workspace Settings
            </h1>
            <p className="text-stone-500 mt-4 max-w-xl leading-relaxed">
              Manage workspace preferences.
            </p>
          </div>
          <div className="animate-pulse space-y-4">
            <div className="h-12 bg-stone-100 rounded-lg" />
            <div className="h-64 bg-stone-100 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-nexpura-ivory min-h-screen -mx-4 sm:-mx-6 lg:-mx-8 -my-6 lg:-my-8">
      <div className="max-w-[1100px] mx-auto px-6 sm:px-10 lg:px-16 py-12 lg:py-16">
        {/* Page Header */}
        <div className="mb-14">
          <p className="text-xs uppercase tracking-luxury text-stone-500 mb-3">
            Settings
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl tracking-tight text-stone-900 leading-[1.08]">
            Workspace Settings
          </h1>
          <p className="text-stone-500 mt-4 max-w-xl leading-relaxed">
            Manage your business profile, tax, banking, account, and security preferences.
          </p>
        </div>

        {/* Toast */}
        {successMsg && (
          <div className="flex items-center gap-3 bg-white border border-stone-200 rounded-2xl px-5 py-4 text-sm text-stone-700 mb-8">
            <CheckCircleIcon className="w-5 h-5 flex-shrink-0 text-nexpura-bronze" strokeWidth={1.5} />
            {successMsg}
          </div>
        )}
        {errorMsg && (
          <div className="flex items-center gap-3 bg-white border border-red-200 rounded-2xl px-5 py-4 text-sm text-red-700 mb-8">
            <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0" strokeWidth={1.5} />
            {errorMsg}
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-stone-200 mb-10">
          <nav className="flex gap-1 -mb-px overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-sm border-b-2 transition-colors duration-200 whitespace-nowrap ${
                  activeTab === tab
                    ? "border-nexpura-bronze text-stone-900 font-medium"
                    : "border-transparent text-stone-500 hover:text-stone-900"
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        {/* Business Profile Tab */}
        {activeTab === "Business Profile" && (
          <form onSubmit={handleBusinessSubmit} className="space-y-8 lg:space-y-10">
            {/* Logo */}
            <section className={`${CARD_CLASS} space-y-5`}>
              <h2 className={SECTION_HEADING_CLASS}>Business Logo</h2>
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
            </section>

            {/* Business info */}
            <section className={`${CARD_CLASS} space-y-5`}>
              <h2 className={SECTION_HEADING_CLASS}>Business Information</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className={LABEL_CLASS}>Business Name</label>
                  <input
                    name="business_name"
                    defaultValue={tenant?.business_name || tenant?.name || ""}
                    className={INPUT_CLASS}
                    placeholder="My Jewellery Studio"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={LABEL_CLASS}>Business Type</label>
                  <select
                    name="business_type"
                    defaultValue={tenant?.business_type || ""}
                    className={INPUT_CLASS}
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
                  <label className={LABEL_CLASS}>Workspace Mode</label>
                  <select
                    name="business_mode"
                    defaultValue={tenant?.business_mode || "full"}
                    className={INPUT_CLASS}
                  >
                    <option value="full">Full (All Features)</option>
                    <option value="retail">Retail Focus (POS + Inventory)</option>
                    <option value="workshop">Workshop Focus (Repairs + Calendar)</option>
                    <option value="bespoke">Bespoke Focus (Custom Jobs)</option>
                  </select>
                  <p className="text-xs text-stone-500 leading-relaxed">Tailors the dashboard and navigation to your workflow.</p>
                </div>
                <div className="space-y-1.5">
                  <label className={LABEL_CLASS}>Phone</label>
                  <input
                    name="phone"
                    type="tel"
                    defaultValue={tenant?.phone || ""}
                    className={INPUT_CLASS}
                    placeholder="+61 2 9000 0000"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={LABEL_CLASS}>Email</label>
                  <input
                    name="email"
                    type="email"
                    defaultValue={tenant?.email || ""}
                    className={INPUT_CLASS}
                    placeholder="hello@mybusiness.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={LABEL_CLASS}>Website</label>
                  <input
                    name="website"
                    type="url"
                    defaultValue={tenant?.website || ""}
                    className={INPUT_CLASS}
                    placeholder="https://mybusiness.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={LABEL_CLASS}>ABN</label>
                  <input
                    name="abn"
                    defaultValue={tenant?.abn || ""}
                    className={INPUT_CLASS}
                    placeholder="12 345 678 901"
                  />
                </div>
              </div>
            </section>

            {/* Address */}
            <section className={`${CARD_CLASS} space-y-5`}>
              <h2 className={SECTION_HEADING_CLASS}>Business Address</h2>
              <div className="space-y-5">
                <div className="space-y-1.5">
                  <label className={LABEL_CLASS}>Street Address</label>
                  <input
                    name="address_line1"
                    defaultValue={tenant?.address_line1 || ""}
                    className={INPUT_CLASS}
                    placeholder="123 Main Street"
                  />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
                  <div className="col-span-2 sm:col-span-1 space-y-1.5">
                    <label className={LABEL_CLASS}>Suburb</label>
                    <input
                      name="suburb"
                      defaultValue={tenant?.suburb || ""}
                      className={INPUT_CLASS}
                      placeholder="Sydney"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className={LABEL_CLASS}>State</label>
                    <select
                      name="state"
                      defaultValue={tenant?.state || ""}
                      className={INPUT_CLASS}
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
                    <label className={LABEL_CLASS}>Postcode</label>
                    <input
                      name="postcode"
                      defaultValue={tenant?.postcode || ""}
                      className={INPUT_CLASS}
                      placeholder="2000"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className={LABEL_CLASS}>Country</label>
                    <select
                      name="country"
                      defaultValue={tenant?.country || "Australia"}
                      className={INPUT_CLASS}
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
            </section>

            {/* Invoice Customization */}
            <section className={`${CARD_CLASS} space-y-5`}>
              <h2 className={SECTION_HEADING_CLASS}>Invoice Customization</h2>
              <div className="space-y-1.5">
                <label className={LABEL_CLASS}>
                  Accent Colour
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    name="invoice_accent_color"
                    defaultValue={tenant?.invoice_accent_color || '#1e3a5f'}
                    className="w-10 h-10 rounded-lg cursor-pointer border border-stone-200"
                  />
                  <span className="text-xs text-stone-500 leading-relaxed">Used on invoice titles and totals.</span>
                </div>
              </div>
            </section>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isPending}
                className="nx-btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        )}

        {/* Tax & Currency Tab */}
        {activeTab === "Tax & Currency" && (
          <form onSubmit={handleTaxSubmit} className="space-y-8 lg:space-y-10">
            <section className={`${CARD_CLASS} space-y-5`}>
              <h2 className={SECTION_HEADING_CLASS}>Currency & Timezone</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className={LABEL_CLASS}>Currency</label>
                  <select
                    name="currency"
                    defaultValue={tenant?.currency || "AUD"}
                    className={INPUT_CLASS}
                  >
                    <option value="AUD">AUD — Australian Dollar</option>
                    <option value="NZD">NZD — New Zealand Dollar</option>
                    <option value="USD">USD — US Dollar</option>
                    <option value="GBP">GBP — British Pound</option>
                    <option value="EUR">EUR — Euro</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className={LABEL_CLASS}>Timezone</label>
                  <select
                    name="timezone"
                    defaultValue={tenant?.timezone || "Australia/Sydney"}
                    className={INPUT_CLASS}
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
            </section>

            <section className={`${CARD_CLASS} space-y-5`}>
              <h2 className={SECTION_HEADING_CLASS}>Tax Settings</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div className="space-y-1.5">
                  <label className={LABEL_CLASS}>Tax Name</label>
                  <select
                    name="tax_name"
                    defaultValue={tenant?.tax_name || "GST"}
                    className={INPUT_CLASS}
                  >
                    <option value="GST">GST</option>
                    <option value="VAT">VAT</option>
                    <option value="Tax">Tax</option>
                    <option value="None">None</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <label className={LABEL_CLASS}>Tax Rate (%)</label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <QuestionMarkCircleIcon className="h-3.5 w-3.5 text-stone-400" strokeWidth={1.5} />
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
                    className={INPUT_CLASS}
                    placeholder="10"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={LABEL_CLASS}>Tax Inclusive</label>
                  <div className="flex items-center h-10">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        name="tax_inclusive"
                        type="checkbox"
                        defaultChecked={tenant?.tax_inclusive ?? false}
                        value="true"
                        className="w-4 h-4 accent-nexpura-bronze rounded"
                      />
                      <span className="text-sm text-stone-700">Prices include tax</span>
                    </label>
                  </div>
                </div>
              </div>
            </section>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isPending}
                className="nx-btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        )}

        {/* Banking Tab */}
        {activeTab === "Banking" && (
          <form onSubmit={handleBankingSubmit} className="space-y-8 lg:space-y-10">
            <section className={`${CARD_CLASS} space-y-5`}>
              <div>
                <h2 className={SECTION_HEADING_CLASS}>Banking Details</h2>
                <p className="text-sm text-stone-500 mt-1.5 leading-relaxed">These appear on your invoices for direct deposit payments.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className={LABEL_CLASS}>Bank Name</label>
                  <input
                    name="bank_name"
                    defaultValue={tenant?.bank_name || ""}
                    className={INPUT_CLASS}
                    placeholder="Commonwealth Bank"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={LABEL_CLASS}>BSB</label>
                  <input
                    name="bank_bsb"
                    defaultValue={tenant?.bank_bsb || ""}
                    className={INPUT_CLASS}
                    placeholder="062-000"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={LABEL_CLASS}>Account Number</label>
                  <input
                    name="bank_account"
                    defaultValue={tenant?.bank_account || ""}
                    className={INPUT_CLASS}
                    placeholder="1234 5678"
                  />
                </div>
              </div>
            </section>

            <section className={`${CARD_CLASS} space-y-5`}>
              <div>
                <h2 className={SECTION_HEADING_CLASS}>Invoice Footer</h2>
                <p className="text-sm text-stone-500 mt-1.5 leading-relaxed">This message appears at the bottom of every invoice PDF.</p>
              </div>
              <div className="space-y-1.5">
                <textarea
                  name="invoice_footer"
                  defaultValue={tenant?.invoice_footer || ""}
                  rows={3}
                  className="w-full px-3 py-2.5 text-sm border border-stone-200 rounded-lg bg-white text-stone-900 placeholder:text-stone-400 resize-none focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
                  placeholder="Thank you for your business. Payment due within 7 days."
                />
              </div>
            </section>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isPending}
                className="nx-btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        )}

        {/* Account Tab */}
        {activeTab === "Account" && (
          <div className="space-y-8 lg:space-y-10">
            {/* Plan */}
            <section className={CARD_CLASS}>
              <h2 className={`${SECTION_HEADING_CLASS} mb-5`}>Current Plan</h2>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-luxury border ${
                    subscription?.plan === "atelier" || subscription?.plan === "group" || subscription?.plan === "ultimate"
                      ? "bg-stone-900 text-white border-stone-900"
                      : subscription?.plan === "studio" || subscription?.plan === "pro"
                      ? "bg-nexpura-champagne text-stone-700 border-stone-200"
                      : "bg-nexpura-ivory text-stone-500 border-stone-200"
                  }`}>
                    {subscription?.plan === "atelier" || subscription?.plan === "group" || subscription?.plan === "ultimate" ? "Atelier" :
                     subscription?.plan === "studio" || subscription?.plan === "pro" ? "Studio" : "Boutique"}
                  </div>
                  <span className="text-sm text-stone-500">
                    {subscription?.status === "trialing"
                      ? `Trial ends ${new Date(subscription.trial_ends_at!).toLocaleDateString("en-AU")}`
                      : subscription?.status === "active"
                      ? `Renews ${new Date(subscription.current_period_end!).toLocaleDateString("en-AU")}`
                      : "No active subscription"}
                  </span>
                </div>
                {subscription?.plan !== "atelier" && subscription?.plan !== "group" && subscription?.plan !== "ultimate" && (
                  <Link href="/billing" className="nx-btn-primary">
                    Upgrade plan
                  </Link>
                )}
              </div>
            </section>

            {/* Account details */}
            <form onSubmit={handleAccountSubmit} className="space-y-8 lg:space-y-10">
              <section className={`${CARD_CLASS} space-y-5`}>
                <h2 className={SECTION_HEADING_CLASS}>Account Details</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className={LABEL_CLASS}>Full Name</label>
                    <input
                      name="full_name"
                      defaultValue={user?.full_name || ""}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className={LABEL_CLASS}>Email</label>
                    <input
                      value={user?.email || ""}
                      readOnly
                      className="w-full h-10 px-3 text-sm border border-stone-200 rounded-lg bg-nexpura-ivory text-stone-500 cursor-not-allowed"
                    />
                    <p className="text-xs text-stone-500 leading-relaxed">Email cannot be changed here.</p>
                  </div>
                </div>
              </section>

              <div className="flex flex-wrap items-center justify-between gap-4">
                <button
                  type="button"
                  className="text-sm text-stone-500 hover:text-nexpura-bronze underline transition-colors duration-200"
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
                  className="nx-btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>

            {/* Data Export (GDPR) */}
            <section className={CARD_CLASS}>
              <h2 className={`${SECTION_HEADING_CLASS} mb-3`}>Your Data</h2>
              <p className="text-sm text-stone-500 mb-5 leading-relaxed">
                Download a copy of all your business data including customers, inventory, sales, repairs, and more.
              </p>
              <div className="flex flex-wrap items-center gap-4">
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
                  className="px-4 py-2 text-sm font-medium border border-stone-200 rounded-md text-stone-700 hover:border-stone-300 hover:text-stone-900 transition-colors duration-200"
                >
                  Export all data
                </button>
                <span className="text-xs text-stone-500 leading-relaxed">JSON format · May take a minute for large accounts.</span>
              </div>
            </section>

            {/* Account Deletion (GDPR) */}
            <section className="bg-white border border-red-200 rounded-2xl p-6 lg:p-8">
              <h2 className="font-serif text-xl text-red-900 leading-tight mb-3">Delete Account</h2>
              <p className="text-sm text-stone-500 mb-5 leading-relaxed">
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
                className="px-4 py-2 text-sm font-medium text-red-700 border border-red-200 rounded-md hover:bg-red-50 transition-colors duration-200"
              >
                Request account deletion
              </button>
            </section>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === "Security" && tenant && (
          <SecurityTab tenantId={tenant.id} />
        )}
      </div>
    </div>
  );
}
