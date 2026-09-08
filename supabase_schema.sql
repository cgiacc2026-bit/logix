-- ==============================================================================
-- LOGIX CLOUD ERP - PRODUCTION DATABASE RESTORATION SCRIPT
-- Run this directly in Supabase SQL Editor (Ctrl + Enter)
-- ==============================================================================

-- 1. تفعيل إضافات الأمان والتشفير
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. تصحيح أعمدة جدول الشركات وإضافة type و status
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'client';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS password_hash TEXT DEFAULT '';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS profile_data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.companies DROP CONSTRAINT IF EXISTS chk_companies_type;
ALTER TABLE public.companies ADD CONSTRAINT chk_companies_type CHECK (type IN ('system', 'demo', 'client'));

ALTER TABLE public.companies DROP CONSTRAINT IF EXISTS chk_companies_status;
ALTER TABLE public.companies ADD CONSTRAINT chk_companies_status CHECK (status IN ('active', 'suspended', 'pending'));

-- تحديث شركة الديمو الحالية بنوع demo وحالة active
UPDATE public.companies 
SET type = 'demo', status = 'active'
WHERE company_name ILIKE '%demo%' OR company_name ILIKE '%تجريبية%';

-- 3. إنشاء شركة النظام الرسمية (LOGIX)
DO $$
DECLARE
    v_sys_id UUID := '10000000-0000-0000-0000-000000000001'::uuid;
BEGIN
    IF EXISTS (SELECT 1 FROM public.companies WHERE id = v_sys_id OR owner_email = 'superadmin@logixerp.com') THEN
        UPDATE public.companies 
        SET company_name = 'شركة لوجيكس (LOGIX)',
            type = 'system',
            status = 'active',
            profile_data = jsonb_build_object('nameAr', 'شركة لوجيكس', 'nameEn', 'LOGIX System', 'type', 'system', 'isSystemCore', true)
        WHERE id = v_sys_id OR owner_email = 'superadmin@logixerp.com';
    ELSE
        INSERT INTO public.companies (id, company_name, owner_email, password_hash, type, status, profile_data)
        VALUES (
            v_sys_id,
            'شركة لوجيكس (LOGIX)',
            'superadmin@logixerp.com',
            crypt('1234', gen_salt('bf')),
            'system',
            'active',
            jsonb_build_object('nameAr', 'شركة لوجيكس', 'nameEn', 'LOGIX System', 'type', 'system', 'isSystemCore', true)
        );
    END IF;
END $$;

-- 4. إعادة إنشاء واسترجاع شركة "مطحنة الوليد المتحدة"
DO $$
DECLARE
    v_mill_id UUID := '20000000-0000-0000-0000-000000000001'::uuid;
BEGIN
    IF EXISTS (SELECT 1 FROM public.companies WHERE id = v_mill_id OR company_name ILIKE '%مطحنة الوليد%') THEN
        UPDATE public.companies 
        SET company_name = 'مطحنة الوليد المتحدة',
            owner_email = 'alwaleed.mill@logixerp.com',
            type = 'client',
            status = 'active',
            profile_data = jsonb_build_object(
                'nameAr', 'مطحنة الوليد المتحدة',
                'nameEn', 'Al-Waleed United Mill',
                'crNumber', '450912',
                'country', 'الكويت',
                'functionalCurrency', 'KWD',
                'vatRate', 0,
                'type', 'client'
            )
        WHERE id = v_mill_id OR company_name ILIKE '%مطحنة الوليد%';
    ELSE
        INSERT INTO public.companies (id, company_name, owner_email, password_hash, type, status, profile_data)
        VALUES (
            v_mill_id,
            'مطحنة الوليد المتحدة',
            'alwaleed.mill@logixerp.com',
            crypt('1234', gen_salt('bf')),
            'client',
            'active',
            jsonb_build_object(
                'nameAr', 'مطحنة الوليد المتحدة',
                'nameEn', 'Al-Waleed United Mill',
                'crNumber', '450912',
                'country', 'الكويت',
                'functionalCurrency', 'KWD',
                'vatRate', 0,
                'type', 'client'
            )
        );
    END IF;
END $$;

-- 5. جدول مستخدمي الشركات (company_users) وحسابات الشركات
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.company_users ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN DEFAULT false;
ALTER TABLE public.company_users ADD COLUMN IF NOT EXISTS pin_hash TEXT DEFAULT '';
ALTER TABLE public.company_users ADD COLUMN IF NOT EXISTS role_title_ar TEXT;
ALTER TABLE public.company_users ADD COLUMN IF NOT EXISTS full_name TEXT;

-- مستخدم السوبر أدمن لشركة النظام LOGIX
DELETE FROM public.company_users 
WHERE company_id = '10000000-0000-0000-0000-000000000001'::uuid AND username = 'cgiacc2026';

