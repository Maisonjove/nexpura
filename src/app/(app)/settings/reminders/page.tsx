"use client";

import { useState } from "react";
import { Bell, Mail, Clock, ShieldCheck, Gift, Heart } from "lucide-react";

export default function RemindersPage() {
  const [reminders, setReminders] = useState([
    { id: 1, name: "Birthday Greetings", type: "Annual", trigger: "On Birthday", status: "Active", icon: Gift },
    { id: 2, name: "Anniversary Wishes", type: "Annual", trigger: "On Anniversary", status: "Active", icon: Heart },
    { id: 3, name: "Jewellery Service Due", type: "Recurring", trigger: "12m After Purchase", status: "Inactive", icon: ShieldCheck },
    { id: 4, name: "Layby Payment Due", type: "Event", trigger: "3 days before due", status: "Active", icon: Clock },
  ]);

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Service Reminders</h1>
          <p className="text-sm text-stone-500 mt-0.5">Automated notifications sent to customers based on events or dates</p>
        </div>
        <button className="px-4 py-2 bg-[#8B7355] text-white text-sm font-medium rounded-lg hover:bg-[#7A6347]">
          + Create Reminder
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {reminders.map(rem => (
          <div key={rem.id} className="bg-white rounded-xl border border-stone-200 p-6 flex items-center gap-6 shadow-sm hover:border-[#8B7355]/30 transition-colors">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              rem.status === "Active" ? "bg-[#8B7355]/10 text-[#8B7355]" : "bg-stone-100 text-stone-400"
            }`}>
              <rem.icon size={24} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-stone-900">{rem.name}</h3>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  rem.status === "Active" ? "bg-green-100 text-green-700" : "bg-stone-100 text-stone-400"
                }`}>
                  {rem.status}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-stone-500">
                <span className="flex items-center gap-1"><Bell size={12} /> {rem.type}</span>
                <span className="flex items-center gap-1"><Clock size={12} /> {rem.trigger}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="px-3 py-1.5 text-xs font-medium border border-stone-200 rounded-lg hover:bg-stone-50">Template</button>
              <button className="px-3 py-1.5 text-xs font-medium border border-stone-200 rounded-lg hover:bg-stone-50">Edit</button>
            </div>
          </div>
        ))}
      </div>

      {/* Template Editor Preview (Visual) */}
      <div className="bg-white rounded-2xl border border-stone-200 p-8 space-y-6">
        <h2 className="text-lg font-semibold text-stone-900 flex items-center gap-2">
          <Mail size={20} className="text-[#8B7355]" />
          Template: Birthday Email
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-stone-500 uppercase mb-1">Subject Line</label>
            <input 
              readOnly 
              value="Happy Birthday from Nexpura Jewellery! 🎂" 
              className="w-full px-3 py-2 border border-stone-200 rounded-lg bg-stone-50 outline-none"
            />
          </div>
          <div className="aspect-video w-full bg-stone-50 rounded-xl border border-stone-200 p-6 overflow-auto">
            <div className="max-w-md mx-auto bg-white border border-stone-100 shadow-sm p-8 text-center space-y-4">
              <div className="text-2xl font-serif text-[#8B7355]">Happy Birthday, {"{first_name}"}!</div>
              <p className="text-sm text-stone-600">
                We hope your special day is as radiant as you are. To celebrate, we've added a special gift to your account...
              </p>
              <div className="py-4 px-8 border-2 border-dashed border-[#8B7355]/30 text-[#8B7355] font-bold tracking-widest">
                BDAY2024
              </div>
              <p className="text-[10px] text-stone-400">Valid for 30 days. One use per customer.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
