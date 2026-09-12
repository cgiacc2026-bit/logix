-- ==============================================================================
-- LOGIX ERP ENTERPRISE: MASTER SCHEMA RECONCILIATION & DDL AUTO-HEALING
-- Script: supabase_master_reconciliation_migration.sql
-- Description: Complete Idempotent Schema Migration, Missing Tables Creation,
--              Foreign Key Relationship Network, Performance Indexes, and RLS.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. TENANT & MASTER ENTITY: COMPANIES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name TEXT NOT NULL DEFAULT 'شركة جديدة',
    name_ar TEXT NOT NULL DEFAULT 'شركة جديدة',
    name_en TEXT DEFAULT '',
    trade_name TEXT DEFAULT '',
    legal_form TEXT DEFAULT '',
    tax_number TEXT DEFAULT '',
    cr_number TEXT DEFAULT '',
    cr_issue_date TEXT DEFAULT '',
    cr_expiry_date TEXT DEFAULT '',
    chamber_number TEXT DEFAULT '',
    capital NUMERIC(18, 4) DEFAULT 0,
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    website TEXT DEFAULT '',
    address TEXT DEFAULT '',
    building_number TEXT DEFAULT '',
    street_name TEXT DEFAULT '',
    district TEXT DEFAULT '',
    city TEXT DEFAULT '',
    postal_code TEXT DEFAULT '',
    country TEXT DEFAULT 'الكويت',
    functional_currency TEXT DEFAULT 'KWD',
    currency TEXT DEFAULT 'KWD',
    currency_symbol TEXT DEFAULT 'د.ك',
    decimal_places INT DEFAULT 3,
    fiscal_year_start TEXT DEFAULT '01-01',
    fiscal_year_end TEXT DEFAULT '12-31',
    tax_period TEXT DEFAULT 'QUARTERLY',
    default_vat_rate NUMERIC(5, 2) DEFAULT 0,
    is_vat_inclusive BOOLEAN DEFAULT FALSE,
    accounting_basis TEXT DEFAULT 'ACCRUAL',
    inventory_costing TEXT DEFAULT 'WEIGHTED_AVERAGE',
    depreciation_method TEXT DEFAULT 'STRAIGHT_LINE',
    general_manager TEXT DEFAULT '',
    financial_manager TEXT DEFAULT '',
    chief_accountant TEXT DEFAULT '',
    show_digital_stamp BOOLEAN DEFAULT TRUE,
    allow_negative_inventory BOOLEAN DEFAULT TRUE,
    allow_negative_balance BOOLEAN DEFAULT TRUE,
    logo_url TEXT DEFAULT '',
    signature_url TEXT DEFAULT '',
    digital_stamp_url TEXT DEFAULT '',
    status TEXT DEFAULT 'active',
    owner_email TEXT DEFAULT '',
    default_accounts JSONB DEFAULT '{}'::jsonb,
    default_cash_account_id UUID,
    default_bank_account_id UUID,
    default_sales_account_id UUID,
    default_inventory_account_id UUID,
    default_cogs_account_id UUID,
    default_vat_account_id UUID,
    profile_data JSONB DEFAULT '{}'::jsonb,
    raw_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS company_name TEXT DEFAULT 'شركة جديدة';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS name_ar TEXT DEFAULT 'شركة جديدة';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS name_en TEXT DEFAULT '';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS functional_currency TEXT DEFAULT 'KWD';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'KWD';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS currency_symbol TEXT DEFAULT 'د.ك';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS decimal_places INT DEFAULT 3;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS default_accounts JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS default_cash_account_id UUID;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS default_bank_account_id UUID;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS default_sales_account_id UUID;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS default_inventory_account_id UUID;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS default_cogs_account_id UUID;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS default_vat_account_id UUID;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS raw_data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc', now());

