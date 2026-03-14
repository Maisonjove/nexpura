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
const MUTED = "#666666";

const styles = StyleSheet.create({
  page: {
    padding: 50,
    fontFamily: "Helvetica",
    color: DARK,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 40,
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
    paddingBottom: 20,
  },
  title: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    color: BRONZE,
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: MUTED,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    marginBottom: 10,
    textTransform: "uppercase",
    color: BRONZE,
    borderBottomWidth: 1,
    borderBottomColor: BRONZE,
    paddingBottom: 3,
  },
  row: {
    flexDirection: "row",
    marginBottom: 5,
  },
  label: {
    width: 120,
    fontSize: 10,
    color: MUTED,
  },
  value: {
    flex: 1,
    fontSize: 10,
  },
  description: {
    fontSize: 10,
    lineHeight: 1.5,
    marginTop: 10,
  },
  valueBox: {
    marginTop: 30,
    padding: 20,
    backgroundColor: "#FAFAFA",
    borderRadius: 5,
    textAlign: "center",
  },
  totalLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    marginBottom: 5,
  },
  totalValue: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    color: BRONZE,
  },
  footer: {
    position: "absolute",
    bottom: 50,
    left: 50,
    right: 50,
    borderTopWidth: 1,
    borderTopColor: "#EEE",
    paddingTop: 20,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 8,
    color: MUTED,
  },
});

export const AppraisalPDF = ({ appraisal, tenant }: any) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Valuation Certificate</Text>
          <Text style={styles.subtitle}>{appraisal.appraisal_number}</Text>
        </View>
        <View style={{ textAlign: "right" }}>
          <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold" }}>{tenant?.business_name || tenant?.name}</Text>
          <Text style={{ fontSize: 9, color: MUTED }}>{tenant?.address_line1}</Text>
          <Text style={{ fontSize: 9, color: MUTED }}>{tenant?.email}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Client Details</Text>
        <Text style={{ fontSize: 12, marginBottom: 2 }}>{appraisal.customer_name}</Text>
        <Text style={{ fontSize: 10, color: MUTED }}>{appraisal.customer_address}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Item Description</Text>
        <Text style={{ fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 5 }}>{appraisal.item_name}</Text>
        <Text style={styles.description}>{appraisal.item_description}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Technical Details</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Metal</Text>
          <Text style={styles.value}>{appraisal.metal} {appraisal.metal_purity}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Weight</Text>
          <Text style={styles.value}>{appraisal.metal_weight_grams}g</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Stones</Text>
          <Text style={styles.value}>{appraisal.stone} ({appraisal.stone_carat}ct)</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Condition</Text>
          <Text style={styles.value}>{appraisal.condition}</Text>
        </View>
      </View>

      <View style={styles.valueBox}>
        <Text style={styles.totalLabel}>Replacement Value (Insurance)</Text>
        <Text style={styles.totalValue}>${Number(appraisal.appraised_value).toLocaleString()}</Text>
      </View>

      <View style={styles.footer}>
        <View>
          <Text style={styles.footerText}>Date: {new Date(appraisal.appraisal_date).toLocaleDateString()}</Text>
          <Text style={styles.footerText}>Appraiser: {appraisal.appraiser_name}</Text>
        </View>
        <View style={{ textAlign: "right" }}>
          <Text style={styles.footerText}>Signature: __________________________</Text>
        </View>
      </View>
    </Page>
  </Document>
);
