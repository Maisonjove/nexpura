import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

const TENANT_ID = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";

export const revalidate = 60;

export default async function ReviewPassportsPage() {
  const admin = createAdminClient();

  const { data: passports } = await admin
    .from("passports")
    .select("id, passport_uid, title, jewellery_type, status, created_at")
    .eq("tenant_id", TENANT_ID)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="nx-page-header">
        <div>
          <h1 className="nx-page-title">Jewellery Passports</h1>
          <p className="text-sm text-stone-500 mt-1">Digital identity certificates for fine jewellery</p>
        </div>
      </div>

      {!passports || passports.length === 0 ? (
        <div className="max-w-2xl mx-auto py-16 text-center">
          <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-stone-900 mb-2">No Passport Records</h2>
          <p className="text-stone-500 text-sm max-w-md mx-auto">
            No passport data has been seeded for this demo tenant. Passports are digital certificates that capture the full provenance and specifications of fine jewellery pieces.
          </p>
        </div>
      ) : (
        <div className="nx-table-wrapper">
          <table className="w-full">
            <thead>
              <tr className="border-b border-stone-100">
                <th className="text-left px-6 py-3 text-xs font-medium text-stone-500 uppercase tracking-wider">Passport ID</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-stone-500 uppercase tracking-wider">Title</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-stone-500 uppercase tracking-wider">Type</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-stone-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-stone-500 uppercase tracking-wider">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {passports.map((p) => (
                <tr key={p.id} className="hover:bg-stone-50 transition-colors">
                  <td className="px-6 py-4">
                    <Link href={`/review/passports/${p.id}`} className="text-sm font-mono text-[#8B7355] hover:underline">
                      {p.passport_uid}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-stone-900">{p.title}</td>
                  <td className="px-6 py-4 text-sm text-stone-500">{p.jewellery_type || "—"}</td>
                  <td className="px-6 py-4">
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-600">
                      {p.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-stone-500">
                    {new Date(p.created_at).toLocaleDateString("en-GB")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
