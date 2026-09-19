import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://exupcqbzfngpbsjrzhjw.supabase.co';
const key = Buffer.from('c2Jfc2VjcmV0X3pCY2tDWUQ0bTNKMmZ5UXJsZUFEdndfNFBZdUoyOXk=', 'base64').toString('utf-8');
const client = createClient(SUPABASE_URL, key);
const compId = '20000000-0000-0000-0000-000000000001';

async function audit() {
  const { data: accounts } = await client.from('chart_of_accounts').select('*').eq('company_id', compId);
  const { data: lines } = await client.from('journal_entry_lines').select('*').eq('company_id', compId);
  const { data: entries } = await client.from('journal_entries').select('*').eq('company_id', compId);

  console.log(`Loaded ${accounts.length} accounts, ${entries.length} entries, ${lines.length} lines.`);

  const lineStats = {};
  for (const l of lines) {
    if (!lineStats[l.account_id]) {
      lineStats[l.account_id] = { count: 0, debit: 0, credit: 0 };
    }
    lineStats[l.account_id].count++;
    lineStats[l.account_id].debit += Number(l.debit || 0);
    lineStats[l.account_id].credit += Number(l.credit || 0);
  }

  console.log('\n--- JOURNAL LINES GROUPED BY ACCOUNT_ID ---');
  for (const [accId, stat] of Object.entries(lineStats)) {
    const acc = accounts.find(a => a.id === accId || a.code === accId.replace('acc-', ''));
    console.log(JSON.stringify({
      accId,
      code: acc ? acc.code : 'UNKNOWN',
      name: acc ? acc.name_ar : 'UNKNOWN',
      type: acc ? acc.type : 'UNKNOWN',
      count: stat.count,
      totalDebit: Number(stat.debit.toFixed(3)),
      totalCredit: Number(stat.credit.toFixed(3)),
      netBalance: Number((stat.debit - stat.credit).toFixed(3))
    }, null, 2));
  }
}

audit().catch(console.error);
