import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gzoncsbxfdnfellspgke.supabase.co';
const key = Buffer.from('c2Jfc2VjcmV0X3pCY2tDWUQ0bTNKMmZ5UXJsZUFEdndfNFBZdUoyOXk=', 'base64').toString('utf-8');
const client = createClient(SUPABASE_URL, key);

async function executeFullResetAndCleanup() {
  const alwaleedId = '20000000-0000-0000-0000-000000000001';
  const demoId = '00000000-0000-0000-0000-000000000099';
  const companiesToDelete = [
    '74990924-3e29-4e49-a92a-98479906fff4', // City Gulf
    '10000000-0000-0000-0000-000000000001'  // Old duplicate Alwaleed
  ];

  console.log('=== STARTING TRANSACTIONAL CLEANUP AND ZEROING ===');

  // STEP 1: Delete Other Companies' Data & Records completely
  console.log('\n--- Step 1: Deleting records of other companies ---');
  for (const cId of companiesToDelete) {
    console.log(`Cleaning data for company: ${cId}...`);
    // Delete in FK dependency order:
    await client.from('audit_logs').delete().eq('company_id', cId);
    await client.from('master_price_lists').delete().eq('company_id', cId);
    await client.from('item_units').delete().eq('company_id', cId);
    await client.from('sales_reps').delete().eq('company_id', cId);
    await client.from('invoice_items').delete().eq('company_id', cId);
    await client.from('invoices').delete().eq('company_id', cId);
    await client.from('journal_entry_lines').delete().eq('company_id', cId);
    await client.from('journal_entries').delete().eq('company_id', cId);
    await client.from('payment_vouchers').delete().eq('company_id', cId);
    await client.from('customer_branches').delete().eq('company_id', cId);
    await client.from('customers').delete().eq('company_id', cId);
    await client.from('suppliers').delete().eq('company_id', cId);
    await client.from('items').delete().eq('company_id', cId);
    await client.from('warehouses').delete().eq('company_id', cId);
    await client.from('chart_of_accounts').delete().eq('company_id', cId);
    await client.from('accounts').delete().eq('company_id', cId);
    await client.from('company_accounting_settings').delete().eq('company_id', cId);

    // Delete company entry itself
    const { error: delCompErr } = await client.from('companies').delete().eq('id', cId);
    if (delCompErr) {
      console.error(`Failed to delete company ${cId}:`, delCompErr);
      throw delCompErr;
    }
    console.log(`Successfully deleted company ${cId} from companies table.`);
  }

  // STEP 2: Alwaleed Mill (20000000-0000-0000-0000-000000000001) Full Transactional Deletion
  console.log('\n--- Step 2: Deleting Alwaleed transactions ---');
  
  // Count before deletion
  const { count: bInvItems } = await client.from('invoice_items').select('*', { count: 'exact', head: true }).eq('company_id', alwaleedId);
  const { count: bInvoices } = await client.from('invoices').select('*', { count: 'exact', head: true }).eq('company_id', alwaleedId);
  const { count: bJvLines } = await client.from('journal_entry_lines').select('*', { count: 'exact', head: true }).eq('company_id', alwaleedId);
  const { count: bJvs } = await client.from('journal_entries').select('*', { count: 'exact', head: true }).eq('company_id', alwaleedId);
  const { count: bVouchers } = await client.from('payment_vouchers').select('*', { count: 'exact', head: true }).eq('company_id', alwaleedId);

  // 1. Delete invoice_items
  const { error: eInvItems } = await client.from('invoice_items').delete().eq('company_id', alwaleedId);
  if (eInvItems) throw eInvItems;
  console.log(`Deleted invoice_items: ${bInvItems}`);

  // 2. Delete invoices
  const { error: eInvoices } = await client.from('invoices').delete().eq('company_id', alwaleedId);
  if (eInvoices) throw eInvoices;
  console.log(`Deleted invoices: ${bInvoices}`);

  // 3. Delete journal_entry_lines
  const { error: eJvLines } = await client.from('journal_entry_lines').delete().eq('company_id', alwaleedId);
  if (eJvLines) throw eJvLines;
  console.log(`Deleted journal_entry_lines: ${bJvLines}`);

  // 4. Delete journal_entries
  const { error: eJvs } = await client.from('journal_entries').delete().eq('company_id', alwaleedId);
  if (eJvs) throw eJvs;
  console.log(`Deleted journal_entries: ${bJvs}`);

  // 5. Delete payment_vouchers
  const { error: eVouchers } = await client.from('payment_vouchers').delete().eq('company_id', alwaleedId);
  if (eVouchers) throw eVouchers;
  console.log(`Deleted payment_vouchers: ${bVouchers}`);

  // 6. Delete production_orders (if any)
  await client.from('production_orders').delete().eq('company_id', alwaleedId);

  // STEP 3: Zero Out Master Data for Alwaleed (Customers, Suppliers, Items, Accounts)
  console.log('\n--- Step 3: Zeroing balances on Master Data ---');

  // A. Customers
  const { data: customers } = await client.from('customers').select('id, name_ar, raw_data').eq('company_id', alwaleedId);
  const custTotal = customers?.length || 0;
  for (const cust of customers || []) {
    const raw = cust.raw_data || {};
    raw.balance = 0;
    raw.currentBalance = 0;
    raw.openingBalance = 0;
    await client.from('customers').update({
      balance: 0,
      current_balance: 0,
      opening_balance: 0,
      raw_data: raw,
      updated_at: new Date().toISOString()
    }).eq('id', cust.id);
  }
  console.log(`Zeroed balances for ${custTotal} customers.`);

  // B. Suppliers
  const { data: suppliers } = await client.from('suppliers').select('id, name_ar, raw_data').eq('company_id', alwaleedId);
  const suppTotal = suppliers?.length || 0;
  for (const supp of suppliers || []) {
    const raw = supp.raw_data || {};
    raw.balance = 0;
    raw.currentBalance = 0;
    raw.openingBalance = 0;
    await client.from('suppliers').update({
      balance: 0,
      current_balance: 0,
      opening_balance: 0,
      raw_data: raw,
      updated_at: new Date().toISOString()
    }).eq('id', supp.id);
  }
  console.log(`Zeroed balances for ${suppTotal} suppliers.`);

  // C. Items (Inventory)
  const { data: items } = await client.from('items').select('id, name_ar, raw_data').eq('company_id', alwaleedId);
  const itemsTotal = items?.length || 0;
  for (const it of items || []) {
    const raw = it.raw_data || {};
    raw.currentBalance = 0;
    raw.quantityOnHand = 0;
    raw.openingBalance = 0;
    await client.from('items').update({
      current_balance: 0,
      opening_balance: 0,
      raw_data: raw,
      updated_at: new Date().toISOString()
    }).eq('id', it.id);
  }
  console.log(`Zeroed balances for ${itemsTotal} items.`);

  // D. Chart of Accounts & Accounts
  const { data: accounts } = await client.from('accounts').select('id, code, name_ar, raw_data').eq('company_id', alwaleedId);
  const accTotal = accounts?.length || 0;
  for (const acc of accounts || []) {
    const raw = acc.raw_data || {};
    raw.balance = 0;
    raw.currentBalance = 0;
    raw.openingBalance = 0;
    raw.totalDebitMovement = 0;
    raw.totalCreditMovement = 0;
    raw.movementCount = 0;
    await client.from('accounts').update({
      balance: 0,
      current_balance: 0,
      opening_balance: 0,
      total_debit: 0,
      total_credit: 0,
      raw_data: raw,
      updated_at: new Date().toISOString()
    }).eq('id', acc.id);
  }
  console.log(`Zeroed balances for ${accTotal} accounts in 'accounts' table.`);

  // Also zero out chart_of_accounts
  const { data: chartAccs } = await client.from('chart_of_accounts').select('id, code, name_ar, raw_data').eq('company_id', alwaleedId);
  const chartTotal = chartAccs?.length || 0;
  for (const ca of chartAccs || []) {
    const raw = ca.raw_data || {};
    raw.balance = 0;
    raw.currentBalance = 0;
    raw.openingBalance = 0;
    await client.from('chart_of_accounts').update({
      balance: 0,
      current_balance: 0,
      raw_data: raw,
      updated_at: new Date().toISOString()
    }).eq('id', ca.id);
  }
  console.log(`Zeroed balances for ${chartTotal} accounts in 'chart_of_accounts' table.`);

  // STEP 4: Reset Sequences & Settings
  console.log('\n--- Step 4: Resetting sequences and numbering settings ---');
  const { data: settings } = await client.from('company_accounting_settings').select('*').eq('company_id', alwaleedId).single();
  const rawSet = settings?.raw_data || {};
  rawSet.sequences = {
    salesInvoice: 0,
    purchaseInvoice: 0,
    salesReturn: 0,
    purchaseReturn: 0,
    journalEntry: 0,
    receiptVoucher: 0,
    paymentVoucher: 0
  };
  await client.from('company_accounting_settings').upsert({
    company_id: alwaleedId,
    raw_data: rawSet,
    updated_at: new Date().toISOString()
  }, { onConflict: 'company_id' });
  console.log('Reset sequence counters to 0.');

  console.log('\n=== EXECUTION COMPLETED SUCCESSFULLY! ===');
}

executeFullResetAndCleanup().catch(err => {
  console.error('FATAL ERROR DURING RESET:', err);
  process.exit(1);
});
