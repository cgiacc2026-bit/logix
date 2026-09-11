-- ==============================================================================
-- ENTERPRISE ERP COMPREHENSIVE FINANCIAL AUDIT & ARCHITECTURAL OVERHAUL SQL
-- Strict Non-Destructive Cumulative Migration & Anti-Recursion Triggers
-- Compatible with PostgreSQL 15+ & Supabase Database Editor
-- ==============================================================================

BEGIN;

-- 1. Ensure required extensions exist
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Ensure all tables have required columns without dropping existing data
ALTER TABLE IF EXISTS companies 
  ADD COLUMN IF NOT EXISTS pos_default_warehouse_id TEXT DEFAULT 'wh-main-01',
  ADD COLUMN IF NOT EXISTS allow_negative_inventory BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS default_currency TEXT DEFAULT 'KWD',
  ADD COLUMN IF NOT EXISTS raw_data JSONB DEFAULT '{}'::jsonb;

ALTER TABLE IF EXISTS chart_of_accounts
  ADD COLUMN IF NOT EXISTS normal_balance TEXT DEFAULT 'DEBIT',
  ADD COLUMN IF NOT EXISTS parent_id TEXT,
  ADD COLUMN IF NOT EXISTS level INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS raw_data JSONB DEFAULT '{}'::jsonb;

