-- ==============================================================================
-- LOGIX CLOUD ERP - SAFE ACCOUNTING & MULTI-TENANT SCHEMA SCRIPT
-- Strictly Non-Destructive: NO "DROP TABLE", NO "TRUNCATE"
-- Run in Supabase SQL Editor (Ctrl + Enter)
-- ==============================================================================

-- 0. Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1) شجرة الحسابات والدليل المحاسي (chart_of_accounts)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
    id TEXT PRIMARY KEY,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name_ar TEXT NOT NULL,
    name_en TEXT DEFAULT '',
    category TEXT NOT NULL, -- ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
    normal_balance TEXT NOT NULL DEFAULT 'DEBIT', -- DEBIT, CREDIT
    level INTEGER NOT NULL DEFAULT 1,
    type TEXT DEFAULT 'DETAIL', -- HEADER, DETAIL
    parent_id TEXT,
    is_system BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    balance NUMERIC(18, 4) DEFAULT 0,
    description TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT uq_chart_company_code UNIQUE (company_id, code)
);

-- إضافة أي أعمدة جديدة إن لم تكن موجودة بأمان تام
ALTER TABLE public.chart_of_accounts ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.chart_of_accounts ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.chart_of_accounts ADD COLUMN IF NOT EXISTS name_ar TEXT;
ALTER TABLE public.chart_of_accounts ADD COLUMN IF NOT EXISTS name_en TEXT DEFAULT '';
ALTER TABLE public.chart_of_accounts ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.chart_of_accounts ADD COLUMN IF NOT EXISTS normal_balance TEXT DEFAULT 'DEBIT';
ALTER TABLE public.chart_of_accounts ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;
ALTER TABLE public.chart_of_accounts ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'DETAIL';
ALTER TABLE public.chart_of_accounts ADD COLUMN IF NOT EXISTS parent_id TEXT;
ALTER TABLE public.chart_of_accounts ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT false;
ALTER TABLE public.chart_of_accounts ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.chart_of_accounts ADD COLUMN IF NOT EXISTS balance NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.chart_of_accounts ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE public.chart_of_accounts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc', now());

CREATE INDEX IF NOT EXISTS idx_coa_company_id ON public.chart_of_accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_coa_code ON public.chart_of_accounts(company_id, code);

-- ==============================================================================
-- 2) قيود اليومية والأستاذ العام (journal_entries)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    entry_number TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'POSTED', -- DRAFT, POSTED, REVERSED
    reference TEXT,
    reference_type TEXT,
    reference_id TEXT,
    total_debit NUMERIC(18, 4) NOT NULL DEFAULT 0,
    total_credit NUMERIC(18, 4) NOT NULL DEFAULT 0,
    lines JSONB NOT NULL DEFAULT '[]'::jsonb,
    raw_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT uq_journal_company_entry_number UNIQUE (company_id, entry_number)
);

-- إضافة أي أعمدة جديدة إن لم تكن موجودة بأمان
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS entry_number TEXT;
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'POSTED';
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS reference TEXT;
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS reference_type TEXT;
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS reference_id TEXT;
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS total_debit NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS total_credit NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS lines JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS raw_data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc', now());

CREATE INDEX IF NOT EXISTS idx_journal_company_id ON public.journal_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_journal_date ON public.journal_entries(company_id, date);
CREATE INDEX IF NOT EXISTS idx_journal_entry_number ON public.journal_entries(company_id, entry_number);

-- ==============================================================================
-- 3) الأصناف والمخزون والتكاليف (items)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.items (
    id TEXT PRIMARY KEY,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name_ar TEXT NOT NULL,
    name_en TEXT DEFAULT '',
    category TEXT DEFAULT 'عام',
    unit TEXT DEFAULT 'حبة',
    cost_price NUMERIC(18, 4) DEFAULT 0,
    selling_price NUMERIC(18, 4) DEFAULT 0,
    current_balance NUMERIC(18, 4) DEFAULT 0,
    min_limit NUMERIC(18, 4) DEFAULT 0,
    raw_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT uq_item_company_code UNIQUE (company_id, code)
);

ALTER TABLE public.items ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS name_ar TEXT;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS name_en TEXT DEFAULT '';
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'عام';
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'حبة';
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS cost_price NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS selling_price NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS current_balance NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS min_limit NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS raw_data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc', now());

CREATE INDEX IF NOT EXISTS idx_items_company_id ON public.items(company_id);
CREATE INDEX IF NOT EXISTS idx_items_code ON public.items(company_id, code);

-- ==============================================================================
-- 4) العملاء ودفتر الأستاذ المساعد (customers)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.customers (
    id TEXT PRIMARY KEY,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name_ar TEXT NOT NULL,
    name_en TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    address TEXT DEFAULT '',
    city TEXT DEFAULT '',
    balance NUMERIC(18, 4) DEFAULT 0,
    raw_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT uq_customer_company_code UNIQUE (company_id, code)
);

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS name_ar TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS name_en TEXT DEFAULT '';
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS address TEXT DEFAULT '';
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS city TEXT DEFAULT '';
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS balance NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS raw_data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc', now());

CREATE INDEX IF NOT EXISTS idx_customers_company_id ON public.customers(company_id);
CREATE INDEX IF NOT EXISTS idx_customers_code ON public.customers(company_id, code);

-- ==============================================================================
-- 5) المبيعات ورؤوس الفواتير (sales_master)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.sales_master (
    id TEXT PRIMARY KEY,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    invoice_number TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    customer_id TEXT,
    customer_name TEXT,
    payment_method TEXT DEFAULT 'CREDIT', -- CASH, CREDIT, BANK
    status TEXT DEFAULT 'POSTED', -- DRAFT, POSTED, CANCELLED
    subtotal NUMERIC(18, 4) DEFAULT 0,
    vat_amount NUMERIC(18, 4) DEFAULT 0,
    total_amount NUMERIC(18, 4) DEFAULT 0,
    paid_amount NUMERIC(18, 4) DEFAULT 0,
    due_amount NUMERIC(18, 4) DEFAULT 0,
    raw_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT uq_sales_master_company_invoice UNIQUE (company_id, invoice_number)
);

