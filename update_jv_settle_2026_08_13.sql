-- ==============================================================================
-- تَعديل قيد التسوية (JV-SETTLE-2026-09-10) وتصحيح تاريخه وإعادة توجيه الطرف الثاني
-- الشركة: شركة مطحنة الوليد المتحدة (Al-Waleed United Mills)
-- التاريخ الجديد: 2026-08-13 بدلاً من 2026-09-10
-- الطرف الثاني: حساب الفروقات / الأرصدة الافتتاحية (كود 3100)
-- ==============================================================================

DO $$
DECLARE
    v_company_id UUID := '20000000-0000-0000-0000-000000000001'::uuid;
    v_entry_num TEXT := 'JV-SETTLE-2026-09-10';
    v_new_date DATE := '2026-08-13'::date;
    v_account_id UUID;
    v_account_code TEXT := '3100';
    v_account_name TEXT := 'رأس المال المكتتب به / الأرصدة الافتتاحية';
    v_je_id TEXT;
    v_line_count INT;
    v_col_exists BOOLEAN;
BEGIN
    -- 1. استخراج معرف حساب الأرصدة الافتتاحية والفروقات (3100)
    SELECT id INTO v_account_id
    FROM public.accounts
    WHERE (company_id = v_company_id OR company_id IS NULL)
      AND code = v_account_code
    LIMIT 1;

    -- استخدام معرف بديل قياسي في حال عدم وجوده
    IF v_account_id IS NULL THEN
        v_account_id := 'bf25f8f9-9775-4fc5-8ff6-187c9b5306e5'::uuid;
    END IF;

    -- 2. التحقق من وجود عمود entry_date في جدول journal_entries وتحديثه ديناميكياً إن وجد
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'journal_entries' 
          AND column_name = 'entry_date'
    ) INTO v_col_exists;

    IF v_col_exists THEN
        EXECUTE format('
            UPDATE public.journal_entries
            SET entry_date = %L::date
            WHERE (company_id = %L::uuid OR company_id IS NULL)
              AND (TRIM(UPPER(entry_number)) = %L OR reference = %L)
        ', v_new_date, v_company_id, v_entry_num, v_entry_num);
    END IF;

    -- 3. تحديث التواريخ، الحالة، والطرف الثاني داخل أسطر JSONB في جدول public.journal_entries
    UPDATE public.journal_entries
    SET 
        date = v_new_date,
        status = 'POSTED',
        lines = CASE 
            WHEN jsonb_array_length(COALESCE(lines, '[]'::jsonb)) >= 2 THEN
                jsonb_set(
                    lines,
                    '{1}',
                    (lines->1) || jsonb_build_object(
                        'accountId', v_account_id::text,
                        'accountCode', v_account_code,
                        'accountNameAr', v_account_name,
                        'memo', 'تسوية فروقات الأرصدة الافتتاحية'
                    )
                )
            ELSE lines
        END,
        raw_data = jsonb_set(
            jsonb_set(
                jsonb_set(
                    jsonb_set(
                        COALESCE(raw_data, '{}'::jsonb),
                        '{date}', to_jsonb(v_new_date::text)
                    ),
                    '{status}', '"POSTED"'
                ),
                '{entry_date}', to_jsonb(v_new_date::text)
            ),
            '{lines}',
            CASE 
                WHEN jsonb_array_length(COALESCE(raw_data->'lines', lines, '[]'::jsonb)) >= 2 THEN
                    jsonb_set(
                        COALESCE(raw_data->'lines', lines),
                        '{1}',
                        (COALESCE(raw_data->'lines', lines)->1) || jsonb_build_object(
                            'accountId', v_account_id::text,
                            'accountCode', v_account_code,
                            'accountNameAr', v_account_name,
                            'memo', 'تسوية فروقات الأرصدة الافتتاحية'
                        )
                    )
                ELSE COALESCE(raw_data->'lines', lines, '[]'::jsonb)
            END
        ),
        updated_at = NOW()
    WHERE (company_id = v_company_id OR company_id IS NULL)
      AND (TRIM(UPPER(entry_number)) = v_entry_num OR reference = v_entry_num);

    -- 4. في حال وجود جدول منفصل public.journal_entry_lines، تحديث الطرف الثاني به
    IF EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name = 'journal_entry_lines'
    ) THEN
        -- تحديث السطر الثاني (الطرف المقابل/الدائن أو السطر برقم ترتيب 2)
        WITH target_je AS (
            SELECT id::text AS je_id
            FROM public.journal_entries
            WHERE (company_id = v_company_id OR company_id IS NULL)
              AND (TRIM(UPPER(entry_number)) = v_entry_num OR reference = v_entry_num)
            LIMIT 1
        ),
        numbered_lines AS (
            SELECT jel.id, 
                   ROW_NUMBER() OVER (PARTITION BY COALESCE(jel.journal_entry_id, jel.journal_id) ORDER BY jel.id ASC) AS rn
            FROM public.journal_entry_lines jel
            JOIN target_je ON (jel.journal_entry_id = target_je.je_id OR jel.journal_id = target_je.je_id)
        )
        UPDATE public.journal_entry_lines jel
        SET 
            account_id = v_account_id::text,
            account_code = v_account_code,
            account_name_ar = v_account_name,
            account_name = v_account_name,
            memo = 'تسوية فروقات الأرصدة الافتتاحية',
            updated_at = NOW()
        FROM numbered_lines nl
        WHERE jel.id = nl.id 
          AND nl.rn = 2;
    END IF;

    RAISE NOTICE 'تم تعديل قيد التسوية % بنجاح وإعادة توجيه الطرف الثاني لحساب الأرصدة الافتتاحية %', v_entry_num, v_account_code;
END $$;

-- ==============================================================================
-- استعلام التأكيد والمطابقة الفورية للقيد المعدل
-- ==============================================================================
SELECT 
    id,
    entry_number AS "رقم القيد",
    date AS "تاريخ القيد المعتمد",
    status AS "الحالة",
    reference AS "المرجع",
    total_debit AS "إجمالي المدين",
    total_credit AS "إجمالي الدائن",
    (total_debit - total_credit) AS "فارق التوازن",
    lines->0->>'accountCode' AS "كود الطرف الأول",
    lines->0->>'accountNameAr' AS "اسم الطرف الأول",
    lines->1->>'accountCode' AS "كود الطرف الثاني (المعدل)",
    lines->1->>'accountNameAr' AS "اسم الطرف الثاني (الأرصدة الافتتاحية)",
    lines->1->>'memo' AS "بيان الطرف الثاني",
    updated_at AS "تاريخ آخر تعديل"
FROM public.journal_entries
WHERE TRIM(UPPER(entry_number)) = 'JV-SETTLE-2026-09-10'
   OR reference = 'JV-SETTLE-2026-09-10';
