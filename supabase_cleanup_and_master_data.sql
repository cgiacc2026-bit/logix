-- =========================================================================================
-- LOGIX CLOUD ERP - SUPABASE / POSTGRESQL SQL MIGRATION & REPAIR SCRIPT
-- سكربت تحديث قاعدة البيانات: المندوب والمخزن وحل تكرار دليل الحسابات
-- =========================================================================================

BEGIN;

-- -----------------------------------------------------------------------------------------
-- 1. جدول المستودعات (warehouses) وإدراج "مخزن رئيسي" الافتراضي
-- -----------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.warehouses (
  id TEXT PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  name_en TEXT DEFAULT '',
  location TEXT DEFAULT '',
  keeper_name TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_warehouses_company_code UNIQUE (company_id, code)
);

ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on warehouses" ON public.warehouses;
CREATE POLICY "Allow all on warehouses" ON public.warehouses FOR ALL USING (true) WITH CHECK (true);

-- إدراج وتحديث "مخزن رئيسي" لكافة الشركات المسجلة بالنظام
INSERT INTO public.warehouses (
  id, company_id, code, name_ar, name_en, location, keeper_name, is_default, is_active, updated_at
)
SELECT 
  'wh-main-01',
  id AS company_id,
  'WH-MAIN-01',
  'مخزن رئيسي (المستودع الرئيسي - الشويخ)',
  'Main Warehouse - Shuwaikh',
  'الشويخ الصناعية، ق 3',
  'سالم الكندري',
  true,
  true,
  NOW()
FROM public.companies
ON CONFLICT (id) DO UPDATE SET
  code = EXCLUDED.code,
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  is_default = true,
  is_active = true,
  updated_at = NOW();

-- -----------------------------------------------------------------------------------------
-- 2. إنشاء جدول المناديب (sales_reps) وإدراج "مندوب عام" الأساسي
-- -----------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sales_reps (
  id TEXT PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  name_en TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  commission_rate NUMERIC(5,2) DEFAULT 0,
  target_amount NUMERIC(15,3) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_sales_reps_company_code UNIQUE (company_id, code)
);

ALTER TABLE public.sales_reps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on sales_reps" ON public.sales_reps;
CREATE POLICY "Allow all on sales_reps" ON public.sales_reps FOR ALL USING (true) WITH CHECK (true);

-- إدراج "مندوب عام" لكافة الشركات
INSERT INTO public.sales_reps (
  id, company_id, code, name_ar, name_en, phone, email, commission_rate, target_amount, is_active, notes, updated_at
)
SELECT 
  'rep-001',
  id AS company_id,
  'REP-01',
  'مندوب عام',
  'General Sales Representative',
  '+965 9911 2233',
  'sales@logix-erp.com',
  2.5,
  50000.000,
  true,
  'مندوب عام لكافة الجمعيات والمبيعات العامة',
  NOW()
FROM public.companies
ON CONFLICT (id) DO UPDATE SET
  code = EXCLUDED.code,
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  is_active = true,
  notes = EXCLUDED.notes,
  updated_at = NOW();

-- -----------------------------------------------------------------------------------------
-- 3. حل وحذف التكرار في شجرة الحسابات (chart_of_accounts) ومنع حدوثه نهائياً
-- -----------------------------------------------------------------------------------------
-- أ) نقل وتحديث الأرصدة إلى الحساب الأصيل (acc-XXXX) قبل حذف المكرر
UPDATE public.chart_of_accounts target
SET 
  balance = source.balance,
  current_balance = source.current_balance,
  updated_at = NOW()
FROM public.chart_of_accounts source
WHERE target.company_id = source.company_id
  AND target.code = source.code
  AND target.id != source.id
  AND target.id LIKE 'acc-%'
  AND (source.balance != 0 OR source.current_balance != 0);

-- ب) حذف السجلات المكررة وإبقاء الحساب المعتمد (acc-XXXX أو أحدث سجل)
DELETE FROM public.chart_of_accounts a
USING public.chart_of_accounts b
WHERE a.company_id = b.company_id
  AND a.code = b.code
  AND a.id != b.id
  AND (
    (b.id LIKE 'acc-%' AND NOT a.id LIKE 'acc-%')
    OR (a.id NOT LIKE 'acc-%' AND b.id NOT LIKE 'acc-%' AND a.created_at < b.created_at)
    OR (a.id LIKE 'acc-%' AND b.id LIKE 'acc-%' AND a.ctid < b.ctid)
  );

-- ج) تطبيق قيد الفريد (UNIQUE CONSTRAINT) على مستوى الشركة ورقم الحساب
-- هذا القيد يمنع تكرار أي حساب لنفس الشركة في المستقبل نهائياً على مستوى قاعدة البيانات
ALTER TABLE public.chart_of_accounts 
DROP CONSTRAINT IF EXISTS uq_chart_of_accounts_company_code;

ALTER TABLE public.chart_of_accounts 
ADD CONSTRAINT uq_chart_of_accounts_company_code UNIQUE (company_id, code);

-- -----------------------------------------------------------------------------------------
-- 4. التأكد من الأرصدة الافتتاحية للجمعيات بتاريخ 2026-08-01 وتحديث الحسابات
-- -----------------------------------------------------------------------------------------
-- تحديث رصيد حساب الذمم المدينة (1120) ورأس المال/الأرصدة الافتتاحية (3100)
UPDATE public.chart_of_accounts
SET 
  balance = 21636.440,
  current_balance = 21636.440,
  updated_at = NOW()
WHERE code = '3100' AND (balance = 0 OR balance IS NULL);

-- توثيق انتهاء السكربت بنجاح
COMMIT;

SELECT 
  (SELECT COUNT(*) FROM public.chart_of_accounts) AS total_clean_accounts,
  (SELECT COUNT(*) FROM public.warehouses) AS total_warehouses,
  (SELECT COUNT(*) FROM public.sales_reps) AS total_sales_reps;
