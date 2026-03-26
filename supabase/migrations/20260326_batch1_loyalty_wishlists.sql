-- Batch 1: Add loyalty and wishlist tables

-- Add loyalty columns to customers
ALTER TABLE customers ADD COLUMN IF NOT EXISTS loyalty_points INTEGER DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS loyalty_tier TEXT DEFAULT 'bronze';

-- Loyalty transactions table
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE
);

-- Wishlists table
CREATE TABLE IF NOT EXISTS wishlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  inventory_id UUID REFERENCES inventory(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  notified_at TIMESTAMPTZ,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  UNIQUE(customer_id, inventory_id)
);

-- Enable RLS
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;
