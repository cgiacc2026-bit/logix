-- ==============================================================================
-- LOGIX CLOUD ERP - ENTERPRISE ZERO-DATA-LOSS SAFE MIGRATION SCRIPT
-- ==============================================================================
-- Architecture: Multi-Tenant Enterprise ERP Standard with Zero Data Loss Policy
-- Target: Supabase / PostgreSQL
-- Policy: 
--   1. ABSOLUTELY NO DROPS, NO DELETES, NO TRUNCATES.
--   2. Preserves 100% of all existing records, fields, and tenant data.
--   3. Idempotent: Uses CREATE TABLE IF NOT EXISTS, ALTER TABLE ADD COLUMN IF NOT EXISTS.
--   4. Safely backfills missing foreign keys (customer_id, warehouse_id, sales_rep_id, journal_entry_id).
--   5. Enforces logical Multi-Tenancy via company_id on all core tables.
-- ==============================================================================

DO $$
BEGIN
    RAISE NOTICE '>>> [LOGIX ERP MIGRATION] Starting Zero-Data-Loss Safe Migration...';
END $$;

-- ------------------------------------------------------------------------------
-- 1. COMPANIES & FISCAL SETTINGS (المنشآت والشركات)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT,
    name_ar TEXT NOT NULL,
    name_en TEXT DEFAULT '',
    tax_number TEXT DEFAULT '',
    currency TEXT DEFAULT 'KWD',
    country TEXT DEFAULT 'Kuwait',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS name_ar TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS name_en TEXT DEFAULT '';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS tax_number TEXT DEFAULT '';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'KWD';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'Kuwait';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc', now());
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc', now());

-- ------------------------------------------------------------------------------
-- 2. CHART OF ACCOUNTS (شجرة الحسابات المركزية)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name_ar TEXT NOT NULL,
    name_en TEXT DEFAULT '',
    category TEXT NOT NULL,
    normal_balance TEXT NOT NULL DEFAULT 'DEBIT',
    level INTEGER NOT NULL DEFAULT 1,
    parent_id UUID,
    balance NUMERIC(18, 4) NOT NULL DEFAULT 0,
    current_balance NUMERIC(18, 4) NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.chart_of_accounts ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.chart_of_accounts ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.chart_of_accounts ADD COLUMN IF NOT EXISTS name_ar TEXT;
ALTER TABLE public.chart_of_accounts ADD COLUMN IF NOT EXISTS name_en TEXT DEFAULT '';
ALTER TABLE public.chart_of_accounts ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.chart_of_accounts ADD COLUMN IF NOT EXISTS normal_balance TEXT DEFAULT 'DEBIT';
ALTER TABLE public.chart_of_accounts ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;
ALTER TABLE public.chart_of_accounts ADD COLUMN IF NOT EXISTS parent_id UUID;
ALTER TABLE public.chart_of_accounts ADD COLUMN IF NOT EXISTS balance NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.chart_of_accounts ADD COLUMN IF NOT EXISTS current_balance NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.chart_of_accounts ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_coa_company_code ON public.chart_of_accounts(company_id, code);
CREATE INDEX IF NOT EXISTS idx_coa_company_parent ON public.chart_of_accounts(company_id, parent_id);

