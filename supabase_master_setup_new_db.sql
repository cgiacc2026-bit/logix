-- ==============================================================================
-- 🏛️ LOGIX CLOUD ERP - MASTER DATABASE SCHEMA & MIGRATION SCRIPT
-- Project: exupcqbzfngpbsjrzhjw
-- Project URL: https://exupcqbzfngpbsjrzhjw.supabase.co
--
-- Instructions:
-- 1. Open your Supabase Dashboard: https://supabase.com/dashboard/project/exupcqbzfngpbsjrzhjw
-- 2. Go to "SQL Editor" from the left sidebar
-- 3. Click "New Query", paste this entire script, and click "Run" (or Ctrl + Enter)
-- ==============================================================================

-- 0. Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1) جدول الشركات والمنشآت (companies)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name TEXT NOT NULL,
    login_code TEXT UNIQUE,
    owner_email TEXT DEFAULT 'admin@logixerp.com',
    password_hash TEXT,
    type TEXT DEFAULT 'client',
    status TEXT DEFAULT 'active',
    logo_url TEXT DEFAULT '',
    default_accounts JSONB DEFAULT '{}'::jsonb,
    profile_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS login_code TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS owner_email TEXT DEFAULT 'admin@logixerp.com';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'client';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS logo_url TEXT DEFAULT '';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS default_accounts JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS profile_data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc', now());

CREATE INDEX IF NOT EXISTS idx_companies_login_code ON public.companies(login_code);

-- ==============================================================================
-- 2) جدول مستخدمي الشركات (company_users)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.company_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    email TEXT,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'STAFF',
    role_title_ar TEXT,
    pin_hash TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_platform_admin BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT uq_company_username UNIQUE (company_id, username)
);

CREATE INDEX IF NOT EXISTS idx_comp_users_comp_user ON public.company_users(company_id, username);

-- ==============================================================================
-- 3) شجرة الحسابات والدليل المحاسبي (chart_of_accounts)
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
    current_balance NUMERIC(18, 4) DEFAULT 0,
    description TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT uq_chart_company_code UNIQUE (company_id, code)
);

ALTER TABLE public.chart_of_accounts ADD COLUMN IF NOT EXISTS balance NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.chart_of_accounts ADD COLUMN IF NOT EXISTS current_balance NUMERIC(18, 4) DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_coa_company_id ON public.chart_of_accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_coa_code ON public.chart_of_accounts(company_id, code);

-- ==============================================================================
-- 4) قيود اليومية العامة (journal_entries)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    entry_number TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'POSTED', -- DRAFT, POSTED, CANCELLED, REVERSED
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

CREATE INDEX IF NOT EXISTS idx_journal_company_id ON public.journal_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_journal_date ON public.journal_entries(company_id, date);
CREATE INDEX IF NOT EXISTS idx_journal_entry_number ON public.journal_entries(company_id, entry_number);

-- 4.1) جدول سطور القيود المفصلة (journal_entry_lines)
CREATE TABLE IF NOT EXISTS public.journal_entry_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL,
    account_code TEXT,
    account_name TEXT,
    debit NUMERIC(18, 4) NOT NULL DEFAULT 0,
    credit NUMERIC(18, 4) NOT NULL DEFAULT 0,
    description TEXT,
    cost_center_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_jel_entry_id ON public.journal_entry_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_jel_account_id ON public.journal_entry_lines(account_id);

-- ==============================================================================
-- 5) الأصناف والمخزون والتكاليف (items)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.items (
    id TEXT PRIMARY KEY,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name_ar TEXT NOT NULL,
    name_en TEXT DEFAULT '',
    category TEXT DEFAULT 'مواد غذائية',
    unit TEXT DEFAULT 'حبة',
    cost_price NUMERIC(18, 4) DEFAULT 0,
    selling_price NUMERIC(18, 4) DEFAULT 0,
    current_balance NUMERIC(18, 4) DEFAULT 0,
    min_limit NUMERIC(18, 4) DEFAULT 10,
    raw_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT uq_item_company_code UNIQUE (company_id, code)
);

CREATE INDEX IF NOT EXISTS idx_items_company_id ON public.items(company_id);
CREATE INDEX IF NOT EXISTS idx_items_code ON public.items(company_id, code);

-- وحدات الأصناف (item_units)
CREATE TABLE IF NOT EXISTS public.item_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL,
    unit_name TEXT NOT NULL,
    conversion_factor NUMERIC(12, 4) NOT NULL DEFAULT 1,
    sale_price NUMERIC(18, 4) DEFAULT 0,
    purchase_price NUMERIC(18, 4) DEFAULT 0,
    barcode TEXT,
    is_base_unit BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- عروض الأصناف (item_offers)
