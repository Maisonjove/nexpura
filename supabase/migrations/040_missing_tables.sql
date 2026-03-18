-- Migration: 040_missing_tables.sql
-- Description: Create all missing tables that are referenced in the codebase
-- Author: annot8
-- Date: 2026-03-18

-- ============================================================================
-- 1. APPOINTMENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name TEXT,
    customer_email TEXT,
    customer_phone TEXT,
    scheduled_date DATE NOT NULL,
    scheduled_time TIME,
    duration_minutes INTEGER DEFAULT 30,
    appointment_type TEXT DEFAULT 'general',
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')),
    notes TEXT,
    location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
    google_calendar_event_id TEXT,
    reminder_sent BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointments_tenant_id ON public.appointments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled_date ON public.appointments(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_appointments_customer_id ON public.appointments(customer_id);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "appointments_tenant_isolation" ON public.appointments;
CREATE POLICY "appointments_tenant_isolation" ON public.appointments
    FOR ALL USING (tenant_id = public.get_tenant_id());

-- ============================================================================
-- 2. QUOTES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    quote_number TEXT,
    items JSONB DEFAULT '[]'::jsonb,
    total_amount NUMERIC(12,2) DEFAULT 0,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'converted', 'expired')),
    expires_at TIMESTAMPTZ,
    notes TEXT,
    terms TEXT,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quotes_tenant_id ON public.quotes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_quotes_customer_id ON public.quotes(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON public.quotes(status);

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quotes_tenant_isolation" ON public.quotes;
CREATE POLICY "quotes_tenant_isolation" ON public.quotes
    FOR ALL USING (tenant_id = public.get_tenant_id());

-- ============================================================================
-- 3. STOCKTAKES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.stocktakes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    reference_number TEXT,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed', 'cancelled')),
    notes TEXT,
    location TEXT,
    location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    total_items_counted INTEGER DEFAULT 0,
    total_discrepancies INTEGER DEFAULT 0,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stocktakes_tenant_id ON public.stocktakes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stocktakes_status ON public.stocktakes(status);

ALTER TABLE public.stocktakes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stocktakes_tenant_isolation" ON public.stocktakes;
CREATE POLICY "stocktakes_tenant_isolation" ON public.stocktakes
    FOR ALL USING (tenant_id = public.get_tenant_id());

-- ============================================================================
-- 4. STOCKTAKE_ITEMS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.stocktake_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stocktake_id UUID NOT NULL REFERENCES public.stocktakes(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    inventory_id UUID REFERENCES public.inventory(id) ON DELETE SET NULL,
    sku TEXT,
    item_name TEXT NOT NULL,
    expected_qty INTEGER DEFAULT 0,
    counted_qty INTEGER,
    discrepancy INTEGER GENERATED ALWAYS AS (COALESCE(counted_qty, 0) - expected_qty) STORED,
    barcode_value TEXT,
    notes TEXT,
    counted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    counted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stocktake_items_stocktake_id ON public.stocktake_items(stocktake_id);
CREATE INDEX IF NOT EXISTS idx_stocktake_items_tenant_id ON public.stocktake_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stocktake_items_inventory_id ON public.stocktake_items(inventory_id);

ALTER TABLE public.stocktake_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stocktake_items_tenant_isolation" ON public.stocktake_items;
CREATE POLICY "stocktake_items_tenant_isolation" ON public.stocktake_items
    FOR ALL USING (tenant_id = public.get_tenant_id());

-- ============================================================================
-- 5. TASK_TEMPLATES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.task_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    default_priority TEXT DEFAULT 'medium',
    default_due_days INTEGER,
    linked_type TEXT,
    checklist JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_templates_tenant_id ON public.task_templates(tenant_id);

ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "task_templates_tenant_isolation" ON public.task_templates;
CREATE POLICY "task_templates_tenant_isolation" ON public.task_templates
    FOR ALL USING (tenant_id = public.get_tenant_id());

-- ============================================================================
-- 6. TASK_ACTIVITIES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.task_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    activity_type TEXT NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_activities_task_id ON public.task_activities(task_id);
CREATE INDEX IF NOT EXISTS idx_task_activities_tenant_id ON public.task_activities(tenant_id);

ALTER TABLE public.task_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "task_activities_tenant_isolation" ON public.task_activities;
CREATE POLICY "task_activities_tenant_isolation" ON public.task_activities
    FOR ALL USING (tenant_id = public.get_tenant_id());

-- ============================================================================
-- 7. TASK_COMMENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.task_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON public.task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_tenant_id ON public.task_comments(tenant_id);

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "task_comments_tenant_isolation" ON public.task_comments;
CREATE POLICY "task_comments_tenant_isolation" ON public.task_comments
    FOR ALL USING (tenant_id = public.get_tenant_id());

-- ============================================================================
-- 8. TASK_ATTACHMENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.task_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT,
    file_size INTEGER DEFAULT 0,
    uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON public.task_attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_tenant_id ON public.task_attachments(tenant_id);

ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "task_attachments_tenant_isolation" ON public.task_attachments;
CREATE POLICY "task_attachments_tenant_isolation" ON public.task_attachments
    FOR ALL USING (tenant_id = public.get_tenant_id());

-- ============================================================================
-- 9. STOCK_TRANSFERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.stock_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    from_location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    to_location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_transit', 'completed', 'cancelled')),
    notes TEXT,
    transferred_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_transfers_tenant_id ON public.stock_transfers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_from_location ON public.stock_transfers(from_location_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_to_location ON public.stock_transfers(to_location_id);

ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stock_transfers_tenant_isolation" ON public.stock_transfers;
CREATE POLICY "stock_transfers_tenant_isolation" ON public.stock_transfers
    FOR ALL USING (tenant_id = public.get_tenant_id());

-- ============================================================================
-- 10. STOCK_TRANSFER_ITEMS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.stock_transfer_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_id UUID NOT NULL REFERENCES public.stock_transfers(id) ON DELETE CASCADE,
    inventory_id UUID NOT NULL REFERENCES public.inventory(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_transfer_items_transfer_id ON public.stock_transfer_items(transfer_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfer_items_inventory_id ON public.stock_transfer_items(inventory_id);

-- ============================================================================
-- 11. REFUND_ITEMS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.refund_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    refund_id UUID NOT NULL REFERENCES public.refunds(id) ON DELETE CASCADE,
    original_sale_item_id UUID REFERENCES public.sale_items(id) ON DELETE SET NULL,
    inventory_id UUID REFERENCES public.inventory(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
    line_total NUMERIC(12,2) NOT NULL DEFAULT 0,
    restock BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refund_items_refund_id ON public.refund_items(refund_id);
CREATE INDEX IF NOT EXISTS idx_refund_items_tenant_id ON public.refund_items(tenant_id);

ALTER TABLE public.refund_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "refund_items_tenant_isolation" ON public.refund_items;
CREATE POLICY "refund_items_tenant_isolation" ON public.refund_items
    FOR ALL USING (tenant_id = public.get_tenant_id());

-- ============================================================================
-- 12. PRINT_JOBS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.print_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL,
    document_id UUID,
    document_title TEXT,
    printer_type TEXT DEFAULT 'office' CHECK (printer_type IN ('receipt', 'label', 'office')),
    status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'printing', 'done', 'failed', 'cancelled')),
    copies INTEGER DEFAULT 1,
    pdf_url TEXT,
    error_message TEXT,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    printed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_print_jobs_tenant_id ON public.print_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_print_jobs_status ON public.print_jobs(status);

ALTER TABLE public.print_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "print_jobs_tenant_isolation" ON public.print_jobs;
CREATE POLICY "print_jobs_tenant_isolation" ON public.print_jobs
    FOR ALL USING (tenant_id = public.get_tenant_id());

-- ============================================================================
-- 13. SHOP_ENQUIRIES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.shop_enquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    enquiry_type TEXT DEFAULT 'general',
    message TEXT,
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'read', 'replied', 'archived')),
    source TEXT DEFAULT 'website',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shop_enquiries_tenant_id ON public.shop_enquiries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shop_enquiries_status ON public.shop_enquiries(status);

ALTER TABLE public.shop_enquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shop_enquiries_tenant_isolation" ON public.shop_enquiries;
CREATE POLICY "shop_enquiries_tenant_isolation" ON public.shop_enquiries
    FOR ALL USING (tenant_id = public.get_tenant_id());

-- ============================================================================
-- 14. SITE_PAGES TABLE (alias for website builder)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.site_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    page_type TEXT DEFAULT 'custom',
    meta_title TEXT,
    meta_description TEXT,
    published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_site_pages_tenant_id ON public.site_pages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_site_pages_slug ON public.site_pages(slug);

ALTER TABLE public.site_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_pages_tenant_isolation" ON public.site_pages;
CREATE POLICY "site_pages_tenant_isolation" ON public.site_pages
    FOR ALL USING (tenant_id = public.get_tenant_id());

-- ============================================================================
-- 15. SITE_SECTIONS TABLE (alias for website builder)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.site_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id UUID NOT NULL REFERENCES public.site_pages(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    section_type TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    content JSONB DEFAULT '{}'::jsonb,
    styles JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_site_sections_page_id ON public.site_sections(page_id);
CREATE INDEX IF NOT EXISTS idx_site_sections_tenant_id ON public.site_sections(tenant_id);

ALTER TABLE public.site_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_sections_tenant_isolation" ON public.site_sections;
CREATE POLICY "site_sections_tenant_isolation" ON public.site_sections
    FOR ALL USING (tenant_id = public.get_tenant_id());

-- ============================================================================
-- 16. ACTIVITY_LOG TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id UUID,
    entity_name TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_tenant_id ON public.activity_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON public.activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON public.activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON public.activity_log(created_at);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activity_log_tenant_isolation" ON public.activity_log;
CREATE POLICY "activity_log_tenant_isolation" ON public.activity_log
    FOR ALL USING (tenant_id = public.get_tenant_id());

-- ============================================================================
-- 17. SETTINGS TABLE (tenant-level settings)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE,
    tax_rate NUMERIC(5,4) DEFAULT 0.1,
    currency TEXT DEFAULT 'AUD',
    timezone TEXT DEFAULT 'Australia/Sydney',
    date_format TEXT DEFAULT 'DD/MM/YYYY',
    receipt_footer TEXT,
    invoice_prefix TEXT DEFAULT 'INV',
    quote_prefix TEXT DEFAULT 'Q',
    auto_generate_sku BOOLEAN DEFAULT TRUE,
    low_stock_threshold INTEGER DEFAULT 5,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_settings_tenant_id ON public.settings(tenant_id);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_tenant_isolation" ON public.settings;
CREATE POLICY "settings_tenant_isolation" ON public.settings
    FOR ALL USING (tenant_id = public.get_tenant_id());

-- ============================================================================
-- 18. CUSTOMER_COMMUNICATIONS TABLE (maps to existing communications)
-- Note: Creating view/alias for code compatibility
-- ============================================================================
-- The code references customer_communications but we have communications table
-- Creating a view for compatibility:
DROP VIEW IF EXISTS public.customer_communications;
CREATE VIEW public.customer_communications AS 
SELECT * FROM public.communications;

-- ============================================================================
-- 19. LABEL_TEMPLATES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.label_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    label_type TEXT DEFAULT 'product' CHECK (label_type IN ('product', 'price', 'barcode', 'custom')),
    width_mm NUMERIC(6,2) DEFAULT 50,
    height_mm NUMERIC(6,2) DEFAULT 25,
    template_data JSONB DEFAULT '{}'::jsonb,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_label_templates_tenant_id ON public.label_templates(tenant_id);

ALTER TABLE public.label_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "label_templates_tenant_isolation" ON public.label_templates;
CREATE POLICY "label_templates_tenant_isolation" ON public.label_templates
    FOR ALL USING (tenant_id = public.get_tenant_id());

-- ============================================================================
-- 20. UPLOADS TABLE (for general file uploads)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT,
    file_size INTEGER,
    mime_type TEXT,
    entity_type TEXT,
    entity_id UUID,
    uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_uploads_tenant_id ON public.uploads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_uploads_entity ON public.uploads(entity_type, entity_id);

ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "uploads_tenant_isolation" ON public.uploads;
CREATE POLICY "uploads_tenant_isolation" ON public.uploads
    FOR ALL USING (tenant_id = public.get_tenant_id());

-- ============================================================================
-- ADD google_calendar_event_id to jobs table if it doesn't exist
-- (The code references jobs table for repairs with calendar sync)
-- ============================================================================
-- Note: The codebase uses bespoke_jobs for repair jobs
-- Adding google_calendar_event_id column for calendar sync
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bespoke_jobs') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'bespoke_jobs' AND column_name = 'google_calendar_event_id'
        ) THEN
            ALTER TABLE public.bespoke_jobs ADD COLUMN google_calendar_event_id TEXT;
        END IF;
    END IF;
END $$;

-- ============================================================================
-- Grant permissions
-- ============================================================================
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
