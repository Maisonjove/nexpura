"use client";

import { 
  CreditCard, 
  Calendar,
  MessageSquare,
  ShoppingBag,
  Package,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Mail
} from "lucide-react";
import Link from "next/link";

interface Integration {
  id: string;
  type: string;
  status: "connected" | "disconnected" | "error";
  last_sync_at: string | null;
}

interface ConnectedServicesClientProps {
  hasStripe: boolean;
  integrations: Integration[];
}

interface ServiceInfo {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: "payments" | "calendar" | "communication" | "ecommerce";
  manageUrl: string;
  setupLocation: string;
}

const SERVICES: ServiceInfo[] = [
  {
    id: "stripe",
    name: "Stripe",
    description: "Accept card payments",
    icon: <CreditCard className="w-5 h-5" />,
    category: "payments",
    manageUrl: "/settings/payments",
    setupLocation: "POS or Invoices",
  },
  {
    id: "square",
    name: "Square POS",
    description: "Sync Square transactions",
    icon: <CreditCard className="w-5 h-5" />,
    category: "payments",
    manageUrl: "/pos",
    setupLocation: "POS Settings",
  },
  {
    id: "google_calendar",
    name: "Google Calendar",
    description: "Sync appointments & repairs",
    icon: <Calendar className="w-5 h-5" />,
    category: "calendar",
    manageUrl: "/integrations/google-calendar",
    setupLocation: "Appointments Settings",
  },
  {
    id: "twilio",
    name: "Twilio SMS",
    description: "Send text notifications",
    icon: <MessageSquare className="w-5 h-5" />,
    category: "communication",
    manageUrl: "/settings/notifications",
    setupLocation: "Notification Settings",
  },
  {
    id: "whatsapp",
    name: "WhatsApp Business",
    description: "Message via WhatsApp",
    icon: <MessageSquare className="w-5 h-5" />,
    category: "communication",
    manageUrl: "/settings/notifications",
    setupLocation: "Notification Settings",
  },
  {
    id: "shopify",
    name: "Shopify",
    description: "Sync online store products",
    icon: <ShoppingBag className="w-5 h-5" />,
    category: "ecommerce",
    manageUrl: "/website/connect",
    setupLocation: "Website Builder",
  },
  {
    id: "woocommerce",
    name: "WooCommerce",
    description: "Sync WordPress store",
    icon: <Package className="w-5 h-5" />,
    category: "ecommerce",
    manageUrl: "/website/connect",
    setupLocation: "Website Builder",
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  payments: "Payments",
  calendar: "Calendar",
  communication: "Communication",
  ecommerce: "E-commerce",
};

export default function ConnectedServicesClient({ 
  hasStripe, 
  integrations 
}: ConnectedServicesClientProps) {
  const integrationMap = new Map(integrations.map(i => [i.type, i]));
  
  const isConnected = (serviceId: string): boolean => {
    if (serviceId === "stripe") return hasStripe;
    const integration = integrationMap.get(serviceId);
    return integration?.status === "connected";
  };

  const connectedServices = SERVICES.filter(s => isConnected(s.id));
  const availableServices = SERVICES.filter(s => !isConnected(s.id));

  return (
    <div className="space-y-8">
      {/* Connected Services */}
      <section>
        <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-3">
          Connected ({connectedServices.length})
        </h2>
        
        {connectedServices.length === 0 ? (
          <div className="bg-stone-50 border border-stone-200 rounded-xl p-6 text-center">
            <p className="text-stone-500">No services connected yet.</p>
            <p className="text-sm text-stone-400 mt-1">
              Set them up where you need them — in POS, Appointments, or Website Builder.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {connectedServices.map((service) => {
              const integration = integrationMap.get(service.id);
              return (
                <div
                  key={service.id}
                  className="bg-green-50/50 border border-green-200 rounded-xl p-4 flex items-center gap-4"
                >
                  <div className="w-10 h-10 rounded-lg bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0">
                    {service.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-stone-900">{service.name}</h3>
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    </div>
                    <p className="text-sm text-stone-500">{service.description}</p>
                    {integration?.last_sync_at && (
                      <p className="text-xs text-stone-400 mt-0.5">
                        Last synced: {new Date(integration.last_sync_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <Link
                    href={service.manageUrl}
                    className="text-sm text-amber-600 hover:text-amber-700 font-medium flex items-center gap-1"
                  >
                    Manage
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Available Services */}
      <section>
        <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-3">
          Available Services
        </h2>
        
        <div className="grid gap-3">
          {availableServices.map((service) => (
            <div
              key={service.id}
              className="bg-white border border-stone-200 rounded-xl p-4 flex items-center gap-4"
            >
              <div className="w-10 h-10 rounded-lg bg-stone-100 text-stone-500 flex items-center justify-center flex-shrink-0">
                {service.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-stone-900">{service.name}</h3>
                <p className="text-sm text-stone-500">{service.description}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <XCircle className="w-4 h-4 text-stone-300 mb-1 ml-auto" />
                <p className="text-xs text-stone-400">Set up in {service.setupLocation}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Help Text */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-3">
        <Mail className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="font-medium text-stone-900">Where do I set these up?</h4>
          <p className="text-sm text-stone-600 mt-1">
            Each service is connected where you need it. For example, Stripe is set up when 
            you try to take a card payment in POS. Google Calendar is connected in your 
            Appointments settings. No need to configure everything upfront.
          </p>
        </div>
      </div>
    </div>
  );
}
