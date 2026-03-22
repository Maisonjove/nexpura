import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";

export type InvoiceLayout = "classic" | "modern" | "minimal";

const DARK = "#1A1A1A";
const LIGHT_BG = "#FAFAF9";
const PLATINUM = "#E5E2DE";
const MUTED = "#888";
const GREEN = "#2D7A4A";

const getStyles = (accent: string, layout: InvoiceLayout) =>
  ({
    page: {
      fontFamily: "Helvetica",
      backgroundColor: "#FFFFFF",
      paddingBottom: 60,
      paddingHorizontal: layout === "minimal" ? 52 : 44,
      paddingTop: layout === "modern" ? 0 : layout === "minimal" ? 52 : 44,
      fontSize: 9,
      color: DARK,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: layout === "minimal" ? 36 : 24,
    },
    headerBand: {
      backgroundColor: DARK,
      paddingHorizontal: 44,
      paddingVertical: 28,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    bodyPad: {
      paddingHorizontal: layout === "modern" ? 44 : 0,
      paddingTop: layout === "modern" ? 28 : 0,
    },
    businessBlock: { flex: 1, paddingRight: 24 },
    logo: {
      width: layout === "minimal" ? 36 : layout === "modern" ? 44 : 56,
      height: layout === "minimal" ? 36 : layout === "modern" ? 44 : 56,
      objectFit: "contain",
      marginBottom: layout === "minimal" ? 10 : 6,
    },
    businessName: {
      fontSize: layout === "modern" ? 15 : layout === "minimal" ? 9 : 14,
      fontFamily: "Helvetica-Bold",
      color: layout === "modern" ? "#FFFFFF" : layout === "minimal" ? "#999999" : DARK,
      marginBottom: 2,
      letterSpacing: layout === "minimal" ? 2 : 0,
      textTransform: layout === "minimal" ? "uppercase" : "none",
    },
    businessMeta: {
      fontSize: 8,
      color: layout === "modern" ? "#AAAAAA" : layout === "minimal" ? "#BBBBBB" : MUTED,
      marginBottom: 1.5,
    },
    invoiceBlock: { alignItems: "flex-end" },
    invoiceTitle: {
      fontSize: layout === "minimal" ? 8 : layout === "modern" ? 20 : 24,
      fontFamily: "Helvetica-Bold",
      color: accent,
      letterSpacing: layout === "minimal" ? 3 : layout === "modern" ? 2 : 1,
      marginBottom: layout === "minimal" ? 6 : 4,
      textTransform: layout === "minimal" ? "uppercase" : "none",
    },
    invoiceNumber: {
      fontSize: layout === "minimal" ? 22 : 12,
      color: layout === "modern" ? "#FFFFFF" : DARK,
      fontFamily: "Helvetica-Bold",
      marginBottom: 8,
    },
    invoiceMeta: {
      fontSize: 8,
      color: layout === "modern" ? "#AAAAAA" : MUTED,
      marginBottom: 2,
      textAlign: "right",
    },
    invoiceMetaLabel: {
      fontFamily: "Helvetica-Bold",
      color: layout === "modern" ? "#DDDDDD" : DARK,
    },
    paidBadge: {
      backgroundColor: layout === "minimal" ? "transparent" : GREEN,
      borderWidth: layout === "minimal" ? 1 : 0,
      borderColor: GREEN,
      borderRadius: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      marginTop: 4,
    },
    paidBadgeText: {
      fontSize: 8,
      fontFamily: "Helvetica-Bold",
      color: layout === "minimal" ? GREEN : "#FFFFFF",
      letterSpacing: 0.5,
    },
    accentDivider: {
      height: layout === "minimal" ? 0.5 : 1.5,
      backgroundColor: layout === "minimal" ? "#DDDDDD" : accent,
      marginBottom: 16,
    },
    billToSection: { marginBottom: layout === "minimal" ? 28 : 20 },
    billToLabel: {
      fontSize: 7,
      fontFamily: "Helvetica-Bold",
      color: layout === "modern" ? accent : layout === "minimal" ? "#BBBBBB" : MUTED,
      letterSpacing: layout === "modern" ? 2 : 1.5,
      textTransform: "uppercase",
      marginBottom: 6,
    },
    billToBox: {
      backgroundColor: layout === "classic" ? LIGHT_BG : "transparent",
      borderRadius: layout === "classic" ? 5 : 0,
      padding: layout === "classic" ? 10 : 0,
      borderWidth: layout === "classic" ? 0.5 : 0,
      borderColor: PLATINUM,
    },
    billToName: {
      fontSize: layout === "classic" ? 11 : 12,
      fontFamily: "Helvetica-Bold",
      color: DARK,
      marginBottom: 2,
    },
    billToDetail: { fontSize: 8, color: MUTED, marginBottom: 1.5 },
    tableHeader: {
      flexDirection: "row",
      borderBottomWidth: layout === "modern" ? 2 : 0.5,
      borderBottomColor: layout === "modern" ? accent : layout === "minimal" ? "#AAAAAA" : DARK,
      paddingBottom: 5,
      backgroundColor: layout === "classic" ? LIGHT_BG : "transparent",
      paddingHorizontal: layout === "classic" ? 4 : 0,
      paddingTop: layout === "classic" ? 4 : 0,
    },
    tableRow: {
      flexDirection: "row",
      paddingVertical: layout === "minimal" ? 7 : 5,
      borderBottomWidth: 0.5,
      borderBottomColor: layout === "minimal" ? "#EEEEEE" : PLATINUM,
      paddingHorizontal: layout === "classic" ? 4 : 0,
    },
    tableRowAlt: { backgroundColor: layout === "classic" ? LIGHT_BG : "transparent" },
    colDesc: { flex: 1, paddingRight: 8 },
    colQty: { width: 36, textAlign: "right", paddingRight: 8 },
    colPrice: { width: 68, textAlign: "right", paddingRight: 8 },
    colTotal: { width: 68, textAlign: "right" },
    colHeaderText: {
      fontSize: 7,
      fontFamily: "Helvetica-Bold",
      color: layout === "modern" ? accent : layout === "minimal" ? "#AAAAAA" : DARK,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    colBodyText: { fontSize: 9, color: DARK },
    colBodyMuted: { fontSize: 9, color: MUTED },
    totalsSection: { flexDirection: "row", justifyContent: "flex-end", marginTop: 12, marginBottom: 16 },
    totalsBox: { width: 210 },
    totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2.5 },
    totalsLabel: { fontSize: 8.5, color: layout === "minimal" ? "#AAAAAA" : MUTED },
    totalsValue: { fontSize: 8.5, color: DARK },
    totalsDivider: {
      height: layout === "minimal" ? 0.5 : 1.5,
      backgroundColor: layout === "minimal" ? "#DDDDDD" : DARK,
      marginVertical: 4,
    },
    grandTotalRow: {
      backgroundColor: layout === "modern" ? DARK : "transparent",
      borderRadius: layout === "modern" ? 4 : 0,
      paddingHorizontal: layout === "modern" ? 8 : 0,
      paddingVertical: layout === "modern" ? 8 : 2.5,
      marginTop: layout === "modern" ? 8 : 0,
      flexDirection: "row",
      justifyContent: "space-between",
    },
    grandTotalLabel: {
      fontSize: layout === "minimal" ? 11 : 12,
      fontFamily: "Helvetica-Bold",
      color: layout === "modern" ? "#FFFFFF" : DARK,
    },
    grandTotalValue: {
      fontSize: layout === "minimal" ? 11 : 12,
      fontFamily: "Helvetica-Bold",
      color: accent,
    },
    amountPaidLabel: { fontSize: 9, color: GREEN },
    amountPaidValue: { fontSize: 9, fontFamily: "Helvetica-Bold", color: GREEN },
    balanceDueRow: {
      backgroundColor: layout === "minimal" ? "transparent" : layout === "modern" ? DARK : "#FEF3C7",
      borderTopWidth: layout === "minimal" ? 1 : 0,
      borderTopColor: accent,
      borderRadius: layout === "minimal" ? 0 : 4,
      padding: layout === "minimal" ? 0 : 6,
      paddingTop: 6,
      marginTop: 4,
      flexDirection: "row",
      justifyContent: "space-between",
    },
    balanceDueLabel: { fontSize: layout === "minimal" ? 10 : 11, fontFamily: "Helvetica-Bold", color: accent },
    balanceDueValue: { fontSize: layout === "minimal" ? 10 : 11, fontFamily: "Helvetica-Bold", color: accent },
    paidStamp: {
      backgroundColor: layout === "minimal" ? "transparent" : "#E8F5EC",
      borderWidth: layout === "minimal" ? 1 : 1.5,
      borderColor: GREEN,
      borderRadius: layout === "minimal" ? 2 : 6,
      padding: layout === "minimal" ? 8 : 10,
      marginBottom: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    paidStampText: { fontSize: layout === "minimal" ? 9 : 10, fontFamily: "Helvetica-Bold", color: GREEN },
    bankSection: {
      backgroundColor: layout === "minimal" ? "transparent" : LIGHT_BG,
      borderRadius: layout === "minimal" ? 0 : 5,
      padding: layout === "minimal" ? 0 : 10,
      borderWidth: layout === "minimal" ? 0 : 0.5,
      borderColor: PLATINUM,
      marginBottom: 12,
    },
    sectionLabel: {
      fontSize: 7,
      fontFamily: "Helvetica-Bold",
      color: layout === "minimal" ? "#BBBBBB" : MUTED,
      letterSpacing: 1.5,
      textTransform: "uppercase",
      marginBottom: 5,
    },
    bankRow: { flexDirection: "row", marginBottom: 2 },
    bankLabel: { fontSize: 8, color: MUTED, width: 60 },
    bankValue: {
      fontSize: 8,
      color: DARK,
      fontFamily: layout === "minimal" ? "Helvetica" : "Helvetica-Bold",
    },
    notesBox: { marginBottom: 12 },
    noteText: { fontSize: 8.5, color: layout === "minimal" ? "#777" : "#555", lineHeight: 1.5 },
    footer: {
      position: "absolute",
      bottom: 24,
      left: layout === "minimal" ? 52 : 44,
      right: layout === "minimal" ? 52 : 44,
      borderTopWidth: 0.5,
      borderTopColor: layout === "minimal" ? "#EEEEEE" : PLATINUM,
      paddingTop: 8,
    },
    footerText: {
      fontSize: 7,
      color: layout === "minimal" ? "#CCCCCC" : "#bbb",
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
    invoice_accent_color: string | null;
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
  layout?: InvoiceLayout;
}

export function InvoicePDF({ invoice, lineItems, tenant, layout = "classic" }: InvoicePDFProps) {
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
  const accent = tenant?.invoice_accent_color || "#92400e";
  const styles = getStyles(accent, layout);

  const businessInfoJSX = (
    <View style={styles.businessBlock}>
      {tenant?.logo_url ? <Image src={tenant.logo_url} style={styles.logo} /> : null}
      <Text style={styles.businessName}>{businessName}</Text>
      {tenant?.abn && <Text style={styles.businessMeta}>ABN: {tenant.abn}</Text>}
      {businessAddress ? <Text style={styles.businessMeta}>{businessAddress}</Text> : null}
      {tenant?.phone && <Text style={styles.businessMeta}>{tenant.phone}</Text>}
      {tenant?.email && <Text style={styles.businessMeta}>{tenant.email}</Text>}
    </View>
  );

  const invoiceDetailsJSX = (
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
          <Text style={styles.paidBadgeText}>PAID</Text>
        </View>
      )}
    </View>
  );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        {layout === "modern" ? (
          <View style={styles.headerBand}>
            {businessInfoJSX}
            {invoiceDetailsJSX}
          </View>
        ) : (
          <View style={styles.header}>
            {businessInfoJSX}
            {invoiceDetailsJSX}
          </View>
        )}

        {/* Body (padded for modern since header is edge-to-edge) */}
        <View style={styles.bodyPad}>
          {/* Accent divider — classic and minimal only */}
          {layout !== "modern" && <View style={styles.accentDivider} />}

          {/* Bill To */}
          <View style={styles.billToSection}>
            <Text style={styles.billToLabel}>Bill To</Text>
            <View style={styles.billToBox}>
              <Text style={styles.billToName}>{invoice.customers?.full_name || "—"}</Text>
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

          {/* Line Items Table */}
          <View style={styles.tableHeader}>
            <Text style={[styles.colDesc, styles.colHeaderText]}>Description</Text>
            <Text style={[styles.colQty, styles.colHeaderText]}>Qty</Text>
            <Text style={[styles.colPrice, styles.colHeaderText]}>Unit Price</Text>
            <Text style={[styles.colTotal, styles.colHeaderText]}>Amount</Text>
          </View>
          {lineItems.map((item, idx) => (
            <View key={idx} style={[styles.tableRow, idx % 2 !== 0 ? styles.tableRowAlt : {}]}>
              <Text style={[styles.colDesc, styles.colBodyText]}>
                {item.description}
                {(item.discount_pct ?? 0) > 0 ? ` (${item.discount_pct}% off)` : ""}
              </Text>
              <Text style={[styles.colQty, styles.colBodyMuted]}>{item.quantity}</Text>
              <Text style={[styles.colPrice, styles.colBodyMuted]}>{fmt(item.unit_price)}</Text>
              <Text style={[styles.colTotal, styles.colBodyText]}>{fmt(item.total)}</Text>
            </View>
          ))}

          {/* Totals */}
          <View style={styles.totalsSection}>
            <View style={styles.totalsBox}>
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Subtotal</Text>
                <Text style={styles.totalsValue}>{fmt(invoice.subtotal)}</Text>
              </View>
              {invoice.discount_amount > 0 && (
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>Discount</Text>
                  <Text style={styles.totalsValue}>−{fmt(invoice.discount_amount)}</Text>
                </View>
              )}
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>
                  {invoice.tax_name || "GST"} ({(invoice.tax_rate * 100).toFixed(0)}%
                  {invoice.tax_inclusive ? " incl." : ""})
                </Text>
                <Text style={styles.totalsValue}>{fmt(invoice.tax_amount)}</Text>
              </View>
              <View style={styles.totalsDivider} />
              <View style={styles.grandTotalRow}>
                <Text style={styles.grandTotalLabel}>TOTAL</Text>
                <Text style={styles.grandTotalValue}>{fmt(invoice.total)}</Text>
              </View>
              {invoice.amount_paid > 0 && (
                <View style={styles.totalsRow}>
                  <Text style={styles.amountPaidLabel}>Amount Paid</Text>
                  <Text style={styles.amountPaidValue}>−{fmt(invoice.amount_paid)}</Text>
                </View>
              )}
              {invoice.amount_due > 0 && (
                <View style={styles.balanceDueRow}>
                  <Text style={styles.balanceDueLabel}>BALANCE DUE</Text>
                  <Text style={styles.balanceDueValue}>{fmt(invoice.amount_due)}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Paid stamp */}
          {isPaid && invoice.paid_at ? (
            <View style={styles.paidStamp}>
              <Text style={styles.paidStampText}>PAID on {fmtDate(invoice.paid_at)}</Text>
            </View>
          ) : null}

          {/* Bank Details */}
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

          {/* Notes */}
          {invoice.notes ? (
            <View style={styles.notesBox}>
              <Text style={styles.sectionLabel}>Notes</Text>
              <Text style={styles.noteText}>{invoice.notes}</Text>
            </View>
          ) : null}
        </View>

        {/* Footer */}
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
