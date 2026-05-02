"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus, Search, Edit, Diamond, Printer, Camera, Eye, Globe,
  Package, Grid3X3, List, AlertTriangle, DollarSign,
  Filter, X, FileText, CheckCircle, AlertCircle, Layers, TrendingDown
} from "lucide-react";
import { ExportDropdown } from "@/components/ExportButtons";
import { formatCurrencyForExport, formatDateForExport } from "@/lib/export";
import { HelpTooltip } from "@/components/ui/HelpTooltip";

// Lazy-load heavy modal components - only loaded when user interacts with them
const BatchPrintModal = dynamic(() => import("./BatchPrintModal"), { ssr: false });
const AddStockModal = dynamic(() => import("./AddStockModal"), { ssr: false });
const StockDetailModal = dynamic(() => import("./StockDetailModal"), { ssr: false });
const ScanInvoiceModal = dynamic(() => import("./ScanInvoiceModal"), { ssr: false });
const QuickPrintTagModal = dynamic(() => import("@/components/QuickPrintTagModal"), { ssr: false });
const CameraScannerModal = dynamic(() => import("@/components/CameraScannerModal"), { ssr: false });

// ─── Types ────────────────────────────────────────────────────────────────────

interface Category {
  id: string;
  name: string;
}

interface Supplier {
  id: string;
  name: string;
}

interface InventoryItem {
  id: string;
  sku: string | null;
  name: string;
  description: string | null;
  item_type: string;
  jewellery_type: string | null;
  category_id: string | null;
  quantity: number;
  low_stock_threshold: number | null;
  retail_price: number;
  cost_price: number | null;
  status: string;
  is_featured: boolean;
  primary_image: string | null;
  stock_number: string | null;
  is_consignment: boolean;
  listed_on_website: boolean;
  supplier_id: string | null;
  metal_type: string | null;
  stone_type: string | null;
  metal_weight_grams: number | null;
  barcode_value: string | null;
  tags: string[] | null;
  created_at: string;
  stock_categories: { name: string } | null;
  suppliers: { name: string } | null;
}

interface InventoryClientProps {
  items: InventoryItem[];
  categories: Category[];
  suppliers: Supplier[];
  totalItems: number;
  lowStockCount: number;
  totalValue: number;
  tenantName: string;
  canViewCost: boolean;
  hasWebsite: boolean;
  currentPage?: number;
  totalPages?: number;
  itemsPerPage?: number;
  /** Section 6.2 (Kaitlyn 2026-05-02 brief): when true the page is
   *  rendered as the dashboard's "Low Stock" deeplink — focused header,
   *  oxblood/emerald KPI strip, alt empty state. */
  lowStockOnly?: boolean;
  criticalCount?: number;
  materialsCount?: number;
  estimatedReorderValue?: number;
}

