import Link from "next/link";
import { CheckCircle, Minus } from "lucide-react";

export const metadata = { title: "Pricing — Nexpura", description: "Simple, transparent pricing for jewellery businesses of all sizes." };

const plans = [
  {
    name: "Boutique",
    price: 89,
    period: "month",
    description: "Perfect for single-location independent jewellers.",
    cta: "Start Free Trial",
    featured: false,
    features: {
      "Point of Sale": true,
      "Inventory management": true,
      "Repairs & Workshop": true,
      "Bespoke commissions": true,
      "Customers CRM": true,
      "Invoicing": true,
      "Suppliers": true,
      "AI Business Copilot": true,
      "Command Centers": true,
      "Migration Hub": true,
      "Dashboard & Analytics": "Basic",
      "Team Size": "1 staff",
      "Multi-location": "1 store",
      "Website Builder": false,
      "Connect Existing Website": false,
      "AI Website Copy": false,
      "Custom branding": false,
    },
  },
  {
    name: "Studio",
    price: 179,
    period: "month",
    description: "For established jewellery businesses ready to scale.",
    cta: "Start Free Trial",
    featured: true,
    features: {
      "Point of Sale": true,
      "Inventory management": true,
      "Repairs & Workshop": true,
      "Bespoke commissions": true,
      "Customers CRM": true,
      "Invoicing": true,
      "Suppliers": true,
      "AI Business Copilot": true,
      "Command Centers": true,
      "Migration Hub": true,
      "Dashboard & Analytics": "Full",
      "Team Size": "Up to 5 staff",
      "Multi-location": "Up to 3 stores",
      "Website Builder": true,
      "Connect Existing Website": true,
      "AI Website Copy": false,
      "Custom branding": true,
    },
  },
  {
    name: "Atelier",
    price: 299,
    period: "month",
    description: "For multi-location jewellery groups and high-volume ateliers.",
    cta: "Start Free Trial",
    featured: false,
    features: {
      "Point of Sale": true,
      "Inventory management": true,
      "Repairs & Workshop": true,
      "Bespoke commissions": true,
      "Customers CRM": true,
      "Invoicing": true,
      "Suppliers": true,
      "AI Business Copilot": true,
      "Command Centers": true,
      "Migration Hub": true,
      "Dashboard & Analytics": "Full + Custom",
      "Team Size": "Unlimited",
      "Multi-location": "Unlimited",
      "Website Builder": true,
      "Connect Existing Website": true,
      "AI Website Copy": true,
      "Custom branding": true,
    },
  },
];

const featureKeys = Object.keys(plans[0].features);

function FeatureValue({ value }: { value: string | boolean }) {
  if (value === true) return <CheckCircle size={16} className="text-emerald-600 mx-auto" />;
  if (value === false) return <Minus size={16} className="text-stone-300 mx-auto" />;
  return <span className="text-xs text-stone-600">{value}</span>;
}

