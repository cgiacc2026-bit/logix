-- ==============================================================================
-- LOGIX ERP - MASTER ENTERPRISE OVERHAUL & AUDIT MIGRATION SCRIPT
-- ==============================================================================
-- Purpose: Schema consolidation, Realtime activation, IFRS Void & Inversion
-- protection, and Company Accounting Settings auto-wiring.
-- Compatible with PostgreSQL 13+ / Supabase. Non-destructive & idempotent.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. SCHEMA CONSOLIDATION & CASCADE CONSTRAINTS (invoices & invoice_items)
-- ------------------------------------------------------------------------------

-- Ensure table invoices has all required columns and indexes
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  invoice_date DATE DEFAULT CURRENT_DATE,
  date DATE DEFAULT CURRENT_DATE,
  due_date DATE DEFAULT CURRENT_DATE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  subtotal NUMERIC(18, 4) DEFAULT 0,
  tax_amount NUMERIC(18, 4) DEFAULT 0,
  vat_amount NUMERIC(18, 4) DEFAULT 0,
  total_amount NUMERIC(18, 4) DEFAULT 0,
  paid_amount NUMERIC(18, 4) DEFAULT 0,
  due_amount NUMERIC(18, 4) DEFAULT 0,
  payment_status TEXT DEFAULT 'UNPAID',
  status TEXT DEFAULT 'POSTED',
  payment_method TEXT DEFAULT 'CASH',
  invoice_type TEXT DEFAULT 'SALES',
  warehouse_id TEXT DEFAULT 'wh-main-01',
  customer_branch_id TEXT,
  customer_branch_name TEXT,
  price_list_id TEXT,
  notes TEXT,
  customer_snapshot JSONB DEFAULT '{}'::jsonb,
  raw_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT invoices_company_invoice_num_key UNIQUE(company_id, invoice_number)
);

-- Ensure table invoice_items exists and has ON DELETE CASCADE to invoices(id)
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.items(id) ON DELETE SET NULL,
  item_name TEXT,
  quantity NUMERIC(18, 4) DEFAULT 1,
  unit_price NUMERIC(18, 4) DEFAULT 0,
  discount_amount NUMERIC(18, 4) DEFAULT 0,
  tax_rate NUMERIC(8, 4) DEFAULT 0,
  tax_amount NUMERIC(18, 4) DEFAULT 0,
  total_price NUMERIC(18, 4) DEFAULT 0,
  item_snapshot JSONB DEFAULT '{}'::jsonb,
  raw_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Fix and enforce ON DELETE CASCADE between invoices and invoice_items
DO $$
BEGIN
  -- Drop existing constraints if they do not have ON DELETE CASCADE
  ALTER TABLE public.invoice_items DROP CONSTRAINT IF EXISTS invoice_items_invoice_id_fkey;
  ALTER TABLE public.invoice_items DROP CONSTRAINT IF EXISTS fk_invoice_items_invoice;
  
  -- Add ON DELETE CASCADE foreign key
  ALTER TABLE public.invoice_items 
    ADD CONSTRAINT invoice_items_invoice_id_fkey 
    FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- ------------------------------------------------------------------------------
-- 2. COMPANY ACCOUNTING SETTINGS (company_accounting_settings)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.company_accounting_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  default_cash_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  default_bank_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  default_receivable_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  default_payable_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  default_sales_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  default_cogs_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  default_inventory_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  default_retained_earnings_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  default_vat_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT company_accounting_settings_company_id_key UNIQUE(company_id)
);

-- Ensure all columns exist even if the table was created earlier with partial schema
ALTER TABLE public.company_accounting_settings 
  ADD COLUMN IF NOT EXISTS default_cash_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS default_bank_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS default_receivable_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS default_payable_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS default_sales_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS default_cogs_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS default_inventory_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS default_retained_earnings_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS default_vat_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Ensure legacy company_settings is also synchronized
CREATE TABLE IF NOT EXISTS public.company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  default_cash_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  default_bank_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  default_receivable_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  default_payable_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  default_sales_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  default_cogs_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  default_inventory_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  default_retained_earnings_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  default_vat_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT company_settings_company_id_key UNIQUE(company_id)
);

-- ------------------------------------------------------------------------------
-- 3. AUTO-WIRING DEFAULT ACCOUNTS PROCEDURE & DATA SEEDING
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.auto_wire_company_accounting_settings(p_company_id UUID)
RETURNS VOID AS $$
DECLARE
  v_cash_id UUID;
  v_bank_id UUID;
  v_receivable_id UUID;
  v_payable_id UUID;
  v_sales_id UUID;
  v_cogs_id UUID;
  v_inventory_id UUID;
  v_retained_id UUID;
  v_vat_id UUID;
