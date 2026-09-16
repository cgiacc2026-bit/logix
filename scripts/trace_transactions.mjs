import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gzoncsbxfdnfellspgke.supabase.co';
const key = Buffer.from('c2Jfc2VjcmV0X3pCY2tDWUQ0bTNKMmZ5UXJsZUFEdndfNFBZdUoyOXk=', 'base64').toString('utf-8');
const client = createClient(SUPABASE_URL, key);
const compId = '20000000-0000-0000-0000-000000000001';

async function traceTransactions() {
  console.log('=== TRACING 3 TRANSACTIONS ACROSS SCREENS & TABLES ===\n');

  // 1. Sales Invoice: INV-SAL-2026-0001
  console.log('--- 1. SALES INVOICE: INV-SAL-2026-0001 ---');
  const { data: inv } = await client.from('invoices').select('*').eq('company_id', compId).eq('invoice_number', 'INV-SAL-2026-0001').single();
  console.log('Invoices Table:');
  console.log(`  Invoice #: ${inv?.invoice_number}, Total: ${inv?.grand_total || inv?.total_amount}, Paid: ${inv?.paid_amount}, Due: ${inv?.due_amount}, Status: ${inv?.status}, Customer ID: ${inv?.customer_id}`);

  // Customer statement / balance
  const { data: cust } = await client.from('customers').select('*').eq('id', inv?.customer_id).single();
  console.log(`Customer Table (${cust?.name_ar}):`);
  console.log(`  Balance on Customer Record: ${cust?.balance}`);

  // Find linked Journal Entry
  const { data: jeList } = await client.from('journal_entries').select('*').eq('company_id', compId)
    .or(`reference.eq.INV-SAL-2026-0001,entry_number.ilike.%INV-SAL-2026-0001%`);
  console.log(`Journal Entries found: ${jeList?.length || 0}`);
  for (const je of (jeList || [])) {
    console.log(`  JE #: ${je.entry_number}, Total Debit: ${je.total_debit}, Total Credit: ${je.total_credit}, Ref: ${je.reference}`);
    const { data: lines } = await client.from('journal_entry_lines').select('*').eq('journal_entry_id', je.id);
    console.log(`  Lines count: ${lines?.length || 0}`);
    for (const l of (lines || [])) {
      console.log(`    Line: Acc=${l.account_id}, Debit=${l.debit}, Credit=${l.credit}, Memo=${l.memo}`);
    }
  }

  // 2. Receipt Voucher (Payment Voucher with type RECEIPT)
  console.log('\n--- 2. RECEIPT VOUCHER (سند قبض) ---');
  const { data: vouchers } = await client.from('payment_vouchers').select('*').eq('company_id', compId).limit(3);
  if (vouchers && vouchers.length > 0) {
    const v = vouchers[0];
    console.log(`Voucher Table:
  Voucher #: ${v.voucher_number}, Type: ${v.type || v.voucher_type}, Amount: ${v.amount}, Entity: ${v.entity_name || v.customer_name || v.party_name}, Status: ${v.status}`);
    
    // Check if journal entry exists for this voucher
    const { data: vJe } = await client.from('journal_entries').select('*').eq('company_id', compId)
      .or(`reference.eq.${v.voucher_number},entry_number.ilike.%${v.voucher_number}%`);
    console.log(`  Linked Journal Entries: ${vJe?.length || 0}`);
    for (const je of (vJe || [])) {
      console.log(`  JE #: ${je.entry_number}, Debit: ${je.total_debit}, Credit: ${je.total_credit}`);
      const { data: lines } = await client.from('journal_entry_lines').select('*').eq('journal_entry_id', je.id);
      console.log(`  Lines count: ${lines?.length || 0}`);
      for (const l of (lines || [])) {
        console.log(`    Line: Acc=${l.account_id}, Debit=${l.debit}, Credit=${l.credit}, Memo=${l.memo}`);
      }
    }
  }

  // 3. Manual Journal Entry (e.g., Opening Balance JV-2026-0001)
  console.log('\n--- 3. MANUAL / OPENING JOURNAL ENTRY ---');
  const { data: manualJe } = await client.from('journal_entries').select('*').eq('company_id', compId).eq('entry_number', 'JV-2026-0001').single();
  if (manualJe) {
    console.log(`Manual JE: ${manualJe.entry_number}, Debit: ${manualJe.total_debit}, Credit: ${manualJe.total_credit}, Desc: ${manualJe.description}`);
    const { data: lines } = await client.from('journal_entry_lines').select('*').eq('journal_entry_id', manualJe.id);
    console.log(`  Lines count in DB: ${lines?.length || 0}`);
    for (const l of (lines || [])) {
      console.log(`    Line: Acc=${l.account_id}, Debit=${l.debit}, Credit=${l.credit}`);
    }
  }
}

traceTransactions().catch(console.error);
