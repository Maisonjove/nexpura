"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import BatchPrintModal from "./BatchPrintModal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Search, Tag, Edit, Diamond, Printer } from "lucide-react";
import QuickPrintTagModal from "@/components/QuickPrintTagModal";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Category {
  id: string;
  name: string;
}

interface InventoryItem {
  id: string;
  sku: string | null;
  name: string;
  item_type: string;
  jewellery_type: string | null;
  category_id: string | null;
  quantity: number;
  low_stock_threshold: number | null;
  retail_price: number;
  cost_price: number | null;
  status: string;
  is_featured: boolean;
  primary_image?: string | null;
  metal_type?: string | null;
  stone_type?: string | null;
  metal_weight_grams?: number | null;
  barcode_value?: string | null;
  stock_categories: { name: string } | null;
}

interface InventoryClientProps {
  items: InventoryItem[];
  categories: Category[];
  totalItems: number;
  lowStockCount: number;
  totalValue: number;
  tenantName?: string;
  canViewCost: boolean;
}

// ─── Sample data ──────────────────────────────────────────────────────────────

const SAMPLE_ITEMS: InventoryItem[] = [
  { id: "s1", sku: "NX-RNG-001", name: "Diamond Solitaire Ring", item_type: "jewellery", jewellery_type: "Rings", category_id: null, metal_type: "18k White Gold", stone_type: "Round Diamond", metal_weight_grams: null, barcode_value: "NX-HQ-RNG001", retail_price: 8500, cost_price: 4200, quantity: 1, low_stock_threshold: 1, is_featured: true, status: "active", primary_image: null, stock_categories: { name: "Rings" } },
  { id: "s2", sku: "NX-BRC-002", name: "Yellow Gold Tennis Bracelet", item_type: "jewellery", jewellery_type: "Bracelets", category_id: null, metal_type: "18k Yellow Gold", stone_type: "Natural Diamond", metal_weight_grams: null, barcode_value: "NX-HQ-BRC002", retail_price: 12400, cost_price: 6800, quantity: 1, low_stock_threshold: 1, is_featured: false, status: "active", primary_image: null, stock_categories: { name: "Bracelets" } },
  { id: "s3", sku: "NX-PND-003", name: "Sapphire Halo Pendant", item_type: "jewellery", jewellery_type: "Pendants", category_id: null, metal_type: "Platinum", stone_type: "Blue Sapphire", metal_weight_grams: null, barcode_value: "NX-HQ-PND003", retail_price: 6200, cost_price: 3100, quantity: 2, low_stock_threshold: 1, is_featured: false, status: "active", primary_image: null, stock_categories: { name: "Pendants" } },
  { id: "s4", sku: "NX-RNG-004", name: "Oval Lab Diamond Ring", item_type: "jewellery", jewellery_type: "Rings", category_id: null, metal_type: "18k Rose Gold", stone_type: "Lab Diamond", metal_weight_grams: null, barcode_value: "NX-HQ-RNG004", retail_price: 5800, cost_price: 2400, quantity: 0, low_stock_threshold: 1, is_featured: false, status: "active", primary_image: null, stock_categories: { name: "Rings" } },
  { id: "s5", sku: "NX-EAR-005", name: "Diamond Stud Earrings", item_type: "jewellery", jewellery_type: "Earrings", category_id: null, metal_type: "18k White Gold", stone_type: "Round Diamond", metal_weight_grams: null, barcode_value: "NX-HQ-EAR005", retail_price: 3200, cost_price: 1500, quantity: 3, low_stock_threshold: 2, is_featured: true, status: "active", primary_image: null, stock_categories: { name: "Earrings" } },
  { id: "s6", sku: "NX-WTC-006", name: "Ladies Diamond Watch", item_type: "jewellery", jewellery_type: "Watches", category_id: null, metal_type: "18k White Gold", stone_type: "Round Diamond", metal_weight_grams: null, barcode_value: "NX-HQ-WTC006", retail_price: 18000, cost_price: 9500, quantity: 1, low_stock_threshold: 2, is_featured: false, status: "active", primary_image: null, stock_categories: { name: "Watches" } },
];

