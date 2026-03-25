export interface InventoryItem {
  id: string;
  name: string;
  sku: string | null;
  retail_price: number;
  quantity: number;
  primary_image: string | null;
  jewellery_type: string | null;
  item_type: string | null;
  status: string;
}

export interface Customer {
  id: string;
  full_name: string;
  email: string | null;
  store_credit: number | null;
}

export interface CartItem {
  inventoryId: string;
  name: string;
  sku: string | null;
  unitPrice: number;
  quantity: number;
  itemType: string | null;
}

export interface POSClientProps {
  tenantId: string;
  userId: string;
  inventoryItems: InventoryItem[];
  customers: Customer[];
  taxRate: number;
  businessName: string;
  hasStripe?: boolean;
}

export type PaymentTab = "card" | "cash" | "split" | "voucher" | "store_credit" | "layby";

export interface SaleResult {
  id: string;
  saleNumber: string;
  invoiceId?: string;
  customerEmail?: string | null;
  cartSnapshot?: CartItem[];
  paymentMethod?: string;
  depositAmount?: number;
  totalAmount?: number;
}

export interface VoucherData {
  id: string;
  code: string;
  balance: number;
}
