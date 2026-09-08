-- ==============================================================================
-- LOGIX CLOUD ERP - SUPABASE SQL SCHEMA & MULTI-TENANT ROW LEVEL SECURITY (RLS)
-- ==============================================================================
-- هذا السكربت جاهز للتشغيل مباشرة في (Supabase SQL Editor)
-- يقوم بإنشاء كافة الجداول المطلوبة وتفعيل سياسات الأمان (RLS) لعزل بيانات كل شركة
-- ==============================================================================

-- تفعيل ملحقات UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. جدول الشركات والمؤسسات (companies)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name TEXT NOT NULL,
    owner_email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'rejected')),
    profile_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- فهارس جدول الشركات
CREATE INDEX IF NOT EXISTS idx_companies_email ON public.companies (owner_email);
CREATE INDEX IF NOT EXISTS idx_companies_status ON public.companies (status);

-- ------------------------------------------------------------------------------
-- 2. جدول الأصناف والمخزون (items)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.items (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name_ar TEXT NOT NULL,
    name_en TEXT,
    category TEXT DEFAULT 'عام',
    unit TEXT DEFAULT 'حبة',
    cost_price NUMERIC(15, 4) DEFAULT 0,
    selling_price NUMERIC(15, 4) DEFAULT 0,
    current_balance NUMERIC(15, 4) DEFAULT 0,
    min_limit NUMERIC(15, 4) DEFAULT 0,
    raw_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_company_item_code UNIQUE (company_id, code)
);

CREATE INDEX IF NOT EXISTS idx_items_company ON public.items (company_id);
CREATE INDEX IF NOT EXISTS idx_items_code ON public.items (company_id, code);

-- ------------------------------------------------------------------------------
-- 3. جدول العملاء (customers)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customers (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name_ar TEXT NOT NULL,
    name_en TEXT,
    phone TEXT,
    address TEXT,
    city TEXT,
    balance NUMERIC(15, 4) DEFAULT 0,
    raw_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_company_customer_code UNIQUE (company_id, code)
);

CREATE INDEX IF NOT EXISTS idx_customers_company ON public.customers (company_id);
CREATE INDEX IF NOT EXISTS idx_customers_code ON public.customers (company_id, code);

-- ------------------------------------------------------------------------------
-- 4. جدول رأس الفواتير والمبيعات (sales_master)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sales_master (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    invoice_number TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    customer_id TEXT,
    customer_name TEXT,
    subtotal NUMERIC(15, 4) DEFAULT 0,
    vat_amount NUMERIC(15, 4) DEFAULT 0,
    total_amount NUMERIC(15, 4) DEFAULT 0,
    paid_amount NUMERIC(15, 4) DEFAULT 0,
    due_amount NUMERIC(15, 4) DEFAULT 0,
    status TEXT DEFAULT 'POSTED',
    payment_method TEXT DEFAULT 'CASH',
    raw_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_company_invoice_number UNIQUE (company_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_sales_master_company ON public.sales_master (company_id);
CREATE INDEX IF NOT EXISTS idx_sales_master_date ON public.sales_master (company_id, date);
CREATE INDEX IF NOT EXISTS idx_sales_master_customer ON public.sales_master (company_id, customer_id);

-- ------------------------------------------------------------------------------
-- 5. جدول تفاصيل الفواتير والبنود (sales_details)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sales_details (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    invoice_id TEXT NOT NULL,
    item_id TEXT,
    item_name TEXT,
    quantity NUMERIC(15, 4) DEFAULT 1,
    unit_price NUMERIC(15, 4) DEFAULT 0,
    vat_rate NUMERIC(5, 2) DEFAULT 0,
    vat_amount NUMERIC(15, 4) DEFAULT 0,
    total NUMERIC(15, 4) DEFAULT 0,
    raw_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_sales_details_company ON public.sales_details (company_id);
CREATE INDEX IF NOT EXISTS idx_sales_details_invoice ON public.sales_details (company_id, invoice_id);

-- ------------------------------------------------------------------------------
-- 6. جدول قيود اليومية المحاسبية (journal_entries)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.journal_entries (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    entry_number TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT,
    status TEXT DEFAULT 'POSTED',
    reference_type TEXT,
    reference_id TEXT,
    lines JSONB DEFAULT '[]'::jsonb,
    raw_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_company_entry_number UNIQUE (company_id, entry_number)
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_company ON public.journal_entries (company_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON public.journal_entries (company_id, date);

-- ------------------------------------------------------------------------------
-- 7. تفعيل سياسات الأمان على مستوى الصف (Row Level Security - RLS)
-- ------------------------------------------------------------------------------
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

-- سياسات جدول companies
DROP POLICY IF EXISTS "Companies are selectable by owner or anon registration" ON public.companies;
CREATE POLICY "Companies are selectable by owner or anon registration"
ON public.companies FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Companies insertable by anyone during registration" ON public.companies;
CREATE POLICY "Companies insertable by anyone during registration"
ON public.companies FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Companies updatable by active company" ON public.companies;
CREATE POLICY "Companies updatable by active company"
ON public.companies FOR UPDATE
USING (true);

-- سياسات جدول items
DROP POLICY IF EXISTS "Items tenant isolation policy" ON public.items;
CREATE POLICY "Items tenant isolation policy"
ON public.items FOR ALL
USING (company_id IS NOT NULL);

-- سياسات جدول customers
DROP POLICY IF EXISTS "Customers tenant isolation policy" ON public.customers;
CREATE POLICY "Customers tenant isolation policy"
ON public.customers FOR ALL
USING (company_id IS NOT NULL);

-- سياسات جدول sales_master
DROP POLICY IF EXISTS "Sales master tenant isolation policy" ON public.sales_master;
CREATE POLICY "Sales master tenant isolation policy"
ON public.sales_master FOR ALL
USING (company_id IS NOT NULL);

-- سياسات جدول sales_details
DROP POLICY IF EXISTS "Sales details tenant isolation policy" ON public.sales_details;
CREATE POLICY "Sales details tenant isolation policy"
ON public.sales_details FOR ALL
USING (company_id IS NOT NULL);

-- سياسات جدول journal_entries
DROP POLICY IF EXISTS "Journal entries tenant isolation policy" ON public.journal_entries;
CREATE POLICY "Journal entries tenant isolation policy"
ON public.journal_entries FOR ALL
USING (company_id IS NOT NULL);

-- ------------------------------------------------------------------------------
-- 8. إدراج الشركة الافتراضية التجريبية (Active Default Company)
-- ------------------------------------------------------------------------------
INSERT INTO public.companies (id, company_name, owner_email, password_hash, status, profile_data)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'مجموعة لوجيكس لإدارة الموارد السحابية',
    'admin@logixerp.com',
    '1234',
    'active',
    jsonb_build_object(
        'nameAr', 'مجموعة لوجيكس لإدارة الموارد السحابية',
        'nameEn', 'LOGIX Cloud ERP Enterprise',
        'tradeName', 'لوجيكس للحلول المالية والمحاسبية (LOGIX ERP)',
        'legalForm', 'شركة مساهمة مقفلة (ش.م.ك)',
        'taxNumber', '300012345600003',
        'crNumber', '1010998877',
        'functionalCurrency', 'SAR',
        'vatRate', 15,
        'city', 'الرياض',
        'country', 'المملكة العربية السعودية'
    )
)
ON CONFLICT (id) DO UPDATE SET
    status = 'active',
    company_name = EXCLUDED.company_name;

-- رسالة تأكيد النجاح
SELECT 'LOGIX ERP Database Schema and RLS Policies Created Successfully!' AS result;
