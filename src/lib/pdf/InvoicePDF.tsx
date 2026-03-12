import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";

// Register fonts (using built-in Helvetica as fallback — Fraunces not available in react-pdf)
Font.register({
  family: "Helvetica",
  fonts: [{ src: "Helvetica" }, { src: "Helvetica-Bold", fontWeight: 700 }],
});

const FOREST = "#071A0D";
const SAGE = "#52B788";
const IVORY = "#F8F5F0";
const PLATINUM = "#E8E8E8";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    backgroundColor: "#FFFFFF",
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 48,
    fontSize: 9,
    color: FOREST,
  },
  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 32,
  },
  businessBlock: {
    flex: 1,
  },
  businessName: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: FOREST,
    marginBottom: 3,
  },
  businessMeta: {
    fontSize: 8,
    color: "#666",
    marginBottom: 1.5,
  },
  invoiceBlock: {
    alignItems: "flex-end",
  },
  invoiceTitle: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: FOREST,
    letterSpacing: 2,
    marginBottom: 3,
  },
  invoiceNumber: {
    fontSize: 11,
    color: "#555",
    marginBottom: 6,
  },
  invoiceMeta: {
    fontSize: 8,
    color: "#666",
    marginBottom: 1.5,
    textAlign: "right",
  },
  invoiceMetaLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: FOREST,
  },
  // Divider
  divider: {
    height: 1,
    backgroundColor: PLATINUM,
    marginBottom: 16,
    marginTop: 0,
  },
  // Bill To
  billToLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#999",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  billToBox: {
    backgroundColor: IVORY,
    borderRadius: 6,
    padding: 10,
    borderWidth: 0.5,
    borderColor: PLATINUM,
    marginBottom: 20,
  },
  billToName: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: FOREST,
    marginBottom: 2,
  },
  billToDetail: {
    fontSize: 8,
    color: "#666",
    marginBottom: 1,
  },
  // Table
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1.5,
    borderBottomColor: FOREST,
    paddingBottom: 5,
    marginBottom: 0,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: PLATINUM,
  },
  tableRowAlt: {
    backgroundColor: "#FAFAF8",
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
    width: 64,
    textAlign: "right",
    paddingRight: 8,
  },
  colDisc: {
    width: 40,
    textAlign: "right",
    paddingRight: 8,
  },
  colTotal: {
    width: 64,
    textAlign: "right",
  },
  colHeaderText: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: FOREST,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  colBodyText: {
    fontSize: 9,
    color: FOREST,
  },
  colBodyMuted: {
    fontSize: 9,
    color: "#666",
  },
  // Totals
  totalsSection: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 12,
    marginBottom: 20,
  },
  totalsBox: {
    width: 200,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2.5,
  },
  totalsLabel: {
    fontSize: 8.5,
    color: "#666",
  },
  totalsValue: {
    fontSize: 8.5,
    color: FOREST,
  },
  totalsDivider: {
    height: 1,
    backgroundColor: PLATINUM,
    marginVertical: 4,
  },
  totalsDividerDark: {
    height: 1.5,
    backgroundColor: FOREST,
    marginVertical: 4,
  },
  grandTotalLabel: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: FOREST,
  },
  grandTotalValue: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: FOREST,
  },
  amountDueLabel: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: FOREST,
  },
  amountDueValue: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: SAGE,
  },
  amountPaidLabel: {
    fontSize: 8.5,
    color: SAGE,
  },
  amountPaidValue: {
    fontSize: 8.5,
    color: SAGE,
  },
  // Notes / bank
  sectionLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#999",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 4,
    marginTop: 12,
  },
  sectionText: {
    fontSize: 8.5,
    color: "#555",
    lineHeight: 1.5,
  },
  // Footer
  footer: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    textAlign: "center",
  },
  footerText: {
    fontSize: 7,
    color: "#bbb",
    letterSpacing: 0.5,
  },
});

function fmt(amount: number, currency = "AUD"): string {
  try {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency,
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
      mobile: string | null;
      address_line1: string | null;
      suburb: string | null;
      state: string | null;
      postcode: string | null;
    } | null;
  };
  lineItems: Array<{
    id: string;
    description: string;
    quantity: number;
    unit_price: number;
    discount_pct: number;
    total: number;
  }>;
  tenant: {
    name: string | null;
    business_name: string | null;
    abn: string | null;
    logo_url: string | null;
    bank_name: string | null;
    bank_bsb: string | null;
    bank_account: string | null;
    address_line1: string | null;
    suburb: string | null;
    state: string | null;
    postcode: string | null;
    phone: string | null;
    email: string | null;
  } | null;
}

