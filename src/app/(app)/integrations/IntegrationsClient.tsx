"use client";

import { useState } from "react";
import { 
  CreditCard, 
  Mail, 
  MessageSquare, 
  Package, 
  Calendar,
  ShoppingBag,
  CheckCircle2,
  ExternalLink,
  Loader2,
  AlertCircle
} from "lucide-react";

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  status: "available" | "connected" | "coming_soon" | "platform";
  category: "payments" | "communication" | "ecommerce" | "productivity";
  setupUrl?: string;
  docsUrl?: string;
}

interface IntegrationsClientProps {
  tenantId: string;
  currentIntegrations: Record<string, unknown>;
  hasStripe: boolean;
}

const INTEGRATIONS: Integration[] = [
  // Payments
  {
    id: "stripe",
    name: "Stripe",
    description: "Accept credit cards, Apple Pay, and Google Pay. Automatic invoicing and subscription billing.",
    icon: <CreditCard className="w-6 h-6" />,
    status: "available",
    category: "payments",
    setupUrl: "/settings/payments",
    docsUrl: "https://stripe.com/docs",
  },
  {
    id: "square",
    name: "Square",
    description: "POS integration for in-store payments. Sync sales and inventory.",
    icon: <CreditCard className="w-6 h-6" />,
    status: "coming_soon",
    category: "payments",
  },
  
  // Communication
  {
    id: "resend",
    name: "Resend (Email)",
    description: "Send transactional emails — invoices, repair updates, and marketing. Already configured.",
    icon: <Mail className="w-6 h-6" />,
    status: "connected",
    category: "communication",
    docsUrl: "https://resend.com/docs",
  },
  {
    id: "whatsapp",
    name: "WhatsApp Notifications",
    description: "Automated customer and employee notifications via WhatsApp. Powered by Nexpura — no setup needed.",
    icon: <MessageSquare className="w-6 h-6" />,
    status: "platform",
    category: "communication",
    setupUrl: "/settings/notifications",
  },
  
  // E-commerce
  {
    id: "shopify",
    name: "Shopify",
    description: "Sync inventory and orders with your Shopify store. Two-way product sync.",
    icon: <ShoppingBag className="w-6 h-6" />,
    status: "coming_soon",
    category: "ecommerce",
  },
  {
    id: "woocommerce",
    name: "WooCommerce",
    description: "Connect your WordPress/WooCommerce store. Sync products and orders.",
    icon: <Package className="w-6 h-6" />,
    status: "coming_soon",
    category: "ecommerce",
  },
  
  // Productivity
  {
    id: "google_calendar",
    name: "Google Calendar",
    description: "Sync appointments and repair due dates to your Google Calendar.",
    icon: <Calendar className="w-6 h-6" />,
    status: "coming_soon",
    category: "productivity",
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  payments: "Payments",
  communication: "Communication",
  ecommerce: "E-commerce",
  productivity: "Productivity",
};

export default function IntegrationsClient({ 
  tenantId, 
  currentIntegrations, 
  hasStripe 
}: IntegrationsClientProps) {
  const [connecting, setConnecting] = useState<string | null>(null);

  // Update status based on actual connections
  const getIntegrationStatus = (integration: Integration): "available" | "connected" | "coming_soon" | "platform" => {
    if (integration.status === "coming_soon") return "coming_soon";
    if (integration.status === "platform") return "platform";
    if (integration.id === "stripe" && hasStripe) return "connected";
    if (integration.id === "resend") return "connected"; // Resend is always configured
    if (currentIntegrations[integration.id]) return "connected";
    return "available";
  };

  const handleConnect = async (integration: Integration) => {
    if (integration.setupUrl) {
      window.location.href = integration.setupUrl;
      return;
    }
    
    setConnecting(integration.id);
    // Simulate connection process
    setTimeout(() => {
      setConnecting(null);
    }, 2000);
  };

  // Group integrations by category
  const groupedIntegrations = INTEGRATIONS.reduce((acc, integration) => {
    if (!acc[integration.category]) {
      acc[integration.category] = [];
    }
    acc[integration.category].push(integration);
    return acc;
  }, {} as Record<string, Integration[]>);

  return (
    <div className="space-y-8">
      {Object.entries(groupedIntegrations).map(([category, integrations]) => (
        <div key={category}>
          <h2 className="text-lg font-semibold text-stone-900 mb-4">
            {CATEGORY_LABELS[category]}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {integrations.map((integration) => {
              const status = getIntegrationStatus(integration);
              const isConnecting = connecting === integration.id;
              
              return (
                <div
                  key={integration.id}
                  className={`bg-white border rounded-xl p-5 ${
                    status === "coming_soon" 
                      ? "border-stone-200 opacity-60" 
                      : status === "connected" || status === "platform"
                      ? "border-green-200 bg-green-50/30"
                      : "border-stone-200 hover:border-amber-300 hover:shadow-sm transition-all"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      status === "connected" || status === "platform"
                        ? "bg-green-100 text-green-600" 
                        : status === "coming_soon"
                        ? "bg-stone-100 text-stone-400"
                        : "bg-amber-100 text-amber-600"
                    }`}>
                      {integration.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-stone-900">{integration.name}</h3>
                        {status === "connected" && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                            <CheckCircle2 className="w-3 h-3" />
                            Connected
                          </span>
                        )}
                        {status === "platform" && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                            <CheckCircle2 className="w-3 h-3" />
                            Included
                          </span>
                        )}
                        {status === "coming_soon" && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-stone-100 text-stone-500 text-xs font-medium rounded-full">
                            Coming Soon
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-stone-500 mt-1">{integration.description}</p>
                      
                      <div className="flex items-center gap-3 mt-3">
                        {status === "available" && (
                          <button
                            onClick={() => handleConnect(integration)}
                            disabled={isConnecting}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
                          >
                            {isConnecting ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Connecting...
                              </>
                            ) : (
                              "Connect"
                            )}
                          </button>
                        )}
                        {(status === "connected" || status === "platform") && integration.setupUrl && (
                          <a
                            href={integration.setupUrl}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 text-stone-700 text-sm font-medium rounded-lg hover:bg-stone-200 transition-colors"
                          >
                            {status === "platform" ? "Configure" : "Manage"}
                          </a>
                        )}
                        {integration.docsUrl && status !== "coming_soon" && (
                          <a
                            href={integration.docsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Docs
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Request Integration */}
      <div className="bg-stone-50 border border-stone-200 rounded-xl p-6 text-center">
        <AlertCircle className="w-8 h-8 text-stone-400 mx-auto mb-3" />
        <h3 className="font-semibold text-stone-900">Need a different integration?</h3>
        <p className="text-sm text-stone-500 mt-1 mb-4">
          Let us know what tools you use and we'll consider adding them.
        </p>
        <a
          href="mailto:support@nexpura.com?subject=Integration Request"
          className="inline-flex items-center gap-2 px-4 py-2 bg-stone-900 text-white text-sm font-medium rounded-lg hover:bg-stone-800 transition-colors"
        >
          <Mail className="w-4 h-4" />
          Request Integration
        </a>
      </div>
    </div>
  );
}
