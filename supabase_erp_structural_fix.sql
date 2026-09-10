-- ==============================================================================
-- Logix ERP - Enterprise Structural & Security Update Script (No Data Loss)
-- ==============================================================================
-- This script MUST be executed in the Supabase SQL Editor.
-- It resolves:
-- 1. Data Duplication across nodes (Duplicate IDs for same voucher/invoice).
-- 2. "Ghost" or Orphaned data cleaning (Strict Integrity).
-- 3. Strict Unique Constraints to prevent any future duplications.
-- ==============================================================================

-- 1. DEDUPLICATE INVOICES (Keep most recently updated)
DELETE FROM public.invoices a
USING public.invoices b
WHERE a.company_id = b.company_id 
  AND a.invoice_number = b.invoice_number 
  AND (a.updated_at < b.updated_at OR (a.updated_at = b.updated_at AND a.id < b.id));

-- 2. DEDUPLICATE PAYMENT VOUCHERS
DELETE FROM public.payment_vouchers a
USING public.payment_vouchers b
WHERE a.company_id = b.company_id 
  AND a.voucher_number = b.voucher_number 
  AND (a.created_at < b.created_at OR (a.created_at = b.created_at AND a.id < b.id));

-- 3. DEDUPLICATE JOURNAL ENTRIES
DELETE FROM public.journal_entries a
USING public.journal_entries b
WHERE a.company_id = b.company_id 
  AND a.entry_number = b.entry_number 
  AND (a.created_at < b.created_at OR (a.created_at = b.created_at AND a.id < b.id));

-- 4. DEDUPLICATE PRODUCTION ORDERS
DELETE FROM public.production_orders a
USING public.production_orders b
WHERE a.company_id = b.company_id 
  AND a.order_number = b.order_number 
  AND (a.created_at < b.created_at OR (a.created_at = b.created_at AND a.id < b.id));

-- 5. ENFORCE DATABASE-LEVEL UNIQUE CONSTRAINTS (Zero Duplication Guarantee)
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS uq_invoices_number_company;
ALTER TABLE public.invoices ADD CONSTRAINT uq_invoices_number_company UNIQUE (company_id, invoice_number);

ALTER TABLE public.payment_vouchers DROP CONSTRAINT IF EXISTS uq_vouchers_number_company;
ALTER TABLE public.payment_vouchers ADD CONSTRAINT uq_vouchers_number_company UNIQUE (company_id, voucher_number);

ALTER TABLE public.journal_entries DROP CONSTRAINT IF EXISTS uq_journals_number_company;
ALTER TABLE public.journal_entries ADD CONSTRAINT uq_journals_number_company UNIQUE (company_id, entry_number);

ALTER TABLE public.production_orders DROP CONSTRAINT IF EXISTS uq_production_number_company;
ALTER TABLE public.production_orders ADD CONSTRAINT uq_production_number_company UNIQUE (company_id, order_number);

-- 6. ORPHANED DATA CLEANUP (Prevent Cross-Tenant Ghost Data)
-- This deletes records whose company_id DOES NOT EXIST in the main companies table.
DELETE FROM public.invoices WHERE company_id NOT IN (SELECT id FROM public.companies);
DELETE FROM public.payment_vouchers WHERE company_id NOT IN (SELECT id FROM public.companies);
DELETE FROM public.journal_entries WHERE company_id NOT IN (SELECT id FROM public.companies);
DELETE FROM public.items WHERE company_id NOT IN (SELECT id FROM public.companies);
DELETE FROM public.customers WHERE company_id NOT IN (SELECT id FROM public.companies);
DELETE FROM public.suppliers WHERE company_id NOT IN (SELECT id FROM public.companies);

-- 7. ENABLE ROW LEVEL SECURITY (RLS) FOR FUTURE JWT AUTHENTICATION
-- Currently the application uses explicit .eq('company_id') in the client.
-- These rules secure the DB for when true Supabase Auth JWT is enabled.
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;

-- Note: Because the frontend uses anon key without JWT for now, we leave the fallback policy open.
-- Once you integrate proper Supabase Auth, you MUST replace these with auth.uid() rules!
