"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

interface Bug {
  id: string;
  title: string;
  description: string | null;
  category: string;
  categoryIcon: string | null;
  priority: "critical" | "high" | "medium" | "low";
  route: string | null;
  testingGuidance: string | null;
  notes: string | null;
  screenshotUrl: string | null;
  testerName: string | null;
  testedAt: string | null;
}

interface Props {
  bugs: Bug[];
  byPriority: {
    critical: Bug[];
    high: Bug[];
    medium: Bug[];
    low: Bug[];
  };
}

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

function BugCard({ bug }: { bug: Bug }) {
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
          {bug.testedAt && (
            <span>{new Date(bug.testedAt).toLocaleDateString()}</span>
          )}
        </div>
        {bug.screenshotUrl && (
          <a
            href={bug.screenshotUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-amber-700 hover:underline"
          >
            Screenshot →
          </a>
        )}
      </div>
    </div>
  );
}

export default function BugListClient({ bugs, byPriority }: Props) {
  const [viewMode, setViewMode] = useState<"priority" | "category">("priority");
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  // Filtered bugs
  const filteredBugs = useMemo(() => {
    let result = bugs;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        bug =>
          bug.title.toLowerCase().includes(query) ||
          bug.description?.toLowerCase().includes(query) ||
          bug.notes?.toLowerCase().includes(query) ||
          bug.category.toLowerCase().includes(query)
      );
    }

    if (priorityFilter !== "all") {
      result = result.filter(bug => bug.priority === priorityFilter);
    }

    return result;
  }, [bugs, searchQuery, priorityFilter]);

  // Group by category
  const byCategory = useMemo(() => {
    const groups: Record<string, Bug[]> = {};
    filteredBugs.forEach(bug => {
      if (!groups[bug.category]) {
        groups[bug.category] = [];
      }
      groups[bug.category].push(bug);
    });
    return groups;
  }, [filteredBugs]);

  // Export as markdown
  const exportMarkdown = () => {
    const lines = [
      "# Bug Fix List",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      `Total Bugs: ${bugs.length}`,
      "",
      "---",
      "",
    ];

    const priorities = ["critical", "high", "medium", "low"];
    priorities.forEach(priority => {
      const priorityBugs = bugs.filter(b => b.priority === priority);
      if (priorityBugs.length > 0) {
        lines.push(`## ${priority.toUpperCase()} (${priorityBugs.length})`);
        lines.push("");
        priorityBugs.forEach(bug => {
          lines.push(`### ${bug.title}`);
          lines.push(`- **Category:** ${bug.category}`);
          if (bug.route) lines.push(`- **Route:** \`${bug.route}\``);
          if (bug.description) lines.push(`- **Description:** ${bug.description}`);
          if (bug.notes) lines.push(`- **Notes:** ${bug.notes}`);
          if (bug.testingGuidance) lines.push(`- **How to test:** ${bug.testingGuidance}`);
          lines.push("");
        });
      }
    });

    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nexpura-bugs-${new Date().toISOString().split("T")[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export as JSON
  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(bugs, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nexpura-bugs-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/admin/qa" className="text-stone-400 hover:text-stone-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <h1 className="text-2xl font-semibold text-stone-900">Bug Fix List</h1>
          </div>
          <p className="text-sm text-stone-500 mt-1">Failed tests converted to actionable bug fixes</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportMarkdown}
            className="px-4 py-2 text-sm font-medium text-stone-600 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
          >
            Export Markdown
          </button>
          <button
            onClick={exportJSON}
            className="px-4 py-2 text-sm font-medium text-stone-600 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
          >
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
          <p className="text-3xl font-bold text-blue-600">{byPriority.medium.length}</p>
          <p className="text-xs text-blue-700 uppercase">Medium</p>
        </div>
        <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-stone-600">{byPriority.low.length}</p>
          <p className="text-xs text-stone-500 uppercase">Low</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-stone-200 p-4">
        <div className="flex items-center gap-4">
          <input
            type="text"
            placeholder="Search bugs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-4 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 w-64"
          />
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-4 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
          >
            <option value="all">All Priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode("priority")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              viewMode === "priority" 
                ? "bg-amber-100 text-amber-700" 
                : "text-stone-500 hover:bg-stone-100"
            }`}
          >
            By Priority
          </button>
          <button
            onClick={() => setViewMode("category")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              viewMode === "category" 
                ? "bg-amber-100 text-amber-700" 
                : "text-stone-500 hover:bg-stone-100"
            }`}
          >
            By Category
          </button>
        </div>
      </div>

      {/* Bug List */}
      {bugs.length === 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-12 text-center">
          <svg className="w-16 h-16 text-green-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-lg font-semibold text-green-800">All Tests Passing!</h3>
          <p className="text-sm text-green-600 mt-1">No bugs to fix. Great job!</p>
        </div>
      ) : viewMode === "priority" ? (
        <div className="space-y-8">
          {(["critical", "high", "medium", "low"] as const).map(priority => {
            const priorityBugs = filteredBugs.filter(b => b.priority === priority);
            if (priorityBugs.length === 0) return null;

            return (
              <div key={priority}>
                <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-4 flex items-center gap-2">
                  <PriorityBadge priority={priority} />
                  <span>{priorityBugs.length} issues</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {priorityBugs.map(bug => (
                    <BugCard key={bug.id} bug={bug} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(byCategory).map(([category, categoryBugs]) => (
            <div key={category}>
              <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-4">
                {category} ({categoryBugs.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {categoryBugs.map(bug => (
                  <BugCard key={bug.id} bug={bug} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
