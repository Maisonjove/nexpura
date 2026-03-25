import Link from "next/link";
import { Mail, MessageSquare, Clock } from "lucide-react";

export const dynamic = "force-static";
export const metadata = { title: "Contact & Book a Demo — Nexpura", description: "Get in touch with the Nexpura team or book a demo for your jewellery business." };

export default function ContactPage() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-stone-950 text-white py-16">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h1 className="text-4xl font-semibold mb-3">Let&apos;s talk</h1>
          <p className="text-stone-400 leading-relaxed">Book a demo, ask questions, or talk to our team about your migration. We&apos;re real people who understand jewellery businesses.</p>
        </div>
      </section>

      {/* Content */}
      <section className="py-16">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-10">
            {/* Contact form */}
            <div className="bg-white border border-stone-200 rounded-2xl p-7 shadow-sm">
              <h2 className="text-lg font-semibold text-stone-900 mb-1">Send us a message</h2>
              <p className="text-sm text-stone-500 mb-6">We respond within one business day.</p>
              <form className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1.5">First name</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-600/20 focus:border-amber-600"
                      placeholder="Jane"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1.5">Last name</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-600/20 focus:border-amber-600"
                      placeholder="Smith"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1.5">Business name</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-600/20 focus:border-amber-600"
                    placeholder="Smith & Co Jewellers"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1.5">Email address</label>
                  <input
                    type="email"
                    className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-600/20 focus:border-amber-600"
                    placeholder="jane@smithjewellers.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1.5">What are you enquiring about?</label>
                  <select className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-600/20 focus:border-amber-600 bg-white">
                    <option value="">Select a topic</option>
                    <option value="demo">Book a product demo</option>
                    <option value="trial">Help with my free trial</option>
                    <option value="migration">Migration from another system</option>
                    <option value="pricing">Pricing and plans</option>
                    <option value="other">Something else</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1.5">Message</label>
                  <textarea
                    rows={4}
                    className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-600/20 focus:border-amber-600 resize-none"
                    placeholder="Tell us about your business and what you're looking for..."
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors"
                >
                  Send message
                </button>
              </form>
            </div>

            {/* Info panel */}
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="text-lg font-semibold text-stone-900 mb-4">Other ways to reach us</h2>
                <div className="space-y-4">
                  {[
                    { icon: Mail, title: "Email", desc: "hello@nexpura.com", sub: "We respond within 24 hours" },
                    { icon: MessageSquare, title: "Live chat", desc: "Available inside the app", sub: "Mon–Fri, 9am–5pm AEST" },
                    { icon: Clock, title: "Book a demo", desc: "30-minute guided walkthrough", sub: "We'll show you exactly what Nexpura can do for your business" },
                  ].map((item) => (
                    <div key={item.title} className="flex gap-4">
                      <div className="w-9 h-9 bg-stone-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <item.icon size={17} className="text-stone-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-stone-900">{item.title}</p>
                        <p className="text-sm text-stone-600">{item.desc}</p>
                        <p className="text-xs text-stone-400 mt-0.5">{item.sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* What to expect from a demo */}
              <div className="bg-stone-50 border border-stone-200 rounded-xl p-5">
                <h3 className="font-semibold text-stone-900 text-sm mb-3">What happens in a demo?</h3>
                <ul className="space-y-2.5 text-sm text-stone-600">
                  {[
                    "We learn about your business and current system",
                    "Walkthrough of the features most relevant to you",
                    "Live demonstration of repairs, bespoke, and POS",
                    "Migration plan for your existing data",
                    "Pricing and next steps — no pressure",
                  ].map((p) => (
                    <li key={p} className="flex gap-2 items-start">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-600 mt-1.5 flex-shrink-0" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                <p className="text-sm font-medium text-amber-800 mb-1">Already signed up?</p>
                <p className="text-sm text-amber-700 mb-3">Access support and migration tools directly inside the app.</p>
                <Link href="/login" className="text-sm font-medium text-amber-700 hover:text-amber-800 underline">
                  Sign in to your account →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
