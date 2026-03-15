"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ExternalLink,
  RefreshCw,
  Key,
  Shield,
  ShoppingBag,
  Landmark,
  MessageSquare,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface IntegrationStatus {
  xero: {
    status: "connected" | "disconnected" | "error";
    org_name: string | null;
    last_sync_at: string | null;
    configured: boolean;
  };
  whatsapp: {
    status: "connected" | "disconnected" | "error";
    phone_number_id: string | null;
  };
  shopify: {
    status: "connected" | "disconnected" | "error";
    store_url: string | null;
    last_sync_at: string | null;
  };
  insurance: {
    status: "connected" | "disconnected" | "error";
    enabled: boolean;
    appraiser_name: string | null;
  };
}

function StatusBadge({
  status,
  label,
}: {
  status: "connected" | "disconnected" | "error";
  label?: string;
}) {
  const map = {
    connected: {
      icon: <CheckCircle2 size={12} />,
      cls: "bg-green-50 text-green-700 border border-green-200",
      text: label ?? "Connected",
    },
    disconnected: {
      icon: <XCircle size={12} />,
      cls: "bg-stone-100 text-stone-500 border border-stone-200",
      text: label ?? "Not Connected",
    },
    error: {
      icon: <AlertCircle size={12} />,
      cls: "bg-red-50 text-red-600 border border-red-200",
      text: label ?? "Error",
    },
  };
  const { icon, cls, text } = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${cls}`}
    >
      {icon} {text}
    </span>
  );
}

function FieldInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  sensitive,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  sensitive?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-xs font-medium text-stone-600 mb-1">{label}</label>
      <div className="relative">
        <input
          type={sensitive && !show ? "password" : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#8B7355]/30 focus:border-[#8B7355] pr-9"
        />
        {sensitive && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
          >
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Xero Card ────────────────────────────────────────────────────────────────

function XeroCard({ data }: { data: IntegrationStatus["xero"] }) {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setResult(null);
    try {
      const res = await fetch("/api/integrations/xero/sync", { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        setResult(`Synced ${json.synced} invoice(s)${json.errors > 0 ? `, ${json.errors} failed` : ""}.`);
      } else {
        setResult(`Error: ${json.error}`);
      }
    } catch {
      setResult("Network error");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-sm flex flex-col">
      <div className="p-6 flex-1">
        <div className="flex items-start justify-between mb-4">
          <div className="p-2.5 rounded-lg bg-blue-500 text-white">
            <Landmark size={24} />
          </div>
          <StatusBadge status={data.status} />
        </div>
        <h3 className="text-lg font-semibold text-stone-900 mb-1">Xero</h3>
        <p className="text-sm text-stone-500 leading-relaxed mb-3">
          Sync your invoices and payments with Xero accounting software.
        </p>
        {data.status === "connected" && data.org_name && (
          <p className="text-xs text-stone-500">
            Connected to: <span className="font-medium text-stone-700">{data.org_name}</span>
          </p>
        )}
        {data.last_sync_at && (
          <p className="text-xs text-stone-400 mt-1">
            Last synced: {new Date(data.last_sync_at).toLocaleString()}
          </p>
        )}
        {!data.configured && (
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">
            ⚠ Set <code className="font-mono">XERO_CLIENT_ID</code>,{" "}
            <code className="font-mono">XERO_CLIENT_SECRET</code> and{" "}
            <code className="font-mono">XERO_REDIRECT_URI</code> in your environment to enable
            Xero.
          </p>
        )}
        {result && (
          <p className="text-xs mt-2 text-stone-500 bg-stone-50 rounded-lg px-3 py-2">
            {result}
          </p>
        )}
      </div>
      <div className="bg-stone-50 p-4 border-t border-stone-100 flex gap-2">
        {data.status !== "connected" ? (
          <a
            href="/api/integrations/xero/connect"
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              data.configured
                ? "bg-blue-500 text-white hover:bg-blue-600"
                : "bg-stone-100 text-stone-400 cursor-not-allowed pointer-events-none"
            }`}
          >
            Connect Xero
          </a>
        ) : (
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-3 py-1.5 text-xs font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center gap-1.5"
          >
            {syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Sync Now
          </button>
        )}
        {data.status === "connected" && (
          <a
            href="/api/integrations/xero/connect"
            className="px-3 py-1.5 text-xs font-medium border border-stone-200 bg-white rounded-lg hover:bg-stone-50"
          >
            Reconnect
          </a>
        )}
      </div>
    </div>
  );
}

