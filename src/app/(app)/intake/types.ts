// Shared types for Intake module

export interface Customer {
  id: string;
  full_name: string | null;
  email: string | null;
  mobile: string | null;
  phone: string | null;
}

export interface InventoryItem {
  id: string;
  name: string | null;
  sku: string | null;
  barcode_value: string | null;
  jewellery_type: string | null;
  metal_type: string | null;
  metal_purity: string | null;
  stone_type: string | null;
  stone_carat: number | null;
  retail_price: number | null;
  quantity: number | null;
  primary_image: string | null;
}

export interface TaxConfig {
  tax_rate: number;
  tax_name: string;
  tax_inclusive: boolean;
  currency: string;
}

export interface IntakeClientProps {
  initialCustomers: Customer[];
  taxConfig: TaxConfig;
}

export type JobType = "repair" | "bespoke" | "stock";

export interface SuccessResult {
  type: JobType;
  id: string;
  number: string;
  invoiceId?: string;
}
