-- ==============================================================================
-- LOGIX ERP (IFRS) - سكريبت SQL الآمن والمصحح بالكامل لإنشاء الجداول وحماية التاريخ
-- ==============================================================================
-- تم حل الخطأ 42703 (column "customer_id" does not exist) بالكامل:
-- 1. جدول payment_vouchers القائم يعتمد على entity_id و entity_type.
--    تمت إضافة الأعمدة التكميلية عبر ADD COLUMN IF NOT EXISTS بأمان تام قبل الفهارس.
-- 2. دالة التريجر تفحص OLD.id مباشرة عبر جدول الحماية التقني protected_legacy_records
--    دون الاعتماد على أعمدة قد لا تكون موجودة في بعض الجداول.
-- 3. لا حذف ولا تعديل على أي بيانات سابقة.
-- ==============================================================================

-- تفعيل الامتدادات الضرورية
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. جدول الحماية التقني الخارجي للسجلات التاريخية (Protected Legacy Records)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS protected_legacy_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(100) NOT NULL,
    record_id VARCHAR(100) NOT NULL,
    company_id UUID,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_protected_legacy_record UNIQUE (table_name, record_id)
);

CREATE INDEX IF NOT EXISTS idx_protected_legacy_lookup 
ON protected_legacy_records (table_name, record_id);

-- ==============================================================================
-- 2. توثيق السجلات التاريخية القائمة قبل تاريخ القطع داخل جدول الحماية
-- (إدراج إحصائي تقني فقط دون أي تعديل على الجداول الأصلية)
-- ==============================================================================
DO $$
BEGIN
    -- توثيق الفواتير التاريخية
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'invoices') THEN
        INSERT INTO protected_legacy_records (table_name, record_id, company_id, captured_at)
        SELECT 
            'invoices',
            id::text,
            company_id,
            COALESCE(created_at, '2026-10-05 00:00:00+00'::timestamptz)
        FROM invoices
        WHERE created_at < '2026-10-05 00:00:00+00'::timestamptz
           OR created_at IS NULL
        ON CONFLICT (table_name, record_id) DO NOTHING;
    END IF;

    -- توثيق قيود اليومية التاريخية
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'journal_entries') THEN
        INSERT INTO protected_legacy_records (table_name, record_id, company_id, captured_at)
        SELECT 
            'journal_entries',
            id::text,
            company_id,
            COALESCE(created_at, '2026-10-05 00:00:00+00'::timestamptz)
        FROM journal_entries
        WHERE created_at < '2026-10-05 00:00:00+00'::timestamptz
           OR created_at IS NULL
        ON CONFLICT (table_name, record_id) DO NOTHING;
    END IF;

    -- توثيق الحسابات في دليل الحسابات
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'chart_of_accounts') THEN
        INSERT INTO protected_legacy_records (table_name, record_id, company_id, captured_at)
        SELECT 
            'chart_of_accounts',
            id::text,
            company_id,
            '2026-10-05 00:00:00+00'::timestamptz
        FROM chart_of_accounts
        ON CONFLICT (table_name, record_id) DO NOTHING;
    END IF;

    -- توثيق العملاء القدامى
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customers') THEN
        INSERT INTO protected_legacy_records (table_name, record_id, company_id, captured_at)
        SELECT 
            'customers',
            id::text,
            company_id,
            COALESCE(created_at, '2026-10-05 00:00:00+00'::timestamptz)
        FROM customers
        WHERE created_at < '2026-10-05 00:00:00+00'::timestamptz
           OR created_at IS NULL
        ON CONFLICT (table_name, record_id) DO NOTHING;
    END IF;

    -- توثيق الموردين القدامى
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'suppliers') THEN
        INSERT INTO protected_legacy_records (table_name, record_id, company_id, captured_at)
        SELECT 
            'suppliers',
            id::text,
            company_id,
            COALESCE(created_at, '2026-10-05 00:00:00+00'::timestamptz)
        FROM suppliers
        WHERE created_at < '2026-10-05 00:00:00+00'::timestamptz
           OR created_at IS NULL
        ON CONFLICT (table_name, record_id) DO NOTHING;
    END IF;

    -- توثيق الأصناف المخزنية القديمة
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'items') THEN
        INSERT INTO protected_legacy_records (table_name, record_id, company_id, captured_at)
        SELECT 
            'items',
            id::text,
            company_id,
            COALESCE(created_at, '2026-10-05 00:00:00+00'::timestamptz)
        FROM items
        WHERE created_at < '2026-10-05 00:00:00+00'::timestamptz
           OR created_at IS NULL
        ON CONFLICT (table_name, record_id) DO NOTHING;
    END IF;
