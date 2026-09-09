-- ==============================================================================
-- 🚀 LOGIX CLOUD ERP - ENTERPRISE DATABASE MIGRATION & RELATIONSHIPS UPGRADE V2
-- أقوى اسكربت تحديث شامل: المستودعات، مراكز التكلفة، قوائم الأسعار المركزية،
-- فروع العملاء، الفترات المالية، وأوامر البيع والشراء
-- 
-- ✅ آمن وغير مدمر (Non-Destructive): لا يحذف أي بيانات سابقة
-- ✅ جاهز للتنفيذ الفوري في Supabase SQL Editor أو PostgreSQL
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 0. التهيئة والإضافات المطلوبة (Extensions)
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- دالة عامة لتحديث توقيت updated_at تلقائياً
CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc', now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 1. إدارة المستودعات المتعددة وأرصدة المخازن (Multi-Warehouse Inventory)
-- ------------------------------------------------------------------------------

-- 1.1 جدول المستودعات (Warehouses)
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
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS uq_warehouses_code ON public.warehouses(company_id, code);
CREATE INDEX IF NOT EXISTS idx_warehouses_company ON public.warehouses(company_id);

-- 1.2 جدول رصيد الأصناف بكل مستودع (Item Warehouse Stocks)
CREATE TABLE IF NOT EXISTS public.item_warehouse_stocks (
    id TEXT PRIMARY KEY DEFAULT ('iws-' || substring(replace(gen_random_uuid()::text, '-', ''), 1, 9)),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    warehouse_id TEXT NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL REFERENCES public.inventory(id) ON DELETE CASCADE,
    quantity_on_hand NUMERIC(18, 4) NOT NULL DEFAULT 0,
    reserved_quantity NUMERIC(18, 4) NOT NULL DEFAULT 0,
    min_alert_qty NUMERIC(18, 4) DEFAULT 5,
    max_capacity NUMERIC(18, 4) DEFAULT 10000,
    shelf_location TEXT DEFAULT '',
    last_counted_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT uq_item_warehouse_stock UNIQUE (warehouse_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_item_warehouse_wh ON public.item_warehouse_stocks(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_item_warehouse_item ON public.item_warehouse_stocks(item_id);

-- 1.3 سندات التحويل المخزني بين المستودعات (Stock Transfers)
CREATE TABLE IF NOT EXISTS public.stock_transfers (
    id TEXT PRIMARY KEY DEFAULT ('st-' || substring(replace(gen_random_uuid()::text, '-', ''), 1, 9)),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    transfer_number TEXT NOT NULL,
    transfer_date DATE NOT NULL DEFAULT CURRENT_DATE,
    from_warehouse_id TEXT NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
    to_warehouse_id TEXT NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'DRAFT', -- DRAFT, IN_TRANSIT, COMPLETED, CANCELLED
    total_cost_value NUMERIC(18, 4) DEFAULT 0,
    driver_name TEXT DEFAULT '',
    approved_by TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT chk_diff_warehouses CHECK (from_warehouse_id <> to_warehouse_id)
);

CREATE INDEX IF NOT EXISTS idx_stock_transfers_company ON public.stock_transfers(company_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_status ON public.stock_transfers(status);

-- 1.4 بنود سند التحويل المخزني (Stock Transfer Lines)
CREATE TABLE IF NOT EXISTS public.stock_transfer_lines (
    id TEXT PRIMARY KEY DEFAULT ('stl-' || substring(replace(gen_random_uuid()::text, '-', ''), 1, 9)),
    transfer_id TEXT NOT NULL REFERENCES public.stock_transfers(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL REFERENCES public.inventory(id) ON DELETE RESTRICT,
    unit TEXT NOT NULL DEFAULT 'حبة',
    quantity NUMERIC(18, 4) NOT NULL CHECK (quantity > 0),
    unit_cost NUMERIC(18, 4) NOT NULL DEFAULT 0,
    total_cost NUMERIC(18, 4) NOT NULL DEFAULT 0,
    notes TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_stock_transfer_lines_tx ON public.stock_transfer_lines(transfer_id);

-- ------------------------------------------------------------------------------
-- 2. مراكز التكلفة والتوجيه المحاسبي التحليلي (Cost Centers)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.cost_centers (
    id TEXT PRIMARY KEY DEFAULT ('cc-' || substring(replace(gen_random_uuid()::text, '-', ''), 1, 9)),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name_ar TEXT NOT NULL,
    name_en TEXT DEFAULT '',
    parent_id TEXT REFERENCES public.cost_centers(id) ON DELETE SET NULL,
    level INTEGER NOT NULL DEFAULT 1,
    category TEXT NOT NULL DEFAULT 'OPERATIONAL', -- OPERATIONAL, ADMINISTRATIVE, SALES, PROJECT
    manager_name TEXT DEFAULT '',
    allocated_budget NUMERIC(18, 4) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT uq_cost_center_code UNIQUE (company_id, code)
);

CREATE INDEX IF NOT EXISTS idx_cost_centers_company ON public.cost_centers(company_id);

-- ربط مراكز التكلفة ببنود اليومية العامة والفواتير
ALTER TABLE public.journal_entry_lines ADD COLUMN IF NOT EXISTS cost_center_id TEXT REFERENCES public.cost_centers(id) ON DELETE SET NULL;
ALTER TABLE public.invoice_lines ADD COLUMN IF NOT EXISTS cost_center_id TEXT REFERENCES public.cost_centers(id) ON DELETE SET NULL;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS cost_center_id TEXT REFERENCES public.cost_centers(id) ON DELETE SET NULL;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS warehouse_id TEXT REFERENCES public.warehouses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_journal_lines_cost_center ON public.journal_entry_lines(cost_center_id);
CREATE INDEX IF NOT EXISTS idx_invoices_cost_center ON public.invoices(cost_center_id);
CREATE INDEX IF NOT EXISTS idx_invoices_warehouse ON public.invoices(warehouse_id);

-- ------------------------------------------------------------------------------
-- 3. قوائم الأسعار المركزية والتسعير الشرائحي (Master Price Lists)
-- ------------------------------------------------------------------------------

-- 3.1 جدول قوائم الأسعار (Master Price Lists)
CREATE TABLE IF NOT EXISTS public.master_price_lists (
    id TEXT PRIMARY KEY DEFAULT ('pl-' || substring(replace(gen_random_uuid()::text, '-', ''), 1, 9)),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name_ar TEXT NOT NULL,
    name_en TEXT DEFAULT '',
    currency TEXT NOT NULL DEFAULT 'KWD',
    is_default BOOLEAN DEFAULT false,
    default_discount_percent NUMERIC(5, 2) DEFAULT 0,
    valid_from DATE DEFAULT CURRENT_DATE,
    valid_to DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT uq_price_list_code UNIQUE (company_id, code)
);

CREATE INDEX IF NOT EXISTS idx_price_lists_company ON public.master_price_lists(company_id);

-- 3.2 بنود قوائم الأسعار لكل صنف (Price List Items)
CREATE TABLE IF NOT EXISTS public.master_price_list_items (
    id TEXT PRIMARY KEY DEFAULT ('pli-' || substring(replace(gen_random_uuid()::text, '-', ''), 1, 9)),
    price_list_id TEXT NOT NULL REFERENCES public.master_price_lists(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL REFERENCES public.inventory(id) ON DELETE CASCADE,
    custom_sale_price NUMERIC(18, 4) NOT NULL CHECK (custom_sale_price >= 0),
    min_order_quantity NUMERIC(18, 4) DEFAULT 1,
    discount_rate NUMERIC(5, 2) DEFAULT 0,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT uq_price_list_item UNIQUE (price_list_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_price_list_items_pl ON public.master_price_list_items(price_list_id);
CREATE INDEX IF NOT EXISTS idx_price_list_items_item ON public.master_price_list_items(item_id);

-- ربط العميل بقائمة الأسعار المركزية
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS master_price_list_id TEXT REFERENCES public.master_price_lists(id) ON DELETE SET NULL;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS price_list_id TEXT REFERENCES public.master_price_lists(id) ON DELETE SET NULL;

-- ------------------------------------------------------------------------------
-- 4. أفرع ومواقع تسليم العملاء (Customer Branches)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.customer_branches (
    id TEXT PRIMARY KEY DEFAULT ('br-' || substring(replace(gen_random_uuid()::text, '-', ''), 1, 9)),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    customer_id TEXT NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name_ar TEXT NOT NULL,
    name_en TEXT DEFAULT '',
    governorate TEXT DEFAULT '',
    city TEXT DEFAULT '',
    detailed_address TEXT DEFAULT '',
    contact_person TEXT DEFAULT '',
    contact_phone TEXT DEFAULT '',
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_customer_branches_cust ON public.customer_branches(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_branches_comp ON public.customer_branches(company_id);

-- ربط الفاتورة بفرع العميل
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS customer_branch_id TEXT REFERENCES public.customer_branches(id) ON DELETE SET NULL;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS customer_branch_name TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS price_list_applied TEXT;

CREATE INDEX IF NOT EXISTS idx_invoices_cust_branch ON public.invoices(customer_branch_id);

-- ------------------------------------------------------------------------------
-- 5. السنوات والفترات المالية وإغلاق الدفاتر (Fiscal Years & Periods)
-- ------------------------------------------------------------------------------

-- 5.1 جدول السنوات المالية (Fiscal Years)
CREATE TABLE IF NOT EXISTS public.fiscal_years (
    id TEXT PRIMARY KEY DEFAULT ('fy-' || substring(replace(gen_random_uuid()::text, '-', ''), 1, 9)),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    year_code TEXT NOT NULL, -- e.g. '2026'
    name_ar TEXT NOT NULL, -- e.g. 'السنة المالية 2026'
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_closed BOOLEAN DEFAULT false,
    closed_at TIMESTAMPTZ,
    closed_by TEXT DEFAULT '',
    retained_earnings_account_id TEXT REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT uq_fiscal_year_code UNIQUE (company_id, year_code)
);

-- 5.2 جدول الفترات الشهرية/الربع سنوية (Fiscal Periods)
CREATE TABLE IF NOT EXISTS public.fiscal_periods (
    id TEXT PRIMARY KEY DEFAULT ('fp-' || substring(replace(gen_random_uuid()::text, '-', ''), 1, 9)),
    fiscal_year_id TEXT NOT NULL REFERENCES public.fiscal_years(id) ON DELETE CASCADE,
    period_number INTEGER NOT NULL CHECK (period_number BETWEEN 1 AND 12),
    name_ar TEXT NOT NULL, -- e.g. 'فترة يناير 2026'
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_closed BOOLEAN DEFAULT false,
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT uq_year_period UNIQUE (fiscal_year_id, period_number)
);

CREATE INDEX IF NOT EXISTS idx_fiscal_periods_year ON public.fiscal_periods(fiscal_year_id);

-- ------------------------------------------------------------------------------
-- 6. الدورة المستندية التجارية: أوامر البيع وأوامر الشراء (Orders & Quotations)
-- ------------------------------------------------------------------------------

-- 6.1 أوامر البيع المعتمدة (Sales Orders)
CREATE TABLE IF NOT EXISTS public.sales_orders (
    id TEXT PRIMARY KEY DEFAULT ('so-' || substring(replace(gen_random_uuid()::text, '-', ''), 1, 9)),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    order_number TEXT NOT NULL,
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expected_delivery_date DATE,
    customer_id TEXT NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
    customer_branch_id TEXT REFERENCES public.customer_branches(id) ON DELETE SET NULL,
    warehouse_id TEXT REFERENCES public.warehouses(id) ON DELETE SET NULL,
    price_list_id TEXT REFERENCES public.master_price_lists(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, APPROVED, PARTIALLY_DELIVERED, COMPLETED, CANCELLED
    subtotal NUMERIC(18, 4) DEFAULT 0,
    discount_total NUMERIC(18, 4) DEFAULT 0,
    grand_total NUMERIC(18, 4) DEFAULT 0,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_sales_orders_company ON public.sales_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_customer ON public.sales_orders(customer_id);

-- 6.2 بنود أمر البيع (Sales Order Lines)
CREATE TABLE IF NOT EXISTS public.sales_order_lines (
    id TEXT PRIMARY KEY DEFAULT ('sol-' || substring(replace(gen_random_uuid()::text, '-', ''), 1, 9)),
    order_id TEXT NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL REFERENCES public.inventory(id) ON DELETE RESTRICT,
    unit TEXT NOT NULL DEFAULT 'حبة',
    quantity NUMERIC(18, 4) NOT NULL CHECK (quantity > 0),
    delivered_quantity NUMERIC(18, 4) NOT NULL DEFAULT 0,
    unit_price NUMERIC(18, 4) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(18, 4) DEFAULT 0,
    total NUMERIC(18, 4) NOT NULL DEFAULT 0,
    notes TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_sales_order_lines_order ON public.sales_order_lines(order_id);

-- 6.3 أوامر الشراء والتوريد (Purchase Orders)
CREATE TABLE IF NOT EXISTS public.purchase_orders (
    id TEXT PRIMARY KEY DEFAULT ('po-' || substring(replace(gen_random_uuid()::text, '-', ''), 1, 9)),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    order_number TEXT NOT NULL,
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expected_delivery_date DATE,
    supplier_id TEXT NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
    warehouse_id TEXT REFERENCES public.warehouses(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, APPROVED, RECEIVED, CANCELLED
    grand_total NUMERIC(18, 4) DEFAULT 0,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON public.purchase_orders(supplier_id);

-- 6.4 بنود أمر الشراء (Purchase Order Lines)
CREATE TABLE IF NOT EXISTS public.purchase_order_lines (
    id TEXT PRIMARY KEY DEFAULT ('pol-' || substring(replace(gen_random_uuid()::text, '-', ''), 1, 9)),
    order_id TEXT NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL REFERENCES public.inventory(id) ON DELETE RESTRICT,
    unit TEXT NOT NULL DEFAULT 'حبة',
    quantity NUMERIC(18, 4) NOT NULL CHECK (quantity > 0),
    received_quantity NUMERIC(18, 4) NOT NULL DEFAULT 0,
    unit_price NUMERIC(18, 4) NOT NULL DEFAULT 0,
    total NUMERIC(18, 4) NOT NULL DEFAULT 0,
    notes TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_purchase_order_lines_order ON public.purchase_order_lines(order_id);

-- ------------------------------------------------------------------------------
-- 7. العروض التحليلية المتقدمة (High-Performance Analytical Views)
-- ------------------------------------------------------------------------------

-- 7.1 تقرير تقييم المخزون المجمع وتوزيعه على المستودعات
CREATE OR REPLACE VIEW public.view_warehouse_inventory_valuation AS
SELECT 
    w.id AS warehouse_id,
    w.code AS warehouse_code,
    w.name_ar AS warehouse_name,
    i.id AS item_id,
    i.sku AS item_sku,
    i.name_ar AS item_name,
    i.unit,
    COALESCE(iws.quantity_on_hand, 0) AS stock_quantity,
    i.purchase_price AS unit_cost,
    i.sale_price AS unit_sale_price,
    ROUND(COALESCE(iws.quantity_on_hand, 0) * i.purchase_price, 4) AS total_cost_value,
    ROUND(COALESCE(iws.quantity_on_hand, 0) * i.sale_price, 4) AS total_sale_value
FROM public.warehouses w
CROSS JOIN public.inventory i
LEFT JOIN public.item_warehouse_stocks iws 
    ON iws.warehouse_id = w.id AND iws.item_id = i.id
WHERE w.is_active = true AND i.is_active = true;

-- 7.2 كشف فروع العملاء ومبيعات كل فرع
CREATE OR REPLACE VIEW public.view_customer_branches_summary AS
SELECT 
    c.id AS customer_id,
    c.code AS customer_code,
    c.name_ar AS customer_name,
    cb.id AS branch_id,
    cb.code AS branch_code,
    cb.name_ar AS branch_name,
    cb.city AS branch_city,
    cb.contact_person,
    cb.contact_phone,
    cb.is_default,
    COUNT(inv.id) AS total_invoices_count,
    COALESCE(SUM(inv.grand_total), 0) AS total_invoiced_amount
FROM public.customers c
LEFT JOIN public.customer_branches cb ON cb.customer_id = c.id
LEFT JOIN public.invoices inv ON inv.customer_branch_id = cb.id AND inv.status <> 'CANCELLED'
GROUP BY c.id, c.code, c.name_ar, cb.id, cb.code, cb.name_ar, cb.city, cb.contact_person, cb.contact_phone, cb.is_default;

-- 7.3 ميزان أرباح وخسائر مراكز التكلفة (Cost Center P&L)
CREATE OR REPLACE VIEW public.view_cost_center_profit_loss AS
SELECT 
    cc.id AS cost_center_id,
    cc.code AS cost_center_code,
    cc.name_ar AS cost_center_name,
    cc.category,
    COALESCE(SUM(CASE WHEN coa.category = 'REVENUE' THEN jel.credit - jel.debit ELSE 0 END), 0) AS total_revenues,
    COALESCE(SUM(CASE WHEN coa.category = 'EXPENSE' THEN jel.debit - jel.credit ELSE 0 END), 0) AS total_expenses,
    COALESCE(SUM(CASE WHEN coa.category = 'REVENUE' THEN jel.credit - jel.debit 
                      WHEN coa.category = 'EXPENSE' THEN jel.credit - jel.debit 
                      ELSE 0 END), 0) AS net_profit_or_loss
FROM public.cost_centers cc
LEFT JOIN public.journal_entry_lines jel ON jel.cost_center_id = cc.id
LEFT JOIN public.chart_of_accounts coa ON coa.id = jel.account_id
GROUP BY cc.id, cc.code, cc.name_ar, cc.category;

-- ------------------------------------------------------------------------------
-- 8. البيانات الافتراضية التأسيسية التلقائية (Idempotent Seed Data)
-- ------------------------------------------------------------------------------

-- إدراج المستودعات الافتراضية
INSERT INTO public.warehouses (id, code, name_ar, name_en, location, keeper_name, is_default, is_active)
VALUES 
    ('wh-main-01', 'WH-01', 'المستودع المركزي - الشويخ الصناعية', 'Main Warehouse - Shuwaikh', 'الشويخ الصناعية، قسيمة 12', 'أحمد المحمود', true, true),
    ('wh-sub-02', 'WH-02', 'مستودع التوزيع - منطقة الري', 'Distribution Warehouse - Al-Rai', 'منطقة الري، مجمع المخازن 4', 'سيد عبد الرحمن', false, true),
    ('wh-south-03', 'WH-03', 'مستودع الجنوب - الأحمدي', 'South Warehouse - Ahmadi', 'ميناء عبد الله / الأحمدي', 'خالد الدوسري', false, true)
ON CONFLICT (id) DO NOTHING;

-- إدراج مراكز التكلفة التأسيسية
INSERT INTO public.cost_centers (id, code, name_ar, name_en, level, category, manager_name, is_active)
VALUES 
    ('cc-admin-01', 'CC-100', 'الإدارة العامة والإدارة المالية', 'General & Financial Admin', 1, 'ADMINISTRATIVE', 'الإدارة المالية', true),
    ('cc-sales-02', 'CC-200', 'إدارة المبيعات والتسويق والتوزيع', 'Sales & Distribution', 1, 'SALES', 'فريق المبيعات', true),
    ('cc-ops-03',   'CC-300', 'إدارة التشغيل والمخازن واللوجستيات', 'Operations & Logistics', 1, 'OPERATIONAL', 'مدير العمليات', true),
    ('cc-proj-04',  'CC-400', 'مشاريع التوريد للجمعيات التعاونية', 'Cooperative Supply Projects', 1, 'PROJECT', 'مسؤول الجمعيات', true)
ON CONFLICT (id) DO NOTHING;

-- إدراج قوائم الأسعار المركزية المعتمدة
INSERT INTO public.master_price_lists (id, code, name_ar, name_en, currency, is_default, default_discount_percent, is_active)
VALUES 
    ('pl-coop-01', 'PL-COOP', 'قائمة أسعار الجمعيات التعاونية والهيئات', 'Coop Societies Price List', 'KWD', false, 5.00, true),
    ('pl-vip-02',  'PL-WHOLE', 'قائمة كبار العملاء وموزعي الجملة', 'Wholesale & Key Accounts', 'KWD', false, 7.50, true),
    ('pl-std-03',  'PL-STD',   'قائمة الأسعار القياسية والتجزئة', 'Standard Retail Price List', 'KWD', true, 0.00, true)
ON CONFLICT (id) DO NOTHING;

-- إدراج السنة المالية الحالية 2026 مع أرباعها
INSERT INTO public.fiscal_years (id, year_code, name_ar, start_date, end_date, is_closed)
VALUES 
    ('fy-2026', '2026', 'السنة المالية 2026', '2026-01-01', '2026-12-31', false)
ON CONFLICT (id) DO NOTHING;

-- إدراج الفترات المالية الافتراضية
INSERT INTO public.fiscal_periods (id, fiscal_year_id, period_number, name_ar, start_date, end_date, is_closed)
VALUES 
    ('fp-2026-01', 'fy-2026', 1, 'فترة يناير 2026', '2026-01-01', '2026-01-31', false),
    ('fp-2026-02', 'fy-2026', 2, 'فترة فبراير 2026', '2026-02-01', '2026-02-28', false),
    ('fp-2026-03', 'fy-2026', 3, 'فترة مارس 2026', '2026-03-01', '2026-03-31', false),
    ('fp-2026-04', 'fy-2026', 4, 'فترة أبريل 2026', '2026-04-01', '2026-04-30', false),
    ('fp-2026-05', 'fy-2026', 5, 'فترة مايو 2026', '2026-05-01', '2026-05-31', false),
    ('fp-2026-06', 'fy-2026', 6, 'فترة يونيو 2026', '2026-06-01', '2026-06-30', false),
    ('fp-2026-07', 'fy-2026', 7, 'فترة يوليو 2026', '2026-07-01', '2026-07-31', false),
    ('fp-2026-08', 'fy-2026', 8, 'فترة أغسطس 2026', '2026-08-01', '2026-08-31', false),
    ('fp-2026-09', 'fy-2026', 9, 'فترة سبتمبر 2026', '2026-09-01', '2026-09-30', false),
    ('fp-2026-10', 'fy-2026', 10, 'فترة أكتوبر 2026', '2026-10-01', '2026-10-31', false),
    ('fp-2026-11', 'fy-2026', 11, 'فترة نوفمبر 2026', '2026-11-01', '2026-11-30', false),
    ('fp-2026-12', 'fy-2026', 12, 'فترة ديسمبر 2026', '2026-12-01', '2026-12-31', false)
ON CONFLICT (id) DO NOTHING;

-- ربط أفرع تجريبية للعملاء الحاليين إن وجدت
INSERT INTO public.customer_branches (id, customer_id, code, name_ar, name_en, governorate, city, detailed_address, contact_person, contact_phone, is_default)
SELECT 
    'br-c1-01', c.id, 'BR-01', 'فرع السوق المركزي الرئيسي', 'Main Hypermarket Branch', 'العاصمة', 'الروضة', 'شارع الروضة الرئيسي، مجمع الأسواق', 'سيد عبد العزيز', '+965 22510001', true
FROM public.customers c WHERE c.id = 'cust-1' OR c.code = 'CUST-001' LIMIT 1
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.customer_branches (id, customer_id, code, name_ar, name_en, governorate, city, detailed_address, contact_person, contact_phone, is_default)
SELECT 
    'br-c1-02', c.id, 'BR-02', 'فرع حولي قسيمة 4', 'Hawalli Branch 4', 'حولي', 'حولي', 'شارع تونس، بجانب مجمع البنوك', 'طارق الشمري', '+965 22610002', false
FROM public.customers c WHERE c.id = 'cust-1' OR c.code = 'CUST-001' LIMIT 1
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- ==============================================================================
-- انتهى الاسكربت بنجاح ✅ تم تجهيز 12 جدولاً جديداً مع كافة الترابطات والمفاتيح الأجنبية
-- ==============================================================================
