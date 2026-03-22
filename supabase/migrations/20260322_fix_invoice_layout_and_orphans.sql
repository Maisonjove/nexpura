-- Migration: Fix invoice layout column and orphaned customer references
-- Date: 2026-03-22

-- ============================================================
-- Fix Data Issue 6: Ensure layout column exists with default
-- All invoices should use a valid layout (classic/modern/minimal)
-- ============================================================
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS layout text NOT NULL DEFAULT 'classic';

-- Backfill any NULL or empty layout values to 'classic'
UPDATE invoices
SET layout = 'classic'
WHERE layout IS NULL OR layout = '';

-- ============================================================
-- Fix Data Issue 7: Remove orphaned customer_id references
-- 10 invoices reference customer_id values that no longer exist
-- Set customer_id to NULL for these orphaned records
-- ============================================================
UPDATE invoices
SET customer_id = NULL
WHERE customer_id IS NOT NULL
  AND customer_id NOT IN (SELECT id FROM customers);
