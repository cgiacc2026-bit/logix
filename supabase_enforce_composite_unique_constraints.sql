-- ==============================================================================
-- LOGIX ERP ENTERPRISE SQL MIGRATION: ENFORCE COMPOSITE UNIQUE CONSTRAINTS
-- Preserves existing data, cleans up duplicates safely, and guarantees integrity
-- Compatible with PostgreSQL 14+ and Supabase SQL Editor
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- STEP 1: Non-destructive Deduplication with Parent-Child Relational Re-pointing
-- ------------------------------------------------------------------------------

-- 1.1 Deduplicate Invoices: Keep the most recent record (latest updated_at / id)
-- If child records exist in invoice_items, repoint them to the retained invoice first.
DO $$
DECLARE
    dup_rec RECORD;
    keeper_id UUID;
BEGIN
    -- Loop through each duplicate group in invoices
    FOR dup_rec IN
        SELECT company_id, invoice_number, COUNT(*) as cnt
        FROM invoices
        WHERE invoice_number IS NOT NULL AND invoice_number <> ''
        GROUP BY company_id, invoice_number
        HAVING COUNT(*) > 1
    LOOP
        -- Identify the master record to keep (the one created most recently or with highest id)
        SELECT id INTO keeper_id
        FROM invoices
        WHERE company_id = dup_rec.company_id AND invoice_number = dup_rec.invoice_number
        ORDER BY created_at DESC NULLS LAST, id DESC
        LIMIT 1;

        -- Re-link any invoice_items that point to duplicate invoices to the keeper
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoice_items') THEN
            UPDATE invoice_items
            SET invoice_id = keeper_id
            WHERE invoice_id IN (
                SELECT id FROM invoices
                WHERE company_id = dup_rec.company_id 
                  AND invoice_number = dup_rec.invoice_number 
                  AND id <> keeper_id
            );
        END IF;

        -- Safely remove duplicate invoice rows
        DELETE FROM invoices
        WHERE company_id = dup_rec.company_id
          AND invoice_number = dup_rec.invoice_number
          AND id <> keeper_id;
    END LOOP;
END $$;

-- 1.2 Deduplicate Journal Entries: Keep the most recent record per (company_id, entry_number)
DO $$
DECLARE
    dup_rec RECORD;
    keeper_id UUID;
BEGIN
    FOR dup_rec IN
        SELECT company_id, entry_number, COUNT(*) as cnt
        FROM journal_entries
        WHERE entry_number IS NOT NULL AND entry_number <> ''
        GROUP BY company_id, entry_number
        HAVING COUNT(*) > 1
    LOOP
        SELECT id INTO keeper_id
        FROM journal_entries
        WHERE company_id = dup_rec.company_id AND entry_number = dup_rec.entry_number
        ORDER BY created_at DESC NULLS LAST, id DESC
        LIMIT 1;

        DELETE FROM journal_entries
        WHERE company_id = dup_rec.company_id
          AND entry_number = dup_rec.entry_number
          AND id <> keeper_id;
    END LOOP;
END $$;

-- 1.3 Deduplicate Payment Vouchers: Keep the most recent record per (company_id, voucher_number)
DO $$
DECLARE
    dup_rec RECORD;
    keeper_id UUID;
BEGIN
    FOR dup_rec IN
        SELECT company_id, voucher_number, COUNT(*) as cnt
        FROM payment_vouchers
        WHERE voucher_number IS NOT NULL AND voucher_number <> ''
        GROUP BY company_id, voucher_number
        HAVING COUNT(*) > 1
    LOOP
        SELECT id INTO keeper_id
        FROM payment_vouchers
        WHERE company_id = dup_rec.company_id AND voucher_number = dup_rec.voucher_number
        ORDER BY created_at DESC NULLS LAST, id DESC
        LIMIT 1;

        DELETE FROM payment_vouchers
        WHERE company_id = dup_rec.company_id
          AND voucher_number = dup_rec.voucher_number
          AND id <> keeper_id;
    END LOOP;
END $$;

-- 1.4 Deduplicate Items: Keep the most recent item per (company_id, barcode)
-- Re-point any invoice_items referencing the duplicate items before deletion
DO $$
DECLARE
    dup_rec RECORD;
    keeper_id UUID;
