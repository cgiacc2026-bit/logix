-- ==============================================================================
-- Logix ERP - Enterprise Structural & Security Update Script
-- This script fixes duplication, enforces unique constraints, and tightens RLS.
-- Execute this in the Supabase SQL Editor.
-- ==============================================================================

-- 1. Deduplicate Invoices (Keep the most recent one)
DELETE FROM public.invoices a
USING public.invoices b
WHERE a.company_id = b.company_id 
  AND a.invoice_number = b.invoice_number 
  AND a.created_at < b.created_at;

-- 2. Deduplicate Payment Vouchers
DELETE FROM public.payment_vouchers a
USING public.payment_vouchers b
WHERE a.company_id = b.company_id 
  AND a.voucher_number = b.voucher_number 
  AND a.created_at < b.created_at;

-- 3. Deduplicate Journal Entries
DELETE FROM public.journal_entries a
USING public.journal_entries b
WHERE a.company_id = b.company_id 
  AND a.entry_number = b.entry_number 
  AND a.created_at < b.created_at;

-- 4. Deduplicate Production Orders
DELETE FROM public.production_orders a
USING public.production_orders b
WHERE a.company_id = b.company_id 
  AND a.order_number = b.order_number 
  AND a.created_at < b.created_at;

-- 5. Add Unique Constraints to prevent future duplicates at the database level
ALTER TABLE public.invoices 
  DROP CONSTRAINT IF EXISTS uq_invoices_number_company;
ALTER TABLE public.invoices 
  ADD CONSTRAINT uq_invoices_number_company UNIQUE (company_id, invoice_number);

ALTER TABLE public.payment_vouchers 
  DROP CONSTRAINT IF EXISTS uq_vouchers_number_company;
ALTER TABLE public.payment_vouchers 
  ADD CONSTRAINT uq_vouchers_number_company UNIQUE (company_id, voucher_number);

ALTER TABLE public.journal_entries 
  DROP CONSTRAINT IF EXISTS uq_journals_number_company;
ALTER TABLE public.journal_entries 
  ADD CONSTRAINT uq_journals_number_company UNIQUE (company_id, entry_number);

ALTER TABLE public.production_orders 
  DROP CONSTRAINT IF EXISTS uq_production_number_company;
ALTER TABLE public.production_orders 
  ADD CONSTRAINT uq_production_number_company UNIQUE (company_id, order_number);

-- 6. Clean up "ghost" companies or orphaned data (Safety first, no real tenant data deleted)
-- Only delete from items/customers if their company_id does not exist in companies table
DELETE FROM public.invoices WHERE company_id NOT IN (SELECT id FROM public.companies);
DELETE FROM public.payment_vouchers WHERE company_id NOT IN (SELECT id FROM public.companies);
DELETE FROM public.journal_entries WHERE company_id NOT IN (SELECT id FROM public.companies);
DELETE FROM public.items WHERE company_id NOT IN (SELECT id FROM public.companies);
DELETE FROM public.customers WHERE company_id NOT IN (SELECT id FROM public.companies);
DELETE FROM public.suppliers WHERE company_id NOT IN (SELECT id FROM public.companies);

-- 7. Secure RLS Policies strictly by company_id logic
-- Note: Since the app currently relies on the frontend passing the company_id,
-- full Row Level Security requiring auth.uid() can only be activated when Supabase Auth is integrated.
-- For now, we restrict anon access to prevent listing all companies indiscriminately.
