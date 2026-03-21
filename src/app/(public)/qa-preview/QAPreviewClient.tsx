"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

interface TestResult {
  status: "pass" | "fail" | "pending" | "blocked";
  notes?: string | null;
  tester_name?: string | null;
  tested_at?: string | null;
}

interface ChecklistItem {
  id: string;
  title: string;
  description: string | null;
  route: string | null;
  testing_guidance: string | null;
  priority: "critical" | "high" | "medium" | "low";
  qa_test_results: TestResult[];
  categoryName?: string;
}

interface Category {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  items: ChecklistItem[];
}

interface Stats {
  total: number;
  pass: number;
  fail: number;
  pending: number;
  blocked: number;
  passRate: number;
}

interface CategoryStat {
  id: string;
  name: string;
  icon: string | null;
  total: number;
  pass: number;
  fail: number;
  pending: number;
  blocked: number;
  passRate: number;
}

interface Props {
  categories: Category[];
  stats: Stats;
  categoryStats: CategoryStat[];
  launchBlockers: ChecklistItem[];
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pass: "bg-green-100 text-green-700 border-green-200",
    fail: "bg-red-100 text-red-700 border-red-200",
    pending: "bg-stone-100 text-stone-500 border-stone-200",
    blocked: "bg-yellow-100 text-yellow-700 border-yellow-200",
  };

  const icons: Record<string, React.ReactNode> = {
    pass: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
    fail: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    pending: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    blocked: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${styles[status] || styles.pending}`}>
      {icons[status]}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const styles: Record<string, string> = {
    critical: "bg-red-600 text-white",
    high: "bg-orange-500 text-white",
    medium: "bg-blue-500 text-white",
    low: "bg-stone-400 text-white",
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase ${styles[priority] || styles.medium}`}>
      {priority}
    </span>
  );
}

function ProgressRing({ progress, size = 80, strokeWidth = 8 }: { progress: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} stroke="#e5e5e5" fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          stroke={progress >= 80 ? "#22c55e" : progress >= 50 ? "#f59e0b" : "#ef4444"}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-bold text-stone-900">{progress}%</span>
      </div>
    </div>
  );
}

