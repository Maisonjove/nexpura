export interface Category {
  id: string;
  name: string;
}

export interface SecondaryStone {
  stone_type: string;
  shape: string;
  carat_weight: string;
  color: string;
  clarity: string;
  cut: string;
  treatment: string;
  count: string;
}

export interface InventoryItem {
  id: string;
  sku: string | null;
  barcode: string | null;
  name: string;
  item_type: string;
  jewellery_type: string | null;
  category_id: string | null;
  description: string | null;
  metal_type: string | null;
  metal_colour: string | null;
  metal_purity: string | null;
  metal_weight_grams: number | null;
  stone_type: string | null;
  stone_carat: number | null;
  stone_colour: string | null;
  stone_clarity: string | null;
  ring_size: string | null;
  dimensions: string | null;
  cost_price: number | null;
  wholesale_price: number | null;
  retail_price: number;
  quantity: number;
  low_stock_threshold: number | null;
  track_quantity: boolean;
  supplier_name: string | null;
  supplier_sku: string | null;
  is_featured: boolean;
  status: string;
  certificate_number?: string | null;
  grading_lab?: string | null;
  grade?: string | null;
  report_url?: string | null;
  cert_image_url?: string | null;
  secondary_stones?: SecondaryStone[] | null;
  metal_form?: string | null;
  stock_location?: string | null;
  consignor_name?: string | null;
  consignor_contact?: string | null;
  consignment_start_date?: string | null;
  consignment_end_date?: string | null;
  consignment_commission_pct?: number | null;
  supplier_invoice_ref?: string | null;
}

export interface InventoryFormProps {
  categories: Category[];
  item?: InventoryItem;
  mode: "create" | "edit";
}