CREATE TABLE IF NOT EXISTS public.item_offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    base_item_id TEXT NOT NULL,
    title_ar TEXT NOT NULL,
    barcode TEXT,
    offer_quantity NUMERIC(12, 3) NOT NULL DEFAULT 1,
    offer_price NUMERIC(12, 3) NOT NULL DEFAULT 0,
    original_price NUMERIC(12, 3) DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- ==============================================================================
-- 6) العملاء وفروعهم (customers & customer_branches)
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
    current_balance NUMERIC(18, 4) DEFAULT 0,
    opening_balance NUMERIC(18, 4) DEFAULT 0,
    raw_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT uq_customer_company_code UNIQUE (company_id, code)
);

CREATE INDEX IF NOT EXISTS idx_customers_company_id ON public.customers(company_id);
CREATE INDEX IF NOT EXISTS idx_customers_code ON public.customers(company_id, code);

CREATE TABLE IF NOT EXISTS public.customer_branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id TEXT NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    branch_name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    city TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_customer_branches_cust ON public.customer_branches(customer_id);

-- ==============================================================================
-- 7) الموردين (suppliers)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.suppliers (
    id TEXT PRIMARY KEY,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name_ar TEXT NOT NULL,
    name_en TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    address TEXT DEFAULT '',
    city TEXT DEFAULT '',
    balance NUMERIC(18, 4) DEFAULT 0,
    current_balance NUMERIC(18, 4) DEFAULT 0,
    opening_balance NUMERIC(18, 4) DEFAULT 0,
    raw_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT uq_supplier_company_code UNIQUE (company_id, code)
);

