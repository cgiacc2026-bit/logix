-- ==============================================================================
-- أمر تنظيف ومسح القيود والفواتير السابقة لتاريخ 31-08-2026
-- مع الإبقاء التام على القيود والأرصدة الافتتاحية كبداية وحيدة للنظام
-- ==============================================================================
-- تاريخ التنفيذ المستهدف: 31-08-2026
-- المنشأة: مطحنة الوليد المتحدة (20000000-0000-0000-0000-000000000001)
-- ==============================================================================

DO $$
DECLARE
    v_comp_id TEXT := '20000000-0000-0000-0000-000000000001';
    v_comp_uuid UUID := '20000000-0000-0000-0000-000000000001'::uuid;
    v_cutoff_date DATE := '2026-08-31'::date;
    
    v_updated_ob_count INT := 0;
    v_deleted_invoices_count INT := 0;
    v_deleted_vouchers_count INT := 0;
    v_deleted_journals_count INT := 0;
    v_preserved_ob_count INT := 0;
BEGIN
    RAISE NOTICE 'بدء عملية تنظيف العمليات المحاسبية وتوحيد بداية النظام على القيد الافتتاحي بتاريخ %...', v_cutoff_date;

    -- --------------------------------------------------------------------------
    -- 1. توحيد وضمان تاريخ كافة القيود الافتتاحية لتصبح بتاريخ 31-08-2026 (مثل قيد القيروان JV-2026-0012)
    -- --------------------------------------------------------------------------
    IF to_regclass('public.journal_entries') IS NOT NULL THEN
        UPDATE public.journal_entries
        SET 
            date = v_cutoff_date,
            raw_data = jsonb_set(
                COALESCE(raw_data, '{}'::jsonb), 
                '{date}', 
                to_jsonb(to_char(v_cutoff_date, 'YYYY-MM-DD'))
            ),
            updated_at = timezone('utc', now())
        WHERE (company_id = v_comp_uuid OR company_id::text = v_comp_id)
          AND (
              description ILIKE '%افتتاح%'
              OR reference ILIKE '%OB%'
              OR reference ILIKE '%افتتاح%'
              OR reference ILIKE 'e5172291%'
              OR entry_number ILIKE 'JV-2026-00%'
              OR entry_number ~ '^JV-2026-00(0[1-9]|1[0-4])$'
          );
        GET DIAGNOSTICS v_updated_ob_count = ROW_COUNT;
        RAISE NOTICE 'تم توحيد وحماية % قيد افتتاحي لتبدأ بتاريخ %', v_updated_ob_count, v_cutoff_date;
    END IF;

    -- --------------------------------------------------------------------------
    -- 2. حذف بنود الفواتير والفواتير السابقة لتاريخ 31-08-2026
    -- --------------------------------------------------------------------------
    IF to_regclass('public.invoice_items') IS NOT NULL AND to_regclass('public.invoices') IS NOT NULL THEN
        DELETE FROM public.invoice_items
        WHERE invoice_id IN (
            SELECT id FROM public.invoices
            WHERE (company_id = v_comp_uuid OR company_id::text = v_comp_id)
              AND (
                  (invoice_date IS NOT NULL AND invoice_date < v_cutoff_date)
                  OR (date IS NOT NULL AND date < v_cutoff_date)
              )
        );
    END IF;

    IF to_regclass('public.invoices') IS NOT NULL THEN
        DELETE FROM public.invoices
        WHERE (company_id = v_comp_uuid OR company_id::text = v_comp_id)
          AND (
              (invoice_date IS NOT NULL AND invoice_date < v_cutoff_date)
              OR (date IS NOT NULL AND date < v_cutoff_date)
          );
        GET DIAGNOSTICS v_deleted_invoices_count = ROW_COUNT;
        RAISE NOTICE 'تم مسح % فاتورة سابقة لتاريخ %', v_deleted_invoices_count, v_cutoff_date;
    END IF;

    -- --------------------------------------------------------------------------
    -- 3. حذف سندات القبض والصرف السابقة لتاريخ 31-08-2026
    -- --------------------------------------------------------------------------
    IF to_regclass('public.payment_vouchers') IS NOT NULL THEN
        DELETE FROM public.payment_vouchers
        WHERE (company_id = v_comp_uuid OR company_id::text = v_comp_id)
          AND (date < v_cutoff_date);
        GET DIAGNOSTICS v_deleted_vouchers_count = ROW_COUNT;
        RAISE NOTICE 'تم مسح % سند قبض/صرف سابق لتاريخ %', v_deleted_vouchers_count, v_cutoff_date;
    END IF;

    IF to_regclass('public.vouchers') IS NOT NULL THEN
        DELETE FROM public.vouchers
        WHERE (company_id = v_comp_uuid OR company_id::text = v_comp_id)
          AND (date < v_cutoff_date);
    END IF;

    -- --------------------------------------------------------------------------
    -- 4. حذف قيود اليومية السابقة لتاريخ 31-08-2026 (باستثناء القيود الافتتاحية)
    -- --------------------------------------------------------------------------
    IF to_regclass('public.journal_entry_lines') IS NOT NULL AND to_regclass('public.journal_entries') IS NOT NULL THEN
        DELETE FROM public.journal_entry_lines
        WHERE journal_entry_id IN (
            SELECT id FROM public.journal_entries
            WHERE (company_id = v_comp_uuid OR company_id::text = v_comp_id)
              AND date < v_cutoff_date
              AND NOT (
                  description ILIKE '%افتتاح%'
                  OR reference ILIKE '%OB%'
                  OR reference ILIKE '%افتتاح%'
                  OR reference ILIKE 'e5172291%'
                  OR entry_number ILIKE 'JV-2026-00%'
                  OR entry_number ~ '^JV-2026-00(0[1-9]|1[0-4])$'
              )
        );
    END IF;

    IF to_regclass('public.journal_entries') IS NOT NULL THEN
        DELETE FROM public.journal_entries
        WHERE (company_id = v_comp_uuid OR company_id::text = v_comp_id)
          AND date < v_cutoff_date
          AND NOT (
              description ILIKE '%افتتاح%'
              OR reference ILIKE '%OB%'
              OR reference ILIKE '%افتتاح%'
              OR reference ILIKE 'e5172291%'
              OR entry_number ILIKE 'JV-2026-00%'
              OR entry_number ~ '^JV-2026-00(0[1-9]|1[0-4])$'
          );
        GET DIAGNOSTICS v_deleted_journals_count = ROW_COUNT;
        RAISE NOTICE 'تم مسح % قيد يومية سابق لتاريخ % (تم الحفاظ الكامل على القيود الافتتاحية)', v_deleted_journals_count, v_cutoff_date;
    END IF;

    -- --------------------------------------------------------------------------
    -- 5. تحديث تاريخ الأرصدة الافتتاحية لبطاقات العملاء والموردين إلى 31-08-2026
    -- --------------------------------------------------------------------------
    IF to_regclass('public.customers') IS NOT NULL THEN
        UPDATE public.customers
        SET 
            raw_data = jsonb_set(
                COALESCE(raw_data, '{}'::jsonb), 
                '{openingBalanceDate}', 
                '"2026-08-31"'::jsonb
            )
        WHERE (company_id = v_comp_uuid OR company_id::text = v_comp_id)
          AND (opening_balance > 0 OR (raw_data->>'openingBalance')::numeric > 0);
    END IF;

    -- --------------------------------------------------------------------------
    -- 6. إحصائية القيود الافتتاحية المتبقية
    -- --------------------------------------------------------------------------
    IF to_regclass('public.journal_entries') IS NOT NULL THEN
        SELECT COUNT(*) INTO v_preserved_ob_count
        FROM public.journal_entries
        WHERE (company_id = v_comp_uuid OR company_id::text = v_comp_id)
          AND (
              description ILIKE '%افتتاح%'
              OR reference ILIKE '%OB%'
              OR entry_number ~ '^JV-2026-00(0[1-9]|1[0-4])$'
          );
        RAISE NOTICE '---------------------------------------------------------';
        RAISE NOTICE '✅ اكتملت العملية بنجاح!';
        RAISE NOTICE 'عدد الفواتير المحذوفة: %', v_deleted_invoices_count;
        RAISE NOTICE 'عدد السندات المحذوفة: %', v_deleted_vouchers_count;
        RAISE NOTICE 'عدد القيود المحذوفة: %', v_deleted_journals_count;
        RAISE NOTICE 'عدد القيود الافتتاحية المعتمدة المؤكدة بتاريخ 31-08-2026: %', v_preserved_ob_count;
        RAISE NOTICE '---------------------------------------------------------';
    END IF;
END $$;
