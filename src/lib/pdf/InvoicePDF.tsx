import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";

const BRONZE = "amber-700";
const DARK = "#1A1A1A";
const LIGHT_BG = "#FAFAF9";
const PLATINUM = "#E5E2DE";
const MUTED = "#888";
const GREEN = "#2D7A4A";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    backgroundColor: "#FFFFFF",
    paddingTop: 44,
    paddingBottom: 60,
    paddingHorizontal: 44,
    fontSize: 9,
    color: DARK,
  },
  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  businessBlock: {
    flex: 1,
    paddingRight: 24,
  },
  logo: {
    width: 56,
    height: 56,
    objectFit: "contain",
    marginBottom: 6,
  },
  businessName: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: DARK,
    marginBottom: 2,
  },
  businessMeta: {
    fontSize: 8,
    color: MUTED,
    marginBottom: 1.5,
  },
  invoiceBlock: {
    alignItems: "flex-end",
    justifyContent: "flex-start",
  },
  invoiceTitle: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    color: BRONZE,
    letterSpacing: 1,
    marginBottom: 4,
  },
  invoiceNumber: {
    fontSize: 12,
    color: DARK,
    fontFamily: "Helvetica-Bold",
    marginBottom: 8,
  },
  invoiceMeta: {
    fontSize: 8,
    color: MUTED,
    marginBottom: 2,
    textAlign: "right",
  },
  invoiceMetaLabel: {
    fontFamily: "Helvetica-Bold",
    color: DARK,
  },
  paidBadge: {
    backgroundColor: GREEN,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4,
  },
  paidBadgeText: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  // Divider
  divider: {
    height: 1,
    backgroundColor: PLATINUM,
    marginBottom: 16,
    marginTop: 4,
  },
  dividerBronze: {
    height: 1.5,
    backgroundColor: BRONZE,
    marginBottom: 16,
    marginTop: 0,
  },
  // Bill To
  billToSection: {
    marginBottom: 20,
  },
  billToLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: MUTED,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  billToBox: {
    backgroundColor: LIGHT_BG,
    borderRadius: 5,
    padding: 10,
    borderWidth: 0.5,
    borderColor: PLATINUM,
  },
  billToName: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: DARK,
    marginBottom: 2,
  },
  billToDetail: {
    fontSize: 8,
    color: MUTED,
    marginBottom: 1.5,
  },
  // Table
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1.5,
    borderBottomColor: DARK,
    paddingBottom: 5,
    marginBottom: 0,
    backgroundColor: LIGHT_BG,
    paddingHorizontal: 4,
    paddingTop: 4,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: PLATINUM,
    paddingHorizontal: 4,
  },
  tableRowAlt: {
    backgroundColor: LIGHT_BG,
  },
  colDesc: {
    flex: 1,
    paddingRight: 8,
  },
  colQty: {
    width: 36,
    textAlign: "right",
    paddingRight: 8,
  },
  colPrice: {
    width: 68,
    textAlign: "right",
    paddingRight: 8,
  },
  colTotal: {
    width: 68,
    textAlign: "right",
  },
  colHeaderText: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: DARK,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  colBodyText: {
    fontSize: 9,
    color: DARK,
  },
  colBodyMuted: {
    fontSize: 9,
    color: MUTED,
  },
  // Totals
  totalsSection: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 12,
    marginBottom: 16,
  },
  totalsBox: {
    width: 210,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2.5,
  },
  totalsLabel: {
    fontSize: 8.5,
    color: MUTED,
  },
  totalsValue: {
    fontSize: 8.5,
    color: DARK,
  },
  totalsDivider: {
    height: 0.5,
    backgroundColor: PLATINUM,
    marginVertical: 4,
  },
  totalsDividerDark: {
    height: 1.5,
    backgroundColor: DARK,
    marginVertical: 4,
  },
  grandTotalLabel: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: DARK,
  },
  grandTotalValue: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: BRONZE,
  },
  // Paid stamp
  paidStamp: {
    backgroundColor: "#E8F5EC",
    borderWidth: 1.5,
    borderColor: GREEN,
    borderRadius: 6,
    padding: 10,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  paidStampText: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: GREEN,
  },
  // Bank details
  bankSection: {
    backgroundColor: LIGHT_BG,
    borderRadius: 5,
    padding: 10,
    borderWidth: 0.5,
    borderColor: PLATINUM,
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: MUTED,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 5,
  },
  bankRow: {
    flexDirection: "row",
    marginBottom: 2,
  },
  bankLabel: {
    fontSize: 8,
    color: MUTED,
    width: 60,
  },
  bankValue: {
    fontSize: 8,
    color: DARK,
    fontFamily: "Helvetica-Bold",
  },
  // Notes
  notesBox: {
    marginBottom: 12,
  },
  noteText: {
    fontSize: 8.5,
    color: "#555",
    lineHeight: 1.5,
  },
  // Footer
  footer: {
    position: "absolute",
    bottom: 24,
    left: 44,
    right: 44,
    textAlign: "center",
    borderTopWidth: 0.5,
    borderTopColor: PLATINUM,
    paddingTop: 8,
  },
  footerText: {
    fontSize: 7,
    color: "#bbb",
    letterSpacing: 0.3,
    textAlign: "center",
  },
});

