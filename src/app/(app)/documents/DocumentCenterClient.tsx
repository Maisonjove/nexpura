"use client";

/**
 * Document Center — full redesign per Kaitlyn's Brief 2 §6 (2026-05-02).
 *
 * Replaces the previous emoji-heavy, orange-accented layout with the
 * workspace-redesign visual language: serif heading, ivory-elevated card
 * surface, taupe-100 borders, charcoal text + bronze underline for the
 * selected segmented tab.
 *
 * Tabs drive URL state via `?type=invoices|quotes|repair-tickets|bespoke-sheets|passports|refunds`.
 * Default = invoices. Reload + back-button work because state lives in
 * the URL, not local component state. Chip clicks are wrapped in a
 * `useTransition` so the surrounding UI shows a subtle pending fade.
 *
 * Server data shape is unchanged — see `./page.tsx`. `customers` is
 * normalised to a singleton on the server side, so the row renderer
 * just reads `doc.customers?.full_name`.
 */

import { Suspense, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import {
  Receipt,
  FileText,
  Wrench,
  Gem,
  ShieldCheck,
  RotateCcw,
  Search,
  Info,
  ExternalLink,
  Printer,
  type LucideIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/EmptyState";
import StatusBadge from "@/components/StatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DocumentItem, PassportDoc } from "./page";

interface Props {
  invoices: DocumentItem[];
  quotes: DocumentItem[];
  repairs: DocumentItem[];
  bespoke: DocumentItem[];
  passports: PassportDoc[];
  refunds: DocumentItem[];
}

// URL-facing slugs (kebab-case as per brief). The internal data keys are
// shorter — `repairs`, `bespoke`. Mapping kept central so the slug is the
// only thing the URL ever sees.
type DocType =
  | "invoices"
  | "quotes"
  | "repair-tickets"
  | "bespoke-sheets"
  | "passports"
  | "refunds";

interface DocTypeMeta {
  id: DocType;
  label: string;
  singular: string; // for empty-state copy: "No invoices yet."
  ctaLabel: string | null; // null = no CTA (refunds — no /new route)
  newHref: string | null;
  detailBase: string; // detail-route base, e.g. "/invoices"
  pdfBase: string; // PDF endpoint base
  icon: LucideIcon;
  /** Key into the `docMap` (server payload). */
  bucket: keyof Props;
}

const DOC_TYPES: DocTypeMeta[] = [
  {
    id: "invoices",
    label: "Invoices",
    singular: "invoices",
    ctaLabel: "Create invoice",
    newHref: "/invoices/new",
    detailBase: "/invoices",
    pdfBase: "/api/invoice",
    icon: Receipt,
    bucket: "invoices",
  },
  {
    id: "quotes",
    label: "Quotes",
    singular: "quotes",
    ctaLabel: "Create quote",
    newHref: "/quotes/new",
    detailBase: "/quotes",
    pdfBase: "/api/quote",
    icon: FileText,
    bucket: "quotes",
  },
  {
    id: "repair-tickets",
    label: "Repair tickets",
    singular: "repair tickets",
    ctaLabel: "Create repair ticket",
    newHref: "/repairs/new",
    detailBase: "/repairs",
    pdfBase: "/api/repair",
    icon: Wrench,
    bucket: "repairs",
  },
  {
    id: "bespoke-sheets",
    label: "Bespoke sheets",
    singular: "bespoke sheets",
    ctaLabel: "Create bespoke job",
    newHref: "/bespoke/new",
    detailBase: "/bespoke",
    pdfBase: "/api/bespoke",
    icon: Gem,
    bucket: "bespoke",
  },
  {
    id: "passports",
    label: "Passports",
    singular: "passports",
    ctaLabel: "Create passport",
    newHref: "/passports/new",
    detailBase: "/passports",
    pdfBase: "/api/passport",
    icon: ShieldCheck,
    bucket: "passports",
  },
  {
    id: "refunds",
    label: "Refunds",
    singular: "refunds",
    // Refunds don't have a /new route — they're created from an invoice.
    // Drop the CTA rather than fake a destination.
    ctaLabel: null,
    newHref: null,
    detailBase: "/refunds",
    pdfBase: "/api/refund",
    icon: RotateCcw,
    bucket: "refunds",
  },
];

const VALID_TYPES = new Set<DocType>(DOC_TYPES.map((t) => t.id));

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtCurrency(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(n);
}

function isPassport(doc: DocumentItem | PassportDoc): doc is PassportDoc {
  return "passport_uid" in doc;
}

function docRef(doc: DocumentItem | PassportDoc): string {
  if (isPassport(doc)) return doc.passport_uid;
  return (
    doc.invoice_number ||
    doc.quote_number ||
    doc.repair_number ||
    doc.job_number ||
    doc.refund_number ||
    doc.id.slice(0, 8)
  );
}

function docCustomer(doc: DocumentItem | PassportDoc): string {
  if (isPassport(doc)) return doc.title;
  return doc.customers?.full_name ?? doc.title ?? "—";
}

function docAmount(doc: DocumentItem | PassportDoc): number | null | undefined {
  if (isPassport(doc)) return null;
  return doc.total ?? doc.amount;
}

function DocumentCenterClientInner({
  invoices,
  quotes,
  repairs,
  bespoke,
  passports,
  refunds,
}: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const rawType = searchParams.get("type");
  const activeType: DocType =
    rawType && VALID_TYPES.has(rawType as DocType) ? (rawType as DocType) : "invoices";

  const meta = useMemo(
    () => DOC_TYPES.find((t) => t.id === activeType)!,
    [activeType],
  );

  // Server payload — keyed by the internal bucket name, not the URL slug.
  const docMap = useMemo(
    () =>
      ({
        invoices,
        quotes,
        repairs,
        bespoke,
        passports,
        refunds,
      }) as Record<keyof Props, (DocumentItem | PassportDoc)[]>,
    [invoices, quotes, repairs, bespoke, passports, refunds],
  );

  const totalCount = Object.values(docMap).reduce(
    (sum, arr) => sum + arr.length,
    0,
  );
  const currentDocs = docMap[meta.bucket];

  // ── Toolbar state — search + status filter live in component state.
  // Date sort is the default (newest first); a manual ascending toggle
  // covers the "sort" requirement without shipping a full sort menu.
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortAsc, setSortAsc] = useState(false);

  const availableStatuses = useMemo(() => {
    const set = new Set<string>();
    currentDocs.forEach((d) => set.add(d.status));
    return Array.from(set).sort();
  }, [currentDocs]);

  const filteredDocs = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = currentDocs.filter((doc) => {
      if (statusFilter !== "all" && doc.status !== statusFilter) return false;
      if (!q) return true;
      const ref = docRef(doc).toLowerCase();
      const customer = docCustomer(doc).toLowerCase();
      return ref.includes(q) || customer.includes(q);
    });
    list = [...list].sort((a, b) => {
      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();
      return sortAsc ? ta - tb : tb - ta;
    });
    return list;
  }, [currentDocs, search, statusFilter, sortAsc]);

  // ── URL helper — preserve other query params so deep-links from
  // dashboards survive a tab switch.
  const buildHref = (type: DocType) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (type === "invoices") {
      params.delete("type");
    } else {
      params.set("type", type);
    }
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname ?? "/documents";
  };

  const goToType = (type: DocType) => {
    startTransition(() => router.replace(buildHref(type), { scroll: false }));
  };

  return (
    <div className={`max-w-7xl mx-auto px-4 md:px-6 py-8 ${isPending ? "opacity-90" : ""}`}>
      {/* ── Page header ─────────────────────────────────────────────── */}
      <header className="flex items-start justify-between gap-6 mb-6">
        <div className="min-w-0">
          <h1 className="font-serif text-[32px] font-medium tracking-[-0.01em] text-nexpura-charcoal leading-tight">
            Document Center
          </h1>
          <p className="font-sans text-[13px] text-nexpura-charcoal-500 mt-1.5">
            View, print and manage documents.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-nexpura-ivory-elevated border border-nexpura-taupe-100 text-[12px] font-medium text-nexpura-charcoal-500 whitespace-nowrap">
          {totalCount} {totalCount === 1 ? "document" : "documents"}
        </span>
      </header>

      {/* ── Document type strip — segmented tabs (charcoal text + bronze underline) ─ */}
      <nav
        aria-label="Document type"
        className="mb-6 border-b border-nexpura-taupe-100 overflow-x-auto"
      >
        <ul className="flex items-end gap-1 min-w-max">
          {DOC_TYPES.map((t) => {
            const active = t.id === activeType;
            const count = docMap[t.bucket].length;
            const Icon = t.icon;
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => goToType(t.id)}
                  aria-current={active ? "page" : undefined}
                  className={`group inline-flex items-center gap-2 px-3 py-2.5 text-[13px] font-medium whitespace-nowrap border-b-2 transition-colors -mb-px ${
                    active
                      ? "text-nexpura-charcoal border-nexpura-bronze"
                      : "text-nexpura-charcoal-500 border-transparent hover:text-nexpura-charcoal"
                  }`}
                >
                  <Icon
                    strokeWidth={1.5}
                    className={`h-4 w-4 ${active ? "text-nexpura-charcoal" : "text-nexpura-taupe-400 group-hover:text-nexpura-charcoal"}`}
                  />
                  <span>{t.label}</span>
                  <span
                    className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-[11px] font-medium ${
                      active
                        ? "bg-nexpura-warm text-nexpura-charcoal-700"
                        : "bg-nexpura-cream text-nexpura-taupe-400"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ── Main content card ──────────────────────────────────────── */}
      <section className="bg-nexpura-ivory-elevated border border-nexpura-taupe-100 rounded-xl shadow-sm">
        {/* Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center gap-3 p-4 border-b border-nexpura-taupe-100">
          <div className="relative flex-1 min-w-0">
            <Search
              strokeWidth={1.5}
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-nexpura-taupe-400 pointer-events-none"
            />
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${meta.singular}…`}
              className="h-9 pl-9 bg-white border-nexpura-taupe-100 text-[13px] text-nexpura-charcoal placeholder:text-nexpura-taupe-400 focus-visible:ring-nexpura-bronze/30 focus-visible:border-nexpura-bronze"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor="doc-status-filter">
              Filter by status
            </label>
            <select
              id="doc-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 rounded-md border border-nexpura-taupe-100 bg-white px-3 text-[13px] text-nexpura-charcoal-700 focus:outline-none focus:ring-1 focus:ring-nexpura-bronze/30 focus:border-nexpura-bronze"
            >
              <option value="all">All statuses</option>
              {availableStatuses.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setSortAsc((v) => !v)}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-nexpura-taupe-100 bg-white text-[13px] text-nexpura-charcoal-700 hover:border-nexpura-taupe-200 transition-colors"
              aria-label={sortAsc ? "Sort newest first" : "Sort oldest first"}
            >
              Date
              <span className="text-[11px] text-nexpura-taupe-400">
                {sortAsc ? "↑" : "↓"}
              </span>
            </button>
          </div>
        </div>

        {/* Table or empty state */}
        {filteredDocs.length === 0 ? (
          <div className="px-4">
            {currentDocs.length === 0 ? (
              <EmptyState
                title={`No ${meta.singular} yet.`}
                description={`Created ${meta.singular} will appear here.`}
                action={
                  meta.ctaLabel && meta.newHref
                    ? { label: meta.ctaLabel, href: meta.newHref }
                    : undefined
                }
              />
            ) : (
              <EmptyState
                title="No matching documents."
                description="Adjust the search or status filter to see more results."
              />
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="text-[13px]">
              <TableHeader>
                <TableRow className="border-b border-nexpura-taupe-100 hover:bg-transparent">
                  <TableHead className="px-5 py-3 font-medium text-[11px] tracking-[0.08em] uppercase text-nexpura-taupe-400">
                    Document #
                  </TableHead>
                  <TableHead className="px-5 py-3 font-medium text-[11px] tracking-[0.08em] uppercase text-nexpura-taupe-400">
                    Customer
                  </TableHead>
                  <TableHead className="px-5 py-3 font-medium text-[11px] tracking-[0.08em] uppercase text-nexpura-taupe-400">
                    Type
                  </TableHead>
                  <TableHead className="px-5 py-3 font-medium text-[11px] tracking-[0.08em] uppercase text-nexpura-taupe-400 whitespace-nowrap">
                    Date
                  </TableHead>
                  <TableHead className="px-5 py-3 font-medium text-[11px] tracking-[0.08em] uppercase text-nexpura-taupe-400">
                    Status
                  </TableHead>
                  <TableHead className="px-5 py-3 font-medium text-[11px] tracking-[0.08em] uppercase text-nexpura-taupe-400 text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocs.map((doc) => {
                  const detailHref = `${meta.detailBase}/${doc.id}`;
                  const pdfHref = `${meta.pdfBase}/${doc.id}/pdf`;
                  const amount = docAmount(doc);
                  const showAmount =
                    activeType === "invoices" ||
                    activeType === "quotes" ||
                    activeType === "refunds";
                  return (
                    <TableRow
                      key={doc.id}
                      className="border-b border-nexpura-taupe-100/60 last:border-b-0 hover:bg-nexpura-cream/40 transition-colors"
                    >
                      <TableCell className="px-5 py-3.5 align-middle">
                        <Link
                          href={detailHref}
                          className="font-mono text-[12px] font-medium text-nexpura-charcoal-700 hover:text-nexpura-charcoal hover:underline underline-offset-2"
                        >
                          {docRef(doc)}
                        </Link>
                      </TableCell>
                      <TableCell className="px-5 py-3.5 align-middle">
                        <Link
                          href={detailHref}
                          className="text-nexpura-charcoal hover:text-nexpura-bronze max-w-[18rem] truncate block"
                        >
                          {docCustomer(doc)}
                        </Link>
                      </TableCell>
                      <TableCell className="px-5 py-3.5 align-middle">
                        <span className="inline-flex items-center gap-1.5 text-nexpura-charcoal-500">
                          <meta.icon strokeWidth={1.5} className="h-3.5 w-3.5 text-nexpura-taupe-400" />
                          <span className="text-[12px]">{meta.label}</span>
                          {showAmount && amount != null && (
                            <span className="ml-2 text-[12px] text-nexpura-charcoal-700 font-medium">
                              {fmtCurrency(amount)}
                            </span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="px-5 py-3.5 align-middle text-nexpura-charcoal-500 text-[12px] whitespace-nowrap">
                        {fmtDate(doc.created_at)}
                      </TableCell>
                      <TableCell className="px-5 py-3.5 align-middle">
                        <StatusBadge status={doc.status} />
                      </TableCell>
                      <TableCell className="px-5 py-3.5 align-middle">
                        <div className="flex items-center justify-end gap-2">
                          <a
                            href={pdfHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-nexpura-taupe-100 bg-white text-[12px] font-medium text-nexpura-charcoal-700 hover:border-nexpura-taupe-200 transition-colors"
                            title="Open PDF in new tab"
                          >
                            <ExternalLink strokeWidth={1.5} className="h-3.5 w-3.5" />
                            PDF
                          </a>
                          <button
                            type="button"
                            onClick={() => window.open(pdfHref, "_blank", "noopener,noreferrer")}
                            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-nexpura-taupe-100 bg-white text-[12px] font-medium text-nexpura-charcoal-700 hover:border-nexpura-taupe-200 transition-colors"
                            title="Print"
                          >
                            <Printer strokeWidth={1.5} className="h-3.5 w-3.5" />
                            Print
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* ── Footer hint — replaces the oversized "tip" box. ────────── */}
      <p className="mt-4 inline-flex items-center gap-1.5 text-[12px] text-nexpura-taupe-400">
        <Info strokeWidth={1.5} className="h-3.5 w-3.5" />
        PDFs open in a new tab. Manage printer setup in{" "}
        <Link
          href="/settings/printing"
          className="text-nexpura-charcoal-500 hover:text-nexpura-charcoal underline-offset-2 hover:underline"
        >
          Settings
        </Link>
        .
      </p>

    </div>
  );
}

export default function DocumentCenterClient(
  props: Parameters<typeof DocumentCenterClientInner>[0],
) {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto py-10 px-4 animate-pulse">
          <div className="h-8 bg-nexpura-cream rounded w-48 mb-3" />
          <div className="h-4 bg-nexpura-cream rounded w-72" />
        </div>
      }
    >
      <DocumentCenterClientInner {...props} />
    </Suspense>
  );
}
