-- ==============================================================================
-- LOGIX CLOUD ERP - PRODUCTION DATABASE RESTORATION & SCHEMA SCRIPT
-- Project: gzoncsbxfdnfellspgke
-- Run in Supabase Dashboard SQL Editor (Ctrl + Enter)
-- ==============================================================================

-- 0. Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1) إصلاح بنية جدول companies
-- ==============================================================================
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'client';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS login_code TEXT UNIQUE;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_companies_type') THEN
        ALTER TABLE public.companies ADD CONSTRAINT chk_companies_type CHECK (type IN ('system','demo','client'));
    END IF;
END $$;

-- ==============================================================================
-- 2) تحديث شركة الديمو الموجودة (UPDATE أو INSERT إذا لم تكن موجودة)
-- ==============================================================================
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
        'tradeName', 'شركة تجريبية للحلول السحابية (نسخة العرض الحي)',
        'type', 'demo',
        'isDemo', true
    )
)
ON CONFLICT (id) DO UPDATE
SET type = 'demo', 
    login_code = 'demo', 
    owner_email = 'logixdemo@logix.com',
    password_hash = crypt('P0182671648n$', gen_salt('bf')),
    status = 'active';

UPDATE public.companies
SET type = 'demo', 
    login_code = 'demo', 
    owner_email = 'logixdemo@logix.com',
    password_hash = crypt('P0182671648n$', gen_salt('bf'))
WHERE id = '00000000-0000-0000-0000-000000000099';

-- ==============================================================================
-- 3) إنشاء جدول company_users بعمود pin_hash مشفّر
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

-- ==============================================================================
-- 4) إنشاء شركة LOGIX الرسمية وربط cgiacc2026 كـ platform admin
-- ==============================================================================
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

-- ==============================================================================
-- 5) إنشاء شركة مطحنة الوليد المتحدة وحساباتها الثلاثة (بيانات دقيقة من defaultData.ts)
-- ==============================================================================
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
        'streetName', 'شارع الغزالي',
        'buildingNo', 'قسيمة 42',
        'address', 'الري الصناعية، شارع الغزالي، الكويت',
        'phone', '+965 2484 1888',
        'mobile', '+965 9988 7766',
        'email', 'cgiacc2026@gmail.com',
        'website', 'https://alwaleedmill.com',
        'functionalCurrency', 'KWD',
        'currency', 'KWD',
        'currency_decimals', 3,
        'decimalPlaces', 3,
        'accountingBasis', 'ACCRUAL',
        'inventoryCosting', 'WEIGHTED_AVERAGE',
        'depreciationMethod', 'STRAIGHT_LINE',
        'vatRate', 0,
        'vatType', 'NONE',
        'taxNumber', '',
        'headerNotes', 'مستند تجاري ومالي رسمي معتمد • مطحنة الوليد المتحدة • دولة الكويت',
        'footerNotes', 'الدفع خلال 30 يوماً من تاريخ استلام الفاتورة • خاضع للقوانين التجارية بدولة الكويت.',
        'showDigitalStamp', true
    )
)
ON CONFLICT (id) DO UPDATE
SET type = 'client', login_code = '450912', status = 'active';

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
),
(
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
-- 7) جداول النسخ الاحتياطية وسجل التدقيق (tenant_backups & audit_log)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.tenant_backups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    snapshot_data JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id TEXT NOT NULL,
    target_company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