const DiamondPlaceholder = () => (
  <div className="w-9 h-9 rounded-lg bg-stone-100 flex items-center justify-center text-stone-300">
    <Diamond className="w-4 h-4" />
  </div>
);

// ─── Component ────────────────────────────────────────────────────────────────

export default function InventoryClient({
  items,
  categories,
  totalItems,
  lowStockCount,
  totalValue,
  tenantName = "Nexpura",
  canViewCost,
}: InventoryClientProps) {
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterMetal, setFilterMetal] = useState("all");
  const [filterStone, setFilterStone] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBatchPrint, setShowBatchPrint] = useState(false);
  const [printItem, setPrintItem] = useState<(typeof items)[0] | null>(null);
  const [bulkAction, setBulkAction] = useState("");

  const useSampleData = items.length === 0;

  const filtered = useMemo(() => {
    if (useSampleData) return SAMPLE_ITEMS;
    return items.filter((item) => {
      const q = search.toLowerCase();
      if (q && !item.name.toLowerCase().includes(q) && !(item.sku?.toLowerCase() ?? "").includes(q)) return false;
      if (filterCategory !== "all" && item.category_id !== filterCategory) return false;
      if (filterMetal !== "all" && item.metal_type !== filterMetal) return false;
      if (filterStone !== "all" && item.stone_type !== filterStone) return false;
      if (filterStatus === "in_stock" && item.quantity <= 0) return false;
      if (filterStatus === "out_of_stock" && item.quantity > 0) return false;
      if (filterStatus === "low_stock") {
        const t = item.low_stock_threshold ?? 1;
        if (item.quantity > t || item.quantity <= 0) return false;
      }
      return true;
    });
  }, [items, useSampleData, search, filterCategory, filterMetal, filterStone, filterStatus]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (useSampleData) return;
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((i) => i.id)));
    }
  }

  const selectedItems = (useSampleData ? [] : items)
    .filter((i) => selectedIds.has(i.id))
    .map((i) => ({
      id: i.id,
      name: i.name,
      sku: i.sku,
      retail_price: i.retail_price,
      metal_type: i.metal_type ?? null,
      stone_type: i.stone_type ?? null,
      metal_weight_grams: i.metal_weight_grams ?? null,
      barcode_value: i.barcode_value ?? null,
    }));

  function exportLowStockCSV() {
    const lowStock = (useSampleData ? SAMPLE_ITEMS : items).filter((item) => {
      const t = item.low_stock_threshold ?? 1;
      return item.quantity <= t;
    });
    const rows = [
      ["SKU", "Name", "Quantity", "Threshold", "Retail Price", "Metal", "Stone"],
      ...lowStock.map((i) => [
        i.sku || "",
        i.name,
        i.quantity,
        i.low_stock_threshold ?? 1,
        i.retail_price,
        i.metal_type || "",
        i.stone_type || "",
      ]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `low-stock-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportAllCSV() {
    const allItems = useSampleData ? SAMPLE_ITEMS : filtered;
    const rows = [
      ["SKU", "Name", "Type", "Metal", "Stone", "Quantity", "Cost Price", "Retail Price", "Status"],
      ...allItems.map((i) => [
        i.sku || "",
        i.name,
        i.jewellery_type || i.item_type,
        i.metal_type || "",
        i.stone_type || "",
        i.quantity,
        i.cost_price ?? "",
        i.retail_price,
        i.status,
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const getStatusBadge = (quantity: number, threshold: number | null) => {
    if (quantity === 0) return <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">Out of Stock</Badge>;
    if (quantity <= (threshold ?? 1)) return <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">Low Stock</Badge>;
    return <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">In Stock</Badge>;
  };

  const clearFilters = () => {
    setSearch("");
    setFilterCategory("all");
    setFilterMetal("all");
    setFilterStone("all");
    setFilterStatus("all");
  };

  return (
    <div className="space-y-6 max-w-[1400px]">
      {showBatchPrint && selectedItems.length > 0 && (
        <BatchPrintModal
          items={selectedItems}
          tenantName={tenantName}
          onClose={() => setShowBatchPrint(false)}
        />
      )}

      {/* HEADER */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Inventory</h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              className="inline-flex items-center gap-1.5 h-9 px-3 border border-stone-200 rounded-md text-sm text-stone-600 hover:bg-stone-50 transition-colors"
              onClick={() => {
                const menu = document.getElementById("export-menu");
                if (menu) menu.classList.toggle("hidden");
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export
            </button>
            <div id="export-menu" className="hidden absolute right-0 top-10 z-20 bg-white border border-stone-200 rounded-xl shadow-lg py-1 min-w-40">
              <button
                onClick={() => { exportAllCSV(); document.getElementById("export-menu")?.classList.add("hidden"); }}
                className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
              >
                Export All (CSV)
              </button>
              <button
                onClick={() => { exportLowStockCSV(); document.getElementById("export-menu")?.classList.add("hidden"); }}
                className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
              >
                Export Low Stock (CSV)
              </button>
            </div>
          </div>
          <Link
            href="/inventory/receive"
            className="inline-flex items-center gap-1.5 h-9 px-3 border border-stone-200 rounded-md text-sm text-stone-600 hover:bg-stone-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
            </svg>
            Receive Stock
          </Link>
          <Link href="/inventory/new" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors bg-[#8B7355] hover:bg-[#7A6347] text-white h-9 px-4">
            <Plus className="w-4 h-4 mr-2" /> Add Item
          </Link>
        </div>
      </div>

      {/* BULK ACTIONS BAR */}
      {selectedIds.size > 0 && !useSampleData && (
        <div className="bg-[#8B7355]/10 border border-[#8B7355]/20 rounded-xl px-4 py-3 flex items-center gap-4">
          <span className="text-sm font-medium text-[#8B7355]">{selectedIds.size} item{selectedIds.size > 1 ? "s" : ""} selected</span>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => setShowBatchPrint(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-stone-200 text-stone-700 text-xs font-medium rounded-lg hover:bg-stone-50 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" /> Print Tags
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-stone-400 hover:text-stone-600"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* FILTER SECTION */}
      <div className="bg-white border border-stone-200 rounded-xl p-3 flex flex-wrap items-center gap-3 shadow-sm">
        <div className="relative max-w-xs w-full flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-stone-400" />
          <Input 
            placeholder="Search by name or SKU..." 
            className="pl-9 h-9 border-stone-200 text-sm focus-visible:ring-[#8B7355]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <Select value={filterCategory} onValueChange={(val) => setFilterCategory(val || "all")}>
          <SelectTrigger className="w-[140px] h-9 text-sm border-stone-200 focus:ring-[#8B7355]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="rings">Rings</SelectItem>
            <SelectItem value="necklaces">Necklaces</SelectItem>
            <SelectItem value="bracelets">Bracelets</SelectItem>
            <SelectItem value="earrings">Earrings</SelectItem>
            <SelectItem value="pendants">Pendants</SelectItem>
            <SelectItem value="watches">Watches</SelectItem>
            {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filterMetal} onValueChange={(val) => setFilterMetal(val || "all")}>
          <SelectTrigger className="w-[140px] h-9 text-sm border-stone-200 focus:ring-[#8B7355]">
            <SelectValue placeholder="Metal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Metals</SelectItem>
            <SelectItem value="18k White Gold">18k White Gold</SelectItem>
            <SelectItem value="18k Yellow Gold">18k Yellow Gold</SelectItem>
            <SelectItem value="18k Rose Gold">18k Rose Gold</SelectItem>
            <SelectItem value="Platinum">Platinum</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={(val) => setFilterStatus(val || "all")}>
          <SelectTrigger className="w-[140px] h-9 text-sm border-stone-200 focus:ring-[#8B7355]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="in_stock">In Stock</SelectItem>
            <SelectItem value="low_stock">Low Stock</SelectItem>
            <SelectItem value="out_of_stock">Out of Stock</SelectItem>
          </SelectContent>
        </Select>

        <button onClick={clearFilters} className="text-xs text-stone-400 hover:text-stone-600 transition-colors ml-auto px-2">
          Clear
        </button>
      </div>

      {/* TABLE */}
      <Card className="border-stone-200 shadow-sm rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-stone-200">
              <TableHead className="w-12 text-center">
                <Checkbox 
                  checked={!useSampleData && selectedIds.size === filtered.length && filtered.length > 0} 
                  onCheckedChange={toggleAll}
                  className="border-stone-300"
                />
              </TableHead>
              <TableHead className="w-16"></TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider text-stone-400">Name & SKU</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider text-stone-400">Metal & Stone</TableHead>
              {canViewCost && <TableHead className="text-xs font-medium uppercase tracking-wider text-stone-400 text-right">Cost</TableHead>}
              <TableHead className="text-xs font-medium uppercase tracking-wider text-stone-400 text-right">Price</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider text-stone-400 text-center">Stock</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider text-stone-400">Status</TableHead>
              <TableHead className="text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(useSampleData ? SAMPLE_ITEMS : filtered).map((item) => (
              <TableRow key={item.id} className="hover:bg-stone-50/80 border-stone-100">
                <TableCell className="text-center">
                  <Checkbox 
                    checked={selectedIds.has(item.id)} 
                    onCheckedChange={() => toggleSelect(item.id)}
                    className="border-stone-300"
                  />
                </TableCell>
                <TableCell>
                  {item.primary_image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.primary_image} alt={item.name} className="w-9 h-9 rounded-lg object-cover" />
                  ) : (
                    <DiamondPlaceholder />
                  )}
                </TableCell>
                <TableCell>
                  <p className="font-medium text-sm text-stone-900">{item.name}</p>
                  <p className="text-xs text-stone-400 mt-0.5">{item.sku || "—"}</p>
                </TableCell>
                <TableCell>
                  <p className="text-sm text-stone-700">{item.metal_type || "—"}</p>
                  <p className="text-xs text-stone-400 mt-0.5">{item.stone_type || "—"}</p>
                </TableCell>
                {canViewCost && (
                  <TableCell className="text-right text-sm text-stone-500">
                    ${item.cost_price?.toLocaleString() || "—"}
                  </TableCell>
                )}
                <TableCell className="text-right text-sm font-medium text-stone-900">
                  ${item.retail_price.toLocaleString()}
                </TableCell>
                <TableCell className="text-center text-sm text-stone-700">
                  {item.quantity}
                </TableCell>
                <TableCell>
                  {getStatusBadge(item.quantity, item.low_stock_threshold)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => setPrintItem(item)}
                      title="Print Stock Tag"
                      className="inline-flex items-center justify-center rounded-md font-medium transition-colors hover:bg-amber-50 h-8 text-stone-400 hover:text-[#8B7355] px-2 text-sm"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                    <Link href={`/inventory/${item.id}`} className="inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium transition-colors hover:bg-stone-100 h-8 text-stone-500 hover:text-stone-900 px-2 text-sm">
                      <Edit className="w-4 h-4 mr-1" /> Edit
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Quick Print Tag Modal */}
      {printItem && (
        <QuickPrintTagModal
          item={{
            id: printItem.id,
            name: printItem.name,
            sku: printItem.sku,
            retail_price: printItem.retail_price,
            metal_type: printItem.metal_type ?? null,
            stone_type: printItem.stone_type ?? null,
            metal_weight_grams: printItem.metal_weight_grams ?? null,
            barcode_value: printItem.sku || printItem.id.substring(0, 12).toUpperCase(),
          }}
          tenantName={tenantName}
          onClose={() => setPrintItem(null)}
        />
      )}
    </div>
  );
}
