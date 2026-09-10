-- ==============================================================================
-- 1) إصلاح دالة المشغّل التلقائي لمنع التكرار اللانهائي (Recursion Check)
-- ==============================================================================
CREATE OR REPLACE FUNCTION trg_fn_sync_voucher_to_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- صمام الأمان: منع التكرار اللانهائي إذا تم الاستدعاء من داخل نفس المعاملة (Recursion Depth > 1)
    IF pg_trigger_depth() > 1 THEN
        RETURN NEW;
    END IF;

    -- إذا كان التحديث لم يؤثر إلا على حالة الترحيل، نتجاوز
    IF TG_OP = 'UPDATE' THEN
        IF OLD.is_posted IS DISTINCT FROM NEW.is_posted 
           AND OLD.amount = NEW.amount 
           AND OLD.account_id = NEW.account_id 
           AND OLD.status = NEW.status THEN
            RETURN NEW;
        END IF;
    END IF;

    -- استدعاء دالة الترحيل المحاسبي اللحظي
    PERFORM post_voucher_to_ledger(CAST(NEW.id AS text), NEW.company_id);
    
    RETURN NEW;
END;
$$;

-- إعادة إنشاء التريجر كإجراء احترازي لضمان ارتباطه بالدالة الجديدة
DROP TRIGGER IF EXISTS trg_payment_vouchers_ledger_sync ON public.payment_vouchers;
CREATE TRIGGER trg_payment_vouchers_ledger_sync
    AFTER INSERT OR UPDATE OF amount, account_id, entity_id, entity_name, type, status, date
    ON public.payment_vouchers
    FOR EACH ROW
    EXECUTE FUNCTION trg_fn_sync_voucher_to_ledger();

-- ==============================================================================
-- 2) تشغيل فوري لترحيل كافة السندات الحالية في قاعدة البيانات (Immediate Execution)
-- ==============================================================================
SELECT sync_all_vouchers_to_ledger();
