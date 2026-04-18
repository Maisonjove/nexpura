"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { createInventoryItem, updateInventoryItem } from "./actions";

import {
  BasicInfoSection,
  PricingSection,
  MetalStoneSection,
  CertificatesSection,
  StockSection,
  ConsignmentSection,
  ImageUploadSection,
} from "./components";

import type { InventoryFormProps, SecondaryStone } from "./components/types";

export default function InventoryForm({ categories: initialCategories, item, mode }: InventoryFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Basic info state
  const [itemType, setItemType] = useState(item?.item_type ?? "finished_piece");
  const [jewelleryType, setJewelleryType] = useState(item?.jewellery_type ?? "");
  const [trackQuantity, setTrackQuantity] = useState(item?.track_quantity ?? true);
  const [isFeatured, setIsFeatured] = useState(item?.is_featured ?? false);
  const [status, setStatus] = useState(item?.status ?? "active");
  const [categoryId, setCategoryId] = useState(item?.category_id ?? "");

  // Pricing state
  const [costPrice, setCostPrice] = useState(item?.cost_price?.toString() ?? "");
  const [retailPrice, setRetailPrice] = useState(item?.retail_price?.toString() ?? "");

  // Metal/Stone state
  const [metalForm, setMetalForm] = useState(item?.metal_form ?? "");
  const [secondaryStones, setSecondaryStones] = useState<SecondaryStone[]>(item?.secondary_stones ?? []);

  // AI categorization data for metal/stone fields
  const [aiMetalStone, setAiMetalStone] = useState<{
    metalType?: string | null;
    metalColour?: string | null;
    metalPurity?: string | null;
    stoneType?: string | null;
    stoneColour?: string | null;
    stoneClarity?: string | null;
  } | null>(null);

  // Apply AI categorization to form fields
  useEffect(() => {
    if (aiMetalStone && formRef.current) {
      const form = formRef.current;
      
      if (aiMetalStone.metalType) {
        const el = form.querySelector('[name="metal_type"]') as HTMLSelectElement;
        if (el) el.value = aiMetalStone.metalType.toLowerCase();
      }
      if (aiMetalStone.metalColour) {
        const el = form.querySelector('[name="metal_colour"]') as HTMLSelectElement;
        if (el) el.value = aiMetalStone.metalColour.toLowerCase();
      }
      if (aiMetalStone.metalPurity) {
        const el = form.querySelector('[name="metal_purity"]') as HTMLSelectElement;
        if (el) el.value = aiMetalStone.metalPurity;
      }
      if (aiMetalStone.stoneType) {
        const el = form.querySelector('[name="stone_type"]') as HTMLSelectElement;
        if (el) el.value = aiMetalStone.stoneType.toLowerCase();
      }
      if (aiMetalStone.stoneColour) {
        const el = form.querySelector('[name="stone_colour"]') as HTMLSelectElement;
        if (el) el.value = aiMetalStone.stoneColour.toLowerCase();
      }
      if (aiMetalStone.stoneClarity) {
        const el = form.querySelector('[name="stone_clarity"]') as HTMLSelectElement;
        if (el) el.value = aiMetalStone.stoneClarity;
      }
    }
  }, [aiMetalStone]);

  // Certificates state
  const [certNumber, setCertNumber] = useState(item?.certificate_number ?? "");
  const [gradingLab, setGradingLab] = useState(item?.grading_lab ?? "");
  const [grade, setGrade] = useState(item?.grade ?? "");
  const [reportUrl, setReportUrl] = useState(item?.report_url ?? "");

  // Stock state
  const [stockLocation, setStockLocation] = useState(item?.stock_location ?? "display");
  const [supplierInvoiceRef, setSupplierInvoiceRef] = useState(item?.supplier_invoice_ref ?? "");

  // Consignment state
  const [consignorName, setConsignorName] = useState(item?.consignor_name ?? "");
  const [consignorContact, setConsignorContact] = useState(item?.consignor_contact ?? "");
  const [consignmentStart, setConsignmentStart] = useState(item?.consignment_start_date ?? "");
  const [consignmentEnd, setConsignmentEnd] = useState(item?.consignment_end_date ?? "");
  const [consignmentCommPct, setConsignmentCommPct] = useState(item?.consignment_commission_pct?.toString() ?? "");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("track_quantity", String(trackQuantity));
    formData.set("is_featured", String(isFeatured));
    formData.set("status", status);
    formData.set("category_id", categoryId);

    // Add hidden fields for collapsible sections
    formData.set("certificate_number", certNumber);
    formData.set("grading_lab", gradingLab);
    formData.set("grade", grade);
    formData.set("report_url", reportUrl);
    formData.set("stock_location", stockLocation);
    formData.set("metal_form", metalForm);
    formData.set("consignor_name", consignorName);
    formData.set("consignor_contact", consignorContact);
    formData.set("consignment_start_date", consignmentStart);
    formData.set("consignment_end_date", consignmentEnd);
    formData.set("consignment_commission_pct", consignmentCommPct);
    formData.set("supplier_invoice_ref", supplierInvoiceRef);
    formData.set("secondary_stones", JSON.stringify(secondaryStones));

    startTransition(async () => {
      try {
        if (mode === "create") {
          await createInventoryItem(formData);
        } else if (item) {
          await updateInventoryItem(item.id, formData);
        }
      } catch (err) {
        // Next.js redirect() throws a sentinel error we must re-throw so the
        // framework can perform the navigation to /inventory/{id}. Swallowing
        // it leaves the user stranded on /inventory/new with no feedback.
        if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) {
          throw err;
        }
        setError(err instanceof Error ? err.message : "Failed to save item");
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <BasicInfoSection
        item={item}
        mode={mode}
        initialCategories={initialCategories}
        itemType={itemType}
        setItemType={setItemType}
        jewelleryType={jewelleryType}
        setJewelleryType={setJewelleryType}
        status={status}
        setStatus={setStatus}
        isFeatured={isFeatured}
        setIsFeatured={setIsFeatured}
        categoryId={categoryId}
        setCategoryId={setCategoryId}
        setError={setError}
        onAICategorize={setAiMetalStone}
      />

      <PricingSection
        item={item}
        costPrice={costPrice}
        setCostPrice={setCostPrice}
        retailPrice={retailPrice}
        setRetailPrice={setRetailPrice}
      />

      <MetalStoneSection
        item={item}
        itemType={itemType}
        jewelleryType={jewelleryType}
        metalForm={metalForm}
        setMetalForm={setMetalForm}
        secondaryStones={secondaryStones}
        setSecondaryStones={setSecondaryStones}
      />

      <CertificatesSection
        certNumber={certNumber}
        setCertNumber={setCertNumber}
        gradingLab={gradingLab}
        setGradingLab={setGradingLab}
        grade={grade}
        setGrade={setGrade}
        reportUrl={reportUrl}
        setReportUrl={setReportUrl}
      />

      <StockSection
        item={item}
        mode={mode}
        trackQuantity={trackQuantity}
        setTrackQuantity={setTrackQuantity}
        stockLocation={stockLocation}
        setStockLocation={setStockLocation}
        supplierInvoiceRef={supplierInvoiceRef}
        setSupplierInvoiceRef={setSupplierInvoiceRef}
      />

      <ConsignmentSection
        status={status}
        consignorName={consignorName}
        setConsignorName={setConsignorName}
        consignorContact={consignorContact}
        setConsignorContact={setConsignorContact}
        consignmentStart={consignmentStart}
        setConsignmentStart={setConsignmentStart}
        consignmentEnd={consignmentEnd}
        setConsignmentEnd={setConsignmentEnd}
        consignmentCommPct={consignmentCommPct}
        setConsignmentCommPct={setConsignmentCommPct}
      />

      <ImageUploadSection />

      {/* Actions */}
      <div className="flex items-center justify-between pb-12 pt-4">
        <a href={mode === "edit" && item ? `/inventory/${item.id}` : "/inventory"} className="px-5 py-2.5 text-sm font-bold text-stone-400 uppercase tracking-wider border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors">
          Cancel
        </a>
        <button
          type="submit"
          disabled={isPending}
          className="px-8 py-2.5 bg-amber-700 text-white text-sm font-bold uppercase tracking-widest rounded-lg hover:bg-amber-800 disabled:opacity-60 transition-colors shadow-sm flex items-center gap-2"
        >
          {isPending ? "Saving..." : mode === "create" ? "Add Item" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
