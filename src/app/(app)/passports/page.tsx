import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function PassportsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user?.id ?? "")
    .single();

  const tenantId = userData?.tenant_id;

  const { data: passports } = await supabase
    .from("passports")
    .select(
      "id, passport_uid, title, jewellery_type, current_owner_name, status, is_public, verified_at, created_at"
    )
    .eq("tenant_id", tenantId ?? "")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const safePassports = passports ?? [];
  const total = safePassports.length;
  const active = safePassports.filter((p) => p.status === "active").length;
  const verified = safePassports.filter((p) => p.verified_at !== null).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-3xl font-semibold text-stone-900">
            Digital Passports
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Verifiable certificates of authenticity for every piece
          </p>
        </div>
        <Link
          href="/passports/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#8B7355] text-white text-sm font-medium rounded-lg hover:bg-[#7A6347] transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Create Passport
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
            Total Passports
          </p>
          <p className="text-3xl font-semibold font-semibold text-stone-900 mt-1">
            {total}
          </p>
        </div>
        <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
            Active
          </p>
          <p className="text-3xl font-semibold font-semibold text-[#8B7355] mt-1">
            {active}
          </p>
        </div>
        <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
            Verified
          </p>
          <p className="text-3xl font-semibold font-semibold text-stone-900 mt-1">
            {verified}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
        {safePassports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-stone-100 flex items-center justify-center mb-4">
              <svg
                className="w-7 h-7 text-[#8B7355]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
            <h3 className="font-semibold text-lg font-semibold text-stone-900">
              No passports yet
            </h3>
            <p className="text-sm text-gray-500 mt-1 mb-4">
              Create your first digital jewellery passport
            </p>
            <Link
              href="/passports/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#8B7355] text-white text-sm font-medium rounded-lg hover:bg-[#7A6347] transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Create Passport
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-gray-50/50">
                  <th className="text-left px-5 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Passport UID
                  </th>
                  <th className="text-left px-5 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Title
                  </th>
                  <th className="text-left px-5 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Type
                  </th>
                  <th className="text-left px-5 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Owner
                  </th>
                  <th className="text-left px-5 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="text-left px-5 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Created
                  </th>
                  <th className="text-left px-5 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-platinum">
                {safePassports.map((passport) => (
                  <tr
                    key={passport.id}
                    className="hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="px-5 py-4">
                      <span className="font-mono text-xs font-semibold bg-stone-100 text-[#8B7355] px-2 py-1 rounded">
                        {passport.passport_uid}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-medium text-stone-900">
                      {passport.title}
                    </td>
                    <td className="px-5 py-4 text-gray-500 capitalize">
                      {passport.jewellery_type?.replace(/_/g, " ") || "—"}
                    </td>
                    <td className="px-5 py-4 text-gray-500">
                      {passport.current_owner_name || "—"}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          passport.status === "active"
                            ? "bg-green-50 text-green-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            passport.status === "active"
                              ? "bg-green-500"
                              : "bg-gray-400"
                          }`}
                        />
                        {passport.status}
                      </span>
                      {!passport.is_public && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                          Private
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-gray-500 text-xs">
                      {new Date(passport.created_at).toLocaleDateString(
                        "en-AU",
                        {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        }
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/passports/${passport.id}`}
                          className="text-[#8B7355] hover:text-[#8B7355]/80 text-xs font-medium transition-colors"
                        >
                          View
                        </Link>
                        <Link
                          href={`/passports/${passport.id}/edit`}
                          className="text-gray-400 hover:text-gray-600 text-xs font-medium transition-colors"
                        >
                          Edit
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