// ─── Status Config ────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  available: { label: "Available", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  in_stock: { label: "In Stock", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  active: { label: "Active", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  sold: { label: "Sold", color: "bg-blue-50 text-blue-700 border-blue-200" },
  unavailable: { label: "Unavailable", color: "bg-red-50 text-red-700 border-red-200" },
  out_of_stock: { label: "Out of Stock", color: "bg-red-50 text-red-700 border-red-200" },
  reserved: { label: "Reserved", color: "bg-amber-50 text-amber-700 border-amber-200" },
  consignment: { label: "Consignment", color: "bg-purple-50 text-purple-700 border-purple-200" },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function InventoryClient({
  items,
  categories,
  suppliers,
  totalItems,
  lowStockCount,
  totalValue,
  tenantName,
  canViewCost,
  hasWebsite,
  currentPage = 1,
  totalPages = 1,
  itemsPerPage = 100,
  lowStockOnly = false,
  criticalCount = 0,
  materialsCount = 0,
  estimatedReorderValue = 0,
}: InventoryClientProps) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSupplier, setFilterSupplier] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBatchPrint, setShowBatchPrint] = useState(false);
  const [showAddStock, setShowAddStock] = useState(false);
  const [printItem, setPrintItem] = useState<InventoryItem | null>(null);
  const [detailItem, setDetailItem] = useState<InventoryItem | null>(null);
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showScanInvoice, setShowScanInvoice] = useState(false);

  // Filter items
  const filtered = useMemo(() => {
    return items.filter((item) => {
      const q = search.toLowerCase();
      if (q) {
        const matchesSearch =
          item.name.toLowerCase().includes(q) ||
          (item.sku?.toLowerCase() ?? "").includes(q) ||
          (item.stock_number?.toLowerCase() ?? "").includes(q) ||
          (item.barcode_value?.toLowerCase() ?? "").includes(q) ||
          (item.description?.toLowerCase() ?? "").includes(q);
        if (!matchesSearch) return false;
      }
      
      if (filterStatus !== "all") {
        if (filterStatus === "on_website" && !item.listed_on_website) return false;
        else if (filterStatus !== "on_website" && item.status !== filterStatus) return false;
      }
      
      if (filterSupplier !== "all" && item.supplier_id !== filterSupplier) return false;
      
      if (filterType !== "all" && item.jewellery_type !== filterType) return false;
      
      return true;
    });
  }, [items, search, filterStatus, filterSupplier, filterType]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((i) => i.id)));
    }
  }

  const selectedItems = items
    .filter((i) => selectedIds.has(i.id))
    .map((i) => ({
      id: i.id,
      name: i.name,
      sku: i.stock_number || i.sku,
      retail_price: i.retail_price,
      metal_type: i.metal_type ?? null,
      stone_type: i.stone_type ?? null,
      metal_weight_grams: i.metal_weight_grams ?? null,
      barcode_value: i.barcode_value ?? null,
    }));

  const clearFilters = () => {
    setSearch("");
    setFilterStatus("all");
    setFilterSupplier("all");
    setFilterType("all");
  };

  const hasActiveFilters = search || filterStatus !== "all" || filterSupplier !== "all" || filterType !== "all";

  const getStatusBadge = (item: InventoryItem) => {
    const config = STATUS_CONFIG[item.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.available;
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${config.color}`}>
        {config.label}
      </span>
    );
  };

  // Get unique jewellery types for filter
  const jewelleryTypes = useMemo(() => {
    const types = new Set(items.map((i) => i.jewellery_type).filter(Boolean));
    return Array.from(types) as string[];
  }, [items]);

  return (
    <div className="space-y-6 max-w-[1600px]">
      {/* Modals */}
      {showBatchPrint && selectedItems.length > 0 && (
        <BatchPrintModal
          items={selectedItems}
          tenantName={tenantName}
          onClose={() => setShowBatchPrint(false)}
        />
      )}

      {showAddStock && (
        <AddStockModal
          suppliers={suppliers}
          onClose={() => setShowAddStock(false)}
          onSuccess={() => window.location.reload()}
        />
      )}

      {printItem && (
        <QuickPrintTagModal
          item={{
            id: printItem.id,
            name: printItem.name,
            sku: printItem.stock_number || printItem.sku,
            retail_price: printItem.retail_price,
            metal_type: printItem.metal_type ?? null,
            stone_type: printItem.stone_type ?? null,
            metal_weight_grams: printItem.metal_weight_grams ?? null,
            barcode_value: printItem.barcode_value || printItem.stock_number || printItem.sku || printItem.id.substring(0, 12).toUpperCase(),
          }}
          tenantName={tenantName}
          onClose={() => setPrintItem(null)}
        />
      )}

      {detailItem && (
        <StockDetailModal
          item={detailItem}
          tenantName={tenantName}
          canViewCost={canViewCost}
          hasWebsite={hasWebsite}
          onClose={() => setDetailItem(null)}
          onUpdate={() => window.location.reload()}
        />
      )}

      {showCameraScanner && (
        <CameraScannerModal
          title="Scan Item Barcode"
          onScan={(barcode) => {
            const found = items.find(
              (i) => i.barcode_value === barcode || i.sku === barcode || i.stock_number === barcode
            );
            if (found) {
              setDetailItem(found);
            } else {
              setSearch(barcode);
            }
            setShowCameraScanner(false);
          }}
          onClose={() => setShowCameraScanner(false)}
        />
      )}

      {showScanInvoice && (
        <ScanInvoiceModal
          suppliers={suppliers}
          onClose={() => setShowScanInvoice(false)}
          onSuccess={() => window.location.reload()}
        />
      )}

      {/* Header — Section 6.2 of Kaitlyn's redesign brief swaps the title
          and breadcrumb when the page is loaded as the low-stock deeplink
          from the dashboard KPI chip (?status=low-stock). */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          {lowStockOnly && (
            <nav className="flex items-center gap-1.5 mb-2">
              <Link href="/dashboard" className="text-xs text-nexpura-charcoal-500 hover:text-nexpura-charcoal-700 transition-colors">
                Dashboard
              </Link>
              <span className="text-nexpura-taupe-200 text-xs">/</span>
              <Link href="/inventory" className="text-xs text-nexpura-charcoal-500 hover:text-nexpura-charcoal-700 transition-colors">
                Inventory
              </Link>
              <span className="text-nexpura-taupe-200 text-xs">/</span>
              <span className="text-xs text-nexpura-charcoal-700 font-medium">Low Stock</span>
            </nav>
          )}
          <h1 className="text-2xl font-bold text-nexpura-charcoal-700">
            {lowStockOnly ? "Low Stock" : "Inventory"}
          </h1>
          <p className="text-sm text-nexpura-charcoal-500 mt-0.5">
            {lowStockOnly
              ? "Items below reorder thresholds and materials requiring attention."
              : "Manage your stock and items"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCameraScanner(true)}
            className="inline-flex items-center gap-1.5 h-10 px-4 border border-stone-200 rounded-xl text-sm text-stone-600 hover:bg-stone-50 transition-colors"
          >
            <Camera className="w-4 h-4" />
            <span className="hidden sm:inline">Scan</span>
          </button>
          <button
            onClick={() => setShowScanInvoice(true)}
            className="inline-flex items-center gap-2 h-10 px-4 border border-amber-200 bg-amber-50 rounded-xl text-sm text-amber-700 hover:bg-amber-100 transition-colors"
          >
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Scan Invoice</span>
          </button>
          <ExportDropdown
            data={filtered.map(i => ({
              name: i.name,
              sku: i.sku || '',
              stock_number: i.stock_number || '',
              category: i.stock_categories?.name || '',
              supplier: i.suppliers?.name || '',
              quantity: i.quantity,
              retail_price: formatCurrencyForExport(i.retail_price),
              cost_price: canViewCost ? formatCurrencyForExport(i.cost_price) : '',
              status: (STATUS_CONFIG[i.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.available).label,
              jewellery_type: i.jewellery_type || '',
              metal_type: i.metal_type || '',
              stone_type: i.stone_type || '',
              listed_on_website: i.listed_on_website ? 'Yes' : 'No',
              created_at: formatDateForExport(i.created_at),
            }))}
            columns={[
              { key: 'name', label: 'Name' },
              { key: 'sku', label: 'SKU' },
              { key: 'stock_number', label: 'Stock Number' },
              { key: 'category', label: 'Category' },
              { key: 'supplier', label: 'Supplier' },
              { key: 'quantity', label: 'Quantity' },
              { key: 'retail_price', label: 'Retail Price' },
              ...(canViewCost ? [{ key: 'cost_price' as const, label: 'Cost Price' }] : []),
              { key: 'status', label: 'Status' },
              { key: 'jewellery_type', label: 'Jewellery Type' },
              { key: 'metal_type', label: 'Metal Type' },
              { key: 'stone_type', label: 'Stone Type' },
              { key: 'listed_on_website', label: 'On Website' },
              { key: 'created_at', label: 'Created' },
            ]}
            filename={`inventory-export-${new Date().toISOString().split('T')[0]}`}
            sheetName="Inventory"
          />
          <Link
            href="/inventory/new"
            className="inline-flex items-center gap-2 h-10 px-5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-medium rounded-xl transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Item
          </Link>
        </div>
      </div>

      {/* Stats Cards — KPI strip swaps to the low-stock view (Section
          6.2). Critical (oxblood) lifts items already at zero qty,
          Materials counts raw-material items, Estimated reorder value
          sums (threshold − qty) × cost across items below threshold. */}
      {lowStockOnly ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 border-nexpura-taupe-100 bg-nexpura-ivory-elevated">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-nexpura-amber-bg flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-nexpura-amber-muted" />
              </div>
              <div>
                <p className="text-2xl font-bold text-nexpura-charcoal-700">{items.length}</p>
                <p className="text-xs text-nexpura-charcoal-500">Low stock items</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 border-nexpura-taupe-100 bg-nexpura-ivory-elevated">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-nexpura-oxblood-bg flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-nexpura-oxblood" />
              </div>
              <div>
                <p className="text-2xl font-bold text-nexpura-oxblood">{criticalCount}</p>
                <p className="text-xs text-nexpura-charcoal-500">Critical stock</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 border-nexpura-taupe-100 bg-nexpura-ivory-elevated">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-nexpura-warm flex items-center justify-center">
                <Layers className="w-5 h-5 text-nexpura-charcoal-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-nexpura-charcoal-700">{materialsCount}</p>
                <p className="text-xs text-nexpura-charcoal-500">Materials</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 border-nexpura-taupe-100 bg-nexpura-ivory-elevated">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-nexpura-emerald-bg flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-nexpura-emerald-deep" />
              </div>
              <div>
                <p className="text-2xl font-bold text-nexpura-charcoal-700">
                  ${Math.round(estimatedReorderValue).toLocaleString()}
                </p>
                <p className="text-xs text-nexpura-charcoal-500">Est. reorder value</p>
              </div>
            </div>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 border-stone-200 bg-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center">
                <Package className="w-5 h-5 text-stone-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-stone-900">{totalItems}</p>
                <p className="text-xs text-stone-500">Total Items</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 border-stone-200 bg-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-600">{lowStockCount}</p>
                <div className="flex items-center gap-1">
                  <p className="text-xs text-stone-500">Low Stock</p>
                  <HelpTooltip content="Items below their low stock threshold. Set this per item to get alerts when inventory is running low." size={12} />
                </div>
              </div>
            </div>
          </Card>
          <Card className="p-4 border-stone-200 bg-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-stone-900">
                  ${totalValue.toLocaleString()}
                </p>
                <p className="text-xs text-stone-500">Total Value</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 border-stone-200 bg-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <Globe className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-stone-900">
                  {items.filter((i) => i.listed_on_website).length}
                </p>
                <div className="flex items-center gap-1">
                  <p className="text-xs text-stone-500">On Website</p>
                  <HelpTooltip content="Items currently listed on your public website store. Toggle visibility in each item's settings." size={12} />
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-amber-100/50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-4">
          <span className="text-sm font-medium text-amber-800">
            {selectedIds.size} item{selectedIds.size > 1 ? "s" : ""} selected
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => setShowBatchPrint(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-amber-200 text-amber-800 text-xs font-medium rounded-lg hover:bg-amber-50 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" /> Print Tags
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-stone-400 hover:text-stone-600 px-2"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Search & Filters */}
      <div className="bg-white border border-stone-200 rounded-xl p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[250px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
            <Input
              placeholder="Search by name, stock #, SKU..."
              className="pl-10 h-10 border-stone-200 rounded-xl text-sm focus-visible:ring-amber-500"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Quick Status Filters */}
          <div className="flex items-center gap-2">
            {["all", "available", "sold", "on_website"].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  filterStatus === status
                    ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300"
                    : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                }`}
              >
                {status === "all" ? "All" : status === "on_website" ? "On Web" : status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>

          {/* More Filters Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
              showFilters ? "bg-amber-100 text-amber-800" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            Filters
            {hasActiveFilters && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            )}
          </button>

          {/* View Toggle */}
          <div className="flex items-center border border-stone-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 ${viewMode === "grid" ? "bg-stone-100" : "hover:bg-stone-50"}`}
            >
              <Grid3X3 className="w-4 h-4 text-stone-600" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 ${viewMode === "list" ? "bg-stone-100" : "hover:bg-stone-50"}`}
            >
              <List className="w-4 h-4 text-stone-600" />
            </button>
          </div>
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-stone-100">
            <Select value={filterSupplier} onValueChange={setFilterSupplier}>
              <SelectTrigger className="w-[160px] h-9 text-sm border-stone-200 rounded-lg">
                <SelectValue placeholder="Supplier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Suppliers</SelectItem>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[160px] h-9 text-sm border-stone-200 rounded-lg">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {jewelleryTypes.map((type) => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-amber-700 hover:text-amber-800 flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Clear all
              </button>
            )}
          </div>
        )}
      </div>

      {/* Items Grid/List */}
      {filtered.length === 0 ? (
        <Card className="border-nexpura-taupe-100 rounded-xl overflow-hidden bg-nexpura-ivory-elevated">
          <div className="p-16 text-center">
            {lowStockOnly ? (
              <>
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-nexpura-emerald-bg flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-nexpura-emerald-deep" />
                </div>
                <h3 className="font-semibold text-lg text-nexpura-charcoal-700">
                  All inventory is at healthy levels
                </h3>
                <p className="text-nexpura-charcoal-500 mt-1 text-sm">
                  Items below their reorder threshold will appear here.
                </p>
                <Link
                  href="/inventory"
                  className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-nexpura-charcoal text-white text-sm font-medium rounded-xl hover:bg-nexpura-charcoal-700 transition-colors"
                >
                  <Package className="w-4 h-4" />
                  View all inventory
                </Link>
              </>
            ) : (
              <>
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-stone-100 to-stone-200 flex items-center justify-center">
                  <Diamond className="w-8 h-8 text-amber-600" />
                </div>
                <h3 className="font-semibold text-lg text-stone-900">
                  {/* Gate on the authoritative tenant-wide count, not on the current
                      page's items array. items.length can be 0 while totalItems > 0
                      (empty page past the last, filtered-out subset, cache skew),
                      which previously produced a contradiction: top counter said
                      "1 Total Items" while the empty-state said "No inventory yet". */}
                  {totalItems === 0 ? "No inventory yet" : "No items match your filters"}
                </h3>
                <p className="text-stone-500 mt-1 text-sm">
                  {totalItems === 0
                    ? "Add your first item to start tracking stock."
                    : "Try adjusting your search or filters."}
                </p>
                {totalItems === 0 && (
                  <Link
                    href="/inventory/new"
                    className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-amber-600 text-white text-sm font-medium rounded-xl hover:bg-amber-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add your first item
                  </Link>
                )}
              </>
            )}
          </div>
        </Card>
      ) : viewMode === "grid" ? (
        /* Grid View */
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((item) => (
            <Card
              key={item.id}
              className="group border-stone-200 rounded-xl overflow-hidden hover:shadow-lg hover:border-amber-300 transition-all cursor-pointer"
              onClick={() => setDetailItem(item)}
            >
              {/* Image */}
              <div className="relative aspect-square bg-gradient-to-br from-stone-100 to-stone-50">
                {item.primary_image ? (
                  <Image
                    src={item.primary_image}
                    alt={item.name}
                    width={300}
                    height={300}
                    className="w-full h-full object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Diamond className="w-12 h-12 text-stone-300" />
                  </div>
                )}
                
                {/* Badges */}
                <div className="absolute top-2 left-2 flex flex-col gap-1">
                  {item.is_consignment && (
                    <span className="px-2 py-0.5 bg-purple-600 text-white text-[10px] font-medium rounded-full">
                      Consignment
                    </span>
                  )}
                  {item.listed_on_website && (
                    <span className="px-2 py-0.5 bg-blue-600 text-white text-[10px] font-medium rounded-full flex items-center gap-1">
                      <Globe className="w-3 h-3" /> Web
                    </span>
                  )}
                </div>

                {/* Stock Number */}
                <div className="absolute top-2 right-2">
                  <span className="px-2 py-1 bg-white/90 backdrop-blur-sm text-xs font-mono font-semibold text-amber-700 rounded-lg shadow-sm">
                    {item.stock_number || item.sku || "—"}
                  </span>
                </div>

                {/* Quick Actions (on hover) */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDetailItem(item);
                    }}
                    className="p-2 bg-white rounded-lg shadow-lg hover:bg-stone-50 transition-colors"
                  >
                    <Eye className="w-4 h-4 text-stone-700" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPrintItem(item);
                    }}
                    className="p-2 bg-white rounded-lg shadow-lg hover:bg-stone-50 transition-colors"
                  >
                    <Printer className="w-4 h-4 text-stone-700" />
                  </button>
                  <Link
                    href={`/inventory/${item.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="p-2 bg-white rounded-lg shadow-lg hover:bg-stone-50 transition-colors"
                  >
                    <Edit className="w-4 h-4 text-stone-700" />
                  </Link>
                </div>

                {/* Selection Checkbox */}
                <div className="absolute bottom-2 left-2">
                  <Checkbox
                    checked={selectedIds.has(item.id)}
                    onCheckedChange={() => toggleSelect(item.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="border-white bg-white/80 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                  />
                </div>
              </div>

              {/* Info */}
              <div className="p-3">
                <h3 className="font-medium text-sm text-stone-900 line-clamp-1">{item.name}</h3>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-lg font-bold text-stone-900">
                    ${item.retail_price.toLocaleString()}
                  </span>
                  {getStatusBadge(item)}
                </div>
                {(item.metal_type || item.stone_type) && (
                  <p className="text-xs text-stone-400 mt-1 truncate">
                    {[item.metal_type, item.stone_type].filter(Boolean).join(" • ")}
                  </p>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        /* List View */
        <Card className="border-stone-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50/50">
                  <th className="w-12 px-4 py-3">
                    <Checkbox
                      checked={selectedIds.size === filtered.length && filtered.length > 0}
                      onCheckedChange={toggleAll}
                      className="border-stone-300"
                    />
                  </th>
                  <th className="w-14"></th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">
                    Stock #
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">
                    Type
                  </th>
                  {canViewCost && (
                    <th className="text-right px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">
                      Cost
                    </th>
                  )}
                  <th className="text-right px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filtered.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-stone-50/50 cursor-pointer transition-colors"
                    onClick={() => setDetailItem(item)}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(item.id)}
                        onCheckedChange={() => toggleSelect(item.id)}
                        className="border-stone-300"
                      />
                    </td>
                    <td className="px-2 py-2">
                      {item.primary_image ? (
                        <Image
                          src={item.primary_image}
                          alt={item.name}
                          width={40}
                          height={40}
                          className="w-10 h-10 rounded-lg object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center">
                          <Diamond className="w-4 h-4 text-stone-300" />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm font-medium text-amber-700">
                        {item.stock_number || item.sku || "—"}
                      </span>
                      {item.is_consignment && (
                        <span className="ml-2 px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-medium rounded">
                          C
                        </span>
                      )}
                      {item.listed_on_website && (
                        <span className="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-medium rounded">
                          W
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-sm text-stone-900">{item.name}</p>
                      {item.suppliers?.name && (
                        <p className="text-xs text-stone-400">{item.suppliers.name}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-stone-600 capitalize">
                        {item.jewellery_type || item.item_type}
                      </span>
                    </td>
                    {canViewCost && (
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-stone-500">
                          ${item.cost_price?.toLocaleString() ?? "—"}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-semibold text-stone-900">
                        ${item.retail_price.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {getStatusBadge(item)}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setPrintItem(item)}
                          className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-amber-600 transition-colors"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <Link
                          href={`/inventory/${item.id}`}
                          className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-700 transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Results Count & Pagination */}
      {filtered.length > 0 && (
        <div className="flex flex-col items-center gap-3">
          <div className="text-sm text-stone-400">
            Showing {filtered.length} of {totalItems} items
            {totalPages > 1 && ` (Page ${currentPage} of ${totalPages})`}
          </div>
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <a
                href={currentPage > 1 ? `?page=${currentPage - 1}` : "#"}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  currentPage > 1
                    ? "border-stone-200 hover:bg-stone-50 text-stone-700"
                    : "border-stone-100 text-stone-300 cursor-not-allowed"
                }`}
                onClick={(e) => currentPage <= 1 && e.preventDefault()}
              >
                Previous
              </a>
              
              {/* Page numbers */}
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <a
                      key={pageNum}
                      href={`?page=${pageNum}`}
                      className={`w-8 h-8 flex items-center justify-center text-sm rounded-lg transition-colors ${
                        pageNum === currentPage
                          ? "bg-stone-900 text-white"
                          : "hover:bg-stone-100 text-stone-600"
                      }`}
                    >
                      {pageNum}
                    </a>
                  );
                })}
              </div>
              
              <a
                href={currentPage < totalPages ? `?page=${currentPage + 1}` : "#"}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  currentPage < totalPages
                    ? "border-stone-200 hover:bg-stone-50 text-stone-700"
                    : "border-stone-100 text-stone-300 cursor-not-allowed"
                }`}
                onClick={(e) => currentPage >= totalPages && e.preventDefault()}
              >
                Next
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
