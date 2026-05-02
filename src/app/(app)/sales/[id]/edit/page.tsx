import { Suspense } from "react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AUTH_HEADERS } from "@/lib/cached-auth";
import SaleForm from "../../SaleForm";

export default function EditSalePage(props: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={null}>
      <EditSaleBody {...props} />
    </Suspense>
  );
}

async function EditSaleBody({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [headersList, supabase] = await Promise.all([headers(), createClient()]);
  const tenantId = headersList.get(AUTH_HEADERS.TENANT_ID);
  if (!tenantId) redirect("/login");

  const [saleResult, itemsResult, tenantResult, inventoryResult] = await Promise.all([
    supabase
      .from("sales")
      .select("id, customer_name, customer_email, status, payment_method, discount_amount, notes")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .single(),
    supabase
      .from("sale_items")
      .select("description, quantity, unit_price, discount_percent, inventory_id, sku")
      .eq("sale_id", id)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null),
    supabase.from("tenants").select("tax_rate, tax_name, currency").eq("id", tenantId).single(),
    supabase
      .from("inventory")
      .select("id, name, sku, retail_price, quantity")
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .is("deleted_at", null)
      .order("name", { ascending: true })
      .limit(500),
  ]);

  if (!saleResult.data) notFound();

  const taxRate = tenantResult.data?.tax_rate ?? 0.1;
  const taxName = tenantResult.data?.tax_name || "GST";
  const currency = tenantResult.data?.currency || "AUD";
  const inventory = (inventoryResult.data ?? []).map((i) => ({
    id: i.id,
    name: i.name,
    sku: i.sku,
    retail_price: Number(i.retail_price ?? 0),
    quantity: Number(i.quantity ?? 0),
  }));

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="font-semibold text-2xl font-semibold text-stone-900">Edit Sale</h1>
        <p className="text-stone-500 mt-1 text-sm">Update line items, customer, payment, or notes.</p>
      </div>
      <SaleForm
        taxRate={taxRate}
        taxName={taxName}
        currency={currency}
        inventory={inventory}
        initialSale={{
          id: saleResult.data.id,
          customer_name: saleResult.data.customer_name,
          customer_email: saleResult.data.customer_email,
          status: saleResult.data.status,
          payment_method: saleResult.data.payment_method,
          discount_amount: Number(saleResult.data.discount_amount ?? 0),
          notes: saleResult.data.notes,
        }}
        initialItems={(itemsResult.data ?? []).map((it) => ({
          description: it.description,
          quantity: it.quantity,
          unit_price: Number(it.unit_price ?? 0),
          discount_percent: Number(it.discount_percent ?? 0),
          inventory_id: it.inventory_id,
          sku: it.sku,
        }))}
      />
    </div>
  );
}
