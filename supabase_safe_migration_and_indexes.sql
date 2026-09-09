-- ==============================================================================
-- سكريبت التحديث الآمن والفهارس وقواعد عزل الشركات (Multi-Tenancy & Safe Indexes)
-- Safe Migration, Performance Indexes & Multi-Tenant Architecture
-- ==============================================================================
-- تنبيه الأمان والحماية التامة:
-- هذا السكريبت خالٍ تماماً وحرفياً من أي أوامر حذف (لا يوجد DROP TABLE أو TRUNCATE أو DELETE).
-- تم تصميمه حصرياً باستخدام CREATE TABLE IF NOT EXISTS و ALTER TABLE ... ADD COLUMN IF NOT EXISTS
-- و CREATE INDEX IF NOT EXISTS للحفاظ التام على البيانات التاريخية لجميع الشركات والعملاء والفواتير.
-- ==============================================================================

-- 1. التأكد من وجود الأعمدة الأساسية للشركة (Companies Table Safe Extension)
ALTER TABLE IF EXISTS companies 
    ADD COLUMN IF NOT EXISTS cash_account_id TEXT,
    ADD COLUMN IF NOT EXISTS bank_account_id TEXT,
    ADD COLUMN IF NOT EXISTS inventory_account_id TEXT,
    ADD COLUMN IF NOT EXISTS pnl_account_id TEXT,
    ADD COLUMN IF NOT EXISTS company_logo TEXT;

-- 2. التأكد من وجود الأعمدة الإضافية في جدول الأصناف والعملاء لضمان مطابقة الفهارس
ALTER TABLE IF EXISTS items
    ADD COLUMN IF NOT EXISTS item_name TEXT,
    ADD COLUMN IF NOT EXISTS name TEXT;

ALTER TABLE IF EXISTS customers
    ADD COLUMN IF NOT EXISTS name TEXT;

-- تحديث آمن للأسماء في حال كانت فارغة دون حذف أي سجلات
UPDATE items SET item_name = COALESCE(name_ar, name, 'صنف') WHERE item_name IS NULL;
UPDATE customers SET name = COALESCE(name_ar, 'عميل') WHERE name IS NULL;

-- 3. التأكد من سلامة جداول الحركات والربط المعماري (Multi-Tenant Schema)
CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    invoice_number TEXT,
    invoice_type TEXT DEFAULT 'SALES',
    customer_id TEXT,
    total_amount NUMERIC DEFAULT 0,
    items JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ضبط وتأكيد أعمدة جدول invoices الإضافية لدعم التوافقية الكاملة
ALTER TABLE IF EXISTS invoices 
    ADD COLUMN IF NOT EXISTS invoice_type TEXT DEFAULT 'SALES',
    ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS total_amount NUMERIC DEFAULT 0;

CREATE TABLE IF NOT EXISTS vouchers (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    voucher_type TEXT,
    amount NUMERIC DEFAULT 0,
    account_id TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ضبط وتأكيد أعمدة جدول vouchers الإضافية
ALTER TABLE IF EXISTS vouchers
    ADD COLUMN IF NOT EXISTS voucher_type TEXT,
    ADD COLUMN IF NOT EXISTS amount NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS account_id TEXT,
    ADD COLUMN IF NOT EXISTS description TEXT;

-- 4. إنشاء فهارس سريعة للبحث النصي وتحسين الأداء (Speed & Text Search Indexes)
CREATE INDEX IF NOT EXISTS idx_items_company_id ON items(company_id);
CREATE INDEX IF NOT EXISTS idx_customers_company_id ON customers(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_company_id ON invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_company_id ON vouchers(company_id);
CREATE INDEX IF NOT EXISTS idx_items_name_search ON items(company_id, item_name);
CREATE INDEX IF NOT EXISTS idx_customers_name_search ON customers(company_id, name);

-- فهارس إضافية للباركود ورقم الفاتورة ورقم السند
CREATE INDEX IF NOT EXISTS idx_items_sku_barcode ON items(company_id, code);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(company_id, invoice_number);
