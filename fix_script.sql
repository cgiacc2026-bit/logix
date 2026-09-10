-- ==============================================================================
-- سكربت الترحيل المحاسبي الفوري لسندات القبض والصرف إلى الدليل المحاسبي
-- Instant Double-Entry Voucher-to-Ledger Accounting Synchronization Script
-- متوافق بالكامل مع PostgreSQL & Supabase Database
-- ==============================================================================

-- ==============================================================================
-- 1) التحقق من الحقول وضمان وجود الأعمدة المحاسبية اللازمة
-- ==============================================================================

ALTER TABLE public.chart_of_accounts 
    ADD COLUMN IF NOT EXISTS current_balance NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.chart_of_accounts 
    ADD COLUMN IF NOT EXISTS balance NUMERIC(18, 4) DEFAULT 0;

ALTER TABLE public.customers 
    ADD COLUMN IF NOT EXISTS current_balance NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.customers 
    ADD COLUMN IF NOT EXISTS balance NUMERIC(18, 4) DEFAULT 0;

ALTER TABLE public.suppliers 
    ADD COLUMN IF NOT EXISTS current_balance NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.suppliers 
    ADD COLUMN IF NOT EXISTS balance NUMERIC(18, 4) DEFAULT 0;

ALTER TABLE public.payment_vouchers 
    ADD COLUMN IF NOT EXISTS account_id TEXT;
ALTER TABLE public.payment_vouchers 
    ADD COLUMN IF NOT EXISTS journal_entry_id TEXT;
ALTER TABLE public.payment_vouchers 
    ADD COLUMN IF NOT EXISTS is_posted BOOLEAN DEFAULT true;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'vouchers') THEN
        ALTER TABLE public.vouchers ADD COLUMN IF NOT EXISTS journal_entry_id TEXT;
        ALTER TABLE public.vouchers ADD COLUMN IF NOT EXISTS account_id TEXT;
        ALTER TABLE public.vouchers ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'POSTED';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_payment_vouchers_account_id ON public.payment_vouchers(account_id);
CREATE INDEX IF NOT EXISTS idx_payment_vouchers_journal_entry ON public.payment_vouchers(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON public.journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON public.journal_entry_lines(account_id);

-- ==============================================================================
-- 2) دالة توليد رقم القيد المحاسبي الآلي التالي
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.fn_generate_next_journal_number()
RETURNS TEXT AS $$
DECLARE
    next_num BIGINT;
    generated_number TEXT;
BEGIN
    SELECT COALESCE(MAX(
        CASE 
            WHEN entry_number ~ '^[0-9]+$' THEN entry_number::BIGINT 
            WHEN entry_number ~ 'JV-[0-9]+' THEN regexp_replace(entry_number, '^JV-', '')::BIGINT
            ELSE 0 
        END
    ), 0) + 1 INTO next_num
    FROM public.journal_entries;

    generated_number := 'JV-' || LPAD(next_num::TEXT, 6, '0');
    RETURN generated_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 3) دالة جلب أو ربط الحساب المالي الافتراضي في شجرة الحسابات
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.fn_get_or_create_chart_account(
    p_code TEXT,
    p_name_ar TEXT,
    p_name_en TEXT,
    p_type TEXT,
    p_category TEXT,
    p_nature TEXT
)
RETURNS TEXT AS $$
DECLARE
    v_account_id TEXT;
