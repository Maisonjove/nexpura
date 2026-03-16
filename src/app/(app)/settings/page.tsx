"use client";

// SECURITY NOTE: This page lives inside the (app) layout which requires real Supabase
// session auth — unauthenticated requests are redirected to /login before reaching here.
// The review sandbox routes (/review/*) use a completely separate read-only layout and
// do NOT link to /settings — reviewers cannot access or mutate settings by design.

import { useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  saveBusinessProfile,
  saveTaxCurrency,
  saveBanking,
  saveAccount,
} from "./actions";
import LogoUpload from "./LogoUpload";

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

const TABS = ["Business Profile", "Tax & Currency", "Banking", "Account"] as const;
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
          setTenant(tenantData as Tenant);
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
      const result = await saveAccount(user.id, formData);
      if (result.error) showError(result.error);
      else {
        showSuccess("Account details saved!");
        setUser((prev) => prev ? { ...prev, full_name: formData.get("full_name") as string } : prev);
      }
    });
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-stone-200 rounded w-48" />
          <div className="h-12 bg-stone-200 rounded" />
          <div className="h-64 bg-stone-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-semibold text-2xl font-semibold text-stone-900">Settings</h1>
        <p className="text-stone-500 mt-1 text-sm">Manage your business profile and preferences</p>
      </div>

      {/* Toast */}
      {successMsg && (
        <div className="flex items-center gap-3 bg-stone-100 border border-amber-600/30 text-amber-700 rounded-xl px-4 py-3 text-sm">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          {errorMsg}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-stone-200">
        <nav className="flex gap-1 -mb-px">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-amber-600 text-amber-700"
                  : "border-transparent text-stone-500 hover:text-stone-900 hover:border-stone-200"
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
          <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-4">
            <h2 className="text-base font-semibold text-stone-900">Business Logo</h2>
            <div className="flex items-center gap-5">
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
              <div>
                <p className="text-xs text-stone-400">PNG, JPG, WebP up to 10MB. Recommended: 400×400px</p>
              </div>
            </div>
          </div>

          {/* Business info */}
          <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-4">
            <h2 className="text-base font-semibold text-stone-900">Business Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Business Name</label>
                <input
                  name="business_name"
                  defaultValue={tenant?.business_name || tenant?.name || ""}
                  className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-amber-600 bg-white"
                  placeholder="My Jewellery Studio"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Business Type</label>
                <select
                  name="business_type"
                  defaultValue={tenant?.business_type || ""}
                  className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-amber-600 bg-white"
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
                <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Workspace Mode</label>
                <select
                  name="business_mode"
                  defaultValue={tenant?.business_mode || "full"}
                  className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-amber-600 bg-white font-medium text-amber-700"
                >
                  <option value="full">Full (All Features)</option>
                  <option value="retail">Retail Focus (POS + Inventory)</option>
                  <option value="workshop">Workshop Focus (Repairs + Calendar)</option>
                  <option value="bespoke">Bespoke Focus (Custom Jobs)</option>
                </select>
                <p className="text-[10px] text-stone-400">Tailors the dashboard and navigation to your workflow</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Phone</label>
                <input
                  name="phone"
                  type="tel"
                  defaultValue={tenant?.phone || ""}
                  className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-amber-600 bg-white"
                  placeholder="+61 2 9000 0000"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Email</label>
                <input
                  name="email"
                  type="email"
                  defaultValue={tenant?.email || ""}
                  className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-amber-600 bg-white"
                  placeholder="hello@mybusiness.com"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Website</label>
                <input
                  name="website"
                  type="url"
                  defaultValue={tenant?.website || ""}
                  className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-amber-600 bg-white"
                  placeholder="https://mybusiness.com"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">ABN</label>
                <input
                  name="abn"
                  defaultValue={tenant?.abn || ""}
                  className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-amber-600 bg-white"
                  placeholder="12 345 678 901"
                />
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-4">
            <h2 className="text-base font-semibold text-stone-900">Business Address</h2>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Street Address</label>
                <input
                  name="address_line1"
                  defaultValue={tenant?.address_line1 || ""}
                  className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-amber-600 bg-white"
                  placeholder="123 Main Street"
                />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="col-span-2 sm:col-span-1 space-y-1.5">
                  <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Suburb</label>
                  <input
                    name="suburb"
                    defaultValue={tenant?.suburb || ""}
                    className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-amber-600 bg-white"
                    placeholder="Sydney"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">State</label>
                  <select
                    name="state"
                    defaultValue={tenant?.state || ""}
                    className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-amber-600 bg-white"
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
                  <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Postcode</label>
                  <input
                    name="postcode"
                    defaultValue={tenant?.postcode || ""}
                    className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-amber-600 bg-white"
                    placeholder="2000"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Country</label>
                  <select
                    name="country"
                    defaultValue={tenant?.country || "Australia"}
                    className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-amber-600 bg-white"
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

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isPending}
              className="px-6 py-2.5 bg-amber-700 text-white text-sm font-medium rounded-lg hover:bg-amber-800 transition-colors disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      )}

      {/* Tax & Currency Tab */}
      {activeTab === "Tax & Currency" && (
        <form onSubmit={handleTaxSubmit} className="space-y-6">
          <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-4">
            <h2 className="text-base font-semibold text-stone-900">Currency & Timezone</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Currency</label>
                <select
                  name="currency"
                  defaultValue={tenant?.currency || "AUD"}
                  className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-amber-600 bg-white"
                >
                  <option value="AUD">AUD — Australian Dollar</option>
                  <option value="NZD">NZD — New Zealand Dollar</option>
                  <option value="USD">USD — US Dollar</option>
                  <option value="GBP">GBP — British Pound</option>
                  <option value="EUR">EUR — Euro</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Timezone</label>
                <select
                  name="timezone"
                  defaultValue={tenant?.timezone || "Australia/Sydney"}
                  className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-amber-600 bg-white"
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

          <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-4">
            <h2 className="text-base font-semibold text-stone-900">Tax Settings</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Tax Name</label>
                <select
                  name="tax_name"
                  defaultValue={tenant?.tax_name || "GST"}
                  className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-amber-600 bg-white"
                >
                  <option value="GST">GST</option>
                  <option value="VAT">VAT</option>
                  <option value="Tax">Tax</option>
                  <option value="None">None</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Tax Rate (%)</label>
                <input
                  name="tax_rate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  defaultValue={tenant?.tax_rate != null ? (tenant.tax_rate * 100).toFixed(0) : "10"}
                  className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-amber-600 bg-white"
                  placeholder="10"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Tax Inclusive</label>
                <div className="flex items-center h-[38px]">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      name="tax_inclusive"
                      type="checkbox"
                      defaultChecked={tenant?.tax_inclusive ?? false}
                      value="true"
                      className="w-4 h-4 accent-sage rounded"
                    />
                    <span className="text-sm text-stone-900">Prices include tax</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isPending}
              className="px-6 py-2.5 bg-amber-700 text-white text-sm font-medium rounded-lg hover:bg-amber-800 transition-colors disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      )}

      {/* Banking Tab */}
      {activeTab === "Banking" && (
        <form onSubmit={handleBankingSubmit} className="space-y-6">
          <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-4">
            <div className="flex items-start gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-stone-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-semibold text-stone-900">Banking Details</h2>
                <p className="text-xs text-stone-500 mt-0.5">These appear on your invoices for direct deposit payments</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Bank Name</label>
                <input
                  name="bank_name"
                  defaultValue={tenant?.bank_name || ""}
                  className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-amber-600 bg-white"
                  placeholder="Commonwealth Bank"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">BSB</label>
                <input
                  name="bank_bsb"
                  defaultValue={tenant?.bank_bsb || ""}
                  className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-amber-600 bg-white"
                  placeholder="062-000"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Account Number</label>
                <input
                  name="bank_account"
                  defaultValue={tenant?.bank_account || ""}
                  className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-amber-600 bg-white"
                  placeholder="1234 5678"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-stone-900">Invoice Footer</h2>
              <p className="text-xs text-stone-500 mt-0.5">This message appears at the bottom of every invoice PDF</p>
            </div>
            <div className="space-y-1.5">
              <textarea
                name="invoice_footer"
                defaultValue={tenant?.invoice_footer || ""}
                rows={3}
                className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-amber-600 bg-white resize-none"
                placeholder="Thank you for your business. Payment due within 7 days."
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isPending}
              className="px-6 py-2.5 bg-amber-700 text-white text-sm font-medium rounded-lg hover:bg-amber-800 transition-colors disabled:opacity-50"
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
          <div className="bg-white rounded-xl border border-stone-200 p-6">
            <h2 className="text-base font-semibold text-stone-900 mb-4">Current Plan</h2>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${
                  subscription?.plan === "group" || subscription?.plan === "ultimate"
                    ? "bg-amber-700/10 text-amber-700 border border-amber-600/30"
                    : subscription?.plan === "studio" || subscription?.plan === "pro"
                    ? "bg-stone-100 text-amber-700 border border-amber-600/30"
                    : "bg-stone-200 text-stone-500 border border-stone-200"
                }`}>
                  {subscription?.plan || "Free"}
                </div>
                <span className="text-sm text-stone-500">
                  {subscription?.status === "trialing"
                    ? `Trial ends ${new Date(subscription.trial_ends_at!).toLocaleDateString("en-AU")}`
                    : subscription?.status === "active"
                    ? `Renews ${new Date(subscription.current_period_end!).toLocaleDateString("en-AU")}`
                    : "No active subscription"}
                </span>
              </div>
              {subscription?.plan !== "group" && subscription?.plan !== "ultimate" && (
                <button className="px-4 py-2 text-sm font-medium bg-amber-700 text-white rounded-lg hover:bg-amber-800 transition-colors">
                  Upgrade plan
                </button>
              )}
            </div>
          </div>

          {/* Account details */}
          <form onSubmit={handleAccountSubmit} className="space-y-6">
            <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-4">
              <h2 className="text-base font-semibold text-stone-900">Account Details</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Full Name</label>
                  <input
                    name="full_name"
                    defaultValue={user?.full_name || ""}
                    className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-amber-600 bg-white"
                  />
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Email</label>
                  <input
                    value={user?.email || ""}
                    readOnly
                    className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg bg-stone-50 text-stone-500 cursor-not-allowed"
                  />
                  <p className="text-xs text-stone-400">Email cannot be changed here</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                className="text-sm text-stone-500 hover:text-stone-900 underline transition-colors"
                onClick={() => {
                  const supabase = createClient();
                  supabase.auth.resetPasswordForEmail(user?.email || "", {
                    redirectTo: `${window.location.origin}/auth/callback?next=/settings`,
                  }).then(() => showSuccess("Password reset email sent!"));
                }}
              >
                Change password
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-6 py-2.5 bg-amber-700 text-white text-sm font-medium rounded-lg hover:bg-amber-800 transition-colors disabled:opacity-50"
              >
                {isPending ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
