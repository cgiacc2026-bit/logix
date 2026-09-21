-- ==============================================================================
-- سكريبت التصحيح المحاسبي الشامل للأرصدة الافتتاحية للجمعيات والعملاء (31-08-2026)
-- مطابق 100% لكشف القيود الافتتاحية المعتمدة ومطابق لدفاتر التدقيق المالي
-- ==============================================================================
-- المنشأة: شركة مطحنة الوليد المتحدة ذ.م.م (20000000-0000-0000-0000-000000000001)
-- تاريخ الاعتماد: 2026-08-31
-- إجمالي الأرصدة الافتتاحية للمدينين (الجمعيات التعاونية): 21,002.545 د.ك
-- ==============================================================================

DO $$
DECLARE
    v_comp_uuid UUID := '20000000-0000-0000-0000-000000000001'::uuid;
    v_comp_id TEXT := '20000000-0000-0000-0000-000000000001';
    v_ob_date DATE := '2026-08-31'::date;
    v_acc_rec_id UUID;
    v_acc_cap_id UUID;
BEGIN
    RAISE NOTICE 'بدء تحديث وتثبيت الأرصدة الافتتاحية المعتمدة لجميع الجمعيات التعاونية...';

    -- البحث عن حساب الذمم المدينة (1120) وحساب رأس المال (3110)
    SELECT id INTO v_acc_rec_id FROM public.chart_of_accounts 
    WHERE (company_id = v_comp_uuid OR company_id::text = v_comp_id) AND code = '1120' LIMIT 1;
    
    SELECT id INTO v_acc_cap_id FROM public.chart_of_accounts 
    WHERE (company_id = v_comp_uuid OR company_id::text = v_comp_id) AND code = '3110' LIMIT 1;

    IF v_acc_rec_id IS NULL THEN
        v_acc_rec_id := 'c508c1b0-fc98-4fc6-badb-7559a1f382e5'::uuid;
    END IF;
    IF v_acc_cap_id IS NULL THEN
        v_acc_cap_id := '28d1df02-4e01-4475-ae90-c6517e4726ef'::uuid;
    END IF;

    -- ==============================================================================
    -- 1. تحديث جدول العملاء بالأرصدة الافتتاحية الدقيقة المعتمدة
    -- ==============================================================================
    -- 1) جمعية مبارك الكبير التعاونية (4640) -> 2497.990 د.ك
    UPDATE public.customers
    SET opening_balance = 2497.990,
        balance = 2497.990,
        raw_data = jsonb_set(
            jsonb_set(
                jsonb_set(COALESCE(raw_data, '{}'::jsonb), '{openingBalance}', '2497.990'::jsonb),
                '{openingBalanceDate}', '"2026-08-31"'::jsonb
            ),
            '{balance}', '2497.990'::jsonb
        ),
        updated_at = timezone('utc', now())
    WHERE (company_id = v_comp_uuid OR company_id::text = v_comp_id)
      AND (code = '4640' OR name_ar ILIKE '%مبارك الكبير%');

    -- 2) جمعية علي صباح السالم التعاونية (2537) -> 631.940 د.ك
    UPDATE public.customers
    SET opening_balance = 631.940,
        balance = 631.940,
        raw_data = jsonb_set(
            jsonb_set(
                jsonb_set(COALESCE(raw_data, '{}'::jsonb), '{openingBalance}', '631.940'::jsonb),
                '{openingBalanceDate}', '"2026-08-31"'::jsonb
            ),
            '{balance}', '631.940'::jsonb
        ),
        updated_at = timezone('utc', now())
    WHERE (company_id = v_comp_uuid OR company_id::text = v_comp_id)
      AND (code = '2537' OR name_ar ILIKE '%علي صباح السالم%');

    -- 3) جمعية بيان التعاونية (5563) -> 2397.130 د.ك
    UPDATE public.customers
    SET opening_balance = 2397.130,
        balance = 2397.130,
        raw_data = jsonb_set(
            jsonb_set(
                jsonb_set(COALESCE(raw_data, '{}'::jsonb), '{openingBalance}', '2397.130'::jsonb),
                '{openingBalanceDate}', '"2026-08-31"'::jsonb
            ),
            '{balance}', '2397.130'::jsonb
        ),
        updated_at = timezone('utc', now())
    WHERE (company_id = v_comp_uuid OR company_id::text = v_comp_id)
      AND (code = '5563' OR name_ar ILIKE '%بيان%');

    -- 4) جمعية الصباحية التعاونية (3124) -> 2487.840 د.ك
    UPDATE public.customers
    SET opening_balance = 2487.840,
        balance = 2487.840,
        raw_data = jsonb_set(
            jsonb_set(
                jsonb_set(COALESCE(raw_data, '{}'::jsonb), '{openingBalance}', '2487.840'::jsonb),
                '{openingBalanceDate}', '"2026-08-31"'::jsonb
            ),
            '{balance}', '2487.840'::jsonb
        ),
        updated_at = timezone('utc', now())
    WHERE (company_id = v_comp_uuid OR company_id::text = v_comp_id)
      AND (code = '3124' OR name_ar ILIKE '%الصباحية%');

    -- 5) جمعية صباح الناصر التعاونية (7575) -> 1001.870 د.ك
    UPDATE public.customers
    SET opening_balance = 1001.870,
        balance = 1001.870,
        raw_data = jsonb_set(
            jsonb_set(
                jsonb_set(COALESCE(raw_data, '{}'::jsonb), '{openingBalance}', '1001.870'::jsonb),
                '{openingBalanceDate}', '"2026-08-31"'::jsonb
            ),
            '{balance}', '1001.870'::jsonb
        ),
        updated_at = timezone('utc', now())
    WHERE (company_id = v_comp_uuid OR company_id::text = v_comp_id)
      AND (code = '7575' OR name_ar ILIKE '%صباح الناصر%');

    -- 6) جمعية اشبيلية التعاونية (1804) -> 702.189 د.ك
    UPDATE public.customers
    SET opening_balance = 702.189,
        balance = 702.189,
        raw_data = jsonb_set(
            jsonb_set(
                jsonb_set(COALESCE(raw_data, '{}'::jsonb), '{openingBalance}', '702.189'::jsonb),
                '{openingBalanceDate}', '"2026-08-31"'::jsonb
            ),
            '{balance}', '702.189'::jsonb
        ),
        updated_at = timezone('utc', now())
    WHERE (company_id = v_comp_uuid OR company_id::text = v_comp_id)
      AND (code = '1804' OR name_ar ILIKE '%اشبيلية%');

    -- 7) جمعية مدينة سعد العبدالله التعاونية (2035) -> 905.940 د.ك
    UPDATE public.customers
    SET opening_balance = 905.940,
        balance = 905.940,
        raw_data = jsonb_set(
            jsonb_set(
                jsonb_set(COALESCE(raw_data, '{}'::jsonb), '{openingBalance}', '905.940'::jsonb),
                '{openingBalanceDate}', '"2026-08-31"'::jsonb
            ),
            '{balance}', '905.940'::jsonb
        ),
        updated_at = timezone('utc', now())
    WHERE (company_id = v_comp_uuid OR company_id::text = v_comp_id)
      AND (code = '2035' OR name_ar ILIKE '%سعد العبدالله%');

    -- 8) جمعية شمال غرب الصليبيخات التعاونية (301) -> 3047.530 د.ك
    UPDATE public.customers
    SET opening_balance = 3047.530,
        balance = 3047.530,
        raw_data = jsonb_set(
            jsonb_set(
                jsonb_set(COALESCE(raw_data, '{}'::jsonb), '{openingBalance}', '3047.530'::jsonb),
                '{openingBalanceDate}', '"2026-08-31"'::jsonb
            ),
            '{balance}', '3047.530'::jsonb
        ),
        updated_at = timezone('utc', now())
    WHERE (company_id = v_comp_uuid OR company_id::text = v_comp_id)
      AND (code = '301' OR name_ar ILIKE '%الصليبيخات%');

    -- 9) جمعية الأحمدي التعاونية (875) -> 839.813 د.ك
    UPDATE public.customers
    SET opening_balance = 839.813,
        balance = 839.813,
        raw_data = jsonb_set(
            jsonb_set(
                jsonb_set(COALESCE(raw_data, '{}'::jsonb), '{openingBalance}', '839.813'::jsonb),
                '{openingBalanceDate}', '"2026-08-31"'::jsonb
            ),
            '{balance}', '839.813'::jsonb
        ),
        updated_at = timezone('utc', now())
    WHERE (company_id = v_comp_uuid OR company_id::text = v_comp_id)
      AND (code = '875' OR name_ar ILIKE '%الأحمدي%' OR name_ar ILIKE '%الاحمدي%');

    -- 10) جمعية الجليب التعاونية (9407) -> 2359.780 د.ك
    UPDATE public.customers
    SET opening_balance = 2359.780,
        balance = 2359.780,
        raw_data = jsonb_set(
            jsonb_set(
                jsonb_set(COALESCE(raw_data, '{}'::jsonb), '{openingBalance}', '2359.780'::jsonb),
                '{openingBalanceDate}', '"2026-08-31"'::jsonb
            ),
            '{balance}', '2359.780'::jsonb
        ),
        updated_at = timezone('utc', now())
    WHERE (company_id = v_comp_uuid OR company_id::text = v_comp_id)
      AND (code = '9407' OR name_ar ILIKE '%الجليب%');

    -- 11) جمعية صباح الأحمد التعاونية (3900) -> 1508.050 د.ك
    UPDATE public.customers
    SET opening_balance = 1508.050,
        balance = 1508.050,
        raw_data = jsonb_set(
            jsonb_set(
                jsonb_set(COALESCE(raw_data, '{}'::jsonb), '{openingBalance}', '1508.050'::jsonb),
                '{openingBalanceDate}', '"2026-08-31"'::jsonb
            ),
            '{balance}', '1508.050'::jsonb
        ),
        updated_at = timezone('utc', now())
    WHERE (company_id = v_comp_uuid OR company_id::text = v_comp_id)
      AND (code = '3900' OR name_ar ILIKE '%صباح الأحمد%' OR name_ar ILIKE '%صباح الاحمد%');

    -- 12) جمعية القيروان التعاونية (4568) -> 1702.393 د.ك
    UPDATE public.customers
    SET opening_balance = 1702.393,
        balance = 1702.393,
        raw_data = jsonb_set(
            jsonb_set(
                jsonb_set(COALESCE(raw_data, '{}'::jsonb), '{openingBalance}', '1702.393'::jsonb),
                '{openingBalanceDate}', '"2026-08-31"'::jsonb
            ),
            '{balance}', '1702.393'::jsonb
        ),
        updated_at = timezone('utc', now())
    WHERE (company_id = v_comp_uuid OR company_id::text = v_comp_id)
      AND (code = '4568' OR name_ar ILIKE '%القيروان%');

    -- 13) جمعية مشرف التعاونية (CUST-014) -> 76.930 د.ك
    UPDATE public.customers
    SET opening_balance = 76.930,
        balance = 76.930,
        raw_data = jsonb_set(
            jsonb_set(
                jsonb_set(COALESCE(raw_data, '{}'::jsonb), '{openingBalance}', '76.930'::jsonb),
                '{openingBalanceDate}', '"2026-08-31"'::jsonb
            ),
            '{balance}', '76.930'::jsonb
        ),
        updated_at = timezone('utc', now())
    WHERE (company_id = v_comp_uuid OR company_id::text = v_comp_id)
      AND (code = 'CUST-014' OR name_ar ILIKE '%مشرف%');

    -- 14) جمعية سلوى التعاونية (3764) -> 843.150 د.ك
    UPDATE public.customers
    SET opening_balance = 843.150,
        balance = 843.150,
        raw_data = jsonb_set(
            jsonb_set(
                jsonb_set(COALESCE(raw_data, '{}'::jsonb), '{openingBalance}', '843.150'::jsonb),
                '{openingBalanceDate}', '"2026-08-31"'::jsonb
            ),
            '{balance}', '843.150'::jsonb
        ),
        updated_at = timezone('utc', now())
    WHERE (company_id = v_comp_uuid OR company_id::text = v_comp_id)
      AND (code = '3764' OR name_ar ILIKE '%سلوى%');

    -- 15) جمعية المطلاع التعاونية (00189) -> 0.000 د.ك
    UPDATE public.customers
    SET opening_balance = 0.000,
        raw_data = jsonb_set(
            jsonb_set(COALESCE(raw_data, '{}'::jsonb), '{openingBalance}', '0'::jsonb),
            '{openingBalanceDate}', '"2026-08-31"'::jsonb
        ),
        updated_at = timezone('utc', now())
    WHERE (company_id = v_comp_uuid OR company_id::text = v_comp_id)
      AND (code = '00189' OR name_ar ILIKE '%المطلاع%');

    RAISE NOTICE '✅ تم تحديث وتثبيت كافة الأرصدة الافتتاحية في جدول العملاء بنجاح!';
END $$;