CREATE INDEX IF NOT EXISTS idx_suppliers_company_id ON public.suppliers(company_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_code ON public.suppliers(company_id, code);

-- ==============================================================================
-- 8) الفواتير الرئيسية وتفاصيلها (invoices & invoice_items)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.invoices (
    id TEXT PRIMARY KEY,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    invoice_number TEXT,
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    date DATE DEFAULT CURRENT_DATE,
    customer_id TEXT,
    customer_name TEXT,
    subtotal NUMERIC(18, 4) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
    vat_amount NUMERIC(18, 4) DEFAULT 0,
    total_amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
    paid_amount NUMERIC(18, 4) DEFAULT 0,
    due_amount NUMERIC(18, 4) DEFAULT 0,
    payment_status TEXT NOT NULL DEFAULT 'POSTED',
    status TEXT DEFAULT 'POSTED',
    payment_method TEXT DEFAULT 'CREDIT',
    customer_snapshot JSONB DEFAULT '{}'::jsonb,
    raw_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_invoices_company_id ON public.invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON public.invoices(company_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON public.invoices(company_id, invoice_date);

CREATE TABLE IF NOT EXISTS public.invoice_items (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    item_id TEXT,
    item_name TEXT,
    quantity NUMERIC(18, 4) NOT NULL DEFAULT 1,
    unit_price NUMERIC(18, 4) NOT NULL DEFAULT 0,
    total_price NUMERIC(18, 4) NOT NULL DEFAULT 0,
    tax_rate NUMERIC(5, 2) DEFAULT 0,
    tax_amount NUMERIC(18, 4) DEFAULT 0,
    item_snapshot JSONB DEFAULT '{}'::jsonb,
    raw_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_inv_items_inv ON public.invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_inv_items_comp ON public.invoice_items(company_id);

-- جدول المبيعات التوافقي (sales_master & sales_details)
CREATE TABLE IF NOT EXISTS public.sales_master (
    id TEXT PRIMARY KEY,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    invoice_number TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    customer_id TEXT,
    customer_name TEXT,
    payment_method TEXT DEFAULT 'CREDIT',
    status TEXT DEFAULT 'POSTED',
    payment_status TEXT DEFAULT 'POSTED',
    subtotal NUMERIC(18, 4) DEFAULT 0,
    vat_amount NUMERIC(18, 4) DEFAULT 0,
    total_amount NUMERIC(18, 4) DEFAULT 0,
    paid_amount NUMERIC(18, 4) DEFAULT 0,
    due_amount NUMERIC(18, 4) DEFAULT 0,
    customer_snapshot JSONB DEFAULT '{}'::jsonb,
    raw_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.sales_details (
    id TEXT PRIMARY KEY,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    invoice_id TEXT NOT NULL,
    sales_master_id TEXT,
    item_id TEXT,
    item_name TEXT,
    quantity NUMERIC(18, 4) DEFAULT 1,
    unit_price NUMERIC(18, 4) DEFAULT 0,
    vat_rate NUMERIC(5, 2) DEFAULT 0,
    vat_amount NUMERIC(18, 4) DEFAULT 0,
    total NUMERIC(18, 4) DEFAULT 0,
    total_price NUMERIC(18, 4) DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- ==============================================================================
-- 9) سندات القبض والصرف (payment_vouchers)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.payment_vouchers (
    id TEXT PRIMARY KEY,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    voucher_number TEXT NOT NULL,
    type TEXT NOT NULL, -- RECEIPT, PAYMENT
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
    payment_method TEXT DEFAULT 'CASH',
    entity_type TEXT DEFAULT 'NONE',
    entity_id TEXT,
    entity_name TEXT,
    notes TEXT DEFAULT '',
    account_id TEXT,
    reference TEXT,
    status TEXT DEFAULT 'POSTED',
    raw_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT uq_voucher_company_number UNIQUE (company_id, voucher_number)
);

CREATE INDEX IF NOT EXISTS idx_vouchers_comp_type ON public.payment_vouchers(company_id, type);

-- ==============================================================================
-- 10) المستودعات والمندوبين والإعدادات المحاسبية
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.warehouses (
    id TEXT PRIMARY KEY,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    location TEXT,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.sales_reps (
    id TEXT PRIMARY KEY,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    commission_rate NUMERIC(5, 2) DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.company_accounting_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL UNIQUE,
    cash_account_id TEXT,
    bank_account_id TEXT,
    receivable_account_id TEXT,
    payable_account_id TEXT,
    inventory_account_id TEXT,
    sales_account_id TEXT,
    cogs_account_id TEXT,
    vat_account_id TEXT,
    retained_earnings_account_id TEXT,
    settings_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID,
    user_id TEXT,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.production_orders (
    id TEXT PRIMARY KEY,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    order_number TEXT NOT NULL,
    product_id TEXT NOT NULL,
    product_name TEXT,
    quantity NUMERIC(12, 3) NOT NULL,
    status TEXT DEFAULT 'COMPLETED',
    date DATE DEFAULT CURRENT_DATE,
    raw_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.manufacturing_settings (
    company_id UUID PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
    settings_data JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- ==============================================================================
-- 11) تفعيل سياسات الأمان والمزامنة الشاملة (Row Level Security - RLS)
-- ==============================================================================
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_reps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_accounting_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manufacturing_settings ENABLE ROW LEVEL SECURITY;

DO $$ 
DECLARE
    tbl text;
    tables text[] := ARRAY[
        'companies', 'company_users', 'chart_of_accounts', 'journal_entries', 
        'journal_entry_lines', 'items', 'item_units', 'item_offers', 'customers', 
        'customer_branches', 'suppliers', 'invoices', 'invoice_items', 'sales_master', 
        'sales_details', 'payment_vouchers', 'warehouses', 'sales_reps', 
        'company_accounting_settings', 'audit_logs', 'production_orders', 'manufacturing_settings'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Allow all access to %I" ON public.%I', tbl, tbl);
        EXECUTE format('CREATE POLICY "Allow all access to %I" ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)', tbl, tbl);
    END LOOP;
END $$;

-- ==============================================================================
-- 12) تهيئة الشركات الرسمية والمستخدمين (Seed Data)
-- ==============================================================================

-- 12.1) شركة مطحنة الوليد المتحدة
INSERT INTO public.companies (id, company_name, owner_email, password_hash, type, login_code, status, profile_data)
VALUES (
    '20000000-0000-0000-0000-000000000001'::uuid, 
    'مطحنة الوليد المتحدة (ذ.م.م)', 
    'alwaleed.mill@logixerp.com', 
    crypt('1234', gen_salt('bf')), 
    'client', 
    '450912', 
    'active',
    jsonb_build_object(
        'nameAr', 'مطحنة الوليد المتحده',
        'nameEn', 'Al-Waleed United Mill & Food Industries',
        'tradeName', 'مطحنة الوليد للبهارات والمواد التموينية والصناعات الغذائية',
        'legalForm', 'شركة ذات مسؤولية محدودة (ذ.م.م)',
        'crNumber', '450912',
        'chamberNumber', '78214',
        'country', 'دولة الكويت',
        'city', 'الكويت',
        'district', 'منطقة الري الصناعية',
        'address', 'الري الصناعية، شارع الغزالي، الكويت',
        'phone', '+965 2484 1888',
        'email', 'cgiacc2026@gmail.com',
        'functionalCurrency', 'KWD',
        'currency', 'KWD',
        'currency_decimals', 3,
        'decimalPlaces', 3,
        'accountingBasis', 'ACCRUAL',
        'inventoryCosting', 'WEIGHTED_AVERAGE',
        'vatRate', 0
    )
)
ON CONFLICT (id) DO UPDATE
SET type = 'client', login_code = '450912', status = 'active';

-- مستخدمو مطحنة الوليد
INSERT INTO public.company_users (company_id, username, email, full_name, role, role_title_ar, pin_hash, is_platform_admin)
VALUES
(
    '20000000-0000-0000-0000-000000000001'::uuid, 
    'cgiacc2026', 
    'cgiacc2026@gmail.com', 
    'المشرف العام', 
    'ADMIN', 
    'المشرف العام والمالك', 
    crypt('1234', gen_salt('bf')), 
    true
),
(
    '20000000-0000-0000-0000-000000000001'::uuid, 
    'adein', 
    'adein@alwaleedmill.com', 
    'د. خالد السليمان', 
    'EXECUTIVE', 
    'المدير التنفيذي', 
    crypt('1234', gen_salt('bf')), 
    false
),
(
    '20000000-0000-0000-0000-000000000001'::uuid, 
    'chief_acc', 
    'chief@alwaleedmill.com', 
    'أ. محمد الشمري', 
    'CHIEF_ACCOUNTANT', 
    'المدير المالي والمحاسب الرئيسي', 
    crypt('1234', gen_salt('bf')), 
    false
)
ON CONFLICT (company_id, username) DO UPDATE
SET role = EXCLUDED.role, is_platform_admin = EXCLUDED.is_platform_admin;

-- 12.2) شركة لوجيكس الرسمية
INSERT INTO public.companies (id, company_name, owner_email, password_hash, type, login_code, status, profile_data)
VALUES (
    '10000000-0000-0000-0000-000000000001'::uuid, 
    'شركة لوجيكس للأنظمة السحابية', 
    'superadmin@logixerp.com', 
    crypt('1234', gen_salt('bf')), 
    'system', 
    'logix', 
    'active',
    jsonb_build_object('nameAr', 'شركة لوجيكس للأنظمة السحابية', 'nameEn', 'LOGIX Cloud ERP Systems', 'type', 'system', 'isSystemCore', true)
)
ON CONFLICT (id) DO UPDATE 
SET type = 'system', login_code = 'logix', status = 'active';

INSERT INTO public.company_users (company_id, username, email, full_name, role, role_title_ar, pin_hash, is_platform_admin)
VALUES (
    '10000000-0000-0000-0000-000000000001'::uuid, 
    'cgiacc2026', 
    'cgiacc2026@gmail.com', 
    'المشرف العام', 
    'SUPER_ADMIN', 
    'المشرف العام والمالك', 
    crypt('1234', gen_salt('bf')), 
    true
)
ON CONFLICT (company_id, username) DO UPDATE
SET role = 'SUPER_ADMIN', is_platform_admin = true;

-- 12.3) الشركة التجريبية (Demo)
INSERT INTO public.companies (id, company_name, owner_email, password_hash, type, login_code, status, profile_data)
VALUES (
    '00000000-0000-0000-0000-000000000099'::uuid,
    'شركة تجريبية - LOGIX Demo',
    'logixdemo@logix.com',
    crypt('P0182671648n$', gen_salt('bf')),
    'demo',
    'demo',
    'active',
    jsonb_build_object(
        'nameAr', 'شركة تجريبية - LOGIX Demo',
        'nameEn', 'LOGIX Cloud ERP Demo Enterprise',
        'tradeName', 'شركة تجريبية للحلول السحابية',
        'type', 'demo',
        'isDemo', true
    )
)
ON CONFLICT (id) DO UPDATE
SET type = 'demo', login_code = 'demo', status = 'active';

INSERT INTO public.company_users (company_id, username, email, full_name, role, role_title_ar, pin_hash, is_platform_admin)
VALUES (
    '00000000-0000-0000-0000-000000000099'::uuid, 
    'logixdemo', 
    'logixdemo@logix.com', 
    'مستخدم تجريبي (Demo User)', 
    'ADMIN', 
    'مدير النظام التجريبي', 
    crypt('P0182671648n$', gen_salt('bf')), 
    false
)
ON CONFLICT (company_id, username) DO UPDATE
SET pin_hash = crypt('P0182671648n$', gen_salt('bf')), email = 'logixdemo@logix.com';

-- ==============================================================================
-- تم اكتمال بناء وتأهيل قاعدة البيانات الجديدة بنجاح!
-- ==============================================================================