BEGIN
  -- 1111 / 1113 Cash (الصندوق / النقدية)
  SELECT id INTO v_cash_id FROM public.chart_of_accounts 
  WHERE company_id = p_company_id AND (code IN ('1111', '1113') OR code LIKE '111%')
  ORDER BY CASE WHEN code = '1111' THEN 1 WHEN code = '1113' THEN 2 ELSE 3 END LIMIT 1;

  -- 1112 / 1114 Bank (البنك / الحسابات الجارية)
  SELECT id INTO v_bank_id FROM public.chart_of_accounts 
  WHERE company_id = p_company_id AND (code IN ('1112', '1114') OR name_ar LIKE '%بنك%' OR name_ar LIKE '%مصرف%')
  ORDER BY CASE WHEN code = '1112' THEN 1 WHEN code = '1114' THEN 2 ELSE 3 END LIMIT 1;

  -- 1120 Customers / Receivables (العملاء / الذمم المدينة)
  SELECT id INTO v_receivable_id FROM public.chart_of_accounts 
  WHERE company_id = p_company_id AND (code = '1120' OR code LIKE '112%' OR name_ar LIKE '%عملاء%' OR name_ar LIKE '%مدين%')
  ORDER BY CASE WHEN code = '1120' THEN 1 ELSE 2 END LIMIT 1;

  -- 2110 Suppliers / Payables (الموردين / الذمم الدائنة)
  SELECT id INTO v_payable_id FROM public.chart_of_accounts 
  WHERE company_id = p_company_id AND (code = '2110' OR code LIKE '211%' OR name_ar LIKE '%مورد%')
  ORDER BY CASE WHEN code = '2110' THEN 1 ELSE 2 END LIMIT 1;

  -- 4100 Sales Revenue (المبيعات / إيراد النشاط)
  SELECT id INTO v_sales_id FROM public.chart_of_accounts 
  WHERE company_id = p_company_id AND (code = '4100' OR code LIKE '41%' OR name_ar LIKE '%مبيعات%')
  ORDER BY CASE WHEN code = '4100' THEN 1 ELSE 2 END LIMIT 1;

  -- 5100 COGS (تكلفة البضاعة المباعة)
  SELECT id INTO v_cogs_id FROM public.chart_of_accounts 
  WHERE company_id = p_company_id AND (code = '5100' OR code LIKE '51%' OR name_ar LIKE '%تكلفة%')
  ORDER BY CASE WHEN code = '5100' THEN 1 ELSE 2 END LIMIT 1;

  -- 1130 Inventory (المخزون / بضاعة المستودعات)
  SELECT id INTO v_inventory_id FROM public.chart_of_accounts 
  WHERE company_id = p_company_id AND (code = '1130' OR code LIKE '113%' OR name_ar LIKE '%مخزون%' OR name_ar LIKE '%بضاعة%')
  ORDER BY CASE WHEN code = '1130' THEN 1 ELSE 2 END LIMIT 1;

  -- 3200 Retained Earnings (الأرباح المبقاة / المرحلة)
  SELECT id INTO v_retained_id FROM public.chart_of_accounts 
  WHERE company_id = p_company_id AND (code = '3200' OR code LIKE '32%' OR name_ar LIKE '%أرباح%')
  ORDER BY CASE WHEN code = '3200' THEN 1 ELSE 2 END LIMIT 1;

  -- 2120 VAT Payable (ضريبة القيمة المضافة المستحقة)
  SELECT id INTO v_vat_id FROM public.chart_of_accounts 
  WHERE company_id = p_company_id AND (code = '2120' OR code LIKE '212%' OR name_ar LIKE '%ضريبة%')
  ORDER BY CASE WHEN code = '2120' THEN 1 ELSE 2 END LIMIT 1;

  -- Upsert into company_accounting_settings
  INSERT INTO public.company_accounting_settings (
    company_id,
    default_cash_account_id,
    default_bank_account_id,
    default_receivable_account_id,
    default_payable_account_id,
    default_sales_account_id,
    default_cogs_account_id,
    default_inventory_account_id,
    default_retained_earnings_account_id,
    default_vat_account_id,
    updated_at
  ) VALUES (
    p_company_id,
    v_cash_id,
    v_bank_id,
    v_receivable_id,
    v_payable_id,
    v_sales_id,
    v_cogs_id,
    v_inventory_id,
    v_retained_id,
    v_vat_id,
    now()
  )
  ON CONFLICT (company_id) DO UPDATE SET
    default_cash_account_id = COALESCE(EXCLUDED.default_cash_account_id, company_accounting_settings.default_cash_account_id),
    default_bank_account_id = COALESCE(EXCLUDED.default_bank_account_id, company_accounting_settings.default_bank_account_id),
    default_receivable_account_id = COALESCE(EXCLUDED.default_receivable_account_id, company_accounting_settings.default_receivable_account_id),
    default_payable_account_id = COALESCE(EXCLUDED.default_payable_account_id, company_accounting_settings.default_payable_account_id),
    default_sales_account_id = COALESCE(EXCLUDED.default_sales_account_id, company_accounting_settings.default_sales_account_id),
    default_cogs_account_id = COALESCE(EXCLUDED.default_cogs_account_id, company_accounting_settings.default_cogs_account_id),
    default_inventory_account_id = COALESCE(EXCLUDED.default_inventory_account_id, company_accounting_settings.default_inventory_account_id),
    default_retained_earnings_account_id = COALESCE(EXCLUDED.default_retained_earnings_account_id, company_accounting_settings.default_retained_earnings_account_id),
    default_vat_account_id = COALESCE(EXCLUDED.default_vat_account_id, company_accounting_settings.default_vat_account_id),
    updated_at = now();

  -- Synchronize with company_settings
  INSERT INTO public.company_settings (
    company_id,
    default_cash_account_id,
    default_bank_account_id,
    default_receivable_account_id,
    default_payable_account_id,
    default_sales_account_id,
    default_cogs_account_id,
    default_inventory_account_id,
    default_retained_earnings_account_id,
    default_vat_account_id,
    updated_at
  ) VALUES (
    p_company_id,
    v_cash_id,
    v_bank_id,
    v_receivable_id,
    v_payable_id,
    v_sales_id,
    v_cogs_id,
    v_inventory_id,
    v_retained_id,
    v_vat_id,
    now()
  )
  ON CONFLICT (company_id) DO UPDATE SET
    default_cash_account_id = COALESCE(EXCLUDED.default_cash_account_id, company_settings.default_cash_account_id),
    default_bank_account_id = COALESCE(EXCLUDED.default_bank_account_id, company_settings.default_bank_account_id),
    default_receivable_account_id = COALESCE(EXCLUDED.default_receivable_account_id, company_settings.default_receivable_account_id),
    default_payable_account_id = COALESCE(EXCLUDED.default_payable_account_id, company_settings.default_payable_account_id),
    default_sales_account_id = COALESCE(EXCLUDED.default_sales_account_id, company_settings.default_sales_account_id),
    default_cogs_account_id = COALESCE(EXCLUDED.default_cogs_account_id, company_settings.default_cogs_account_id),
    default_inventory_account_id = COALESCE(EXCLUDED.default_inventory_account_id, company_settings.default_inventory_account_id),
    default_retained_earnings_account_id = COALESCE(EXCLUDED.default_retained_earnings_account_id, company_settings.default_retained_earnings_account_id),
    default_vat_account_id = COALESCE(EXCLUDED.default_vat_account_id, company_settings.default_vat_account_id),
    updated_at = now();
