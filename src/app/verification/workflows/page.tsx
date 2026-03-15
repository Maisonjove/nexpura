/**
 * /verification/workflows — Workflow video proof gallery
 */

const VIDEOS = [
  { id: "A", title: "POS — Normal Card Sale", file: "A-pos-card-sale.webm", route: "/pos", desc: "Add item (DSR-001) → attach customer (David) → complete card sale → stock deducts." },
  { id: "D", title: "POS — Layby Creation", file: "D-layby-create.webm", route: "/pos", desc: "Create layby sale (status='layby'). Note: full lifecycle needs laybys table." },
  { id: "E", title: "Repair Financial Flow", file: "E-repair-finance.webm", route: "/repairs/[id]", desc: "Mark deposit paid → Generate linked invoice → Real-time status update." },
  { id: "F", title: "Bespoke Financial Flow", file: "F-bespoke-finance.webm", route: "/bespoke/[id]", desc: "Finance panel interaction: Mark deposit paid and generate invoice." },
  { id: "G", title: "Quote → Invoice Conversion", file: "G-quote-to-invoice.webm", route: "/quotes", desc: "Convert existing quote (Q-0001) into a real invoice." },
  { id: "H", title: "Inventory Create/Edit", file: "H-inventory-edit.webm", route: "/inventory/[id]", desc: "Edit jewellery-specific fields (DSR-001) and verify persistence." },
  { id: "K", title: "Appraisal Status Update", file: "K-appraisal-update.webm", route: "/appraisals", desc: "Appraisal list navigation and detail view status inspection." },
  { id: "L", title: "Passport Public Verify", file: "L-passport-verify.webm", route: "/passports/[id]", desc: "Public/Private state inspection + QR code/verify URL display." },
  { id: "M", title: "End of Day (EOD)", file: "M-eod-totals.webm", route: "/eod", desc: "Inspection of daily totals and reconciliation surface." },
  { id: "N", title: "Settings & Doc Centre", file: "N-settings.webm", route: "/settings", desc: "Numbering sequences, document templates, and printer config." },
  { id: "O", title: "Admin Audit Proof", file: "O-admin-audit.webm", route: "/admin/audit", desc: "Real audit log entries generated from the actions above." },
];

const STORAGE_BASE = "https://vkpjocnrefjfpuovzinn.supabase.co/storage/v1/object/public/verification/videos";

export default function WorkflowsPage() {
  return (
    <div style={{ fontFamily: "system-ui, sans-serif", background: "#fafaf9", minHeight: "100vh", padding: "40px 24px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 48, borderLeft: "4px solid #B45309", paddingLeft: 16 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#1c1917", margin: 0 }}>Nexpura — Workflow Proof Pack</h1>
          <p style={{ fontSize: 14, color: "#78716c", margin: "8px 0 0" }}>
            Real interactions recorded from build <strong>nexpura-1ng2apsl7</strong> against the Marcus &amp; Co. tenant.
            Proves backend mutations and state persistence behind auth.
          </p>
        </div>

        {/* Video Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 40 }}>
          {VIDEOS.map((v) => (
            <div key={v.id} style={{ background: "#fff", border: "1px solid #e7e5e4", borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #f5f5f4", display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ background: "#1c1917", color: "#fff", fontSize: 12, fontWeight: 700, width: 24, height: 24, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {v.id}
                </span>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{v.title}</h2>
                <code style={{ fontSize: 11, color: "#78716c", marginLeft: "auto", background: "#f5f5f4", padding: "2px 6px", borderRadius: 4 }}>{v.route}</code>
              </div>
              <div style={{ background: "#000", aspectRatio: "1280 / 800" }}>
                <video
                  src={`${STORAGE_BASE}/${v.file}`}
                  controls
                  preload="metadata"
                  style={{ width: "100%", height: "100%" }}
                />
              </div>
              <div style={{ padding: "16px 20px" }}>
                <p style={{ fontSize: 14, color: "#444", margin: 0 }}>{v.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Not Proved Section */}
        <div style={{ marginTop: 64, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 16, padding: "24px" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#991b1b", marginTop: 0 }}>Flows Not Fully Proved</h2>
          <p style={{ fontSize: 14, color: "#7f1d1d", marginBottom: 20 }}>
            The following flows have UI code but cannot be proved end-to-end because the underlying DB tables are not provisioned in this environment:
          </p>
          <ul style={{ fontSize: 13, color: "#7f1d1d", paddingLeft: 20 }}>
            <li style={{ marginBottom: 8 }}><strong>B — Voucher Split:</strong> Table <code>gift_vouchers</code> is missing in DB.</li>
            <li style={{ marginBottom: 8 }}><strong>C — Refund to Store Credit:</strong> Table <code>refunds</code> and <code>store_credit</code> column are missing.</li>
            <li style={{ marginBottom: 8 }}><strong>I — Stock Transfer:</strong> Table <code>locations</code> is missing.</li>
            <li style={{ marginBottom: 8 }}><strong>P — Permission Enforcement:</strong> No restricted-role user (Team Member) seeded in this tenant.</li>
          </ul>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 48, textAlign: "center" }}>
          <a href="/verification" style={{ color: "#B45309", fontWeight: 600, fontSize: 14 }}>← Back to static screenshot gallery</a>
        </div>
      </div>
    </div>
  );
}
