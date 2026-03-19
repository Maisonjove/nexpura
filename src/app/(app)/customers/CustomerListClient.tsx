"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, Plus, ArrowRight } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

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
  customers: Customer[];
  totalCount: number;
  page: number;
  totalPages: number;
  q: string;
  tagFilter: string;
  sort: string;
}



function getInitials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CustomerListClient({
  customers,
  totalCount,
  page,
  totalPages,
  q,
  tagFilter,
  sort,
}: Props) {
  const router = useRouter();
  const [search, setSearch] = useState(q);
  const [activeTab, setActiveTab] = useState(tagFilter || "all");

  function buildUrl(params: Record<string, string | number>) {
    const url = new URLSearchParams();
    if (params.q) url.set("q", params.q as string);
    if (params.tag && params.tag !== "all") url.set("tag", params.tag as string);
    if (params.sort && params.sort !== "created_at_desc") url.set("sort", params.sort as string);
    if (params.page && params.page !== 1) url.set("page", String(params.page));
    const qs = url.toString();
    return qs ? `/customers?${qs}` : "/customers";
  }

  function handleSearch(e?: React.FormEvent) {
    if (e) e.preventDefault();
    router.push(buildUrl({ q: search, tag: activeTab, sort, page: 1 }));
  }

  function handleTabChange(tab: string) {
    setActiveTab(tab);
    router.push(buildUrl({ q: search, tag: tab === "all" ? "" : tab, sort, page: 1 }));
  }

  const getTagBadge = (tag: string) => {
    if (tag.toLowerCase() === "vip") return <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50 border-amber-200" variant="outline">{tag}</Badge>;
    if (tag.toLowerCase() === "bridal") return <Badge className="bg-stone-50 text-stone-600 hover:bg-stone-50 border-stone-200" variant="outline">{tag}</Badge>;
    return <Badge variant="outline" className="text-stone-600 border-stone-200">{tag}</Badge>;
  };

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Customers</h1>
          <Badge variant="outline" className="text-stone-500 font-medium px-2.5 py-0.5 rounded-full border-stone-200">
            {totalCount}
          </Badge>
        </div>
        <Link href="/customers/new" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors bg-amber-700 hover:bg-amber-800 text-white h-10 px-4 py-2">
          <Plus className="w-4 h-4 mr-2" /> Add Customer
        </Link>
      </div>

      {/* FILTER BAR */}
      <div className="flex items-center gap-3">
        <form onSubmit={handleSearch} className="relative max-w-sm flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-stone-400" />
            <Input 
              placeholder="Search customers..." 
              className="pl-9 h-10 border-stone-200 focus-visible:ring-[amber-700] text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
            />
          </div>
          <Button type="submit" variant="outline" size="icon" className="h-10 w-10 shrink-0">
            <Search className="h-4 w-4" />
          </Button>
        </form>
        <Select value={activeTab} onValueChange={(val) => handleTabChange(val || "all")}>
          <SelectTrigger className="w-[180px] h-10 text-sm border-stone-200 focus:ring-amber-600">
            <SelectValue placeholder="All Tags" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tags</SelectItem>
            <SelectItem value="VIP">VIP</SelectItem>
            <SelectItem value="Bridal">Bridal</SelectItem>
            <SelectItem value="Retail">Retail</SelectItem>
            <SelectItem value="Wholesale">Wholesale</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* TABLE */}
      {customers.length === 0 ? (
        <Card className="border-stone-200 shadow-sm rounded-xl overflow-hidden">
          <div className="p-16 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-stone-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h3 className="font-semibold text-lg text-stone-900">No customers yet</h3>
            <p className="text-stone-500 mt-1 text-sm">Add your first customer to get started.</p>
            <Link
              href="/customers/new"
              className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-amber-700 text-white text-sm font-medium rounded-lg hover:bg-amber-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add your first customer →
            </Link>
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
              {customers.map((customer) => {
                const name = customer.full_name || `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || "Unknown";
                const initials = getInitials(name);
                const tags: string[] = [
                  ...(customer.is_vip ? ["VIP"] : []),
                  ...(customer.tags || []),
                ];
                return (
                  <TableRow key={customer.id} className="hover:bg-stone-50/60 border-stone-100 cursor-pointer transition-colors" onClick={() => router.push(`/customers/${customer.id}`)}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="bg-stone-100 text-stone-600 text-xs font-semibold">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium text-stone-900">{name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-stone-700">{customer.mobile || customer.phone || "—"}</TableCell>
                    <TableCell className="text-sm text-stone-700">{customer.email || "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1.5 flex-wrap">
                        {tags.map((tag) => <span key={tag}>{getTagBadge(tag)}</span>)}
                        {tags.length === 0 && <span className="text-stone-300 text-xs">—</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-stone-700">
                      {customer.updated_at
                        ? new Date(customer.updated_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <ArrowRight className="w-4 h-4 text-stone-300 hover:text-amber-700" />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-stone-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={buildUrl({ q, tag: tagFilter, sort, page: page - 1 })} className="inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium transition-colors border border-stone-200 bg-transparent hover:bg-stone-100 hover:text-stone-900 text-stone-600 h-8 px-3 text-xs">Previous</Link>
            )}
            {page < totalPages && (
              <Link href={buildUrl({ q, tag: tagFilter, sort, page: page + 1 })} className="inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium transition-colors border border-stone-200 bg-transparent hover:bg-stone-100 hover:text-stone-900 text-stone-600 h-8 px-3 text-xs">Next</Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