-- ==============================================================================
-- 2. CHART OF ACCOUNTS (الدليل المحاسبي الشجري)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT,
    name_ar TEXT NOT NULL,
    name_en TEXT DEFAULT '',
    account_type TEXT NOT NULL,
    parent_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
    parent_code TEXT DEFAULT '',
    level INT DEFAULT 1,
    nature TEXT DEFAULT 'DEBIT',
    is_active BOOLEAN DEFAULT TRUE,
    is_leaf BOOLEAN DEFAULT TRUE,
    opening_balance NUMERIC(18, 4) DEFAULT 0,
    current_balance NUMERIC(18, 4) DEFAULT 0,
    balance NUMERIC(18, 4) DEFAULT 0,
    currency TEXT DEFAULT 'KWD',
    raw_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

ALTER TABLE public.chart_of_accounts ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.chart_of_accounts ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.chart_of_accounts ADD COLUMN IF NOT EXISTS name_ar TEXT;
ALTER TABLE public.chart_of_accounts ADD COLUMN IF NOT EXISTS account_type TEXT;
ALTER TABLE public.chart_of_accounts ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.chart_of_accounts ADD COLUMN IF NOT EXISTS level INT DEFAULT 1;
ALTER TABLE public.chart_of_accounts ADD COLUMN IF NOT EXISTS nature TEXT DEFAULT 'DEBIT';
ALTER TABLE public.chart_of_accounts ADD COLUMN IF NOT EXISTS is_leaf BOOLEAN DEFAULT TRUE;
ALTER TABLE public.chart_of_accounts ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.chart_of_accounts ADD COLUMN IF NOT EXISTS current_balance NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.chart_of_accounts ADD COLUMN IF NOT EXISTS balance NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.chart_of_accounts ADD COLUMN IF NOT EXISTS raw_data JSONB DEFAULT '{}'::jsonb;

-- Unique Code per Company
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_coa_company_code') THEN
        ALTER TABLE public.chart_of_accounts ADD CONSTRAINT uq_coa_company_code UNIQUE (company_id, code);
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ==============================================================================
-- 3. COMPANY ACCOUNTING SETTINGS (ربط الحسابات الافتراضية بالدليل المحاسبي)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.company_accounting_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    cash_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
    bank_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
    receivable_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
    payable_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
    sales_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
    inventory_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
    cogs_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
    vat_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
    retained_earnings_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
    default_cash_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
    default_bank_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
    default_sales_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
    default_inventory_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
    default_cogs_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
    default_vat_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
    default_retained_earnings_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
    functional_currency TEXT DEFAULT 'KWD',
    currency_symbol TEXT DEFAULT 'د.ك',
    decimal_places INT DEFAULT 3,
    accounting_basis TEXT DEFAULT 'ACCRUAL',
    inventory_costing TEXT DEFAULT 'WEIGHTED_AVERAGE',
    depreciation_method TEXT DEFAULT 'STRAIGHT_LINE',
    settings_data JSONB DEFAULT '{}'::jsonb,
    raw_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

ALTER TABLE public.company_accounting_settings ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.company_accounting_settings ADD COLUMN IF NOT EXISTS cash_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.company_accounting_settings ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.company_accounting_settings ADD COLUMN IF NOT EXISTS receivable_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.company_accounting_settings ADD COLUMN IF NOT EXISTS payable_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.company_accounting_settings ADD COLUMN IF NOT EXISTS sales_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.company_accounting_settings ADD COLUMN IF NOT EXISTS inventory_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.company_accounting_settings ADD COLUMN IF NOT EXISTS cogs_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.company_accounting_settings ADD COLUMN IF NOT EXISTS vat_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.company_accounting_settings ADD COLUMN IF NOT EXISTS retained_earnings_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.company_accounting_settings ADD COLUMN IF NOT EXISTS functional_currency TEXT DEFAULT 'KWD';
ALTER TABLE public.company_accounting_settings ADD COLUMN IF NOT EXISTS currency_symbol TEXT DEFAULT 'د.ك';
ALTER TABLE public.company_accounting_settings ADD COLUMN IF NOT EXISTS decimal_places INT DEFAULT 3;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_cas_company') THEN
        ALTER TABLE public.company_accounting_settings ADD CONSTRAINT uq_cas_company UNIQUE (company_id);
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Dual compatibility table: company_settings
CREATE TABLE IF NOT EXISTS public.company_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    settings_data JSONB DEFAULT '{}'::jsonb,
    raw_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- ==============================================================================
