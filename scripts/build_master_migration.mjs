import fs from 'fs';
import path from 'path';

const projectUrl = 'https://tshcwdieqlldkygkcytr.supabase.co';
const projectId = 'tshcwdieqlldkygkcytr';

const alwaleedSql = fs.readFileSync('alwaleed_mill_import.sql', 'utf8');

// Additional schema definitions not in alwaleed_mill_import.sql:
const additionalSchema = `
-- ==============================================================================
-- 🏛️ الجداول والوظائف الإضافية للشركات، المستخدمين، الإنتاج والمستودعات
-- ==============================================================================

-- جدول إعدادات الحسابات الافتراضية (company_accounting_settings)
CREATE TABLE IF NOT EXISTS public.company_accounting_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
    cash_account_id UUID,
    bank_account_id UUID,
    receivable_account_id UUID,
    payable_account_id UUID,
    inventory_account_id UUID,
    sales_account_id UUID,
    cogs_account_id UUID,
    retained_earnings_account_id UUID,
    vat_account_id UUID,
    default_cash_account_id UUID,
    default_bank_account_id UUID,
    default_receivable_account_id UUID,
    default_payable_account_id UUID,
    default_inventory_account_id UUID,
    default_sales_account_id UUID,
    default_cogs_account_id UUID,
    default_retained_earnings_account_id UUID,
    default_vat_account_id UUID,
    settings_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    CONSTRAINT uq_comp_acc_settings_comp UNIQUE (company_id)
);

-- جدول إعدادات الشركة المتوافقة (company_settings)
CREATE TABLE IF NOT EXISTS public.company_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
    default_cash_account_id UUID,
    default_bank_account_id UUID,
    default_receivable_account_id UUID,
    default_payable_account_id UUID,
    default_sales_account_id UUID,
    default_cogs_account_id UUID,
    default_inventory_account_id UUID,
    default_retained_earnings_account_id UUID,
    default_vat_account_id UUID,
    settings_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    CONSTRAINT uq_company_settings_comp UNIQUE (company_id)
);

-- جدول قوائم الأسعار الرئيسية (master_price_lists)
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

-- دالة تنفيذ استعلامات SQL الإدارية عن بعد (Remote Exec SQL RPC)
CREATE OR REPLACE FUNCTION public.exec_sql(query text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    EXECUTE query;
    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO anon, authenticated, service_role;

-- جدول مستخدمي الشركات (company_users)
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

-- جدول المستودعات (warehouses)
CREATE TABLE IF NOT EXISTS public.warehouses (
    id TEXT PRIMARY KEY,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    location TEXT,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- جدول مندوبي المبيعات (sales_reps)
CREATE TABLE IF NOT EXISTS public.sales_reps (
    id TEXT PRIMARY KEY,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    commission_rate NUMERIC(5, 2) DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- جدول أوامر التصنيع والتشغيل (production_orders)
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

-- جدول إعدادات التصنيع (manufacturing_settings)
CREATE TABLE IF NOT EXISTS public.manufacturing_settings (
    company_id UUID PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
    settings_data JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- جدول فروع الجمعيات والعملاء (customer_branches)
CREATE TABLE IF NOT EXISTS public.customer_branches (
    id TEXT PRIMARY KEY,
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name_ar TEXT NOT NULL,
    name_en TEXT DEFAULT '',
    city TEXT DEFAULT 'الكويت',
    address TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- جدول بنود قيود اليومية المنفصلة (journal_entry_lines)
CREATE TABLE IF NOT EXISTS public.journal_entry_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    account_id UUID,
    account_code TEXT,
    account_name_ar TEXT,
    debit NUMERIC(18, 4) NOT NULL DEFAULT 0,
    credit NUMERIC(18, 4) NOT NULL DEFAULT 0,
    memo TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- وحدات القياس وعروض الأسعار
CREATE TABLE IF NOT EXISTS public.item_units (
    id TEXT PRIMARY KEY,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    item_id UUID REFERENCES public.items(id) ON DELETE CASCADE,
    unit_name TEXT NOT NULL,
    conversion_factor NUMERIC(12, 4) DEFAULT 1,
    selling_price NUMERIC(18, 4),
    barcode TEXT,
    is_base BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.item_offers (
    id TEXT PRIMARY KEY,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    item_id UUID REFERENCES public.items(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    offer_type TEXT NOT NULL,
    min_quantity NUMERIC(12, 4) DEFAULT 1,
    discount_percentage NUMERIC(5, 2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
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

-- تفعيل RLS للجداول الإضافية
ALTER TABLE public.company_accounting_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_price_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_reps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manufacturing_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "comp_acc_settings_full_access" ON public.company_accounting_settings;
    CREATE POLICY "comp_acc_settings_full_access" ON public.company_accounting_settings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
    DROP POLICY IF EXISTS "company_settings_full_access" ON public.company_settings;
    CREATE POLICY "company_settings_full_access" ON public.company_settings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
    DROP POLICY IF EXISTS "master_price_lists_full_access" ON public.master_price_lists;
    CREATE POLICY "master_price_lists_full_access" ON public.master_price_lists FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
    DROP POLICY IF EXISTS "comp_users_full_access" ON public.company_users;
    CREATE POLICY "comp_users_full_access" ON public.company_users FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
    DROP POLICY IF EXISTS "warehouses_full_access" ON public.warehouses;
    CREATE POLICY "warehouses_full_access" ON public.warehouses FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
    DROP POLICY IF EXISTS "sales_reps_full_access" ON public.sales_reps;
    CREATE POLICY "sales_reps_full_access" ON public.sales_reps FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
    DROP POLICY IF EXISTS "prod_orders_full_access" ON public.production_orders;
    CREATE POLICY "prod_orders_full_access" ON public.production_orders FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
    DROP POLICY IF EXISTS "mfg_settings_full_access" ON public.manufacturing_settings;
    CREATE POLICY "mfg_settings_full_access" ON public.manufacturing_settings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
    DROP POLICY IF EXISTS "branches_full_access" ON public.customer_branches;
    CREATE POLICY "branches_full_access" ON public.customer_branches FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
    DROP POLICY IF EXISTS "jrn_lines_full_access" ON public.journal_entry_lines;
    CREATE POLICY "jrn_lines_full_access" ON public.journal_entry_lines FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
    DROP POLICY IF EXISTS "item_units_full_access" ON public.item_units;
    CREATE POLICY "item_units_full_access" ON public.item_units FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
    DROP POLICY IF EXISTS "item_offers_full_access" ON public.item_offers;
    CREATE POLICY "item_offers_full_access" ON public.item_offers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
    DROP POLICY IF EXISTS "audit_logs_full_access" ON public.audit_logs;
    CREATE POLICY "audit_logs_full_access" ON public.audit_logs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
`;

