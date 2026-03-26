export type Customer = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  address_line1: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
} | null;

export type LineItem = {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount_pct: number;
  total: number;
  sort_order: number;
};

export type Payment = {
  id: string;
  amount: number;
  payment_method: string;
  payment_date: string;
  reference: string | null;
  notes: string | null;
  created_at: string;
};

export type Tenant = {
  name: string | null;
  business_name: string | null;
  abn: string | null;
  logo_url: string | null;
  bank_name: string | null;
  bank_bsb: string | null;
  bank_account: string | null;
  address_line1: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  phone: string | null;
  email: string | null;
} | null;

export type Invoice = {
  id: string;
  invoice_number: string;
  status: string;
  invoice_date: string;
  due_date: string | null;
  paid_at: string | null;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total: number;
  amount_paid: number;
  amount_due: number;
  tax_name: string;
  tax_rate: number;
  tax_inclusive: boolean;
  notes: string | null;
  footer_text: string | null;
  reference_type: string | null;
  created_at: string;
  stripe_payment_link: string | null;
  customers: Customer;
};

export interface InvoiceDetailClientProps {
  invoice: Invoice;
  lineItems: LineItem[];
  payments: Payment[];
  tenant: Tenant;
  readOnly?: boolean;
}
