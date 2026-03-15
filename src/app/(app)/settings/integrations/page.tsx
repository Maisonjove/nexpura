"use client";

import { useState } from "react";
import { X, ExternalLink, RefreshCw, Key, Shield, ShoppingBag, Landmark, MessageSquare } from "lucide-react";

export default function IntegrationsPage() {
  const [apiKey, setApiKey] = useState("np_live_51Msz7I9p2...xK8q");
  const [isRegenerating, setIsRegenerating] = useState(false);

  const cards = [
    {
      id: "xero",
      title: "Xero",
      description: "Sync your invoices, payments, and inventory adjustments with Xero accounting software. (Currently in Beta with mock sync endpoints).",
      icon: Landmark,
      color: "bg-blue-500",
      status: "Beta / Coming Soon",
      actions: ["Connect Xero (Beta)", "Export CSV for Xero"]
    },
    {
      id: "insurance",
      title: "Jewelsure / Insurance",
      description: "Direct integration for insurance claims and appraisals. Push valuations directly to policy providers. (Setup Required)",
      icon: Shield,
      color: "bg-stone-800",
      status: "Setup Required",
      actions: ["Manage Settings", "Export Appraisal Data"]
    },
    {
      id: "ecommerce",
      title: "Ecommerce Sync",
      description: "Connect Shopify, WooCommerce, or Squarespace to sync stock levels and orders automatically. (Beta Phase)",
      icon: ShoppingBag,
      color: "bg-green-600",
      status: "Beta",
      actions: ["Connect Store", "Webhook Settings"]
    },
    {
      id: "whatsapp",
      title: "WhatsApp Business",
      description: "Send automated messages for repairs, invoices, and marketing campaigns directly via WhatsApp. (Provider setup required).",
      icon: MessageSquare,
      color: "bg-[#25D366]",
      status: "Setup Required",
      actions: ["Connect Account", "Message Templates"]
    }
  ];

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Integrations</h1>
        <p className="text-sm text-stone-500 mt-0.5">Connect Nexpura to your accounting, insurance, and ecommerce tools</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {cards.map(card => (
          <div key={card.id} className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-sm flex flex-col">
            <div className="p-6 flex-1">
              <div className="flex items-start justify-between mb-4">
                <div className={`p-2.5 rounded-lg ${card.color} text-white`}>
                  <card.icon size={24} />
                </div>
                <div className="flex flex-col items-end">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    card.status === "Setup Required" ? "bg-stone-100 text-stone-700" : 
                    card.status.includes("Beta") ? "bg-purple-100 text-purple-700" : "bg-stone-100 text-stone-600"
                  }`}>
                    {card.status}
                  </span>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-stone-900 mb-2">{card.title}</h3>
              <p className="text-sm text-stone-500 leading-relaxed">{card.description}</p>
            </div>
            <div className="bg-stone-50 p-4 border-t border-stone-100 flex gap-2">
              {card.actions.map(action => (
                <button 
                  key={action}
                  disabled
                  title="This integration is not yet available"
                  className="px-3 py-1.5 text-xs font-medium border border-stone-200 bg-white rounded-lg opacity-50 cursor-not-allowed"
                >
                  {action}
                </button>
              ))}
            </div>
          </div>
        ))}

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
              Use your API key to build custom integrations or access your data programmatically. 
              Keep this key secure and never share it publicly.
            </p>
            
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-stone-900 rounded-lg p-3 font-mono text-xs text-stone-300 overflow-hidden truncate">
                  {apiKey}
                </div>
                <button 
                  disabled
                  title="API key generation not yet available"
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
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-stone-100 text-stone-500">Coming Soon</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