export function InvoicePDF({ invoice, lineItems, tenant }: InvoicePDFProps) {
  const businessName = tenant?.business_name || tenant?.name || "Your Business";
  const currency = "AUD";

  const businessAddress = [
    tenant?.address_line1,
    tenant?.suburb,
    tenant?.state,
    tenant?.postcode,
  ]
    .filter(Boolean)
    .join(", ");

  const customerAddress = [
    invoice.customers?.address_line1,
    invoice.customers?.suburb,
    invoice.customers?.state,
    invoice.customers?.postcode,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ── Header ──────────────────────────────────────────── */}
        <View style={styles.header}>
          {/* Business info */}
          <View style={styles.businessBlock}>
            <Text style={styles.businessName}>{businessName}</Text>
            {tenant?.abn && (
              <Text style={styles.businessMeta}>ABN: {tenant.abn}</Text>
            )}
            {businessAddress && (
              <Text style={styles.businessMeta}>{businessAddress}</Text>
            )}
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
          </View>
        </View>

        <View style={styles.divider} />

        {/* ── Bill To ─────────────────────────────────────────── */}
        <Text style={styles.billToLabel}>Bill To</Text>
        <View style={styles.billToBox}>
          <Text style={styles.billToName}>{invoice.customers?.full_name || "—"}</Text>
          {invoice.customers?.email && (
            <Text style={styles.billToDetail}>{invoice.customers.email}</Text>
          )}
          {(invoice.customers?.phone || invoice.customers?.mobile) && (
            <Text style={styles.billToDetail}>
              {invoice.customers.phone || invoice.customers.mobile}
            </Text>
          )}
          {customerAddress && (
            <Text style={styles.billToDetail}>{customerAddress}</Text>
          )}
        </View>

        {/* ── Line Items Table ─────────────────────────────────── */}
        <View style={styles.tableHeader}>
          <Text style={[styles.colDesc, styles.colHeaderText]}>Description</Text>
          <Text style={[styles.colQty, styles.colHeaderText]}>Qty</Text>
          <Text style={[styles.colPrice, styles.colHeaderText]}>Unit Price</Text>
          <Text style={[styles.colDisc, styles.colHeaderText]}>Disc</Text>
          <Text style={[styles.colTotal, styles.colHeaderText]}>Total</Text>
        </View>

        {lineItems.map((item, idx) => (
          <View
            key={item.id}
            style={[styles.tableRow, idx % 2 !== 0 ? styles.tableRowAlt : {}]}
          >
            <Text style={[styles.colDesc, styles.colBodyText]}>
              {item.description}
            </Text>
            <Text style={[styles.colQty, styles.colBodyMuted]}>
              {item.quantity}
            </Text>
            <Text style={[styles.colPrice, styles.colBodyMuted]}>
              {fmt(item.unit_price, currency)}
            </Text>
            <Text style={[styles.colDisc, styles.colBodyMuted]}>
              {item.discount_pct > 0 ? `${item.discount_pct}%` : "—"}
            </Text>
            <Text style={[styles.colTotal, styles.colBodyText]}>
              {fmt(item.total, currency)}
            </Text>
          </View>
        ))}

        {/* ── Totals ──────────────────────────────────────────── */}
        <View style={styles.totalsSection}>
          <View style={styles.totalsBox}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Subtotal</Text>
              <Text style={styles.totalsValue}>{fmt(invoice.subtotal, currency)}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>
                {invoice.tax_name} ({(invoice.tax_rate * 100).toFixed(0)}%
                {invoice.tax_inclusive ? " incl." : ""})
              </Text>
              <Text style={styles.totalsValue}>{fmt(invoice.tax_amount, currency)}</Text>
            </View>
            {invoice.discount_amount > 0 && (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Discount</Text>
                <Text style={styles.totalsValue}>−{fmt(invoice.discount_amount, currency)}</Text>
              </View>
            )}
            <View style={styles.totalsDividerDark} />
            <View style={styles.totalsRow}>
              <Text style={styles.grandTotalLabel}>Total</Text>
              <Text style={styles.grandTotalValue}>{fmt(invoice.total, currency)}</Text>
            </View>
            {invoice.amount_paid > 0 && (
              <>
                <View style={styles.totalsDivider} />
                <View style={styles.totalsRow}>
                  <Text style={styles.amountPaidLabel}>Amount Paid</Text>
                  <Text style={styles.amountPaidValue}>{fmt(invoice.amount_paid, currency)}</Text>
                </View>
                <View style={styles.totalsDivider} />
                <View style={styles.totalsRow}>
                  <Text style={styles.amountDueLabel}>Amount Due</Text>
                  <Text style={styles.amountDueValue}>{fmt(invoice.amount_due, currency)}</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* ── Bank Details ─────────────────────────────────────── */}
        {(tenant?.bank_name || tenant?.bank_bsb || tenant?.bank_account) && (
          <>
            <View style={styles.divider} />
            <Text style={styles.sectionLabel}>Payment Details</Text>
            {tenant.bank_name && (
              <Text style={styles.sectionText}>Bank: {tenant.bank_name}</Text>
            )}
            {tenant.bank_bsb && (
              <Text style={styles.sectionText}>BSB: {tenant.bank_bsb}</Text>
            )}
            {tenant.bank_account && (
              <Text style={styles.sectionText}>Account: {tenant.bank_account}</Text>
            )}
          </>
        )}

        {/* ── Notes ────────────────────────────────────────────── */}
        {invoice.footer_text && (
          <>
            <Text style={styles.sectionLabel}>Payment Instructions</Text>
            <Text style={styles.sectionText}>{invoice.footer_text}</Text>
          </>
        )}
        {invoice.notes && (
          <>
            <Text style={styles.sectionLabel}>Notes</Text>
            <Text style={styles.sectionText}>{invoice.notes}</Text>
          </>
        )}

        {/* ── Footer ───────────────────────────────────────────── */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Generated by Nexpura · nexpura.com</Text>
        </View>
      </Page>
    </Document>
  );
}