export default function QAPreviewClient({ categories, stats, categoryStats, launchBlockers }: Props) {
  const [activeCategory, setActiveCategory] = useState<string | null>("11111111-1111-1111-1111-111111111101");
  const [expandedItem, setExpandedItem] = useState<string | null>("a3");

  const activeData = useMemo(() => {
    if (!activeCategory) return null;
    return categories.find(c => c.id === activeCategory);
  }, [activeCategory, categories]);

  const progress = stats.total > 0 
    ? Math.round(((stats.pass + stats.fail + stats.blocked) / stats.total) * 100) 
    : 0;

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
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/60">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
            </svg>
            Tenants
          </div>
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/60">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            Subscriptions
          </div>
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/60">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
            Revenue
          </div>
        </nav>

        <div className="px-3 py-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-amber-700/30 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-semibold text-amber-700">J</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white/40 truncate">joey@nexpura.com</p>
              <p className="text-xs text-amber-700">Super Admin</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-stone-900">QA Testing Command Center</h1>
              <p className="text-sm text-stone-500 mt-1">Internal testing checklist and progress tracking</p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Your name"
                defaultValue="Joey"
                className="px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 w-40"
              />
              <Link
                href="/qa-preview/bugs"
                className="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
              >
                Bug List ({stats.fail})
              </Link>
              <button className="px-4 py-2 text-sm font-medium text-stone-600 bg-stone-100 border border-stone-200 rounded-lg hover:bg-stone-200 transition-colors">
                Reset All
              </button>
            </div>
          </div>

          {/* Progress Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Main Progress */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-stone-200 p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-sm font-medium text-stone-500 uppercase tracking-wide">Overall Progress</h2>
                  <p className="text-3xl font-bold text-stone-900 mt-1">{progress}% Complete</p>
                </div>
                <ProgressRing progress={stats.passRate} size={100} />
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{stats.pass}</p>
                  <p className="text-xs text-green-700">Pass</p>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-lg">
                  <p className="text-2xl font-bold text-red-600">{stats.fail}</p>
                  <p className="text-xs text-red-700">Fail</p>
                </div>
                <div className="text-center p-3 bg-stone-50 rounded-lg">
                  <p className="text-2xl font-bold text-stone-500">{stats.pending}</p>
                  <p className="text-xs text-stone-600">Pending</p>
                </div>
                <div className="text-center p-3 bg-yellow-50 rounded-lg">
                  <p className="text-2xl font-bold text-yellow-600">{stats.blocked}</p>
                  <p className="text-xs text-yellow-700">Blocked</p>
                </div>
              </div>
            </div>

            {/* Pass Rate Gauge */}
            <div className="bg-white rounded-xl border border-stone-200 p-6">
              <h2 className="text-sm font-medium text-stone-500 uppercase tracking-wide mb-4">Pass Rate</h2>
              <div className="flex flex-col items-center justify-center h-32">
                <p className={`text-5xl font-bold ${stats.passRate >= 80 ? "text-green-600" : stats.passRate >= 50 ? "text-amber-600" : "text-red-600"}`}>
                  {stats.passRate}%
                </p>
                <p className="text-sm text-stone-500 mt-2">
                  {stats.pass} of {stats.pass + stats.fail} tests passing
                </p>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-stone-200 p-6">
              <h2 className="text-sm font-medium text-stone-500 uppercase tracking-wide mb-4">Test Breakdown</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-stone-600">Total Checks</span>
                  <span className="text-lg font-semibold text-stone-900">{stats.total}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-stone-600">Tested</span>
                  <span className="text-lg font-semibold text-stone-900">{stats.pass + stats.fail + stats.blocked}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-stone-600">Remaining</span>
                  <span className="text-lg font-semibold text-amber-600">{stats.pending}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-stone-600">Categories</span>
                  <span className="text-lg font-semibold text-stone-900">{categories.length}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Launch Blockers */}
          {launchBlockers.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h2 className="text-lg font-semibold text-red-800">Critical Launch Blockers ({launchBlockers.length})</h2>
              </div>
              <div className="space-y-2">
                {launchBlockers.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-red-100">
                    <div className="flex items-center gap-3">
                      <PriorityBadge priority={item.priority} />
                      <span className="font-medium text-stone-900">{item.title}</span>
                      <span className="text-sm text-stone-500">• {item.categoryName}</span>
                    </div>
                    <span className="text-xs text-stone-400 font-mono">{item.route}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Category Grid */}
          <div>
            <h2 className="text-lg font-semibold text-stone-900 mb-4">Testing Categories</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {categoryStats.map(cat => {
                const isActive = activeCategory === cat.id;
                const completed = cat.pass + cat.fail + cat.blocked;
                const catProgress = cat.total > 0 ? Math.round((completed / cat.total) * 100) : 0;
                
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(isActive ? null : cat.id)}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      isActive 
                        ? "bg-amber-50 border-amber-300 ring-2 ring-amber-500/20" 
                        : "bg-white border-stone-200 hover:border-stone-300 hover:shadow-sm"
                    }`}
                  >
                    <h3 className="font-medium text-stone-900 text-sm leading-tight mb-2">{cat.name}</h3>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${cat.passRate >= 80 ? "bg-green-500" : cat.passRate >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                          style={{ width: `${catProgress}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-stone-500">{catProgress}%</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-green-600">{cat.pass}✓</span>
                      <span className="text-red-600">{cat.fail}✗</span>
                      <span className="text-stone-400">{cat.pending}◌</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Category Checklist */}
          {activeData && (
            <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-stone-200 bg-stone-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-stone-900">{activeData.name}</h2>
                    <p className="text-sm text-stone-500">{activeData.description}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      placeholder="Search..."
                      className="px-3 py-1.5 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    />
                    <select className="px-3 py-1.5 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500">
                      <option value="all">All Status</option>
                      <option value="pass">Pass</option>
                      <option value="fail">Fail</option>
                      <option value="pending">Pending</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="divide-y divide-stone-100">
                {activeData.items.map(item => {
                  const result = item.qa_test_results[0];
                  const status = result?.status || "pending";
                  const isExpanded = expandedItem === item.id;

                  return (
                    <div key={item.id} className="px-6 py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <PriorityBadge priority={item.priority} />
                            <h3 className="font-medium text-stone-900">{item.title}</h3>
                          </div>
                          {item.description && (
                            <p className="text-sm text-stone-500 mb-2">{item.description}</p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-stone-400">
                            {item.route && (
                              <span className="font-mono bg-stone-100 px-2 py-0.5 rounded">{item.route}</span>
                            )}
                            {result?.tester_name && (
                              <span>Tested by {result.tester_name}</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <StatusBadge status={status} />
                          <button
                            onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                            className="p-1.5 text-stone-400 hover:text-stone-600 rounded"
                          >
                            <svg className={`w-5 h-5 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-stone-100">
                          {item.testing_guidance && (
                            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                              <p className="text-xs font-medium text-blue-700 uppercase mb-1">Testing Guidance</p>
                              <p className="text-sm text-blue-800">{item.testing_guidance}</p>
                            </div>
                          )}

                          {result?.notes && (
                            <div className="mb-4 p-3 bg-red-50 rounded-lg">
                              <p className="text-xs font-medium text-red-700 uppercase mb-1">Notes</p>
                              <p className="text-sm text-red-800">{result.notes}</p>
                            </div>
                          )}

                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-stone-500 uppercase">Mark as:</span>
                            {(["pass", "fail", "blocked", "pending"] as const).map(s => (
                              <button
                                key={s}
                                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                                  status === s 
                                    ? s === "pass" ? "bg-green-100 border-green-300 text-green-700"
                                    : s === "fail" ? "bg-red-100 border-red-300 text-red-700"
                                    : s === "blocked" ? "bg-yellow-100 border-yellow-300 text-yellow-700"
                                    : "bg-stone-100 border-stone-300 text-stone-700"
                                    : "bg-white border-stone-200 text-stone-600 hover:bg-stone-50"
                                }`}
                              >
                                {s.charAt(0).toUpperCase() + s.slice(1)}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
