import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gzoncsbxfdnfellspgke.supabase.co';
const key = Buffer.from('c2Jfc2VjcmV0X3pCY2tDWUQ0bTNKMmZ5UXJsZUFEdndfNFBZdUoyOXk=', 'base64').toString('utf-8');
const client = createClient(SUPABASE_URL, key);
const compId = '20000000-0000-0000-0000-000000000001';

async function listUnbalanced() {
  const { data: entries } = await client.from('journal_entries').select('id, entry_number, description, total_debit, total_credit').eq('company_id', compId);
  const { data: lines } = await client.from('journal_entry_lines').select('*').eq('company_id', compId);

  const entryMap = new Map();
  entries.forEach(e => entryMap.set(e.id, e));

  const byEntry = {};
  for (const l of lines) {
    if (!byEntry[l.journal_entry_id]) byEntry[l.journal_entry_id] = { debit: 0, credit: 0, count: 0, lines: [] };
    byEntry[l.journal_entry_id].debit += Number(l.debit || 0);
    byEntry[l.journal_entry_id].credit += Number(l.credit || 0);
    byEntry[l.journal_entry_id].count++;
    byEntry[l.journal_entry_id].lines.push(l);
  }

  const unb = [];
  for (const [eId, stat] of Object.entries(byEntry)) {
    const diff = Number((stat.debit - stat.credit).toFixed(3));
    if (Math.abs(diff) > 0.001) {
      const je = entryMap.get(eId);
      unb.push({
        entry_number: je?.entry_number || eId,
        description: je?.description || '',
        headerDebit: je?.total_debit,
        linesDebit: Number(stat.debit.toFixed(3)),
        linesCredit: Number(stat.credit.toFixed(3)),
        diff: diff,
        lines: stat.lines.map(l => ({
          account_id: l.account_id,
          debit: l.debit,
          credit: l.credit,
          memo: l.memo
        }))
      });
    }
  }

  console.log(`Found ${unb.length} unbalanced entries in journal_entry_lines:`);
  console.table(unb.map(u => ({
    entry_number: u.entry_number,
    headerDebit: u.headerDebit,
    linesDebit: u.linesDebit,
    linesCredit: u.linesCredit,
    diff: u.diff,
    desc: u.description.slice(0, 45)
  })));
}

listUnbalanced().catch(console.error);
