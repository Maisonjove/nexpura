import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

const FOREST = "#071A0D";
const SAGE = "#52B788";
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: PLATINUM,
  },
  businessName: { fontSize: 14, fontFamily: "Helvetica-Bold", color: FOREST, marginBottom: 3 },
  businessMeta: { fontSize: 8, color: "#666", marginBottom: 1.5 },
  ticketTitle: { fontSize: 20, fontFamily: "Helvetica-Bold", color: FOREST, textAlign: "right" },
  ticketNumber: { fontSize: 11, color: SAGE, textAlign: "right", marginTop: 3 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#999", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 },
  row: { flexDirection: "row", marginBottom: 4 },
  label: { width: 130, fontSize: 8, color: "#666" },
  value: { flex: 1, fontSize: 9, color: FOREST },
  statusBadge: {
    backgroundColor: "#f0fdf4",
    color: "#166534",
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  notes: {
    backgroundColor: "#F8F5F0",
    borderRadius: 4,
    padding: 10,
    fontSize: 9,
    color: FOREST,
    lineHeight: 1.5,
  },
  divider: { borderTopWidth: 1, borderTopColor: PLATINUM, marginVertical: 12 },
  footer: {
    position: "absolute",
    bottom: 32,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: "#999",
  },
  signatureBox: {
    borderTopWidth: 1,
    borderTopColor: PLATINUM,
    paddingTop: 6,
    width: 180,
  },
  signatureLabel: { fontSize: 7, color: "#999" },
});

interface RepairTicketData {
  ticketNumber: string;
  tenantName: string;
  tenantPhone?: string;
  tenantEmail?: string;
  tenantAddress?: string;
  tenantAbn?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  itemType?: string;
  itemDescription: string;
  metalType?: string;
  brand?: string;
  conditionNotes?: string;
  repairType?: string;
  workDescription?: string;
  priority?: string;
  status?: string;
  quotedPrice?: number;
  finalPrice?: number;
  depositAmount?: number;
  depositPaid?: boolean;
  dueDate?: string;
  technician?: string;
  internalNotes?: string;
  clientNotes?: string;
  createdAt?: string;
}

function fmt(n?: number) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);
}

function fmtDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

