"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  SparklesIcon,
  PrinterIcon,
  CameraIcon,
  EyeIcon,
  GlobeAltIcon,
  Squares2X2Icon,
  ListBulletIcon,
  AdjustmentsHorizontalIcon,
  XMarkIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ArchiveBoxIcon,
} from "@heroicons/react/24/outline";
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

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  available: { label: "Available", badge: "nx-badge-success" },
  in_stock: { label: "In Stock", badge: "nx-badge-success" },
  active: { label: "Active", badge: "nx-badge-success" },
  sold: { label: "Sold", badge: "nx-badge-neutral" },
  unavailable: { label: "Unavailable", badge: "nx-badge-danger" },
  out_of_stock: { label: "Out of Stock", badge: "nx-badge-danger" },
  reserved: { label: "Reserved", badge: "nx-badge-warning" },
  consignment: { label: "Consignment", badge: "nx-badge-neutral" },
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
    const config = STATUS_CONFIG[item.status] || STATUS_CONFIG.available;
    return <span className={config.badge}>{config.label}</span>;
  };

  // Get unique jewellery types for filter
  const jewelleryTypes = useMemo(() => {
    const types = new Set(items.map((i) => i.jewellery_type).filter(Boolean));
    return Array.from(types) as string[];
  }, [items]);

  const onWebsiteCount = useMemo(
    () => items.filter((i) => i.listed_on_website).length,
    [items]
  );

  return (
    <div className="bg-nexpura-ivory min-h-screen -mx-6 sm:-mx-10 lg:-mx-16 -my-8 lg:-my-12">
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

      <div className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 py-12 lg:py-16">
        {/* Page Header — Section 6.2 of Kaitlyn's redesign brief swaps the title
            and breadcrumb when the page is loaded as the low-stock deeplink
            from the dashboard KPI chip (?status=low-stock). */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 mb-14">
          <div>
            {lowStockOnly ? (
              <nav className="flex items-center gap-1.5 mb-3">
                <Link href="/dashboard" className="text-xs uppercase tracking-luxury text-stone-500 hover:text-nexpura-bronze transition-colors duration-300">
                  Dashboard
                </Link>
                <span className="text-stone-300 text-xs">/</span>
                <Link href="/inventory" className="text-xs uppercase tracking-luxury text-stone-500 hover:text-nexpura-bronze transition-colors duration-300">
                  Inventory
                </Link>
                <span className="text-stone-300 text-xs">/</span>
                <span className="text-xs uppercase tracking-luxury text-stone-700">Low Stock</span>
              </nav>
            ) : (
              <p className="text-xs uppercase tracking-luxury text-stone-500 mb-3">
                Inventory
              </p>
            )}
            <h1 className="font-serif text-4xl sm:text-5xl text-stone-900 leading-tight tracking-tight">
              {lowStockOnly ? "Low Stock" : "Inventory"}
            </h1>
            <p className="text-stone-500 mt-4 max-w-xl leading-relaxed">
              {lowStockOnly
                ? "Items below reorder thresholds and materials requiring attention."
                : "Manage your stock and items across every location."}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              onClick={() => setShowCameraScanner(true)}
              className="inline-flex items-center gap-2 h-10 px-4 border border-stone-200 bg-white rounded-full text-sm text-stone-600 hover:border-stone-300 hover:text-stone-900 transition-all duration-300"
            >
              <CameraIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Scan</span>
            </button>
            <button
              onClick={() => setShowScanInvoice(true)}
              className="inline-flex items-center gap-2 h-10 px-4 border border-stone-200 bg-white rounded-full text-sm text-stone-600 hover:border-stone-300 hover:text-stone-900 transition-all duration-300"
            >
              <DocumentTextIcon className="w-4 h-4" />
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
                status: (STATUS_CONFIG[i.status] || STATUS_CONFIG.available).label,
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
              className="nx-btn-primary inline-flex items-center gap-2"
            >
              <PlusIcon className="w-4 h-4" />
              Add Item
            </Link>
          </div>
        </div>

        {/* Stat strip — hairline divides + serif figures + tracking-luxury eyebrows.
            Section 6.2 swaps the strip to the focused low-stock summary. */}
        {lowStockOnly ? (
          <div className="bg-white border border-stone-200 rounded-2xl mb-10 grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-stone-200">
            <div className="px-7 py-6">
              <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-2">
                Low stock items
              </p>
              <p className="font-serif text-4xl text-stone-900 leading-none tracking-tight tabular-nums">
                {items.length}
              </p>
            </div>
            <div className="px-7 py-6">
              <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-2">
                Critical stock
              </p>
              <p className="font-serif text-4xl text-stone-900 leading-none tracking-tight tabular-nums">
                {criticalCount}
              </p>
            </div>
            <div className="px-7 py-6">
              <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-2">
                Materials
              </p>
              <p className="font-serif text-4xl text-stone-900 leading-none tracking-tight tabular-nums">
                {materialsCount}
              </p>
            </div>
            <div className="px-7 py-6">
              <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-2">
                Est. reorder value
              </p>
              <p className="font-serif text-4xl text-stone-900 leading-none tracking-tight tabular-nums">
                ${Math.round(estimatedReorderValue).toLocaleString()}
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-stone-200 rounded-2xl mb-10 grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-stone-200">
            <div className="px-7 py-6">
              <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-2">
                Total items
              </p>
              <p className="font-serif text-4xl text-stone-900 leading-none tracking-tight tabular-nums">
                {totalItems.toLocaleString()}
              </p>
            </div>
            <div className="px-7 py-6">
              <div className="flex items-center gap-1.5 mb-2">
                <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury">
                  Low stock
                </p>
                <HelpTooltip content="Items below their low stock threshold. Set this per item to get alerts when inventory is running low." size={12} />
              </div>
              <p className="font-serif text-4xl text-stone-900 leading-none tracking-tight tabular-nums">
                {lowStockCount.toLocaleString()}
              </p>
            </div>
            <div className="px-7 py-6">
              <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-2">
                Total value
              </p>
              <p className="font-serif text-4xl text-stone-900 leading-none tracking-tight tabular-nums">
                ${totalValue.toLocaleString()}
              </p>
            </div>
            <div className="px-7 py-6">
              <div className="flex items-center gap-1.5 mb-2">
                <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury">
                  On website
                </p>
                <HelpTooltip content="Items currently listed on your public website store. Toggle visibility in each item's settings." size={12} />
              </div>
              <p className="font-serif text-4xl text-stone-900 leading-none tracking-tight tabular-nums">
                {onWebsiteCount.toLocaleString()}
              </p>
            </div>
          </div>
        )}

        {/* Bulk Actions Bar */}
        {selectedIds.size > 0 && (
          <div className="bg-white border border-stone-200 rounded-2xl px-6 py-4 mb-6 flex items-center gap-4">
            <span className="text-sm text-stone-700">
              <span className="font-medium tabular-nums">{selectedIds.size}</span>{" "}
              item{selectedIds.size > 1 ? "s" : ""} selected
            </span>
            <div className="flex items-center gap-3 ml-auto">
              <button
                onClick={() => setShowBatchPrint(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-stone-700 hover:text-nexpura-bronze transition-colors duration-200"
              >
                <PrinterIcon className="w-4 h-4" /> Print Tags
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-sm text-stone-400 hover:text-stone-700 transition-colors duration-200"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Search + Filters */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6 mb-8 space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[260px]">
              <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by name, stock #, SKU..."
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* More Filters Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-full whitespace-nowrap transition-all duration-300 ${
                showFilters
                  ? "bg-stone-900 text-white"
                  : "bg-white border border-stone-200 text-stone-600 hover:border-stone-300 hover:text-stone-900"
              }`}
            >
              <AdjustmentsHorizontalIcon className="w-4 h-4" />
              Filters
              {hasActiveFilters && (
                <span className="w-1.5 h-1.5 rounded-full bg-nexpura-bronze" />
              )}
            </button>

            {/* View Toggle */}
            <div className="flex items-center bg-white border border-stone-200 rounded-full overflow-hidden">
              <button
                onClick={() => setViewMode("grid")}
                aria-label="Grid view"
                className={`p-2 transition-colors duration-200 ${
                  viewMode === "grid" ? "bg-stone-900 text-white" : "text-stone-500 hover:text-stone-900"
                }`}
              >
                <Squares2X2Icon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                aria-label="List view"
                className={`p-2 transition-colors duration-200 ${
                  viewMode === "list" ? "bg-stone-900 text-white" : "text-stone-500 hover:text-stone-900"
                }`}
              >
                <ListBulletIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Status Pills */}
          <div className="flex items-center gap-2 overflow-x-auto -mx-1 px-1">
            {["all", "available", "sold", "on_website"].map((status) => {
              const isActive = filterStatus === status;
              const label =
                status === "all"
                  ? "All"
                  : status === "on_website"
                  ? "On Website"
                  : status.charAt(0).toUpperCase() + status.slice(1);
              return (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-4 py-1.5 text-sm font-medium rounded-full whitespace-nowrap transition-all duration-200 ${
                    isActive
                      ? "bg-stone-900 text-white"
                      : "text-stone-500 hover:text-stone-900 hover:bg-stone-100"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Expanded Filters */}
          {showFilters && (
            <div className="flex flex-wrap items-center gap-3 pt-5 border-t border-stone-200">
              <select
                value={filterSupplier}
                onChange={(e) => setFilterSupplier(e.target.value)}
                className="h-10 px-4 rounded-lg border border-stone-200 text-sm text-stone-900 bg-white focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
              >
                <option value="all">All Suppliers</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>

              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="h-10 px-4 rounded-lg border border-stone-200 text-sm text-stone-900 bg-white focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
              >
                <option value="all">All Types</option>
                {jewelleryTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>

              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1.5 text-sm text-nexpura-bronze hover:text-nexpura-bronze-hover transition-colors duration-200"
                >
                  <XMarkIcon className="w-3.5 h-3.5" /> Clear all
                </button>
              )}
            </div>
          )}
        </div>

        {/* Items Grid/List */}
        {filtered.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-2xl p-14 text-center">
            {lowStockOnly ? (
              <>
                <CheckCircleIcon className="w-8 h-8 text-stone-300 mx-auto mb-5" strokeWidth={1.5} />
                <h3 className="font-serif text-2xl text-stone-900 tracking-tight mb-3">
                  All inventory is at healthy levels
                </h3>
                <p className="text-stone-500 text-sm max-w-sm mx-auto leading-relaxed mb-7">
                  Items below their reorder threshold will appear here.
                </p>
                <Link
                  href="/inventory"
                  className="nx-btn-primary inline-flex items-center gap-2"
                >
                  <ArchiveBoxIcon className="w-4 h-4" />
                  View all inventory
                </Link>
              </>
            ) : (
              <>
                <SparklesIcon className="w-8 h-8 text-stone-300 mx-auto mb-5" strokeWidth={1.5} />
                <h3 className="font-serif text-2xl text-stone-900 tracking-tight mb-3">
                  {/* Gate on the authoritative tenant-wide count, not on the current
                      page's items array. items.length can be 0 while totalItems > 0
                      (empty page past the last, filtered-out subset, cache skew),
                      which previously produced a contradiction: top counter said
                      "1 Total Items" while the empty-state said "No inventory yet". */}
                  {totalItems === 0 ? "No inventory yet" : "No items match your filters"}
                </h3>
                <p className="text-stone-500 text-sm max-w-sm mx-auto leading-relaxed mb-7">
                  {totalItems === 0
                    ? "Add your first item to start tracking stock."
                    : "Try adjusting your search or filters."}
                </p>
                {totalItems === 0 ? (
                  <Link
                    href="/inventory/new"
                    className="nx-btn-primary inline-flex items-center gap-2"
                  >
                    <PlusIcon className="w-4 h-4" />
                    Add your first item
                  </Link>
                ) : (
                  hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      className="nx-btn-primary inline-flex items-center gap-2"
                    >
                      Clear filters
                    </button>
                  )
                )}
              </>
            )}
          </div>
        ) : viewMode === "grid" ? (
          /* Grid View */
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
            {filtered.map((item) => (
              <div
                key={item.id}
                className="group bg-white border border-stone-200 rounded-2xl overflow-hidden hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-stone-300 transition-all duration-400 cursor-pointer"
                onClick={() => setDetailItem(item)}
              >
                {/* Image */}
                <div className="relative aspect-square bg-stone-50">
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
                      <SparklesIcon className="w-10 h-10 text-stone-300" strokeWidth={1.5} />
                    </div>
                  )}

                  {/* Badges */}
                  <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                    {item.is_consignment && (
                      <span className="px-2 py-0.5 bg-white/95 backdrop-blur-sm border border-stone-200 text-[10px] font-medium text-stone-700 uppercase tracking-luxury rounded-full">
                        Consignment
                      </span>
                    )}
                    {item.listed_on_website && (
                      <span className="px-2 py-0.5 bg-white/95 backdrop-blur-sm border border-stone-200 text-[10px] font-medium text-stone-700 uppercase tracking-luxury rounded-full inline-flex items-center gap-1">
                        <GlobeAltIcon className="w-3 h-3" /> Web
                      </span>
                    )}
                  </div>

                  {/* Stock Number */}
                  <div className="absolute top-3 right-3">
                    <span className="px-2 py-1 bg-white/95 backdrop-blur-sm text-[11px] font-mono font-medium text-stone-700 rounded-md tabular-nums">
                      {item.stock_number || item.sku || "—"}
                    </span>
                  </div>

                  {/* Quick Actions (on hover) */}
                  <div className="absolute inset-0 bg-stone-900/0 group-hover:bg-stone-900/20 transition-colors duration-300 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDetailItem(item);
                      }}
                      aria-label="View"
                      className="p-2 bg-white rounded-full shadow-md hover:bg-stone-50 text-stone-700 hover:text-nexpura-bronze transition-colors duration-200"
                    >
                      <EyeIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPrintItem(item);
                      }}
                      aria-label="Print tag"
                      className="p-2 bg-white rounded-full shadow-md hover:bg-stone-50 text-stone-700 hover:text-nexpura-bronze transition-colors duration-200"
                    >
                      <PrinterIcon className="w-4 h-4" />
                    </button>
                    <Link
                      href={`/inventory/${item.id}`}
                      onClick={(e) => e.stopPropagation()}
                      aria-label="Edit"
                      className="p-2 bg-white rounded-full shadow-md hover:bg-stone-50 text-stone-700 hover:text-nexpura-bronze transition-colors duration-200"
                    >
                      <PencilSquareIcon className="w-4 h-4" />
                    </Link>
                  </div>

                  {/* Selection Checkbox */}
                  <div
                    className="absolute bottom-3 left-3"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelect(item.id);
                    }}
                  >
                    <span
                      className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all duration-200 ${
                        selectedIds.has(item.id)
                          ? "bg-stone-900 border-stone-900 text-white"
                          : "bg-white/90 border-stone-300 hover:border-stone-500"
                      }`}
                    >
                      {selectedIds.has(item.id) && (
                        <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
                          <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                  </div>
                </div>

                {/* Info */}
                <div className="p-4">
                  <h3 className="font-serif text-base text-stone-900 leading-tight tracking-tight line-clamp-1">
                    {item.name}
                  </h3>
                  <div className="flex items-center justify-between gap-2 mt-3">
                    <span className="font-serif text-lg text-stone-900 tracking-tight tabular-nums">
                      ${item.retail_price.toLocaleString()}
                    </span>
                    {getStatusBadge(item)}
                  </div>
                  {(item.metal_type || item.stone_type) && (
                    <p className="text-xs text-stone-500 mt-2 truncate">
                      {[item.metal_type, item.stone_type].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* List View */
          <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-stone-200">
                    <th className="w-12 px-5 py-4">
                      <button
                        onClick={toggleAll}
                        aria-label="Select all"
                        className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all duration-200 ${
                          selectedIds.size === filtered.length && filtered.length > 0
                            ? "bg-stone-900 border-stone-900 text-white"
                            : "bg-white border-stone-300 hover:border-stone-500"
                        }`}
                      >
                        {selectedIds.size === filtered.length && filtered.length > 0 && (
                          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
                            <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                    </th>
                    <th className="w-14"></th>
                    <th className="text-left px-4 py-4 text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury">
                      Stock #
                    </th>
                    <th className="text-left px-4 py-4 text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury">
                      Name
                    </th>
                    <th className="text-left px-4 py-4 text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury">
                      Type
                    </th>
                    {canViewCost && (
                      <th className="text-right px-4 py-4 text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury">
                        Cost
                      </th>
                    )}
                    <th className="text-right px-4 py-4 text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury">
                      Price
                    </th>
                    <th className="text-center px-4 py-4 text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury">
                      Status
                    </th>
                    <th className="w-24"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filtered.map((item) => (
                    <tr
                      key={item.id}
                      className="group hover:bg-stone-50/60 cursor-pointer transition-colors duration-200"
                      onClick={() => setDetailItem(item)}
                    >
                      <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => toggleSelect(item.id)}
                          aria-label="Select"
                          className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all duration-200 ${
                            selectedIds.has(item.id)
                              ? "bg-stone-900 border-stone-900 text-white"
                              : "bg-white border-stone-300 hover:border-stone-500"
                          }`}
                        >
                          {selectedIds.has(item.id) && (
                            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
                              <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </button>
                      </td>
                      <td className="px-2 py-3">
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
                          <div className="w-10 h-10 rounded-lg bg-stone-50 border border-stone-100 flex items-center justify-center">
                            <SparklesIcon className="w-4 h-4 text-stone-300" strokeWidth={1.5} />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className="font-mono text-sm text-nexpura-bronze tabular-nums">
                          {item.stock_number || item.sku || "—"}
                        </span>
                        {item.is_consignment && (
                          <span className="ml-2 nx-badge-neutral">C</span>
                        )}
                        {item.listed_on_website && (
                          <span className="ml-1 nx-badge-neutral">W</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-medium text-sm text-stone-900">{item.name}</p>
                        {item.suppliers?.name && (
                          <p className="text-xs text-stone-500 mt-0.5">{item.suppliers.name}</p>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-sm text-stone-600 capitalize">
                          {item.jewellery_type || item.item_type}
                        </span>
                      </td>
                      {canViewCost && (
                        <td className="px-4 py-4 text-right">
                          <span className="text-sm text-stone-500 tabular-nums">
                            {item.cost_price != null ? `$${item.cost_price.toLocaleString()}` : "—"}
                          </span>
                        </td>
                      )}
                      <td className="px-4 py-4 text-right">
                        <span className="text-sm font-semibold text-stone-900 tabular-nums">
                          ${item.retail_price.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        {getStatusBadge(item)}
                      </td>
                      <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setPrintItem(item)}
                            aria-label="Print tag"
                            className="p-1.5 rounded-md text-stone-400 hover:text-nexpura-bronze hover:bg-stone-100 transition-colors duration-200"
                          >
                            <PrinterIcon className="w-4 h-4" />
                          </button>
                          <Link
                            href={`/inventory/${item.id}`}
                            aria-label="Edit"
                            className="p-1.5 rounded-md text-stone-400 hover:text-nexpura-bronze hover:bg-stone-100 transition-colors duration-200"
                          >
                            <PencilSquareIcon className="w-4 h-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Results Count & Pagination */}
        {filtered.length > 0 && (
          <div className="flex flex-col items-center gap-4 mt-10">
            <div className="text-xs text-stone-500 tracking-wide tabular-nums">
              Showing {filtered.length} of {totalItems} items
              {totalPages > 1 && ` · Page ${currentPage} of ${totalPages}`}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <a
                  href={currentPage > 1 ? `?page=${currentPage - 1}` : "#"}
                  className={`px-4 py-1.5 text-sm rounded-full border transition-all duration-200 ${
                    currentPage > 1
                      ? "border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:text-stone-900"
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
                        className={`w-8 h-8 flex items-center justify-center text-sm rounded-full transition-colors duration-200 tabular-nums ${
                          pageNum === currentPage
                            ? "bg-stone-900 text-white"
                            : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                        }`}
                      >
                        {pageNum}
                      </a>
                    );
                  })}
                </div>

                <a
                  href={currentPage < totalPages ? `?page=${currentPage + 1}` : "#"}
                  className={`px-4 py-1.5 text-sm rounded-full border transition-all duration-200 ${
                    currentPage < totalPages
                      ? "border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:text-stone-900"
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
    </div>
  );
}