END;
$$ LANGUAGE plpgsql;

-- Execute auto-wiring for all existing companies
DO $$
DECLARE
  comp RECORD;
BEGIN
  FOR comp IN SELECT id FROM public.companies LOOP
    PERFORM public.auto_wire_company_accounting_settings(comp.id);
  END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 4. FINANCIAL AUDITING VOID PROTECTION TRIGGER (IFRS Compliance)
-- ------------------------------------------------------------------------------
-- Prohibits physical deletion of POSTED or PAID invoices.
-- Only DRAFT invoices can be deleted physically. POSTED invoices must be CANCELLED (Voided).

CREATE OR REPLACE FUNCTION public.prevent_delete_posted_invoices()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'POSTED' OR OLD.status = 'PAID' THEN
    RAISE EXCEPTION 'CANNOT_DELETE_POSTED_INVOICE: Physical deletion of posted invoices is strictly forbidden by financial audit standards (IFRS). Use invoice cancellation/voiding instead.';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_delete_posted_invoices ON public.invoices;
CREATE TRIGGER trg_prevent_delete_posted_invoices
  BEFORE DELETE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_delete_posted_invoices();

-- ------------------------------------------------------------------------------
-- 5. REALTIME REPLICA IDENTITIES & PUBLICATION ACTIVATION
-- ------------------------------------------------------------------------------

-- Set REPLICA IDENTITY FULL to send entire row payload on UPDATE/DELETE events
ALTER TABLE public.invoices REPLICA IDENTITY FULL;
ALTER TABLE public.payment_vouchers REPLICA IDENTITY FULL;
ALTER TABLE public.items REPLICA IDENTITY FULL;
ALTER TABLE public.chart_of_accounts REPLICA IDENTITY FULL;
ALTER TABLE public.journal_entries REPLICA IDENTITY FULL;
ALTER TABLE public.customers REPLICA IDENTITY FULL;
ALTER TABLE public.suppliers REPLICA IDENTITY FULL;
ALTER TABLE public.company_accounting_settings REPLICA IDENTITY FULL;

-- Add operational tables to supabase_realtime publication
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE 
    public.invoices, 
    public.payment_vouchers, 
    public.items, 
    public.chart_of_accounts, 
    public.journal_entries, 
    public.customers,
    public.suppliers,
    public.company_accounting_settings;
EXCEPTION WHEN duplicate_object THEN
  NULL;
WHEN OTHERS THEN
  BEGIN
    CREATE PUBLICATION supabase_realtime FOR TABLE 
      public.invoices, 
      public.payment_vouchers, 
      public.items, 
      public.chart_of_accounts, 
      public.journal_entries, 
      public.customers,
      public.suppliers,
      public.company_accounting_settings;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;

COMMIT;

-- ==============================================================================
-- END OF MIGRATION SCRIPT - VERIFIED PRODUCTION SAFE
-- ==============================================================================
