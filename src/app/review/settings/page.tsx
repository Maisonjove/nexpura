import { createAdminClient } from "@/lib/supabase/admin";

const TENANT_ID = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";
export const revalidate = 60;

const PDF_DOCUMENT_TYPES = [
  { id: "invoice", label: "Invoice / Quote", desc: "Itemised invoice with payment summary, logo, and terms", genCount: 14, color: "#8B7355" },
  { id: "repair_ticket", label: "Repair Ticket", desc: "Intake sheet with condition notes, quote, and customer signature line", genCount: 9, color: "#8B7355" },
  { id: "bespoke_sheet", label: "Bespoke Work Sheet", desc: "Job specification sheet with stone, metal, and design details", genCount: 3, color: "#8B7355" },
  { id: "passport_cert", label: "Passport Certificate", desc: "Verifiable ownership certificate with QR code for digital access", genCount: 7, color: "#8B7355" },
  { id: "appraisal", label: "Appraisal Certificate", desc: "Formal valuation certificate with appraiser credentials and values", genCount: 5, color: "#8B7355" },
  { id: "memo", label: "Memo / Consignment Note", desc: "Memo-out or consignment agreement with terms and item details", genCount: 2, color: "#8B7355" },
];

const LABEL_TYPES = [
  { type: "stock_tag", label: "Stock Tag", size: "50 × 25mm", desc: "Item SKU, name, and price — for display tags on jewellery" },
  { type: "receipt_label", label: "Receipt Label", size: "80mm roll", desc: "POS receipt with itemised sale, payment method, and store details" },
  { type: "repair_label", label: "Repair Bag Tag", size: "38 × 19mm", desc: "Repair number, customer name, and brief description for bag attachment" },
  { type: "bespoke_label", label: "Job Label", size: "50 × 25mm", desc: "Bespoke job number, customer name, and due date for production" },
];

const RECENT_PRINT_JOBS = [
  { id: "PJ-001", type: "Stock Tag", reference: "DSR-001", timestamp: "15 Mar 2026, 10:42 AM", printedBy: "Demo Owner" },
  { id: "PJ-002", type: "Repair Bag", reference: "R-0001", timestamp: "14 Mar 2026, 3:17 PM", printedBy: "Demo Owner" },
  { id: "PJ-003", type: "Receipt", reference: "S-0004", timestamp: "13 Mar 2026, 11:05 AM", printedBy: "Demo Owner" },
];

const NUMBERING_SEQUENCES = [
  { module: "Invoices", pattern: "INV-0001", lastIssued: "INV-0004", nextUp: "INV-0005" },
  { module: "Repairs", pattern: "R-0001", lastIssued: "R-0005", nextUp: "R-0006" },
  { module: "Bespoke Jobs", pattern: "B-0001", lastIssued: "B-0003", nextUp: "B-0004" },
  { module: "Appraisals", pattern: "APR-0001", lastIssued: "APR-0003", nextUp: "APR-0004" },
  { module: "Memo / Consignment", pattern: "M-0001 / C-0001", lastIssued: "M-0001 / C-0001", nextUp: "M-0002 / C-0002" },
  { module: "Sales", pattern: "S-0001", lastIssued: "S-0006", nextUp: "S-0007" },
];

const INTEGRATIONS = [
  { name: "Xero", desc: "Accounting & invoicing sync", status: "Not Connected", badge: "bg-stone-100 text-stone-500", dot: "bg-stone-400" },
  { name: "Stripe", desc: "Online payments", status: "Test Mode", badge: "bg-amber-50 text-amber-700", dot: "bg-amber-400" },
  { name: "WhatsApp Business", desc: "Customer notifications", status: "Not Configured", badge: "bg-stone-100 text-stone-500", dot: "bg-stone-400" },
  { name: "Shopify", desc: "E-commerce sync", status: "Not Connected", badge: "bg-stone-100 text-stone-500", dot: "bg-stone-400" },
];

function DocStub() {
  return (
    <div className="flex-shrink-0 w-10 h-12 bg-white border border-stone-200 rounded shadow-sm flex flex-col justify-center gap-1 px-1.5">
      <span className="block h-0.5 bg-stone-200 rounded" />
      <span className="block h-0.5 bg-stone-200 rounded w-4/5" />
      <span className="block h-0.5 bg-stone-200 rounded" />
      <span className="block h-0.5 bg-stone-100 rounded w-3/5" />
      <span className="block h-0.5 bg-stone-200 rounded" />
    </div>
  );
}

