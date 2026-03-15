import { createAdminClient } from "@/lib/supabase/admin";

const TENANT_ID = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";
export const revalidate = 60;

const PDF_DOCUMENT_TYPES = [
  { id: "invoice", label: "Invoice / Quote", icon: "📄", desc: "Itemised invoice with payment summary, logo, and terms" },
  { id: "repair_ticket", label: "Repair Ticket", icon: "🔧", desc: "Intake sheet with condition notes, quote, and customer signature line" },
  { id: "bespoke_sheet", label: "Bespoke Work Sheet", icon: "💎", desc: "Job specification sheet with stone, metal, and design details" },
  { id: "passport_cert", label: "Passport Certificate", icon: "🛡️", desc: "Verifiable ownership certificate with QR code for digital access" },
  { id: "appraisal", label: "Appraisal Certificate", icon: "📋", desc: "Formal valuation certificate with appraiser credentials and values" },
  { id: "memo", label: "Memo / Consignment Note", icon: "📝", desc: "Memo-out or consignment agreement with terms and item details" },
];

const LABEL_TYPES = [
  { type: "stock_tag", label: "Stock Tag", icon: "🏷️", size: "50 × 25mm", desc: "Item SKU, name, and price — for display tags on jewellery" },
  { type: "receipt_label", label: "Receipt Label", icon: "🧾", size: "80mm roll", desc: "POS receipt with itemised sale, payment method, and store details" },
  { type: "repair_label", label: "Repair Bag Tag", icon: "🔖", size: "38 × 19mm", desc: "Repair number, customer name, and brief description for bag attachment" },
  { type: "bespoke_label", label: "Job Label", icon: "✨", size: "50 × 25mm", desc: "Bespoke job number, customer name, and due date for production" },
];

const NUMBERING_SEQUENCES = [
  { module: "Invoices", pattern: "INV-0001", lastIssued: "INV-0004", nextUp: "INV-0005" },
  { module: "Repairs", pattern: "R-0001", lastIssued: "R-0005", nextUp: "R-0006" },
  { module: "Bespoke Jobs", pattern: "B-0001", lastIssued: "B-0003", nextUp: "B-0004" },
  { module: "Appraisals", pattern: "APR-0001", lastIssued: "APR-0003", nextUp: "APR-0004" },
  { module: "Memo / Consignment", pattern: "M-0001 / C-0001", lastIssued: "M-0001 / C-0001", nextUp: "M-0002 / C-0002" },
  { module: "Sales", pattern: "S-0001", lastIssued: "S-0006", nextUp: "S-0007" },
];

