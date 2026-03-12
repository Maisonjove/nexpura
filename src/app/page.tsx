import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#FAFAF9] text-[#09090B]">

      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-[#FAFAF9]/90 backdrop-blur-md border-b border-zinc-200">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-xl font-semibold tracking-tight">nexpura</span>
          <div className="hidden md:flex items-center gap-8 text-sm text-[#71717A]">
            <a href="#features" className="hover:text-[#09090B] transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-[#09090B] transition-colors">How it works</a>
            <a href="#pricing" className="hover:text-[#09090B] transition-colors">Pricing</a>
            <a href="/demo" className="hover:text-[#09090B] transition-colors">Demo</a>
          </div>
          <div className="flex items-center gap-3">
            <a href="#" className="text-sm text-[#71717A] hover:text-[#09090B] transition-colors hidden md:block">Login</a>
            <a href="#pricing" className="text-sm font-medium bg-[#C9A96E] text-[#18181B] px-4 py-2 rounded-full hover:bg-[#b8955a] transition-colors">
              Start free trial
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-20">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-[#C9A96E]/10 text-[#C9A96E] text-xs font-medium px-3 py-1 rounded-full mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[#C9A96E]"></span>
            Now in early access
          </div>
          <h1 className="text-5xl font-semibold leading-[1.15] tracking-tight text-[#09090B] mb-6">
            The cloud OS for<br />jewellery businesses
          </h1>
          <p className="text-lg text-[#71717A] leading-relaxed mb-8 max-w-xl">
            Manage bespoke jobs, repairs, stock, invoices, and customers — all in one place. Built for jewellers who take their craft seriously.
          </p>
          <div className="flex items-center gap-3 mb-12">
            <a href="#pricing" className="bg-[#18181B] text-white text-sm font-medium px-6 py-3 rounded-full hover:bg-zinc-800 transition-colors">
              Start free trial
            </a>
            <a href="/demo" className="text-sm font-medium text-[#09090B] border border-zinc-300 px-6 py-3 rounded-full hover:border-zinc-400 transition-colors">
              See the demo →
            </a>
          </div>
          <p className="text-xs text-[#71717A]">Trusted by jewellers across Australia, UK & Europe</p>
        </div>

        {/* Hero visual */}
        <div className="mt-16 relative">
          <div className="bg-[#18181B] rounded-2xl p-6 shadow-2xl border border-zinc-800">
            {/* Fake top bar */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-[#C9A96E]"></div>
                <span className="text-white text-sm font-medium">nexpura</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="bg-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-400 w-48">Search...</div>
                <div className="bg-[#C9A96E] text-[#18181B] text-xs font-medium px-3 py-1.5 rounded-lg">+ New</div>
              </div>
            </div>
            {/* Fake stats */}
            <div className="grid grid-cols-4 gap-3 mb-6">
              {[
                { label: "Today's Sales", value: "$3,240" },
                { label: "Jobs In Progress", value: "12" },
                { label: "Repairs Pending", value: "7" },
                { label: "Low Stock Alerts", value: "3" },
              ].map((stat) => (
                <div key={stat.label} className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                  <p className="text-zinc-500 text-xs mb-1">{stat.label}</p>
                  <p className="text-white text-xl font-semibold">{stat.value}</p>
                </div>
              ))}
            </div>
            {/* Fake table */}
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
                <span className="text-zinc-400 text-xs font-medium">Recent Bespoke Jobs</span>
                <span className="text-[#C9A96E] text-xs">View all →</span>
              </div>
              {[
                { job: "BJ-0042", customer: "Emma Clarke", type: "Engagement Ring", status: "In Progress", color: "text-blue-400" },
                { job: "BJ-0041", customer: "Michael Chen", type: "Wedding Band", status: "CAD Review", color: "text-yellow-400" },
                { job: "BJ-0040", customer: "Sarah Williams", type: "Pendant", status: "Completed", color: "text-green-400" },
              ].map((row) => (
                <div key={row.job} className="px-4 py-3 flex items-center justify-between border-b border-zinc-800 last:border-0">
                  <span className="text-zinc-500 text-xs">{row.job}</span>
                  <span className="text-zinc-300 text-xs">{row.customer}</span>
                  <span className="text-zinc-500 text-xs">{row.type}</span>
                  <span className={`text-xs font-medium ${row.color}`}>{row.status}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Glow */}
          <div className="absolute inset-0 rounded-2xl bg-[#C9A96E]/5 blur-3xl -z-10 scale-95 translate-y-4"></div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-white border-y border-zinc-200 py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-semibold tracking-tight mb-4">Everything your jewellery business needs</h2>
            <p className="text-[#71717A] max-w-xl mx-auto">One platform to replace the spreadsheets, notebooks, and disconnected tools you're currently juggling.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: "💎", title: "Bespoke Jobs", desc: "Manage custom orders with structured specs, Kanban workflow pipelines, CAD tracking, and profit calculators." },
              { icon: "🔧", title: "Repairs", desc: "Intake, track, and close repairs with photo uploads, condition notes, and branded intake forms." },
              { icon: "📦", title: "Stock Inventory", desc: "Real-time inventory with SKUs, pricing, supplier links, low stock alerts, and batch tag printing." },
              { icon: "🧾", title: "Invoices & Quotes", desc: "Beautiful branded PDFs sent straight to your customers. One-click conversion from quote to invoice." },
              { icon: "👥", title: "Customer CRM", desc: "Full customer history — jobs, repairs, purchases, preferences, ring sizes, and attachments." },
              { icon: "📊", title: "Reports", desc: "Sales, profit, stock value, and customer insights at a glance. Know your numbers instantly." },
            ].map((f) => (
              <div key={f.title} className="bg-[#FAFAF9] border border-zinc-200 rounded-2xl p-6 hover:border-[#C9A96E]/40 transition-colors">
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-[#71717A] leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-semibold tracking-tight mb-4">Up and running in minutes</h2>
            <p className="text-[#71717A]">No setup complexity. No IT department needed.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: "01", title: "Create your account", desc: "Sign up and complete your business profile in under 5 minutes. No credit card required for trial." },
              { step: "02", title: "Add your business", desc: "Upload your logo, set your brand colour, and configure your document templates. Done in one screen." },
              { step: "03", title: "Start working", desc: "Add customers, create your first bespoke job, and send a professional invoice — all on day one." },
            ].map((s) => (
              <div key={s.step} className="flex gap-5">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full border-2 border-[#C9A96E] flex items-center justify-center text-[#C9A96E] text-sm font-semibold">
                    {s.step}
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">{s.title}</h3>
                  <p className="text-sm text-[#71717A] leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-white border-y border-zinc-200 py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-semibold tracking-tight mb-4">Simple, transparent pricing</h2>
            <p className="text-[#71717A]">Cancel anytime. No hidden fees.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              {
                name: "Starter",
                price: "$49",
                period: "/month",
                desc: "Perfect for solo jewellers",
                features: ["1 user", "All core modules", "5GB storage", "PDF generation", "Email support"],
                cta: "Get started",
                popular: false,
              },
              {
                name: "Pro",
                price: "$99",
                period: "/month",
                desc: "For growing jewellery businesses",
                features: ["5 users", "All modules", "20GB storage", "Priority support", "Custom branding", "Reports"],
                cta: "Get started",
                popular: true,
              },
              {
                name: "Enterprise",
                price: "$199",
                period: "/month",
                desc: "For workshops and ateliers",
                features: ["Unlimited users", "All modules", "100GB storage", "Dedicated support", "Custom domain", "API access"],
                cta: "Contact us",
                popular: false,
              },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl border p-6 flex flex-col ${plan.popular ? "border-[#C9A96E] bg-[#18181B] text-white" : "border-zinc-200 bg-[#FAFAF9]"}`}
              >
                {plan.popular && (
                  <div className="text-[#C9A96E] text-xs font-semibold tracking-wide uppercase mb-4">⭐ Most Popular</div>
                )}
                <div className="mb-1">
                  <h3 className={`font-semibold text-lg ${plan.popular ? "text-white" : ""}`}>{plan.name}</h3>
                  <p className={`text-xs mt-1 ${plan.popular ? "text-zinc-400" : "text-[#71717A]"}`}>{plan.desc}</p>
                </div>
                <div className="flex items-baseline gap-1 my-5">
                  <span className={`text-4xl font-semibold ${plan.popular ? "text-white" : ""}`}>{plan.price}</span>
                  <span className={`text-sm ${plan.popular ? "text-zinc-400" : "text-[#71717A]"}`}>{plan.period}</span>
                </div>
                <ul className="space-y-2.5 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <span className="text-[#C9A96E]">✓</span>
                      <span className={plan.popular ? "text-zinc-300" : "text-[#71717A]"}>{f}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href="#"
                  className={`text-center text-sm font-medium py-3 rounded-full transition-colors ${plan.popular ? "bg-[#C9A96E] text-[#18181B] hover:bg-[#b8955a]" : "border border-zinc-300 hover:border-zinc-400 text-[#09090B]"}`}
                >
                  {plan.cta}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div>
              <span className="text-lg font-semibold">nexpura</span>
              <p className="text-sm text-[#71717A] mt-1">Cloud OS for jewellery businesses</p>
            </div>
            <div className="flex flex-wrap gap-6 text-sm text-[#71717A]">
              <a href="#features" className="hover:text-[#09090B] transition-colors">Features</a>
              <a href="#pricing" className="hover:text-[#09090B] transition-colors">Pricing</a>
              <a href="#" className="hover:text-[#09090B] transition-colors">Contact</a>
              <a href="#" className="hover:text-[#09090B] transition-colors">Privacy</a>
              <a href="#" className="hover:text-[#09090B] transition-colors">Terms</a>
            </div>
          </div>
          <div className="mt-10 pt-8 border-t border-zinc-200">
            <p className="text-xs text-[#71717A]">© 2025 Nexpura. All rights reserved.</p>
          </div>
        </div>
      </footer>

    </div>
  );
}
