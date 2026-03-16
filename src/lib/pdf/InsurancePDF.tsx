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
const MUTED = "#666666";
const LIGHT_BG = "#F9F8F6";
const BORDER = "#E5E2DC";

const styles = StyleSheet.create({
  page: {
    padding: 50,
    fontFamily: "Helvetica",
    color: DARK,
    backgroundColor: "#FFFFFF",
  },
  // ── Header ──────────────────────────────────────────────────
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 30,
    paddingBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: BRONZE,
  },
  headerLeft: {
    flexDirection: "column",
  },
  badge: {
    fontSize: 7,
    textTransform: "uppercase",
    letterSpacing: 2,
    color: BRONZE,
    marginBottom: 4,
  },
  docTitle: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: DARK,
    marginBottom: 2,
  },
  appraisalNum: {
    fontSize: 10,
    color: MUTED,
  },
  headerRight: {
    alignItems: "flex-end",
  },
  storeName: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  storeDetail: {
    fontSize: 9,
    color: MUTED,
    marginBottom: 1,
  },

  // ── Section ──────────────────────────────────────────────────
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    color: BRONZE,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingBottom: 4,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    marginBottom: 4,
  },
  label: {
    width: 130,
    fontSize: 9,
    color: MUTED,
  },
  value: {
    flex: 1,
    fontSize: 9,
    color: DARK,
  },

  // ── Two-column layout ────────────────────────────────────────
  twoCol: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 18,
  },
  col: {
    flex: 1,
  },

  // ── Valuation box ────────────────────────────────────────────
  valuationBox: {
    backgroundColor: LIGHT_BG,
    borderWidth: 1,
    borderColor: BRONZE,
    borderRadius: 4,
    padding: 18,
    alignItems: "center",
    marginBottom: 20,
  },
  valuationLabel: {
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    color: MUTED,
    marginBottom: 6,
  },
  valuationAmount: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    color: BRONZE,
    marginBottom: 4,
  },
  valuationBasis: {
    fontSize: 8,
    color: MUTED,
  },

  // ── Images ───────────────────────────────────────────────────
  imagesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12,
  },
  itemImage: {
    width: 80,
    height: 80,
    objectFit: "cover",
    borderRadius: 3,
    borderWidth: 1,
    borderColor: BORDER,
  },

  // ── Signature / footer ───────────────────────────────────────
  signatureSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  signatureBlock: {
    flexDirection: "column",
    width: "45%",
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: DARK,
    height: 24,
    marginBottom: 4,
  },
  signatureLabel: {
    fontSize: 8,
    color: MUTED,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 50,
    right: 50,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: {
    fontSize: 7,
    color: MUTED,
  },
  disclaimer: {
    fontSize: 7,
    color: MUTED,
    textAlign: "center",
    marginTop: 16,
    fontStyle: "italic",
  },
});

function fmt(val: number | null | undefined): string {
  if (val == null) return "—";
  return `$${Number(val).toLocaleString("en-AU", { minimumFractionDigits: 2 })}`;
}

