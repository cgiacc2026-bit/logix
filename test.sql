DO $$
DECLARE
  v_voucher RECORD;
  v_liquid_acc RECORD;
  p_company_id UUID;
BEGIN
  -- 3. البحث عن حساب البنك أو الصندوق المستهدف في الدليل المحاسبي
    -- الأولوية: مطابقة ID ثم مطابقة Code ثم البحث عن بنك/صندوق
    SELECT id, code, name_ar, normal_balance INTO v_liquid_acc
    FROM public.chart_of_accounts
    WHERE company_id = p_company_id
      AND (id::text = v_voucher.account_id::text OR code::text = v_voucher.account_id::text)
    LIMIT 1;
END;
$$;
