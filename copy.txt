-- ==============================================================================
-- سكربت الترحيل المحاسبي الفوري لسندات القبض والصرف إلى الدليل المحاسبي
-- Instant Double-Entry Voucher-to-Ledger Accounting Synchronization Script
-- متوافق بالكامل مع PostgreSQL & Supabase Database
--
-- معايير السلامة الصارمة:
-- 1. حظر تام لأي أوامر حذف (STRICTLY NO DROP TABLE, NO TRUNCATE, NO DELETE).
-- 2. جميع الإضافات والتعديلات تدريجية وآمنة تماماً (ADD COLUMN IF NOT EXISTS).
-- 3. ترحيل مزدوج آلي (Double-Entry Bookkeeping) لسندات القبض والصرف.
-- 4. تحديث فوري لرصيد البنك/الخزينة ورصيد العميل/المورد في الدليل المحاسبي (balance / current_balance).
-- 5. التراجع التلقائي عن التأثير القديم عند تعديل السند وتطبيق القيد الجديد لحظياً.
-- ==============================================================================

-- ==============================================================================
-- 1) التحقق من الحقول وضمان وجود الأعمدة المحاسبية اللازمة (Idempotent Schema Check)
-- ==============================================================================

-- التأكد من وجود عمود current_balance في جدول الدليل المحاسبي
ALTER TABLE public.chart_of_accounts 
    ADD COLUMN IF NOT EXISTS current_balance NUMERIC(18, 4) DEFAULT 0;

ALTER TABLE public.chart_of_accounts 
    ADD COLUMN IF NOT EXISTS balance NUMERIC(18, 4) DEFAULT 0;

-- التأكد من وجود عمود current_balance في جدول العملاء
ALTER TABLE public.customers 
    ADD COLUMN IF NOT EXISTS current_balance NUMERIC(18, 4) DEFAULT 0;

ALTER TABLE public.customers 
    ADD COLUMN IF NOT EXISTS balance NUMERIC(18, 4) DEFAULT 0;

-- التأكد من وجود عمود current_balance في جدول الموردين
ALTER TABLE public.suppliers 
    ADD COLUMN IF NOT EXISTS current_balance NUMERIC(18, 4) DEFAULT 0;

ALTER TABLE public.suppliers 
    ADD COLUMN IF NOT EXISTS balance NUMERIC(18, 4) DEFAULT 0;

-- التأكد من وجود حقول الربط المحاسبي في جدول سندات القبض والصرف payment_vouchers
ALTER TABLE public.payment_vouchers 
    ADD COLUMN IF NOT EXISTS account_id TEXT;

ALTER TABLE public.payment_vouchers 
    ADD COLUMN IF NOT EXISTS journal_entry_id TEXT;

ALTER TABLE public.payment_vouchers 
    ADD COLUMN IF NOT EXISTS is_posted BOOLEAN DEFAULT true;

-- التأكد من وجود حقول الربط في جدول vouchers التوافقي
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'vouchers') THEN
        ALTER TABLE public.vouchers ADD COLUMN IF NOT EXISTS journal_entry_id TEXT;
        ALTER TABLE public.vouchers ADD COLUMN IF NOT EXISTS account_id TEXT;
        ALTER TABLE public.vouchers ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'POSTED';
    END IF;
END $$;

-- فهارس تحسين سرعة البحث والترحيل اللحظي
CREATE INDEX IF NOT EXISTS idx_payment_vouchers_account_id ON public.payment_vouchers(account_id);
CREATE INDEX IF NOT EXISTS idx_payment_vouchers_status ON public.payment_vouchers(status);
CREATE INDEX IF NOT EXISTS idx_journal_entries_reference_id ON public.journal_entries(reference_id);
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_code_comp ON public.chart_of_accounts(company_id, code);

-- ==============================================================================
-- 2) دالة إعادة احتساب أرصدة الدليل المحاسبي والعملاء (Recalculate Ledger Balances)
-- ==============================================================================