// ─── WhatsApp Card ────────────────────────────────────────────────────────────

function WhatsAppCard({ data, onSaved }: { data: IntegrationStatus["whatsapp"]; onSaved: () => void }) {
  const [businessAccountId, setBusinessAccountId] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (data.phone_number_id) setPhoneNumberId(data.phone_number_id);
  }, [data]);

  const handleSave = async () => {
    if (!businessAccountId || !phoneNumberId || !accessToken) {
      setMessage({ type: "error", text: "All fields are required" });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/integrations/whatsapp/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_account_id: businessAccountId,
          phone_number_id: phoneNumberId,
          access_token: accessToken,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: "Credentials saved." });
        setExpanded(false);
        onSaved();
      } else {
        setMessage({ type: "error", text: json.error ?? "Failed to save" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/integrations/whatsapp/test", { method: "POST" });
      const json = await res.json();
      if (json.success) {
        setMessage({
          type: "success",
          text: `Connected! Phone: ${json.display_phone_number ?? "—"} (${json.verified_name ?? "—"})`,
        });
        onSaved();
      } else {
        setMessage({ type: "error", text: json.error ?? "Test failed" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-sm flex flex-col">
      <div className="p-6 flex-1">
        <div className="flex items-start justify-between mb-4">
          <div className="p-2.5 rounded-lg bg-[#25D366] text-white">
            <MessageSquare size={24} />
          </div>
          <StatusBadge status={data.status} />
        </div>
        <h3 className="text-lg font-semibold text-stone-900 mb-1">WhatsApp Business</h3>
        <p className="text-sm text-stone-500 leading-relaxed mb-3">
          Send automated messages when repairs and bespoke jobs are ready for collection.
        </p>
        {message && (
          <p
            className={`text-xs rounded-lg px-3 py-2 mt-2 ${
              message.type === "success"
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-red-50 text-red-600 border border-red-200"
            }`}
          >
            {message.text}
          </p>
        )}

        {/* Settings form */}
        {expanded && (
          <div className="mt-4 space-y-3">
            <FieldInput
              label="WhatsApp Business Account ID"
              value={businessAccountId}
              onChange={setBusinessAccountId}
              placeholder="123456789012345"
            />
            <FieldInput
              label="Phone Number ID"
              value={phoneNumberId}
              onChange={setPhoneNumberId}
              placeholder="1234567890"
            />
            <FieldInput
              label="Permanent Access Token"
              value={accessToken}
              onChange={setAccessToken}
              sensitive
              placeholder="EAA..."
            />
          </div>
        )}
      </div>
      <div className="bg-stone-50 p-4 border-t border-stone-100 flex gap-2 flex-wrap">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="px-3 py-1.5 text-xs font-medium border border-stone-200 bg-white rounded-lg hover:bg-stone-50"
        >
          {expanded ? "Hide Settings" : "Configure"}
        </button>
        {expanded && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1.5 text-xs font-medium bg-[#25D366] text-white rounded-lg hover:bg-[#1ebe59] disabled:opacity-50 flex items-center gap-1.5"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : null}
            Save Credentials
          </button>
        )}
        {data.status === "connected" && (
          <button
            onClick={handleTest}
            disabled={testing}
            className="px-3 py-1.5 text-xs font-medium border border-stone-200 bg-white rounded-lg hover:bg-stone-50 disabled:opacity-50 flex items-center gap-1.5"
          >
            {testing ? <Loader2 size={12} className="animate-spin" /> : null}
            Test Connection
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Shopify Card ─────────────────────────────────────────────────────────────

function ShopifyCard({ data, onSaved }: { data: IntegrationStatus["shopify"]; onSaved: () => void }) {
  const [storeUrl, setStoreUrl] = useState(data.store_url ?? "");
  const [accessToken, setAccessToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (data.store_url) setStoreUrl(data.store_url);
  }, [data.store_url]);

  const handleSave = async () => {
    if (!storeUrl || !accessToken) {
      setMessage({ type: "error", text: "Store URL and access token are required" });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/integrations/shopify/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ store_url: storeUrl, access_token: accessToken }),
      });
      const json = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: "Credentials saved." });
        setExpanded(false);
        onSaved();
      } else {
        setMessage({ type: "error", text: json.error ?? "Failed to save" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/integrations/shopify/test", { method: "POST" });
      const json = await res.json();
      if (json.success) {
        setMessage({
          type: "success",
          text: `Connected to: ${json.shop_name ?? storeUrl}`,
        });
        onSaved();
      } else {
        setMessage({ type: "error", text: json.error ?? "Test failed" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-sm flex flex-col">
      <div className="p-6 flex-1">
        <div className="flex items-start justify-between mb-4">
          <div className="p-2.5 rounded-lg bg-green-600 text-white">
            <ShoppingBag size={24} />
          </div>
          <StatusBadge status={data.status} />
        </div>
        <h3 className="text-lg font-semibold text-stone-900 mb-1">Shopify</h3>
        <p className="text-sm text-stone-500 leading-relaxed mb-3">
          Push inventory items to your Shopify store. Sync stock levels and product details.
        </p>
        {data.status === "connected" && data.store_url && (
          <p className="text-xs text-stone-500">
            Store: <span className="font-medium text-stone-700">{data.store_url}</span>
          </p>
        )}
        {data.last_sync_at && (
          <p className="text-xs text-stone-400 mt-1">
            Last synced: {new Date(data.last_sync_at).toLocaleString()}
          </p>
        )}
        {message && (
          <p
            className={`text-xs rounded-lg px-3 py-2 mt-2 ${
              message.type === "success"
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-red-50 text-red-600 border border-red-200"
            }`}
          >
            {message.text}
          </p>
        )}
        {expanded && (
          <div className="mt-4 space-y-3">
            <FieldInput
              label="Shopify Store URL"
              value={storeUrl}
              onChange={setStoreUrl}
              placeholder="mystore.myshopify.com"
            />
            <FieldInput
              label="Admin API Access Token"
              value={accessToken}
              onChange={setAccessToken}
              sensitive
              placeholder="shpat_..."
            />
          </div>
        )}
      </div>
      <div className="bg-stone-50 p-4 border-t border-stone-100 flex gap-2 flex-wrap">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="px-3 py-1.5 text-xs font-medium border border-stone-200 bg-white rounded-lg hover:bg-stone-50"
        >
          {expanded ? "Hide Settings" : "Configure"}
        </button>
        {expanded && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-1.5"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : null}
            Save Credentials
          </button>
        )}
        {data.status === "connected" && (
          <button
            onClick={handleTest}
            disabled={testing}
            className="px-3 py-1.5 text-xs font-medium border border-stone-200 bg-white rounded-lg hover:bg-stone-50 disabled:opacity-50 flex items-center gap-1.5"
          >
            {testing ? <Loader2 size={12} className="animate-spin" /> : null}
            Test Connection
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Insurance Card ───────────────────────────────────────────────────────────

function InsuranceCard({
  data,
  onSaved,
}: {
  data: IntegrationStatus["insurance"];
  onSaved: () => void;
}) {
  const [enabled, setEnabled] = useState(data.enabled);
  const [appraiserName, setAppraiserName] = useState(data.appraiser_name ?? "");
  const [appraiserLicense, setAppraiserLicense] = useState("");
  const [valuationBasis, setValuationBasis] = useState("replacement_value");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    setEnabled(data.enabled);
    setAppraiserName(data.appraiser_name ?? "");
  }, [data]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/integrations/insurance/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          appraiser_name: appraiserName,
          appraiser_license: appraiserLicense,
          valuation_basis: valuationBasis,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: "Insurance settings saved." });
        onSaved();
      } else {
        setMessage({ type: "error", text: json.error ?? "Failed to save" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-sm flex flex-col">
      <div className="p-6 flex-1">
        <div className="flex items-start justify-between mb-4">
          <div className="p-2.5 rounded-lg bg-stone-800 text-white">
            <Shield size={24} />
          </div>
          <StatusBadge
            status={data.status === "connected" ? "connected" : "disconnected"}
            label={data.enabled ? "Enabled" : "Disabled"}
          />
        </div>
        <h3 className="text-lg font-semibold text-stone-900 mb-1">Insurance Valuations</h3>
        <p className="text-sm text-stone-500 leading-relaxed mb-4">
          Generate insurance-ready valuation certificates and email them to customers directly from
          appraisals.
        </p>

        {/* Enable toggle */}
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => setEnabled((v) => !v)}
            className="text-stone-600 hover:text-stone-900"
          >
            {enabled ? (
              <ToggleRight size={28} className="text-[#8B7355]" />
            ) : (
              <ToggleLeft size={28} className="text-stone-300" />
            )}
          </button>
          <span className="text-sm font-medium text-stone-700">
            {enabled ? "Enabled" : "Disabled"}
          </span>
        </div>

        {/* Settings */}
        <div className="space-y-3">
          <FieldInput
            label="Default Appraiser Name"
            value={appraiserName}
            onChange={setAppraiserName}
            placeholder="Jane Smith"
          />
          <FieldInput
            label="Appraiser Licence Number"
            value={appraiserLicense}
            onChange={setAppraiserLicense}
            placeholder="GAA12345"
          />
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">
              Default Valuation Basis
            </label>
            <select
              value={valuationBasis}
              onChange={(e) => setValuationBasis(e.target.value)}
              className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#8B7355]/30"
            >
              <option value="replacement_value">Replacement Value</option>
              <option value="market_value">Market Value</option>
              <option value="insurance_value">Insurance Value</option>
            </select>
          </div>
        </div>

        {message && (
          <p
            className={`text-xs rounded-lg px-3 py-2 mt-3 ${
              message.type === "success"
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-red-50 text-red-600 border border-red-200"
            }`}
          >
            {message.text}
          </p>
        )}
      </div>
      <div className="bg-stone-50 p-4 border-t border-stone-100 flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1.5 text-xs font-medium bg-stone-800 text-white rounded-lg hover:bg-stone-900 disabled:opacity-50 flex items-center gap-1.5"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : null}
          Save Settings
        </button>
        <a
          href="/appraisals"
          className="px-3 py-1.5 text-xs font-medium border border-stone-200 bg-white rounded-lg hover:bg-stone-50 flex items-center gap-1"
        >
          <ExternalLink size={12} />
          Go to Appraisals
        </a>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const DEFAULT_STATUS: IntegrationStatus = {
  xero: { status: "disconnected", org_name: null, last_sync_at: null, configured: false },
  whatsapp: { status: "disconnected", phone_number_id: null },
  shopify: { status: "disconnected", store_url: null, last_sync_at: null },
  insurance: { status: "disconnected", enabled: false, appraiser_name: null },
};

export default function IntegrationsPage() {
  const [status, setStatus] = useState<IntegrationStatus>(DEFAULT_STATUS);
  const [loading, setLoading] = useState(true);
  const [apiKey] = useState("np_live_51Msz7I9p2...xK8q");

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/status");
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    // Detect Xero OAuth redirect params
    const params = new URLSearchParams(window.location.search);
    if (params.get("xero")) {
      fetchStatus();
      // Clean URL
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [fetchStatus]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-10 px-4 flex items-center gap-3 text-stone-400">
        <Loader2 size={20} className="animate-spin" /> Loading integrations…
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Integrations</h1>
        <p className="text-sm text-stone-500 mt-0.5">
          Connect Nexpura to your accounting, messaging, and ecommerce tools
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <XeroCard data={status.xero} />
        <WhatsAppCard data={status.whatsapp} onSaved={fetchStatus} />
        <ShopifyCard data={status.shopify} onSaved={fetchStatus} />
        <InsuranceCard data={status.insurance} onSaved={fetchStatus} />

        {/* API Access Card */}
        <div className="bg-white rounded-xl border border-[#8B7355]/20 overflow-hidden shadow-sm md:col-span-2">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-lg bg-[#8B7355] text-white">
                <Key size={24} />
              </div>
              <h3 className="text-lg font-semibold text-stone-900">API Access</h3>
            </div>
            <p className="text-sm text-stone-500 mb-6 max-w-2xl">
              Use your API key to build custom integrations or access your data
              programmatically. Keep this key secure and never share it publicly.
            </p>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-stone-900 rounded-lg p-3 font-mono text-xs text-stone-300 overflow-hidden truncate">
                  {apiKey}
                </div>
                <button
                  disabled
                  title="API key regeneration coming soon"
                  className="p-3 border border-stone-200 rounded-lg opacity-40 cursor-not-allowed"
                >
                  <RefreshCw size={16} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs text-stone-400">
                  <ExternalLink size={14} />
                  API documentation coming soon
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
