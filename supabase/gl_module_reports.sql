-- ============================================================================
-- LOGIX ERP: GENERAL LEDGER INTEGRATED MODULE REPORTS (SQL / SUPABASE FUNCTIONS)
-- ============================================================================
-- Strict Single Source of Truth: chart_of_accounts & journal_entries
-- 1. get_customer_balances_gl: Customer Balances from Account 1120
-- 2. get_inventory_valuation_gl: Inventory Valuation from Account 1130 & 5100
-- 3. get_posted_sales_gl: Posted Sales from Account 4100
-- ============================================================================

-- Defensive schema check to ensure journal_entry_id exists unconditionally
CREATE TABLE IF NOT EXISTS public.journal_entry_lines (
    id TEXT PRIMARY KEY DEFAULT ('jel-' || substring(replace(gen_random_uuid()::text, '-', ''), 1, 9)),
    company_id UUID,
    journal_entry_id TEXT,
    journal_id TEXT,
    account_id TEXT,
    account_code TEXT,
    account_name_ar TEXT,
    debit NUMERIC(18, 4) DEFAULT 0,
    credit NUMERIC(18, 4) DEFAULT 0
);

ALTER TABLE public.journal_entry_lines ADD COLUMN IF NOT EXISTS company_id UUID;
ALTER TABLE public.journal_entry_lines ADD COLUMN IF NOT EXISTS journal_entry_id TEXT;
ALTER TABLE public.journal_entry_lines ADD COLUMN IF NOT EXISTS journal_id TEXT;
ALTER TABLE public.journal_entry_lines ADD COLUMN IF NOT EXISTS account_id TEXT;
ALTER TABLE public.journal_entry_lines ADD COLUMN IF NOT EXISTS account_code TEXT;
ALTER TABLE public.journal_entry_lines ADD COLUMN IF NOT EXISTS account_name_ar TEXT;
ALTER TABLE public.journal_entry_lines ADD COLUMN IF NOT EXISTS debit NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.journal_entry_lines ADD COLUMN IF NOT EXISTS credit NUMERIC(18, 4) DEFAULT 0;

UPDATE public.journal_entry_lines 
SET journal_entry_id = journal_id::text 
WHERE (journal_entry_id IS NULL OR journal_entry_id = '') AND journal_id IS NOT NULL;

