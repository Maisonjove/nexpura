import Link from "next/link";
import { CheckCircle, ArrowRight, Database, Shield, Users, Package, Wrench, FileText } from "lucide-react";
import Button from "@/components/landing/ui/Button";

export const metadata = {
  title: "Switch to Nexpura — Migration Hub",
  description:
    "Migrate from your current system to Nexpura with zero data loss. Guided migration for jewellery businesses.",
};

/**
 * Migration / "Switch to Nexpura" page restyled to the homepage system
 * per Kaitlyn brief #2 Section 10D. Content (sources, steps, guarantees)
 * preserved verbatim. The previous palette mixed amber/stone/emerald
 * which doesn't appear anywhere else on the marketing site — replaced
 * with the m-* tokens. Buttons swap to the shared Button component.
 */

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
  { num: 2, title: "Upload your export", desc: "Export your data from your current system (we provide guides for each source). Upload the files." },
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

function supportedTone(level: string) {
  if (level === "Full") return "bg-m-champagne-tint text-m-charcoal border-m-champagne";
  if (level === "Partial") return "bg-m-champagne-soft/40 text-m-charcoal-soft border-m-champagne-soft";
  return "bg-m-ivory text-m-text-secondary border-m-border-soft";
}

export default function SwitchingPage() {
  return (
    <div className="bg-m-ivory">
      {/* Hero — charcoal stripe */}
      <section className="bg-m-charcoal text-white py-24 lg:py-32 px-6 sm:px-10 lg:px-20">
        <div className="max-w-[820px] mx-auto text-center">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-m-champagne/40 bg-m-champagne/10 text-m-champagne text-[12px] font-medium tracking-[0.18em] uppercase mb-6">
            Migration Hub
          </span>
          <h1 className="font-serif text-[42px] sm:text-[56px] lg:text-[clamp(2.75rem,5vw,4.5rem)] font-normal leading-[1.06] tracking-[-0.015em] mb-5">
            Switch to Nexpura.
            <br />
            <em className="italic">Bring everything with you.</em>
          </h1>
          <p className="text-[16px] sm:text-[18px] text-m-champagne-soft leading-[1.55] max-w-[560px] mx-auto">
            Guided migration from your current system to Nexpura. Zero data loss, full provenance tracking, and a preview before we commit anything.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-10">
            <Button href="/signup" size="lg" className="!bg-white !text-m-charcoal hover:!bg-m-champagne-tint">
              Start Migration
            </Button>
            <Button href="/contact" variant="tertiary" className="!text-white after:!bg-white">
              Talk to our team
            </Button>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 lg:py-28 px-6 sm:px-10 lg:px-20 bg-m-white-soft border-b border-m-border-soft">
        <div className="max-w-[820px] mx-auto">
          <p className="text-[12px] tracking-[0.18em] text-m-text-faint uppercase font-medium text-center mb-3">
            Process
          </p>
          <h2 className="font-serif text-[32px] sm:text-[40px] lg:text-[44px] font-normal leading-[1.12] tracking-[-0.01em] text-m-charcoal text-center mb-12">
            How migration works
          </h2>
          <ol className="space-y-2">
            {steps.map((step, idx) => (
              <li key={step.num} className="flex gap-5 items-start">
                <div className="w-[42px] h-[42px] rounded-full bg-m-charcoal text-white text-[15px] font-semibold flex items-center justify-center flex-shrink-0 mt-0.5">
                  {step.num}
                </div>
                <div
                  className={`flex-1 pt-1 pb-5 ${idx < steps.length - 1 ? "border-b border-m-border-soft" : ""}`}
                >
                  <h3 className="font-sans font-semibold text-[18px] text-m-charcoal mb-1.5 leading-[1.3]">
                    {step.title}
                  </h3>
                  <p className="text-[15px] text-m-text-secondary leading-[1.6]">
                    {step.desc}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Guarantees */}
      <section className="py-20 lg:py-28 px-6 sm:px-10 lg:px-20">
        <div className="max-w-[1200px] mx-auto">
          <p className="text-[12px] tracking-[0.18em] text-m-text-faint uppercase font-medium text-center mb-3">
            Guarantees
          </p>
          <h2 className="font-serif text-[32px] sm:text-[40px] lg:text-[44px] font-normal leading-[1.12] tracking-[-0.01em] text-m-charcoal text-center mb-3">
            What we guarantee
          </h2>
          <p className="text-[16px] text-m-text-secondary text-center mb-12 max-w-[620px] mx-auto leading-[1.55]">
            We take data migration seriously. These are not just promises — they&apos;re built into how our Migration Hub works.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {guarantees.map((g) => (
              <div
                key={g.title}
                className="bg-m-white-soft border border-m-border-soft rounded-[18px] p-[22px] sm:p-8 transition-all duration-[250ms] [transition-timing-function:var(--m-ease)] hover:-translate-y-1 hover:border-m-border-hover hover:shadow-[0_18px_45px_rgba(0,0,0,0.06)]"
              >
                <div className="w-10 h-10 rounded-xl bg-m-champagne-tint border border-m-champagne-soft flex items-center justify-center mb-4">
                  <g.icon size={18} strokeWidth={1.75} className="text-m-charcoal" />
                </div>
                <h3 className="font-serif text-[20px] text-m-charcoal mb-2 leading-[1.25]">
                  {g.title}
                </h3>
                <p className="text-[14px] text-m-text-secondary leading-[1.6]">
                  {g.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Supported sources */}
      <section className="py-20 lg:py-28 px-6 sm:px-10 lg:px-20 bg-m-white-soft border-y border-m-border-soft">
        <div className="max-w-[1200px] mx-auto">
          <p className="text-[12px] tracking-[0.18em] text-m-text-faint uppercase font-medium text-center mb-3">
            Sources
          </p>
          <h2 className="font-serif text-[32px] sm:text-[40px] lg:text-[44px] font-normal leading-[1.12] tracking-[-0.01em] text-m-charcoal text-center mb-3">
            Supported sources
          </h2>
          <p className="text-[16px] text-m-text-secondary text-center mb-12 max-w-[620px] mx-auto leading-[1.55]">
            We support migration from the most common jewellery and retail platforms.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {sources.map((src) => (
              <div
                key={src.name}
                className="bg-m-ivory border border-m-border-soft rounded-[16px] p-5 transition-colors duration-200 hover:border-m-border-hover"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <h3 className="font-sans font-semibold text-[15px] text-m-charcoal leading-[1.3]">
                      {src.name}
                    </h3>
                    <p className="text-[12px] text-m-text-faint mt-1 tracking-[0.05em]">
                      {src.category}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-medium tracking-[0.1em] uppercase px-2 py-0.5 rounded-full border flex-shrink-0 ${supportedTone(src.supported)}`}
                  >
                    {src.supported}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {src.entities.slice(0, 3).map((e) => (
                    <span
                      key={e}
                      className="text-[11px] bg-m-warm-tint text-m-text-secondary px-2 py-0.5 rounded-full border border-m-border-soft-2"
                    >
                      {e}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 lg:py-32 px-6 sm:px-10 lg:px-20 text-center bg-m-charcoal">
        <h2 className="font-serif text-[36px] sm:text-[48px] lg:text-[56px] font-normal leading-[1.12] tracking-[-0.01em] text-white mb-3">
          Ready to make the switch?
        </h2>
        <p className="text-[15px] text-m-champagne-soft mb-3 max-w-[560px] mx-auto leading-[1.6]">
          Book a demo and we will walk you through the Migration Hub. Our team will handle your data import at every step.
        </p>
        <ul className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-6 mb-10 text-[14px] text-m-champagne-soft">
          {["Zero data loss guarantee", "Preview before committing", "Free migration with every plan"].map((p) => (
            <li key={p} className="flex items-center gap-2">
              <CheckCircle size={14} className="text-m-champagne" />
              {p}
            </li>
          ))}
        </ul>
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Button href="/contact" size="lg" className="!bg-white !text-m-charcoal hover:!bg-m-champagne-tint">
            Book a Demo
          </Button>
          <Link
            href="/platform"
            className="inline-flex items-center gap-1.5 text-[15px] font-sans font-medium text-white hover:text-m-champagne transition-colors duration-200"
          >
            See the Platform
            <ArrowRight size={14} />
          </Link>
        </div>
      </section>
    </div>
  );
}