-- 4. WAREHOUSES & SALES REPS (المستودعات ومندوبو المبيعات)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    code TEXT,
    name_ar TEXT NOT NULL,
    name_en TEXT DEFAULT '',
    location TEXT DEFAULT '',
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    raw_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS name_ar TEXT;
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS public.sales_reps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    code TEXT,
    name_ar TEXT NOT NULL,
    name_en TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    commission_rate NUMERIC(5, 2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    raw_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

ALTER TABLE public.sales_reps ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.sales_reps ADD COLUMN IF NOT EXISTS name_ar TEXT;
ALTER TABLE public.sales_reps ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5, 2) DEFAULT 0;

-- ==============================================================================
-- 5. CUSTOMERS & CUSTOMER BRANCHES (العملاء وفروع العملاء)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
    sales_rep_id UUID REFERENCES public.sales_reps(id) ON DELETE SET NULL,
    code TEXT,
    name TEXT,
    name_ar TEXT NOT NULL,
    name_en TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    address TEXT DEFAULT '',
    city TEXT DEFAULT '',
    tax_number TEXT DEFAULT '',
    cr_number TEXT DEFAULT '',
    credit_limit NUMERIC(18, 4) DEFAULT 0,
    balance NUMERIC(18, 4) DEFAULT 0,
    current_balance NUMERIC(18, 4) DEFAULT 0,
    opening_balance NUMERIC(18, 4) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    raw_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS sales_rep_id UUID REFERENCES public.sales_reps(id) ON DELETE SET NULL;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS name_ar TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS balance NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS current_balance NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(18, 4) DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.customer_branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    code TEXT DEFAULT 'BR-01',
    name_ar TEXT NOT NULL,
    name_en TEXT DEFAULT '',
    governorate TEXT DEFAULT '',
    city TEXT DEFAULT '',
    detailed_address TEXT DEFAULT '',
    address TEXT DEFAULT '',
    contact_person TEXT DEFAULT '',
    contact_phone TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    raw_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

ALTER TABLE public.customer_branches ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.customer_branches ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE;
ALTER TABLE public.customer_branches ADD COLUMN IF NOT EXISTS name_ar TEXT;
ALTER TABLE public.customer_branches ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE;

-- ==============================================================================
-- 6. SUPPLIERS (الموردون)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
    code TEXT,
    name TEXT,
    name_ar TEXT NOT NULL,
    name_en TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    address TEXT DEFAULT '',
    city TEXT DEFAULT '',
    tax_number TEXT DEFAULT '',
    cr_number TEXT DEFAULT '',
    balance NUMERIC(18, 4) DEFAULT 0,
    current_balance NUMERIC(18, 4) DEFAULT 0,
    opening_balance NUMERIC(18, 4) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    raw_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS name_ar TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS balance NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(18, 4) DEFAULT 0;

-- ==============================================================================
-- 7. ITEMS & INVENTORY (الأصناف والمخزون)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    default_warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
    cogs_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
    sales_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
    inventory_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
    code TEXT,
    sku TEXT,
    barcode TEXT,
    name TEXT,
    name_ar TEXT NOT NULL,
    name_en TEXT DEFAULT '',
    category TEXT DEFAULT 'عام',
    unit TEXT DEFAULT 'حبة',
    units_per_pack NUMERIC(10, 2) DEFAULT 1,
    cost_price NUMERIC(18, 4) DEFAULT 0,
    sale_price NUMERIC(18, 4) DEFAULT 0,
    tax_rate NUMERIC(5, 2) DEFAULT 0,
    vat_rate NUMERIC(5, 2) DEFAULT 0,
    current_balance NUMERIC(18, 4) DEFAULT 0,
    minimum_level NUMERIC(18, 4) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    is_manufactured BOOLEAN DEFAULT FALSE,
    raw_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

ALTER TABLE public.items ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS default_warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS cogs_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS sales_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS inventory_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS name_ar TEXT;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS sku TEXT;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS cost_price NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS sale_price NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS current_balance NUMERIC(18, 4) DEFAULT 0;