export default async function ReviewSettingsPage() {
  const admin = createAdminClient();

  // Fetch tenant business profile
  const { data: tenant } = await admin
    .from("tenants")
    .select("name, business_name, business_type, phone, email, abn, address_line1, suburb, state, postcode, country, currency, timezone")
    .eq("id", TENANT_ID)
    .maybeSingle();

  // Fetch users for the tenant
  const { data: users } = await admin
    .from("users")
    .select("id, full_name, email, role")
    .eq("tenant_id", TENANT_ID)
    .order("role");

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Settings</h1>
        <p className="text-sm text-stone-400 mt-0.5">Business configuration, documents, and printing</p>
      </div>

      {/* Business Profile */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-widest">Business Profile</h2>
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-5 text-sm">
            {[
              { label: "Business Name", value: tenant?.business_name },
              { label: "Business Type", value: tenant?.business_type ? tenant.business_type.replace("_", " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) : null },
              { label: "ABN", value: tenant?.abn },
              { label: "Phone", value: tenant?.phone },
              { label: "Email", value: tenant?.email },
              { label: "Currency", value: tenant?.currency ? `${tenant.currency} (Australian Dollar)` : null },
              { label: "Timezone", value: tenant?.timezone },
              { label: "Address", value: tenant ? [tenant.address_line1, tenant.suburb, tenant.state, tenant.postcode, tenant.country].filter(Boolean).join(", ") : null },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-stone-400 text-xs">{label}</p>
                <p className="font-medium text-stone-900 mt-0.5">{value || "—"}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      {users && users.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-widest">Team Members</h2>
          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-stone-50 border-b border-stone-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Role</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-stone-100">
                    <td className="px-4 py-3 text-sm font-medium text-stone-900">{u.full_name || "—"}</td>
                    <td className="px-4 py-3 text-sm text-stone-500">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                        u.role === "owner" ? "bg-amber-100 text-amber-800" :
                        u.role === "manager" ? "bg-blue-100 text-blue-700" :
                        "bg-stone-100 text-stone-600"
                      }`}>
                        {u.role ? u.role.charAt(0).toUpperCase() + u.role.slice(1) : "Staff"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Document Centre — PDF Types */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-widest">Document Centre</h2>
          <span className="text-xs text-stone-400">{PDF_DOCUMENT_TYPES.length} document types</span>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 flex items-start gap-2">
          <span className="text-base flex-shrink-0 mt-0.5">💡</span>
          <p className="text-xs text-amber-800 leading-relaxed">
            <span className="font-semibold">How it works:</span> PDF documents are generated on-demand from live data. Templates are configured per document type with your logo, branding, and layout.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PDF_DOCUMENT_TYPES.map((doc) => (
            <div key={doc.id} className="bg-white rounded-xl border border-stone-200 p-4 flex items-start gap-3">
              <span className="text-2xl flex-shrink-0">{doc.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-stone-900">{doc.label}</p>
                  <span className="flex-shrink-0 inline-flex px-2 py-0.5 bg-[#8B7355]/10 text-[#8B7355] text-xs font-semibold rounded-full">
                    In use
                  </span>
                </div>
                <p className="text-xs text-stone-400 mt-0.5 leading-relaxed">{doc.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Print & Labels */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-widest">Print &amp; Labels</h2>
          <span className="text-xs text-stone-400">ZPL-based label printing</span>
        </div>

        {/* Label Templates table */}
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Template</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Size</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Use Case</th>
              </tr>
            </thead>
            <tbody>
              {LABEL_TYPES.map((lt) => (
                <tr key={lt.type} className="border-b border-stone-100">
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span>{lt.icon}</span>
                      <span className="font-medium text-stone-900">{lt.label}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-stone-500">{lt.size}</td>
                  <td className="px-4 py-3 text-sm text-stone-500">{lt.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Printer Configuration info */}
        <div className="bg-white rounded-xl border border-stone-200 p-4 flex items-start gap-3">
          <span className="text-xl flex-shrink-0">🖨️</span>
          <div>
            <p className="text-sm font-semibold text-stone-900">Printer Configuration</p>
            <p className="text-xs text-stone-400 mt-0.5 leading-relaxed">
              Supports Zebra ZPL, Brother QL, and standard receipt printers. Configuration is per-device.
            </p>
          </div>
        </div>

        {/* Print History empty state */}
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-widest mb-3">Print History</p>
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <span className="text-3xl mb-3">🖨️</span>
            <p className="text-sm font-medium text-stone-900 mb-1">No print jobs yet</p>
            <p className="text-xs text-stone-400 max-w-sm leading-relaxed">
              Print jobs appear here as stock tags, repair bag tags, and receipt labels are printed from any module.
            </p>
          </div>
        </div>
      </section>

      {/* Numbering Sequences */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-widest">Automatic Numbering</h2>
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Module</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Pattern</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Last Issued</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Next Number</th>
              </tr>
            </thead>
            <tbody>
              {NUMBERING_SEQUENCES.map((seq) => (
                <tr key={seq.module} className="border-b border-stone-100">
                  <td className="px-4 py-3 text-sm font-medium text-stone-900">{seq.module}</td>
                  <td className="px-4 py-3 text-sm font-mono text-stone-400">{seq.pattern}</td>
                  <td className="px-4 py-3 text-sm font-mono text-stone-500">{seq.lastIssued}</td>
                  <td className="px-4 py-3 text-sm font-mono text-amber-700 font-semibold">{seq.nextUp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
