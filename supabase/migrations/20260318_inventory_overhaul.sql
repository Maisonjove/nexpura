-- Migration: 20260318_inventory_overhaul.sql
-- Description: Enhanced inventory system with stock numbering, supplier linking, website listing
-- Author: annot8
-- Date: 2026-03-18

-- ============================================================================
-- 1. ADD STOCK NUMBERING TO TENANTS
-- ============================================================================
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS next_stock_number INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS next_consignment_number INTEGER DEFAULT 1;

-- ============================================================================
-- 2. ENHANCE INVENTORY TABLE
-- ============================================================================

-- Add stock_number column (e.g., "S1", "C5")
ALTER TABLE public.inventory 
ADD COLUMN IF NOT EXISTS stock_number TEXT;

-- Add supplier_id foreign key (rename from supplier_name approach)
-- Note: supplier_id may already exist from migration 013, check first
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'inventory' AND column_name = 'supplier_id'
    ) THEN
        ALTER TABLE public.inventory ADD COLUMN supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add is_consignment flag
ALTER TABLE public.inventory 
ADD COLUMN IF NOT EXISTS is_consignment BOOLEAN DEFAULT FALSE;

-- Add listed_on_website flag
ALTER TABLE public.inventory 
ADD COLUMN IF NOT EXISTS listed_on_website BOOLEAN DEFAULT FALSE;

-- Add sold tracking
ALTER TABLE public.inventory 
ADD COLUMN IF NOT EXISTS sold_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS sold_via TEXT;

-- Add primary_image if not exists (some migrations may have it)
ALTER TABLE public.inventory 
ADD COLUMN IF NOT EXISTS primary_image TEXT;

-- Add item_type if not exists
ALTER TABLE public.inventory 
ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'finished_piece';

-- Add jewellery_type for Ring, Necklace, etc.
ALTER TABLE public.inventory 
ADD COLUMN IF NOT EXISTS jewellery_type TEXT;

-- Add tags for categorization
ALTER TABLE public.inventory 
ADD COLUMN IF NOT EXISTS tags TEXT[];

-- Add deleted_at for soft delete
ALTER TABLE public.inventory 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add low_stock_threshold
ALTER TABLE public.inventory 
ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER DEFAULT 1;

-- Add is_featured flag
ALTER TABLE public.inventory 
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE;

-- Update status check constraint to support new statuses
-- First drop existing constraint if it exists
DO $$ 
BEGIN
    ALTER TABLE public.inventory DROP CONSTRAINT IF EXISTS inventory_status_check;
EXCEPTION WHEN undefined_object THEN
    -- constraint doesn't exist, that's fine
END $$;

-- Add new status check
ALTER TABLE public.inventory 
ADD CONSTRAINT inventory_status_check 
CHECK (status IN ('available', 'sold', 'unavailable', 'reserved', 'in_stock', 'out_of_stock', 'active', 'inactive', 'consignment'));

-- ============================================================================
-- 3. CREATE INDEX ON STOCK NUMBER
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_inventory_stock_number ON public.inventory(tenant_id, stock_number);
CREATE INDEX IF NOT EXISTS idx_inventory_supplier_id ON public.inventory(supplier_id);
CREATE INDEX IF NOT EXISTS idx_inventory_is_consignment ON public.inventory(tenant_id, is_consignment);
CREATE INDEX IF NOT EXISTS idx_inventory_listed_on_website ON public.inventory(tenant_id, listed_on_website);

-- ============================================================================
-- 4. FUNCTION TO GET NEXT STOCK NUMBER
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_next_stock_number(
    p_tenant_id UUID,
    p_is_consignment BOOLEAN DEFAULT FALSE
)
RETURNS TEXT AS $$
DECLARE
    v_prefix TEXT;
    v_number INTEGER;
    v_stock_number TEXT;
BEGIN
    IF p_is_consignment THEN
        v_prefix := 'C';
        UPDATE public.tenants 
        SET next_consignment_number = next_consignment_number + 1
        WHERE id = p_tenant_id
        RETURNING next_consignment_number - 1 INTO v_number;
    ELSE
        v_prefix := 'S';
        UPDATE public.tenants 
        SET next_stock_number = next_stock_number + 1
        WHERE id = p_tenant_id
        RETURNING next_stock_number - 1 INTO v_number;
    END IF;
    
    v_stock_number := v_prefix || v_number::TEXT;
    RETURN v_stock_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. FUNCTION TO CHECK AND INITIALIZE STOCK NUMBERS FROM EXISTING DATA
-- ============================================================================
CREATE OR REPLACE FUNCTION public.initialize_stock_numbers(p_tenant_id UUID)
RETURNS VOID AS $$
DECLARE
    v_max_stock INTEGER := 0;
    v_max_consignment INTEGER := 0;
BEGIN
    -- Find highest existing stock number (S prefix)
    SELECT COALESCE(MAX(
        CASE 
            WHEN stock_number ~ '^S[0-9]+$' 
            THEN SUBSTRING(stock_number FROM 2)::INTEGER 
            ELSE 0 
        END
    ), 0) INTO v_max_stock
    FROM public.inventory
    WHERE tenant_id = p_tenant_id;
    
    -- Find highest existing consignment number (C prefix)
    SELECT COALESCE(MAX(
        CASE 
            WHEN stock_number ~ '^C[0-9]+$' 
            THEN SUBSTRING(stock_number FROM 2)::INTEGER 
            ELSE 0 
        END
    ), 0) INTO v_max_consignment
    FROM public.inventory
    WHERE tenant_id = p_tenant_id;
    
    -- Update tenant with next numbers
    UPDATE public.tenants
    SET 
        next_stock_number = v_max_stock + 1,
        next_consignment_number = v_max_consignment + 1
    WHERE id = p_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. GRANT PERMISSIONS
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.get_next_stock_number(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.initialize_stock_numbers(UUID) TO authenticated;