export const InsurancePDF = ({ appraisal, tenant }: { appraisal: any; tenant: any }) => {
  const businessName = tenant?.business_name || tenant?.name || "Jeweller";
  const abn = tenant?.abn || tenant?.tax_number || null;
  const address = [
    tenant?.address_line1,
    tenant?.suburb,
    tenant?.state,
    tenant?.postcode,
  ]
    .filter(Boolean)
    .join(", ");

  const images: string[] = Array.isArray(appraisal.images) ? appraisal.images.slice(0, 4) : [];

  const valuationValue =
    appraisal.replacement_value ??
    appraisal.insurance_value ??
    appraisal.appraised_value;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.badge}>Insurance Valuation Certificate</Text>
            <Text style={styles.docTitle}>Valuation Certificate</Text>
            {appraisal.appraisal_number && (
              <Text style={styles.appraisalNum}>Ref: {appraisal.appraisal_number}</Text>
            )}
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.storeName}>{businessName}</Text>
            {address ? <Text style={styles.storeDetail}>{address}</Text> : null}
            {tenant?.email ? <Text style={styles.storeDetail}>{tenant.email}</Text> : null}
            {tenant?.phone ? <Text style={styles.storeDetail}>{tenant.phone}</Text> : null}
            {abn ? <Text style={styles.storeDetail}>ABN: {abn}</Text> : null}
          </View>
        </View>

        {/* Client + Appraiser two-column */}
        <View style={styles.twoCol}>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Client Details</Text>
            {appraisal.customer_name ? (
              <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 3 }}>
                {appraisal.customer_name}
              </Text>
            ) : null}
            {appraisal.customer_address ? (
              <Text style={{ fontSize: 9, color: MUTED }}>{appraisal.customer_address}</Text>
            ) : null}
            {appraisal.customer_email ? (
              <Text style={{ fontSize: 9, color: MUTED }}>{appraisal.customer_email}</Text>
            ) : null}
            {appraisal.customer_phone ? (
              <Text style={{ fontSize: 9, color: MUTED }}>{appraisal.customer_phone}</Text>
            ) : null}
          </View>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Appraiser Details</Text>
            {appraisal.appraiser_name ? (
              <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 3 }}>
                {appraisal.appraiser_name}
              </Text>
            ) : null}
            {appraisal.appraiser_qualifications ? (
              <Text style={{ fontSize: 9, color: MUTED }}>
                {appraisal.appraiser_qualifications}
              </Text>
            ) : null}
            {appraisal.appraiser_licence ? (
              <Text style={{ fontSize: 9, color: MUTED }}>
                Licence: {appraisal.appraiser_licence}
              </Text>
            ) : null}
            <View style={styles.row}>
              <Text style={styles.label}>Date of Appraisal</Text>
              <Text style={styles.value}>
                {new Date(appraisal.appraisal_date).toLocaleDateString("en-AU")}
              </Text>
            </View>
            {appraisal.valid_until && (
              <View style={styles.row}>
                <Text style={styles.label}>Valid Until</Text>
                <Text style={styles.value}>
                  {new Date(appraisal.valid_until).toLocaleDateString("en-AU")}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Item Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Item Description</Text>
          <Text style={{ fontSize: 13, fontFamily: "Helvetica-Bold", marginBottom: 4 }}>
            {appraisal.item_name}
          </Text>
          {appraisal.item_description ? (
            <Text style={{ fontSize: 9, color: MUTED, lineHeight: 1.5 }}>
              {appraisal.item_description}
            </Text>
          ) : null}
        </View>

        {/* Technical Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Technical Specifications</Text>
          {appraisal.metal && (
            <View style={styles.row}>
              <Text style={styles.label}>Metal</Text>
              <Text style={styles.value}>
                {appraisal.metal}
                {appraisal.metal_purity ? ` (${appraisal.metal_purity})` : ""}
              </Text>
            </View>
          )}
          {appraisal.metal_weight_grams && (
            <View style={styles.row}>
              <Text style={styles.label}>Metal Weight</Text>
              <Text style={styles.value}>{appraisal.metal_weight_grams}g</Text>
            </View>
          )}
          {appraisal.stone && (
            <View style={styles.row}>
              <Text style={styles.label}>Stone</Text>
              <Text style={styles.value}>
                {appraisal.stone}
                {appraisal.stone_carat ? ` (${appraisal.stone_carat}ct)` : ""}
                {appraisal.stone_colour ? `, ${appraisal.stone_colour}` : ""}
                {appraisal.stone_clarity ? `, ${appraisal.stone_clarity}` : ""}
                {appraisal.stone_cut ? `, ${appraisal.stone_cut}` : ""}
              </Text>
            </View>
          )}
          {appraisal.stone_certificate_number && (
            <View style={styles.row}>
              <Text style={styles.label}>Stone Certificate</Text>
              <Text style={styles.value}>{appraisal.stone_certificate_number}</Text>
            </View>
          )}
          {appraisal.hallmarks && (
            <View style={styles.row}>
              <Text style={styles.label}>Hallmarks</Text>
              <Text style={styles.value}>{appraisal.hallmarks}</Text>
            </View>
          )}
          {appraisal.maker_marks && (
            <View style={styles.row}>
              <Text style={styles.label}>Maker's Marks</Text>
              <Text style={styles.value}>{appraisal.maker_marks}</Text>
            </View>
          )}
          {appraisal.condition && (
            <View style={styles.row}>
              <Text style={styles.label}>Condition</Text>
              <Text style={styles.value}>{appraisal.condition}</Text>
            </View>
          )}
          {appraisal.age_period && (
            <View style={styles.row}>
              <Text style={styles.label}>Age / Period</Text>
              <Text style={styles.value}>{appraisal.age_period}</Text>
            </View>
          )}
        </View>

        {/* Item Images */}
        {images.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Item Images</Text>
            <View style={styles.imagesRow}>
              {images.map((src: string, i: number) => (
                <Image key={i} src={src} style={styles.itemImage} />
              ))}
            </View>
          </View>
        )}

        {/* Valuation */}
        <View style={styles.valuationBox}>
          <Text style={styles.valuationLabel}>Insurance Replacement Value</Text>
          <Text style={styles.valuationAmount}>{fmt(valuationValue)}</Text>
          <Text style={styles.valuationBasis}>
            Based on current retail replacement cost as at{" "}
            {new Date(appraisal.appraisal_date).toLocaleDateString("en-AU")}
          </Text>
        </View>

        {/* Methodology */}
        {appraisal.methodology && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Methodology</Text>
            <Text style={{ fontSize: 9, color: MUTED, lineHeight: 1.5 }}>
              {appraisal.methodology}
            </Text>
          </View>
        )}

        {/* Signature Block */}
        <View style={styles.signatureSection}>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Appraiser Signature</Text>
            {appraisal.appraiser_name && (
              <Text style={{ fontSize: 8, color: MUTED, marginTop: 2 }}>
                {appraisal.appraiser_name}
                {appraisal.appraiser_licence ? `  |  Lic: ${appraisal.appraiser_licence}` : ""}
              </Text>
            )}
          </View>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Date</Text>
          </View>
        </View>

        {/* Disclaimer */}
        <Text style={styles.disclaimer}>
          This valuation is prepared solely for insurance purposes. The appraised replacement value
          is the estimated cost to replace the described item with one of comparable quality at the
          date of valuation. This document does not guarantee the item's purchase price or resale
          value.
        </Text>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>{businessName}</Text>
          <Text style={styles.footerText}>
            Generated {new Date().toLocaleDateString("en-AU")}
          </Text>
        </View>
      </Page>
    </Document>
  );
};
