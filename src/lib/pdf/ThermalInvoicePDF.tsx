import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";
import type { InvoicePDFProps } from "./InvoicePDF";

// Paper width mappings (mm to points, 1mm ≈ 2.83pt)
const PAPER_WIDTHS: Record<string, number> = {
  "58mm": 164,  // 58mm thermal
  "80mm": 204,  // 80mm thermal (standard)
  "57mm": 162,  // Alternative 57mm
  "76mm": 215,  // 76mm thermal
};

function getPageWidth(paperWidth?: string): number {
  if (!paperWidth) return 204; // default 80mm
  return PAPER_WIDTHS[paperWidth] || 204;
}

const H_PAD = 8;

const styles = StyleSheet.create({
  page: {
    fontFamily: "Courier",
    backgroundColor: "#FFFFFF",
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: H_PAD,
    fontSize: 8,
    color: "#000000",
    // width is set dynamically on Page component
  },
  centred: {
    textAlign: "center",
  },
  bold: {
    fontFamily: "Courier-Bold",
  },
  businessName: {
    fontFamily: "Courier-Bold",
    fontSize: 11,
    textAlign: "center",
    marginBottom: 3,
  },
  metaLine: {
    fontSize: 8,
    textAlign: "center",
    marginBottom: 1.5,
  },
  thickDivider: {
    fontSize: 8,
    textAlign: "center",
    marginVertical: 5,
  },
  thinDivider: {
    fontSize: 8,
    textAlign: "center",
    marginVertical: 3,
  },
  taxInvoice: {
    fontFamily: "Courier-Bold",
    fontSize: 10,
    textAlign: "center",
    marginVertical: 3,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 1.5,
  },
  col: {
    fontSize: 8,
  },
  rightText: {
    fontSize: 8,
    textAlign: "right",
  },
  labelText: {
    fontFamily: "Courier-Bold",
    fontSize: 8,
    marginBottom: 1,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 1.5,
  },
  grandTotal: {
    fontFamily: "Courier-Bold",
    fontSize: 12,
    textAlign: "right",
  },
  grandTotalLabel: {
    fontFamily: "Courier-Bold",
    fontSize: 12,
  },
  muted: {
    fontSize: 7,
    color: "#555",
  },
  footerText: {
    fontSize: 8,
    textAlign: "center",
    marginTop: 2,
  },
  poweredBy: {
    fontSize: 7,
    textAlign: "center",
    color: "#888",
    marginTop: 4,
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
    return new Date(d.includes("T") ? d : d + "T00:00:00").toLocaleDateString(
      "en-AU",
      { day: "2-digit", month: "short", year: "numeric" }
    );
  } catch {
    return d;
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function getDividers(width: number) {
  // Adjust divider length based on paper width
  const charCount = Math.floor(width / 6); // roughly 6pt per char in Courier
  const thick = "-".repeat(charCount);
  const thin = "- ".repeat(Math.floor(charCount / 2)).trim();
  return { thick, thin };
}

export interface ThermalInvoicePDFProps extends InvoicePDFProps {
  paperWidth?: string;
}

export function ThermalInvoicePDF({ invoice, lineItems, tenant, paperWidth }: ThermalInvoicePDFProps) {
  const PAGE_WIDTH = getPageWidth(paperWidth);
  const { thick: THICK, thin: THIN } = getDividers(PAGE_WIDTH);
  const businessName = tenant?.business_name || tenant?.name || "Your Business";

  const businessAddress = [
    tenant?.address_line1,
    tenant?.suburb,
    tenant?.state,
    tenant?.postcode,
  ]
    .filter(Boolean)
    .join(", ");

  const hasBankDetails = !!(tenant?.bank_bsb || tenant?.bank_account);

  const accentColor = tenant?.invoice_accent_color || '#1e3a5f';
  return (
    <Document>
      <Page
        size={{ width: PAGE_WIDTH, height: 2000 }}
        style={styles.page}
      >
        {/* 1. Business name */}
        {tenant?.logo_url && (
                  <Image
                    src={tenant.logo_url}
                    style={{ width: 120, height: 48, objectFit: 'contain', alignSelf: 'center', marginBottom: 4 }}
                  />
                )}
        <Text style={styles.businessName}>{businessName}</Text>

        {/* 2. ABN / address / phone / email */}
        {tenant?.abn ? (
          <Text style={styles.metaLine}>ABN: {tenant.abn}</Text>
        ) : null}
        {businessAddress ? (
          <Text style={styles.metaLine}>{businessAddress}</Text>
        ) : null}
        {tenant?.phone ? (
          <Text style={styles.metaLine}>{tenant.phone}</Text>
        ) : null}
        {tenant?.email ? (
          <Text style={styles.metaLine}>{tenant.email}</Text>
        ) : null}

        {/* 3. Thick divider */}
        <Text style={styles.thickDivider}>{THICK}</Text>

        {/* 4. TAX INVOICE */}
        <Text style={styles.taxInvoice}>TAX INVOICE</Text>

        {/* 5. Invoice # and date */}
        <View style={styles.row}>
          <Text style={styles.col}>Invoice #</Text>
          <Text style={[styles.col, styles.bold]}>{invoice.invoice_number}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.col}>Date</Text>
          <Text style={styles.col}>{fmtDate(invoice.invoice_date)}</Text>
        </View>
        {invoice.due_date ? (
          <View style={styles.row}>
            <Text style={styles.col}>Due</Text>
            <Text style={styles.col}>{fmtDate(invoice.due_date)}</Text>
          </View>
        ) : null}

        {/* 6. Thin divider */}
        <Text style={styles.thinDivider}>{THIN}</Text>

        {/* 7. Bill To */}
        <Text style={styles.labelText}>Bill To:</Text>
        {invoice.customers?.full_name ? (
          <Text style={styles.col}>{invoice.customers.full_name}</Text>
        ) : null}
        {invoice.customers?.email ? (
          <Text style={[styles.col, styles.muted]}>{invoice.customers.email}</Text>
        ) : null}
        {invoice.customers?.address ? (
          <Text style={[styles.col, styles.muted]}>{invoice.customers.address}</Text>
        ) : null}

        {/* 8. Thin divider */}
        <Text style={styles.thinDivider}>{THIN}</Text>

        {/* 9. Line items */}
        {lineItems.map((item, idx) => (
          <View key={idx}>
            <View style={styles.row}>
              <Text style={styles.col}>{truncate(item.description, 20)}</Text>
              <Text style={styles.col}>{fmt(item.total)}</Text>
            </View>
            {item.quantity > 1 ? (
              <Text style={[styles.muted, { marginBottom: 2, marginLeft: 2 }]}>
                {item.quantity} × {fmt(item.unit_price)}
              </Text>
            ) : null}
          </View>
        ))}

        {/* 10. Thin divider */}
        <Text style={styles.thinDivider}>{THIN}</Text>

        {/* 11. Subtotal */}
        <View style={styles.row}>
          <Text style={styles.col}>Subtotal</Text>
          <Text style={styles.col}>{fmt(invoice.subtotal)}</Text>
        </View>
        {invoice.discount_amount > 0 ? (
          <View style={styles.row}>
            <Text style={styles.col}>Discount</Text>
            <Text style={styles.col}>-{fmt(invoice.discount_amount)}</Text>
          </View>
        ) : null}

        {/* 12. GST */}
        <View style={styles.row}>
          <Text style={styles.col}>
            {invoice.tax_name || "GST"} ({(invoice.tax_rate * 100).toFixed(0)}%)
          </Text>
          <Text style={styles.col}>{fmt(invoice.tax_amount)}</Text>
        </View>

        {/* 13. Thick divider */}
        <Text style={styles.thickDivider}>{THICK}</Text>

        {/* 14. TOTAL */}
        <View style={styles.totalRow}>
          <Text style={styles.grandTotalLabel}>TOTAL</Text>
          <Text style={styles.grandTotal}>{fmt(invoice.total)}</Text>
        </View>

        {/* 14b. Amount Paid */}
        {invoice.amount_paid > 0 && (
          <View style={styles.row}>
            <Text style={styles.col}>Amount Paid</Text>
            <Text style={[styles.col, { fontFamily: "Courier-Bold" }]}>-{fmt(invoice.amount_paid)}</Text>
          </View>
        )}

        {/* 14c. Balance Due */}
        {invoice.amount_due > 0 && (
          <View style={styles.totalRow}>
            <Text style={[styles.grandTotalLabel, { fontSize: 10 }]}>BALANCE DUE</Text>
            <Text style={[styles.grandTotal, { fontSize: 10 }]}>{fmt(invoice.amount_due)}</Text>
          </View>
        )}

        {/* 14d. Paid in full indicator */}
        {invoice.amount_due === 0 && invoice.status === "paid" && (
          <Text style={[styles.centred, styles.bold, { marginVertical: 4 }]}>*** PAID IN FULL ***</Text>
        )}

        {/* 15. Thick divider */}
        <Text style={styles.thickDivider}>{THICK}</Text>

        {/* 16. Bank details */}
        {hasBankDetails ? (
          <View>
            <Text style={styles.labelText}>Payment Details:</Text>
            {tenant?.bank_name ? (
              <Text style={styles.col}>Bank: {tenant.bank_name}</Text>
            ) : null}
            {tenant?.bank_bsb ? (
              <Text style={styles.col}>BSB: {tenant.bank_bsb}</Text>
            ) : null}
            {tenant?.bank_account ? (
              <Text style={styles.col}>Account: {tenant.bank_account}</Text>
            ) : null}
            <Text style={styles.col}>Ref: {invoice.invoice_number}</Text>
            <Text style={styles.thinDivider}>{THIN}</Text>
          </View>
        ) : null}

        {/* 17. Notes */}
        {invoice.notes ? (
          <View>
            <Text style={[styles.muted, { marginBottom: 2 }]}>{invoice.notes}</Text>
          </View>
        ) : null}

        {/* 18. Footer text */}
        {(invoice.footer_text || tenant?.invoice_footer) ? (
          <Text style={styles.footerText}>
            {invoice.footer_text || tenant?.invoice_footer}
          </Text>
        ) : null}

        {/* 19. Powered by Nexpura */}
        <Text style={styles.poweredBy}>Powered by Nexpura</Text>
      </Page>
    </Document>
  );
}
