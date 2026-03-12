export default function Home() {
  return (
    <div className="min-h-screen bg-white text-[#0A1F0F]" style={{ fontFamily: 'Inter, sans-serif' }}>

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#071A0D]">
        <div className="max-w-7xl mx-auto px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#52B788] flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-sm bg-[#071A0D]" />
            </div>
            <span className="text-white text-lg font-semibold tracking-tight">nexpura</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-[#6B8F71]">
            <a href="#features" className="hover:text-white transition-colors duration-200">Features</a>
            <a href="#how-it-works" className="hover:text-white transition-colors duration-200">How it works</a>
            <a href="#pricing" className="hover:text-white transition-colors duration-200">Pricing</a>
            <a href="/demo" className="hover:text-white transition-colors duration-200">Demo</a>
          </div>
          <div className="flex items-center gap-4">
            <a href="#" className="text-sm text-[#6B8F71] hover:text-white transition-colors hidden md:block">Login</a>
            <a href="#pricing" className="text-sm font-medium bg-[#52B788] text-[#071A0D] px-5 py-2.5 rounded-full hover:bg-[#3da372] transition-colors duration-200">
              Start free trial
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-[#071A0D] pt-32 pb-0 overflow-hidden">
        <div className="max-w-7xl mx-auto px-8">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-[#0D2818] border border-[#1A3D27] text-[#52B788] text-xs font-medium px-4 py-1.5 rounded-full mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-[#52B788] animate-pulse"></span>
              Now in early access
            </div>
            <h1 className="text-5xl md:text-6xl font-semibold text-white leading-[1.1] tracking-tight mb-6">
              The cloud OS built<br />for jewellers
            </h1>
            <p className="text-lg text-[#6B8F71] leading-relaxed mb-10 max-w-xl mx-auto">
              Manage bespoke jobs, repairs, stock, invoices, and customers — all in one place. Built for jewellers who take their craft seriously.
            </p>
            <div className="flex items-center justify-center gap-4 mb-12">
              <a href="#pricing" className="bg-[#52B788] text-[#071A0D] text-sm font-semibold px-7 py-3.5 rounded-full hover:bg-[#3da372] transition-colors duration-200">
                Start free trial
              </a>
              <a href="/demo" className="text-sm font-medium text-white border border-[#1A3D27] px-7 py-3.5 rounded-full hover:border-[#2D6A4F] hover:bg-[#0D2818] transition-all duration-200">
                View demo →
              </a>
            </div>
            <p className="text-xs text-[#2D6A4F] tracking-wide">Trusted by jewellers across Australia, UK & Europe</p>
          </div>

          {/* App preview */}
          <div className="relative mx-auto max-w-5xl">
            <div className="bg-[#0D2818] rounded-t-2xl border border-[#1A3D27] border-b-0 overflow-hidden shadow-2xl">
              {/* Browser bar */}
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-[#1A3D27]">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-[#1A3D27]"></div>
                  <div className="w-3 h-3 rounded-full bg-[#1A3D27]"></div>
                  <div className="w-3 h-3 rounded-full bg-[#1A3D27]"></div>
                </div>
                <div className="flex-1 mx-4 bg-[#071A0D] rounded-md px-3 py-1.5 text-xs text-[#2D6A4F]">
                  app.nexpura.com/dashboard
                </div>
              </div>
              {/* Dashboard preview */}
              <div className="flex" style={{ height: '340px' }}>
                {/* Sidebar */}
                <div className="w-48 bg-[#071A0D] border-r border-[#1A3D27] flex flex-col flex-shrink-0 py-4 px-3">
                  <div className="flex items-center gap-2 px-2 mb-6">
                    <div className="w-5 h-5 rounded bg-[#52B788] flex items-center justify-center">
                      <div className="w-2 h-2 rounded-sm bg-[#071A0D]" />
                    </div>
                    <span className="text-white text-sm font-semibold">nexpura</span>
                  </div>
                  {["Dashboard", "Customers", "Bespoke Jobs", "Repairs", "Stock", "Invoices"].map((item, i) => (
                    <div key={item} className={`flex items-center gap-2.5 px-2 py-2 rounded-lg mb-0.5 text-xs ${i === 0 ? 'bg-[#1A3D27] text-[#52B788] font-medium' : 'text-[#2D6A4F] hover:text-white'}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${i === 0 ? 'bg-[#52B788]' : 'bg-[#1A3D27]'}`}></div>
                      {item}
                    </div>
                  ))}
                </div>
                {/* Content */}
                <div className="flex-1 bg-[#0A1F0F] p-5 overflow-hidden">
                  <div className="grid grid-cols-4 gap-3 mb-4">
                    {[
                      { label: "Today's Sales", value: "$3,240" },
                      { label: "Jobs Active", value: "12" },
                      { label: "Repairs", value: "7" },
                      { label: "Low Stock", value: "3" },
                    ].map((s) => (
                      <div key={s.label} className="bg-[#0D2818] border border-[#1A3D27] rounded-xl p-3">
                        <p className="text-[#2D6A4F] text-xs mb-1">{s.label}</p>
                        <p className="text-white text-xl font-semibold">{s.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-[#0D2818] border border-[#1A3D27] rounded-xl overflow-hidden">
                      <div className="px-4 py-2.5 border-b border-[#1A3D27]">
                        <span className="text-white text-xs font-medium">Recent Bespoke Jobs</span>
                      </div>
                      {[
                        { j: "BJ-042", c: "Emma Clarke", s: "In Progress", col: "bg-blue-400" },
                        { j: "BJ-041", c: "Michael Chen", s: "CAD Review", col: "bg-yellow-400" },
                        { j: "BJ-040", c: "Sarah Williams", s: "Completed", col: "bg-[#52B788]" },
                      ].map((r) => (
                        <div key={r.j} className="px-4 py-2 flex items-center justify-between">
                          <div>
                            <p className="text-white text-xs">{r.c}</p>
                            <p className="text-[#2D6A4F] text-xs">{r.j}</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className={`w-1.5 h-1.5 rounded-full ${r.col}`}></div>
                            <span className="text-xs text-[#6B8F71]">{r.s}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="bg-[#0D2818] border border-[#1A3D27] rounded-xl overflow-hidden">
                      <div className="px-4 py-2.5 border-b border-[#1A3D27]">
                        <span className="text-white text-xs font-medium">Recent Invoices</span>
                      </div>
                      {[
                        { i: "INV-091", c: "Emma Clarke", a: "$4,800", s: "Unpaid", col: "text-yellow-400" },
                        { i: "INV-090", c: "Sarah Williams", a: "$1,250", s: "Paid", col: "text-[#52B788]" },
                        { i: "INV-089", c: "David Kim", a: "$850", s: "Overdue", col: "text-red-400" },
                      ].map((r) => (
                        <div key={r.i} className="px-4 py-2 flex items-center justify-between">
                          <div>
                            <p className="text-white text-xs">{r.c}</p>
                            <p className="text-[#2D6A4F] text-xs">{r.i}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-white text-xs font-medium">{r.a}</p>
                            <p className={`text-xs ${r.col}`}>{r.s}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-28 bg-white">
        <div className="max-w-7xl mx-auto px-8">
          <div className="text-center mb-16">
            <p className="text-[#52B788] text-sm font-medium tracking-wide uppercase mb-3">Features</p>
            <h2 className="text-4xl font-semibold tracking-tight text-[#071A0D] mb-4">Everything your jewellery business needs</h2>
            <p className="text-[#6B8F71] max-w-lg mx-auto leading-relaxed">One platform to replace the spreadsheets, notebooks, and disconnected tools you're currently juggling.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: "◈", title: "Bespoke Jobs", desc: "Manage custom orders with structured specs, Kanban pipeline, CAD tracking, and a built-in profit calculator." },
              { icon: "◎", title: "Repairs", desc: "Intake, track, and close repairs with photo uploads, condition notes, and branded receipts." },
              { icon: "▦", title: "Stock Inventory", desc: "Real-time inventory with SKUs, pricing, supplier links, low stock alerts, and batch tag printing." },
              { icon: "▤", title: "Invoices & Quotes", desc: "Beautiful branded PDFs. One-click conversion from quote to invoice to bespoke job." },
              { icon: "◉", title: "Customer CRM", desc: "Full customer history — jobs, repairs, purchases, ring sizes, preferences, and attachments." },
              { icon: "▥", title: "Reports", desc: "Sales, profit margins, stock value, and customer insights — always up to date." },
            ].map((f) => (
              <div key={f.title} className="group p-7 rounded-2xl border border-[#E8F4ED] bg-[#F5FAF6] hover:border-[#52B788] hover:bg-white transition-all duration-200">
                <div className="w-10 h-10 rounded-xl bg-[#D8F3DC] flex items-center justify-center text-[#0D2818] text-xl mb-5 group-hover:bg-[#52B788] group-hover:text-white transition-all duration-200">
                  {f.icon}
                </div>
                <h3 className="font-semibold text-[#071A0D] mb-2">{f.title}</h3>
                <p className="text-sm text-[#6B8F71] leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-28 bg-[#071A0D]">
        <div className="max-w-7xl mx-auto px-8">
          <div className="text-center mb-16">
            <p className="text-[#52B788] text-sm font-medium tracking-wide uppercase mb-3">How it works</p>
            <h2 className="text-4xl font-semibold tracking-tight text-white mb-4">Up and running in minutes</h2>
            <p className="text-[#6B8F71] max-w-md mx-auto">No IT department. No setup complexity.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { step: "01", title: "Create your account", desc: "Sign up and complete your business profile in under 5 minutes. No credit card required for trial." },
              { step: "02", title: "Set up your brand", desc: "Upload your logo, set your colour, configure your document footer. Done in one screen." },
              { step: "03", title: "Start working", desc: "Add customers, create your first bespoke job, and send a professional invoice — all on day one." },
            ].map((s, i) => (
              <div key={s.step} className="relative">
                {i < 2 && (
                  <div className="hidden md:block absolute top-5 left-full w-full h-px bg-[#1A3D27] -translate-x-4" style={{ width: 'calc(100% - 2rem)' }}></div>
                )}
                <div className="w-10 h-10 rounded-full border-2 border-[#52B788] flex items-center justify-center text-[#52B788] text-sm font-semibold mb-5">
                  {s.step}
                </div>
                <h3 className="text-white font-semibold mb-3">{s.title}</h3>
                <p className="text-sm text-[#6B8F71] leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-28 bg-white">
        <div className="max-w-7xl mx-auto px-8">
          <div className="text-center mb-16">
            <p className="text-[#52B788] text-sm font-medium tracking-wide uppercase mb-3">Pricing</p>
            <h2 className="text-4xl font-semibold tracking-tight text-[#071A0D] mb-4">Simple, transparent pricing</h2>
            <p className="text-[#6B8F71]">Cancel anytime. No hidden fees.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              {
                name: "Starter",
                price: "$49",
                desc: "Perfect for solo jewellers",
                features: ["1 user", "All core modules", "5GB storage", "PDF generation", "Email support"],
                cta: "Get started",
                highlight: false,
              },
              {
                name: "Pro",
                price: "$99",
                desc: "For growing businesses",
                features: ["5 users", "All modules", "20GB storage", "Priority support", "Custom branding", "Full reports"],
                cta: "Get started",
                highlight: true,
              },
              {
                name: "Enterprise",
                price: "$199",
                desc: "For workshops & ateliers",
                features: ["Unlimited users", "All modules", "100GB storage", "Dedicated support", "Custom domain", "API access"],
                cta: "Contact us",
                highlight: false,
              },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl p-8 flex flex-col ${plan.highlight ? "bg-[#071A0D] text-white border-2 border-[#52B788]" : "bg-[#F5FAF6] border border-[#E8F4ED]"}`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#52B788] text-[#071A0D] text-xs font-semibold px-4 py-1 rounded-full">
                    Most Popular
                  </div>
                )}
                <div className="mb-6">
                  <h3 className={`font-semibold text-lg mb-1 ${plan.highlight ? "text-white" : "text-[#071A0D]"}`}>{plan.name}</h3>
                  <p className={`text-xs ${plan.highlight ? "text-[#52B788]" : "text-[#6B8F71]"}`}>{plan.desc}</p>
                </div>
                <div className="flex items-end gap-1 mb-7">
                  <span className={`text-5xl font-bold tracking-tight ${plan.highlight ? "text-white" : "text-[#071A0D]"}`}>{plan.price}</span>
                  <span className={`text-sm mb-1.5 ${plan.highlight ? "text-[#52B788]" : "text-[#6B8F71]"}`}>/month</span>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-3 text-sm">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${plan.highlight ? "bg-[#1A3D27]" : "bg-[#D8F3DC]"}`}>
                        <span className="text-[#52B788] text-xs font-bold">✓</span>
                      </div>
                      <span className={plan.highlight ? "text-[#D8F3DC]" : "text-[#6B8F71]"}>{f}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href="#"
                  className={`text-center text-sm font-semibold py-3.5 rounded-full transition-all duration-200 ${plan.highlight ? "bg-[#52B788] text-[#071A0D] hover:bg-[#3da372]" : "bg-[#071A0D] text-white hover:bg-[#0D2818]"}`}
                >
                  {plan.cta}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="bg-[#0D2818] py-20">
        <div className="max-w-7xl mx-auto px-8 text-center">
          <h2 className="text-3xl font-semibold text-white mb-4">Ready to modernise your jewellery business?</h2>
          <p className="text-[#6B8F71] mb-8 max-w-md mx-auto">Join jewellers who are running their business smarter with Nexpura.</p>
          <a href="#pricing" className="inline-block bg-[#52B788] text-[#071A0D] text-sm font-semibold px-8 py-4 rounded-full hover:bg-[#3da372] transition-colors duration-200">
            Start your free trial today
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#071A0D] border-t border-[#0D2818] py-14">
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 mb-10">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-5 h-5 rounded bg-[#52B788] flex items-center justify-center">
                  <div className="w-2 h-2 rounded-sm bg-[#071A0D]" />
                </div>
                <span className="text-white font-semibold">nexpura</span>
              </div>
              <p className="text-xs text-[#2D6A4F]">Cloud OS for jewellery businesses</p>
            </div>
            <div className="flex flex-wrap gap-6 text-sm text-[#2D6A4F]">
              <a href="#features" className="hover:text-white transition-colors">Features</a>
              <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
              <a href="#" className="hover:text-white transition-colors">Contact</a>
              <a href="#" className="hover:text-white transition-colors">Privacy</a>
              <a href="#" className="hover:text-white transition-colors">Terms</a>
            </div>
          </div>
          <div className="border-t border-[#0D2818] pt-8">
            <p className="text-xs text-[#1A3D27]">© 2025 Nexpura. All rights reserved.</p>
          </div>
        </div>
      </footer>

    </div>
  );
}
