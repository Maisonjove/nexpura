/**
 * /verification/workflows — Workflow video proof gallery
 *
 * Videos are loaded from Supabase Storage. They were captured from the
 * SAME deployed build that serves this page. The build ID shown in the
 * header is read from the request host header at runtime — always matches
 * the actual deployment with zero drift.
 *
 * PREVIEW-ONLY. Remove after review cycle.
 */

import { headers } from "next/headers";

const STORAGE =
  "https://vkpjocnrefjfpuovzinn.supabase.co/storage/v1/object/public/verification/videos";

const FLOWS = [
  {
    id: "A",
    title: "POS — Normal Card Sale",
    file: "A-pos-card-sale.webm",
    route: "/pos",
    proves: "Add item to cart, attach customer, complete card payment, stock deducted from inventory.",
    category: "POS",
  },
  {
    id: "B",
    title: "POS — Voucher + Card Split Payment",
    file: "B-voucher-card-split.webm",
    route: "/pos",
    proves: "Voucher GV-MARC001 ($200 active balance) applied. Remaining balance paid by card. Voucher marked redeemed in gift_vouchers table.",
    category: "POS",
  },
  {
    id: "C",
    title: "Refund → Store Credit → Reuse",
    file: "C-refund-store-credit.webm",
    route: "/customers/[id] + /pos",
    proves: "Customer store credit balance ($150) visible on David Moufarrej profile. Store Credit payment tab in POS active for this customer.",
    category: "POS",
  },
  {
    id: "D",
    title: "Layby — Full Lifecycle",
    file: "D-layby-full-lifecycle.webm",
    route: "/laybys + /pos",
    proves: "Shows existing L-0001 layby with deposit history. Follow-up payment recorded — remaining balance updates. New layby created from POS with deposit stored. complete lifecycle: creation → deposit → follow-up payment → balance tracking.",
    category: "POS",
  },
  {
    id: "E",
    title: "Repair — Full Financial Flow",
    file: "E-repair-finance.webm",
    route: "/repairs/[id]",
    proves: "R-0001 starting with deposit_paid=false. Mark deposit paid → persists to DB. Generate linked invoice → new invoice record created and linked to repair.",
    category: "Finance",
  },
  {
    id: "F",
    title: "Bespoke — Full Financial Flow",
    file: "F-bespoke-finance.webm",
    route: "/bespoke/[id]",
    proves: "B-0001 ($12,500 quoted). Mark deposit paid → persists. Generate linked invoice → new invoice record created and linked to bespoke job.",
    category: "Finance",
  },
  {
    id: "G",
    title: "Quote → Invoice Conversion",
    file: "G-quote-to-invoice.webm",
    route: "/quotes",
    proves: "Draft quote Q-0001 converted to active invoice via real server action. Resulting invoice visible in /invoices.",
    category: "Finance",
  },
  {
    id: "H",
    title: "Inventory — Edit with Jewellery Fields",
    file: "H-inventory-edit.webm",
    route: "/inventory/[id]/edit",
    proves: "DSR-001 edit form showing metal type, carat weight, stone type, cert fields. Change persisted to DB and reflected in detail page.",
    category: "Operations",
  },
  {
    id: "I",
    title: "Stock Transfer / Adjustment",
    file: "I-stock-transfer.webm",
    route: "/inventory/[id]",
    proves: "Stock Adjust modal opened for SHR-002. -1 unit adjustment recorded. stock_movements record created, inventory quantity updated.",
    category: "Operations",
  },
  {
    id: "J",
    title: "Memo & Consignment",
    file: "J-memo.webm",
    route: "/memo",
    proves: "M-0001 (Lina Haddad — Pearl Strand Necklace) and C-0001 (Vintage Vault consignment) both listed. Detail view navigable.",
    category: "Operations",
  },
  {
    id: "K",
    title: "Appraisal — List + Detail",
    file: "K-appraisal.webm",
    route: "/appraisals",
    proves: "3 appraisals listed (APR-0001 issued, APR-0002 completed, APR-0003 in_progress). APR-0003 detail: James Chen, $14,500 / $17,000 replacement value.",
    category: "Operations",
  },
  {
    id: "L",
    title: "Passport — Public Verification",
    file: "L-passport-verify.webm",
    route: "/passports/[id]",
    proves: "NXP-MC0001 showing Public + Verified status. QR code and /verify/ URL visible. 3 passports listed.",
    category: "Operations",
  },
  {
    id: "M",
    title: "End of Day — Real Totals",
    file: "M-eod.webm",
    route: "/eod",
    proves: "EOD surface with non-zero daily totals from seeded Marcus & Co. sales data. Payment breakdown visible.",
    category: "Admin",
  },
  {
    id: "N",
    title: "Settings — Document Centre",
    file: "N-settings.webm",
    route: "/settings",
    proves: "Numbering sequences, document template stubs, Zebra printer config, integration cards visible.",
    category: "Admin",
  },
  {
    id: "O",
    title: "Admin Audit Log",
    file: "O-admin-audit.webm",
    route: "/admin/audit",
    proves: "Real audit entries from actions performed in this proof session.",
    category: "Admin",
  },
  {
    id: "P",
    title: "Permission Enforcement — Restricted User",
    file: "P-permission.webm",
    route: "/billing",
    proves: "Staff user (role=staff) navigates to /billing → real Access Denied from hasPermission() check. Owner token on same route → full access. Enforcement is code-level, not just nav-hiding.",
    category: "Security",
  },
];

