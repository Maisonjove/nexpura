-- Multi-store support: Add location_id to key tables

-- Add location_id to EOD reconciliations
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='eod_reconciliations' AND column_name='location_id') THEN
    ALTER TABLE public.eod_reconciliations ADD COLUMN location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add location_id to repairs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='repairs' AND column_name='location_id') THEN
    ALTER TABLE public.repairs ADD COLUMN location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add location_id to bespoke_jobs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bespoke_jobs' AND column_name='location_id') THEN
    ALTER TABLE public.bespoke_jobs ADD COLUMN location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add location_id to sales
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='location_id') THEN
    ALTER TABLE public.sales ADD COLUMN location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add location_id to invoices
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='location_id') THEN
    ALTER TABLE public.invoices ADD COLUMN location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add location_id to expenses
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='location_id') THEN
    ALTER TABLE public.expenses ADD COLUMN location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add location_id to refunds
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='refunds' AND column_name='location_id') THEN
    ALTER TABLE public.refunds ADD COLUMN location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add current_location_id to team_members (tracks which store they're working at today)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='team_members' AND column_name='current_location_id') THEN
    ALTER TABLE public.team_members ADD COLUMN current_location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add default_location_id to team_members (their home store)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='team_members' AND column_name='default_location_id') THEN
    ALTER TABLE public.team_members ADD COLUMN default_location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes for location filtering
CREATE INDEX IF NOT EXISTS idx_eod_reconciliations_location ON public.eod_reconciliations(location_id);
CREATE INDEX IF NOT EXISTS idx_repairs_location ON public.repairs(location_id);
CREATE INDEX IF NOT EXISTS idx_bespoke_jobs_location ON public.bespoke_jobs(location_id);
CREATE INDEX IF NOT EXISTS idx_sales_location ON public.sales(location_id);
CREATE INDEX IF NOT EXISTS idx_invoices_location ON public.invoices(location_id);
CREATE INDEX IF NOT EXISTS idx_expenses_location ON public.expenses(location_id);