ALTER TABLE public.sales_master ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.sales_master ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE public.sales_master ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.sales_master ADD COLUMN IF NOT EXISTS customer_id TEXT;
ALTER TABLE public.sales_master ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE public.sales_master ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'CREDIT';
ALTER TABLE public.sales_master ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'POSTED';
ALTER TABLE public.sales_master ADD COLUMN IF NOT EXISTS subtotal NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.sales_master ADD COLUMN IF NOT EXISTS vat_amount NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.sales_master ADD COLUMN IF NOT EXISTS total_amount NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.sales_master ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.sales_master ADD COLUMN IF NOT EXISTS due_amount NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.sales_master ADD COLUMN IF NOT EXISTS raw_data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.sales_master ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc', now());

CREATE INDEX IF NOT EXISTS idx_sales_master_company ON public.sales_master(company_id);
CREATE INDEX IF NOT EXISTS idx_sales_master_date ON public.sales_master(company_id, date);
CREATE INDEX IF NOT EXISTS idx_sales_master_customer ON public.sales_master(company_id, customer_id);

-- ==============================================================================
-- 6) بنود وتفاصيل الفواتير (sales_details)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.sales_details (
    id TEXT PRIMARY KEY,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    invoice_id TEXT NOT NULL,
    item_id TEXT,
    item_name TEXT,
    quantity NUMERIC(18, 4) DEFAULT 1,
    unit_price NUMERIC(18, 4) DEFAULT 0,
    vat_rate NUMERIC(5, 2) DEFAULT 0,
    vat_amount NUMERIC(18, 4) DEFAULT 0,
    total NUMERIC(18, 4) DEFAULT 0,
    raw_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.sales_details ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.sales_details ADD COLUMN IF NOT EXISTS invoice_id TEXT;
ALTER TABLE public.sales_details ADD COLUMN IF NOT EXISTS item_id TEXT;
ALTER TABLE public.sales_details ADD COLUMN IF NOT EXISTS item_name TEXT;
ALTER TABLE public.sales_details ADD COLUMN IF NOT EXISTS quantity NUMERIC(18, 4) DEFAULT 1;
ALTER TABLE public.sales_details ADD COLUMN IF NOT EXISTS unit_price NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.sales_details ADD COLUMN IF NOT EXISTS vat_rate NUMERIC(5, 2) DEFAULT 0;
ALTER TABLE public.sales_details ADD COLUMN IF NOT EXISTS vat_amount NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.sales_details ADD COLUMN IF NOT EXISTS total NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.sales_details ADD COLUMN IF NOT EXISTS raw_data JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_sales_details_company ON public.sales_details(company_id);
CREATE INDEX IF NOT EXISTS idx_sales_details_invoice ON public.sales_details(company_id, invoice_id);

-- ==============================================================================
-- 7) تفعيل سياسات الأمان والمزامنة (Row Level Security - RLS)
-- ==============================================================================
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_details ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    -- chart_of_accounts policy
    DROP POLICY IF EXISTS "Allow full access to chart_of_accounts" ON public.chart_of_accounts;
    CREATE POLICY "Allow full access to chart_of_accounts" ON public.chart_of_accounts FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

    -- journal_entries policy
    DROP POLICY IF EXISTS "Allow full access to journal_entries" ON public.journal_entries;
    CREATE POLICY "Allow full access to journal_entries" ON public.journal_entries FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

    -- items policy
    DROP POLICY IF EXISTS "Allow full access to items" ON public.items;
    CREATE POLICY "Allow full access to items" ON public.items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

    -- customers policy
    DROP POLICY IF EXISTS "Allow full access to customers" ON public.customers;
    CREATE POLICY "Allow full access to customers" ON public.customers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

    -- sales_master policy
    DROP POLICY IF EXISTS "Allow full access to sales_master" ON public.sales_master;
    CREATE POLICY "Allow full access to sales_master" ON public.sales_master FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

    -- sales_details policy
    DROP POLICY IF EXISTS "Allow full access to sales_details" ON public.sales_details;
    CREATE POLICY "Allow full access to sales_details" ON public.sales_details FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
END $$;

-- ==============================================================================
-- 8) استعادة بيانات مطحنة الوليد المعلقة (Self-Healing Orphaned Records)
-- يضمن ربط أي سجلات تائهة بالمعرف الرسمي لمطحنة الوليد
-- ==============================================================================
DO $$ 
DECLARE
    v_alwaleed_id UUID := '20000000-0000-0000-0000-000000000001'::uuid;
BEGIN
    -- ربط الأصناف غير المرتبطة بشركة
    UPDATE public.items 
    SET company_id = v_alwaleed_id 
    WHERE company_id IS NULL;

    -- ربط العملاء غير المرتبطين بشركة
    UPDATE public.customers 
    SET company_id = v_alwaleed_id 
    WHERE company_id IS NULL;

    -- ربط الفواتير غير المرتبطة بشركة
    UPDATE public.sales_master 
    SET company_id = v_alwaleed_id 
    WHERE company_id IS NULL;

    UPDATE public.sales_details 
    SET company_id = v_alwaleed_id 
    WHERE company_id IS NULL;

    -- ربط القيود غير المرتبطة بشركة
    UPDATE public.journal_entries 
    SET company_id = v_alwaleed_id 
    WHERE company_id IS NULL;
END $$;
