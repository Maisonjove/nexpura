"use client";

import Link from "next/link";

const bugs = [
  { id: 'a3', title: 'Password reset flow works', description: 'Forgot password and reset flow', category: 'Authentication & Onboarding', priority: 'critical', route: '/forgot-password', testingGuidance: 'Request password reset. Check email received. Reset password successfully.', notes: 'Email not sending in production', testerName: 'Teo' },
  { id: 'r3', title: 'Repair list filters work', description: 'Filter repairs by status, date, customer', category: 'Repairs & Workshop', priority: 'high', route: '/repairs', testingGuidance: 'Apply various filters. Verify results match.', notes: 'Date filter not working correctly', testerName: 'Joey' },
  { id: 'p5', title: 'Apply discounts', description: 'Percentage and fixed discounts', category: 'Point of Sale', priority: 'high', route: '/pos', testingGuidance: 'Apply discounts. Verify calculations.', notes: 'Percentage discount calculation off by 1 cent', testerName: 'Joey' },
  { id: 'bill2', title: 'Trial expiration handling', description: 'Trial end prompts upgrade', category: 'Billing & Subscriptions', priority: 'critical', route: '/dashboard', testingGuidance: 'Trial expires. Prompted to subscribe.', notes: 'Banner not showing for expired trials', testerName: 'Teo' },
];

const byPriority = {
  critical: bugs.filter(b => b.priority === 'critical'),
  high: bugs.filter(b => b.priority === 'high'),
  medium: [],
  low: [],
};

function PriorityBadge({ priority }: { priority: string }) {
  const styles: Record<string, string> = {
    critical: "bg-red-600 text-white",
    high: "bg-orange-500 text-white",
    medium: "bg-blue-500 text-white",
    low: "bg-stone-400 text-white",
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-bold uppercase ${styles[priority] || styles.medium}`}>
      {priority}
    </span>
  );
}

function BugCard({ bug }: { bug: typeof bugs[0] }) {
  return (
    <div className="bg-white rounded-lg border border-stone-200 p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <PriorityBadge priority={bug.priority} />
            <span className="text-xs text-stone-400 font-medium">{bug.category}</span>
          </div>
          <h3 className="font-semibold text-stone-900">{bug.title}</h3>
        </div>
      </div>

      {bug.description && (
        <p className="text-sm text-stone-600 mb-3">{bug.description}</p>
      )}

      {bug.notes && (
        <div className="p-3 bg-red-50 rounded-lg mb-3">
          <p className="text-xs font-medium text-red-700 uppercase mb-1">Failure Notes</p>
          <p className="text-sm text-red-800">{bug.notes}</p>
        </div>
      )}

      {bug.testingGuidance && (
        <div className="p-3 bg-blue-50 rounded-lg mb-3">
          <p className="text-xs font-medium text-blue-700 uppercase mb-1">How to Test</p>
          <p className="text-sm text-blue-800">{bug.testingGuidance}</p>
        </div>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-stone-100">
        <div className="flex items-center gap-3 text-xs text-stone-400">
          {bug.route && (
            <span className="font-mono bg-stone-100 px-2 py-0.5 rounded">{bug.route}</span>
          )}
          {bug.testerName && <span>Reported by {bug.testerName}</span>}
        </div>
      </div>
    </div>
  );
}

export default function BugsPreviewPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-stone-50">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 flex-col h-full bg-stone-900 text-white">
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-amber-700/30 flex items-center justify-center">
              <svg className="w-4 h-4 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <span className="text-base font-semibold tracking-tight">
              nexpura <span className="text-amber-700">admin</span>
            </span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/60">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Dashboard
          </div>
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm bg-white/15 text-white font-medium">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            QA Checklist
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <Link href="/qa-preview" className="text-stone-400 hover:text-stone-600">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                </Link>
                <h1 className="text-2xl font-semibold text-stone-900">Bug Fix List</h1>
              </div>
              <p className="text-sm text-stone-500 mt-1">Failed tests converted to actionable bug fixes</p>
            </div>
            <div className="flex items-center gap-3">
              <button className="px-4 py-2 text-sm font-medium text-stone-600 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors">
                Export Markdown
              </button>
              <button className="px-4 py-2 text-sm font-medium text-stone-600 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors">
                Export JSON
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-5 gap-4">
            <div className="bg-white rounded-xl border border-stone-200 p-4 text-center">
              <p className="text-3xl font-bold text-stone-900">{bugs.length}</p>
              <p className="text-xs text-stone-500 uppercase">Total Bugs</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-red-600">{byPriority.critical.length}</p>
              <p className="text-xs text-red-700 uppercase">Critical</p>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-orange-600">{byPriority.high.length}</p>
              <p className="text-xs text-orange-700 uppercase">High</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-blue-600">0</p>
              <p className="text-xs text-blue-700 uppercase">Medium</p>
            </div>
            <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-stone-600">0</p>
              <p className="text-xs text-stone-500 uppercase">Low</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center justify-between bg-white rounded-xl border border-stone-200 p-4">
            <div className="flex items-center gap-4">
              <input
                type="text"
                placeholder="Search bugs..."
                className="px-4 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 w-64"
              />
              <select className="px-4 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500">
                <option value="all">All Priorities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button className="px-4 py-2 text-sm font-medium rounded-lg bg-amber-100 text-amber-700">
                By Priority
              </button>
              <button className="px-4 py-2 text-sm font-medium rounded-lg text-stone-500 hover:bg-stone-100">
                By Category
              </button>
            </div>
          </div>

          {/* Bug List */}
          <div className="space-y-8">
            <div>
              <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-4 flex items-center gap-2">
                <PriorityBadge priority="critical" />
                <span>{byPriority.critical.length} issues</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {byPriority.critical.map(bug => (
                  <BugCard key={bug.id} bug={bug} />
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-4 flex items-center gap-2">
                <PriorityBadge priority="high" />
                <span>{byPriority.high.length} issues</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {byPriority.high.map(bug => (
                  <BugCard key={bug.id} bug={bug} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
