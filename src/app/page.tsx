// Landing page - no auth check needed
import Link from "next/link";
import { Gem, Wrench, Package, Users, FileText, ShoppingCart, Truck, BarChart2, ArrowRight, CheckCircle, ChevronDown } from "lucide-react";
import { NavBar } from "@/components/marketing/NavBar";
import { Footer } from "@/components/marketing/Footer";

export default async function HomePage() {
  // Don't check auth on landing page - always show marketing content
  // Only redirect to dashboard if user visits /login while already authenticated

  // Marketing landing page for unauthenticated users
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <NavBar />
      <main className="flex-1">

        {/* ── Hero ──────────────────────────────────────────────────────────────── */}
        <section className="bg-stone-950 text-white">
          <div className="max-w-5xl mx-auto px-6 py-28 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-amber-600/30 bg-amber-600/10 text-amber-400 text-xs font-medium mb-8">
              <Gem size={12} />
              Built exclusively for jewellers
            </div>
            <h1 className="text-5xl sm:text-6xl font-semibold tracking-tight leading-[1.1] mb-6">
              The modern operating system<br />
              <span className="text-amber-500">for jewellery businesses</span>
            </h1>
            <p className="text-lg text-stone-400 max-w-2xl mx-auto leading-relaxed mb-10">
              POS, repairs, bespoke design, inventory, customers, invoicing — unified in one platform built around how jewellers actually work.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/signup"
                className="px-6 py-3 bg-amber-600 text-white font-medium rounded-lg hover:bg-amber-700 transition-colors text-sm"
              >
                Start Free Trial
              </Link>
              <Link
                href="/contact"
                className="px-6 py-3 bg-white/[0.06] text-white font-medium rounded-lg hover:bg-white/[0.1] transition-colors text-sm border border-white/[0.1]"
              >
                Book a Demo
              </Link>
            </div>
            <p className="text-xs text-stone-600 mt-6">No credit card required · 14-day free trial · Cancel anytime</p>
          </div>
        </section>

        {/* ── Platform Pillars ─────────────────────────────────────────────────── */}
        <section className="border-b border-stone-200 bg-stone-50">
          <div className="max-w-6xl mx-auto px-6 py-16">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { icon: Wrench, title: "Workshop Command", desc: "Full visibility over repairs and bespoke commissions — from intake to collection." },
                { icon: Package, title: "Inventory Intelligence", desc: "Track stock, metals, stones, finished pieces and supplier relationships." },
                { icon: Users, title: "Customer Depth", desc: "Complete purchase history, preferences, VIP tagging, and automatic communications." },
                { icon: BarChart2, title: "Financial Clarity", desc: "Invoicing, expenses, outstanding balances, and end-of-day summaries." },
              ].map((p) => (
                <div key={p.title} className="flex flex-col gap-3">
                  <div className="w-10 h-10 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-center">
                    <p.icon size={18} className="text-amber-700" />
                  </div>
                  <h3 className="font-semibold text-stone-900 text-sm">{p.title}</h3>
                  <p className="text-sm text-stone-500 leading-relaxed">{p.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Core Modules ─────────────────────────────────────────────────────── */}
        <section className="py-20">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-semibold text-stone-900 mb-3">Everything your store needs</h2>
              <p className="text-stone-500 max-w-xl mx-auto">Eight core modules, deeply integrated, designed for the daily reality of running a jewellery business.</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: ShoppingCart, name: "Point of Sale", desc: "Fast, flexible POS for the shop floor." },
                { icon: Package, name: "Inventory", desc: "Full stock control with SKU and provenance." },
                { icon: Wrench, name: "Repairs & Workshop", desc: "Track every job from intake to pickup." },
                { icon: Gem, name: "Bespoke Design", desc: "Manage commissions and design stages." },
                { icon: Users, name: "Customers", desc: "CRM built for jewellers, not generic retail." },
                { icon: FileText, name: "Invoicing", desc: "Professional invoices and payment tracking." },
                { icon: Truck, name: "Suppliers", desc: "Manage suppliers, purchase orders, receiving." },
                { icon: BarChart2, name: "Analytics", desc: "Sales, workshop, and customer insights." },
              ].map((mod) => (
                <div key={mod.name} className="bg-white border border-stone-200 rounded-xl p-5 hover:shadow-md transition-shadow">
                  <div className="w-8 h-8 bg-stone-50 rounded-lg flex items-center justify-center mb-3">
                    <mod.icon size={16} className="text-stone-600" />
                  </div>
                  <h3 className="font-semibold text-stone-900 text-sm mb-1">{mod.name}</h3>
                  <p className="text-xs text-stone-500 leading-relaxed">{mod.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Command Centers ───────────────────────────────────────────────────── */}
        <section className="bg-stone-50 border-y border-stone-200 py-20">
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <div className="text-xs font-semibold text-amber-700 uppercase tracking-widest mb-3">Flagship Feature</div>
                <h2 className="text-3xl font-semibold text-stone-900 mb-4">Command Centers for repairs and bespoke</h2>
                <p className="text-stone-600 leading-relaxed mb-6">
                  Every repair job and bespoke commission gets its own Command Center — a dedicated screen with full job history, financial summary, stage actions, line items, and customer communications in one place.
                </p>
                <ul className="space-y-3">
                  {[
                    "Real-time financial summary with deposits, payments, and balance",
                    "Stage-by-stage workflow with automated customer notifications",
                    "Activity timeline showing every action and communication",
                    "Line items, labour, and material costs tracked together",
                    "Ready-for-pickup alerts and collection workflow",
                  ].map((point) => (
                    <li key={point} className="flex items-start gap-2.5 text-sm text-stone-700">
                      <CheckCircle size={16} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                      {point}
                    </li>
                  ))}
                </ul>
                <Link href="/features#command-center" className="inline-flex items-center gap-2 mt-6 text-sm font-medium text-amber-700 hover:text-amber-800">
                  See how it works <ArrowRight size={14} />
                </Link>
              </div>
              <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-stone-100">
                  <div>
                    <p className="font-semibold text-stone-900">REP-0042 · Gold Ring Resize</p>
                    <p className="text-xs text-stone-500 mt-0.5">Sarah Mitchell · Due 18 Mar</p>
                  </div>
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Ready for Pickup</span>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    { label: "Total", value: "$185.00" },
                    { label: "Paid", value: "$50.00" },
                    { label: "Balance", value: "$135.00" },
                  ].map((s) => (
                    <div key={s.label} className="bg-stone-50 rounded-lg p-3">
                      <p className="text-xs text-stone-500 mb-0.5">{s.label}</p>
                      <p className="text-sm font-semibold text-stone-900">{s.value}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-2 border-t border-stone-100 pt-4">
                  <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">Activity</p>
                  {[
                    { time: "2h ago", note: "Customer notified — ready for pickup" },
                    { time: "Yesterday", note: "Quality check passed" },
                    { time: "3 days ago", note: "Sizing completed — stone reset" },
                  ].map((a) => (
                    <div key={a.time} className="flex gap-3 items-start py-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-stone-700">{a.note}</p>
                        <p className="text-xs text-stone-400">{a.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Migration ────────────────────────────────────────────────────────── */}
        <section className="py-20">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <div className="text-xs font-semibold text-amber-700 uppercase tracking-widest mb-3">Migration Hub</div>
            <h2 className="text-3xl font-semibold text-stone-900 mb-4">Already using another system?<br />We&apos;ll bring your data with you.</h2>
            <p className="text-stone-500 mb-8 max-w-xl mx-auto leading-relaxed">
              Guided migration from Lightspeed, Shopify, Jewel360, spreadsheets, and more. Zero data loss. We migrate your customers, inventory, repair history, and transaction records — with full provenance tracking.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[
                { name: "Lightspeed", tag: "Supported" },
                { name: "Shopify", tag: "Supported" },
                { name: "Jewel360", tag: "Supported" },
                { name: "Spreadsheets", tag: "Any format" },
              ].map((src) => (
                <div key={src.name} className="bg-stone-50 border border-stone-200 rounded-xl p-4">
                  <p className="font-medium text-stone-900 text-sm mb-1">{src.name}</p>
                  <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">{src.tag}</span>
                </div>
              ))}
            </div>
            <Link href="/switching" className="inline-flex items-center gap-2 px-5 py-2.5 bg-stone-900 text-white text-sm font-medium rounded-lg hover:bg-stone-800 transition-colors">
              Learn about migration <ArrowRight size={14} />
            </Link>
          </div>
        </section>

        {/* ── Why Nexpura ──────────────────────────────────────────────────────── */}
        <section className="bg-stone-950 text-white py-20">
          <div className="max-w-5xl mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-semibold mb-3">Built exclusively for jewellers</h2>
              <p className="text-stone-400 max-w-xl mx-auto">Not adapted from generic retail software. Designed from the ground up for the unique workflows of jewellery businesses.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { title: "Jewellery-specific workflows", desc: "Repair stages, bespoke commissions, hallmarking, stone tracking — features that generic POS systems simply don't have." },
                { title: "Precision over complexity", desc: "Every feature earns its place. Clean, fast, and operationally powerful without being overwhelming." },
                { title: "Your data, always", desc: "Full data export, no lock-in. We earn your business every month." },
              ].map((point) => (
                <div key={point.title} className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-6">
                  <h3 className="font-semibold text-white mb-2">{point.title}</h3>
                  <p className="text-sm text-stone-400 leading-relaxed">{point.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing CTA Strip ────────────────────────────────────────────────── */}
        <section className="border-b border-stone-200 py-12">
          <div className="max-w-4xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div>
              <p className="font-semibold text-stone-900 text-lg">Simple, transparent pricing</p>
              <p className="text-stone-500 text-sm mt-1">Plans for single-location boutiques to multi-store groups.</p>
            </div>
            <div className="flex gap-3 flex-shrink-0">
              <Link href="/pricing" className="px-4 py-2 border border-stone-300 text-stone-700 text-sm font-medium rounded-lg hover:bg-stone-50 transition-colors">
                View pricing
              </Link>
              <Link href="/signup" className="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors">
                Start free trial
              </Link>
            </div>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────────────────────── */}
        <section className="py-20 bg-stone-50">
          <div className="max-w-3xl mx-auto px-6">
            <h2 className="text-2xl font-semibold text-stone-900 text-center mb-10">Common questions</h2>
            <div className="space-y-4">
              {[
                { q: "Do I need technical knowledge to set up Nexpura?", a: "No. Nexpura is designed to be set up in an afternoon. Our onboarding guides you through each step, and our team is available to help with migration and configuration." },
                { q: "Can I migrate my existing customer and inventory data?", a: "Yes. Our Migration Hub supports imports from Lightspeed, Shopify, Jewel360, and custom spreadsheets. We map your data, show you a preview before committing, and maintain full provenance records." },
                { q: "Does Nexpura work for repair-only workshops?", a: "Absolutely. You can configure Nexpura for retail, workshop, bespoke, or any combination. The sidebar and features adapt to your business mode." },
                { q: "Is my data secure?", a: "All data is encrypted at rest and in transit. We use Supabase with row-level security, meaning your data is completely isolated from other tenants." },
                { q: "Can I try it before committing?", a: "Yes — 14-day free trial, no credit card required. You get full access to every feature during the trial." },
                { q: "What happens if I want to leave?", a: "You can export all your data at any time. No lock-in, no exit fees. We believe software should earn its monthly fee." },
              ].map((faq) => (
                <details key={faq.q} className="bg-white border border-stone-200 rounded-xl group">
                  <summary className="flex items-center justify-between px-5 py-4 cursor-pointer text-sm font-medium text-stone-900 list-none">
                    {faq.q}
                    <ChevronDown size={16} className="text-stone-400 group-open:rotate-180 transition-transform flex-shrink-0" />
                  </summary>
                  <div className="px-5 pb-4 text-sm text-stone-600 leading-relaxed border-t border-stone-100 pt-3">
                    {faq.a}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── Final CTA ────────────────────────────────────────────────────────── */}
        <section className="py-20">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <h2 className="text-3xl font-semibold text-stone-900 mb-4">Ready to run your business better?</h2>
            <p className="text-stone-500 mb-8">Join jewellers who have moved from spreadsheets and generic software to a platform built for their craft.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/signup" className="px-6 py-3 bg-amber-600 text-white font-medium rounded-lg hover:bg-amber-700 transition-colors text-sm">
                Start Free Trial — No card needed
              </Link>
              <Link href="/contact" className="px-6 py-3 border border-stone-300 text-stone-700 font-medium rounded-lg hover:bg-stone-50 transition-colors text-sm">
                Book a Demo
              </Link>
            </div>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  );
}