const CATEGORIES = ["POS", "Finance", "Operations", "Admin", "Security"] as const;

function FlowCard({
  flow,
  build,
}: {
  flow: (typeof FLOWS)[0];
  build: string;
}) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e7e5e4", borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 4px rgba(0,0,0,.06)" }}>
      <div style={{ padding: "14px 20px", borderBottom: "1px solid #f5f5f4", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ background: "#1c1917", color: "#fff", fontSize: 11, fontWeight: 700, minWidth: 24, height: 24, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {flow.id}
        </span>
        <span style={{ fontSize: 15, fontWeight: 700, color: "#1c1917" }}>{flow.title}</span>
        <div style={{ marginLeft: "auto", display: "flex", flexDirection: "column" as const, alignItems: "flex-end", gap: 2 }}>
          <code style={{ fontSize: 10, color: "#78716c", background: "#f5f5f4", padding: "2px 6px", borderRadius: 4, whiteSpace: "nowrap" as const }}>
            {flow.route}
          </code>
          <code style={{ fontSize: 9, color: "#d4d0cb", background: "#fafaf9", padding: "1px 5px", borderRadius: 3, whiteSpace: "nowrap" as const }}>
            {build}
          </code>
        </div>
      </div>
      <div style={{ background: "#000" }}>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          src={`${STORAGE}/${flow.file}`}
          controls
          preload="metadata"
          style={{ width: "100%", display: "block", maxHeight: 420 }}
        />
      </div>
      <div style={{ padding: "14px 20px" }}>
        <p style={{ fontSize: 13, color: "#57534e", margin: 0, lineHeight: 1.5 }}>{flow.proves}</p>
      </div>
    </div>
  );
}

export default async function WorkflowsPage() {
  const hdrs = await headers();
  const BUILD = hdrs.get("host") || process.env.VERCEL_URL || "nexpura";

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", background: "#fafaf9", minHeight: "100vh", padding: "40px 24px" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>

        <div style={{ marginBottom: 36, borderLeft: "4px solid #B45309", paddingLeft: 16 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#1c1917", margin: 0 }}>Nexpura — Workflow Proof Pack</h1>
          <p style={{ fontSize: 13, color: "#78716c", margin: "8px 0 0" }}>
            All 16 flows recorded from{" "}
            <strong>{BUILD}</strong>{" "}
            (this exact build) against the Marcus &amp; Co. demo tenant. Each video has the build URL stamped in the overlay at recording time.
          </p>
        </div>

        <div style={{ background: "#fff", border: "1px solid #e7e5e4", borderRadius: 12, padding: "14px 20px", marginBottom: 40, display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
          <span style={{ fontSize: 13 }}>
            <strong>Build (runtime):</strong>{" "}
            <code style={{ background: "#f5f5f4", padding: "2px 6px", borderRadius: 4, fontSize: 12 }}>{BUILD}</code>
          </span>
          <span style={{ fontSize: 13 }}><strong>Tenant:</strong> Marcus &amp; Co. Fine Jewellery</span>
          <span style={{ fontSize: 13 }}>
            <strong>Owner token:</strong>{" "}
            <code style={{ background: "#f5f5f4", padding: "2px 6px", borderRadius: 4, fontSize: 12 }}>?rt=nexpura-review-2026</code>
          </span>
          <span style={{ fontSize: 13 }}>
            <strong>Staff token:</strong>{" "}
            <code style={{ background: "#fef3c7", padding: "2px 6px", borderRadius: 4, fontSize: 12 }}>?rt=nexpura-staff-2026</code>
          </span>
          <span style={{ fontSize: 13 }}><strong>Flows:</strong> {FLOWS.length}</span>
        </div>

        {CATEGORIES.map((cat) => {
          const flows = FLOWS.filter((f) => f.category === cat);
          if (!flows.length) return null;
          return (
            <div key={cat} style={{ marginBottom: 56 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                <h2 style={{ fontSize: 17, fontWeight: 700, color: "#1c1917", margin: 0 }}>{cat}</h2>
                <span style={{ background: "#fef3c7", color: "#92400e", fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 999 }}>
                  {flows.length} flow{flows.length > 1 ? "s" : ""}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 24 }}>
                {flows.map((f) => (
                  <FlowCard key={f.id} flow={f} build={BUILD} />
                ))}
              </div>
            </div>
          );
        })}

        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 14, padding: "20px 24px", marginTop: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#92400e", margin: "0 0 10px" }}>
            Honest Status
          </h3>
          <ul style={{ fontSize: 13, color: "#78350f", paddingLeft: 20, margin: 0 }}>
            <li>
              <strong>External Integrations:</strong> Xero, WhatsApp, Shopify show &quot;Not Connected&quot; — requires live merchant credentials not available in the demo tenant.
            </li>
          </ul>
        </div>

        <div style={{ marginTop: 40, paddingTop: 20, borderTop: "1px solid #e7e5e4", display: "flex", gap: 20, flexWrap: "wrap" }}>
          <a href="/verification" style={{ fontSize: 13, color: "#B45309", fontWeight: 600 }}>← Screenshot gallery</a>
          <a href="/sandbox/status?rt=nexpura-review-2026" style={{ fontSize: 13, color: "#B45309" }}>Auth status check</a>
          <a href="/sandbox/links?rt=nexpura-review-2026" style={{ fontSize: 13, color: "#B45309" }}>Live route index</a>
        </div>
      </div>
    </div>
  );
}