export default function PricingPage() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-stone-950 text-white py-20">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h1 className="text-4xl font-semibold mb-4">Transparent pricing</h1>
          <p className="text-stone-400 leading-relaxed text-lg">
            No hidden fees. No per-transaction cuts. Choose the plan that fits your business and scale when you&apos;re ready.
          </p>
          <p className="text-xs text-stone-600 mt-6 uppercase tracking-widest font-bold">All plans include a 14-day free trial · No credit card required</p>
        </div>
      </section>

      {/* Pricing cards */}
      <section className="py-16 bg-stone-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-8">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl border p-8 flex flex-col transition-all duration-300 hover:shadow-xl ${
                  plan.featured
                    ? "bg-stone-950 text-white border-stone-800 ring-2 ring-amber-600 ring-offset-2 scale-105 z-10"
                    : "bg-white border-stone-200"
                }`}
              >
                {plan.featured && (
                  <div className="text-[10px] font-bold text-amber-500 uppercase tracking-[0.2em] mb-4">Most Popular</div>
                )}
                <h2 className={`text-2xl font-bold mb-1 ${plan.featured ? "text-white" : "text-stone-900"}`}>{plan.name}</h2>
                <p className={`text-sm mb-6 leading-relaxed ${plan.featured ? "text-stone-400" : "text-stone-500"}`}>{plan.description}</p>

                <div className="mb-8">
                  <div className="flex items-baseline gap-1">
                    <span className={`text-5xl font-black ${plan.featured ? "text-white" : "text-stone-900"}`}>
                      ${plan.price}
                    </span>
                    <span className={`text-sm font-medium ${plan.featured ? "text-stone-400" : "text-stone-500"}`}>/month</span>
                  </div>
                  <p className={`text-[10px] mt-2 font-bold uppercase tracking-wider ${plan.featured ? "text-stone-500" : "text-stone-400"}`}>Billed monthly</p>
                </div>

                <Link
                  href="/signup"
                  className={`w-full text-center py-3.5 rounded-xl text-sm font-bold mb-8 transition-all ${
                    plan.featured
                      ? "bg-amber-600 text-white hover:bg-amber-500 shadow-lg shadow-amber-900/20"
                      : "bg-stone-900 text-white hover:bg-stone-800 shadow-lg shadow-stone-200"
                  }`}
                >
                  {plan.cta}
                </Link>

                <ul className="space-y-3.5 flex-1">
                  {featureKeys.slice(0, 10).map((key) => {
                    const val = plan.features[key as keyof typeof plan.features];
                    return (
                      <li key={key} className="flex items-center justify-between gap-3">
                        <span className={`text-xs font-medium ${plan.featured ? "text-stone-400" : "text-stone-600"}`}>{key}</span>
                        <div className="flex-shrink-0">
                          <FeatureValue value={val} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature comparison table */}
      <section className="py-24 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-stone-900 mb-2 text-center">Full feature comparison</h2>
          <p className="text-stone-500 text-center mb-12 text-sm">Compare technical limits and capabilities across tiers</p>
          
          <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50/50">
                  <th className="text-left px-6 py-4 text-[10px] font-bold text-stone-500 uppercase tracking-widest">Feature</th>
                  {plans.map((p) => (
                    <th key={p.name} className={`text-center px-4 py-4 text-[10px] font-bold uppercase tracking-widest ${p.featured ? "text-amber-700" : "text-stone-500"}`}>
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {featureKeys.map((key) => (
                  <tr key={key} className="hover:bg-stone-50/50 transition-colors">
                    <td className="px-6 py-4 text-stone-700 font-medium">{key}</td>
                    {plans.map((p) => (
                      <td key={p.name} className="px-4 py-4 text-center">
                        <FeatureValue value={p.features[key as keyof typeof p.features]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 bg-stone-50 border-t border-stone-200">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-stone-900 text-center mb-12">Pricing FAQ</h2>
          <div className="space-y-4">
            {[
              { q: "Can I change plans later?", a: "Yes, you can upgrade or downgrade at any time. Changes take effect at the next billing cycle. If upgrading, features are unlocked immediately." },
              { q: "Is there a setup fee?", a: "No setup fees, ever. You only pay the monthly subscription. Migration assistance is included in Studio and Atelier plans." },
              { q: "What's included in the free trial?", a: "Full access to all features in your chosen plan for 14 days. No credit card required. At the end of the trial, you can choose a plan to continue." },
              { q: "Do you offer annual billing?", a: "Yes — annual billing gives you 2 months free. This can be enabled in your billing settings after signup." },
            ].map((faq) => (
              <details key={faq.q} className="group bg-white border border-stone-200 rounded-2xl overflow-hidden transition-all">
                <summary className="flex items-center justify-between px-6 py-5 cursor-pointer text-sm font-semibold text-stone-900 list-none">
                  {faq.q}
                  <span className="text-stone-400 group-open:rotate-180 transition-transform text-lg">↓</span>
                </summary>
                <div className="px-6 pb-5 text-sm text-stone-600 leading-relaxed border-t border-stone-50 pt-4">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 text-center bg-white">
        <div className="max-w-xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-stone-900 mb-4">Start your free trial today</h2>
          <p className="text-stone-500 mb-8 leading-relaxed">Join independent jewellers using Nexpura to run their entire operation with modern tools.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup" className="px-8 py-3.5 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 transition-all shadow-lg shadow-amber-900/10">
              Get started free
            </Link>
            <Link href="/contact" className="px-8 py-3.5 border border-stone-300 text-stone-700 rounded-xl font-bold hover:bg-stone-50 transition-all">
              Talk to sales
            </Link>
          </div>
          <p className="text-[10px] text-stone-400 mt-8 font-bold uppercase tracking-widest">14 days · Full access · No credit card required</p>
        </div>
      </section>
    </div>
  );
}