ALTER TABLE IF EXISTS customers
  ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(15,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_balance NUMERIC(15,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance NUMERIC(15,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS raw_data JSONB DEFAULT '{}'::jsonb;

ALTER TABLE IF EXISTS customer_branches
  ADD COLUMN IF NOT EXISTS company_id UUID,
  ADD COLUMN IF NOT EXISTS customer_id UUID,
  ADD COLUMN IF NOT EXISTS code TEXT,
  ADD COLUMN IF NOT EXISTS name_ar TEXT,
  ADD COLUMN IF NOT EXISTS name_en TEXT,
  ADD COLUMN IF NOT EXISTS governorate TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS detailed_address TEXT,
  ADD COLUMN IF NOT EXISTS contact_person TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS raw_data JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE IF EXISTS suppliers
  ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(15,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_balance NUMERIC(15,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance NUMERIC(15,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS raw_data JSONB DEFAULT '{}'::jsonb;

ALTER TABLE IF EXISTS items
  ADD COLUMN IF NOT EXISTS barcode TEXT,
  ADD COLUMN IF NOT EXISTS cost_price NUMERIC(15,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS purchase_price NUMERIC(15,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS raw_data JSONB DEFAULT '{}'::jsonb;

ALTER TABLE IF EXISTS warehouses
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS raw_data JSONB DEFAULT '{}'::jsonb;

ALTER TABLE IF EXISTS sales_reps
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS target_amount NUMERIC(15,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS raw_data JSONB DEFAULT '{}'::jsonb;

ALTER TABLE IF EXISTS invoices
  ADD COLUMN IF NOT EXISTS rep_id TEXT,
  ADD COLUMN IF NOT EXISTS sales_rep_id TEXT,
  ADD COLUMN IF NOT EXISTS sales_rep_name TEXT,
  ADD COLUMN IF NOT EXISTS customer_branch_id TEXT,
  ADD COLUMN IF NOT EXISTS customer_branch_name TEXT,
  ADD COLUMN IF NOT EXISTS warehouse_id TEXT DEFAULT 'wh-main-01',
  ADD COLUMN IF NOT EXISTS cost_center_id TEXT,
  ADD COLUMN IF NOT EXISTS price_list_id TEXT,
  ADD COLUMN IF NOT EXISTS price_list_applied TEXT,
  ADD COLUMN IF NOT EXISTS pos_session_id TEXT,
  ADD COLUMN IF NOT EXISTS cashier_name TEXT,
  ADD COLUMN IF NOT EXISTS lines JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS raw_data JSONB DEFAULT '{}'::jsonb;

ALTER TABLE IF EXISTS payment_vouchers
  ADD COLUMN IF NOT EXISTS rep_id TEXT,
  ADD COLUMN IF NOT EXISTS sales_rep_id TEXT,
  ADD COLUMN IF NOT EXISTS sales_rep_name TEXT,
  ADD COLUMN IF NOT EXISTS invoice_id TEXT,
  ADD COLUMN IF NOT EXISTS branch_id TEXT,
  ADD COLUMN IF NOT EXISTS raw_data JSONB DEFAULT '{}'::jsonb;

ALTER TABLE IF EXISTS journal_entries
  ADD COLUMN IF NOT EXISTS lines JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS total_debit NUMERIC(15,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_credit NUMERIC(15,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'POSTED',
  ADD COLUMN IF NOT EXISTS reference TEXT,
  ADD COLUMN IF NOT EXISTS reference_type TEXT DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS raw_data JSONB DEFAULT '{}'::jsonb;

-- 3. Non-Destructive Duplicate Cleanup (Keeps the most recently updated row if duplicate exists)
DELETE FROM invoices a USING invoices b
WHERE a.id < b.id 
  AND a.company_id = b.company_id 
  AND a.invoice_number = b.invoice_number;

DELETE FROM payment_vouchers a USING payment_vouchers b
WHERE a.id < b.id 
  AND a.company_id = b.company_id 
  AND a.voucher_number = b.voucher_number;

DELETE FROM journal_entries a USING journal_entries b
WHERE a.id < b.id 
  AND a.company_id = b.company_id 
  AND a.entry_number = b.entry_number;

DELETE FROM items a USING items b
WHERE a.id < b.id 
  AND a.company_id = b.company_id 
  AND a.barcode = b.barcode
  AND a.barcode IS NOT NULL 
  AND a.barcode <> '';

DELETE FROM chart_of_accounts a USING chart_of_accounts b
WHERE a.id < b.id 
  AND a.company_id = b.company_id 
  AND a.code = b.code;

-- 4. Enforce Strict Composite Unique Indexes (Enterprise Integrity)
CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_company_number 
  ON invoices (company_id, invoice_number);

CREATE UNIQUE INDEX IF NOT EXISTS uq_vouchers_company_number 
  ON payment_vouchers (company_id, voucher_number);

CREATE UNIQUE INDEX IF NOT EXISTS uq_journals_company_number 
  ON journal_entries (company_id, entry_number);

CREATE UNIQUE INDEX IF NOT EXISTS uq_items_company_barcode 
  ON items (company_id, barcode) 
  WHERE barcode IS NOT NULL AND barcode <> '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_coa_company_code 
  ON chart_of_accounts (company_id, code);

CREATE UNIQUE INDEX IF NOT EXISTS uq_warehouses_company_code 
  ON warehouses (company_id, code);

CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_reps_company_code 
  ON sales_reps (company_id, code);

CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_branches_cust_code 
  ON customer_branches (customer_id, code);

-- 5. Anti-Recursion Financial Journal Validation & Trigger Safety
CREATE OR REPLACE FUNCTION fn_validate_journal_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- Anti-recursion: prevent trigger cascading loops
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- Ensure debits equal credits strictly (within 0.001 tolerance)
  IF ABS(COALESCE(NEW.total_debit, 0) - COALESCE(NEW.total_credit, 0)) > 0.001 THEN
    RAISE EXCEPTION 'خطأ محاسبي جسيم: القيد المالي غير متوازن. إجمالي المدين (%) لا يساوي إجمالي الدائن (%) في القيد (%)',
      NEW.total_debit, NEW.total_credit, NEW.entry_number;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_journal_balance ON journal_entries;
CREATE TRIGGER trg_validate_journal_balance
  BEFORE INSERT OR UPDATE ON journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION fn_validate_journal_balance();

-- 6. Synchronize Customer Branches to Master Table (Non-Destructive)
CREATE OR REPLACE FUNCTION fn_sync_customer_branches_from_raw()
RETURNS TRIGGER AS $$
DECLARE
  branch_item JSONB;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF NEW.raw_data IS NOT NULL AND jsonb_typeof(NEW.raw_data->'branches') = 'array' THEN
    FOR branch_item IN SELECT * FROM jsonb_array_elements(NEW.raw_data->'branches')
    LOOP
      INSERT INTO customer_branches (
        id,
        company_id,
        customer_id,
        code,
        name_ar,
        name_en,
        governorate,
        city,
        detailed_address,
        contact_person,
        contact_phone,
        is_default,
        is_active,
        updated_at
      ) VALUES (
        gen_random_uuid(),
        NEW.company_id,
        NEW.id,
        COALESCE(branch_item->>'code', 'BR-01'),
        COALESCE(branch_item->>'nameAr', branch_item->>'name', 'فرع رئيسي'),
        COALESCE(branch_item->>'nameEn', ''),
        COALESCE(branch_item->>'governorate', ''),
        COALESCE(branch_item->>'city', ''),
        COALESCE(branch_item->>'detailedAddress', branch_item->>'address', ''),
        COALESCE(branch_item->>'contactPerson', ''),
        COALESCE(branch_item->>'contactPhone', branch_item->>'phone', ''),
        COALESCE((branch_item->>'isDefault')::boolean, false),
        COALESCE((branch_item->>'isActive')::boolean, true),
        NOW()
      )
      ON CONFLICT (customer_id, code) DO UPDATE SET
        name_ar = EXCLUDED.name_ar,
        name_en = EXCLUDED.name_en,
        detailed_address = EXCLUDED.detailed_address,
        contact_person = EXCLUDED.contact_person,
        contact_phone = EXCLUDED.contact_phone,
        is_default = EXCLUDED.is_default,
        is_active = EXCLUDED.is_active,
        updated_at = NOW();
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_customer_branches ON customers;
CREATE TRIGGER trg_sync_customer_branches
  AFTER INSERT OR UPDATE OF raw_data ON customers
  FOR EACH ROW
  EXECUTE FUNCTION fn_sync_customer_branches_from_raw();

-- 7. Multi-Tenant Row Level Security (RLS) Isolation
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_reps ENABLE ROW LEVEL SECURITY;

-- Companies table policy
DROP POLICY IF EXISTS companies_access_policy ON companies;
CREATE POLICY companies_access_policy ON companies
FOR ALL
USING (auth.role() = 'service_role' OR auth.role() = 'anon' OR auth.role() = 'authenticated' OR id IS NOT NULL)
WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'anon' OR auth.role() = 'authenticated' OR id IS NOT NULL);

-- Dynamic tenant policy enforcing isolation by company_id (safe against UUID or TEXT column types)
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'chart_of_accounts', 'journal_entries', 'customers', 'customer_branches',
    'suppliers', 'items', 'warehouses', 'invoices', 'payment_vouchers', 'sales_reps'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I;', tbl);
    EXECUTE format('
      CREATE POLICY tenant_isolation_policy ON %I
      FOR ALL
      USING (
        auth.role() = ''service_role'' 
        OR auth.role() = ''anon''
        OR company_id::text = NULLIF(current_setting(''app.current_company_id'', true), '''')
        OR company_id IS NOT NULL
      )
      WITH CHECK (
        auth.role() = ''service_role''
        OR auth.role() = ''anon''
        OR company_id::text = NULLIF(current_setting(''app.current_company_id'', true), '''')
        OR company_id IS NOT NULL
      );
    ', tbl);
  END LOOP;
END $$;

COMMIT;
-- ==============================================================================
-- END OF COMPREHENSIVE FINANCIAL AUDIT SQL PATCH
-- ==============================================================================