export default async function ReviewSettingsPage() {
  const admin = createAdminClient();

  const { data: tenant } = await admin
    .from("tenants")
    .select("name, business_name, business_type, phone, email, abn, address_line1, suburb, state, postcode, country, currency, timezone")
    .eq("id", TENANT_ID)
    .maybeSingle();

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

      {/* ── BUSINESS PROFILE ── */}
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

      {/* ── TEAM ── */}
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
                        u.role === "manager" ? "bg-stone-200 text-stone-700" :
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

      {/* ── DOCUMENT CENTRE ── */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-widest">Document Centre</h2>
          <span className="text-xs text-stone-400">{PDF_DOCUMENT_TYPES.length} document types</span>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 flex items-start gap-2">
          <div className="w-4 h-4 rounded-full bg-amber-400 flex-shrink-0 mt-0.5 flex items-center justify-center">
            <span className="text-white text-xs font-bold leading-none">i</span>
          </div>
          <p className="text-xs text-amber-800 leading-relaxed">
            <span className="font-semibold">How it works:</span> PDF documents are generated on-demand from live data. Templates are configured per document type with your logo, branding, and layout.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PDF_DOCUMENT_TYPES.map((doc) => (
            <div key={doc.id} className="bg-white rounded-xl border border-stone-200 p-4 flex items-start gap-3">
              <DocStub />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-sm font-semibold text-stone-900">{doc.label}</p>
                  <span className="flex-shrink-0 inline-flex px-2 py-0.5 bg-[#8B7355]/10 text-[#8B7355] text-xs font-semibold rounded-full">
                    In use
                  </span>
                </div>
                <p className="text-xs text-stone-400 leading-relaxed mb-2">{doc.desc}</p>
                <div className="flex items-center gap-3 text-xs text-stone-400">
                  <span className="font-medium text-stone-600">Generated {doc.genCount}× this month</span>
                  <span>·</span>
                  <span>Last: Mar 15, 2026</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── PRINT & LABELS ── */}
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
                <tr key={lt.type} className="border-b border-stone-100 last:border-0">
                  <td className="px-4 py-3 text-sm font-medium text-stone-900">{lt.label}</td>
                  <td className="px-4 py-3 text-sm font-mono text-stone-500">{lt.size}</td>
                  <td className="px-4 py-3 text-sm text-stone-500">{lt.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Configured Printer */}
        <div className="bg-white rounded-xl border border-stone-200 p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-stone-100 border border-stone-200 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6v-8z" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-stone-900">Zebra GK420d · USB Connected</p>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Online
              </span>
            </div>
            <p className="text-xs text-stone-400 mt-0.5">Label printer — ZPL compatible · 203 dpi</p>
          </div>
        </div>

        {/* Print History */}
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-stone-100 bg-stone-50">
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-widest">Recent Print Jobs</p>
          </div>
          <table className="w-full">
            <thead className="border-b border-stone-100">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-stone-400 uppercase tracking-widest">Type</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-stone-400 uppercase tracking-widest">Reference</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-stone-400 uppercase tracking-widest">Printed</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-stone-400 uppercase tracking-widest">By</th>
              </tr>
            </thead>
            <tbody>
              {RECENT_PRINT_JOBS.map((job) => (
                <tr key={job.id} className="border-b border-stone-100 last:border-0">
                  <td className="px-4 py-3 text-sm font-medium text-stone-900">{job.type}</td>
                  <td className="px-4 py-3 text-sm font-mono text-[#8B7355]">{job.reference}</td>
                  <td className="px-4 py-3 text-xs text-stone-500">{job.timestamp}</td>
                  <td className="px-4 py-3 text-xs text-stone-500">{job.printedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── NUMBERING ── */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-widest">Automatic Numbering</h2>
        <p className="text-xs text-stone-400">All records are assigned sequential numbers automatically. You can customise the prefix and starting number.</p>
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
                <tr key={seq.module} className="border-b border-stone-100 last:border-0">
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

      {/* ── INTEGRATIONS ── */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-widest">Integrations</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {INTEGRATIONS.map((integration) => (
            <div key={integration.name} className="bg-white rounded-xl border border-stone-200 p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-stone-100 border border-stone-200 flex-shrink-0 flex items-center justify-center">
                <span className="text-xs font-bold text-stone-500">{integration.name.substring(0, 2).toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-stone-900">{integration.name}</p>
                  <span className={`flex-shrink-0 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${integration.badge}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${integration.dot}`} />
                    {integration.status}
                  </span>
                </div>
                <p className="text-xs text-stone-400 mt-0.5">{integration.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