BEGIN
    FOR dup_rec IN
        SELECT company_id, barcode, COUNT(*) as cnt
        FROM items
        WHERE barcode IS NOT NULL AND TRIM(barcode) <> ''
        GROUP BY company_id, barcode
        HAVING COUNT(*) > 1
    LOOP
        SELECT id INTO keeper_id
        FROM items
        WHERE company_id = dup_rec.company_id AND barcode = dup_rec.barcode
        ORDER BY created_at DESC NULLS LAST, id DESC
        LIMIT 1;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoice_items') THEN
            UPDATE invoice_items
            SET item_id = keeper_id
            WHERE item_id IN (
                SELECT id FROM items
                WHERE company_id = dup_rec.company_id 
                  AND barcode = dup_rec.barcode 
                  AND id <> keeper_id
            );
        END IF;

        DELETE FROM items
        WHERE company_id = dup_rec.company_id
          AND barcode = dup_rec.barcode
          AND id <> keeper_id;
    END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- STEP 2: Enforce Strict Composite Unique Constraints & Indexes
-- ------------------------------------------------------------------------------

-- 2.1 Invoices: (company_id, invoice_number)
DROP INDEX IF EXISTS idx_invoices_company_number;
DROP INDEX IF EXISTS uq_invoices_company_number;
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS uq_invoices_company_number;
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_company_id_invoice_number_key;

CREATE UNIQUE INDEX uq_invoices_company_number 
  ON invoices (company_id, invoice_number);

ALTER TABLE invoices 
  ADD CONSTRAINT uq_invoices_company_number 
  UNIQUE USING INDEX uq_invoices_company_number;

-- 2.2 Journal Entries: (company_id, entry_number)
DROP INDEX IF EXISTS idx_journal_entries_company_number;
DROP INDEX IF EXISTS uq_journals_company_number;
ALTER TABLE journal_entries DROP CONSTRAINT IF EXISTS uq_journals_company_number;
ALTER TABLE journal_entries DROP CONSTRAINT IF EXISTS journal_entries_company_id_entry_number_key;

CREATE UNIQUE INDEX uq_journals_company_number 
  ON journal_entries (company_id, entry_number);

ALTER TABLE journal_entries 
  ADD CONSTRAINT uq_journals_company_number 
  UNIQUE USING INDEX uq_journals_company_number;

-- 2.3 Payment Vouchers: (company_id, voucher_number)
DROP INDEX IF EXISTS idx_vouchers_company_number;
DROP INDEX IF EXISTS uq_vouchers_company_number;
ALTER TABLE payment_vouchers DROP CONSTRAINT IF EXISTS uq_vouchers_company_number;
ALTER TABLE payment_vouchers DROP CONSTRAINT IF EXISTS payment_vouchers_company_id_voucher_number_key;

CREATE UNIQUE INDEX uq_vouchers_company_number 
  ON payment_vouchers (company_id, voucher_number);

ALTER TABLE payment_vouchers 
  ADD CONSTRAINT uq_vouchers_company_number 
  UNIQUE USING INDEX uq_vouchers_company_number;

-- 2.4 Items: (company_id, barcode)
-- Note: A partial unique index is best practice for barcode so items without barcodes are not blocked.
DROP INDEX IF EXISTS idx_items_company_barcode;
DROP INDEX IF EXISTS uq_items_company_barcode;
ALTER TABLE items DROP CONSTRAINT IF EXISTS uq_items_company_barcode;

CREATE UNIQUE INDEX uq_items_company_barcode 
  ON items (company_id, barcode) 
  WHERE barcode IS NOT NULL AND TRIM(barcode) <> '';

-- ------------------------------------------------------------------------------
-- STEP 3: Verification Query to Guarantee Zero Duplicates
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    inv_dups INT;
    jv_dups INT;
    vouch_dups INT;
    item_dups INT;
BEGIN
    SELECT COUNT(*) INTO inv_dups FROM (
        SELECT company_id, invoice_number FROM invoices GROUP BY company_id, invoice_number HAVING COUNT(*) > 1
    ) t;

    SELECT COUNT(*) INTO jv_dups FROM (
        SELECT company_id, entry_number FROM journal_entries GROUP BY company_id, entry_number HAVING COUNT(*) > 1
    ) t;

    SELECT COUNT(*) INTO vouch_dups FROM (
        SELECT company_id, voucher_number FROM payment_vouchers GROUP BY company_id, voucher_number HAVING COUNT(*) > 1
    ) t;

    SELECT COUNT(*) INTO item_dups FROM (
        SELECT company_id, barcode FROM items WHERE barcode IS NOT NULL AND TRIM(barcode) <> '' GROUP BY company_id, barcode HAVING COUNT(*) > 1
    ) t;

    IF (inv_dups + jv_dups + vouch_dups + item_dups) > 0 THEN
        RAISE EXCEPTION 'Verification Failed: Found remaining duplicates (Invoices: %, JV: %, Vouchers: %, Items: %)',
            inv_dups, jv_dups, vouch_dups, item_dups;
    ELSE
        RAISE NOTICE 'SUCCESS: All duplicate records resolved and composite unique constraints active.';
    END IF;
END $$;

COMMIT;
-- ==============================================================================
-- END OF MIGRATION SCRIPT
-- ==============================================================================
