"use client";

import { useEffect, useState, useRef, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  saveBusinessProfile,
  saveTaxCurrency,
  saveBanking,
  saveAccount,
} from "./actions";

type Tenant = {
  id: string;
  name: string | null;
  business_name: string | null;
  business_type: string | null;
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
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !tenant) return;
    setLogoUploading(true);
    const supabase = createClient();

    // Create bucket if needed (may fail silently if exists)
    await supabase.storage.createBucket("logos", { public: true }).catch(() => {});

    const { error } = await supabase.storage
      .from("logos")
      .upload(`${tenant.id}/logo.png`, file, { upsert: true, contentType: file.type });

    if (error) {
      showError("Logo upload failed: " + error.message);
      setLogoUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("logos").getPublicUrl(`${tenant.id}/logo.png`);
    const publicUrl = urlData.publicUrl;

    await supabase.from("tenants").update({ logo_url: publicUrl }).eq("id", tenant.id);
    setLogoPreview(publicUrl);
    setTenant((prev) => prev ? { ...prev, logo_url: publicUrl } : prev);
    setLogoUploading(false);
    showSuccess("Logo updated!");
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
          <div className="h-8 bg-platinum rounded w-48" />
          <div className="h-12 bg-platinum rounded" />
          <div className="h-64 bg-platinum rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-fraunces text-2xl font-semibold text-forest">Settings</h1>
        <p className="text-forest/60 mt-1 text-sm">Manage your business profile and preferences</p>
      </div>

      {/* Toast */}
      {successMsg && (
        <div className="flex items-center gap-3 bg-sage/10 border border-sage/30 text-sage rounded-xl px-4 py-3 text-sm">
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
      <div className="border-b border-platinum">
        <nav className="flex gap-1 -mb-px">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-sage text-sage"
                  : "border-transparent text-forest/50 hover:text-forest hover:border-platinum"
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
          <div className="bg-white rounded-xl border border-platinum p-6 space-y-4">
            <h2 className="font-fraunces text-base font-semibold text-forest">Business Logo</h2>
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-xl border-2 border-dashed border-platinum flex items-center justify-center overflow-hidden bg-ivory flex-shrink-0">
                {logoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <svg className="w-8 h-8 text-forest/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                )}
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={logoUploading}
                  className="px-4 py-2 text-sm font-medium bg-white border border-forest/20 text-forest rounded-lg hover:border-forest/40 transition-colors disabled:opacity-50"
                >
                  {logoUploading ? "Uploading…" : "Upload logo"}
                </button>
                <p className="text-xs text-forest/40 mt-1.5">PNG, JPG up to 2MB. Recommended: 400×400px</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
              </div>
            </div>
          </div>

          {/* Business info */}
          <div className="bg-white rounded-xl border border-platinum p-6 space-y-4">
            <h2 className="font-fraunces text-base font-semibold text-forest">Business Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-forest/60 uppercase tracking-wide">Business Name</label>
                <input
                  name="business_name"
                  defaultValue={tenant?.business_name || tenant?.name || ""}
                  className="w-full px-3 py-2 text-sm border border-platinum rounded-lg focus:outline-none focus:border-sage bg-white"
                  placeholder="My Jewellery Studio"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-forest/60 uppercase tracking-wide">Business Type</label>
                <select
                  name="business_type"
                  defaultValue={tenant?.business_type || ""}
                  className="w-full px-3 py-2 text-sm border border-platinum rounded-lg focus:outline-none focus:border-sage bg-white"
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
                <label className="text-xs font-medium text-forest/60 uppercase tracking-wide">Phone</label>
                <input
                  name="phone"
                  type="tel"
                  defaultValue={tenant?.phone || ""}
                  className="w-full px-3 py-2 text-sm border border-platinum rounded-lg focus:outline-none focus:border-sage bg-white"
                  placeholder="+61 2 9000 0000"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-forest/60 uppercase tracking-wide">Email</label>
                <input
                  name="email"
                  type="email"
                  defaultValue={tenant?.email || ""}
                  className="w-full px-3 py-2 text-sm border border-platinum rounded-lg focus:outline-none focus:border-sage bg-white"
                  placeholder="hello@mybusiness.com"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-forest/60 uppercase tracking-wide">Website</label>
                <input
                  name="website"
                  type="url"
                  defaultValue={tenant?.website || ""}
                  className="w-full px-3 py-2 text-sm border border-platinum rounded-lg focus:outline-none focus:border-sage bg-white"
                  placeholder="https://mybusiness.com"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-forest/60 uppercase tracking-wide">ABN</label>
                <input
                  name="abn"
                  defaultValue={tenant?.abn || ""}
                  className="w-full px-3 py-2 text-sm border border-platinum rounded-lg focus:outline-none focus:border-sage bg-white"
                  placeholder="12 345 678 901"
                />
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="bg-white rounded-xl border border-platinum p-6 space-y-4">
            <h2 className="font-fraunces text-base font-semibold text-forest">Business Address</h2>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-forest/60 uppercase tracking-wide">Street Address</label>
                <input
                  name="address_line1"
                  defaultValue={tenant?.address_line1 || ""}
                  className="w-full px-3 py-2 text-sm border border-platinum rounded-lg focus:outline-none focus:border-sage bg-white"
                  placeholder="123 Main Street"
                />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="col-span-2 sm:col-span-1 space-y-1.5">
                  <label className="text-xs font-medium text-forest/60 uppercase tracking-wide">Suburb</label>
                  <input
                    name="suburb"
                    defaultValue={tenant?.suburb || ""}
                    className="w-full px-3 py-2 text-sm border border-platinum rounded-lg focus:outline-none focus:border-sage bg-white"
                    placeholder="Sydney"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-forest/60 uppercase tracking-wide">State</label>
                  <select
                    name="state"
                    defaultValue={tenant?.state || ""}
                    className="w-full px-3 py-2 text-sm border border-platinum rounded-lg focus:outline-none focus:border-sage bg-white"
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
                  <label className="text-xs font-medium text-forest/60 uppercase tracking-wide">Postcode</label>
                  <input
                    name="postcode"
                    defaultValue={tenant?.postcode || ""}
                    className="w-full px-3 py-2 text-sm border border-platinum rounded-lg focus:outline-none focus:border-sage bg-white"
                    placeholder="2000"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-forest/60 uppercase tracking-wide">Country</label>
                  <select
                    name="country"
                    defaultValue={tenant?.country || "Australia"}
                    className="w-full px-3 py-2 text-sm border border-platinum rounded-lg focus:outline-none focus:border-sage bg-white"
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
              className="px-6 py-2.5 bg-sage text-white text-sm font-medium rounded-lg hover:bg-sage/90 transition-colors disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      )}

      {/* Tax & Currency Tab */}
      {activeTab === "Tax & Currency" && (
        <form onSubmit={handleTaxSubmit} className="space-y-6">
          <div className="bg-white rounded-xl border border-platinum p-6 space-y-4">
            <h2 className="font-fraunces text-base font-semibold text-forest">Currency & Timezone</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-forest/60 uppercase tracking-wide">Currency</label>
                <select
                  name="currency"
                  defaultValue={tenant?.currency || "AUD"}
                  className="w-full px-3 py-2 text-sm border border-platinum rounded-lg focus:outline-none focus:border-sage bg-white"
                >
                  <option value="AUD">AUD — Australian Dollar</option>
                  <option value="NZD">NZD — New Zealand Dollar</option>
                  <option value="USD">USD — US Dollar</option>
                  <option value="GBP">GBP — British Pound</option>
                  <option value="EUR">EUR — Euro</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-forest/60 uppercase tracking-wide">Timezone</label>
                <select
                  name="timezone"
                  defaultValue={tenant?.timezone || "Australia/Sydney"}
                  className="w-full px-3 py-2 text-sm border border-platinum rounded-lg focus:outline-none focus:border-sage bg-white"
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

          <div className="bg-white rounded-xl border border-platinum p-6 space-y-4">
            <h2 className="font-fraunces text-base font-semibold text-forest">Tax Settings</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-forest/60 uppercase tracking-wide">Tax Name</label>
                <select
                  name="tax_name"
                  defaultValue={tenant?.tax_name || "GST"}
                  className="w-full px-3 py-2 text-sm border border-platinum rounded-lg focus:outline-none focus:border-sage bg-white"
                >
                  <option value="GST">GST</option>
                  <option value="VAT">VAT</option>
                  <option value="Tax">Tax</option>
                  <option value="None">None</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-forest/60 uppercase tracking-wide">Tax Rate (%)</label>
                <input
                  name="tax_rate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  defaultValue={tenant?.tax_rate != null ? (tenant.tax_rate * 100).toFixed(0) : "10"}
                  className="w-full px-3 py-2 text-sm border border-platinum rounded-lg focus:outline-none focus:border-sage bg-white"
                  placeholder="10"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-forest/60 uppercase tracking-wide">Tax Inclusive</label>
                <div className="flex items-center h-[38px]">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      name="tax_inclusive"
                      type="checkbox"
                      defaultChecked={tenant?.tax_inclusive ?? false}
                      value="true"
                      className="w-4 h-4 accent-sage rounded"
                    />
                    <span className="text-sm text-forest">Prices include tax</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isPending}
              className="px-6 py-2.5 bg-sage text-white text-sm font-medium rounded-lg hover:bg-sage/90 transition-colors disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      )}

      {/* Banking Tab */}
      {activeTab === "Banking" && (
        <form onSubmit={handleBankingSubmit} className="space-y-6">
          <div className="bg-white rounded-xl border border-platinum p-6 space-y-4">
            <div className="flex items-start gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-sage/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-sage" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <div>
                <h2 className="font-fraunces text-base font-semibold text-forest">Banking Details</h2>
                <p className="text-xs text-forest/50 mt-0.5">These appear on your invoices for direct deposit payments</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-medium text-forest/60 uppercase tracking-wide">Bank Name</label>
                <input
                  name="bank_name"
                  defaultValue={tenant?.bank_name || ""}
                  className="w-full px-3 py-2 text-sm border border-platinum rounded-lg focus:outline-none focus:border-sage bg-white"
                  placeholder="Commonwealth Bank"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-forest/60 uppercase tracking-wide">BSB</label>
                <input
                  name="bank_bsb"
                  defaultValue={tenant?.bank_bsb || ""}
                  className="w-full px-3 py-2 text-sm border border-platinum rounded-lg focus:outline-none focus:border-sage bg-white"
                  placeholder="062-000"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-forest/60 uppercase tracking-wide">Account Number</label>
                <input
                  name="bank_account"
                  defaultValue={tenant?.bank_account || ""}
                  className="w-full px-3 py-2 text-sm border border-platinum rounded-lg focus:outline-none focus:border-sage bg-white"
                  placeholder="1234 5678"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isPending}
              className="px-6 py-2.5 bg-sage text-white text-sm font-medium rounded-lg hover:bg-sage/90 transition-colors disabled:opacity-50"
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
          <div className="bg-white rounded-xl border border-platinum p-6">
            <h2 className="font-fraunces text-base font-semibold text-forest mb-4">Current Plan</h2>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${
                  subscription?.plan === "ultimate"
                    ? "bg-gold/10 text-gold border border-gold/30"
                    : subscription?.plan === "pro"
                    ? "bg-sage/10 text-sage border border-sage/30"
                    : "bg-platinum text-forest/60 border border-platinum"
                }`}>
                  {subscription?.plan || "Free"}
                </div>
                <span className="text-sm text-forest/60">
                  {subscription?.status === "trialing"
                    ? `Trial ends ${new Date(subscription.trial_ends_at!).toLocaleDateString("en-AU")}`
                    : subscription?.status === "active"
                    ? `Renews ${new Date(subscription.current_period_end!).toLocaleDateString("en-AU")}`
                    : "No active subscription"}
                </span>
              </div>
              {subscription?.plan !== "ultimate" && (
                <button className="px-4 py-2 text-sm font-medium bg-sage text-white rounded-lg hover:bg-sage/90 transition-colors">
                  Upgrade plan
                </button>
              )}
            </div>
          </div>

          {/* Account details */}
          <form onSubmit={handleAccountSubmit} className="space-y-6">
            <div className="bg-white rounded-xl border border-platinum p-6 space-y-4">
              <h2 className="font-fraunces text-base font-semibold text-forest">Account Details</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-medium text-forest/60 uppercase tracking-wide">Full Name</label>
                  <input
                    name="full_name"
                    defaultValue={user?.full_name || ""}
                    className="w-full px-3 py-2 text-sm border border-platinum rounded-lg focus:outline-none focus:border-sage bg-white"
                  />
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-medium text-forest/60 uppercase tracking-wide">Email</label>
                  <input
                    value={user?.email || ""}
                    readOnly
                    className="w-full px-3 py-2 text-sm border border-platinum rounded-lg bg-ivory text-forest/50 cursor-not-allowed"
                  />
                  <p className="text-xs text-forest/40">Email cannot be changed here</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                className="text-sm text-forest/50 hover:text-forest underline transition-colors"
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
                className="px-6 py-2.5 bg-sage text-white text-sm font-medium rounded-lg hover:bg-sage/90 transition-colors disabled:opacity-50"
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
