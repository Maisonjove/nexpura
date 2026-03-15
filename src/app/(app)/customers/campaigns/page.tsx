"use client";

import { Send, Users, Clock } from "lucide-react";

export default function CampaignsPage() {
  return (
    <div className="max-w-4xl mx-auto py-10 px-4 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Campaigns</h1>
          <p className="text-sm text-stone-500 mt-0.5">Send bulk email or SMS messages to your customer segments</p>
        </div>
      </div>

      {/* Coming Soon Notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-start gap-4">
        <div className="p-2 rounded-lg bg-amber-100 text-amber-600 mt-0.5">
          <Clock size={20} />
        </div>
        <div>
          <h3 className="font-semibold text-amber-900 mb-1">Campaigns — Coming Soon</h3>
          <p className="text-sm text-amber-700 leading-relaxed">
            Campaign sending is not yet available. This feature is currently in development.
            Customer counts, segments, and send functionality shown below are examples only and do not reflect real data.
          </p>
        </div>
      </div>

      {/* Preview (disabled) */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden opacity-50 pointer-events-none select-none">
        <div className="p-8 space-y-6">
          <h2 className="text-lg font-semibold text-stone-900">Select Audience</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { name: "All Customers", desc: "Example segment" },
              { name: "VIP Only", desc: "Example segment" },
              { name: "Birthday this Month", desc: "Example segment" },
              { name: "Inactive (> 6 months)", desc: "Example segment" },
            ].map((seg) => (
              <div
                key={seg.name}
                className="p-5 border border-stone-200 rounded-xl text-left"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="p-2 rounded-lg bg-stone-100 text-stone-600">
                    <Users size={20} />
                  </div>
                  <span className="text-xs font-bold text-stone-400">example</span>
                </div>
                <h3 className="font-semibold text-stone-900">{seg.name}</h3>
              </div>
            ))}
          </div>
        </div>
        <div className="px-8 pb-8">
          <div className="flex items-center justify-between p-4 bg-stone-50 rounded-xl border border-stone-100">
            <div className="flex items-center gap-3">
              <Send size={20} className="text-stone-400" />
              <div>
                <p className="text-sm font-semibold text-stone-500">Schedule Campaign</p>
                <p className="text-xs text-stone-400">Not yet available</p>
              </div>
            </div>
            <button
              disabled
              className="px-6 py-2 bg-stone-200 text-stone-400 text-sm font-medium rounded-lg cursor-not-allowed flex items-center gap-2"
            >
              <Send size={16} />
              Coming Soon
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
