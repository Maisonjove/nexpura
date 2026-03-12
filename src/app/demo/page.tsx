export default function Demo() {
  const navItems = [
    { label: "Dashboard", active: true },
    { label: "Customers", active: false },
    { label: "Bespoke Jobs", active: false },
    { label: "Repairs", active: false },
    { label: "Stock", active: false },
    { label: "Invoices", active: false },
    { label: "Quotes", active: false },
    { label: "Reports", active: false },
    { label: "Settings", active: false },
  ];

  const recentJobs = [
    { job: "BJ-0042", customer: "Emma Clarke", type: "Engagement Ring", status: "In Progress", dot: "bg-blue-400" },
    { job: "BJ-0041", customer: "Michael Chen", type: "Wedding Band", status: "CAD Review", dot: "bg-yellow-400" },
    { job: "BJ-0040", customer: "Sarah Williams", type: "Pendant", status: "Completed", dot: "bg-[#52B788]" },
    { job: "BJ-0039", customer: "James Turner", type: "Bangle", status: "Stone Sourcing", dot: "bg-purple-400" },
    { job: "BJ-0038", customer: "Olivia Russo", type: "Necklace", status: "Casting", dot: "bg-orange-400" },
  ];

  const recentInvoices = [
    { inv: "INV-0091", customer: "Emma Clarke", amount: "$4,800", status: "Unpaid", color: "text-yellow-500" },
    { inv: "INV-0090", customer: "Sarah Williams", amount: "$1,250", status: "Paid", color: "text-[#52B788]" },
    { inv: "INV-0089", customer: "David Kim", amount: "$850", status: "Overdue", color: "text-red-400" },
    { inv: "INV-0088", customer: "James Turner", amount: "$3,100", status: "Paid", color: "text-[#52B788]" },
    { inv: "INV-0087", customer: "Lily Chen", amount: "$620", status: "Draft", color: "text-[#6B8F71]" },
  ];

  const quickActions = [
    { label: "New Bespoke Job", icon: "◈" },
    { label: "New Repair", icon: "◎" },
    { label: "New Invoice", icon: "▤" },
    { label: "New Quote", icon: "▥" },
    { label: "Add Stock", icon: "▦" },
    { label: "Print Tags", icon: "⊞" },
  ];

  return (
    <div className="flex h-screen bg-[#F5FAF6] overflow-hidden" style={{ fontFamily: 'Inter, sans-serif' }}>

      {/* Sidebar */}
      <div className="w-56 bg-[#071A0D] flex flex-col flex-shrink-0">
        {/* Logo */}
        <div className="px-5 h-14 flex items-center border-b border-[#0D2818]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#52B788] flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-sm bg-[#071A0D]" />
            </div>
            <span className="text-white text-base font-semibold tracking-tight">nexpura</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.label}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 text-left ${
                item.active
                  ? "bg-[#1A3D27] text-[#52B788] font-medium"
                  : "text-[#2D6A4F] hover:bg-[#0D2818] hover:text-[#6B8F71]"
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${item.active ? "bg-[#52B788]" : "bg-[#1A3D27]"}`}></div>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Tenant */}
        <div className="px-4 py-4 border-t border-[#0D2818]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#1A3D27] border border-[#2D6A4F] flex items-center justify-center text-[#52B788] text-xs font-bold flex-shrink-0">
              GS
            </div>
            <div className="min-w-0">
              <p className="text-white text-xs font-medium truncate">Gold & Stone Co.</p>
              <p className="text-[#2D6A4F] text-xs">Owner</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar */}
        <div className="h-14 bg-white border-b border-[#E8F4ED] flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center">
            <div className="flex items-center gap-2 bg-[#F5FAF6] border border-[#E8F4ED] rounded-xl px-4 py-2 w-72">
              <svg className="w-4 h-4 text-[#6B8F71]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="text-sm text-[#6B8F71]">Search anything...</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="w-9 h-9 flex items-center justify-center text-[#6B8F71] hover:text-[#071A0D] hover:bg-[#F5FAF6] rounded-xl transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </button>
            <button className="flex items-center gap-2 bg-[#071A0D] text-white text-sm font-medium px-4 py-2 rounded-full hover:bg-[#0D2818] transition-colors">
              <span className="text-[#52B788] font-bold text-base leading-none">+</span> New
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-7">

          {/* Page header */}
          <div className="flex items-center justify-between mb-7">
            <div>
              <h1 className="text-xl font-semibold text-[#071A0D]">Dashboard</h1>
              <p className="text-sm text-[#6B8F71] mt-0.5">Thursday, 12 March 2026</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#6B8F71] bg-white border border-[#E8F4ED] rounded-xl px-4 py-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#52B788]"></div>
              Gold & Stone Co. — Demo Mode
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[
              { label: "Today's Sales", value: "$3,240", sub: "+12% from yesterday", up: true },
              { label: "Jobs In Progress", value: "12", sub: "3 due this week", up: null },
              { label: "Repairs Pending", value: "7", sub: "2 overdue", up: false },
              { label: "Low Stock Alerts", value: "3", sub: "Action required", up: false },
            ].map((stat) => (
              <div key={stat.label} className="bg-white rounded-2xl border border-[#E8F4ED] p-5 hover:border-[#52B788]/40 transition-colors">
                <p className="text-xs text-[#6B8F71] mb-2">{stat.label}</p>
                <p className="text-3xl font-semibold text-[#071A0D] mb-2">{stat.value}</p>
                <p className={`text-xs font-medium ${stat.up === true ? "text-[#52B788]" : stat.up === false ? "text-red-400" : "text-[#6B8F71]"}`}>
                  {stat.sub}
                </p>
              </div>
            ))}
          </div>

          {/* Two col */}
          <div className="grid grid-cols-2 gap-4 mb-6">

            {/* Jobs */}
            <div className="bg-white rounded-2xl border border-[#E8F4ED] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#F0F7F2] flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[#071A0D]">Recent Bespoke Jobs</h2>
                <button className="text-xs text-[#52B788] hover:text-[#3da372] font-medium transition-colors">View all →</button>
              </div>
              <div className="divide-y divide-[#F5FAF6]">
                {recentJobs.map((job) => (
                  <div key={job.job} className="px-5 py-3.5 flex items-center justify-between hover:bg-[#F5FAF6] transition-colors cursor-pointer">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-[#6B8F71] w-14">{job.job}</span>
                      <div>
                        <p className="text-sm font-medium text-[#071A0D] leading-none">{job.customer}</p>
                        <p className="text-xs text-[#6B8F71] mt-0.5">{job.type}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${job.dot}`}></div>
                      <span className="text-xs text-[#6B8F71]">{job.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Invoices */}
            <div className="bg-white rounded-2xl border border-[#E8F4ED] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#F0F7F2] flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[#071A0D]">Recent Invoices</h2>
                <button className="text-xs text-[#52B788] hover:text-[#3da372] font-medium transition-colors">View all →</button>
              </div>
              <div className="divide-y divide-[#F5FAF6]">
                {recentInvoices.map((inv) => (
                  <div key={inv.inv} className="px-5 py-3.5 flex items-center justify-between hover:bg-[#F5FAF6] transition-colors cursor-pointer">
                    <div>
                      <p className="text-sm font-medium text-[#071A0D] leading-none">{inv.customer}</p>
                      <p className="text-xs font-mono text-[#6B8F71] mt-0.5">{inv.inv}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-[#071A0D]">{inv.amount}</p>
                      <p className={`text-xs font-medium mt-0.5 ${inv.color}`}>{inv.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Quick actions */}
          <div className="bg-white rounded-2xl border border-[#E8F4ED] p-5">
            <h2 className="text-sm font-semibold text-[#071A0D] mb-4">Quick Actions</h2>
            <div className="grid grid-cols-6 gap-3">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  className="flex flex-col items-center gap-2.5 p-4 rounded-xl border border-[#E8F4ED] bg-[#F5FAF6] hover:border-[#52B788] hover:bg-white transition-all duration-150 group"
                >
                  <div className="w-9 h-9 rounded-xl bg-[#D8F3DC] flex items-center justify-center text-[#0D2818] text-lg group-hover:bg-[#071A0D] group-hover:text-[#52B788] transition-all duration-150">
                    {action.icon}
                  </div>
                  <span className="text-xs text-[#6B8F71] group-hover:text-[#071A0D] transition-colors leading-tight text-center">{action.label}</span>
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