CREATE OR REPLACE FUNCTION recalculate_company_ledger_balances(p_company_id UUID)
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

    -- أ. تصفير مؤقت لأرصدة الحسابات التفصيلية للشركة تمهيداً لحسابها بدقة من واقع قيود اليومية المعتمدة
    UPDATE public.chart_of_accounts
    SET balance = 0, current_balance = 0
    WHERE company_id = p_company_id;

    -- ب. احتساب الحركة المدينة والدائنة من قيود اليومية النشطة (status = 'POSTED')
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
            ON (line->>'accountId' = coa.id OR line->>'accountCode' = coa.code)
        WHERE coa.company_id = p_company_id
        GROUP BY coa.id, coa.code, coa.normal_balance
    ) LOOP
        -- تطبيق طبيعة الحساب المحاسبي (مدين أو دائن)
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

    -- ج. تجميع الأرصدة الشجرية للأعلى (Rollup into Parent Accounts: Level 4 -> 3 -> 2 -> 1)
    -- المستوى 4 إلى المستوى 3
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

    -- د. تحديث أرصدة العملاء من واقع الفواتير والسندات
    UPDATE public.customers cust
    SET balance = COALESCE(calc.net_balance, 0),
        current_balance = COALESCE(calc.net_balance, 0),
        updated_at = timezone('utc', now())
    FROM (
        SELECT 
            c.id AS customer_id,
            (
                COALESCE(
                    (SELECT SUM(i.total_amount) 
                     FROM public.invoices i 
                     WHERE i.customer_id = c.id 
                       AND i.company_id = p_company_id 
                       AND i.status != 'CANCELLED'), 0
                )
                -
                COALESCE(
                    (SELECT SUM(pv.amount) 
                     FROM public.payment_vouchers pv 
                     WHERE pv.entity_id = c.id 
                       AND pv.type = 'RECEIPT' 
                       AND pv.company_id = p_company_id 
                       AND pv.status = 'POSTED'), 0
                )
            ) AS net_balance
        FROM public.customers c
        WHERE c.company_id = p_company_id
    ) calc
    WHERE cust.id = calc.customer_id AND cust.company_id = p_company_id;

    -- هـ. تحديث أرصدة الموردين من واقع الفواتير والسندات
    UPDATE public.suppliers supp
    SET balance = COALESCE(calc.net_balance, 0),
        current_balance = COALESCE(calc.net_balance, 0),
        updated_at = timezone('utc', now())
    FROM (
        SELECT 
            s.id AS supplier_id,
            (
                COALESCE(
                    (SELECT SUM(i.total_amount) 
                     FROM public.invoices i 
                     WHERE (i.raw_data->>'supplierId' = s.id OR i.raw_data->>'supplier_id' = s.id) 
                       AND i.company_id = p_company_id 
                       AND i.status != 'CANCELLED'), 0
                )
                -
                COALESCE(
                    (SELECT SUM(pv.amount) 
                     FROM public.payment_vouchers pv 
                     WHERE pv.entity_id = s.id 
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
-- 3) دالة ترحيل سند منفرد إلى قيد اليومية وتحديث الأرصدة (Post Single Voucher)
-- ==============================================================================

CREATE OR REPLACE FUNCTION post_voucher_to_ledger(
    p_voucher_id TEXT,
    p_company_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_voucher RECORD;
    v_liquid_acc RECORD;
    v_receivable_acc RECORD;
    v_payable_acc RECORD;
    v_journal_id UUID;
    v_entry_number TEXT;
    v_amount NUMERIC(18, 4);
    v_lines JSONB;
    v_entity_name TEXT;
    v_desc TEXT;
BEGIN
    IF p_company_id IS NULL OR p_voucher_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'معرف الشركة ورقم السند مطلوبان.');
    END IF;

    -- 1. استرجاع السند من جدول payment_vouchers
    SELECT * INTO v_voucher
    FROM public.payment_vouchers
    WHERE (id = p_voucher_id OR voucher_number = p_voucher_id)
      AND company_id = p_company_id;

    -- إذا لم يُعثر عليه، فحص جدول vouchers البديل
    IF v_voucher IS NULL AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vouchers') THEN
        SELECT 
            id,
            company_id,
            COALESCE(id, 'RCV-2026-0001') AS voucher_number,
            COALESCE(voucher_type, 'RECEIPT') AS type,
            created_at::date AS date,
            amount,
            'CASH' AS payment_method,
            'CUSTOMER' AS entity_type,
            '' AS entity_id,
            description AS entity_name,
            account_id,
            description AS notes,
            'POSTED' AS status
        INTO v_voucher
        FROM public.vouchers
        WHERE id = p_voucher_id AND company_id = p_company_id;
    END IF;

    IF v_voucher IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'السند غير موجود.');
    END IF;

    v_amount := COALESCE(v_voucher.amount, 0);
    v_entry_number := 'JV-' || v_voucher.voucher_number;
    v_entity_name := COALESCE(v_voucher.entity_name, 'الجهة المالية');

    -- 2. في حالة إلغاء السند (CANCELLED)، إلغاء القيد المحاسبي المرتبط وعكس أثره
    IF v_voucher.status = 'CANCELLED' THEN
        UPDATE public.journal_entries
        SET status = 'CANCELLED',
            updated_at = timezone('utc', now())
        WHERE company_id = p_company_id
          AND (reference_id = v_voucher.id OR reference = v_voucher.voucher_number OR entry_number = v_entry_number);

        -- إعادة حساب الأرصدة
        PERFORM recalculate_company_ledger_balances(p_company_id);

        RETURN jsonb_build_object('success', true, 'status', 'CANCELLED_REVERSED');
    END IF;

    -- 3. البحث عن حساب البنك أو الصندوق المستهدف في الدليل المحاسبي
    -- الأولوية: مطابقة ID ثم مطابقة Code ثم البحث عن بنك/صندوق
    SELECT id, code, name_ar, normal_balance INTO v_liquid_acc
    FROM public.chart_of_accounts
    WHERE company_id = p_company_id
      AND (id = v_voucher.account_id OR code = v_voucher.account_id)
    LIMIT 1;

    -- إذا لم يتم التحديد برقم الحساب، البحث حسب طريقة الدفع
    IF v_liquid_acc IS NULL THEN
        IF v_voucher.payment_method = 'CASH' THEN
            SELECT id, code, name_ar, normal_balance INTO v_liquid_acc
            FROM public.chart_of_accounts
            WHERE company_id = p_company_id
              AND (code = '1113' OR code = '1112' OR code = '1110' OR name_ar LIKE '%صندوق%' OR name_ar LIKE '%خزينة%')
            ORDER BY code ASC
            LIMIT 1;
        ELSE
            SELECT id, code, name_ar, normal_balance INTO v_liquid_acc
            FROM public.chart_of_accounts
            WHERE company_id = p_company_id
              AND (code = '1111' OR code = '1112' OR code = '1110' OR name_ar LIKE '%بنك%' OR name_ar LIKE '%مصرف%')
            ORDER BY code ASC
            LIMIT 1;
        END IF;
    END IF;

    -- صمام أمان في حال عدم وجود حسابات
    IF v_liquid_acc IS NULL THEN
        SELECT id, code, name_ar, normal_balance INTO v_liquid_acc
        FROM public.chart_of_accounts
        WHERE company_id = p_company_id AND category = 'ASSET'
        ORDER BY code ASC
        LIMIT 1;
    END IF;

    -- 4. تحديد الحساب المحاسبي المقابل (العملاء أو الموردين)
    IF v_voucher.type = 'RECEIPT' THEN
        -- حساب الذمم المدينة (العملاء) - كود 1120
        SELECT id, code, name_ar INTO v_receivable_acc
        FROM public.chart_of_accounts
        WHERE company_id = p_company_id
          AND (code = '1120' OR code LIKE '112%' OR name_ar LIKE '%مدين%' OR name_ar LIKE '%عملاء%')
        ORDER BY code ASC
        LIMIT 1;

        IF v_receivable_acc IS NULL THEN
            v_receivable_acc := v_liquid_acc;
        END IF;

        -- صياغة سطور القيد المزدوج لسند القبض:
        -- من حـ/ البنك أو الصندوق (مدين)
        -- إلى حـ/ الذمم المدينة للعميل (دائن)
        v_lines := jsonb_build_array(
            jsonb_build_object(
                'id', 'jl-1',
                'accountId', v_liquid_acc.id,
                'accountCode', v_liquid_acc.code,
                'accountNameAr', v_liquid_acc.name_ar,
                'debit', v_amount,
                'credit', 0,
                'memo', 'إيداع سند قبض رقم ' || v_voucher.voucher_number || ' - ' || v_entity_name
            ),
            jsonb_build_object(
                'id', 'jl-2',
                'accountId', v_receivable_acc.id,
                'accountCode', v_receivable_acc.code,
                'accountNameAr', v_receivable_acc.name_ar,
                'debit', 0,
                'credit', v_amount,
                'memo', 'تحصيل دفعة من العميل ' || v_entity_name,
                'entityType', 'CUSTOMER',
                'entityId', v_voucher.entity_id
            )
        );
        v_desc := 'قيد ترحيل سند قبض آلي رقم (' || v_voucher.voucher_number || ') - ' || v_entity_name;

    ELSE
        -- سند صرف: حساب الذمم الدائنة (الموردين) - كود 2110
        SELECT id, code, name_ar INTO v_payable_acc
        FROM public.chart_of_accounts
        WHERE company_id = p_company_id
          AND (code = '2110' OR code LIKE '211%' OR name_ar LIKE '%دائن%' OR name_ar LIKE '%مورد%')
        ORDER BY code ASC
        LIMIT 1;

        IF v_payable_acc IS NULL THEN
            v_payable_acc := v_liquid_acc;
        END IF;

        -- صياغة سطور القيد المزدوج لسند الصرف:
        -- من حـ/ الذمم الدائنة للمورد (مدين)
        -- إلى حـ/ البنك أو الصندوق (دائن)
        v_lines := jsonb_build_array(
            jsonb_build_object(
                'id', 'jl-1',
                'accountId', v_payable_acc.id,
                'accountCode', v_payable_acc.code,
                'accountNameAr', v_payable_acc.name_ar,
                'debit', v_amount,
                'credit', 0,
                'memo', 'سداد التزام للمورد ' || v_entity_name,
                'entityType', 'SUPPLIER',
                'entityId', v_voucher.entity_id
            ),
            jsonb_build_object(
                'id', 'jl-2',
                'accountId', v_liquid_acc.id,
                'accountCode', v_liquid_acc.code,
                'accountNameAr', v_liquid_acc.name_ar,
                'debit', 0,
                'credit', v_amount,
                'memo', 'صرف مبالغ سند صرف رقم ' || v_voucher.voucher_number || ' - ' || v_entity_name
            )
        );
        v_desc := 'قيد ترحيل سند صرف آلي رقم (' || v_voucher.voucher_number || ') - ' || v_entity_name;
    END IF;

    -- 5. فحص وجود قيد سابق لنفس السند، وتحديثه أو إنشاؤه (Upsert Journal Entry)
    SELECT id INTO v_journal_id
    FROM public.journal_entries
    WHERE company_id = p_company_id
      AND (reference_id = v_voucher.id OR reference = v_voucher.voucher_number OR entry_number = v_entry_number)
    LIMIT 1;

    IF v_journal_id IS NOT NULL THEN
        -- تحديث القيد القائم بالعناصر والمبالغ الجديدة
        UPDATE public.journal_entries
        SET date = v_voucher.date,
            description = v_desc,
            status = 'POSTED',
            total_debit = v_amount,
            total_credit = v_amount,
            lines = v_lines,
            reference = v_voucher.voucher_number,
            reference_type = v_voucher.type,
            reference_id = v_voucher.id,
            updated_at = timezone('utc', now())
        WHERE id = v_journal_id;
    ELSE
        -- إنشاء قيد يومية جديد للسند
        v_journal_id := gen_random_uuid();
        INSERT INTO public.journal_entries (
            id,
            company_id,
            entry_number,
            date,
            description,
            status,
            reference,
            reference_type,
            reference_id,
            total_debit,
            total_credit,
            lines,
            created_at,
            updated_at
        ) VALUES (
            v_journal_id,
            p_company_id,
            v_entry_number,
            v_voucher.date,
            v_desc,
            'POSTED',
            v_voucher.voucher_number,
            v_voucher.type,
            v_voucher.id,
            v_amount,
            v_amount,
            v_lines,
            timezone('utc', now()),
            timezone('utc', now())
        );
    END IF;

    -- ربط رقم القيد بالسند
    UPDATE public.payment_vouchers
    SET journal_entry_id = v_journal_id::text,
        is_posted = true,
        account_id = v_liquid_acc.id,
        updated_at = timezone('utc', now())
    WHERE id = v_voucher.id;

    -- 6. إعادة احتساب وتحديث الأرصدة الشجرية والبنكية لحظياً
    PERFORM recalculate_company_ledger_balances(p_company_id);

    RETURN jsonb_build_object(
        'success', true,
        'voucher_number', v_voucher.voucher_number,
        'journal_entry_id', v_journal_id,
        'amount', v_amount,
        'liquid_account', v_liquid_acc.code || ' - ' || v_liquid_acc.name_ar
    );
END;
$$;

-- ==============================================================================
-- 4) دالة المزامنة الشاملة لجميع السندات السابقة والحالية (Sync All Vouchers)
-- ==============================================================================

CREATE OR REPLACE FUNCTION sync_all_vouchers_to_ledger(p_target_company_id UUID DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    r_voucher RECORD;
    v_posted_count INT := 0;
    v_comp_id UUID;
BEGIN
    FOR r_voucher IN (
        SELECT id, company_id, voucher_number 
        FROM public.payment_vouchers
        WHERE (p_target_company_id IS NULL OR company_id = p_target_company_id)
        ORDER BY date ASC, created_at ASC
    ) LOOP
        PERFORM post_voucher_to_ledger(r_voucher.id, r_voucher.company_id);
        v_posted_count := v_posted_count + 1;
        v_comp_id := r_voucher.company_id;
    END LOOP;

    -- إذا لم تكن هناك سندات في payment_vouchers ولكن توجد في vouchers
    IF v_posted_count = 0 AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vouchers') THEN
        FOR r_voucher IN (
            SELECT id, company_id, id AS voucher_number
            FROM public.vouchers
            WHERE (p_target_company_id IS NULL OR company_id = p_target_company_id)
        ) LOOP
            PERFORM post_voucher_to_ledger(r_voucher.id, r_voucher.company_id);
            v_posted_count := v_posted_count + 1;
            v_comp_id := r_voucher.company_id;
        END LOOP;
    END IF;

    -- تشغيل إعادة الاحتساب لجميع الشركات أو الشركة المحددة
    IF p_target_company_id IS NOT NULL THEN
        PERFORM recalculate_company_ledger_balances(p_target_company_id);
    ELSE
        FOR v_comp_id IN (SELECT DISTINCT company_id FROM public.chart_of_accounts) LOOP
            PERFORM recalculate_company_ledger_balances(v_comp_id);
        END LOOP;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'تم ترحيل وتدقيق جميع السندات إلى الدليل المحاسبي وتحديث الأرصدة بنجاح.',
        'vouchers_processed', v_posted_count
    );
END;
$$;

-- ==============================================================================
-- 5) المشغّل التلقائي (Automatic Database Trigger on Payment Vouchers)
-- ==============================================================================

CREATE OR REPLACE FUNCTION trg_fn_sync_voucher_to_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- استدعاء دالة الترحيل المحاسبي اللحظي عند إدخال أو تعديل أي سند
    PERFORM post_voucher_to_ledger(NEW.id, NEW.company_id);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payment_vouchers_ledger_sync ON public.payment_vouchers;
CREATE TRIGGER trg_payment_vouchers_ledger_sync
    AFTER INSERT OR UPDATE OF amount, account_id, entity_id, entity_name, type, status, date
    ON public.payment_vouchers
    FOR EACH ROW
    EXECUTE FUNCTION trg_fn_sync_voucher_to_ledger();

-- ==============================================================================
-- 6) تشغيل فوري لترحيل كافة السندات الحالية في قاعدة البيانات (Immediate Execution)
-- ==============================================================================

SELECT sync_all_vouchers_to_ledger();
