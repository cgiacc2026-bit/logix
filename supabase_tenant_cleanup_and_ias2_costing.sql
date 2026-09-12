-- ============================================================================
-- LOGIX ERP: MASTER TENANT CLEANUP & IAS-2 WEIGHTED AVERAGE COSTING ENGINE
-- Standard: International Accounting Standard 2 (IAS 2) - Inventories
-- Target: Supabase Cloud Database (PostgreSQL)
-- Currency: Kuwaiti Dinar (KWD) - 3 Decimal Places Precision (0.000)
-- ============================================================================

-- ============================================================================
-- PART 1: TENANT PURGE & MULTI-COMPANY LOCKDOWN
-- ============================================================================

-- 1.1 Ensure canonical companies exist with correct profiles and UUIDs
INSERT INTO public.companies (
  id,
  company_name,
  owner_email,
  status,
  is_active,
  type,
  login_code,
  functional_currency,
  profile_data,
  created_at,
  updated_at
)
VALUES
  -- 1. Al-Waleed Mill (Production Account - Unchanged Data Integrity)
  (
    '20000000-0000-0000-0000-000000000001'::uuid,
    'شركة مطحنة الوليد المتحده',
    'alwaleed.mill@logixerp.com',
    'active',
    true,
    'client',
    '450912',
    'KWD',
    jsonb_build_object(
      'id', '20000000-0000-0000-0000-000000000001',
      'nameAr', 'شركة مطحنة الوليد المتحده',
      'nameEn', 'Al-Waleed United Mill & Food Industries',
      'tradeName', 'مطحنة الوليد للبهارات والمواد التموينية والصناعات الغذائية',
      'legalForm', 'شركة ذات مسؤولية محدودة (ذ.م.م)',
      'crNumber', '450912',
      'chamberNumber', '78214',
      'functionalCurrency', 'KWD',
      'currency', 'KWD',
      'decimalPlaces', 3,
      'vatRate', 0,
      'city', 'الكويت',
      'country', 'دولة الكويت',
      'streetName', 'شارع الغزالي',
      'buildingNo', 'قسيمة 42',
      'district', 'منطقة الري الصناعية',
      'phone', '+965 2484 1888',
      'email', 'cgiacc2026@gmail.com',
      'generalManager', 'د. خالد السليمان',
      'financialManager', 'أ. محمد الشمري',
      'chiefAccountant', 'أ. محمد الشمري',
      'headerNotes', 'مستند تجاري ومالي رسمي معتمد • مطحنة الوليد المتحدة • دولة الكويت'
    ),
    NOW(),
    NOW()
  ),
  -- 2. Logix Solutions (Official System Owner Entity)
  (
    '10000000-0000-0000-0000-000000000001'::uuid,
    'شركة لوجيكس للحلول البرمجية (Logix Solutions)',
    'cgiacc2026@gmail.com',
    'active',
    true,
    'system',
    'logix',
    'KWD',
    jsonb_build_object(
      'id', '10000000-0000-0000-0000-000000000001',
      'nameAr', 'شركة لوجيكس للحلول البرمجية (Logix Solutions)',
      'nameEn', 'Logix Solutions Software & Cloud Systems Co. W.L.L',
      'tradeName', 'لوجيكس للحلول البرمجية وتخطيط موارد المؤسسات',
      'legalForm', 'شركة ذات مسؤولية محدودة (ذ.م.م)',
      'taxNumber', '300100200300003',
      'crNumber', '554433',
      'chamberNumber', '99112',
      'functionalCurrency', 'KWD',
      'currency', 'KWD',
      'decimalPlaces', 3,
      'vatRate', 0,
      'city', 'مدينة الكويت',
      'country', 'دولة الكويت',
      'streetName', 'شارع أحمد الجابر - برج الراية',
      'buildingNo', 'طابق 24',
      'district', 'شرق',
      'phone', '+965 2200 8800',
      'email', 'cgiacc2026@gmail.com',
      'generalManager', 'المشرف العام (CGI Admin)',
      'financialManager', 'أ. عبد العزيز الكندري',
      'chiefAccountant', 'أ. طارق الفهد',
      'headerNotes', 'المنشأة الرسمية لشركة لوجيكس للحلول البرمجية لإدارة الإيرادات والمصروفات'
    ),
    NOW(),
    NOW()
  ),
  -- 3. Demo Company (Isolated Sandbox Testing & Demonstration)
  (
    '00000000-0000-0000-0000-000000000099'::uuid,
    'شركة تجريبية (Demo Company)',
    'logixdemo@logix.com',
    'active',
    true,
    'demo',
    'demo',
    'KWD',
    jsonb_build_object(
      'id', '00000000-0000-0000-0000-000000000099',
      'nameAr', 'شركة تجريبية (Demo Company)',
      'nameEn', 'Logix Demo Company (Sandbox Environment)',
      'tradeName', 'بيئة تجريبية معزولة مخصصة للتجربة والعرض',
      'legalForm', 'شركة ذات مسؤولية محدودة',
      'taxNumber', '310098765400003',
      'crNumber', '1010998877',
      'chamberNumber', '88200',
      'functionalCurrency', 'KWD',
      'currency', 'KWD',
      'decimalPlaces', 3,
      'vatRate', 0,
      'city', 'الكويت',
      'country', 'دولة الكويت',
      'streetName', 'طريق المطار الدولي',
      'buildingNo', 'مجمع واحة العرض التجريبي',
      'district', 'الفروانية',
      'phone', '+965 2200 8899',
      'email', 'logixdemo@logix.com',
      'generalManager', 'م. فهد السالم (مدير عام تجريبي)',
      'financialManager', 'أ. ريم المطيري (المدير المالي)',
      'chiefAccountant', 'أ. عمر الدوسري (رئيس الحسابات)',
      'headerNotes', 'بيئة تجريبية معزولة مخصصة للتجربة والاختبار وعرض الميزات'
    ),
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO UPDATE SET
  company_name = EXCLUDED.company_name,
  owner_email = EXCLUDED.owner_email,
  status = EXCLUDED.status,
  is_active = EXCLUDED.is_active,
  type = EXCLUDED.type,
  login_code = EXCLUDED.login_code,
  functional_currency = EXCLUDED.functional_currency,
  profile_data = EXCLUDED.profile_data,
  updated_at = NOW();

-- 1.2 Purge and delete any legacy or experimental companies with CASCADE
DELETE FROM public.companies
WHERE id NOT IN (
  '20000000-0000-0000-0000-000000000001'::uuid,
  '10000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000099'::uuid
);


-- ============================================================================
-- PART 2: IAS 2 MOVING WEIGHTED AVERAGE COSTING (MAC) DATABASE ENGINE
-- ============================================================================

-- 2.1 Pure calculation function for IAS-2 Moving Weighted Average Cost
CREATE OR REPLACE FUNCTION public.fn_calculate_moving_average_cost(
  p_current_qty NUMERIC,
  p_current_cost NUMERIC,
  p_incoming_qty NUMERIC,
  p_purchase_price NUMERIC
)
RETURNS NUMERIC(15, 3) AS $$
DECLARE
  v_q0 NUMERIC := COALESCE(p_current_qty, 0);
  v_c0 NUMERIC := COALESCE(p_current_cost, 0);
  v_qin NUMERIC := COALESCE(p_incoming_qty, 0);
  v_pin NUMERIC := COALESCE(p_purchase_price, 0);
  v_new_avg NUMERIC;
BEGIN
  -- No incoming stock
  IF v_qin <= 0 THEN
    RETURN ROUND(v_c0, 3);
  END IF;

  -- Edge Case: Current stock is zero or negative (IAS 2: incoming purchase becomes base cost)
  IF v_q0 <= 0 THEN
    RETURN ROUND(v_pin, 3);
  END IF;

  -- Formula: (Q0 * C0 + Qin * Pin) / (Q0 + Qin)
  v_new_avg := ((v_q0 * v_c0) + (v_qin * v_pin)) / (v_q0 + v_qin);
  
  RETURN ROUND(v_new_avg, 3);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2.2 Trigger Function: Automatically updates items' cost_price upon purchase invoice posting
CREATE OR REPLACE FUNCTION public.fn_apply_moving_average_cost_on_purchase()
RETURNS TRIGGER AS $$
DECLARE
  v_line RECORD;
  v_item_id TEXT;
  v_incoming_qty NUMERIC;
  v_purchase_price NUMERIC;
  v_current_qty NUMERIC;
  v_current_cost NUMERIC;
  v_new_cost NUMERIC(15, 3);
BEGIN
  -- Only execute for PURCHASE invoices when status is POSTED or changed to POSTED
  IF (NEW.type = 'PURCHASE') AND (NEW.status = 'POSTED') THEN
    IF NEW.raw_data IS NOT NULL AND NEW.raw_data ? 'lines' THEN
      FOR v_line IN 
        SELECT * FROM jsonb_to_recordset(NEW.raw_data->'lines') AS (
          "itemId" TEXT,
          "itemSku" TEXT,
          "barcode" TEXT,
          "quantity" NUMERIC,
          "unitPrice" NUMERIC
        )
      LOOP
        v_incoming_qty := COALESCE(v_line."quantity", 0);
        v_purchase_price := COALESCE(v_line."unitPrice", 0);

        IF v_incoming_qty > 0 THEN
          -- Retrieve current balance and current cost
          SELECT 
            COALESCE(current_balance, qty_on_hand, 0),
            COALESCE(cost_price, 0)
          INTO v_current_qty, v_current_cost
          FROM public.items
          WHERE 
            (id::text = v_line."itemId" 
             OR code = v_line."itemSku" 
             OR barcode = v_line."barcode")
            AND company_id = NEW.company_id
          LIMIT 1;

          IF FOUND THEN
            -- Calculate new moving weighted average cost
            v_new_cost := public.fn_calculate_moving_average_cost(
              v_current_qty,
              v_current_cost,
              v_incoming_qty,
              v_purchase_price
            );

            -- Atomically update cost_price in items table
            UPDATE public.items
            SET 
              cost_price = v_new_cost,
              updated_at = NOW(),
              raw_data = jsonb_set(
                jsonb_set(COALESCE(raw_data, '{}'::jsonb), '{costPrice}', to_jsonb(v_new_cost)),
                '{purchasePrice}', to_jsonb(v_new_cost)
              )
            WHERE 
              (id::text = v_line."itemId" 
               OR code = v_line."itemSku" 
               OR barcode = v_line."barcode")
              AND company_id = NEW.company_id;
          END IF;
        END IF;
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2.3 Attach Trigger to Invoices Table
DROP TRIGGER IF EXISTS trg_apply_moving_average_cost_on_purchase ON public.invoices;
CREATE TRIGGER trg_apply_moving_average_cost_on_purchase
AFTER INSERT OR UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.fn_apply_moving_average_cost_on_purchase();

-- 2.4 Add optimized indexes for instant tenant filtering and inventory valuation
CREATE INDEX IF NOT EXISTS idx_items_company_cost ON public.items(company_id, cost_price);
CREATE INDEX IF NOT EXISTS idx_invoices_company_type_status ON public.invoices(company_id, type, status);

-- Audit confirmation
COMMENT ON FUNCTION public.fn_calculate_moving_average_cost IS 'IAS 2 Moving Weighted Average Cost (MAC) calculation engine for ERP inventory';
COMMENT ON TRIGGER trg_apply_moving_average_cost_on_purchase ON public.invoices IS 'IAS 2 Automatic trigger to update item cost_price on purchase invoice creation';