UPDATE public.journal_entry_lines 
SET journal_id = journal_entry_id::text 
WHERE (journal_id IS NULL OR journal_id = '') AND journal_entry_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 1. FUNCTION: get_customer_balances_gl
-- ----------------------------------------------------------------------------
-- Calculates customer balances strictly using:
-- Net Balance = Opening Balance + Sum(Posted Debits on 1120) - Sum(Posted Credits on 1120)
CREATE OR REPLACE FUNCTION get_customer_balances_gl(
    p_company_id UUID,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
    customer_id UUID,
    customer_code TEXT,
    customer_name_ar TEXT,
    phone TEXT,
    opening_balance NUMERIC,
    total_debit NUMERIC,
    total_credit NUMERIC,
    net_balance NUMERIC,
    movements_count BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH customer_movements AS (
        SELECT 
            c.id AS cust_id,
            COALESCE(c.opening_balance, 0) AS open_bal,
            COALESCE(SUM(CASE 
                WHEN jel.account_code = '1120' OR a.code = '1120' THEN jel.debit 
                ELSE 0 
            END), 0) AS period_debit,
            COALESCE(SUM(CASE 
                WHEN jel.account_code = '1120' OR a.code = '1120' THEN jel.credit 
                ELSE 0 
            END), 0) AS period_credit,
            COUNT(jel.id) AS mvs_count
        FROM customers c
        LEFT JOIN invoices inv ON inv.entity_id = c.id AND inv.status = 'POSTED' AND inv.company_id = p_company_id
        LEFT JOIN journal_entries je ON (je.source_id = inv.id OR je.reference = inv.invoice_number OR je.entity_id = c.id)
            AND je.company_id = p_company_id
            AND je.status = 'POSTED'
            AND (p_start_date IS NULL OR je.date >= p_start_date)
            AND (p_end_date IS NULL OR je.date <= p_end_date)
        LEFT JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
        LEFT JOIN chart_of_accounts a ON a.id = jel.account_id
        WHERE c.company_id = p_company_id
        GROUP BY c.id, c.opening_balance
    )
    SELECT 
        c.id AS customer_id,
        COALESCE(c.code, c.id::text) AS customer_code,
        COALESCE(c.name_ar, c.name, 'عميل') AS customer_name_ar,
        COALESCE(c.phone, '') AS phone,
        COALESCE(cm.open_bal, 0)::NUMERIC AS opening_balance,
        COALESCE(cm.period_debit, 0)::NUMERIC AS total_debit,
        COALESCE(cm.period_credit, 0)::NUMERIC AS total_credit,
        (COALESCE(cm.open_bal, 0) + COALESCE(cm.period_debit, 0) - COALESCE(cm.period_credit, 0))::NUMERIC AS net_balance,
        COALESCE(cm.mvs_count, 0)::BIGINT AS movements_count
    FROM customers c
    LEFT JOIN customer_movements cm ON cm.cust_id = c.id
    WHERE c.company_id = p_company_id
    ORDER BY net_balance DESC;
END;
$$;


-- ----------------------------------------------------------------------------
-- 2. FUNCTION: get_inventory_valuation_gl
-- ----------------------------------------------------------------------------
-- Calculates item inventory valuation and reconciles with GL Account 1130 and 5100
CREATE OR REPLACE FUNCTION get_inventory_valuation_gl(
    p_company_id UUID
)
RETURNS TABLE (
    item_id UUID,
    sku TEXT,
    name_ar TEXT,
    category TEXT,
    unit TEXT,
    quantity_on_hand NUMERIC,
    weighted_avg_cost NUMERIC,
    total_book_value NUMERIC,
    gl_account_1130_balance NUMERIC,
    cogs_account_5100_total NUMERIC,
    is_reconciled BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_gl_1130_balance NUMERIC := 0;
    v_gl_5100_debit NUMERIC := 0;
    v_total_subledger NUMERIC := 0;
BEGIN
    -- 1. Query GL Account 1130 (Inventory Asset) Net Debit
    SELECT COALESCE(SUM(jel.debit - jel.credit), 0)
    INTO v_gl_1130_balance
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.journal_entry_id
    WHERE je.company_id = p_company_id
      AND je.status = 'POSTED'
      AND (jel.account_code = '1130' OR jel.account_id IN (
          SELECT id FROM chart_of_accounts WHERE company_id = p_company_id AND code = '1130'
      ));

    -- 2. Query GL Account 5100 (COGS) Net Debit
    SELECT COALESCE(SUM(jel.debit - jel.credit), 0)
    INTO v_gl_5100_debit
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.journal_entry_id
    WHERE je.company_id = p_company_id
      AND je.status = 'POSTED'
      AND (jel.account_code = '5100' OR jel.account_id IN (
          SELECT id FROM chart_of_accounts WHERE company_id = p_company_id AND code = '5100'
      ));

    -- 3. Return Item Rows with Live Quantities & WAC
    RETURN QUERY
    SELECT 
        i.id AS item_id,
        COALESCE(i.code, i.sku, i.id::text) AS sku,
        COALESCE(i.name_ar, i.name, 'صنف') AS name_ar,
        COALESCE(i.category, 'عام') AS category,
        COALESCE(i.unit, 'حبة') AS unit,
        COALESCE(i.quantity, i.current_stock, 0)::NUMERIC AS quantity_on_hand,
        COALESCE(i.cost_price, i.purchase_price, 0)::NUMERIC AS weighted_avg_cost,
        (COALESCE(i.quantity, i.current_stock, 0) * COALESCE(i.cost_price, i.purchase_price, 0))::NUMERIC AS total_book_value,
        v_gl_1130_balance AS gl_account_1130_balance,
        v_gl_5100_debit AS cogs_account_5100_total,
        (ABS((SELECT COALESCE(SUM(sub.qty * sub.cost), 0) FROM (
            SELECT COALESCE(it.quantity, it.current_stock, 0) as qty, COALESCE(it.cost_price, it.purchase_price, 0) as cost 
            FROM items it WHERE it.company_id = p_company_id
        ) sub) - v_gl_1130_balance) < 0.05) AS is_reconciled
    FROM items i
    WHERE i.company_id = p_company_id
    ORDER BY total_book_value DESC;
END;
$$;


-- ----------------------------------------------------------------------------
-- 3. FUNCTION: get_posted_sales_gl
-- ----------------------------------------------------------------------------
-- Gathers all posted GL movements on Sales Revenue Account 4100
CREATE OR REPLACE FUNCTION get_posted_sales_gl(
    p_company_id UUID,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
    journal_id UUID,
    entry_number TEXT,
    entry_date DATE,
    reference TEXT,
    entity_name TEXT,
    movement_type TEXT,
    credit_revenue NUMERIC,
    debit_return NUMERIC,
    net_revenue NUMERIC,
    memo TEXT,
    status TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        je.id AS journal_id,
        je.entry_number,
        je.date::DATE AS entry_date,
        COALESCE(je.reference, je.entry_number) AS reference,
        COALESCE(inv.entity_name_ar, je.description, 'إيراد مبيعات') AS entity_name,
        CASE 
            WHEN jel.credit > 0 THEN 'SALES'
            WHEN jel.debit > 0 THEN 'SALES_RETURN'
            ELSE 'MANUAL_GL_ADJUSTMENT'
        END AS movement_type,
        COALESCE(jel.credit, 0)::NUMERIC AS credit_revenue,
        COALESCE(jel.debit, 0)::NUMERIC AS debit_return,
        (COALESCE(jel.credit, 0) - COALESCE(jel.debit, 0))::NUMERIC AS net_revenue,
        COALESCE(jel.memo, je.description, '') AS memo,
        je.status AS status
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.journal_entry_id
    LEFT JOIN invoices inv ON (inv.id = je.source_id OR inv.invoice_number = je.reference)
    WHERE je.company_id = p_company_id
      AND je.status = 'POSTED'
      AND (jel.account_code = '4100' OR jel.account_id IN (
          SELECT id FROM chart_of_accounts WHERE company_id = p_company_id AND code = '4100'
      ))
      AND (p_start_date IS NULL OR je.date >= p_start_date)
      AND (p_end_date IS NULL OR je.date <= p_end_date)
    ORDER BY je.date DESC, je.entry_number DESC;
END;
$$;

-- ----------------------------------------------------------------------------
-- PERFORMANCE INDEXES
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_je_company_status_date ON journal_entries(company_id, status, date);
CREATE INDEX IF NOT EXISTS idx_jel_account_code ON journal_entry_lines(account_code);
CREATE INDEX IF NOT EXISTS idx_jel_entry_id ON journal_entry_lines(journal_entry_id);
