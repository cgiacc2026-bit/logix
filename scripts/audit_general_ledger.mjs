import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://exupcqbzfngpbsjrzhjw.supabase.co';
const key = Buffer.from('c2Jfc2VjcmV0X3pCY2tDWUQ0bTNKMmZ5UXJsZUFEdndfNFBZdUoyOXk=', 'base64').toString('utf-8');
const client = createClient(SUPABASE_URL, key);
const compId = '20000000-0000-0000-0000-000000000001';

async function auditGeneralLedger() {
  console.log('=== AXIS 5: GENERAL LEDGER INTEGRITY AUDIT ===');
  const { data: entries } = await client.from('journal_entries').select('*').eq('company_id', compId);
  const { data: lines } = await client.from('journal_entry_lines').select('*').eq('company_id', compId);
  const { data: accounts } = await client.from('chart_of_accounts').select('*').eq('company_id', compId).order('code');

  console.log(`Loaded ${entries?.length || 0} entries, ${lines?.length || 0} lines, ${accounts?.length || 0} accounts.`);

  // 1. Double-entry balance per journal entry
  let unbalancedEntries = [];
  let totalJeDebit = 0;
  let totalJeCredit = 0;

  for (const e of (entries || [])) {
    const d = Number(e.total_debit || 0);
    const c = Number(e.total_credit || 0);
    totalJeDebit += d;
    totalJeCredit += c;
    if (Math.abs(d - c) > 0.001) {
      unbalancedEntries.push({
        id: e.id,
        entry_number: e.entry_number,
        date: e.entry_date,
        total_debit: d,
        total_credit: c,
        diff: Number((d - c).toFixed(3)),
        desc: e.description
      });
    }
  }

  console.log(`\n1. JOURNAL ENTRIES HEADER BALANCE:
  Total Debit across all entries: ${totalJeDebit.toFixed(3)}
  Total Credit across all entries: ${totalJeCredit.toFixed(3)}
  Difference: ${(totalJeDebit - totalJeCredit).toFixed(3)}
  Unbalanced entries count: ${unbalancedEntries.length}`);
  if (unbalancedEntries.length > 0) {
    console.table(unbalancedEntries);
  }

  // 2. Sum of lines in journal_entry_lines
  let totalLineDebit = 0;
  let totalLineCredit = 0;
  const lineSumByEntry = new Map();

  for (const l of (lines || [])) {
    const d = Number(l.debit || 0);
    const c = Number(l.credit || 0);
    totalLineDebit += d;
    totalLineCredit += c;

    if (!lineSumByEntry.has(l.journal_entry_id)) {
      lineSumByEntry.set(l.journal_entry_id, { debit: 0, credit: 0, count: 0 });
    }
    const stat = lineSumByEntry.get(l.journal_entry_id);
    stat.debit += d;
    stat.credit += c;
    stat.count++;
  }

  console.log(`\n2. JOURNAL ENTRY LINES GLOBAL BALANCE:
  Total Debit in lines: ${totalLineDebit.toFixed(3)}
  Total Credit in lines: ${totalLineCredit.toFixed(3)}
  Difference: ${(totalLineDebit - totalLineCredit).toFixed(3)}
  Global Double Entry Balanced: ${Math.abs(totalLineDebit - totalLineCredit) < 0.001 ? 'YES' : 'NO'}`);

  // Check lines per entry vs entry header
  const headerLineMismatches = [];
  for (const e of (entries || [])) {
    const lineStat = lineSumByEntry.get(e.id) || { debit: 0, credit: 0, count: 0 };
    const dDiff = Math.abs(Number(e.total_debit || 0) - lineStat.debit);
    const cDiff = Math.abs(Number(e.total_credit || 0) - lineStat.credit);
    if (dDiff > 0.001 || cDiff > 0.001 || lineStat.count === 0) {
      headerLineMismatches.push({
        entry_number: e.entry_number,
        headerDebit: Number(e.total_debit || 0),
        linesDebit: Number(lineStat.debit.toFixed(3)),
        headerCredit: Number(e.total_credit || 0),
        linesCredit: Number(lineStat.credit.toFixed(3)),
        lineCount: lineStat.count
      });
    }
  }

  console.log(`\n3. ENTRIES VS LINES MISMATCHES:
  Total mismatched entries: ${headerLineMismatches.length}`);
  if (headerLineMismatches.length > 0) {
    console.table(headerLineMismatches.slice(0, 15));
    if (headerLineMismatches.length > 15) {
      console.log(`... and ${headerLineMismatches.length - 15} more.`);
    }
  }

  // 4. Recalculate account balances from lines vs chart_of_accounts.balance
  const accLines = new Map();
  for (const l of (lines || [])) {
    const accId = l.account_id;
    if (!accLines.has(accId)) accLines.set(accId, { debit: 0, credit: 0, count: 0 });
    const s = accLines.get(accId);
    s.debit += Number(l.debit || 0);
    s.credit += Number(l.credit || 0);
    s.count++;
  }

  const accountComparison = [];
  for (const a of accounts) {
    // Check lines by id and by 'acc-' + code
    const s1 = accLines.get(a.id) || { debit: 0, credit: 0, count: 0 };
    const s2 = a.code ? (accLines.get('acc-' + a.code) || { debit: 0, credit: 0, count: 0 }) : { debit: 0, credit: 0, count: 0 };
    const totalD = a.id === ('acc-' + a.code) ? s1.debit : s1.debit + s2.debit;
    const totalC = a.id === ('acc-' + a.code) ? s1.credit : s1.credit + s2.credit;
    const count = a.id === ('acc-' + a.code) ? s1.count : s1.count + s2.count;

    let computedBalance = 0;
    const nature = (a.nature || a.normal_balance || 'DEBIT').toUpperCase();
    if (nature === 'CREDIT' || a.category === 'EQUITY' || a.category === 'LIABILITIES' || a.category === 'REVENUE') {
      computedBalance = totalC - totalD;
    } else {
      computedBalance = totalD - totalC;
    }

    const coaBalance = Number(a.balance || a.current_balance || 0);
    accountComparison.push({
      code: a.code,
      name: a.name_ar,
      type: a.type,
      linesCount: count,
      linesDebit: Number(totalD.toFixed(3)),
      linesCredit: Number(totalC.toFixed(3)),
      computedBalanceFromLines: Number(computedBalance.toFixed(3)),
      coaTableBalance: Number(coaBalance.toFixed(3)),
      diff: Number(Math.abs(computedBalance - coaBalance).toFixed(3))
    });
  }

  console.log('\n4. ACCOUNT BALANCES: LINES VS COA TABLE:');
  console.table(accountComparison.filter(x => x.linesCount > 0 || x.coaTableBalance !== 0));
}

auditGeneralLedger().catch(console.error);
