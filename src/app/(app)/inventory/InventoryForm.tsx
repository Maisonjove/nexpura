"use client";

import Link from "next/link";
import { useState, useTransition, useRef, useEffect } from "react";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { createInventoryItem, updateInventoryItem } from "./actions";
import { SubmitButton } from "@/components/ui/submit-button";

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

    // Cost vs retail validation: warn if retail < cost (loss-per-unit).
    // Block submit unless the user explicitly confirmed by clicking
    // through. The PricingSection paints the warning panel; here we gate
    // submission so a misclick can't ship a money-losing price.
    const cost = parseFloat(costPrice);
    const retail = parseFloat(retailPrice);
    if (!isNaN(cost) && !isNaN(retail) && cost > 0 && retail > 0 && retail < cost) {
      const confirmed = window.confirm(
        `Retail price ($${retail.toFixed(2)}) is below cost ($${cost.toFixed(2)}). ` +
        `You'll lose $${(cost - retail).toFixed(2)} per unit sold. Continue anyway?`
      );
      if (!confirmed) return;
    }

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
        // The action returns `{ error }` for validation failures (e.g. user
        // is in "All Locations" view) and `redirect()`s on success — Next.js
        // sanitises thrown errors in production so the form would otherwise
        // see a generic "Server Components render" message instead of the
        // actionable reason. Read the return value and surface it.
        const result =
          mode === "create"
            ? await createInventoryItem(formData)
            : item
              ? await updateInventoryItem(item.id, formData)
              : undefined;
        if (result && typeof result === "object" && "error" in result && result.error) {
          setError(String(result.error));
          return;
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

  const cancelHref = mode === "edit" && item ? `/inventory/${item.id}` : "/inventory";
  const idleLabel = mode === "create" ? "Add Item" : "Save Changes";

  return (
    <div className="bg-nexpura-ivory min-h-screen">
      <div className="max-w-[960px] mx-auto px-6 sm:px-10 lg:px-16 py-12 lg:py-16">
        {/* Page Header */}
        <div className="flex items-start justify-between gap-6 mb-14">
          <div className="flex items-start gap-4">
            <Link
              href={cancelHref}
              className="mt-2 text-stone-400 hover:text-nexpura-bronze transition-colors duration-300"
              aria-label="Back"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </Link>
            <div>
              <p className="text-xs uppercase tracking-luxury text-stone-500 mb-3">
                Inventory
              </p>
              <h1 className="font-serif text-4xl sm:text-5xl text-stone-900 leading-[1.08] tracking-tight">
                {mode === "create" ? "New Item" : "Edit Item"}
              </h1>
              <p className="text-stone-500 mt-4 max-w-xl leading-relaxed">
                {mode === "create"
                  ? "Add a piece to your catalogue. The AI auto-categorize tool fills in metal, stone, and category from the name."
                  : "Update the details of an existing piece. Stock quantity is adjusted from the item page."}
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <Link
              href={cancelHref}
              className="px-4 py-2 rounded-md text-sm font-medium text-stone-500 hover:text-stone-700 transition-colors duration-200"
            >
              Cancel
            </Link>
            <SubmitButton
              form="inventory-form"
              isPending={isPending}
              idleLabel={idleLabel}
              pendingLabel="Saving…"
              className="nx-btn-primary disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        <form
          id="inventory-form"
          ref={formRef}
          onSubmit={handleSubmit}
          className="space-y-8 lg:space-y-12"
        >
          {error && (
            <div
              role="alert"
              className="border-l-2 border-red-400 pl-4 py-1 text-sm text-red-600 leading-relaxed"
            >
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

          <ImageUploadSection initialUrl={item?.primary_image ?? null} />

          {/* Footer actions — visible on small screens, mirrors the header CTA */}
          <div className="flex items-center justify-end gap-2 pt-2 sm:hidden">
            <Link
              href={cancelHref}
              className="px-4 py-2 rounded-md text-sm font-medium text-stone-500 hover:text-stone-700 transition-colors duration-200"
            >
              Cancel
            </Link>
            <SubmitButton
              isPending={isPending}
              idleLabel={idleLabel}
              pendingLabel="Saving…"
              className="nx-btn-primary disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>
        </form>
      </div>
    </div>
  );
}
