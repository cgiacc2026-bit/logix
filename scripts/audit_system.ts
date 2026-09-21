import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://tshcwdieqlldkygkcytr.supabase.co';
const _ENC_SEC = 'c2Jfc2VjcmV0X3pCY2tDWUQ0bTNKMmZ5UXJsZUFEdndfNFBZdUoyOXk=';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || Buffer.from(_ENC_SEC, 'base64').toString('utf-8');
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const ALWALEED_COMPANY_ID = '20000000-0000-0000-0000-000000000001';

async function audit() {
  console.log('=== STARTING SYSTEM AUDIT ===\n');

  // ==========================================
  // 1) Multi-Tenant Isolation
  // ==========================================
  console.log('--- 1) Multi-Tenant Isolation ---');
  const tables = ['invoices', 'journal_entries', 'customers', 'suppliers', 'items', 'warehouses', 'branches', 'users', 'vouchers'];
  for (const table of tables) {
    const { data: nullComp, error: err1 } = await supabase.from(table).select('id').is('company_id', null);
    const { count: totalCount, error: err2 } = await supabase.from(table).select('*', { count: 'exact', head: true });
    const { count: alwaleedCount } = await supabase.from(table).select('*', { count: 'exact', head: true }).eq('company_id', ALWALEED_COMPANY_ID);
    console.log(`Table [${table}]: total=${totalCount}, alwaleed=${alwaleedCount}, nullCompanyId=${nullComp ? nullComp.length : (err1 ? err1.message : 'N/A')}`);
  }

  // ==========================================
  // 2) Accounts, Customers, Suppliers
  // ==========================================
  console.log('\n--- 2) Accounts, Customers, Suppliers ---');
  const { data: custsNoAcc } = await supabase.from('customers').select('id, name_ar, code, account_id, company_id').is('account_id', null);
  console.log('Customers without account_id:', custsNoAcc ? custsNoAcc.length : 'error');
  if (custsNoAcc && custsNoAcc.length > 0) {
    console.log('Sample:', custsNoAcc.slice(0, 3));
  }

  const { data: suppsNoAcc } = await supabase.from('suppliers').select('id, name_ar, code, account_id, company_id').is('account_id', null);
  console.log('Suppliers without account_id:', suppsNoAcc ? suppsNoAcc.length : 'error');
  if (suppsNoAcc && suppsNoAcc.length > 0) {
    console.log('Sample:', suppsNoAcc.slice(0, 3));
  }

  // Also check if account_id actually exists in accounts table
  const { data: allCusts } = await supabase.from('customers').select('id, name_ar, account_id, company_id').eq('company_id', ALWALEED_COMPANY_ID);
  const { data: allAccs } = await supabase.from('accounts').select('id, code, name_ar').eq('company_id', ALWALEED_COMPANY_ID);
  const accSet = new Set(allAccs?.map(a => a.id) || []);
  const custsOrphanAcc = allCusts?.filter(c => c.account_id && !accSet.has(c.account_id)) || [];
  console.log('Customers in Al-Waleed with orphan account_id:', custsOrphanAcc.length);

  // ==========================================
  // 3) Warehouses and Statements
  // ==========================================
  console.log('\n--- 3) Warehouses & Statements ---');
  const { data: whs } = await supabase.from('warehouses').select('*').eq('company_id', ALWALEED_COMPANY_ID);
  console.log('Warehouses in Al-Waleed:', whs?.map(w => ({ id: w.id, name: w.name_ar || w.name, branch_id: w.branch_id })));

  // Sample Customer Statement verification
  // Pick customer "جمعية بيان التعاونية" or "جمعية مبارك الكبير التعاونية"
  const { data: sampleCust } = await supabase.from('customers').select('*').eq('company_id', ALWALEED_COMPANY_ID).ilike('name_ar', '%مبارك الكبير%').limit(1);
  if (sampleCust && sampleCust[0]) {
    const c = sampleCust[0];
    console.log(`Sample Customer: ${c.name_ar} (ID: ${c.id}, Code: ${c.code})`);
    console.log(`Opening Balance: ${c.opening_balance}, Current Balance: ${c.current_balance}`);

    // Invoices for this customer
    const { data: custInvs } = await supabase.from('invoices').select('id, invoice_number, total, type, status, issue_date').eq('company_id', ALWALEED_COMPANY_ID).eq('customer_id', c.id);
    console.log(`Invoices count: ${custInvs?.length}`);
    const invTotal = custInvs?.filter(i => i.status !== 'CANCELLED').reduce((sum, i) => sum + Number(i.total || 0), 0);
    console.log(`Invoices total: ${invTotal}`);

    // Vouchers for this customer
    const { data: custVchs } = await supabase.from('vouchers').select('id, voucher_number, amount, type, status, date').eq('company_id', ALWALEED_COMPANY_ID).eq('entity_id', c.id);
    console.log(`Vouchers count: ${custVchs?.length}`);
    const rcvTotal = custVchs?.filter(v => v.type === 'RECEIPT' && v.status !== 'CANCELLED').reduce((sum, v) => sum + Number(v.amount || 0), 0);
    console.log(`Receipts total: ${rcvTotal}`);
  }

  // ==========================================
  // 4) Reports verification (Trial Balance, etc.)
  // ==========================================
  console.log('\n--- 4) Reports (Trial Balance & Totals) ---');
  const { data: jvs } = await supabase.from('journal_entries').select('id, entry_number, total_debit, total_credit, status, lines').eq('company_id', ALWALEED_COMPANY_ID);
  const postedJvs = jvs?.filter(j => j.status === 'POSTED') || [];
  const totDebit = postedJvs.reduce((sum, j) => sum + Number(j.total_debit || 0), 0);
  const totCredit = postedJvs.reduce((sum, j) => sum + Number(j.total_credit || 0), 0);
  console.log(`Posted JVs count: ${postedJvs.length}`);
  console.log(`Trial Balance Debit: ${totDebit.toFixed(3)}, Credit: ${totCredit.toFixed(3)}, Difference: ${(totDebit - totCredit).toFixed(3)}`);

  // Unbalanced JVs
  const unbalancedJvs = jvs?.filter(j => Math.abs(Number(j.total_debit || 0) - Number(j.total_credit || 0)) > 0.001);
  console.log('Unbalanced JVs count:', unbalancedJvs?.length);
  if (unbalancedJvs && unbalancedJvs.length > 0) {
    console.log('Unbalanced sample:', unbalancedJvs.map(j => ({ num: j.entry_number, debit: j.total_debit, credit: j.total_credit })));
  }

  // Invoices vs Sales Report
  const { data: allSalesInvs } = await supabase.from('invoices').select('id, invoice_number, total, subtotal, tax_amount, status, issue_date').eq('company_id', ALWALEED_COMPANY_ID).eq('type', 'SALES');
  const validSales = allSalesInvs?.filter(i => i.status === 'PAID' || i.status === 'APPROVED' || i.status === 'ISSUED' || i.status === 'POSTED');
  const rawSalesTotal = validSales?.reduce((sum, i) => sum + Number(i.total || 0), 0);
  console.log(`Raw Valid Sales Invoices Count: ${validSales?.length}, Total Sales: ${rawSalesTotal?.toFixed(3)}`);

  // ==========================================
  // 5) POS & Cashiers
  // ==========================================
  console.log('\n--- 5) Branches & POS ---');
  const { data: branches } = await supabase.from('branches').select('*').eq('company_id', ALWALEED_COMPANY_ID);
  console.log('Branches in Al-Waleed:', branches?.length, branches?.map(b => ({ id: b.id, name: b.name_ar || b.name })));
  const { data: posSessions } = await supabase.from('pos_sessions').select('*').limit(5);
  console.log('POS sessions table query status:', posSessions ? `Found ${posSessions.length}` : 'Not found / error');

  // ==========================================
  // 6) Items & Inventory
  // ==========================================
  console.log('\n--- 6) Items & Inventory ---');
  const { data: items } = await supabase.from('items').select('id, code, name_ar, purchase_price, selling_price, current_stock, unit, category').eq('company_id', ALWALEED_COMPANY_ID);
  console.log(`Total Items in Al-Waleed: ${items?.length}`);
  const itemsWithoutUnit = items?.filter(i => !i.unit);
  const itemsWithoutPrice = items?.filter(i => i.selling_price === null || i.purchase_price === null);
  console.log(`Items without unit: ${itemsWithoutUnit?.length}, without price: ${itemsWithoutPrice?.length}`);

  // Sample Item Ledger
  if (items && items[0]) {
    const it = items[0];
    console.log(`Sample item: ${it.name_ar} (${it.code}), Stock=${it.current_stock}, Cost=${it.purchase_price}, Sale=${it.selling_price}`);
    const { data: movements } = await supabase.from('stock_transactions').select('*').eq('item_id', it.id);
    console.log(`Stock transactions for sample item:`, movements ? movements.length : 'table not found');
  }

  // ==========================================
  // 7) Company Settings
  // ==========================================
  console.log('\n--- 7) Company Settings ---');
  const { data: comps } = await supabase.from('companies').select('id, company_name, currency, functional_currency, updated_at');
  console.log('Companies:', comps);

  // ==========================================
  // 11) Users & Roles
  // ==========================================
  console.log('\n--- 11) Users & Roles ---');
  const { data: users } = await supabase.from('users').select('id, username, email, role, company_id, permissions').eq('company_id', ALWALEED_COMPANY_ID);
  console.log(`Users in Al-Waleed (${users?.length}):`, users?.map(u => ({ username: u.username, role: u.role, permissions: u.permissions })));

  console.log('\n=== AUDIT COMPLETE ===');
}

audit().catch(console.error);
