"use client";

import { useState } from "react";
import { Search, Wrench, Clock, CheckCircle2, ChevronRight, AlertCircle } from "lucide-react";

export default function RepairTrackingPage() {
  const [ticketNumber, setTicketNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [repair, setRepair] = useState<any>(null);
  const [error, setError] = useState("");

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!ticketNumber.trim()) return;
    
    setLoading(true);
    setError("");
    setRepair(null);

    // Simulated API call - in reality would fetch from DB
    setTimeout(() => {
      if (ticketNumber.toUpperCase() === "REP-1001") {
        setRepair({
          number: "REP-1001",
          item: "Diamond Engagement Ring",
          status: "in_progress",
          estimated_ready: "2026-03-20",
          updates: [
            { date: "2026-03-14", status: "Job started - resizing in progress", completed: true },
            { date: "2026-03-12", status: "Item received & inspection complete", completed: true },
            { date: "2026-03-20", status: "Quality control & cleaning", completed: false },
          ]
        });
      } else {
        setError("Repair ticket not found. Please check the number and try again.");
      }
      setLoading(false);
    }, 800);
  }

  return (
    <div className="max-w-2xl mx-auto py-24 px-4">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-stone-900 mb-2">Track Your Repair</h1>
        <p className="text-stone-500">Enter your repair ticket number to see the current status of your piece.</p>
      </div>

      <div className="bg-white rounded-3xl border border-stone-200 shadow-xl overflow-hidden p-8">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
             <input 
               value={ticketNumber}
               onChange={e => setTicketNumber(e.target.value.toUpperCase())}
               placeholder="REP-XXXX"
               className="w-full pl-12 pr-4 py-4 bg-stone-50 border border-stone-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#8B7355] font-mono text-lg" 
             />
          </div>
          <button 
            disabled={loading}
            className="px-8 py-4 bg-[#8B7355] text-white rounded-2xl font-bold hover:bg-[#7A6347] transition-all disabled:opacity-50"
          >
            {loading ? "Searching..." : "Track"}
          </button>
        </form>

        {error && (
          <div className="mt-8 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-700">
            <AlertCircle size={20} />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {repair && (
          <div className="mt-12 space-y-8 animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center justify-between pb-6 border-b border-stone-100">
               <div>
                 <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Repairing</p>
                 <h2 className="text-xl font-bold text-stone-900">{repair.item}</h2>
                 <p className="text-sm text-stone-500 mt-1">Ticket: {repair.number}</p>
               </div>
               <div className="px-4 py-2 bg-amber-50 text-amber-700 rounded-full text-xs font-bold uppercase tracking-widest">
                 In Progress
               </div>
            </div>

            <div className="space-y-6">
               {repair.updates.map((update: any, idx: number) => (
                 <div key={idx} className="flex items-start gap-4">
                    <div className={`mt-1 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                      update.completed ? "bg-emerald-100 text-emerald-600" : "bg-stone-100 text-stone-300"
                    }`}>
                      {update.completed ? <CheckCircle2 size={16} /> : <Clock size={16} />}
                    </div>
                    <div>
                      <p className={`text-sm font-bold ${update.completed ? "text-stone-900" : "text-stone-400"}`}>
                        {update.status}
                      </p>
                      <p className="text-xs text-stone-500 mt-0.5">{update.date}</p>
                    </div>
                 </div>
               ))}
            </div>

            <div className="p-6 bg-stone-50 rounded-2xl flex items-center justify-between">
               <div className="flex items-center gap-3">
                 <div className="p-2 bg-white rounded-xl border border-stone-100 text-[#8B7355]"><Wrench size={20} /></div>
                 <div>
                   <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Estimated Ready</p>
                   <p className="text-sm font-bold text-stone-900">{repair.estimated_ready}</p>
                 </div>
               </div>
               <ChevronRight className="text-stone-300" />
            </div>
          </div>
        )}
      </div>

      <div className="mt-12 text-center">
        <p className="text-sm text-stone-400 italic">Have a question? <a href="#" className="text-[#8B7355] font-bold hover:underline underline-offset-4">Contact the workshop</a></p>
      </div>
    </div>
  );
}
