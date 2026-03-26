export interface Customer {
  id: string;
  full_name: string;
  email: string | null;
  mobile: string | null;
}

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface Payment {
  id: string;
  amount: number;
  payment_method: string;
  payment_date: string | null;
  notes: string | null;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  status: string;
  subtotal: number;
  tax_amount: number;
  tax_rate: number;
  total: number;
  amount_paid: number;
  lineItems: LineItem[];
  payments: Payment[];
}

export interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  retail_price: number | null;
}

export interface JobAttachment {
  id: string;
  file_name: string;
  file_url: string;
  caption: string | null;
  created_at: string;
}

export interface JobEvent {
  id: string;
  event_type: string;
  description: string;
  actor: string | null;
  created_at: string;
}

export interface BespokeJob {
  id: string;
  job_number: string;
  title: string;
  description: string | null;
  jewellery_type: string | null;
  metal_type: string | null;
  metal_colour: string | null;
  metal_purity: string | null;
  stone_type: string | null;
  stone_carat: number | null;
  stone_colour: string | null;
  stone_clarity: string | null;
  ring_size: string | null;
  setting_style: string | null;
  stage: string;
  priority: string;
  quoted_price: number | null;
  deposit_amount: number | null;
  deposit_paid: boolean;
  due_date: string | null;
  invoice_id: string | null;
  internal_notes: string | null;
  workshop_notes: string | null;
  approval_status?: string | null;
  approval_token?: string | null;
  approval_requested_at?: string | null;
  approved_at?: string | null;
  approval_notes?: string | null;
}

export interface BespokeCommandCenterProps {
  job: BespokeJob;
  customer: Customer | null;
  invoice: Invoice | null;
  inventory: InventoryItem[];
  tenantId: string;
  currency: string;
  readOnly?: boolean;
  attachments?: JobAttachment[];
  events?: JobEvent[];
}
