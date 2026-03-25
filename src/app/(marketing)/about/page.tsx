import Link from "next/link";
import { Gem, Users, Globe, Award, Heart } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Nexpura — Built for Jewellers",
  description: "Nexpura is the modern operating system for jewellery businesses. Learn about our mission to empower independent jewellers worldwide.",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="bg-stone-950 text-white py-24">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-amber-600/30 bg-amber-600/10 text-amber-400 text-xs font-medium mb-8">
            <Gem size={12} />
            Our Story
          </div>
          <h1 className="text-5xl font-semibold tracking-tight leading-tight mb-6">
            Built exclusively<br />
            <span className="text-amber-500">for jewellers</span>
          </h1>
          <p className="text-lg text-stone-400 max-w-2xl mx-auto leading-relaxed">
            Nexpura was created by people who understand the unique challenges of running a jewellery business — from managing complex repairs to tracking precious metal inventory, building lasting customer relationships, and growing a beautiful brand.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl font-semibold text-stone-900 mb-6">Our Mission</h2>
              <p className="text-stone-600 leading-relaxed mb-4">
                We believe independent jewellers deserve world-class software. For too long, the industry has relied on outdated, generic retail tools that don't understand the nuances of jewellery — the intricacy of repairs, the craftsmanship of bespoke commissions, the provenance of fine gemstones.
              </p>
              <p className="text-stone-600 leading-relaxed mb-4">
                Nexpura changes that. We've built every feature from the ground up with jewellers in mind — from the way repairs flow through your workshop, to how you present beautiful digital passports to your clients, to how you manage multi-location inventory with precision.
              </p>
              <p className="text-stone-600 leading-relaxed">
                Our goal is simple: give every jeweller — from a solo artisan to a multi-location atelier — the tools to run a modern, efficient, and thriving business.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: Users, label: "Jewellers Served", value: "500+" },
                { icon: Globe, label: "Countries", value: "12" },
                { icon: Award, label: "Years Building", value: "5+" },
                { icon: Heart, label: "Customer Rating", value: "4.9★" },
              ].map((stat) => (
                <div key={stat.label} className="bg-stone-50 rounded-2xl p-6 text-center">
                  <div className="w-10 h-10 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <stat.icon size={18} className="text-amber-700" />
                  </div>
                  <div className="text-2xl font-bold text-stone-900 mb-1">{stat.value}</div>
                  <div className="text-xs text-stone-500 font-medium">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 bg-stone-50 border-t border-stone-200">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-semibold text-stone-900 mb-3">What we stand for</h2>
            <p className="text-stone-500">The principles that guide everything we build</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                title: "Craft over compromise",
                desc: "We build deep, purpose-built features for jewellers — not watered-down adaptations of generic retail software.",
              },
              {
                title: "Your data, your business",
                desc: "We never sell your data. Your customers, inventory, and business intelligence belong to you — always.",
              },
              {
                title: "Partner, not vendor",
                desc: "We succeed when you succeed. That's why we offer white-glove migration support, hands-on onboarding, and a team that actually picks up the phone.",
              },
            ].map((v) => (
              <div key={v.title} className="bg-white rounded-2xl p-6 border border-stone-200">
                <h3 className="font-semibold text-stone-900 mb-3">{v.title}</h3>
                <p className="text-sm text-stone-500 leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-white border-t border-stone-200">
        <div className="max-w-xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-semibold text-stone-900 mb-4">Ready to transform your business?</h2>
          <p className="text-stone-500 mb-8 leading-relaxed">Join hundreds of jewellers who trust Nexpura to run their operations every day.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/signup"
              className="px-8 py-3.5 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 transition-all shadow-lg shadow-amber-900/10"
            >
              Start Free Trial
            </Link>
            <Link
              href="/contact"
              className="px-8 py-3.5 border border-stone-300 text-stone-700 rounded-xl font-bold hover:bg-stone-50 transition-all"
            >
              Get in Touch
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