BEGIN
    SELECT id INTO v_account_id
    FROM public.chart_of_accounts
    WHERE code = p_code OR account_code = p_code
    LIMIT 1;

    IF v_account_id IS NOT NULL THEN
        RETURN v_account_id;
    END IF;

    SELECT id INTO v_account_id
    FROM public.chart_of_accounts
    WHERE name ILIKE '%' || p_name_ar || '%' OR name_ar ILIKE '%' || p_name_ar || '%'
    LIMIT 1;

    IF v_account_id IS NOT NULL THEN
        RETURN v_account_id;
    END IF;

    v_account_id := 'acc_' || p_code || '_' || substr(md5(random()::text), 1, 6);
    INSERT INTO public.chart_of_accounts (
        id, code, name, name_ar, name_en, type, category, nature, is_active, is_header, balance, current_balance, created_at, updated_at
    ) VALUES (
        v_account_id, p_code, p_name_ar, p_name_ar, p_name_en, p_type, p_category, p_nature, true, false, 0, 0, NOW(), NOW()
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN v_account_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 4) الإجراء المحاسبي المركزي لتطبيق قيد اليومية وتحديث أرصدة شجرة الحسابات
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.fn_post_payment_voucher_to_ledger(
    p_voucher_id TEXT,
    p_voucher_number TEXT,
    p_voucher_type TEXT,       
    p_voucher_date DATE,
    p_amount NUMERIC(18, 4),
    p_method TEXT,             
    p_party_type TEXT,         
    p_party_id TEXT,
    p_party_name TEXT,
    p_description TEXT,
    p_bank_or_cash_account_id TEXT DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
    v_journal_id TEXT;
    v_journal_num TEXT;
    v_fund_account_id TEXT;
    v_contra_account_id TEXT;
    v_fund_account_name TEXT;
    v_contra_account_name TEXT;
    v_desc TEXT;
    v_nature TEXT;
BEGIN
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RETURN NULL;
    END IF;

    IF p_bank_or_cash_account_id IS NOT NULL AND p_bank_or_cash_account_id <> '' THEN
        v_fund_account_id := p_bank_or_cash_account_id;
    ELSE
        IF UPPER(COALESCE(p_method, 'CASH')) IN ('CASH', 'نقد', 'نقدي') THEN
            v_fund_account_id := public.fn_get_or_create_chart_account('1101', 'الخزينة العامة - الصندوق', 'General Cash Fund', 'ASSET', 'CURRENT_ASSET', 'DEBIT');
        ELSE
            v_fund_account_id := public.fn_get_or_create_chart_account('1102', 'الحساب البنكي الرئيسي', 'Main Bank Account', 'ASSET', 'CURRENT_ASSET', 'DEBIT');
        END IF;
    END IF;

    SELECT COALESCE(name_ar, name, 'حساب النقدية/البنك') INTO v_fund_account_name
    FROM public.chart_of_accounts WHERE id = v_fund_account_id;

    IF UPPER(COALESCE(p_party_type, '')) IN ('CUSTOMER', 'CLIENT', 'عميل') THEN
        v_contra_account_id := public.fn_get_or_create_chart_account('1103', 'حسابات العملاء (ذمم مدينة)', 'Accounts Receivable', 'ASSET', 'CURRENT_ASSET', 'DEBIT');
        v_contra_account_name := COALESCE(p_party_name, 'العميل');
    ELSIF UPPER(COALESCE(p_party_type, '')) IN ('SUPPLIER', 'VENDOR', 'مورد') THEN
        v_contra_account_id := public.fn_get_or_create_chart_account('2101', 'حسابات الموردين (ذمم دائنة)', 'Accounts Payable', 'LIABILITY', 'CURRENT_LIABILITY', 'CREDIT');
        v_contra_account_name := COALESCE(p_party_name, 'المورد');
    ELSE
        IF UPPER(p_voucher_type) = 'PAYMENT' THEN
            v_contra_account_id := public.fn_get_or_create_chart_account('5101', 'مصروفات تشغيلية متنوعة', 'General Operating Expenses', 'EXPENSE', 'OPERATING_EXPENSE', 'DEBIT');
            v_contra_account_name := COALESCE(p_party_name, 'مصروفات عامة');
        ELSE
            v_contra_account_id := public.fn_get_or_create_chart_account('4102', 'إيرادات متنوعة أخرى', 'Other Income', 'REVENUE', 'OTHER_REVENUE', 'CREDIT');
            v_contra_account_name := COALESCE(p_party_name, 'إيرادات أخرى');
        END IF;
    END IF;

    v_desc := COALESCE(p_description, '');
    IF v_desc = '' THEN
        IF UPPER(p_voucher_type) = 'RECEIPT' THEN
            v_desc := 'قيد آلي لسند قبض رقم ' || COALESCE(p_voucher_number, p_voucher_id) || ' من ' || v_contra_account_name;
        ELSE
            v_desc := 'قيد آلي لسند صرف رقم ' || COALESCE(p_voucher_number, p_voucher_id) || ' إلى ' || v_contra_account_name;
        END IF;
    END IF;

    SELECT id INTO v_journal_id
    FROM public.journal_entries
    WHERE reference_id = p_voucher_id OR reference_number = p_voucher_number
    LIMIT 1;

    IF v_journal_id IS NOT NULL THEN
        DELETE FROM public.journal_entry_lines WHERE journal_entry_id = v_journal_id;
        
        UPDATE public.journal_entries
        SET 
            entry_date = COALESCE(p_voucher_date, CURRENT_DATE),
            description = v_desc,
            narration = v_desc,
            total_debit = p_amount,
            total_credit = p_amount,
            status = 'POSTED',
            updated_at = NOW()
        WHERE id = v_journal_id;
    ELSE
        v_journal_id := 'je_vch_' || substr(md5(random()::text || clock_timestamp()::text), 1, 12);
        v_journal_num := public.fn_generate_next_journal_number();

        INSERT INTO public.journal_entries (
            id, entry_number, entry_date, description, narration, reference_type, reference_id, reference_number, total_debit, total_credit, status, created_at, updated_at
        ) VALUES (
            v_journal_id, v_journal_num, COALESCE(p_voucher_date, CURRENT_DATE), v_desc, v_desc,
            CASE WHEN UPPER(p_voucher_type) = 'RECEIPT' THEN 'RECEIPT_VOUCHER' ELSE 'PAYMENT_VOUCHER' END,
            p_voucher_id, p_voucher_number, p_amount, p_amount, 'POSTED', NOW(), NOW()
        );
    END IF;

    IF UPPER(p_voucher_type) = 'RECEIPT' THEN
        INSERT INTO public.journal_entry_lines (id, journal_entry_id, account_id, account_name, description, debit, credit, created_at) VALUES 
        ( 'line_' || substr(md5(random()::text), 1, 10), v_journal_id, v_fund_account_id, v_fund_account_name, v_desc || ' (استلام نقدية/بنك)', p_amount, 0, NOW() ),
        ( 'line_' || substr(md5(random()::text), 1, 10), v_journal_id, v_contra_account_id, v_contra_account_name, v_desc || ' (سداد ذمة/إيراد)', 0, p_amount, NOW() );
    ELSE
        INSERT INTO public.journal_entry_lines (id, journal_entry_id, account_id, account_name, description, debit, credit, created_at) VALUES 
        ( 'line_' || substr(md5(random()::text), 1, 10), v_journal_id, v_contra_account_id, v_contra_account_name, v_desc || ' (سداد مستحق/مصروف)', p_amount, 0, NOW() ),
        ( 'line_' || substr(md5(random()::text), 1, 10), v_journal_id, v_fund_account_id, v_fund_account_name, v_desc || ' (صرف من النقدية/البنك)', 0, p_amount, NOW() );
    END IF;

    UPDATE public.chart_of_accounts a
    SET 
        current_balance = (
            SELECT COALESCE(SUM(CASE 
                WHEN UPPER(COALESCE(a.nature, 'DEBIT')) = 'CREDIT' THEN (l.credit - l.debit)
                ELSE (l.debit - l.credit)
            END), 0)
            FROM public.journal_entry_lines l
            JOIN public.journal_entries e ON e.id = l.journal_entry_id
            WHERE l.account_id = a.id AND e.status = 'POSTED'
        ),
        balance = (
            SELECT COALESCE(SUM(CASE 
                WHEN UPPER(COALESCE(a.nature, 'DEBIT')) = 'CREDIT' THEN (l.credit - l.debit)
                ELSE (l.debit - l.credit)
            END), 0)
            FROM public.journal_entry_lines l
            JOIN public.journal_entries e ON e.id = l.journal_entry_id
            WHERE l.account_id = a.id AND e.status = 'POSTED'
        ),
        updated_at = NOW()
    WHERE a.id IN (v_fund_account_id, v_contra_account_id);

    IF p_party_id IS NOT NULL AND UPPER(COALESCE(p_party_type, '')) IN ('CUSTOMER', 'CLIENT', 'عميل') THEN
        UPDATE public.customers
        SET 
            current_balance = COALESCE(current_balance, 0) + (CASE WHEN UPPER(p_voucher_type) = 'RECEIPT' THEN -p_amount ELSE p_amount END),
            balance = COALESCE(balance, 0) + (CASE WHEN UPPER(p_voucher_type) = 'RECEIPT' THEN -p_amount ELSE p_amount END),
            updated_at = NOW()
        WHERE id = p_party_id;
    END IF;

    IF p_party_id IS NOT NULL AND UPPER(COALESCE(p_party_type, '')) IN ('SUPPLIER', 'VENDOR', 'مورد') THEN
        UPDATE public.suppliers
        SET 
            current_balance = COALESCE(current_balance, 0) + (CASE WHEN UPPER(p_voucher_type) = 'PAYMENT' THEN -p_amount ELSE p_amount END),
            balance = COALESCE(balance, 0) + (CASE WHEN UPPER(p_voucher_type) = 'PAYMENT' THEN -p_amount ELSE p_amount END),
            updated_at = NOW()
        WHERE id = p_party_id;
    END IF;

    RETURN v_journal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 5) المشغّل التلقائي (Trigger) عند إضافة أو تعديل سند قبض أو صرف
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.trg_payment_vouchers_auto_ledger_sync()
RETURNS TRIGGER AS $$
DECLARE
    v_journal_id TEXT;
    v_type TEXT;
    v_num TEXT;
    v_amt NUMERIC(18, 4);
    v_date DATE;
    v_method TEXT;
    v_party_type TEXT;
    v_party_id TEXT;
    v_party_name TEXT;
    v_desc TEXT;
    v_acc_id TEXT;
