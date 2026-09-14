-- ==============================================================================
-- 🏛️ سكربت الترابط المحاسبي الشامل والمتكامل لقاعدة البيانات (Master Accounting Integration)
-- متوافق بالكامل مع PostgreSQL و Supabase
-- ==============================================================================
-- يربط هذا السكربت الجداول التالية بنظام القيد المزدوج الآلي وتحديث الأرصدة التلقائي:
-- 1. company_accounting_settings (إعدادات الحسابات الافتراضية لكل شركة)
-- 2. invoices (الفواتير: مبيعات، مشتريات، مرتجعات)
-- 3. payment_vouchers / vouchers (سندات القبض والصرف)
-- 4. journal_entries (قيود اليومية العامة)
-- 5. chart_of_accounts (شجرة ودليل الحسابات والأرصدة التراكمية)
-- 6. customers (العملاء والذمم المدينة)
-- 7. suppliers (الموردين والذمم الدائنة)
-- 8. items / inventory_items (المخزون وحركات الأصناف)
-- ==============================================================================

-- ==============================================================================
-- القسم 1: تهيئة الأعمدة والمؤشرات المطلوبة في الجداول
-- ==============================================================================

-- 1. أعمدة الأرصدة في شجرة الحسابات
ALTER TABLE public.chart_of_accounts 
    ADD COLUMN IF NOT EXISTS balance NUMERIC(18, 4) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS current_balance NUMERIC(18, 4) DEFAULT 0;

-- 2. أعمدة الأرصدة في العملاء والموردين
ALTER TABLE public.customers 
    ADD COLUMN IF NOT EXISTS balance NUMERIC(18, 4) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS current_balance NUMERIC(18, 4) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(18, 4) DEFAULT 0;

ALTER TABLE public.suppliers 
    ADD COLUMN IF NOT EXISTS balance NUMERIC(18, 4) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS current_balance NUMERIC(18, 4) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(18, 4) DEFAULT 0;

-- 3. أعمدة الربط في الفواتير وسندات القبض والصرف
ALTER TABLE public.invoices 
    ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'POSTED',
    ADD COLUMN IF NOT EXISTS journal_entry_id UUID;

ALTER TABLE public.payment_vouchers 
    ADD COLUMN IF NOT EXISTS account_id TEXT,
    ADD COLUMN IF NOT EXISTS journal_entry_id TEXT,
    ADD COLUMN IF NOT EXISTS is_posted BOOLEAN DEFAULT true;

-- 4. جدول إعدادات الحسابات الافتراضية
CREATE TABLE IF NOT EXISTS public.company_accounting_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL UNIQUE,
    cash_account_id TEXT,
    bank_account_id TEXT,
    receivable_account_id TEXT,
    payable_account_id TEXT,
    inventory_account_id TEXT,
    sales_account_id TEXT,
    cogs_account_id TEXT,
    vat_account_id TEXT,
    retained_earnings_account_id TEXT,
    settings_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- 5. إنشاء المؤشرات لتحسين سرعة الربط والبحث