END $$;

-- ==============================================================================
-- 3. تفعيل سياج الأمان المحاسبي لمنع أي تعديل أو حذف للتاريخ
-- ==============================================================================
CREATE OR REPLACE FUNCTION prevent_historical_record_mutation()
RETURNS TRIGGER AS $$
DECLARE
    is_protected BOOLEAN := FALSE;
    target_table TEXT := TG_TABLE_NAME;
    rec_id TEXT;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        rec_id := OLD.id::text;
    ELSE
        rec_id := OLD.id::text;
    END IF;

    -- الفحص المباشر عبر جدول الحماية التقني
    SELECT EXISTS (
        SELECT 1 FROM protected_legacy_records 
        WHERE table_name = target_table 
          AND record_id = rec_id
    ) INTO is_protected;

    -- الرفض الصارم وإلغاء المعاملة فوراً
    IF is_protected THEN
        RAISE EXCEPTION 'هذا سجل تاريخي محمي قبل تاريخ تحديث النظام ولا يمكن تعديله أو حذفه.';
    END IF;

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ربط التريجر بالجداول الرئيسية (BEFORE UPDATE OR DELETE)
DO $$
BEGIN
    -- invoices
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'invoices') THEN
        DROP TRIGGER IF EXISTS trg_protect_historical_invoices ON invoices;
        CREATE TRIGGER trg_protect_historical_invoices
        BEFORE UPDATE OR DELETE ON invoices
        FOR EACH ROW EXECUTE FUNCTION prevent_historical_record_mutation();
    END IF;

    -- journal_entries
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'journal_entries') THEN
        DROP TRIGGER IF EXISTS trg_protect_historical_journal_entries ON journal_entries;
        CREATE TRIGGER trg_protect_historical_journal_entries
        BEFORE UPDATE OR DELETE ON journal_entries
        FOR EACH ROW EXECUTE FUNCTION prevent_historical_record_mutation();
    END IF;

    -- chart_of_accounts
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'chart_of_accounts') THEN
        DROP TRIGGER IF EXISTS trg_protect_historical_chart_of_accounts ON chart_of_accounts;
        CREATE TRIGGER trg_protect_historical_chart_of_accounts
        BEFORE UPDATE OR DELETE ON chart_of_accounts
        FOR EACH ROW EXECUTE FUNCTION prevent_historical_record_mutation();
    END IF;

    -- customers
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customers') THEN
        DROP TRIGGER IF EXISTS trg_protect_historical_customers ON customers;
        CREATE TRIGGER trg_protect_historical_customers
        BEFORE UPDATE OR DELETE ON customers
        FOR EACH ROW EXECUTE FUNCTION prevent_historical_record_mutation();
    END IF;

    -- suppliers
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'suppliers') THEN
        DROP TRIGGER IF EXISTS trg_protect_historical_suppliers ON suppliers;
        CREATE TRIGGER trg_protect_historical_suppliers
        BEFORE UPDATE OR DELETE ON suppliers
        FOR EACH ROW EXECUTE FUNCTION prevent_historical_record_mutation();
    END IF;

    -- items
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'items') THEN
        DROP TRIGGER IF EXISTS trg_protect_historical_items ON items;
        CREATE TRIGGER trg_protect_historical_items
        BEFORE UPDATE OR DELETE ON items
        FOR EACH ROW EXECUTE FUNCTION prevent_historical_record_mutation();
    END IF;
END $$;

-- ==============================================================================
-- 4. ترقية الجداول القائمة بأمان تام دون المساس ببياناتها
-- ==============================================================================

-- ترقية جدول سندات القبض والصرف بأمان تام بإضافة الأعمدة الاختيارية إن لم تكن موجودة
CREATE TABLE IF NOT EXISTS payment_vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    voucher_number VARCHAR(50) NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'RECEIPT',
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount NUMERIC(15, 4) NOT NULL DEFAULT 0,
    payment_method VARCHAR(30) NOT NULL DEFAULT 'CASH',
    account_id VARCHAR(100),
    entity_type VARCHAR(20) NOT NULL DEFAULT 'CUSTOMER',
    entity_id VARCHAR(100),
    notes TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'POSTED',
    raw_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- إضافة أي أعمدة تكميلية قد يحتاجها النظام مستقبلاً دون التأثير على البيانات الحالية