export default function RepairTicketPDF({ ticket }: { ticket: RepairTicketData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.businessName}>{ticket.tenantName}</Text>
            {ticket.tenantAddress && <Text style={styles.businessMeta}>{ticket.tenantAddress}</Text>}
            {ticket.tenantPhone && <Text style={styles.businessMeta}>{ticket.tenantPhone}</Text>}
            {ticket.tenantEmail && <Text style={styles.businessMeta}>{ticket.tenantEmail}</Text>}
            {ticket.tenantAbn && <Text style={styles.businessMeta}>ABN: {ticket.tenantAbn}</Text>}
          </View>
          <View>
            <Text style={styles.ticketTitle}>REPAIR TICKET</Text>
            <Text style={styles.ticketNumber}>{ticket.ticketNumber}</Text>
            <Text style={[styles.businessMeta, { textAlign: "right", marginTop: 4 }]}>
              {fmtDate(ticket.createdAt)}
            </Text>
          </View>
        </View>

        {/* Status + Priority */}
        <View style={[styles.row, { marginBottom: 16 }]}>
          {ticket.status && (
            <Text style={styles.statusBadge}>{ticket.status}</Text>
          )}
        </View>

        {/* Customer */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer</Text>
          {ticket.customerName && (
            <View style={styles.row}>
              <Text style={styles.label}>Name</Text>
              <Text style={styles.value}>{ticket.customerName}</Text>
            </View>
          )}
          {ticket.customerPhone && (
            <View style={styles.row}>
              <Text style={styles.label}>Phone</Text>
              <Text style={styles.value}>{ticket.customerPhone}</Text>
            </View>
          )}
          {ticket.customerEmail && (
            <View style={styles.row}>
              <Text style={styles.label}>Email</Text>
              <Text style={styles.value}>{ticket.customerEmail}</Text>
            </View>
          )}
        </View>

        <View style={styles.divider} />

        {/* Item */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Item Details</Text>
          {ticket.itemType && (
            <View style={styles.row}>
              <Text style={styles.label}>Type</Text>
              <Text style={styles.value}>{ticket.itemType}</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>Description</Text>
            <Text style={styles.value}>{ticket.itemDescription}</Text>
          </View>
          {ticket.metalType && (
            <View style={styles.row}>
              <Text style={styles.label}>Metal</Text>
              <Text style={styles.value}>{ticket.metalType}</Text>
            </View>
          )}
          {ticket.brand && (
            <View style={styles.row}>
              <Text style={styles.label}>Brand</Text>
              <Text style={styles.value}>{ticket.brand}</Text>
            </View>
          )}
          {ticket.conditionNotes && (
            <View style={styles.row}>
              <Text style={styles.label}>Condition In</Text>
              <Text style={styles.value}>{ticket.conditionNotes}</Text>
            </View>
          )}
        </View>

        <View style={styles.divider} />

        {/* Repair Work */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Repair Instructions</Text>
          {ticket.repairType && (
            <View style={styles.row}>
              <Text style={styles.label}>Repair Type</Text>
              <Text style={styles.value}>{ticket.repairType}</Text>
            </View>
          )}
          {ticket.workDescription && (
            <View style={[styles.row, { marginTop: 4 }]}>
              <Text style={styles.notes}>{ticket.workDescription}</Text>
            </View>
          )}
          {ticket.technician && (
            <View style={[styles.row, { marginTop: 8 }]}>
              <Text style={styles.label}>Technician</Text>
              <Text style={styles.value}>{ticket.technician}</Text>
            </View>
          )}
        </View>

        <View style={styles.divider} />

        {/* Pricing & Dates */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pricing &amp; Schedule</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Quoted Price</Text>
            <Text style={styles.value}>{fmt(ticket.quotedPrice)}</Text>
          </View>
          {ticket.finalPrice != null && (
            <View style={styles.row}>
              <Text style={styles.label}>Final Price</Text>
              <Text style={styles.value}>{fmt(ticket.finalPrice)}</Text>
            </View>
          )}
          {ticket.depositAmount != null && ticket.depositAmount > 0 && (
            <View style={styles.row}>
              <Text style={styles.label}>Deposit</Text>
              <Text style={styles.value}>{fmt(ticket.depositAmount)}{ticket.depositPaid ? " (Paid)" : " (Owing)"}</Text>
            </View>
          )}
          {ticket.depositAmount != null && ticket.depositAmount > 0 && (
            <View style={styles.row}>
              <Text style={styles.label}>Balance Due</Text>
              <Text style={styles.value}>{fmt((ticket.finalPrice ?? ticket.quotedPrice ?? 0) - (ticket.depositPaid ? (ticket.depositAmount ?? 0) : 0))}</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>Due Date</Text>
            <Text style={styles.value}>{fmtDate(ticket.dueDate)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Priority</Text>
            <Text style={styles.value}>{ticket.priority ?? "Normal"}</Text>
          </View>
        </View>

        {ticket.clientNotes && (
          <>
            <View style={styles.divider} />
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Notes for Customer</Text>
              <Text style={styles.notes}>{ticket.clientNotes}</Text>
            </View>
          </>
        )}

        {/* Signature */}
        <View style={[styles.divider, { marginTop: 32 }]} />
        <View style={[styles.row, { justifyContent: "space-between", marginTop: 16 }]}>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>Customer Signature</Text>
          </View>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>Staff Signature</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>{ticket.tenantName}</Text>
          <Text>Ticket: {ticket.ticketNumber}</Text>
        </View>
      </Page>
    </Document>
  );
}
