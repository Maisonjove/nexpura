import { createAdminClient } from "@/lib/supabase/admin";
import { Wrench, ClipboardList, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import Link from "next/link";

const TENANT_ID = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";

export const revalidate = 60;

export default async function ReviewWorkshopPage() {
  const admin = createAdminClient();

  const { data: activeRepairs } = await admin
    .from("repairs")
    .select("id, item_description, stage, due_date, customers(full_name)")
    .eq("tenant_id", TENANT_ID)
    .not("stage", "in", '("collected","cancelled")')
    .order("due_date", { ascending: true });

  const { data: activeJobs } = await admin
    .from("bespoke_jobs")
    .select("id, title, stage, due_date, customers(full_name)")
    .eq("tenant_id", TENANT_ID)
    .not("stage", "in", '("completed","cancelled")')
    .order("due_date", { ascending: true });

  const totalActive = (activeRepairs?.length ?? 0) + (activeJobs?.length ?? 0);
  const overdueCount = [...(activeRepairs ?? []), ...(activeJobs ?? [])].filter(
    (item) => item.due_date && new Date(item.due_date) < new Date()
  ).length;

  return (
    <div className="space-y-6 nx-fade-in">
      <div className="nx-page-header">
        <div>
          <h1 className="nx-page-title">Workshop Overview</h1>
          <p className="text-sm text-stone-500 mt-1">Manage production and repair workflows</p>
        </div>
        <div className="flex gap-2">
          <Link href="/review/workshop" className="px-4 py-2 bg-white border border-stone-200 rounded-lg text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors flex items-center gap-2">
            <Clock size={16} />
            Workshop
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="nx-card">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center">
              <ClipboardList className="text-amber-700" size={24} />
            </div>
            <div>
              <p className="nx-label">Total Active</p>
              <p className="text-2xl font-bold text-stone-900">{totalActive}</p>
            </div>
          </div>
        </div>
        <div className="nx-card">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center">
              <Clock className="text-amber-600" size={24} />
            </div>
            <div>
              <p className="nx-label">In Progress</p>
              <p className="text-2xl font-bold text-stone-900">
                {[...(activeRepairs ?? []), ...(activeJobs ?? [])].filter(
                  (i) => i.stage !== "intake" && i.stage !== "enquiry"
                ).length}
              </p>
            </div>
          </div>
        </div>
        <div className="nx-card">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
              <AlertTriangle className="text-red-600" size={24} />
            </div>
            <div>
              <p className="nx-label">Overdue</p>
              <p className="text-2xl font-bold text-red-600">{overdueCount}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="nx-table-wrapper">
          <div className="px-6 py-4 border-b border-stone-100 flex justify-between items-center bg-stone-50/50">
            <h2 className="nx-card-title flex items-center gap-2">
              <Wrench size={18} className="text-stone-400" />
              Active Repairs
            </h2>
            <Link href="/review/repairs" className="text-xs text-amber-700 font-medium hover:underline">View All</Link>
          </div>
          <div className="divide-y divide-stone-100">
            {activeRepairs && activeRepairs.length > 0 ? (
              activeRepairs.slice(0, 8).map((repair) => (
                <div key={repair.id} className="px-6 py-4 hover:bg-stone-50 transition-colors flex justify-between items-center">
                  <div>
                    <Link href={`/review/repairs/${repair.id}`} className="text-sm font-medium text-stone-900 hover:text-amber-700">
                      {repair.item_description}
                    </Link>
                    <p className="text-xs text-stone-400 mt-0.5">
                      {Array.isArray(repair.customers) ? (repair.customers[0] as { full_name?: string })?.full_name : (repair.customers as { full_name?: string })?.full_name}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="nx-badge-neutral uppercase">{repair.stage}</span>
                    {repair.due_date && (
                      <p className={`text-[10px] mt-1 font-medium ${new Date(repair.due_date) < new Date() ? "text-red-500" : "text-stone-400"}`}>
                        Due {new Date(repair.due_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="px-6 py-10 text-center text-stone-400 text-sm italic">No active repairs</div>
            )}
          </div>
        </div>

        <div className="nx-table-wrapper">
          <div className="px-6 py-4 border-b border-stone-100 flex justify-between items-center bg-stone-50/50">
            <h2 className="nx-card-title flex items-center gap-2">
              <CheckCircle2 size={18} className="text-stone-400" />
              Bespoke Production
            </h2>
            <Link href="/review/bespoke" className="text-xs text-amber-700 font-medium hover:underline">View All</Link>
          </div>
          <div className="divide-y divide-stone-100">
            {activeJobs && activeJobs.length > 0 ? (
              activeJobs.slice(0, 8).map((job) => (
                <div key={job.id} className="px-6 py-4 hover:bg-stone-50 transition-colors flex justify-between items-center">
                  <div>
                    <Link href={`/review/bespoke/${job.id}`} className="text-sm font-medium text-stone-900 hover:text-amber-700">
                      {job.title}
                    </Link>
                    <p className="text-xs text-stone-400 mt-0.5">
                      {Array.isArray(job.customers) ? (job.customers[0] as { full_name?: string })?.full_name : (job.customers as { full_name?: string })?.full_name}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-700/10 text-amber-700 border border-amber-600/20">
                      {job.stage}
                    </span>
                    {job.due_date && (
                      <p className={`text-[10px] mt-1 font-medium ${new Date(job.due_date) < new Date() ? "text-red-500" : "text-stone-400"}`}>
                        Due {new Date(job.due_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="px-6 py-10 text-center text-stone-400 text-sm italic">No active bespoke jobs</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
