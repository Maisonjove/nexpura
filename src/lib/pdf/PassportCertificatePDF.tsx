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
const GOLD = "amber-700";
const PLATINUM = "#E8E8E8";
const IVORY = "#F8F5F0";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    backgroundColor: "#FFFFFF",
    paddingTop: 56,
    paddingBottom: 56,
    paddingHorizontal: 56,
    fontSize: 9,
    color: FOREST,
  },
  border: {
    position: "absolute",
    top: 24,
    left: 24,
    right: 24,
    bottom: 24,
    borderWidth: 2,
    borderColor: SAGE,
    borderRadius: 4,
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: PLATINUM,
  },
  brandName: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: SAGE,
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  docTitle: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    color: FOREST,
    letterSpacing: 2,
    marginBottom: 4,
  },
  subtitle: { fontSize: 9, color: "#999", letterSpacing: 1 },
  passportNumber: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: SAGE,
    marginTop: 6,
  },
  itemTitle: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: FOREST,
    textAlign: "center",
    marginBottom: 4,
  },
  itemSubtitle: {
    fontSize: 9,
    color: GOLD,
    textAlign: "center",
    marginBottom: 16,
  },
  specsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 16,
  },
  specCell: {
    width: "50%",
    marginBottom: 10,
  },
  specLabel: { fontSize: 7, color: "#999", textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 },
  specValue: { fontSize: 9, color: FOREST, fontFamily: "Helvetica-Bold" },
  description: {
    backgroundColor: IVORY,
    borderRadius: 4,
    padding: 12,
    fontSize: 9,
    color: FOREST,
    lineHeight: 1.6,
    marginBottom: 16,
  },
  divider: { borderTopWidth: 1, borderTopColor: PLATINUM, marginVertical: 16 },
  authenticityBox: {
    borderWidth: 1,
    borderColor: SAGE,
    borderRadius: 6,
    padding: 14,
    marginBottom: 16,
    backgroundColor: "#f0fdf4",
  },
  authenticityTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: SAGE,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
  },
  authenticityText: {
    fontSize: 8,
    color: "#166534",
    lineHeight: 1.5,
  },
  ownerSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  ownerBlock: { flex: 1 },
  sectionTitle: { fontSize: 7, color: "#999", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 },
  ownerName: { fontSize: 11, fontFamily: "Helvetica-Bold", color: FOREST },
  ownerDetail: { fontSize: 8, color: "#666", marginTop: 2 },
  footer: {
    position: "absolute",
    bottom: 40,
    left: 56,
    right: 56,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 7,
    color: "#999",
    borderTopWidth: 1,
    borderTopColor: PLATINUM,
    paddingTop: 8,
  },
  footerBrand: { fontSize: 8, fontFamily: "Helvetica-Bold", color: SAGE },
});

export interface PassportCertificateData {
  passportNumber: string;
  itemName: string;
  description?: string;
  tenantName: string;
  tenantPhone?: string;
  tenantEmail?: string;
  customerName?: string;
  purchaseDate?: string;
  purchasePrice?: number;
  metal?: string;
  stone?: string;
  carat?: number;
  weightGrams?: number;
  isPublic?: boolean;
  createdAt?: string;
}

function fmt(n?: number) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);
}

function fmtDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
}

export default function PassportCertificatePDF({ passport }: { passport: PassportCertificateData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Decorative border */}
        <View style={styles.border} />

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.brandName}>{passport.tenantName}</Text>
          <Text style={styles.docTitle}>JEWELLERY PASSPORT</Text>
          <Text style={styles.subtitle}>Certificate of Authenticity &amp; Ownership</Text>
          <Text style={styles.passportNumber}>{passport.passportNumber}</Text>
        </View>

        {/* Item Name */}
        <View style={{ marginBottom: 20, alignItems: "center" }}>
          <Text style={styles.itemTitle}>{passport.itemName}</Text>
          {(passport.metal || passport.stone) && (
            <Text style={styles.itemSubtitle}>
              {[passport.metal, passport.stone].filter(Boolean).join(" · ")}
            </Text>
          )}
        </View>

        {/* Specifications Grid */}
        <View style={styles.specsGrid}>
          {passport.metal && (
            <View style={styles.specCell}>
              <Text style={styles.specLabel}>Metal</Text>
              <Text style={styles.specValue}>{passport.metal}</Text>
            </View>
          )}
          {passport.stone && (
            <View style={styles.specCell}>
              <Text style={styles.specLabel}>Stone</Text>
              <Text style={styles.specValue}>{passport.stone}</Text>
            </View>
          )}
          {passport.carat != null && (
            <View style={styles.specCell}>
              <Text style={styles.specLabel}>Carat</Text>
              <Text style={styles.specValue}>{passport.carat}ct</Text>
            </View>
          )}
          {passport.weightGrams != null && (
            <View style={styles.specCell}>
              <Text style={styles.specLabel}>Weight</Text>
              <Text style={styles.specValue}>{passport.weightGrams}g</Text>
            </View>
          )}
          <View style={styles.specCell}>
            <Text style={styles.specLabel}>Purchase Date</Text>
            <Text style={styles.specValue}>{fmtDate(passport.purchaseDate)}</Text>
          </View>
          <View style={styles.specCell}>
            <Text style={styles.specLabel}>Purchase Price</Text>
            <Text style={styles.specValue}>{fmt(passport.purchasePrice)}</Text>
          </View>
        </View>

        {/* Description */}
        {passport.description && (
          <>
            <View style={styles.divider} />
            <Text style={styles.description}>{passport.description}</Text>
          </>
        )}

        <View style={styles.divider} />

        {/* Authenticity Statement */}
        <View style={styles.authenticityBox}>
          <Text style={styles.authenticityTitle}>Certificate of Authenticity</Text>
          <Text style={styles.authenticityText}>
            This document certifies that the item described herein is genuine and was sourced, crafted and/or sold by {passport.tenantName}.
            This passport serves as a permanent record of provenance, ownership and specifications for the jewellery item identified by
            passport number {passport.passportNumber}.
          </Text>
        </View>

        {/* Owner */}
        {passport.customerName && (
          <View style={styles.ownerSection}>
            <View style={styles.ownerBlock}>
              <Text style={styles.sectionTitle}>Registered Owner</Text>
              <Text style={styles.ownerName}>{passport.customerName}</Text>
              <Text style={styles.ownerDetail}>
                Registered {fmtDate(passport.purchaseDate)}
              </Text>
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerBrand}>{passport.tenantName}</Text>
          <Text>{passport.passportNumber}</Text>
          <Text>Issued {fmtDate(passport.createdAt || passport.purchaseDate)}</Text>
        </View>
      </Page>
    </Document>
  );
}
