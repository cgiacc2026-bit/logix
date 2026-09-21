import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tshcwdieqlldkygkcytr.supabase.co';
const key = Buffer.from('c2Jfc2VjcmV0X3pCY2tDWUQ0bTNKMmZ5UXJsZUFEdndfNFBZdUoyOXk=', 'base64').toString('utf-8');
const client = createClient(SUPABASE_URL, key);

async function finalVerification() {
  const alwaleedId = '20000000-0000-0000-0000-000000000001';

  console.log('--- 1. COMPANIES IN DB ---');
  const { data: comps } = await client.from('companies').select('id, company_name, owner_email');
  console.log('Total companies count:', comps?.length);
  for (const c of comps || []) {
    console.log(` - ID: ${c.id} | Name: ${c.company_name} | Email: ${c.owner_email}`);
  }

  console.log('\n--- 2. TRANSACTIONS ALWALEED (MUST BE ALL 0) ---');
  const [
    { count: invCount },
    { count: invItemsCount },
    { count: jvCount },
    { count: jvLinesCount },
    { count: voucherCount }
  ] = await Promise.all([
    client.from('invoices').select('*', { count: 'exact', head: true }).eq('company_id', alwaleedId),
    client.from('invoice_items').select('*', { count: 'exact', head: true }).eq('company_id', alwaleedId),
    client.from('journal_entries').select('*', { count: 'exact', head: true }).eq('company_id', alwaleedId),
    client.from('journal_entry_lines').select('*', { count: 'exact', head: true }).eq('company_id', alwaleedId),
    client.from('payment_vouchers').select('*', { count: 'exact', head: true }).eq('company_id', alwaleedId)
  ]);
  console.log({ invCount, invItemsCount, jvCount, jvLinesCount, voucherCount });

  console.log('\n--- 3. MASTER DATA COUNTS & BALANCES ---');
  const { data: customers } = await client.from('customers').select('id, name_ar, balance, current_balance, raw_data').eq('company_id', alwaleedId);
  const badCust = customers?.filter(c => Number(c.balance || 0) !== 0 || Number(c.current_balance || 0) !== 0);
  console.log('Customers: Total = ' + (customers?.length || 0) + ', Non-Zero = ' + (badCust?.length || 0));

  const { data: suppliers } = await client.from('suppliers').select('id, name_ar, balance, current_balance, raw_data').eq('company_id', alwaleedId);
  const badSupp = suppliers?.filter(s => Number(s.balance || 0) !== 0 || Number(s.current_balance || 0) !== 0);
  console.log('Suppliers: Total = ' + (suppliers?.length || 0) + ', Non-Zero = ' + (badSupp?.length || 0));

  const { data: items } = await client.from('items').select('id, name_ar, current_balance, qty_on_hand, raw_data').eq('company_id', alwaleedId);
  const badItems = items?.filter(i => Number(i.current_balance || 0) !== 0 || Number(i.qty_on_hand || 0) !== 0);
  console.log('Items: Total = ' + (items?.length || 0) + ', Non-Zero = ' + (badItems?.length || 0));

  const { data: coa } = await client.from('chart_of_accounts').select('id, code, name_ar, balance, current_balance').eq('company_id', alwaleedId);
  const badCoa = coa?.filter(a => Number(a.balance || 0) !== 0 || Number(a.current_balance || 0) !== 0);
  console.log('Chart of Accounts: Total = ' + (coa?.length || 0) + ', Non-Zero = ' + (badCoa?.length || 0));

  const { data: accs } = await client.from('accounts').select('id, code, name_ar, balance, raw_data').eq('company_id', alwaleedId);
  const badAccs = accs?.filter(a => Number(a.balance || 0) !== 0 || Number(a.raw_data?.currentBalance || 0) !== 0);
  console.log('Accounts Table: Total = ' + (accs?.length || 0) + ', Non-Zero = ' + (badAccs?.length || 0));

  console.log('\n--- 4. TRIAL BALANCE VERIFICATION ---');
  let totalDebit = 0;
  let totalCredit = 0;
  for (const a of accs || []) {
    totalDebit += Number(a.raw_data?.totalDebitMovement || 0);
    totalCredit += Number(a.raw_data?.totalCreditMovement || 0);
  }
  console.log('Trial Balance: Total Debit Movements = ' + totalDebit.toFixed(3) + ', Total Credit Movements = ' + totalCredit.toFixed(3));
}

finalVerification().catch(console.error);
