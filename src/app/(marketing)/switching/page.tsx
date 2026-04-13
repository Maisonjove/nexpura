import Link from "next/link";
import { CheckCircle, ArrowRight, Database, Shield, Users, Package, Wrench, FileText } from "lucide-react";

export const dynamic = "force-static";
export const metadata = { title: "Switch to Nexpura — Migration Hub", description: "Migrate from your current system to Nexpura with zero data loss. Guided migration for jewellery businesses." };

const sources = [
  { name: "Lightspeed Retail", category: "Jewellery POS", entities: ["Customers", "Inventory", "Sales", "Repair history"], supported: "Full" },
  { name: "Shopify", category: "E-commerce", entities: ["Products", "Customers", "Orders", "Variants"], supported: "Full" },
  { name: "Jewel360", category: "Jewellery software", entities: ["Customers", "Inventory", "Repairs", "Suppliers"], supported: "Full" },
  { name: "Sievert / Torchmaster", category: "Workshop software", entities: ["Repairs", "Customers", "Jobs"], supported: "Partial" },
  { name: "Excel / Google Sheets", category: "Spreadsheet", entities: ["Any structured data"], supported: "Guided" },
  { name: "QuickBooks / Xero", category: "Accounting", entities: ["Customers", "Invoices", "Suppliers"], supported: "Partial" },
  { name: "Custom CSV export", category: "Generic", entities: ["Any data we can map"], supported: "Guided" },
  { name: "Other systems", category: "Contact us", entities: ["We'll assess and build an importer"], supported: "Assessment" },
];

const steps = [
  { num: 1, title: "Choose your source", desc: "Select your current system from our supported sources list. We'll tell you what we can migrate." },
  { num: 2, title: "Upload your export", desc: "Export your data from your current system (we provide step-by-step guides for each source). Upload the files." },
  { num: 3, title: "Review the mapping", desc: "Our AI maps your fields to Nexpura's data model. You review and adjust the mapping in a visual table." },
  { num: 4, title: "Preview before import", desc: "See exactly how your data will look in Nexpura before we commit anything. Check for duplicates and anomalies." },
  { num: 5, title: "Execute and verify", desc: "We import the data with full provenance tracking. Every record shows its migration origin." },
];

const guarantees = [
  { icon: Shield, title: "Zero data loss", desc: "Every record from your source is tracked. If something doesn't map, we flag it — we never silently drop data." },
  { icon: Database, title: "Full provenance", desc: "Every migrated record shows its source, migration date, and original ID for audit purposes." },
  { icon: Users, title: "Customer history preserved", desc: "Purchase history, repair records, preferences, and notes travel with your customers." },
  { icon: Package, title: "Inventory integrity", desc: "SKUs, descriptions, categories, costs, and stock levels all migrate intact." },
  { icon: Wrench, title: "Repair history", desc: "Historical repair jobs migrate with their status, customer linkage, and completion dates." },
  { icon: FileText, title: "Financial records", desc: "Invoice history and payment records migrate for continuity of customer accounts." },
];

export default function SwitchingPage() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-stone-950 text-white py-20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-amber-600/30 bg-amber-600/10 text-amber-400 text-xs font-medium mb-6">
            Migration Hub
          </div>
          <h1 className="text-4xl font-semibold mb-4">Switch to Nexpura.<br />Bring everything with you.</h1>
          <p className="text-stone-400 leading-relaxed max-w-xl mx-auto">
            Guided migration from your current system to Nexpura. Zero data loss, full provenance tracking, and a preview before we commit anything.
          </p>
          <div className="flex gap-3 justify-center mt-8">
            <Link href="/signup" className="px-5 py-2.5 bg-amber-600 text-white font-medium rounded-lg hover:bg-amber-700 transition-colors text-sm">
              Start Migration
            </Link>
            <Link href="/contact" className="px-5 py-2.5 bg-white/[0.06] text-white font-medium rounded-lg hover:bg-white/[0.1] border border-white/[0.1] transition-colors text-sm">
              Talk to our team
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 bg-stone-50 border-b border-stone-200">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-2xl font-semibold text-stone-900 text-center mb-10">How migration works</h2>
          <div className="space-y-4">
            {steps.map((step, idx) => (
              <div key={step.num} className="flex gap-5 items-start">
                <div className="w-8 h-8 rounded-full bg-amber-600 text-white text-sm font-semibold flex items-center justify-center flex-shrink-0 mt-0.5">
                  {step.num}
                </div>
                <div className="flex-1 pb-4 border-b border-stone-200 last:border-0">
                  <h3 className="font-semibold text-stone-900 mb-1">{step.title}</h3>
                  <p className="text-sm text-stone-500 leading-relaxed">{step.desc}</p>
                </div>
                {idx < steps.length - 1 && null}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Guarantees */}
      <section className="py-16">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl font-semibold text-stone-900 text-center mb-3">What we guarantee</h2>
          <p className="text-stone-500 text-center mb-10 max-w-xl mx-auto">We take data migration seriously. These are not just promises — they&apos;re built into how our Migration Hub works.</p>
          <div className="grid md:grid-cols-3 gap-5">
            {guarantees.map((g) => (
              <div key={g.title} className="bg-white border border-stone-200 rounded-xl p-5 hover:shadow-md transition-shadow">
                <div className="w-9 h-9 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-center mb-3">
                  <g.icon size={17} className="text-amber-700" />
                </div>
                <h3 className="font-semibold text-stone-900 text-sm mb-1">{g.title}</h3>
                <p className="text-xs text-stone-500 leading-relaxed">{g.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Supported sources */}
      <section className="py-16 bg-stone-50 border-y border-stone-200">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl font-semibold text-stone-900 text-center mb-3">Supported sources</h2>
          <p className="text-stone-500 text-center mb-10">We support migration from the most common jewellery and retail platforms.</p>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
            {sources.map((src) => (
              <div key={src.name} className="bg-white border border-stone-200 rounded-xl p-4 hover:border-stone-300 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-stone-900 text-sm">{src.name}</h3>
                    <p className="text-xs text-stone-500 mt-0.5">{src.category}</p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0 ${
                    src.supported === "Full" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                    src.supported === "Partial" ? "bg-amber-50 text-amber-700 border-amber-200" :
                    "bg-stone-100 text-stone-600 border-stone-200"
                  }`}>
                    {src.supported}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {src.entities.slice(0, 3).map((e) => (
                    <span key={e} className="text-[10px] bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded-full">{e}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 text-center">
        <div className="max-w-2xl mx-auto px-6">
          <h2 className="text-2xl font-semibold text-stone-900 mb-3">Ready to make the switch?</h2>
          <p className="text-stone-500 mb-2 leading-relaxed">
            Book a demo and we will walk you through the Migration Hub. Our team will handle your data import at every step.
          </p>
          <ul className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-4 mb-8 text-sm text-stone-600">
            {["Zero data loss guarantee", "Preview before committing", "Free migration with every plan"].map((p) => (
              <li key={p} className="flex items-center gap-2">
                <CheckCircle size={14} className="text-emerald-600" />
                {p}
              </li>
            ))}
          </ul>
          <div className="flex gap-3 justify-center">
            <Link href="/contact" className="px-5 py-2.5 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors">
              Book a Demo
            </Link>
            <Link href="/platform" className="px-5 py-2.5 border border-stone-300 text-stone-700 text-sm font-medium rounded-lg hover:bg-stone-50 transition-colors">
              See the Platform <ArrowRight size={14} className="inline ml-1" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
