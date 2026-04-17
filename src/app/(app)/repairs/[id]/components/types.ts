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

export interface Repair {
  id: string;
  repair_number: string;
  item_type: string;
  item_description: string;
  repair_type: string;
  work_description: string | null;
  intake_notes: string | null;
  internal_notes: string | null;
  workshop_notes: string | null;
  stage: string;
  priority: string;
  quoted_price: number | null;
  final_price: number | null;
  deposit_amount: number | null;
  deposit_paid: boolean;
  due_date: string | null;
  invoice_id: string | null;
  created_at?: string;
}

export interface RepairCommandCenterProps {
  repair: Repair;
  customer: Customer | null;
  invoice: Invoice | null;
  inventory: InventoryItem[];
  tenantId: string;
  currency: string;
  readOnly?: boolean;
  attachments?: JobAttachment[];
  events?: JobEvent[];
  twilioConnected?: boolean;
  businessName?: string;
  defaultSmsTemplate?: string;
}
