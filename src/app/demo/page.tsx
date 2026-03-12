export default function Demo() {
  const navItems = [
    { icon: "⊞", label: "Dashboard", active: true },
    { icon: "👥", label: "Customers", active: false },
    { icon: "💎", label: "Bespoke Jobs", active: false },
    { icon: "🔧", label: "Repairs", active: false },
    { icon: "📦", label: "Stock", active: false },
    { icon: "🧾", label: "Invoices", active: false },
    { icon: "📋", label: "Quotes", active: false },
    { icon: "📊", label: "Reports", active: false },
    { icon: "⚙️", label: "Settings", active: false },
  ];

  const recentJobs = [
    { job: "BJ-0042", customer: "Emma Clarke", type: "Engagement Ring", status: "In Progress", statusColor: "bg-blue-500" },
    { job: "BJ-0041", customer: "Michael Chen", type: "Wedding Band", status: "CAD Review", statusColor: "bg-yellow-500" },
    { job: "BJ-0040", customer: "Sarah Williams", type: "Pendant", status: "Completed", statusColor: "bg-green-500" },
    { job: "BJ-0039", customer: "James Turner", type: "Bangle", status: "Stone Sourcing", statusColor: "bg-purple-500" },
    { job: "BJ-0038", customer: "Olivia Russo", type: "Necklace", status: "Casting", statusColor: "bg-orange-500" },
  ];

  const recentInvoices = [
    { inv: "INV-0091", customer: "Emma Clarke", amount: "$4,800", status: "Unpaid", statusColor: "text-yellow-500" },
    { inv: "INV-0090", customer: "Sarah Williams", amount: "$1,250", status: "Paid", statusColor: "text-green-500" },
    { inv: "INV-0089", customer: "David Kim", amount: "$850", status: "Overdue", statusColor: "text-red-500" },
    { inv: "INV-0088", customer: "James Turner", amount: "$3,100", status: "Paid", statusColor: "text-green-500" },
    { inv: "INV-0087", customer: "Lily Chen", amount: "$620", status: "Draft", statusColor: "text-zinc-400" },
  ];

  const quickActions = [
    { label: "New Bespoke Job", icon: "💎" },
    { label: "New Repair", icon: "🔧" },
    { label: "New Invoice", icon: "🧾" },
    { label: "New Quote", icon: "📋" },
    { label: "Add Stock", icon: "📦" },
    { label: "Print Tags", icon: "🏷️" },
  ];

  return (
    <div className="flex h-screen bg-[#FAFAF9] overflow-hidden">

      {/* Sidebar */}
      <div className="w-60 bg-[#18181B] flex flex-col flex-shrink-0">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-zinc-800">
          <span className="text-[#C9A96E] text-lg font-semibold tracking-tight">nexpura</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.label}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left ${
                item.active
                  ? "bg-[#C9A96E]/15 text-[#C9A96E] font-medium"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              }`}
            >
              <span className="text-base leading-none">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Tenant */}
        <div className="px-4 py-4 border-t border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#C9A96E]/20 flex items-center justify-center text-[#C9A96E] text-xs font-semibold">
              GS
            </div>
            <div>
              <p className="text-zinc-200 text-xs font-medium">Gold & Stone Co.</p>
              <p className="text-zinc-500 text-xs">Owner</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar */}
        <div className="h-14 bg-white border-b border-zinc-200 flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-zinc-100 rounded-lg px-4 py-2 text-sm text-zinc-400 w-64 flex items-center gap-2">
              <span className="text-zinc-400">🔍</span>
              <span>Search...</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-zinc-600 rounded-lg hover:bg-zinc-100 transition-colors">
              🔔
            </button>
            <button className="bg-[#18181B] text-white text-sm font-medium px-4 py-1.5 rounded-full hover:bg-zinc-800 transition-colors flex items-center gap-1">
              <span>+</span> New
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* Page header */}
          <div className="mb-6">
            <h1 className="text-xl font-semibold text-[#09090B]">Dashboard</h1>
            <p className="text-sm text-[#71717A] mt-0.5">Thursday, 12 March 2026</p>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[
              { label: "Today's Sales", value: "$3,240", sub: "+12% from yesterday", trend: "up" },
              { label: "Jobs In Progress", value: "12", sub: "3 due this week", trend: "neutral" },
              { label: "Repairs Pending", value: "7", sub: "2 overdue", trend: "down" },
              { label: "Low Stock Alerts", value: "3", sub: "Action required", trend: "down" },
            ].map((stat) => (
              <div key={stat.label} className="bg-white rounded-xl border border-zinc-200 p-4">
                <p className="text-xs text-[#71717A] mb-1">{stat.label}</p>
                <p className="text-2xl font-semibold text-[#09090B] mb-1">{stat.value}</p>
                <p className={`text-xs ${stat.trend === "up" ? "text-green-500" : stat.trend === "down" ? "text-red-400" : "text-[#71717A]"}`}>
                  {stat.sub}
                </p>
              </div>
            ))}
          </div>

          {/* Two columns */}
          <div className="grid grid-cols-2 gap-4 mb-6">

            {/* Recent Jobs */}
            <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[#09090B]">Recent Bespoke Jobs</h2>
                <button className="text-xs text-[#C9A96E] hover:text-[#b8955a]">View all →</button>
              </div>
              <div className="divide-y divide-zinc-50">
                {recentJobs.map((job) => (
                  <div key={job.job} className="px-5 py-3.5 flex items-center justify-between hover:bg-zinc-50/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-[#71717A]">{job.job}</span>
                      <div>
                        <p className="text-sm font-medium text-[#09090B] leading-none">{job.customer}</p>
                        <p className="text-xs text-[#71717A] mt-0.5">{job.type}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${job.statusColor}`}></span>
                      <span className="text-xs text-[#71717A]">{job.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Invoices */}
            <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[#09090B]">Recent Invoices</h2>
                <button className="text-xs text-[#C9A96E] hover:text-[#b8955a]">View all →</button>
              </div>
              <div className="divide-y divide-zinc-50">
                {recentInvoices.map((inv) => (
                  <div key={inv.inv} className="px-5 py-3.5 flex items-center justify-between hover:bg-zinc-50/50 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-[#09090B] leading-none">{inv.customer}</p>
                      <p className="text-xs font-mono text-[#71717A] mt-0.5">{inv.inv}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-[#09090B]">{inv.amount}</p>
                      <p className={`text-xs font-medium ${inv.statusColor}`}>{inv.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl border border-zinc-200 p-5">
            <h2 className="text-sm font-semibold text-[#09090B] mb-4">Quick Actions</h2>
            <div className="grid grid-cols-6 gap-3">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border border-zinc-200 hover:border-[#C9A96E]/40 hover:bg-[#C9A96E]/5 transition-all text-center group"
                >
                  <span className="text-2xl">{action.icon}</span>
                  <span className="text-xs text-[#71717A] group-hover:text-[#09090B] transition-colors leading-tight">{action.label}</span>
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
