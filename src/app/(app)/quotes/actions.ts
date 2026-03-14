"use client";

import { createClient } from "@/lib/supabase/client";

export interface QuoteItem {
  description: string;
  quantity: number;
  unit_price: number;
}

export interface Quote {
  id: string;
  tenant_id: string;
  customer_id: string;
  quote_number: string | null;
  items: QuoteItem[];
  total_amount: number;
  status: string;
  expires_at: string | null;
  notes: string | null;
  created_at: string;
  customers?: {
    full_name: string | null;
    email: string | null;
  };
}

export async function getQuotes() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("quotes")
    .select("*, customers(full_name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Quote[];
}

export async function createQuote(quote: Partial<Quote>) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("quotes")
    .insert(quote)
    .select()
    .single();
  if (error) throw error;
  return data as Quote;
}

export async function updateQuote(id: string, quote: Partial<Quote>) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("quotes")
    .update(quote)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Quote;
}

export async function deleteQuote(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("quotes").delete().eq("id", id);
  if (error) throw error;
}

export async function convertQuoteToInvoice(id: string) {
  const supabase = createClient();
  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", id)
    .single();
  
  if (quoteError || !quote) throw quoteError || new Error("Quote not found");

  const invoice = {
    tenant_id: quote.tenant_id,
    customer_id: quote.customer_id,
    items: quote.items,
    total_amount: quote.total_amount,
    status: "draft",
    quote_id: quote.id,
  };

  const { data: newInvoice, error: invError } = await supabase
    .from("invoices")
    .insert(invoice)
    .select()
    .single();
    
  if (invError) throw invError;

  // Update quote status
  await supabase.from("quotes").update({ status: "converted" }).eq("id", id);

  return newInvoice;
}