-- ==============================================================================
-- 8. INVOICES & INVOICE ITEMS (الفواتير وبنود الفواتير)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    entity_id UUID,
    warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
    sales_rep_id UUID REFERENCES public.sales_reps(id) ON DELETE SET NULL,
    invoice_number TEXT NOT NULL,
    invoice_type TEXT DEFAULT 'SALES',
    issue_date DATE DEFAULT CURRENT_DATE,
    date DATE DEFAULT CURRENT_DATE,
    due_date DATE DEFAULT CURRENT_DATE,
    entity_type TEXT DEFAULT 'CUSTOMER',
    entity_name_ar TEXT DEFAULT '',
    customer_name TEXT DEFAULT '',
    payment_method TEXT DEFAULT 'CREDIT',
    subtotal NUMERIC(18, 4) DEFAULT 0,
    discount_amount NUMERIC(18, 4) DEFAULT 0,
    tax_amount NUMERIC(18, 4) DEFAULT 0,
    vat_amount NUMERIC(18, 4) DEFAULT 0,
    total_amount NUMERIC(18, 4) DEFAULT 0,
    grand_total NUMERIC(18, 4) DEFAULT 0,
    paid_amount NUMERIC(18, 4) DEFAULT 0,
    due_amount NUMERIC(18, 4) DEFAULT 0,
    payment_status TEXT DEFAULT 'UNPAID',
    status TEXT DEFAULT 'POSTED',
    notes TEXT DEFAULT '',
    customer_snapshot JSONB DEFAULT '{}'::jsonb,
    lines JSONB DEFAULT '[]'::jsonb,
    raw_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS entity_id UUID;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS sales_rep_id UUID REFERENCES public.sales_reps(id) ON DELETE SET NULL;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS subtotal NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS total_amount NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS grand_total NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS due_amount NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'UNPAID';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'POSTED';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS lines JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS raw_data JSONB DEFAULT '{}'::jsonb;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_invoices_company_number') THEN
        ALTER TABLE public.invoices ADD CONSTRAINT uq_invoices_company_number UNIQUE (company_id, invoice_number);
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    item_id UUID REFERENCES public.items(id) ON DELETE SET NULL,
    item_name TEXT NOT NULL,
    quantity NUMERIC(18, 4) DEFAULT 1,
    qty NUMERIC(18, 4) DEFAULT 1,
    unit_price NUMERIC(18, 4) DEFAULT 0,
    total_price NUMERIC(18, 4) DEFAULT 0,
    tax_rate NUMERIC(5, 2) DEFAULT 0,
    tax_amount NUMERIC(18, 4) DEFAULT 0,
    vat_rate NUMERIC(5, 2) DEFAULT 0,
    vat_amount NUMERIC(18, 4) DEFAULT 0,
    line_total NUMERIC(18, 4) DEFAULT 0,
    item_snapshot JSONB DEFAULT '{}'::jsonb,
    raw_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS item_id UUID REFERENCES public.items(id) ON DELETE SET NULL;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS item_name TEXT;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS quantity NUMERIC(18, 4) DEFAULT 1;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS unit_price NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS total_price NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS line_total NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS item_snapshot JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS raw_data JSONB DEFAULT '{}'::jsonb;