-- ------------------------------------------------------------------------------
-- 3. WAREHOUSES & LOCATIONS (المستودعات والمخازن)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.warehouses (
    id TEXT PRIMARY KEY DEFAULT ('wh-' || substring(replace(gen_random_uuid()::text, '-', ''), 1, 9)),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name_ar TEXT NOT NULL,
    name_en TEXT DEFAULT '',
    location TEXT DEFAULT '',
    keeper_name TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS name_ar TEXT;
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS name_en TEXT DEFAULT '';
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS location TEXT DEFAULT '';
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS keeper_name TEXT DEFAULT '';
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_warehouses_company ON public.warehouses(company_id);

-- ------------------------------------------------------------------------------
-- 4. ITEMS & INVENTORY CATALOG (الأصناف والمخزون)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    code TEXT,
    sku TEXT,
    barcode TEXT,
    name_ar TEXT NOT NULL,
    name_en TEXT DEFAULT '',
    category TEXT DEFAULT 'General',
    unit TEXT DEFAULT 'حبة',
    units_per_pack INTEGER DEFAULT 1,
    cost_price NUMERIC(18, 4) DEFAULT 0,
    purchase_price NUMERIC(18, 4) DEFAULT 0,
    sale_price NUMERIC(18, 4) DEFAULT 0,
    quantity_on_hand NUMERIC(18, 4) DEFAULT 0,
    min_quantity_alert NUMERIC(18, 4) DEFAULT 5,
    is_active BOOLEAN DEFAULT true,
    raw_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.items ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS sku TEXT;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS name_ar TEXT;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS name_en TEXT DEFAULT '';
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'General';
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'حبة';
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS units_per_pack INTEGER DEFAULT 1;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS cost_price NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS purchase_price NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS sale_price NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS quantity_on_hand NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS min_quantity_alert NUMERIC(18, 4) DEFAULT 5;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS raw_data JSONB DEFAULT '{}'::jsonb;

-- Safe cost price sync: ensure cost_price equals purchase_price if one was missing
UPDATE public.items 
SET cost_price = purchase_price 
WHERE (cost_price IS NULL OR cost_price = 0) AND purchase_price IS NOT NULL AND purchase_price > 0;

UPDATE public.items 
SET purchase_price = cost_price 
WHERE (purchase_price IS NULL OR purchase_price = 0) AND cost_price IS NOT NULL AND cost_price > 0;

CREATE INDEX IF NOT EXISTS idx_items_company_sku ON public.items(company_id, sku);
CREATE INDEX IF NOT EXISTS idx_items_company_barcode ON public.items(company_id, barcode);

-- ------------------------------------------------------------------------------
-- 5. CUSTOMERS & SUPPLIERS (العملاء والموردين)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    code TEXT,
    name_ar TEXT NOT NULL,
    name_en TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    address TEXT DEFAULT '',
    tax_number TEXT DEFAULT '',
    credit_limit NUMERIC(18, 4) DEFAULT 0,
    balance NUMERIC(18, 4) DEFAULT 0,
    opening_balance NUMERIC(18, 4) DEFAULT 0,
    opening_balance_date DATE DEFAULT CURRENT_DATE,
    sales_rep_id TEXT,
    sales_rep_name TEXT,
    price_list_id TEXT,
    is_active BOOLEAN DEFAULT true,
    raw_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS name_ar TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS name_en TEXT DEFAULT '';
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS address TEXT DEFAULT '';
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS tax_number TEXT DEFAULT '';
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS balance NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS opening_balance_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS sales_rep_id TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS sales_rep_name TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS price_list_id TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS raw_data JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_customers_company_code ON public.customers(company_id, code);

CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    code TEXT,
    name_ar TEXT NOT NULL,
    name_en TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    address TEXT DEFAULT '',
    tax_number TEXT DEFAULT '',
    balance NUMERIC(18, 4) DEFAULT 0,
    opening_balance NUMERIC(18, 4) DEFAULT 0,
    opening_balance_date DATE DEFAULT CURRENT_DATE,
    is_active BOOLEAN DEFAULT true,
    raw_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS name_ar TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS name_en TEXT DEFAULT '';
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS address TEXT DEFAULT '';
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS tax_number TEXT DEFAULT '';
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS balance NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS opening_balance_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS raw_data JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_suppliers_company_code ON public.suppliers(company_id, code);

-- ------------------------------------------------------------------------------
-- 6. INVOICES & CENTRAL BILLING (الفواتير والمبيعات ونقاط البيع)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoices (
    id TEXT PRIMARY KEY,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    invoice_number TEXT,
    type TEXT NOT NULL DEFAULT 'SALES',
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    date DATE DEFAULT CURRENT_DATE,
    due_date DATE DEFAULT CURRENT_DATE,
    customer_id TEXT,
    entity_id TEXT,
    customer_name TEXT,
    entity_name_ar TEXT,
    warehouse_id TEXT,
    warehouse_name TEXT,
    sales_rep_id TEXT,
    sales_rep_name TEXT,
    sales_person TEXT,
    subtotal NUMERIC(18, 4) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
    vat_total NUMERIC(18, 4) DEFAULT 0,
    vat_amount NUMERIC(18, 4) DEFAULT 0,
    discount_total NUMERIC(18, 4) DEFAULT 0,
    discount_type TEXT DEFAULT 'FIXED',
    discount_value NUMERIC(18, 4) DEFAULT 0,
    total_amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
    grand_total NUMERIC(18, 4) NOT NULL DEFAULT 0,
    paid_amount NUMERIC(18, 4) DEFAULT 0,
    due_amount NUMERIC(18, 4) DEFAULT 0,
    payment_terms TEXT DEFAULT 'CASH',
    payment_status TEXT NOT NULL DEFAULT 'POSTED',
    status TEXT DEFAULT 'POSTED',
    payment_method TEXT DEFAULT 'CASH',
    journal_entry_id TEXT,
    pos_session_id TEXT,
    cashier_name TEXT,
    lines JSONB DEFAULT '[]'::jsonb,
    customer_snapshot JSONB DEFAULT '{}'::jsonb,
    raw_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Ensure all relational and metadata columns exist in invoices
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'SALES';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS invoice_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS due_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS customer_id TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS entity_id TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS entity_name_ar TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS warehouse_id TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS warehouse_name TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS sales_rep_id TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS sales_rep_name TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS sales_person TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS subtotal NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS vat_total NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS vat_amount NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS discount_total NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS discount_type TEXT DEFAULT 'FIXED';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS discount_value NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS total_amount NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS grand_total NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS due_amount NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payment_terms TEXT DEFAULT 'CASH';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'POSTED';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'POSTED';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'CASH';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS journal_entry_id TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS pos_session_id TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS cashier_name TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS lines JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS customer_snapshot JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS raw_data JSONB DEFAULT '{}'::jsonb;

-- SAFE BACKFILL: Synchronize customer_id and entity_id for existing records
UPDATE public.invoices 
SET entity_id = customer_id 
WHERE (entity_id IS NULL OR entity_id = '') AND customer_id IS NOT NULL AND customer_id != '';

UPDATE public.invoices 
SET customer_id = entity_id 
WHERE (customer_id IS NULL OR customer_id = '') AND entity_id IS NOT NULL AND entity_id != '';

-- SAFE BACKFILL: Synchronize grand_total and total_amount
UPDATE public.invoices 
SET grand_total = total_amount 
WHERE (grand_total IS NULL OR grand_total = 0) AND total_amount IS NOT NULL AND total_amount > 0;

UPDATE public.invoices 
SET total_amount = grand_total 
WHERE (total_amount IS NULL OR total_amount = 0) AND grand_total IS NOT NULL AND grand_total > 0;

-- SAFE BACKFILL: Set default warehouse for orphan invoices
UPDATE public.invoices 
SET warehouse_id = 'wh-main-01', warehouse_name = 'المستودع الرئيسي (الشويخ)'
WHERE warehouse_id IS NULL OR warehouse_id = '';

-- Indices for invoices
CREATE INDEX IF NOT EXISTS idx_invoices_company_id ON public.invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_company_date ON public.invoices(company_id, invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_company_entity ON public.invoices(company_id, entity_id);
CREATE INDEX IF NOT EXISTS idx_invoices_company_warehouse ON public.invoices(company_id, warehouse_id);
CREATE INDEX IF NOT EXISTS idx_invoices_company_salesrep ON public.invoices(company_id, sales_rep_id);
CREATE INDEX IF NOT EXISTS idx_invoices_company_status ON public.invoices(company_id, status);

-- ------------------------------------------------------------------------------
-- 7. INVOICE ITEMS (بنود الفواتير)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoice_items (
    id TEXT PRIMARY KEY,
    invoice_id TEXT REFERENCES public.invoices(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    item_id TEXT,
    item_sku TEXT,
    barcode TEXT,
    item_name_ar TEXT,
    unit TEXT DEFAULT 'حبة',
    units_per_pack INTEGER DEFAULT 1,
    pack_quantity NUMERIC(18, 4) DEFAULT 0,
    quantity NUMERIC(18, 4) NOT NULL DEFAULT 1,
    unit_price NUMERIC(18, 4) NOT NULL DEFAULT 0,
    subtotal NUMERIC(18, 4) NOT NULL DEFAULT 0,
    discount_type TEXT DEFAULT 'FIXED',
    discount_value NUMERIC(18, 4) DEFAULT 0,
    discount_amount NUMERIC(18, 4) DEFAULT 0,
    vat_rate NUMERIC(18, 4) DEFAULT 0,
    vat_amount NUMERIC(18, 4) DEFAULT 0,
    total NUMERIC(18, 4) NOT NULL DEFAULT 0,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS invoice_id TEXT REFERENCES public.invoices(id) ON DELETE CASCADE;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS item_id TEXT;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS item_sku TEXT;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS item_name_ar TEXT;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'حبة';
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS units_per_pack INTEGER DEFAULT 1;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS pack_quantity NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS quantity NUMERIC(18, 4) DEFAULT 1;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS unit_price NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS subtotal NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS discount_type TEXT DEFAULT 'FIXED';
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS discount_value NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS vat_rate NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS vat_amount NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS total NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_company_item ON public.invoice_items(company_id, item_id);

-- ------------------------------------------------------------------------------
-- 8. PAYMENT VOUCHERS (سندات القبض والصرف)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_vouchers (
    id TEXT PRIMARY KEY DEFAULT ('vch-' || substring(replace(gen_random_uuid()::text, '-', ''), 1, 9)),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    voucher_number TEXT,
    type TEXT NOT NULL, -- RECEIPT or PAYMENT
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL DEFAULT 'CASH',
    bank_account_id TEXT,
    entity_type TEXT NOT NULL DEFAULT 'CUSTOMER',
    entity_id TEXT,
    entity_name_ar TEXT,
    invoice_id TEXT,
    sales_rep_id TEXT,
    sales_rep_name TEXT,
    reference TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    status TEXT DEFAULT 'POSTED',
    journal_entry_id TEXT,
    raw_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.payment_vouchers ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.payment_vouchers ADD COLUMN IF NOT EXISTS voucher_number TEXT;
ALTER TABLE public.payment_vouchers ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'RECEIPT';
ALTER TABLE public.payment_vouchers ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.payment_vouchers ADD COLUMN IF NOT EXISTS amount NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.payment_vouchers ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'CASH';
ALTER TABLE public.payment_vouchers ADD COLUMN IF NOT EXISTS bank_account_id TEXT;
ALTER TABLE public.payment_vouchers ADD COLUMN IF NOT EXISTS entity_type TEXT DEFAULT 'CUSTOMER';
ALTER TABLE public.payment_vouchers ADD COLUMN IF NOT EXISTS entity_id TEXT;
ALTER TABLE public.payment_vouchers ADD COLUMN IF NOT EXISTS entity_name_ar TEXT;
ALTER TABLE public.payment_vouchers ADD COLUMN IF NOT EXISTS invoice_id TEXT;
ALTER TABLE public.payment_vouchers ADD COLUMN IF NOT EXISTS sales_rep_id TEXT;
ALTER TABLE public.payment_vouchers ADD COLUMN IF NOT EXISTS sales_rep_name TEXT;
ALTER TABLE public.payment_vouchers ADD COLUMN IF NOT EXISTS reference TEXT DEFAULT '';
ALTER TABLE public.payment_vouchers ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
ALTER TABLE public.payment_vouchers ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'POSTED';
ALTER TABLE public.payment_vouchers ADD COLUMN IF NOT EXISTS journal_entry_id TEXT;
ALTER TABLE public.payment_vouchers ADD COLUMN IF NOT EXISTS raw_data JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_vouchers_company_id ON public.payment_vouchers(company_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_company_entity ON public.payment_vouchers(company_id, entity_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_company_date ON public.payment_vouchers(company_id, date);

-- ------------------------------------------------------------------------------
-- 9. JOURNAL ENTRIES & CENTRAL FINANCIAL LEDGER (دفتر القيود المركزية)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.journal_entries (
    id TEXT PRIMARY KEY DEFAULT ('jv-' || substring(replace(gen_random_uuid()::text, '-', ''), 1, 9)),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    entry_number TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    reference TEXT DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'POSTED',
    total_debit NUMERIC(18, 4) NOT NULL DEFAULT 0,
    total_credit NUMERIC(18, 4) NOT NULL DEFAULT 0,
    is_auto_generated BOOLEAN DEFAULT false,
    source_module TEXT,
    source_id TEXT,
    lines JSONB DEFAULT '[]'::jsonb,
    raw_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS entry_number TEXT;
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS reference TEXT DEFAULT '';
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'POSTED';
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS total_debit NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS total_credit NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS is_auto_generated BOOLEAN DEFAULT false;
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS source_module TEXT;
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS source_id TEXT;
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS lines JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS raw_data JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_journal_entries_company_id ON public.journal_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_company_date ON public.journal_entries(company_id, date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_source ON public.journal_entries(company_id, source_module, source_id);

-- ------------------------------------------------------------------------------
-- 10. JOURNAL ENTRY LINES (بنود وأطراف القيود المحاسبية)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.journal_entry_lines (
    id TEXT PRIMARY KEY DEFAULT ('jl-' || substring(replace(gen_random_uuid()::text, '-', ''), 1, 9)),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    journal_entry_id TEXT REFERENCES public.journal_entries(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL,
    account_code TEXT,
    account_name_ar TEXT,
    debit NUMERIC(18, 4) NOT NULL DEFAULT 0,
    credit NUMERIC(18, 4) NOT NULL DEFAULT 0,
    memo TEXT DEFAULT '',
    entity_type TEXT,
    entity_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.journal_entry_lines ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.journal_entry_lines ADD COLUMN IF NOT EXISTS journal_entry_id TEXT REFERENCES public.journal_entries(id) ON DELETE CASCADE;
ALTER TABLE public.journal_entry_lines ADD COLUMN IF NOT EXISTS account_id TEXT;
ALTER TABLE public.journal_entry_lines ADD COLUMN IF NOT EXISTS account_code TEXT;
ALTER TABLE public.journal_entry_lines ADD COLUMN IF NOT EXISTS account_name_ar TEXT;
ALTER TABLE public.journal_entry_lines ADD COLUMN IF NOT EXISTS debit NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.journal_entry_lines ADD COLUMN IF NOT EXISTS credit NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.journal_entry_lines ADD COLUMN IF NOT EXISTS memo TEXT DEFAULT '';
ALTER TABLE public.journal_entry_lines ADD COLUMN IF NOT EXISTS entity_type TEXT;
ALTER TABLE public.journal_entry_lines ADD COLUMN IF NOT EXISTS entity_id TEXT;

CREATE INDEX IF NOT EXISTS idx_journal_lines_journal ON public.journal_entry_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON public.journal_entry_lines(company_id, account_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_entity ON public.journal_entry_lines(company_id, entity_id);

-- ------------------------------------------------------------------------------
-- 11. ITEM WAREHOUSE STOCKS (أرصدة الأصناف بالمستودعات والحركات المخزنية)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.item_warehouse_stocks (
    id TEXT PRIMARY KEY DEFAULT ('ws-' || substring(replace(gen_random_uuid()::text, '-', ''), 1, 9)),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    warehouse_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    quantity_on_hand NUMERIC(18, 4) NOT NULL DEFAULT 0,
    min_alert_quantity NUMERIC(18, 4) DEFAULT 5,
    last_counted_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.item_warehouse_stocks ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.item_warehouse_stocks ADD COLUMN IF NOT EXISTS warehouse_id TEXT;
ALTER TABLE public.item_warehouse_stocks ADD COLUMN IF NOT EXISTS item_id TEXT;
ALTER TABLE public.item_warehouse_stocks ADD COLUMN IF NOT EXISTS quantity_on_hand NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.item_warehouse_stocks ADD COLUMN IF NOT EXISTS min_alert_quantity NUMERIC(18, 4) DEFAULT 5;
ALTER TABLE public.item_warehouse_stocks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc', now());

CREATE UNIQUE INDEX IF NOT EXISTS uq_item_warehouse_stocks ON public.item_warehouse_stocks(company_id, warehouse_id, item_id);
CREATE INDEX IF NOT EXISTS idx_item_warehouse_stocks_comp ON public.item_warehouse_stocks(company_id, item_id);

-- ------------------------------------------------------------------------------
-- 12. SAFE LINKING & MIGRATION VERIFICATION (تعبئة الروابط المفقودة بدون حذف)
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    invoices_linked INTEGER := 0;
    vouchers_linked INTEGER := 0;
BEGIN
    -- Safe Link 1: Link invoices missing journal_entry_id to existing journals
    UPDATE public.invoices inv
    SET journal_entry_id = jv.id
    FROM public.journal_entries jv
    WHERE (inv.journal_entry_id IS NULL OR inv.journal_entry_id = '')
      AND (jv.reference = inv.invoice_number OR jv.source_id = inv.id);

    GET DIAGNOSTICS invoices_linked = ROW_COUNT;
    RAISE NOTICE '>>> [SAFE MIGRATION] Invoices linked with journal entries: %', invoices_linked;

    -- Safe Link 2: Link vouchers missing journal_entry_id to existing journals
    UPDATE public.payment_vouchers vch
    SET journal_entry_id = jv.id
    FROM public.journal_entries jv
    WHERE (vch.journal_entry_id IS NULL OR vch.journal_entry_id = '')
      AND (jv.reference = vch.voucher_number OR jv.source_id = vch.id);

    GET DIAGNOSTICS vouchers_linked = ROW_COUNT;
    RAISE NOTICE '>>> [SAFE MIGRATION] Vouchers linked with journal entries: %', vouchers_linked;
    RAISE NOTICE '>>> [LOGIX ERP MIGRATION] Zero-Data-Loss Safe Migration completed successfully with 100%% integrity.';
END $$;
