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
const GOLD = "#8B7355";

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
  docTitle: { fontSize: 20, fontFamily: "Helvetica-Bold", color: FOREST, textAlign: "right" },
  docNumber: { fontSize: 11, color: SAGE, textAlign: "right", marginTop: 3 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#999", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 },
  row: { flexDirection: "row", marginBottom: 4 },
  label: { width: 140, fontSize: 8, color: "#666" },
  value: { flex: 1, fontSize: 9, color: FOREST },
  descriptionBox: {
    backgroundColor: "#F8F5F0",
    borderRadius: 4,
    padding: 10,
    fontSize: 9,
    color: FOREST,
    lineHeight: 1.6,
    marginTop: 4,
  },
  stageBox: {
    borderWidth: 1,
    borderColor: SAGE,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  stageText: { fontSize: 9, color: SAGE, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
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
  approvalBox: {
    borderTopWidth: 1,
    borderTopColor: PLATINUM,
    paddingTop: 6,
    width: 180,
  },
  approvalLabel: { fontSize: 7, color: "#999" },
  timelineItem: {
    flexDirection: "row",
    marginBottom: 6,
    alignItems: "center",
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: SAGE,
    marginRight: 8,
  },
  timelineText: { fontSize: 9, color: FOREST },
});

export interface BespokeSheetData {
  jobNumber: string;
  title: string;
  description?: string;
  tenantName: string;
  tenantPhone?: string;
  tenantEmail?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  stage?: string;
  jewelleryType?: string;
  orderType?: string;
  metalType?: string;
  metalColour?: string;
  metalPurity?: string;
  metalWeightGrams?: number;
  stoneType?: string;
  stoneColour?: string;
  stoneCarat?: number;
  designNotes?: string;
  estimatedCost?: number;
  depositAmount?: number;
  depositReceived?: boolean;
  dueDate?: string;
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

const STAGES = ["enquiry", "design", "approval", "production", "finishing", "ready", "completed"];

export default function BespokeSheetPDF({ job }: { job: BespokeSheetData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.businessName}>{job.tenantName}</Text>
            {job.tenantPhone && <Text style={styles.businessMeta}>{job.tenantPhone}</Text>}
            {job.tenantEmail && <Text style={styles.businessMeta}>{job.tenantEmail}</Text>}
          </View>
          <View>
            <Text style={styles.docTitle}>BESPOKE JOB</Text>
            <Text style={styles.docNumber}>{job.jobNumber}</Text>
            <Text style={[styles.businessMeta, { textAlign: "right", marginTop: 4 }]}>
              {fmtDate(job.createdAt)}
            </Text>
          </View>
        </View>

        {/* Title & Stage */}
        <View style={[styles.row, { marginBottom: 12, alignItems: "center" }]}>
          <Text style={{ fontSize: 13, fontFamily: "Helvetica-Bold", color: FOREST, flex: 1 }}>
            {job.title}
          </Text>
          {job.stage && (
            <View style={styles.stageBox}>
              <Text style={styles.stageText}>{job.stage}</Text>
            </View>
          )}
        </View>

        {/* Description */}
        {job.description && (
          <View style={[styles.section, { marginBottom: 16 }]}>
            <Text style={styles.descriptionBox}>{job.description}</Text>
          </View>
        )}

        {/* Stage timeline */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Job Progress</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
            {STAGES.map((s) => (
              <View
                key={s}
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 3,
                  backgroundColor: s === job.stage ? SAGE : PLATINUM,
                }}
              >
                <Text style={{ fontSize: 7, color: s === job.stage ? "#fff" : "#666", textTransform: "capitalize" }}>
                  {s}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.divider} />

        {/* Customer */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer</Text>
          {job.customerName && (
            <View style={styles.row}>
              <Text style={styles.label}>Name</Text>
              <Text style={styles.value}>{job.customerName}</Text>
            </View>
          )}
          {job.customerPhone && (
            <View style={styles.row}>
              <Text style={styles.label}>Phone</Text>
              <Text style={styles.value}>{job.customerPhone}</Text>
            </View>
          )}
          {job.customerEmail && (
            <View style={styles.row}>
              <Text style={styles.label}>Email</Text>
              <Text style={styles.value}>{job.customerEmail}</Text>
            </View>
          )}
        </View>

        <View style={styles.divider} />

        {/* Specifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Specifications</Text>
          {job.jewelleryType && (
            <View style={styles.row}>
              <Text style={styles.label}>Jewellery Type</Text>
              <Text style={styles.value}>{job.jewelleryType}</Text>
            </View>
          )}
          {job.metalType && (
            <View style={styles.row}>
              <Text style={styles.label}>Metal</Text>
              <Text style={styles.value}>{[job.metalType, job.metalColour, job.metalPurity].filter(Boolean).join(" · ")}</Text>
            </View>
          )}
          {job.metalWeightGrams != null && (
            <View style={styles.row}>
              <Text style={styles.label}>Metal Weight</Text>
              <Text style={styles.value}>{job.metalWeightGrams}g</Text>
            </View>
          )}
          {job.stoneType && (
            <View style={styles.row}>
              <Text style={styles.label}>Stone</Text>
              <Text style={styles.value}>{[job.stoneType, job.stoneColour, job.stoneCarat ? `${job.stoneCarat}ct` : undefined].filter(Boolean).join(" · ")}</Text>
            </View>
          )}
        </View>

        {job.designNotes && (
          <>
            <View style={styles.divider} />
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Design Notes</Text>
              <Text style={styles.descriptionBox}>{job.designNotes}</Text>
            </View>
          </>
        )}

        <View style={styles.divider} />

        {/* Financials */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pricing &amp; Timeline</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Estimated Cost</Text>
            <Text style={styles.value}>{fmt(job.estimatedCost)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Deposit Required</Text>
            <Text style={styles.value}>{fmt(job.depositAmount)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Deposit Received</Text>
            <Text style={styles.value}>{job.depositReceived ? "Yes" : "No"}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Due Date</Text>
            <Text style={styles.value}>{fmtDate(job.dueDate)}</Text>
          </View>
        </View>

        {job.clientNotes && (
          <>
            <View style={styles.divider} />
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Notes for Customer</Text>
              <Text style={styles.descriptionBox}>{job.clientNotes}</Text>
            </View>
          </>
        )}

        {/* Approval signatures */}
        <View style={[styles.divider, { marginTop: 32 }]} />
        <View style={[styles.row, { justifyContent: "space-between", marginTop: 16 }]}>
          <View style={styles.approvalBox}>
            <Text style={styles.approvalLabel}>Customer Approval</Text>
          </View>
          <View style={styles.approvalBox}>
            <Text style={styles.approvalLabel}>Jeweller Approval</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text>{job.tenantName}</Text>
          <Text>Job: {job.jobNumber}</Text>
        </View>
      </Page>
    </Document>
  );
}
