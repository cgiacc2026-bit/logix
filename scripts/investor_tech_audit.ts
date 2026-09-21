import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://tshcwdieqlldkygkcytr.supabase.co';
const _ENC_SEC = 'c2Jfc2VjcmV0X3pCY2tDWUQ0bTNKMmZ5UXJsZUFEdndfNFBZdUoyOXk=';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || Buffer.from(_ENC_SEC, 'base64').toString('utf-8');
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_byqbhrpY1GEhRJlHF9vKVg_Eup35Pd6';

const adminClient = createClient(SUPABASE_URL, SUPABASE_KEY);
const anonClient = createClient(SUPABASE_URL, ANON_KEY);

const ALWALEED_COMPANY_ID = '20000000-0000-0000-0000-000000000001';

async function runAudit() {
  const report: any = {};
  console.log('=== STARTING INVESTOR AUDITOR TEST BATTERY ===\n');

  // =========================================================================
  // 1) Multi-Tenant Isolation & IDOR Check
  // =========================================================================
  console.log('--- TEST 1: Multi-Tenant & Anon Key RLS/Isolation ---');
  const mainTables = [
    'companies',
    'accounts',
    'journal_entries',
    'journal_entry_lines',
    'invoices',
    'invoice_items',
    'customers',
    'suppliers',
    'items',
    'warehouses',
    'payment_vouchers',
    'users'
  ];

  const nullCompanyFindings: any = {};
  const crossCompanyFindings: any = {};
  const anonAccessFindings: any = {};

  for (const table of mainTables) {
    if (table === 'companies') continue;
    // Check for NULL company_id
    const { data: nullRows, error: errNull } = await adminClient
      .from(table)
      .select('id')
      .is('company_id', null);

    nullCompanyFindings[table] = {
      nullCount: nullRows?.length || 0,
      error: errNull ? errNull.message : null
    };

    // Check with Anon Client without JWT
    const { data: anonData, error: anonErr } = await anonClient
      .from(table)
      .select('id')
      .limit(5);

    anonAccessFindings[table] = {
      accessibleRowsWithoutAuth: anonData?.length || 0,
      error: anonErr ? anonErr.message : null
    };
  }

  report.nullCompanyFindings = nullCompanyFindings;
  report.anonAccessFindings = anonAccessFindings;

  // Check distinct companies in database
  const { data: dbCompanies, error: compErr } = await adminClient
    .from('companies')
    .select('id, company_name, currency');
  report.companiesInDb = dbCompanies;

  // =========================================================================
  // 2) Duplicate Journal Entries & Triggers Check
  // =========================================================================
  console.log('--- TEST 2: Duplicate Journal Entries & DB Triggers ---');
  const { data: allJvs, error: jvErr } = await adminClient
    .from('journal_entries')
    .select('id, company_id, entry_number, reference, date, total_debit, total_credit, status, created_at')
    .order('created_at', { ascending: false });

  // Look for duplicate entry numbers or identical references in same company
  const jvRefMap: Record<string, any[]> = {};
  let duplicateJvCount = 0;
  const duplicateExamples: any[] = [];

  allJvs?.forEach(jv => {
    const key = `${jv.company_id}_${jv.entry_number}`;
    if (!jvRefMap[key]) jvRefMap[key] = [];
    jvRefMap[key].push(jv);
  });

  Object.entries(jvRefMap).forEach(([k, entries]) => {
    if (entries.length > 1) {
      duplicateJvCount += (entries.length - 1);
      duplicateExamples.push({ key: k, count: entries.length, ids: entries.map(e => e.id) });
    }
  });

  report.duplicateJvs = {
    totalJvs: allJvs?.length || 0,
    duplicateCount: duplicateJvCount,
    duplicateExamples: duplicateExamples.slice(0, 5)
  };

  // Check database triggers via RPC or information_schema if possible
  const { data: rpcTriggers, error: trigErr } = await adminClient
    .rpc('get_table_triggers', {});
  report.triggersQuery = { triggers: rpcTriggers, error: trigErr ? trigErr.message : null };

  // =========================================================================
  // 3) Trial Balance, Unbalanced Entries & Bank Accounts
  // =========================================================================
  console.log('--- TEST 3: Accounting Accuracy (Trial Balance & Bank Accounts) ---');
  const { data: jvLines, error: linesErr } = await adminClient
    .from('journal_entry_lines')
    .select('id, journal_entry_id, account_id, debit, credit');

  const { data: accounts, error: accErr } = await adminClient
    .from('accounts')
    .select('id, company_id, code, name_ar, type, balance, current_balance');

  // Verify trial balance sum by company
  const companyBalances: Record<string, { totalDebit: number; totalCredit: number; diff: number; unbalancedEntries: any[] }> = {};
  
  // Also sum directly from posted journal entries
  allJvs?.forEach(jv => {
    const cid = jv.company_id || 'UNKNOWN';
    if (!companyBalances[cid]) {
      companyBalances[cid] = { totalDebit: 0, totalCredit: 0, diff: 0, unbalancedEntries: [] };
    }
    const d = Number(jv.total_debit || 0);
    const c = Number(jv.total_credit || 0);
    if (jv.status === 'POSTED') {
      companyBalances[cid].totalDebit += d;
      companyBalances[cid].totalCredit += c;
    }
    if (Math.abs(d - c) > 0.001) {
      companyBalances[cid].unbalancedEntries.push({
        id: jv.id,
        entry_number: jv.entry_number,
        debit: d,
        credit: c,
        diff: d - c
      });
    }
  });

  Object.keys(companyBalances).forEach(cid => {
    companyBalances[cid].diff = companyBalances[cid].totalDebit - companyBalances[cid].totalCredit;
  });

  report.trialBalanceAudit = companyBalances;

  // Bank account naming inspection: any account with "بنك" or "bank" whose code does not start with 111
  const misplacedBankAccounts: any[] = [];
  accounts?.forEach(acc => {
    const name = (acc.name_ar || '').toLowerCase();
    const isBankNamed = name.includes('بنك') || name.includes('bank') || name.includes('مصرف');
    const isCode111 = (acc.code || '').startsWith('111');
    if (isBankNamed && !isCode111) {
      misplacedBankAccounts.push({
        id: acc.id,
        company_id: acc.company_id,
        code: acc.code,
        name_ar: acc.name_ar,
        type: acc.type
      });
    }
  });
  report.misplacedBankAccounts = misplacedBankAccounts;

  // =========================================================================
  // 4) Foreign Key & UUID Integrity (String pollution scan)
  // =========================================================================
  console.log('--- TEST 4: Foreign Key and UUID Integrity Scan ---');
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const fkChecks = [
    { table: 'invoices', fkCols: ['company_id', 'customer_id', 'warehouse_id', 'price_list_id', 'branch_id'] },
    { table: 'journal_entries', fkCols: ['company_id', 'branch_id'] },
    { table: 'journal_entry_lines', fkCols: ['journal_entry_id', 'account_id', 'cost_center_id'] },
    { table: 'customers', fkCols: ['company_id', 'account_id', 'price_list_id', 'default_warehouse_id'] },
    { table: 'items', fkCols: ['company_id', 'default_warehouse_id', 'category_id', 'unit_id'] },
    { table: 'payment_vouchers', fkCols: ['company_id', 'account_id', 'customer_id', 'supplier_id'] }
  ];

  const fkCorruptionReport: any = {};

  for (const check of fkChecks) {
    fkCorruptionReport[check.table] = {};
    const { data: rows, error: rowErr } = await adminClient
      .from(check.table)
      .select('*')
      .limit(500);

    if (rowErr) {
      fkCorruptionReport[check.table]._error = rowErr.message;
      continue;
    }

    for (const col of check.fkCols) {
      let corruptedCount = 0;
      const samples: any[] = [];
      rows?.forEach(r => {
        const val = r[col];
        if (val !== null && val !== undefined && val !== '') {
          if (typeof val === 'string' && !uuidRegex.test(val)) {
            corruptedCount++;
            if (samples.length < 5) samples.push({ id: r.id, value: val });
          }
        }
      });
      fkCorruptionReport[check.table][col] = {
        corruptedCount,
        samples
      };
    }
  }
  report.fkCorruptionReport = fkCorruptionReport;

  // =========================================================================
  // 5) Promotional Offers Feature & Migration Integrity
  // =========================================================================
  console.log('--- TEST 5: Promotional Offers & Stock Independence ---');
  // Check items with offer fields in DB
  const { data: offerItems, error: offerItemErr } = await adminClient
    .from('items')
    .select('id, code, name_ar, barcode, offer_enabled, offer_quantity, offer_price, offer_barcode, raw_data')
    .or('offer_enabled.eq.true,offer_quantity.gt.0,raw_data->>offer_enabled.eq.true');

  // Specific check for "كرزية ناعم 75 جم" (barcode: 2881016018689)
  const { data: cherryItem, error: cherryErr } = await adminClient
    .from('items')
    .select('*')
    .or('barcode.eq.2881016018689,raw_data->>barcode.eq.2881016018689,name_ar.ilike.%كرزية%');

  // Check if item_offers table exists
  const { data: tableOffers, error: tblOffErr } = await adminClient
    .from('item_offers')
    .select('*');

  report.offersAudit = {
    offerItemsInDb: offerItems || [],
    cherryItemFound: cherryItem || [],
    itemOffersTableExists: !tblOffErr,
    itemOffersTableCount: tableOffers?.length || 0,
    itemOffersTableError: tblOffErr ? tblOffErr.message : null
  };

  console.log('\n=== AUDIT DATA COLLECTED SUCCESSFULLY ===');
  console.log(JSON.stringify(report, null, 2));
}

runAudit().catch(console.error);