ALTER TABLE payment_vouchers ADD COLUMN IF NOT EXISTS customer_id UUID;
ALTER TABLE payment_vouchers ADD COLUMN IF NOT EXISTS supplier_id UUID;
ALTER TABLE payment_vouchers ADD COLUMN IF NOT EXISTS invoice_id UUID;
ALTER TABLE payment_vouchers ADD COLUMN IF NOT EXISTS bank_account_id VARCHAR(100);
ALTER TABLE payment_vouchers ADD COLUMN IF NOT EXISTS reference VARCHAR(100);
ALTER TABLE payment_vouchers ADD COLUMN IF NOT EXISTS journal_entry_id UUID;

-- فهارس جدول السندات
CREATE INDEX IF NOT EXISTS idx_payment_vouchers_company ON payment_vouchers (company_id);
CREATE INDEX IF NOT EXISTS idx_payment_vouchers_date ON payment_vouchers (company_id, date);
CREATE INDEX IF NOT EXISTS idx_payment_vouchers_entity ON payment_vouchers (company_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_payment_vouchers_account ON payment_vouchers (company_id, account_id);

-- ترقية جدول سطور قيود اليومية بأمان تام
CREATE TABLE IF NOT EXISTS journal_entry_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    company_id UUID NOT NULL,
    account_id VARCHAR(100) NOT NULL,
    account_code VARCHAR(50),
    debit NUMERIC(15, 4) NOT NULL DEFAULT 0,
    credit NUMERIC(15, 4) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS account_name VARCHAR(255);
ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS cost_center_id VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_jel_entry_id ON journal_entry_lines (journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_jel_account ON journal_entry_lines (company_id, account_id);
CREATE INDEX IF NOT EXISTS idx_jel_account_code ON journal_entry_lines (company_id, account_code);

-- ==============================================================================
-- 5. إنشاء الجداول الجديدة غير الموجودة (فقط IF NOT EXISTS)
-- ==============================================================================

-- جدول حركات المخزون (Inventory Transactions)
CREATE TABLE IF NOT EXISTS inventory_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    item_id UUID NOT NULL,
    warehouse_id UUID,
    transaction_type VARCHAR(30) NOT NULL,
    quantity NUMERIC(15, 4) NOT NULL,
    unit_cost NUMERIC(15, 4) NOT NULL DEFAULT 0,
    total_cost NUMERIC(15, 4) NOT NULL DEFAULT 0,
    reference_type VARCHAR(50),
    reference_id UUID,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_inv_tx_item ON inventory_transactions (company_id, item_id);
CREATE INDEX IF NOT EXISTS idx_inv_tx_warehouse ON inventory_transactions (company_id, warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inv_tx_ref ON inventory_transactions (company_id, reference_type, reference_id);

-- جدول قوائم الأسعار (Price Lists & Price List Items)
CREATE TABLE IF NOT EXISTS price_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    currency VARCHAR(10) DEFAULT 'KWD',
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_price_lists_company_code UNIQUE (company_id, code)
);

CREATE TABLE IF NOT EXISTS price_list_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    price_list_id UUID NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
    item_id UUID NOT NULL,
    price NUMERIC(15, 4) NOT NULL DEFAULT 0,
    discount_percentage NUMERIC(5, 2) DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_price_list_item UNIQUE (price_list_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_price_list_items_lookup ON price_list_items (company_id, price_list_id, item_id);

-- جدول أقفال وتفضيلات النظام (System Locks)
CREATE TABLE IF NOT EXISTS system_locks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    lock_type VARCHAR(50) NOT NULL,
    lock_date DATE NOT NULL,
    is_locked BOOLEAN NOT NULL DEFAULT true,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_system_locks UNIQUE (company_id, lock_type)
);

-- ==============================================================================
-- 6. سياسات الأمان RLS وصلاحيات الوصول
-- ==============================================================================
ALTER TABLE IF EXISTS payment_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS journal_entry_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS price_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS price_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS system_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS protected_legacy_records ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY[
        'payment_vouchers',
        'journal_entry_lines',
        'inventory_transactions',
        'price_lists',
        'price_list_items',
        'system_locks',
        'protected_legacy_records'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Allow authenticated and service access" ON %I;', tbl);
        EXECUTE format('CREATE POLICY "Allow authenticated and service access" ON %I FOR ALL USING (true) WITH CHECK (true);', tbl);
    END LOOP;
END $$;

GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon, service_role;