CREATE INDEX IF NOT EXISTS idx_invoices_comp_status ON public.invoices(company_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON public.invoices(company_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_payment_vouchers_comp_type ON public.payment_vouchers(company_id, type, status);
CREATE INDEX IF NOT EXISTS idx_journal_entries_comp_ref ON public.journal_entries(company_id, reference);
CREATE INDEX IF NOT EXISTS idx_journal_entries_comp_status ON public.journal_entries(company_id, status);
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_comp_code ON public.chart_of_accounts(company_id, code);

-- ==============================================================================
-- القسم 2: دالة الضبط والتعافي التلقائي لإعدادات الحسابات (Self-Healing Settings)
-- تضمن هذه الدالة وجود وربط الحسابات الصحيحة تلقائياً لأي شركة بدون أي أخطاء
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.fn_ensure_company_accounting_settings(p_company_id UUID)
RETURNS public.company_accounting_settings
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_setting public.company_accounting_settings;
    v_sales TEXT;
    v_recv TEXT;
    v_pay TEXT;
    v_inv TEXT;
    v_cash TEXT;
    v_bank TEXT;
    v_cogs TEXT;
    v_vat TEXT;
    v_retained TEXT;
BEGIN
    IF p_company_id IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT * INTO v_setting 
    FROM public.company_accounting_settings 
    WHERE company_id = p_company_id 
    LIMIT 1;

    -- استكشاف المعرفات التلقائية من شجرة الحسابات
    SELECT id::text INTO v_sales FROM public.chart_of_accounts 
    WHERE company_id = p_company_id AND (code = '4100' OR code LIKE '41%' OR name_ar LIKE '%مبيعات%')
    ORDER BY CASE WHEN code = '4100' THEN 1 ELSE 2 END LIMIT 1;

    SELECT id::text INTO v_recv FROM public.chart_of_accounts 
    WHERE company_id = p_company_id AND (code = '1120' OR code LIKE '112%' OR name_ar LIKE '%عملاء%' OR name_ar LIKE '%مدين%')
    ORDER BY CASE WHEN code = '1120' THEN 1 ELSE 2 END LIMIT 1;

    SELECT id::text INTO v_pay FROM public.chart_of_accounts 
    WHERE company_id = p_company_id AND (code = '2110' OR code LIKE '211%' OR name_ar LIKE '%مورد%')
    ORDER BY CASE WHEN code = '2110' THEN 1 ELSE 2 END LIMIT 1;

    SELECT id::text INTO v_inv FROM public.chart_of_accounts 
    WHERE company_id = p_company_id AND (code = '1130' OR code LIKE '113%' OR name_ar LIKE '%مخزون%')
    ORDER BY CASE WHEN code = '1130' THEN 1 ELSE 2 END LIMIT 1;

    SELECT id::text INTO v_cash FROM public.chart_of_accounts 
    WHERE company_id = p_company_id AND (code = '1111' OR code = '1113' OR code LIKE '111%' OR name_ar LIKE '%صندوق%')
    ORDER BY CASE WHEN code = '1111' THEN 1 ELSE 2 END LIMIT 1;

    SELECT id::text INTO v_bank FROM public.chart_of_accounts 
    WHERE company_id = p_company_id AND (code = '1112' OR code LIKE '111%' OR name_ar LIKE '%بنك%')
    ORDER BY CASE WHEN code = '1112' THEN 1 ELSE 2 END LIMIT 1;

    SELECT id::text INTO v_cogs FROM public.chart_of_accounts 
    WHERE company_id = p_company_id AND (code = '5100' OR code LIKE '51%' OR name_ar LIKE '%تكلفة%')
    ORDER BY CASE WHEN code = '5100' THEN 1 ELSE 2 END LIMIT 1;

    SELECT id::text INTO v_vat FROM public.chart_of_accounts 
    WHERE company_id = p_company_id AND (code = '2130' OR code LIKE '213%' OR name_ar LIKE '%ضريب%')
    ORDER BY CASE WHEN code = '2130' THEN 1 ELSE 2 END LIMIT 1;

    IF v_setting IS NULL THEN
        INSERT INTO public.company_accounting_settings (
            id, company_id, sales_account_id, receivable_account_id, payable_account_id,
            inventory_account_id, cash_account_id, bank_account_id, cogs_account_id, vat_account_id,
            settings_data, updated_at
        ) VALUES (
            gen_random_uuid(), p_company_id, v_sales, v_recv, v_pay,
            v_inv, v_cash, v_bank, v_cogs, v_vat,
            '{"autoWired": true}'::jsonb, timezone('utc', now())
        )
        RETURNING * INTO v_setting;
    ELSE
        UPDATE public.company_accounting_settings
        SET 
            sales_account_id = COALESCE(sales_account_id, v_sales),
            receivable_account_id = COALESCE(receivable_account_id, v_recv),
            payable_account_id = COALESCE(payable_account_id, v_pay),
            inventory_account_id = COALESCE(inventory_account_id, v_inv),
            cash_account_id = COALESCE(cash_account_id, v_cash),
            bank_account_id = COALESCE(bank_account_id, v_bank),
            cogs_account_id = COALESCE(cogs_account_id, v_cogs),
            vat_account_id = COALESCE(vat_account_id, v_vat),
            updated_at = timezone('utc', now())
        WHERE company_id = p_company_id
        RETURNING * INTO v_setting;
    END IF;

    RETURN v_setting;
END;
$$;

-- ==============================================================================
-- القسم 3: دالة إعادة احتساب أرصدة الدليل المحاسبي والعملاء والموردين
-- (Recalculate Ledger, Customers & Suppliers Balances)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.recalculate_company_ledger_balances(p_company_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    r_account RECORD;
    v_net_movement NUMERIC(18, 4);
BEGIN
    IF p_company_id IS NULL THEN
        RETURN;
    END IF;

    -- 1. تصفير الحسابات للبدء بالحساب التراكمي الدقيق من قيود اليومية المعتمدة
    UPDATE public.chart_of_accounts
    SET balance = 0, current_balance = 0
    WHERE company_id = p_company_id;

    -- 2. احتساب إجمالي الحركات المدينة والدائنة من القيود المعتمدة (POSTED)
    FOR r_account IN (
        SELECT 
            coa.id AS account_id,
            coa.code,
            coa.normal_balance,
            COALESCE(SUM((line->>'debit')::numeric), 0) AS total_debit,
            COALESCE(SUM((line->>'credit')::numeric), 0) AS total_credit
        FROM public.chart_of_accounts coa
        LEFT JOIN public.journal_entries je 
             ON je.company_id = p_company_id 
             AND je.status = 'POSTED'
        LEFT JOIN LATERAL jsonb_array_elements(je.lines) AS line 
             ON (line->>'accountId' = coa.id::text OR line->>'accountCode' = coa.code)
        WHERE coa.company_id = p_company_id
        GROUP BY coa.id, coa.code, coa.normal_balance
    ) LOOP
        IF r_account.normal_balance = 'DEBIT' THEN
            v_net_movement := r_account.total_debit - r_account.total_credit;
        ELSE
            v_net_movement := r_account.total_credit - r_account.total_debit;
        END IF;

        UPDATE public.chart_of_accounts
        SET balance = v_net_movement,
            current_balance = v_net_movement,
            updated_at = timezone('utc', now())
        WHERE id = r_account.account_id AND company_id = p_company_id;
    END LOOP;

    -- 3. تجميع أرصدة الحسابات الرئيسية من الحسابات الفرعية التابعة لها
    UPDATE public.chart_of_accounts parent
    SET balance = COALESCE(children.sum_balance, 0),
        current_balance = COALESCE(children.sum_balance, 0)
    FROM (
        SELECT parent_id, SUM(balance) AS sum_balance
        FROM public.chart_of_accounts
        WHERE company_id = p_company_id AND parent_id IS NOT NULL
        GROUP BY parent_id
    ) children
    WHERE parent.id = children.parent_id AND parent.company_id = p_company_id;

    -- 4. تحديث أرصدة العملاء (مجموع الفواتير غير الملغاة - مجموع سندات القبض المعتمدة + الرصيد الافتتاحي)
    UPDATE public.customers cust
    SET balance = COALESCE(calc.net_balance, 0) + COALESCE(cust.opening_balance, 0),
        current_balance = COALESCE(calc.net_balance, 0) + COALESCE(cust.opening_balance, 0),
        updated_at = timezone('utc', now())
    FROM (
        SELECT 
            c.id AS customer_id,
            (
                COALESCE(
                    (SELECT SUM(i.total_amount)
                      FROM public.invoices i
                      WHERE CAST(i.customer_id AS text) = CAST(c.id AS text)
                        AND i.company_id = p_company_id
                        AND i.status NOT IN ('CANCELLED', 'VOID')), 0
                )
                -
                COALESCE(
                    (SELECT SUM(pv.amount)
                      FROM public.payment_vouchers pv 
                      WHERE CAST(pv.entity_id AS text) = CAST(c.id AS text)
                        AND pv.type = 'RECEIPT'
                        AND pv.company_id = p_company_id
                        AND pv.status = 'POSTED'), 0
                )
            ) AS net_balance
        FROM public.customers c
        WHERE c.company_id = p_company_id
    ) calc
    WHERE cust.id = calc.customer_id AND cust.company_id = p_company_id;

    -- 5. تحديث أرصدة الموردين (مجموع فواتير المشتريات - مجموع سندات الصرف المعتمدة + الرصيد الافتتاحي)
    UPDATE public.suppliers supp
    SET balance = COALESCE(calc.net_balance, 0) + COALESCE(supp.opening_balance, 0),
        current_balance = COALESCE(calc.net_balance, 0) + COALESCE(supp.opening_balance, 0),
        updated_at = timezone('utc', now())
    FROM (
        SELECT 
            s.id AS supplier_id,
            (
                COALESCE(
                    (SELECT SUM(i.total_amount)
                      FROM public.invoices i
                      WHERE (i.raw_data->>'supplierId' = CAST(s.id AS text) OR i.raw_data->>'supplier_id' = CAST(s.id AS text))
                        AND i.company_id = p_company_id
                        AND i.status NOT IN ('CANCELLED', 'VOID')), 0
                )
                -
                COALESCE(
                    (SELECT SUM(pv.amount)
                      FROM public.payment_vouchers pv
                      WHERE CAST(pv.entity_id AS text) = CAST(s.id AS text)
                        AND pv.type = 'PAYMENT'
                        AND pv.company_id = p_company_id
                        AND pv.status = 'POSTED'), 0
                )
            ) AS net_balance
        FROM public.suppliers s
        WHERE s.company_id = p_company_id
    ) calc
    WHERE supp.id = calc.supplier_id AND supp.company_id = p_company_id;
END;
$$;

-- ==============================================================================
-- القسم 4: تريجر الترابط المحاسبي للفواتير (Invoice to Journal Entry Trigger)
-- ينشئ القيد المالي المتوازن تلقائياً للفاتورة ويحدث الأرصدة بدون أي تعطل
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.fn_generate_invoice_journal_entry()
RETURNS TRIGGER AS $$
DECLARE
    v_settings public.company_accounting_settings;
    v_sales_acc TEXT;
    v_recv_acc TEXT;
    v_pay_acc TEXT;
    v_inv_acc TEXT;
    v_entry_num TEXT;
    v_jv_id UUID;
    v_lines JSONB;
    v_desc TEXT;
    v_is_sales BOOLEAN;
    v_amount NUMERIC(18, 4);
BEGIN
    -- 1. تخطي التنفيذ إذا كان وضع النسخ المتماثل (الاستيراد الدفعي) مفعلاً
    IF current_setting('session_replication_role', true) = 'replica' THEN
        RETURN NEW;
    END IF;

    -- 2. في حالة إلغاء الفاتورة، إلغاء القيد المرتبط بها
    IF NEW.status IN ('CANCELLED', 'VOID') THEN
        UPDATE public.journal_entries 
        SET status = 'CANCELLED', updated_at = timezone('utc', now())
        WHERE company_id = NEW.company_id 
          AND (reference = NEW.invoice_number OR reference = NEW.id::text);
        
        PERFORM public.recalculate_company_ledger_balances(NEW.company_id);
        RETURN NEW;
    END IF;

    -- 3. تخطي الفواتير غير المعتمدة (مسودة)
    IF NEW.status = 'DRAFT' THEN
        RETURN NEW;
    END IF;

    -- 4. تخطي الفاتورة إذا كان القيد قد تم إنشاؤه مسبقاً من واجهة التطبيق
    IF NEW.raw_data IS NOT NULL AND (NEW.raw_data->>'journalEntryId') IS NOT NULL AND (NEW.raw_data->>'journalEntryId') != '' THEN
        RETURN NEW;
    END IF;

    -- 5. التحقق من عدم وجود قيد يومية مسجل مسبقاً بنفس رقم الفاتورة
    PERFORM 1 FROM public.journal_entries 
    WHERE company_id = NEW.company_id AND (reference = NEW.invoice_number OR reference = NEW.id::text);
    IF FOUND THEN
        RETURN NEW;
    END IF;

    -- 6. استدعاء الضبط والتعافي التلقائي لإعدادات الحسابات
    v_settings := public.fn_ensure_company_accounting_settings(NEW.company_id);
    v_sales_acc := v_settings.sales_account_id;
    v_recv_acc := v_settings.receivable_account_id;
    v_pay_acc := v_settings.payable_account_id;
    v_inv_acc := v_settings.inventory_account_id;

    -- 7. تحديد نوع الفاتورة: مبيعات أم مشتريات
    v_is_sales := TRUE;
    IF (NEW.raw_data->>'type') = 'PURCHASE' 
       OR NEW.invoice_number LIKE 'INV-PUR%' 
       OR NEW.invoice_type = 'PURCHASE' THEN
        v_is_sales := FALSE;
    END IF;

    v_amount := COALESCE(NEW.total_amount, 0);
    IF v_amount <= 0 THEN
        RETURN NEW;
    END IF;

    v_jv_id := gen_random_uuid();
    v_entry_num := 'JV-' || COALESCE(NEW.invoice_number, substring(v_jv_id::text from 1 for 8));

    -- 8. بناء أطراف قيد اليومية (Double-Entry Balanced Lines)
    IF v_is_sales THEN
        v_desc := 'قيد إثبات فاتورة مبيعات رقم ' || COALESCE(NEW.invoice_number, '') || ' - ' || COALESCE(NEW.customer_name, 'العميل');
        v_lines := jsonb_build_array(
            jsonb_build_object(
                'id', gen_random_uuid()::text,
                'accountId', COALESCE(v_recv_acc, 'acc-1120'),
                'accountCode', '1120',
                'accountNameAr', 'الذمم المدينة (العملاء)',
                'debit', v_amount,
                'credit', 0,
                'memo', v_desc
            ),
            jsonb_build_object(
                'id', gen_random_uuid()::text,
                'accountId', COALESCE(v_sales_acc, 'acc-4100'),
                'accountCode', '4100',
                'accountNameAr', 'إيرادات المبيعات',
                'debit', 0,
                'credit', v_amount,
                'memo', v_desc
            )
        );
    ELSE
        v_desc := 'قيد إثبات فاتورة مشتريات رقم ' || COALESCE(NEW.invoice_number, '');
        v_lines := jsonb_build_array(
            jsonb_build_object(
                'id', gen_random_uuid()::text,
                'accountId', COALESCE(v_inv_acc, 'acc-1130'),
                'accountCode', '1130',
                'accountNameAr', 'مخزون البضائع والمشتريات',
                'debit', v_amount,
                'credit', 0,
                'memo', v_desc
            ),
            jsonb_build_object(
                'id', gen_random_uuid()::text,
                'accountId', COALESCE(v_pay_acc, 'acc-2110'),
                'accountCode', '2110',
                'accountNameAr', 'الذمم الدائنة (الموردين)',
                'debit', 0,
                'credit', v_amount,
                'memo', v_desc
            )
        );
    END IF;

    -- 9. إدراج قيد اليومية في جدول journal_entries
    INSERT INTO public.journal_entries (
        id,
        company_id,
        entry_number,
        entry_date,
        date,
        description,
        status,
        total_debit,
        total_credit,
        reference,
        reference_id,
        lines,
        created_at,
        updated_at
    ) VALUES (
        v_jv_id,
        NEW.company_id,
        v_entry_num,
        COALESCE(NEW.date, timezone('utc', now())::date),
        COALESCE(NEW.date, timezone('utc', now())::date),
        v_desc,
        'POSTED',
        v_amount,
        v_amount,
        COALESCE(NEW.invoice_number, NEW.id::text),
        NEW.id,
        v_lines,
        timezone('utc', now()),
        timezone('utc', now())
    );

    -- 10. تحديث حقل journal_entry_id في الفاتورة الحالية
    NEW.journal_entry_id := v_jv_id;

    -- 11. تحديث الأرصدة تلقائياً
    PERFORM public.recalculate_company_ledger_balances(NEW.company_id);

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- تسجيل الخطأ بأمان دون إيقاف حفظ الفاتورة (Zero Disruption)
    RAISE WARNING 'fn_generate_invoice_journal_entry notice: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ربط التريجر بجدول invoices
DROP TRIGGER IF EXISTS trg_generate_invoice_journal_entry ON public.invoices;
CREATE TRIGGER trg_generate_invoice_journal_entry
BEFORE INSERT OR UPDATE OF status, total_amount ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.fn_generate_invoice_journal_entry();

-- ==============================================================================
-- القسم 5: تريجر الترابط المحاسبي لسندات القبض والصرف (Vouchers to Ledger Trigger)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.fn_sync_payment_voucher_to_ledger()
RETURNS TRIGGER AS $$
DECLARE
    v_settings public.company_accounting_settings;
    v_liquid_acc TEXT;
    v_other_acc TEXT;
    v_liquid_code TEXT := '1111';
    v_other_code TEXT := '1120';
    v_liquid_name TEXT := 'الصندوق الرئيسي';
    v_other_name TEXT := 'الذمم المدينة (العملاء)';
    v_jv_id UUID;
    v_entry_num TEXT;
    v_amount NUMERIC(18, 4);
    v_desc TEXT;
    v_lines JSONB;
BEGIN
    IF current_setting('session_replication_role', true) = 'replica' THEN
        RETURN NEW;
    END IF;

    -- عند الإلغاء، إلغاء القيد المحاسبي المرتبط
    IF NEW.status IN ('CANCELLED', 'VOID') THEN
        UPDATE public.journal_entries 
        SET status = 'CANCELLED', updated_at = timezone('utc', now())
        WHERE company_id = NEW.company_id 
          AND (reference = NEW.voucher_number OR reference_id = NEW.id);
        
        PERFORM public.recalculate_company_ledger_balances(NEW.company_id);
        RETURN NEW;
    END IF;

    IF NEW.status != 'POSTED' THEN
        RETURN NEW;
    END IF;

    v_amount := COALESCE(NEW.amount, 0);
    IF v_amount <= 0 THEN
        RETURN NEW;
    END IF;

    -- التحقق من عدم وجود قيد مسجل مسبقاً
    PERFORM 1 FROM public.journal_entries 
    WHERE company_id = NEW.company_id 
      AND (reference = NEW.voucher_number OR reference_id = NEW.id);
    IF FOUND THEN
        RETURN NEW;
    END IF;

    -- استخراج إعدادات الحسابات
    v_settings := public.fn_ensure_company_accounting_settings(NEW.company_id);

    -- تحديد حساب النقدية/البنك
    IF NEW.payment_method = 'BANK' THEN
        v_liquid_acc := COALESCE(NEW.account_id, v_settings.bank_account_id, 'acc-1112');
        v_liquid_code := '1112';
        v_liquid_name := 'البنك';
    ELSE
        v_liquid_acc := COALESCE(NEW.account_id, v_settings.cash_account_id, 'acc-1111');
        v_liquid_code := '1111';
        v_liquid_name := 'الصندوق';
    END IF;

    v_jv_id := gen_random_uuid();
    v_entry_num := 'JV-' || COALESCE(NEW.voucher_number, substring(v_jv_id::text from 1 for 8));

    IF NEW.type = 'RECEIPT' THEN
        -- سند قبض: مدين (صندوق/بنك) ودائن (العميل)
        v_other_acc := COALESCE(v_settings.receivable_account_id, 'acc-1120');
        v_other_code := '1120';
        v_other_name := 'العملاء والذمم المدينة';
        v_desc := 'سند قبض رقم ' || COALESCE(NEW.voucher_number, '') || ' - ' || COALESCE(NEW.entity_name, 'العميل');

        v_lines := jsonb_build_array(
            jsonb_build_object(
                'id', gen_random_uuid()::text,
                'accountId', v_liquid_acc,
                'accountCode', v_liquid_code,
                'accountNameAr', v_liquid_name,
                'debit', v_amount,
                'credit', 0,
                'memo', v_desc
            ),
            jsonb_build_object(
                'id', gen_random_uuid()::text,
                'accountId', v_other_acc,
                'accountCode', v_other_code,
                'accountNameAr', v_other_name,
                'debit', 0,
                'credit', v_amount,
                'memo', v_desc
            )
        );
    ELSE
        -- سند صرف: مدين (المورد/المصروف) ودائن (صندوق/بنك)
        v_other_acc := COALESCE(v_settings.payable_account_id, 'acc-2110');
        v_other_code := '2110';
        v_other_name := 'الموردين والذمم الدائنة';
        v_desc := 'سند صرف رقم ' || COALESCE(NEW.voucher_number, '') || ' - ' || COALESCE(NEW.entity_name, 'المورد');

        v_lines := jsonb_build_array(
            jsonb_build_object(
                'id', gen_random_uuid()::text,
                'accountId', v_other_acc,
                'accountCode', v_other_code,
                'accountNameAr', v_other_name,
                'debit', v_amount,
                'credit', 0,
                'memo', v_desc
            ),
            jsonb_build_object(
                'id', gen_random_uuid()::text,
                'accountId', v_liquid_acc,
                'accountCode', v_liquid_code,
                'accountNameAr', v_liquid_name,
                'debit', 0,
                'credit', v_amount,
                'memo', v_desc
            )
        );
    END IF;

    INSERT INTO public.journal_entries (
        id,
        company_id,
        entry_number,
        entry_date,
        date,
        description,
        status,
        total_debit,
        total_credit,
        reference,
        reference_id,
        lines,
        created_at,
        updated_at
    ) VALUES (
        v_jv_id,
        NEW.company_id,
        v_entry_num,
        COALESCE(NEW.date, timezone('utc', now())::date),
        COALESCE(NEW.date, timezone('utc', now())::date),
        v_desc,
        'POSTED',
        v_amount,
        v_amount,
        COALESCE(NEW.voucher_number, NEW.id::text),
        NEW.id,
        v_lines,
        timezone('utc', now()),
        timezone('utc', now())
    );

    NEW.journal_entry_id := v_jv_id::text;
    PERFORM public.recalculate_company_ledger_balances(NEW.company_id);

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'fn_sync_payment_voucher_to_ledger notice: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ربط التريجر بجدول payment_vouchers
DROP TRIGGER IF EXISTS trg_payment_vouchers_ledger_sync ON public.payment_vouchers;
CREATE TRIGGER trg_payment_vouchers_ledger_sync
BEFORE INSERT OR UPDATE OF status, amount, type ON public.payment_vouchers
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_payment_voucher_to_ledger();

-- ==============================================================================
-- القسم 6: تشغيل فوري وتحديث الترابط لجميع الشركات المسجلة حالياً
-- (Immediate Execution & Migration for All Existing Companies)
-- ==============================================================================
DO $$
DECLARE
    r_comp RECORD;
BEGIN
    FOR r_comp IN (SELECT id, name_ar FROM public.companies) LOOP
        -- 1. ضبط إعدادات الحسابات تلقائياً
        PERFORM public.fn_ensure_company_accounting_settings(r_comp.id);
        -- 2. إعادة احتساب وتحديث أرصدة شجرة الحسابات والعملاء والموردين
        PERFORM public.recalculate_company_ledger_balances(r_comp.id);
        RAISE NOTICE 'تم تحديث الترابط المحاسبي والأرصدة بنجاح للشركة: %', COALESCE(r_comp.name_ar, r_comp.id::text);
    END LOOP;
END $$;
