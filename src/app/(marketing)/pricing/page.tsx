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
      "Bespoke commissions": "Up to 20/month",
      "Customers CRM": true,
      "Invoicing": true,
      "Suppliers": true,
      "Dashboard & Analytics": "Basic",
      "Command Centers": true,
      "Migration Hub": true,
      "Email notifications": true,
      "Multi-location": false,
      "Team roles & permissions": "2 staff",
      "Priority support": false,
      "Custom branding": false,
      "API access": false,
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
      "Bespoke commissions": "Unlimited",
      "Customers CRM": true,
      "Invoicing": true,
      "Suppliers": true,
      "Dashboard & Analytics": "Full",
      "Command Centers": true,
      "Migration Hub": true,
      "Email notifications": true,
      "Multi-location": "Up to 3",
      "Team roles & permissions": "10 staff",
      "Priority support": true,
      "Custom branding": true,
      "API access": false,
    },
  },
  {
    name: "Group",
    price: null,
    period: "month",
    description: "For multi-location jewellery groups and chains.",
    cta: "Contact Sales",
    featured: false,
    features: {
      "Point of Sale": true,
      "Inventory management": true,
      "Repairs & Workshop": true,
      "Bespoke commissions": "Unlimited",
      "Customers CRM": true,
      "Invoicing": true,
      "Suppliers": true,
      "Dashboard & Analytics": "Full + Custom",
      "Command Centers": true,
      "Migration Hub": true,
      "Email notifications": true,
      "Multi-location": "Unlimited",
      "Team roles & permissions": "Unlimited",
      "Priority support": true,
      "Custom branding": true,
      "API access": true,
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
          <p className="text-stone-400 leading-relaxed">
            No hidden fees. No per-transaction cuts. Choose the plan that fits your business and scale when you&apos;re ready.
          </p>
          <p className="text-xs text-stone-600 mt-4">All plans include a 14-day free trial. No credit card required.</p>
        </div>
      </section>

      {/* Pricing cards */}
      <section className="py-16 bg-stone-50">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl border p-7 flex flex-col ${
                  plan.featured
                    ? "bg-stone-950 text-white border-stone-800 ring-2 ring-amber-600 ring-offset-2"
                    : "bg-white border-stone-200"
                }`}
              >
                {plan.featured && (
                  <div className="text-xs font-semibold text-amber-500 uppercase tracking-widest mb-3">Most Popular</div>
                )}
                <h2 className={`text-xl font-semibold mb-1 ${plan.featured ? "text-white" : "text-stone-900"}`}>{plan.name}</h2>
                <p className={`text-sm mb-5 ${plan.featured ? "text-stone-400" : "text-stone-500"}`}>{plan.description}</p>

                <div className="mb-6">
                  {plan.price !== null ? (
                    <div className="flex items-baseline gap-1">
                      <span className={`text-4xl font-bold ${plan.featured ? "text-white" : "text-stone-900"}`}>
                        ${plan.price}
                      </span>
                      <span className={`text-sm ${plan.featured ? "text-stone-400" : "text-stone-500"}`}>/month</span>
                    </div>
                  ) : (
                    <div className="text-2xl font-bold text-stone-900 dark:text-white">Custom pricing</div>
                  )}
                </div>

                <Link
                  href={plan.cta === "Contact Sales" ? "/contact" : "/signup"}
                  className={`w-full text-center py-2.5 rounded-lg text-sm font-medium mb-6 transition-colors ${
                    plan.featured
                      ? "bg-amber-600 text-white hover:bg-amber-700"
                      : "bg-stone-900 text-white hover:bg-stone-800"
                  }`}
                >
                  {plan.cta}
                </Link>

                <ul className="space-y-2.5 flex-1">
                  {featureKeys.slice(0, 8).map((key) => {
                    const val = plan.features[key as keyof typeof plan.features];
                    return (
                      <li key={key} className="flex items-center justify-between gap-3">
                        <span className={`text-xs ${plan.featured ? "text-stone-400" : "text-stone-600"}`}>{key}</span>
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
      <section className="py-16">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-xl font-semibold text-stone-900 mb-8 text-center">Full feature comparison</h2>
          <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50">
                  <th className="text-left px-5 py-3 text-xs font-medium text-stone-500 uppercase tracking-wide">Feature</th>
                  {plans.map((p) => (
                    <th key={p.name} className={`text-center px-4 py-3 text-xs font-medium uppercase tracking-wide ${p.featured ? "text-amber-700" : "text-stone-500"}`}>
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {featureKeys.map((key) => (
                  <tr key={key} className="hover:bg-stone-50 transition-colors">
                    <td className="px-5 py-3 text-stone-700">{key}</td>
                    {plans.map((p) => (
                      <td key={p.name} className="px-4 py-3 text-center">
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
      <section className="py-16 bg-stone-50 border-t border-stone-200">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-xl font-semibold text-stone-900 text-center mb-8">Pricing questions</h2>
          <div className="space-y-4">
            {[
              { q: "Can I change plans later?", a: "Yes, you can upgrade or downgrade at any time. Changes take effect at the next billing cycle." },
              { q: "Is there a setup fee?", a: "No setup fees, ever. You only pay the monthly subscription." },
              { q: "What's included in the free trial?", a: "Full access to all features in your chosen plan for 14 days. No credit card required." },
              { q: "Do you offer annual billing?", a: "Yes — annual billing gives you 2 months free. Contact us for a quote." },
            ].map((faq) => (
              <details key={faq.q} className="bg-white border border-stone-200 rounded-xl">
                <summary className="flex items-center justify-between px-5 py-4 cursor-pointer text-sm font-medium text-stone-900 list-none">
                  {faq.q}
                </summary>
                <div className="px-5 pb-4 text-sm text-stone-600 leading-relaxed border-t border-stone-100 pt-3">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 text-center">
        <div className="max-w-xl mx-auto px-6">
          <h2 className="text-2xl font-semibold text-stone-900 mb-3">Start your free trial today</h2>
          <p className="text-stone-500 mb-6">14 days, full access. No credit card needed.</p>
          <div className="flex gap-3 justify-center">
            <Link href="/signup" className="px-5 py-2.5 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors">
              Get started free
            </Link>
            <Link href="/contact" className="px-5 py-2.5 border border-stone-300 text-stone-700 text-sm font-medium rounded-lg hover:bg-stone-50 transition-colors">
              Talk to sales
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
