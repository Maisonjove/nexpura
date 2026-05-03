"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, Plus, ArrowRight, Loader2 } from "lucide-react";
import { ExportButtons } from "@/components/ExportButtons";
import { formatDateForExport } from "@/lib/export";
import { loadMoreCustomers } from "./actions";

type Customer = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  tags: string[] | null;
  is_vip: boolean | null;
  created_at: string;
  updated_at: string | null;
};

interface Props {
  initialCustomers: Customer[];
  totalCount: number;
  initialPage: number;
  pageSize: number;
  /**
   * If present, initialCustomers is a *server-side search result* (ILIKE
   * across the full tenant history, not the recent-200). Local search is
   * then redundant — input still does a client-side filter over whatever
   * the server returned.
   */
  q: string;
  /**
   * Page renders the title + primary-action button as a server-rendered
   * shell above the Suspense boundary, so set this true to skip the
   * duplicate h1/add-button block from the client. Export button stays
   * inside the client (it needs the loaded row data to build the CSV).
   */
  hideTitleBlock?: boolean;
}

function getInitials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function displayName(c: Customer) {
  return c.full_name || `${c.first_name || ""} ${c.last_name || ""}`.trim() || "Unknown";
}

export default function CustomerListClient({
  initialCustomers,
  totalCount,
  initialPage,
  pageSize,
  q: initialQ,
  hideTitleBlock = false,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Loaded rows grow as the user clicks "Load older". Starts with whatever
  // the server handed us on first paint (200 most-recent, or a server-side
  // search result if ?q= was used).
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [loadedPage, setLoadedPage] = useState(initialPage);

  // Local search runs instantly against `customers` (whatever is loaded).
  // Separate from the server-side `q` so the UI can let the user refine
  // instantly without any round-trip.
  const [localSearch, setLocalSearch] = useState("");

  // Tag + sort are local; no server round-trip per interaction.
  const [activeTag, setActiveTag] = useState<string>("all");
  const [sort, setSort] = useState<string>("created_at_desc");

  const [loadingMore, setLoadingMore] = useState(false);

  // Derive the tag chip options from the loaded set so we only show tags
  // that are actually in use, plus the canonical set jewellers expect.
  const availableTags = useMemo(() => {
    const set = new Set<string>();
    for (const c of customers) {
      if (c.is_vip) set.add("VIP");
      for (const t of c.tags || []) if (t) set.add(t);
    }
    // Guarantee the common canonical tags are always selectable even if
    // none of the loaded customers are tagged with them yet.
    for (const canonical of ["VIP", "Bridal", "Retail", "Wholesale"]) set.add(canonical);
    return Array.from(set).sort();
  }, [customers]);

  // Client-side filter + sort pipeline — instant over the loaded set.
  const visibleCustomers = useMemo(() => {
    const needle = localSearch.trim().toLowerCase();
    let out = customers;
    if (needle) {
      out = out.filter((c) => {
        const name = displayName(c).toLowerCase();
        if (name.includes(needle)) return true;
        if (c.email && c.email.toLowerCase().includes(needle)) return true;
        if (c.phone && c.phone.toLowerCase().includes(needle)) return true;
        if (c.mobile && c.mobile.toLowerCase().includes(needle)) return true;
        return false;
      });
    }
    if (activeTag && activeTag !== "all") {
      out = out.filter((c) => {
        if (activeTag === "VIP" && c.is_vip) return true;
        return (c.tags || []).includes(activeTag);
      });
    }
    const sorted = [...out];
    switch (sort) {
      case "name_asc":
        sorted.sort((a, b) => displayName(a).localeCompare(displayName(b)));
        break;
      case "name_desc":
        sorted.sort((a, b) => displayName(b).localeCompare(displayName(a)));
        break;
      case "updated_desc":
        sorted.sort((a, b) => (b.updated_at ?? b.created_at).localeCompare(a.updated_at ?? a.created_at));
        break;
      case "updated_asc":
        sorted.sort((a, b) => (a.updated_at ?? a.created_at).localeCompare(b.updated_at ?? b.created_at));
        break;
      case "created_at_asc":
        sorted.sort((a, b) => a.created_at.localeCompare(b.created_at));
        break;
      default:
        sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
    }
    return sorted;
  }, [customers, localSearch, activeTag, sort]);

  // The "Search all customers" escape hatch: delegate to the server so the
  // ILIKE match runs over the full tenant history, not just the loaded set.
  // Used when the user has typed a query and can't find what they're looking
  // for in the loaded batch.
  const searchAllServer = useCallback(() => {
    const term = localSearch.trim();
    if (!term) return;
    startTransition(() => router.push(`/customers?q=${encodeURIComponent(term)}`));
  }, [localSearch, router]);

  const loadedLocalCount = customers.length;
  const canLoadMore = !initialQ && loadedLocalCount < totalCount;
  const hasLocalMatches = visibleCustomers.length > 0;

  async function handleLoadMore() {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await loadMoreCustomers(loadedPage * pageSize);
      if (res.customers.length > 0) {
        setCustomers((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          const merged = [...prev];
          for (const c of res.customers) if (!seen.has(c.id)) merged.push(c);
          return merged;
        });
        setLoadedPage((p) => p + 1);
      }
    } finally {
      setLoadingMore(false);
    }
  }

  const getTagBadge = (tag: string) => {
    if (tag.toLowerCase() === "vip") return <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50 border-amber-200" variant="outline">{tag}</Badge>;
    if (tag.toLowerCase() === "bridal") return <Badge className="bg-stone-50 text-stone-600 hover:bg-stone-50 border-stone-200" variant="outline">{tag}</Badge>;
    return <Badge variant="outline" className="text-stone-600 border-stone-200">{tag}</Badge>;
  };

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* HEADER — rendered on the server above the Suspense boundary when
          the page uses the shell-first streaming pattern. Skipped here to
          avoid a duplicate title when the real count + export button
          stream in. Kept inline when this component is used standalone. */}
      {!hideTitleBlock && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Customers</h1>
            <Badge variant="outline" className="text-stone-500 font-medium px-2.5 py-0.5 rounded-full border-stone-200">
              {totalCount}
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <ExportButtons
              data={visibleCustomers.map((c) => ({
                full_name: displayName(c),
                email: c.email || "",
                phone: c.mobile || c.phone || "",
                tags: (c.tags || []).join(", "),
                is_vip: c.is_vip ? "Yes" : "No",
                created_at: formatDateForExport(c.created_at),
                updated_at: formatDateForExport(c.updated_at),
              }))}
              columns={[
                { key: "full_name", label: "Name" },
                { key: "email", label: "Email" },
                { key: "phone", label: "Phone" },
                { key: "tags", label: "Tags" },
                { key: "is_vip", label: "VIP" },
                { key: "created_at", label: "Created" },
                { key: "updated_at", label: "Updated" },
              ]}
              filename={`customers-export-${new Date().toISOString().split("T")[0]}`}
              sheetName="Customers"
              size="sm"
            />
            <Link href="/customers/new" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors bg-nexpura-charcoal hover:bg-nexpura-charcoal-700 text-white h-10 px-4 py-2">
              <Plus className="w-4 h-4 mr-2" /> Add Customer
            </Link>
          </div>
        </div>
      )}

      {/* FILTER BAR */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-stone-400" />
            <Input
              placeholder="Search loaded customers…"
              className="pl-9 h-10 border-stone-200 focus-visible:ring-[amber-700] text-sm"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
            />
          </div>
          <Select value={activeTag} onValueChange={(val) => setActiveTag(val || "all")}>
            <SelectTrigger className="w-[180px] h-10 text-sm border-stone-200 focus:ring-nexpura-bronze">
              <SelectValue placeholder="All Tags" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tags</SelectItem>
              {availableTags.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(val) => setSort(val || "created_at_desc")}>
            <SelectTrigger className="w-[170px] h-10 text-sm border-stone-200 focus:ring-nexpura-bronze">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created_at_desc">Newest first</SelectItem>
              <SelectItem value="created_at_asc">Oldest first</SelectItem>
              <SelectItem value="name_asc">Name A–Z</SelectItem>
              <SelectItem value="name_desc">Name Z–A</SelectItem>
              <SelectItem value="updated_desc">Recently updated</SelectItem>
              <SelectItem value="updated_asc">Least recently updated</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* "Search all customers" escape hatch — only shown when the user has
            typed something, has found either too few or no matches in the
            loaded set, AND there is older data that's not loaded yet. */}
        {localSearch.trim().length >= 2 && !initialQ && (visibleCustomers.length < 5 || !hasLocalMatches) && customers.length < totalCount && (
          <button
            type="button"
            onClick={searchAllServer}
            disabled={isPending}
            className="self-start inline-flex items-center gap-2 text-xs text-amber-700 hover:text-amber-800 disabled:opacity-60"
          >
            {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            Search all {totalCount.toLocaleString()} customers for &ldquo;{localSearch.trim()}&rdquo;
          </button>
        )}

        {/* Server-side search banner — when we arrived here via ?q= (full-
            tenant ILIKE), make that context explicit and give a way back. */}
        {initialQ && (
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
            <span>
              Showing server-side search results for <strong>&ldquo;{initialQ}&rdquo;</strong>
              {" "}({initialCustomers.length} match{initialCustomers.length === 1 ? "" : "es"})
            </span>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") window.history.replaceState(null, "", "/customers");
                router.push("/customers");
              }}
              className="text-amber-800 hover:text-amber-900 underline"
            >
              Back to all customers
            </button>
          </div>
        )}
      </div>

      {/* TABLE */}
      {visibleCustomers.length === 0 ? (
        <Card className="border-stone-200 shadow-sm rounded-xl overflow-hidden">
          <div className="p-16 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-stone-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h3 className="font-semibold text-lg text-stone-900">
              {customers.length === 0 ? "No customers yet" : "No matches in loaded customers"}
            </h3>
            <p className="text-stone-500 mt-1 text-sm">
              {customers.length === 0
                ? "Add your first customer to get started."
                : "Try a different search or clear filters."}
            </p>
            {customers.length === 0 && (
              <Link
                href="/customers/new"
                className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-nexpura-charcoal text-white text-sm font-medium rounded-lg hover:bg-nexpura-charcoal-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add your first customer →
              </Link>
            )}
          </div>
        </Card>
      ) : (
        <Card className="border-stone-200 shadow-sm rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-stone-100">
                <TableHead className="text-xs font-medium uppercase tracking-wider text-stone-400">Customer</TableHead>
                <TableHead className="text-xs font-medium uppercase tracking-wider text-stone-400">Phone</TableHead>
                <TableHead className="text-xs font-medium uppercase tracking-wider text-stone-400">Email</TableHead>
                <TableHead className="text-xs font-medium uppercase tracking-wider text-stone-400">Tags</TableHead>
                <TableHead className="text-xs font-medium uppercase tracking-wider text-stone-400">Last Updated</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleCustomers.map((customer) => {
                const name = displayName(customer);
                const initials = getInitials(name);
                const tags: string[] = [
                  ...(customer.is_vip ? ["VIP"] : []),
                  ...(customer.tags || []),
                ];
                return (
                  <TableRow
                    key={customer.id}
                    className="hover:bg-stone-50/60 border-stone-100 transition-colors group"
                  >
                    <TableCell className="p-0">
                      <Link
                        href={`/customers/${customer.id}`}
                        className="flex items-center gap-3 px-4 py-2.5"
                      >
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="bg-stone-100 text-stone-600 text-xs font-semibold">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium text-stone-900">{name}</span>
                      </Link>
                    </TableCell>
                    <TableCell className="p-0">
                      <Link href={`/customers/${customer.id}`} className="block px-4 py-2.5 text-sm text-stone-700">
                        {customer.mobile || customer.phone || "—"}
                      </Link>
                    </TableCell>
                    <TableCell className="p-0">
                      <Link href={`/customers/${customer.id}`} className="block px-4 py-2.5 text-sm text-stone-700">
                        {customer.email || "—"}
                      </Link>
                    </TableCell>
                    <TableCell className="p-0">
                      <Link href={`/customers/${customer.id}`} className="block px-4 py-2.5">
                        <div className="flex gap-1.5 flex-wrap">
                          {tags.map((tag) => <span key={tag}>{getTagBadge(tag)}</span>)}
                          {tags.length === 0 && <span className="text-stone-300 text-xs">—</span>}
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell className="p-0">
                      <Link href={`/customers/${customer.id}`} className="block px-4 py-2.5 text-sm text-stone-700">
                        {customer.updated_at
                          ? new Date(customer.updated_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })
                          : "—"}
                      </Link>
                    </TableCell>
                    <TableCell className="p-0">
                      <Link href={`/customers/${customer.id}`} className="flex items-center px-4 py-2.5">
                        <ArrowRight className="w-4 h-4 text-stone-300 group-hover:text-amber-700" />
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Footer: visible count + Load older */}
      <div className="flex items-center justify-between pt-2 text-xs text-stone-500">
        <span>
          {visibleCustomers.length === customers.length
            ? `Showing ${customers.length.toLocaleString()} of ${totalCount.toLocaleString()} customers`
            : `Showing ${visibleCustomers.length.toLocaleString()} of ${customers.length.toLocaleString()} loaded (${totalCount.toLocaleString()} total)`}
        </span>
        {canLoadMore && (
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="inline-flex items-center gap-2 px-3 h-8 text-xs font-medium text-stone-600 border border-stone-200 rounded-md hover:bg-stone-50 transition-colors disabled:opacity-60"
          >
            {loadingMore ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
              </>
            ) : (
              <>Load older {Math.min(pageSize, totalCount - customers.length).toLocaleString()}</>
            )}
          </button>
        )}
      </div>

    </div>
  );
}
