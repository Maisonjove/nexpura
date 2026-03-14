"use client";

import { useState } from "react";
import { Zap, Bell, Mail, MessageSquare, Plus, Trash2, Edit2, Play, Pause } from "lucide-react";

export default function AutomationPage() {
  const [rules, setRules] = useState([
    {
      id: "1",
      name: "Welcome Email",
      trigger: "New Customer Created",
      action: "Send Email (Template: Welcome)",
      isActive: true,
    },
    {
      id: "2",
      name: "Birthday SMS",
      trigger: "Birthday is in 7 days",
      action: "Send SMS (Template: Bday Promo)",
      isActive: true,
    },
    {
      id: "3",
      name: "Post-Purchase Follow-up",
      trigger: "Sale Completed",
      action: "Create Task: Follow-up Call",
      isActive: false,
    }
  ]);

  return (
    <div className="max-w-5xl mx-auto py-10 px-4 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900 font-serif">Marketing Automation</h1>
          <p className="text-sm text-stone-500 mt-0.5">Automate your customer communications and workflows</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-[#8B7355] text-white rounded-xl font-bold hover:bg-[#7A6347] transition-colors shadow-sm">
          <Plus size={18} />
          New Automation
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {rules.map((rule) => (
          <div key={rule.id} className="bg-white rounded-2xl border border-stone-200 p-6 flex items-center justify-between hover:shadow-md transition-all">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${rule.isActive ? "bg-emerald-50 text-emerald-600" : "bg-stone-100 text-stone-400"}`}>
                <Zap size={24} />
              </div>
              <div>
                <h3 className="font-bold text-stone-900">{rule.name}</h3>
                <div className="flex items-center gap-3 mt-1 text-sm text-stone-500 font-medium">
                  <span className="flex items-center gap-1"><Bell size={14} className="text-stone-300" /> Trigger: {rule.trigger}</span>
                  <span className="w-1 h-1 bg-stone-200 rounded-full" />
                  <span className="flex items-center gap-1"><Play size={14} className="text-stone-300" /> Action: {rule.action}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 text-stone-400 hover:text-[#8B7355] hover:bg-[#8B7355]/5 rounded-lg transition-colors">
                <Edit2 size={18} />
              </button>
              <button className={`p-2 rounded-lg transition-colors ${rule.isActive ? "text-amber-600 hover:bg-amber-50" : "text-emerald-600 hover:bg-emerald-50"}`}>
                {rule.isActive ? <Pause size={18} /> : <Play size={18} />}
              </button>
              <button className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-[#8B7355]/5 rounded-3xl p-8 border border-[#8B7355]/10 flex flex-col md:flex-row items-center gap-8">
        <div className="flex-1 space-y-4">
          <h2 className="text-xl font-bold text-stone-900">Reach customers where they are.</h2>
          <p className="text-stone-600 leading-relaxed">Nexpura Automation works with Email, SMS, and WhatsApp to ensure your clients feel valued without you lifting a finger.</p>
          <div className="flex gap-4">
            <div className="flex items-center gap-2 text-sm font-bold text-[#8B7355]"><Mail size={16} /> Email</div>
            <div className="flex items-center gap-2 text-sm font-bold text-[#8B7355]"><MessageSquare size={16} /> SMS</div>
            <div className="flex items-center gap-2 text-sm font-bold text-[#8B7355]">📱 WhatsApp</div>
          </div>
        </div>
        <div className="w-full md:w-64 aspect-video bg-white rounded-2xl border border-stone-200 shadow-xl p-4 flex flex-col gap-3">
          <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
            <div className="w-2/3 h-full bg-[#8B7355]" />
          </div>
          <div className="w-full h-2 bg-stone-100 rounded-full" />
          <div className="w-1/2 h-2 bg-stone-100 rounded-full" />
          <div className="mt-auto flex justify-between items-center">
            <div className="w-8 h-8 rounded-full bg-stone-100" />
            <div className="px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full">ACTIVE</div>
          </div>
        </div>
      </div>
    </div>
  );
}