BEGIN
    v_type := COALESCE(NEW.type, 'PAYMENT');
    v_num := COALESCE(NEW.voucher_number, NEW.id);
    v_amt := COALESCE(NEW.amount, 0);
    v_date := COALESCE(NEW.date, CURRENT_DATE);
    v_method := COALESCE(NEW.payment_method, 'CASH');
    v_party_type := COALESCE(NEW.entity_type, '');
    v_party_id := COALESCE(NEW.entity_id, NULL);
    v_party_name := COALESCE(NEW.entity_name, NULL);
    v_desc := COALESCE(NEW.description, NEW.notes, '');
    v_acc_id := COALESCE(NEW.account_id, NULL);

    v_journal_id := public.fn_post_payment_voucher_to_ledger(
        NEW.id::TEXT,
        v_num,
        v_type,
        v_date,
        v_amt,
        v_method,
        v_party_type,
        v_party_id,
        v_party_name,
        v_desc,
        v_acc_id
    );

    IF v_journal_id IS NOT NULL THEN
        NEW.journal_entry_id := v_journal_id;
        NEW.is_posted := true;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_payment_voucher_ledger ON public.payment_vouchers;
CREATE TRIGGER trg_sync_payment_voucher_ledger
BEFORE INSERT OR UPDATE ON public.payment_vouchers
FOR EACH ROW
EXECUTE FUNCTION public.trg_payment_vouchers_auto_ledger_sync();

-- ==============================================================================
-- 6) تشغيل الترحيل التراجعي لكافة السندات المسجلة سابقاً في النظام لضبط الأرصدة
-- ==============================================================================
DO $$
DECLARE
    r RECORD;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payment_vouchers') THEN
        FOR r IN 
            SELECT 
                id, 
                voucher_number, 
                type, 
                date as voucher_date, 
                amount, 
                payment_method, 
                entity_type as party_type, 
                entity_id as party_id, 
                entity_name as party_name, 
                description, 
                account_id 
            FROM public.payment_vouchers 
            WHERE amount > 0
        LOOP
            PERFORM public.fn_post_payment_voucher_to_ledger(
                r.id::TEXT,
                r.voucher_number,
                r.type,
                r.voucher_date,
                r.amount,
                r.payment_method,
                r.party_type,
                r.party_id,
                r.party_name,
                r.description,
                r.account_id
            );
        END LOOP;
    END IF;
END $$;