const seedUsersAndWarehouses = `
-- ==============================================================================
-- 🏛️ تهيئة المستخدمين والمستودعات والمندوبين
-- ==============================================================================

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
    'alwaleed', 
    'alwaleed.mill@logixerp.com', 
    'مطحنة الوليد المتحده', 
    'ADMIN', 
    'المدير التنفيذي والمالك', 
    crypt('1234', gen_salt('bf')), 
    false
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

-- المستودعات الرئيسية لمطحنة الوليد
INSERT INTO public.warehouses (id, company_id, code, name, location, is_default)
VALUES 
('wh-main', '20000000-0000-0000-0000-000000000001'::uuid, 'WH-01', 'مستودع الشويخ الرئيسي', 'الشويخ الصناعية', true),
('wh-prod', '20000000-0000-0000-0000-000000000001'::uuid, 'WH-02', 'مستودع التعبئة والإنتاج', 'الري الصناعية', false)
ON CONFLICT (id) DO NOTHING;

-- مندوبو المبيعات
INSERT INTO public.sales_reps (id, company_id, code, name, phone, commission_rate)
VALUES
('rep-01', '20000000-0000-0000-0000-000000000001'::uuid, 'REP-01', 'مندوب توزيع الجمعيات (أحمد العلي)', '+965 9988 7711', 1.5),
('rep-02', '20000000-0000-0000-0000-000000000001'::uuid, 'REP-02', 'مندوب الجملة والأسواق (سالم المطيري)', '+965 9988 7722', 2.0)
ON CONFLICT (id) DO NOTHING;

-- تصفير رصيد كافة أصناف المخزون لضمان مطابقة الجرد الفعلي والدخول والخروج الجديد
UPDATE public.items 
SET current_balance = 0, 
    qty_on_hand = 0, 
    raw_data = jsonb_set(raw_data, '{quantityOnHand}', '0'::jsonb)
WHERE company_id = '20000000-0000-0000-0000-000000000001'::uuid;
`;

// Build final script
let header = `-- ==============================================================================
-- 🏛️ LOGIX CLOUD ERP - MASTER DATABASE SCHEMA & SEED SCRIPT
-- Project ID: ${projectId}
-- Project URL: ${projectUrl}
-- Company: شركة مطحنة الوليد المتحدة (ذ.م.م)
-- Tenant UUID: 20000000-0000-0000-0000-000000000001
--
-- تعليمات التشغيل السريع:
-- 1. افتح لوحة تحكم مشروعك الجديد في سوبابيز:
--    https://supabase.com/dashboard/project/${projectId}/sql/new
-- 2. انسخ كامل محتوى هذا السكربت والصقه في محرر SQL (SQL Editor)
-- 3. اضغط على الزر الأخضر (Run) أو (Ctrl + Enter)
-- ==============================================================================
`;

// Splice additional schema after the initial table definitions (around line 270)
// Let's insert additionalSchema right after table definitions in alwaleedSql
let combined = alwaleedSql;

// Replace old project references if any
combined = combined.replace(/tshcwdieqlldkygkcytr/g, projectId);
combined = combined.replace(/gzoncsbxfdnfellspgke/g, projectId);

// Insert additional schema
const insertPoint = combined.indexOf('-- سياسات الأمان RLS');
if (insertPoint !== -1) {
  combined = combined.slice(0, insertPoint) + additionalSchema + '\n' + combined.slice(insertPoint);
} else {
  combined = combined + '\n' + additionalSchema;
}

// Append seedUsersAndWarehouses right before confirmation notice
const confirmPoint = combined.indexOf('-- 10. تأكيد ومراجعة اكتمال البيانات المستوردة');
if (confirmPoint !== -1) {
  combined = combined.slice(0, confirmPoint) + seedUsersAndWarehouses + '\n' + combined.slice(confirmPoint);
} else {
  combined = combined + '\n' + seedUsersAndWarehouses;
}

combined = header + '\n' + combined;

fs.writeFileSync('supabase_master_setup_new_db.sql', combined, 'utf8');
fs.writeFileSync('public/supabase_master_setup_new_db.sql', combined, 'utf8');
fs.writeFileSync('alwaleed_master_setup_tshcwdieqlldkygkcytr.sql', combined, 'utf8');

console.log('✅ Generated master database scripts successfully! Size:', combined.length);
