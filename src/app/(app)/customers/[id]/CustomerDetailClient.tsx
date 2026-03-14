"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { archiveCustomer, addCustomerNote } from "../actions";
import { User, Phone, Mail, MapPin, Calendar, Heart, Gem, List, History, Settings, MessageSquare, Tag } from "lucide-react";
import { format } from "date-fns";

type Customer = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  mobile: string | null;
  phone: string | null;
  address_line1: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  country: string | null;
  ring_size: string | null;
  wrist_size: string | null;
  gold_preference: string | null;
  spouse_name: string | null;
  spouse_birthday: string | null;
  customer_source: string | null;
  communication_preference: string | null;
  marketing_tags: string[] | null;
  preferred_metal: string | null;
  birthday: string | null;
  anniversary: string | null;
  tags: string[] | null;
  is_vip: boolean | null;
  notes: string | null;
  customer_since: string | null;
  created_at: string;
  updated_at: string | null;
};

const TABS = ["Overview", "Wish List", "Jewellery Owned", "Notes", "Activity"] as const;
type Tab = (typeof TABS)[number];

export default function CustomerDetailClient({ customer }: { customer: Customer }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [newNote, setNewNote] = useState("");
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  const [notes, setNotes] = useState(customer.notes || "");

  async function handleArchive() {
    startTransition(async () => {
      await archiveCustomer(customer.id);
    });
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!newNote.trim()) return;
    setNoteSubmitting(true);
    const result = await addCustomerNote(customer.id, newNote.trim());
    if (result.success) {
      const timestamp = new Date().toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" });
      const formattedNote = `[${timestamp}] ${newNote.trim()}`;
      setNotes((prev) => (prev ? `${prev}\n\n${formattedNote}` : formattedNote));
      setNewNote("");
    }
    setNoteSubmitting(false);
  }

  const infoItem = (label: string, value: string | null | undefined, icon?: any) => (
    <div key={label} className="flex flex-col gap-0.5">
      <dt className="text-[10px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1.5">
        {icon && <icon size={12} className="text-[#8B7355]" />}
        {label}
      </dt>
      <dd className="text-sm text-stone-900 font-medium">{value || "—"}</dd>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto py-10 px-4 space-y-8">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <Link href="/customers" className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-900 transition-colors">
          <ChevronLeft size={16} />
          Back to Customers
        </Link>
        <div className="flex gap-3">
          <button onClick={() => setShowArchiveModal(true)} className="px-4 py-2 text-sm font-medium border border-red-100 text-red-600 rounded-xl hover:bg-red-50 transition-colors">Archive</button>
          <Link href={`/customers/${customer.id}/edit`} className="px-4 py-2 text-sm font-medium bg-[#8B7355] text-white rounded-xl hover:bg-[#7A6347] transition-shadow shadow-sm">Edit Profile</Link>
        </div>
      </div>

      {/* Hero Card */}
      <div className="bg-white rounded-3xl border border-stone-200 p-8 shadow-sm flex flex-col md:flex-row gap-8 items-start md:items-center">
        <div className="w-24 h-24 rounded-2xl bg-[#8B7355]/5 flex items-center justify-center border border-[#8B7355]/10 text-3xl font-bold text-[#8B7355]">
          {(customer.first_name?.[0] || "?")}{(customer.last_name?.[0] || "")}
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-stone-900">{customer.full_name}</h1>
            {customer.is_vip && <span className="px-3 py-1 bg-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-widest rounded-full">VIP Member</span>}
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-stone-500">
             <span className="flex items-center gap-1.5"><Mail size={16} className="text-stone-300" /> {customer.email || "No email"}</span>
             <span className="flex items-center gap-1.5"><Phone size={16} className="text-stone-300" /> {customer.mobile || customer.phone || "No phone"}</span>
             <span className="flex items-center gap-1.5"><Calendar size={16} className="text-stone-300" /> Joined {customer.customer_since ? format(new Date(customer.customer_since), "MMM yyyy") : "—"}</span>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            {customer.tags?.map(t => <span key={t} className="px-2 py-0.5 bg-stone-100 text-stone-600 text-[10px] font-bold uppercase tracking-wider rounded-md">{t}</span>)}
            {customer.marketing_tags?.map(t => <span key={t} className="px-2 py-0.5 bg-[#8B7355]/10 text-[#8B7355] text-[10px] font-bold uppercase tracking-wider rounded-md">{t}</span>)}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-stone-100 p-1 rounded-2xl w-fit">
        {TABS.map(tab => (
          <button 
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === tab ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-900"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
           {activeTab === "Overview" && (
             <>
               <div className="bg-white rounded-3xl border border-stone-200 p-8 grid grid-cols-2 gap-y-8 gap-x-12">
                  <div className="col-span-2 pb-2 border-b border-stone-100 flex items-center gap-2">
                    <Heart size={18} className="text-[#8B7355]" />
                    <h2 className="text-sm font-bold uppercase tracking-widest text-stone-900">Personal & Dates</h2>
                  </div>
                  {infoItem("Birthday", customer.birthday ? format(new Date(customer.birthday), "dd MMMM") : null)}
                  {infoItem("Anniversary", customer.anniversary ? format(new Date(customer.anniversary), "dd MMMM") : null)}
                  {infoItem("Spouse Name", customer.spouse_name)}
                  {infoItem("Spouse Birthday", customer.spouse_birthday ? format(new Date(customer.spouse_birthday), "dd MMMM") : null)}

                  <div className="col-span-2 pb-2 border-b border-stone-100 flex items-center gap-2 mt-4">
                    <Gem size={18} className="text-[#8B7355]" />
                    <h2 className="text-sm font-bold uppercase tracking-widest text-stone-900">Preferences</h2>
                  </div>
                  {infoItem("Ring Size", customer.ring_size)}
                  {infoItem("Wrist Size", customer.wrist_size)}
                  {infoItem("Gold Preference", customer.gold_preference)}
                  {infoItem("Preferred Metal", customer.preferred_metal)}

                  <div className="col-span-2 pb-2 border-b border-stone-100 flex items-center gap-2 mt-4">
                    <Settings size={18} className="text-[#8B7355]" />
                    <h2 className="text-sm font-bold uppercase tracking-widest text-stone-900">Account & Comms</h2>
                  </div>
                  {infoItem("Source", customer.customer_source)}
                  {infoItem("Comm Preference", customer.communication_preference)}
               </div>
             </>
           )}

           {activeTab === "Wish List" && (
             <div className="bg-white rounded-3xl border border-stone-200 p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-stone-900">Items of Interest</h2>
                  <button className="text-sm font-semibold text-[#8B7355] hover:underline">+ Add to Wish List</button>
                </div>
                <div className="space-y-4">
                  <p className="text-sm text-stone-400 italic py-12 text-center border-2 border-dashed border-stone-100 rounded-2xl">No items in wish list yet.</p>
                </div>
             </div>
           )}

           {activeTab === "Jewellery Owned" && (
             <div className="bg-white rounded-3xl border border-stone-200 p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-stone-900">Owned Collection</h2>
                  <button className="text-sm font-semibold text-[#8B7355] hover:underline">+ Add Item</button>
                </div>
                <div className="space-y-4">
                  <p className="text-sm text-stone-400 italic py-12 text-center border-2 border-dashed border-stone-100 rounded-2xl">No items recorded in collection.</p>
                </div>
             </div>
           )}

           {activeTab === "Notes" && (
             <div className="space-y-4">
                <div className="bg-white rounded-3xl border border-stone-200 p-8">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-stone-900 mb-4">Add Private Note</h3>
                  <form onSubmit={handleAddNote} className="space-y-4">
                    <textarea 
                      value={newNote}
                      onChange={e => setNewNote(e.target.value)}
                      placeholder="Type something..."
                      className="w-full h-32 p-4 rounded-2xl border border-stone-200 focus:outline-none focus:ring-1 focus:ring-[#8B7355] resize-none"
                    />
                    <div className="flex justify-end">
                      <button disabled={noteSubmitting} className="px-6 py-2.5 bg-[#8B7355] text-white rounded-xl font-bold disabled:opacity-50">Save Note</button>
                    </div>
                  </form>
                </div>
                <div className="space-y-4">
                  {notes.split("\n\n").reverse().map((n, idx) => (
                    <div key={idx} className="bg-white p-6 rounded-2xl border border-stone-100 shadow-sm text-sm text-stone-700 whitespace-pre-wrap">
                      {n}
                    </div>
                  ))}
                </div>
             </div>
           )}

           {activeTab === "Activity" && (
             <div className="bg-white rounded-3xl border border-stone-200 p-12 text-center flex flex-col items-center gap-4">
                <div className="p-4 rounded-full bg-stone-50 text-stone-300"><History size={48} /></div>
                <div>
                  <h3 className="font-bold text-stone-900">No recent activity</h3>
                  <p className="text-sm text-stone-500">Sales, quotes and repairs will appear here once created.</p>
                </div>
             </div>
           )}
        </div>

        <div className="space-y-8">
           <div className="bg-white rounded-3xl border border-stone-200 p-8 space-y-6">
              <h2 className="text-xs font-bold uppercase tracking-widest text-stone-400">Contact Details</h2>
              <div className="space-y-4">
                 <div className="flex items-start gap-3">
                   <div className="mt-1"><MapPin size={18} className="text-[#8B7355]" /></div>
                   <div className="text-sm text-stone-900">
                     <p className="font-medium">{customer.address_line1 || "No address set"}</p>
                     <p>{customer.suburb} {customer.state} {customer.postcode}</p>
                   </div>
                 </div>
                 <div className="flex items-center gap-3">
                   <MessageSquare size={18} className="text-[#8B7355]" />
                   <p className="text-sm text-stone-900">{customer.mobile || customer.phone || "No phone recorded"}</p>
                 </div>
              </div>
           </div>

           <div className="bg-stone-900 rounded-3xl p-8 space-y-6 text-white shadow-xl">
              <h2 className="text-xs font-bold uppercase tracking-widest text-stone-400">Engagement Score</h2>
              <div className="flex items-end gap-2">
                 <span className="text-4xl font-bold">82</span>
                 <span className="text-stone-400 mb-1">/ 100</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-[#8B7355] w-[82%]" />
              </div>
              <p className="text-xs text-stone-400 leading-relaxed">Based on purchase frequency, sentiment analysis of notes, and attendance at showroom events.</p>
           </div>
        </div>
      </div>
    </div>
  );
}

function ChevronLeft({ size, className }: any) {
  return <svg width={size} height={size} className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>;
}
