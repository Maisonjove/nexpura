"use client";

import { useState } from "react";
import { Send, Users, Mail, MessageSquare, Calendar, ChevronRight } from "lucide-react";

export default function CampaignsPage() {
  const [step, setStep] = useState(1);

  const segments = [
    { id: "all", name: "All Customers", count: 1240 },
    { id: "vip", name: "VIP Only", count: 156 },
    { id: "birthday", name: "Birthday this Month", count: 42 },
    { id: "inactive", name: "Inactive (> 6 months)", count: 210 },
  ];

  const templates = [
    { id: "welcome", name: "New Collection Launch", type: "email" },
    { id: "sale", name: "Seasonal Sale Alert", type: "sms" },
    { id: "reminder", name: "Service Reminder", type: "email" },
    { id: "custom", name: "Blank Canvas", type: "email" },
  ];

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Campaigns</h1>
          <p className="text-sm text-stone-500 mt-0.5">Send bulk email or SMS messages to your customer segments</p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-4">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
              step >= s ? "bg-[#8B7355] text-white" : "bg-stone-200 text-stone-500"
            }`}>
              {s}
            </div>
            <span className={`text-sm font-medium ${step >= s ? "text-stone-900" : "text-stone-400"}`}>
              {s === 1 ? "Segment" : s === 2 ? "Template" : "Schedule"}
            </span>
            {s < 3 && <ChevronRight size={16} className="text-stone-300" />}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="p-8">
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-stone-900">Select Audience</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {segments.map(seg => (
                  <button 
                    key={seg.id}
                    onClick={() => setStep(2)}
                    className="p-5 border border-stone-200 rounded-xl text-left hover:border-[#8B7355] hover:bg-stone-50 transition-all group"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="p-2 rounded-lg bg-stone-100 group-hover:bg-[#8B7355]/10 text-stone-600 group-hover:text-[#8B7355]">
                        <Users size={20} />
                      </div>
                      <span className="text-xs font-bold text-stone-400">{seg.count} customers</span>
                    </div>
                    <h3 className="font-semibold text-stone-900">{seg.name}</h3>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-stone-900">Choose Template</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map(tmp => (
                  <button 
                    key={tmp.id}
                    onClick={() => setStep(3)}
                    className="p-5 border border-stone-200 rounded-xl text-left hover:border-[#8B7355] hover:bg-stone-50 transition-all group"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="p-2 rounded-lg bg-stone-100 group-hover:bg-[#8B7355]/10 text-stone-600 group-hover:text-[#8B7355]">
                        {tmp.type === "email" ? <Mail size={20} /> : <MessageSquare size={20} />}
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">{tmp.type}</span>
                    </div>
                    <h3 className="font-semibold text-stone-900">{tmp.name}</h3>
                  </button>
                ))}
              </div>
              <button onClick={() => setStep(1)} className="text-sm text-stone-500 hover:text-stone-900">← Change Segment</button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-8">
              <h2 className="text-lg font-semibold text-stone-900">Preview & Schedule</h2>
              <div className="aspect-[4/3] w-full bg-stone-50 rounded-xl border border-dashed border-stone-300 flex flex-col items-center justify-center p-12 text-center">
                <Mail size={48} className="text-stone-300 mb-4" />
                <p className="text-stone-500 italic">Campaign preview would render here...</p>
              </div>

              <div className="flex items-center justify-between p-4 bg-amber-50 rounded-xl border border-amber-100">
                <div className="flex items-center gap-3">
                  <Calendar size={20} className="text-amber-600" />
                  <div>
                    <p className="text-sm font-semibold text-amber-900">Ready to send</p>
                    <p className="text-xs text-amber-700">Estimated cost: $12.40 (1,240 recipients)</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 rounded-lg">Send Test</button>
                  <button className="px-6 py-2 bg-[#8B7355] text-white text-sm font-medium rounded-lg hover:bg-[#7A6347] flex items-center gap-2">
                    <Send size={16} />
                    Schedule Campaign
                  </button>
                </div>
              </div>
              <button onClick={() => setStep(2)} className="text-sm text-stone-500 hover:text-stone-900">← Back to Templates</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