-- Dual compatibility tables: sales_master & sales_details
CREATE TABLE IF NOT EXISTS public.sales_master (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    invoice_number TEXT NOT NULL,
    date DATE DEFAULT CURRENT_DATE,
    customer_id TEXT,
    customer_name TEXT,
    payment_method TEXT DEFAULT 'CREDIT',
    status TEXT DEFAULT 'POSTED',
    payment_status TEXT DEFAULT 'PAID',
    subtotal NUMERIC(18, 4) DEFAULT 0,
    vat_amount NUMERIC(18, 4) DEFAULT 0,
    tax_amount NUMERIC(18, 4) DEFAULT 0,
    total_amount NUMERIC(18, 4) DEFAULT 0,
    paid_amount NUMERIC(18, 4) DEFAULT 0,
    due_amount NUMERIC(18, 4) DEFAULT 0,
    customer_snapshot JSONB DEFAULT '{}'::jsonb,
    raw_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.sales_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    invoice_id TEXT,
    sales_master_id TEXT,
    item_id TEXT,
    item_name TEXT,
    quantity NUMERIC(18, 4) DEFAULT 1,
    qty NUMERIC(18, 4) DEFAULT 1,
    unit_price NUMERIC(18, 4) DEFAULT 0,
    vat_rate NUMERIC(5, 2) DEFAULT 0,
    vat_amount NUMERIC(18, 4) DEFAULT 0,
    total NUMERIC(18, 4) DEFAULT 0,
    total_price NUMERIC(18, 4) DEFAULT 0,
    line_total NUMERIC(18, 4) DEFAULT 0,
    item_snapshot JSONB DEFAULT '{}'::jsonb,
    raw_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- ==============================================================================
-- 9. JOURNAL ENTRIES & RELATIONAL LINES (قيود اليومية وبنود القيود)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    entry_number TEXT NOT NULL,
    date DATE DEFAULT CURRENT_DATE,
    description TEXT,
    status TEXT DEFAULT 'POSTED',
    reference TEXT,
    reference_type TEXT,
    reference_id TEXT,
    source_id UUID,
    source_module TEXT,
    entity_id UUID,
    total_debit NUMERIC(18, 4) DEFAULT 0,
    total_credit NUMERIC(18, 4) DEFAULT 0,
    lines JSONB DEFAULT '[]'::jsonb,
    raw_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS entry_number TEXT;
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'POSTED';
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS total_debit NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS total_credit NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS lines JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS raw_data JSONB DEFAULT '{}'::jsonb;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_je_company_number') THEN
        ALTER TABLE public.journal_entries ADD CONSTRAINT uq_je_company_number UNIQUE (company_id, entry_number);
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.journal_entry_lines (
    id TEXT PRIMARY KEY DEFAULT ('jel-' || substring(replace(gen_random_uuid()::text, '-', ''), 1, 9)),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    journal_entry_id TEXT,
    journal_id TEXT,
    account_id TEXT,
    account_code TEXT,
    account_name TEXT,
    account_name_ar TEXT,
    description TEXT,
    memo TEXT,
    debit NUMERIC(18, 4) DEFAULT 0,
    credit NUMERIC(18, 4) DEFAULT 0,
    line_order INT DEFAULT 0,
    cost_center_id TEXT,
    raw_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- Defensive alter table to guarantee all columns exist under any historical schema
ALTER TABLE public.journal_entry_lines ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.journal_entry_lines ADD COLUMN IF NOT EXISTS journal_entry_id TEXT;
ALTER TABLE public.journal_entry_lines ADD COLUMN IF NOT EXISTS journal_id TEXT;
ALTER TABLE public.journal_entry_lines ADD COLUMN IF NOT EXISTS account_id TEXT;
ALTER TABLE public.journal_entry_lines ADD COLUMN IF NOT EXISTS account_code TEXT;
ALTER TABLE public.journal_entry_lines ADD COLUMN IF NOT EXISTS account_name TEXT;
ALTER TABLE public.journal_entry_lines ADD COLUMN IF NOT EXISTS account_name_ar TEXT;
ALTER TABLE public.journal_entry_lines ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.journal_entry_lines ADD COLUMN IF NOT EXISTS memo TEXT;
ALTER TABLE public.journal_entry_lines ADD COLUMN IF NOT EXISTS debit NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.journal_entry_lines ADD COLUMN IF NOT EXISTS credit NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.journal_entry_lines ADD COLUMN IF NOT EXISTS line_order INT DEFAULT 0;
ALTER TABLE public.journal_entry_lines ADD COLUMN IF NOT EXISTS cost_center_id TEXT;
ALTER TABLE public.journal_entry_lines ADD COLUMN IF NOT EXISTS raw_data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.journal_entry_lines ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc', now());
ALTER TABLE public.journal_entry_lines ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc', now());

-- Auto-synchronize journal_entry_id and journal_id if either was populated previously
UPDATE public.journal_entry_lines 
SET journal_entry_id = journal_id::text 
WHERE (journal_entry_id IS NULL OR journal_entry_id = '') AND journal_id IS NOT NULL;

UPDATE public.journal_entry_lines 
SET journal_id = journal_entry_id::text 
WHERE (journal_id IS NULL OR journal_id = '') AND journal_entry_id IS NOT NULL;

-- ==============================================================================
-- 10. PAYMENT VOUCHERS (سندات القبض والصرف)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.payment_vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
    voucher_number TEXT NOT NULL,
    voucher_type TEXT NOT NULL DEFAULT 'RECEIPT',
    type TEXT DEFAULT 'RECEIPT',
    date DATE DEFAULT CURRENT_DATE,
    amount NUMERIC(18, 4) DEFAULT 0,
    payment_method TEXT DEFAULT 'CASH',
    entity_type TEXT DEFAULT 'CUSTOMER',
    entity_id UUID,
    entity_name TEXT DEFAULT '',
    reference TEXT,
    reference_number TEXT,
    description TEXT,
    notes TEXT,
    status TEXT DEFAULT 'POSTED',
    raw_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

ALTER TABLE public.payment_vouchers ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.payment_vouchers ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.payment_vouchers ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;
ALTER TABLE public.payment_vouchers ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL;
ALTER TABLE public.payment_vouchers ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL;
ALTER TABLE public.payment_vouchers ADD COLUMN IF NOT EXISTS voucher_number TEXT;
ALTER TABLE public.payment_vouchers ADD COLUMN IF NOT EXISTS amount NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.payment_vouchers ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.payment_vouchers ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'POSTED';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_pv_company_number') THEN
        ALTER TABLE public.payment_vouchers ADD CONSTRAINT uq_pv_company_number UNIQUE (company_id, voucher_number);
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Backward compatibility table: vouchers
CREATE TABLE IF NOT EXISTS public.vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    voucher_number TEXT,
    type TEXT DEFAULT 'RECEIPT',
    voucher_type TEXT DEFAULT 'RECEIPT',
    date DATE DEFAULT CURRENT_DATE,
    amount NUMERIC(18, 4) DEFAULT 0,
    payment_method TEXT DEFAULT 'CASH',
    entity_type TEXT DEFAULT 'CUSTOMER',
    entity_id UUID,
    entity_name TEXT DEFAULT '',
    account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
    reference TEXT,
    description TEXT,
    status TEXT DEFAULT 'POSTED',
    raw_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- ==============================================================================
-- 11. MANUFACTURING MODULE (أوامر الإنتاج وإعدادات التصنيع)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.production_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    finished_item_id UUID REFERENCES public.items(id) ON DELETE SET NULL,
    warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
    order_number TEXT NOT NULL,
    order_date DATE DEFAULT CURRENT_DATE,
    expected_completion_date DATE,
    status TEXT DEFAULT 'DRAFT',
    planned_quantity NUMERIC(18, 4) DEFAULT 1,
    actual_quantity NUMERIC(18, 4) DEFAULT 0,
    raw_materials_cost NUMERIC(18, 4) DEFAULT 0,
    labor_cost NUMERIC(18, 4) DEFAULT 0,
    overhead_cost NUMERIC(18, 4) DEFAULT 0,
    total_production_cost NUMERIC(18, 4) DEFAULT 0,
    unit_cost NUMERIC(18, 4) DEFAULT 0,
    bill_of_materials JSONB DEFAULT '[]'::jsonb,
    notes TEXT DEFAULT '',
    raw_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

ALTER TABLE public.production_orders ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.production_orders ADD COLUMN IF NOT EXISTS finished_item_id UUID REFERENCES public.items(id) ON DELETE SET NULL;
ALTER TABLE public.production_orders ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL;
ALTER TABLE public.production_orders ADD COLUMN IF NOT EXISTS order_number TEXT;
ALTER TABLE public.production_orders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'DRAFT';
ALTER TABLE public.production_orders ADD COLUMN IF NOT EXISTS planned_quantity NUMERIC(18, 4) DEFAULT 1;
ALTER TABLE public.production_orders ADD COLUMN IF NOT EXISTS bill_of_materials JSONB DEFAULT '[]'::jsonb;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_po_company_number') THEN
        ALTER TABLE public.production_orders ADD CONSTRAINT uq_po_company_number UNIQUE (company_id, order_number);
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.manufacturing_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    default_raw_warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
    default_finished_warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
    wip_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
    labor_expense_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
    overhead_expense_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
    auto_post_journal_on_complete BOOLEAN DEFAULT TRUE,
    settings_data JSONB DEFAULT '{}'::jsonb,
    raw_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

ALTER TABLE public.manufacturing_settings ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.manufacturing_settings ADD COLUMN IF NOT EXISTS default_raw_warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL;
ALTER TABLE public.manufacturing_settings ADD COLUMN IF NOT EXISTS default_finished_warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL;
ALTER TABLE public.manufacturing_settings ADD COLUMN IF NOT EXISTS wip_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.manufacturing_settings ADD COLUMN IF NOT EXISTS auto_post_journal_on_complete BOOLEAN DEFAULT TRUE;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_ms_company') THEN
        ALTER TABLE public.manufacturing_settings ADD CONSTRAINT uq_ms_company UNIQUE (company_id);
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ==============================================================================
-- 12. HIGH-PERFORMANCE MULTI-TENANCY INDEXES (فهارس الأداء العالي)
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_coa_company ON public.chart_of_accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_coa_parent ON public.chart_of_accounts(parent_id);
CREATE INDEX IF NOT EXISTS idx_cas_company ON public.company_accounting_settings(company_id);
CREATE INDEX IF NOT EXISTS idx_warehouses_company ON public.warehouses(company_id);
CREATE INDEX IF NOT EXISTS idx_sales_reps_company ON public.sales_reps(company_id);
CREATE INDEX IF NOT EXISTS idx_customers_company ON public.customers(company_id);
CREATE INDEX IF NOT EXISTS idx_customers_account ON public.customers(account_id);
CREATE INDEX IF NOT EXISTS idx_cust_branches_cust ON public.customer_branches(customer_id);
CREATE INDEX IF NOT EXISTS idx_cust_branches_company ON public.customer_branches(company_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_company ON public.suppliers(company_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_account ON public.suppliers(account_id);
CREATE INDEX IF NOT EXISTS idx_items_company ON public.items(company_id);
CREATE INDEX IF NOT EXISTS idx_items_sku ON public.items(company_id, sku);
CREATE INDEX IF NOT EXISTS idx_items_accounts ON public.items(cogs_account_id, sales_account_id, inventory_account_id);
CREATE INDEX IF NOT EXISTS idx_invoices_company ON public.invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON public.invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON public.invoices(company_id, date);
CREATE INDEX IF NOT EXISTS idx_invoice_items_inv ON public.invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_item ON public.invoice_items(item_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_company ON public.invoice_items(company_id);
CREATE INDEX IF NOT EXISTS idx_je_company ON public.journal_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_je_date ON public.journal_entries(company_id, date);
CREATE INDEX IF NOT EXISTS idx_jel_je ON public.journal_entry_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_jel_journal ON public.journal_entry_lines(journal_id);
CREATE INDEX IF NOT EXISTS idx_jel_account ON public.journal_entry_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_jel_company ON public.journal_entry_lines(company_id);
CREATE INDEX IF NOT EXISTS idx_pv_company ON public.payment_vouchers(company_id);
CREATE INDEX IF NOT EXISTS idx_pv_account ON public.payment_vouchers(account_id);
CREATE INDEX IF NOT EXISTS idx_po_company ON public.production_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_ms_company ON public.manufacturing_settings(company_id);

-- ==============================================================================
-- 13. ROW LEVEL SECURITY (RLS) POLICIES (تأمين الجداول مع صلاحيات كاملة)
-- ==============================================================================
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_accounting_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_reps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manufacturing_settings ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY[
        'companies', 'chart_of_accounts', 'company_accounting_settings', 'company_settings',
        'warehouses', 'sales_reps', 'customers', 'customer_branches', 'suppliers', 'items',
        'invoices', 'invoice_items', 'sales_master', 'sales_details', 'journal_entries',
        'journal_entry_lines', 'payment_vouchers', 'vouchers', 'production_orders', 'manufacturing_settings'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Allow all for authenticated and anon on %I" ON public.%I', tbl, tbl);
        EXECUTE format('CREATE POLICY "Allow all for authenticated and anon on %I" ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)', tbl, tbl);
    END LOOP;
END $$;
