-- ==============================================================================
-- محرك التصنيع والإنتاج الشامل لكافة الصناعات (Universal Multi-Industry Manufacturing)
-- سكريبت التحديث الآمن والفهارس وقواعد عزل الشركات (Multi-Tenancy & Safe Migration)
-- Safe Migration, Performance Indexes & Multi-Tenant Architecture
-- ==============================================================================
-- تنبيه الأمان والحماية التامة:
-- هذا السكريبت خالٍ تماماً وحرفياً من أي أوامر حذف (حظر تام لـ DROP TABLE أو TRUNCATE أو DELETE).
-- تم تصميمه حصرياً باستخدام:
-- CREATE TABLE IF NOT EXISTS
-- ALTER TABLE ... ADD COLUMN IF NOT EXISTS
-- CREATE INDEX IF NOT EXISTS
-- لحماية كافة البيانات التاريخية والمالية والمخزنية لجميع الشركات في النظام.
-- ==============================================================================

-- 1. جدول أوامر التشغيل والتصنيع الشامل (Universal Production Orders)
CREATE TABLE IF NOT EXISTS production_orders (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    order_number TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    target_item_id TEXT NOT NULL,
    target_item_name_ar TEXT NOT NULL,
    target_sku TEXT DEFAULT '',
    target_quantity NUMERIC NOT NULL DEFAULT 1,
    target_unit TEXT DEFAULT 'حبة',
    raw_materials JSONB DEFAULT '[]'::jsonb,
    overhead_cost NUMERIC DEFAULT 0,
    total_production_cost NUMERIC DEFAULT 0,
    unit_production_cost NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'COMPLETED',
    notes TEXT DEFAULT '',
    mill_line TEXT DEFAULT 'خط الإنتاج الرئيسي',
    production_line_id TEXT,
    production_line_name_ar TEXT,
    industry_type TEXT DEFAULT 'GENERAL_ASSEMBLY',
    category_group TEXT,
    operator_name TEXT,
    journal_entry_id TEXT,
    scrap_quantity NUMERIC DEFAULT 0,
    scrap_percentage NUMERIC DEFAULT 0,
    scrap_reason TEXT,
    by_products JSONB DEFAULT '[]'::jsonb,
    quality_inspection JSONB,
    routing_steps JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ضمان وجود أي أعمدة قد تكون مفقودة في حال وجود الجدول مسبقاً (Safe Column Additions)
ALTER TABLE IF EXISTS production_orders
    ADD COLUMN IF NOT EXISTS company_id TEXT,
    ADD COLUMN IF NOT EXISTS order_number TEXT,
    ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE,
    ADD COLUMN IF NOT EXISTS target_item_id TEXT,
    ADD COLUMN IF NOT EXISTS target_item_name_ar TEXT,
    ADD COLUMN IF NOT EXISTS target_sku TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS target_quantity NUMERIC DEFAULT 1,
    ADD COLUMN IF NOT EXISTS target_unit TEXT DEFAULT 'حبة',
    ADD COLUMN IF NOT EXISTS raw_materials JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS overhead_cost NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_production_cost NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS unit_production_cost NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'COMPLETED',
    ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS mill_line TEXT DEFAULT 'خط الإنتاج الرئيسي',
    ADD COLUMN IF NOT EXISTS production_line_id TEXT,
    ADD COLUMN IF NOT EXISTS production_line_name_ar TEXT,
    ADD COLUMN IF NOT EXISTS industry_type TEXT DEFAULT 'GENERAL_ASSEMBLY',
    ADD COLUMN IF NOT EXISTS category_group TEXT,
    ADD COLUMN IF NOT EXISTS operator_name TEXT,
    ADD COLUMN IF NOT EXISTS journal_entry_id TEXT,
    ADD COLUMN IF NOT EXISTS scrap_quantity NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS scrap_percentage NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS scrap_reason TEXT,
    ADD COLUMN IF NOT EXISTS by_products JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS quality_inspection JSONB,
    ADD COLUMN IF NOT EXISTS routing_steps JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. جدول إعدادات ومجموعات التصنيع القياسية للشركات (Standardized Manufacturing Settings)
CREATE TABLE IF NOT EXISTS manufacturing_settings (
    company_id TEXT PRIMARY KEY,
    industry_type TEXT DEFAULT 'GENERAL_ASSEMBLY',
    standard_categories JSONB DEFAULT '[]'::jsonb,
    standard_lines JSONB DEFAULT '[]'::jsonb,
    standard_workstations JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ضمان وجود الأعمدة في جدول إعدادات التصنيع
ALTER TABLE IF EXISTS manufacturing_settings
    ADD COLUMN IF NOT EXISTS company_id TEXT,
    ADD COLUMN IF NOT EXISTS industry_type TEXT DEFAULT 'GENERAL_ASSEMBLY',
    ADD COLUMN IF NOT EXISTS standard_categories JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS standard_lines JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS standard_workstations JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 3. فهارس السرعة والأداء والعزل التام للشركات (Safe Performance & Multi-Tenant Indexes)
CREATE INDEX IF NOT EXISTS idx_production_orders_company_id ON production_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_production_orders_date ON production_orders(company_id, date);
CREATE INDEX IF NOT EXISTS idx_production_orders_status ON production_orders(company_id, status);
CREATE INDEX IF NOT EXISTS idx_production_orders_number ON production_orders(company_id, order_number);
CREATE INDEX IF NOT EXISTS idx_production_orders_target_item ON production_orders(company_id, target_item_id);
CREATE INDEX IF NOT EXISTS idx_mfg_settings_company_id ON manufacturing_settings(company_id);
