import Link from "next/link";
import { Wrench, Package, Users, FileText, ShoppingCart, Truck, BarChart2, Gem, CheckCircle, ArrowRight, Zap, Shield, Clock } from "lucide-react";

export const metadata = { title: "Features — Nexpura", description: "Every feature Nexpura offers, explained for jewellers." };

function FeatureSection({ id, icon: Icon, title, tagline, features, accent }: {
  id: string;
  icon: React.ElementType;
  title: string;
  tagline: string;
  features: string[];
  accent?: boolean;
}) {
  return (
    <section id={id} className={`py-16 border-b border-stone-200 ${accent ? 'bg-stone-50' : 'bg-white'}`}>
      <div className="max-w-5xl mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-10 items-start">
          <div>
            <div className="w-12 h-12 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-center mb-4">
              <Icon size={22} className="text-amber-700" />
            </div>
            <h2 className="text-2xl font-semibold text-stone-900 mb-3">{title}</h2>
            <p className="text-stone-500 leading-relaxed">{tagline}</p>
            <Link href="/signup" className="inline-flex items-center gap-2 mt-6 text-sm font-medium text-amber-700 hover:text-amber-800">
              Try it free <ArrowRight size={14} />
            </Link>
          </div>
          <ul className="space-y-3">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2.5">
                <CheckCircle size={16} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-stone-700">{f}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export default function FeaturesPage() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-stone-950 text-white py-20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h1 className="text-4xl font-semibold mb-4">Every feature. Built for jewellers.</h1>
          <p className="text-stone-400 max-w-xl mx-auto leading-relaxed">
            Nexpura covers the full spectrum of jewellery business operations — from the shop floor to the workshop, from customer relationships to financial management.
          </p>
        </div>
      </section>

      {/* Quick nav */}
      <div className="sticky top-16 z-40 bg-white border-b border-stone-200 overflow-x-auto">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex gap-1 py-2">
            {[
              { label: "POS", href: "#pos" },
              { label: "Repairs", href: "#repairs" },
              { label: "Bespoke", href: "#bespoke" },
              { label: "Inventory", href: "#inventory" },
              { label: "Customers", href: "#customers" },
              { label: "Invoicing", href: "#invoices" },
              { label: "Suppliers", href: "#suppliers" },
              { label: "Command Centers", href: "#command-center" },
              { label: "Analytics", href: "#analytics" },
            ].map((n) => (
              <a key={n.href} href={n.href} className="px-3 py-1.5 text-sm text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg whitespace-nowrap transition-colors">
                {n.label}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Feature sections */}
      <FeatureSection
        id="pos"
        icon={ShoppingCart}
        title="Point of Sale"
        tagline="A fast, intuitive POS designed for the jewellery shop floor. Process sales, layby, gift vouchers, and returns without slowing down service."
        features={[
          "Fast barcode and SKU scanning",
          "Layby / payment plan support",
          "Gift voucher creation and redemption",
          "Multiple payment methods including split tender",
          "Automatic customer creation from sale",
          "Real-time inventory deduction",
          "Receipt printing and email delivery",
          "End-of-day cash reconciliation",
        ]}
      />

      <FeatureSection
        id="repairs"
        icon={Wrench}
        title="Repairs & Workshop"
        tagline="Complete repair management from the first phone call to collection. Every job gets a Command Center with full visibility."
        accent
        features={[
          "Digital intake with item description and photos",
          "Stage-by-stage workflow: intake → assess → quoted → approved → in progress → QC → ready → collected",
          "Customer notifications at each stage (email/SMS)",
          "Labour and material cost tracking",
          "Repair deposit and balance management",
          "Overdue repair alerts on the dashboard",
          "Repair number sequencing and labels",
          "Batch printing of repair tags",
        ]}
      />

      <FeatureSection
        id="bespoke"
        icon={Gem}
        title="Bespoke Design Commissions"
        tagline="Manage custom jewellery commissions from concept to delivery. Track design stages, client approvals, and production milestones."
        features={[
          "Commission-specific workflow and stages",
          "Design brief and reference image storage",
          "Client approval gates",
          "Material specifications and stone requirements",
          "Milestone-based deposit and payment schedule",
          "Production timeline tracking",
          "Communication log with client",
          "Handover and certificate management",
        ]}
      />

      <FeatureSection
        id="inventory"
        icon={Package}
        title="Inventory"
        tagline="Full stock control across finished pieces, loose stones, metals, findings, and raw materials — with provenance tracking."
        accent
        features={[
          "Multi-category inventory: finished pieces, loose stones, metals",
          "SKU and barcode management",
          "Reorder level alerts",
          "Stock take and variance tracking",
          "Multi-location stock with transfer management",
          "Supplier linkage per item",
          "Full provenance and cost history",
          "Batch import from spreadsheets",
        ]}
      />

      <FeatureSection
        id="customers"
        icon={Users}
        title="Customers"
        tagline="A CRM built for jewellers. Know your customers — their purchase history, preferences, upcoming birthdays, and lifetime value."
        features={[
          "Complete purchase and repair history per customer",
          "VIP tagging and custom tags",
          "Birthday and anniversary reminders",
          "Customer notes and communication log",
          "Email campaigns and automated follow-ups",
          "Customer lifetime value reporting",
          "Import existing customer lists",
          "Merge duplicate customer records",
        ]}
      />

      <FeatureSection
        id="invoices"
        icon={FileText}
        title="Invoicing"
        tagline="Professional invoices that reflect your brand. Track what's paid, what's outstanding, and what's overdue."
        accent
        features={[
          "Professional invoice templates",
          "Partial payment and balance tracking",
          "Payment due date and overdue alerts",
          "PDF generation and email delivery",
          "GST / VAT / tax handling",
          "Invoice linked to repairs and bespoke jobs",
          "Outstanding balance dashboard",
          "Xero and accounting export",
        ]}
      />

      <FeatureSection
        id="suppliers"
        icon={Truck}
        title="Suppliers"
        tagline="Manage your supplier relationships, purchase orders, and stock receiving in one place."
        features={[
          "Supplier directory with contact and terms",
          "Purchase order creation and tracking",
          "Stock receiving and cost recording",
          "Supplier-linked inventory items",
          "Outstanding purchase order tracking",
          "Supplier invoice reconciliation",
        ]}
      />

      <FeatureSection
        id="command-center"
        icon={Zap}
        title="Command Centers"
        tagline="The flagship Nexpura feature. Every repair and bespoke job gets its own dedicated operational screen."
        accent
        features={[
          "Full job details and history in one screen",
          "Real-time financial summary: total, paid, balance",
          "Stage action buttons with automated notifications",
          "Line items, labour, and materials breakdown",
          "Activity timeline with every action logged",
          "Customer communication history",
          "Payment recording with partial payment support",
          "Linked photos and documents",
        ]}
      />

      <FeatureSection
        id="analytics"
        icon={BarChart2}
        title="Analytics & Reporting"
        tagline="Understand your business with reports designed around jewellery metrics — not generic retail analytics."
        features={[
          "Sales by period, category, and staff member",
          "Workshop throughput and completion rates",
          "Customer acquisition and retention metrics",
          "Outstanding and overdue summary",
          "Inventory turnover analysis",
          "End-of-day and period closing reports",
          "Exportable to CSV for accountants",
        ]}
      />

      {/* Trust bar */}
      <section className="bg-stone-950 py-12">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
            {[
              { icon: Shield, title: "Secure by design", desc: "Row-level security. Your data is isolated and encrypted." },
              { icon: Clock, title: "Always on", desc: "99.9% uptime SLA. Running when you need it." },
              { icon: ArrowRight, title: "Always improving", desc: "New features shipped regularly, informed by real jewellers." },
            ].map((t) => (
              <div key={t.title} className="flex flex-col items-center gap-2">
                <t.icon size={20} className="text-amber-500" />
                <p className="font-medium text-white text-sm">{t.title}</p>
                <p className="text-xs text-stone-400">{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 text-center">
        <div className="max-w-xl mx-auto px-6">
          <h2 className="text-2xl font-semibold text-stone-900 mb-3">Ready to see it in action?</h2>
          <p className="text-stone-500 mb-6">Start a free 14-day trial or book a demo with our team.</p>
          <div className="flex gap-3 justify-center">
            <Link href="/signup" className="px-5 py-2.5 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors">
              Start Free Trial
            </Link>
            <Link href="/contact" className="px-5 py-2.5 border border-stone-300 text-stone-700 text-sm font-medium rounded-lg hover:bg-stone-50 transition-colors">
              Book a Demo
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
