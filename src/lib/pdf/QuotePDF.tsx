import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";

const BRONZE = "#8B7355";
const DARK = "#1A1A1A";
const LIGHT_BG = "#FAFAF9";
const PLATINUM = "#E5E2DE";
const MUTED = "#888";

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
  dividerBronze: {
    height: 1.5,
    backgroundColor: BRONZE,
    marginBottom: 16,
    marginTop: 0,
  },
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
  sectionLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: MUTED,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 5,
  },
  notesBox: {
    marginBottom: 12,
  },
  noteText: {
    fontSize: 8.5,
    color: "#555",
    lineHeight: 1.5,
  },
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

export interface QuotePDFProps {
  quote: {
    id: string;
    quote_number: string;
    status: string;
    created_at: string;
    expires_at: string | null;
    total_amount: number;
    notes: string | null;
    customers: {
      full_name: string | null;
      email: string | null;
      phone: string | null;
      address: string | null;
    } | null;
    items: Array<{
      description: string;
      quantity: number;
      unit_price: number;
    }>;
  };
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
  } | null;
}

export function QuotePDF({ quote, tenant }: QuotePDFProps) {
  const businessName = tenant?.business_name || tenant?.name || "Your Business";

  const businessAddress = [
    tenant?.address_line1,
    tenant?.suburb,
    tenant?.state,
    tenant?.postcode,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
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

          <View style={styles.invoiceBlock}>
            <Text style={styles.invoiceTitle}>QUOTE</Text>
            <Text style={styles.invoiceNumber}>{quote.quote_number || quote.id.slice(0, 8)}</Text>
            <Text style={styles.invoiceMeta}>
              <Text style={styles.invoiceMetaLabel}>Date: </Text>
              {fmtDate(quote.created_at)}
            </Text>
            {quote.expires_at && (
              <Text style={styles.invoiceMeta}>
                <Text style={styles.invoiceMetaLabel}>Expires: </Text>
                {fmtDate(quote.expires_at)}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.dividerBronze} />

        <View style={styles.billToSection}>
          <Text style={styles.billToLabel}>Quote For</Text>
          <View style={styles.billToBox}>
            <Text style={styles.billToName}>
              {quote.customers?.full_name || "—"}
            </Text>
            {quote.customers?.email ? (
              <Text style={styles.billToDetail}>{quote.customers.email}</Text>
            ) : null}
            {quote.customers?.phone ? (
              <Text style={styles.billToDetail}>{quote.customers.phone}</Text>
            ) : null}
            {quote.customers?.address ? (
              <Text style={styles.billToDetail}>{quote.customers.address}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.tableHeader}>
          <Text style={[styles.colDesc, styles.colHeaderText]}>Description</Text>
          <Text style={[styles.colQty, styles.colHeaderText]}>Qty</Text>
          <Text style={[styles.colPrice, styles.colHeaderText]}>Unit Price</Text>
          <Text style={[styles.colTotal, styles.colHeaderText]}>Amount</Text>
        </View>

        {quote.items.map((item, idx) => (
          <View
            key={idx}
            style={[styles.tableRow, idx % 2 !== 0 ? styles.tableRowAlt : {}]}
          >
            <Text style={[styles.colDesc, styles.colBodyText]}>
              {item.description}
            </Text>
            <Text style={[styles.colQty, styles.colBodyMuted]}>
              {item.quantity}
            </Text>
            <Text style={[styles.colPrice, styles.colBodyMuted]}>
              {fmt(item.unit_price)}
            </Text>
            <Text style={[styles.colTotal, styles.colBodyText]}>
              {fmt(item.quantity * item.unit_price)}
            </Text>
          </View>
        ))}

        <View style={styles.totalsSection}>
          <View style={styles.totalsBox}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Subtotal</Text>
              <Text style={styles.totalsValue}>{fmt(quote.total_amount)}</Text>
            </View>
            <View style={styles.totalsDividerDark} />
            <View style={styles.totalsRow}>
              <Text style={styles.grandTotalLabel}>TOTAL</Text>
              <Text style={styles.grandTotalValue}>{fmt(quote.total_amount)}</Text>
            </View>
          </View>
        </View>

        {quote.notes ? (
          <View style={styles.notesBox}>
            <Text style={styles.sectionLabel}>Notes</Text>
            <Text style={styles.noteText}>{quote.notes}</Text>
          </View>
        ) : null}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {`This quote is valid for 30 days · Issued by ${businessName} · Powered by Nexpura`}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