function fmt(amount: number): string {
  try {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  try {
    return new Date(d.includes("T") ? d : d + "T00:00:00").toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

export interface InvoicePDFProps {
  invoice: {
    id: string;
    invoice_number: string;
    status: string;
    invoice_date: string;
    due_date: string | null;
    paid_at: string | null;
    subtotal: number;
    tax_amount: number;
    discount_amount: number;
    total: number;
    amount_paid: number;
    amount_due: number;
    tax_name: string;
    tax_rate: number;
    tax_inclusive: boolean;
    notes: string | null;
    footer_text: string | null;
    customers: {
      full_name: string | null;
      email: string | null;
      phone: string | null;
      address: string | null;
    } | null;
  };
  lineItems: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    discount_pct?: number;
    total: number;
  }>;
  tenant: {
    name: string;
    business_name: string | null;
    abn: string | null;
    logo_url: string | null;
    phone: string | null;
    email: string | null;
    address_line1: string | null;
    suburb: string | null;
    state: string | null;
    postcode: string | null;
    bank_name: string | null;
    bank_bsb: string | null;
    bank_account: string | null;
    invoice_footer: string | null;
  } | null;
}

export function InvoicePDF({ invoice, lineItems, tenant }: InvoicePDFProps) {
  const businessName = tenant?.business_name || tenant?.name || "Your Business";
  const isPaid = invoice.status === "paid";

  const businessAddress = [
    tenant?.address_line1,
    tenant?.suburb,
    tenant?.state,
    tenant?.postcode,
  ]
    .filter(Boolean)
    .join(", ");

  const footerText = invoice.footer_text || tenant?.invoice_footer || null;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ── Header ──────────────────────────────────────────── */}
        <View style={styles.header}>
          {/* Business info */}
          <View style={styles.businessBlock}>
            {tenant?.logo_url ? (
              <Image src={tenant.logo_url} style={styles.logo} />
            ) : null}
            <Text style={styles.businessName}>{businessName}</Text>
            {tenant?.abn && (
              <Text style={styles.businessMeta}>ABN: {tenant.abn}</Text>
            )}
            {businessAddress ? (
              <Text style={styles.businessMeta}>{businessAddress}</Text>
            ) : null}
            {tenant?.phone && (
              <Text style={styles.businessMeta}>{tenant.phone}</Text>
            )}
            {tenant?.email && (
              <Text style={styles.businessMeta}>{tenant.email}</Text>
            )}
          </View>

          {/* Invoice details */}
          <View style={styles.invoiceBlock}>
            <Text style={styles.invoiceTitle}>TAX INVOICE</Text>
            <Text style={styles.invoiceNumber}>{invoice.invoice_number}</Text>
            <Text style={styles.invoiceMeta}>
              <Text style={styles.invoiceMetaLabel}>Issued: </Text>
              {fmtDate(invoice.invoice_date)}
            </Text>
            {invoice.due_date && (
              <Text style={styles.invoiceMeta}>
                <Text style={styles.invoiceMetaLabel}>Due: </Text>
                {fmtDate(invoice.due_date)}
              </Text>
            )}
            {isPaid && (
              <View style={styles.paidBadge}>
                <Text style={styles.paidBadgeText}>✓ PAID</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.dividerBronze} />

        {/* ── Bill To ─────────────────────────────────────────── */}
        <View style={styles.billToSection}>
          <Text style={styles.billToLabel}>Bill To</Text>
          <View style={styles.billToBox}>
            <Text style={styles.billToName}>
              {invoice.customers?.full_name || "—"}
            </Text>
            {invoice.customers?.email ? (
              <Text style={styles.billToDetail}>{invoice.customers.email}</Text>
            ) : null}
            {invoice.customers?.phone ? (
              <Text style={styles.billToDetail}>{invoice.customers.phone}</Text>
            ) : null}
            {invoice.customers?.address ? (
              <Text style={styles.billToDetail}>{invoice.customers.address}</Text>
            ) : null}
          </View>
        </View>

        {/* ── Line Items Table ─────────────────────────────────── */}
        <View style={styles.tableHeader}>
          <Text style={[styles.colDesc, styles.colHeaderText]}>Description</Text>
          <Text style={[styles.colQty, styles.colHeaderText]}>Qty</Text>
          <Text style={[styles.colPrice, styles.colHeaderText]}>Unit Price</Text>
          <Text style={[styles.colTotal, styles.colHeaderText]}>Amount</Text>
        </View>

        {lineItems.map((item, idx) => (
          <View
            key={idx}
            style={[styles.tableRow, idx % 2 !== 0 ? styles.tableRowAlt : {}]}
          >
            <Text style={[styles.colDesc, styles.colBodyText]}>
              {item.description}
              {(item.discount_pct ?? 0) > 0
                ? ` (${item.discount_pct}% off)`
                : ""}
            </Text>
            <Text style={[styles.colQty, styles.colBodyMuted]}>
              {item.quantity}
            </Text>
            <Text style={[styles.colPrice, styles.colBodyMuted]}>
              {fmt(item.unit_price)}
            </Text>
            <Text style={[styles.colTotal, styles.colBodyText]}>
              {fmt(item.total)}
            </Text>
          </View>
        ))}

        {/* ── Totals ──────────────────────────────────────────── */}
        <View style={styles.totalsSection}>
          <View style={styles.totalsBox}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Subtotal</Text>
              <Text style={styles.totalsValue}>{fmt(invoice.subtotal)}</Text>
            </View>
            {invoice.discount_amount > 0 && (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Discount</Text>
                <Text style={styles.totalsValue}>
                  −{fmt(invoice.discount_amount)}
                </Text>
              </View>
            )}
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>
                {invoice.tax_name || "GST"} (
                {(invoice.tax_rate * 100).toFixed(0)}%
                {invoice.tax_inclusive ? " incl." : ""})
              </Text>
              <Text style={styles.totalsValue}>{fmt(invoice.tax_amount)}</Text>
            </View>
            <View style={styles.totalsDividerDark} />
            <View style={styles.totalsRow}>
              <Text style={styles.grandTotalLabel}>TOTAL</Text>
              <Text style={styles.grandTotalValue}>{fmt(invoice.total)}</Text>
            </View>
          </View>
        </View>

        {/* ── Paid stamp ──────────────────────────────────────── */}
        {isPaid && invoice.paid_at ? (
          <View style={styles.paidStamp}>
            <Text style={styles.paidStampText}>
              ✓ PAID on {fmtDate(invoice.paid_at)}
            </Text>
          </View>
        ) : null}

        {/* ── Bank Details ─────────────────────────────────────── */}
        {(tenant?.bank_name || tenant?.bank_bsb || tenant?.bank_account) && !isPaid ? (
          <>
            <Text style={styles.sectionLabel}>Payment Details</Text>
            <View style={styles.bankSection}>
              {tenant?.bank_name ? (
                <View style={styles.bankRow}>
                  <Text style={styles.bankLabel}>Bank</Text>
                  <Text style={styles.bankValue}>{tenant.bank_name}</Text>
                </View>
              ) : null}
              {tenant?.bank_bsb ? (
                <View style={styles.bankRow}>
                  <Text style={styles.bankLabel}>BSB</Text>
                  <Text style={styles.bankValue}>{tenant.bank_bsb}</Text>
                </View>
              ) : null}
              {tenant?.bank_account ? (
                <View style={styles.bankRow}>
                  <Text style={styles.bankLabel}>Account</Text>
                  <Text style={styles.bankValue}>{tenant.bank_account}</Text>
                </View>
              ) : null}
              <View style={styles.bankRow}>
                <Text style={styles.bankLabel}>Reference</Text>
                <Text style={styles.bankValue}>{invoice.invoice_number}</Text>
              </View>
            </View>
          </>
        ) : null}

        {/* ── Notes ────────────────────────────────────────────── */}
        {invoice.notes ? (
          <View style={styles.notesBox}>
            <Text style={styles.sectionLabel}>Notes</Text>
            <Text style={styles.noteText}>{invoice.notes}</Text>
          </View>
        ) : null}

        {/* ── Footer ───────────────────────────────────────────── */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {footerText
              ? footerText
              : `Thank you for your business · Issued by ${businessName} · Powered by Nexpura`}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