INSERT INTO public.company_users (company_id, username, email, full_name, role, role_title_ar, pin_hash, is_active, is_platform_admin)
VALUES (
    '10000000-0000-0000-0000-000000000001'::uuid,
    'cgiacc2026',
    'cgiacc2026@gmail.com',
    'المشرف العام (CGI Admin)',
    'SUPER_ADMIN',
    'المشرف العام والمالك - تعيين واعتماد الشركات السنوية',
    crypt('1234', gen_salt('bf')),
    true,
    true
);

-- مستخدمي مطحنة الوليد الثلاثة
DELETE FROM public.company_users 
WHERE company_id = '20000000-0000-0000-0000-000000000001'::uuid 
  AND username IN ('cgiacc2026', 'adein', 'chief_acc');

INSERT INTO public.company_users (company_id, username, email, full_name, role, role_title_ar, pin_hash, is_active, is_platform_admin)
VALUES 
(
    '20000000-0000-0000-0000-000000000001'::uuid,
    'cgiacc2026',
    'cgiacc2026@gmail.com',
    'المشرف العام (CGI Admin)',
    'ADMIN',
    'المشرف العام والمالك - تعيين واعتماد الشركات السنوية',
    crypt('1234', gen_salt('bf')),
    true,
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
    true,
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
    true,
    false
);

-- ربط أي أصناف أو حسابات يتيمة سابقة بمطحنة الوليد المتحدة
UPDATE public.items SET company_id = '20000000-0000-0000-0000-000000000001'::uuid WHERE company_id IS NULL;
UPDATE public.accounts SET company_id = '20000000-0000-0000-0000-000000000001'::uuid WHERE company_id IS NULL;
UPDATE public.customers SET company_id = '20000000-0000-0000-0000-000000000001'::uuid WHERE company_id IS NULL;
UPDATE public.suppliers SET company_id = '20000000-0000-0000-0000-000000000001'::uuid WHERE company_id IS NULL;
UPDATE public.journal_entries SET company_id = '20000000-0000-0000-0000-000000000001'::uuid WHERE company_id IS NULL;
UPDATE public.sales_master SET company_id = '20000000-0000-0000-0000-000000000001'::uuid WHERE company_id IS NULL;
UPDATE public.vouchers SET company_id = '20000000-0000-0000-0000-000000000001'::uuid WHERE company_id IS NULL;

-- 6. حل مشكلة تصفير البيانات وإعادة ضبط سياسات RLS بالكامل
DO $$
DECLARE
    r RECORD;
BEGIN
    -- حذف كل السياسات القديمة المعطلة على كل الجداول
    FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- تفعيل سياسات تسمح لتطبيق Next.js / Frontend بالقراءة والكتابة دون إرجاع مصفوفات فارغة
DO $$
DECLARE
    t text;
    tbls text[] := ARRAY[
        'companies', 'company_users', 'items', 'customers', 'suppliers', 
        'sales_master', 'sales_details', 'journal_entries', 'accounts', 
        'vouchers', 'units', 'production_orders'
    ];
BEGIN
    FOREACH t IN ARRAY tbls LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('CREATE POLICY "allow_all_%s" ON public.%I FOR ALL USING (true) WITH CHECK (true)', t, t);
    END LOOP;
END $$;

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- 7. إنشاء جدول النسخ الاحتياطية tenant_backups
CREATE TABLE IF NOT EXISTS public.tenant_backups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    snapshot_data JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.tenant_backups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_backups" ON public.tenant_backups;
CREATE POLICY "allow_all_backups" ON public.tenant_backups FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON TABLE public.tenant_backups TO anon, authenticated, service_role;

-- 8. إنشاء جدول سجل التدقيق audit_log
CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id TEXT NOT NULL,
    target_company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_audit" ON public.audit_log;
CREATE POLICY "allow_all_audit" ON public.audit_log FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON TABLE public.audit_log TO anon, authenticated, service_role;

-- تفعيل Trigger التوثيق التلقائي
CREATE OR REPLACE FUNCTION public.log_company_status_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
        INSERT INTO public.audit_log (actor_user_id, target_company_id, action, details)
        VALUES (
            'SYSTEM_TRIGGER',
            NEW.id,
            'STATUS_CHANGE_' || UPPER(NEW.status),
            jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status, 'company_name', NEW.company_name)
        );
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO public.audit_log (actor_user_id, target_company_id, action, details)
        VALUES (
            'SYSTEM_TRIGGER',
            OLD.id,
            'COMPANY_DELETED',
            jsonb_build_object('deleted_company_name', OLD.company_name, 'owner_email', OLD.owner_email)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_company_status ON public.companies;
CREATE TRIGGER trg_audit_company_status
AFTER UPDATE OR DELETE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.log_company_status_changes();
