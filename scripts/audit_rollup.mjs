import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tshcwdieqlldkygkcytr.supabase.co';
const key = Buffer.from('c2Jfc2VjcmV0X3pCY2tDWUQ0bTNKMmZ5UXJsZUFEdndfNFBZdUoyOXk=', 'base64').toString('utf-8');
const client = createClient(SUPABASE_URL, key);
const compId = '20000000-0000-0000-0000-000000000001';

async function runRollupAudit() {
  const { data: accounts } = await client.from('chart_of_accounts').select('*').eq('company_id', compId).order('code');
  const { data: lines } = await client.from('journal_entry_lines').select('*').eq('company_id', compId);

  console.log(`=== AXIS 1 & 6: HIERARCHICAL ROLLUP AUDIT FOR ALL ACCOUNTS ===`);
  console.log(`Total accounts: ${accounts.length}, Total journal lines: ${lines.length}`);

  // Build tree
  // Map by id and code
  const accById = new Map();
  const accByCode = new Map();
  for (const a of accounts) {
    accById.set(a.id, a);
    accByCode.set(a.code, a);
  }

  // Determine direct children for each account
  // A child has parent_id === parent.id OR parent_id === ('acc-' + parent.code)
  const childrenMap = new Map(); // parentId -> [child accounts]
  for (const a of accounts) {
    childrenMap.set(a.id, []);
  }

  for (const a of accounts) {
    if (a.parent_id) {
      let parent = accById.get(a.parent_id);
      if (!parent && a.parent_id.startsWith('acc-')) {
        const code = a.parent_id.replace('acc-', '');
        parent = accByCode.get(code);
      }
      if (parent) {
        const arr = childrenMap.get(parent.id) || [];
        arr.push(a);
        childrenMap.set(parent.id, arr);
      }
    }
  }

  // Also check lines booked directly to each account
  const directLinesMap = new Map();
  for (const l of lines) {
    let acc = accById.get(l.account_id);
    if (!acc && l.account_id.startsWith('acc-')) {
      acc = accByCode.get(l.account_id.replace('acc-', ''));
    }
    const accKey = acc ? acc.id : l.account_id;
    if (!directLinesMap.has(accKey)) directLinesMap.set(accKey, []);
    directLinesMap.get(accKey).push(l);
  }

  const results = [];
  let mismatchCount = 0;
  let parentWithDirectLinesCount = 0;

  for (const a of accounts) {
    const directChildren = childrenMap.get(a.id) || [];
    const isParent = directChildren.length > 0;
    const directLines = directLinesMap.get(a.id) || [];

    if (isParent) {
      // Sum direct children balances
      const sumChildrenBalance = directChildren.reduce((sum, c) => sum + Number(c.balance || c.current_balance || 0), 0);
      const parentBalance = Number(a.balance || a.current_balance || 0);
      const diff = Math.abs(parentBalance - sumChildrenBalance);
      const isMatch = diff < 0.001;

      if (!isMatch) mismatchCount++;
      if (directLines.length > 0) parentWithDirectLinesCount++;

      results.push({
        code: a.code,
        name: a.name_ar,
        level: a.level,
        type: a.type,
        parentBalance: Number(parentBalance.toFixed(3)),
        childrenCount: directChildren.length,
        childrenCodes: directChildren.map(c => `${c.code}(${Number((c.balance||0)).toFixed(3)})`).join(' + '),
        sumChildren: Number(sumChildrenBalance.toFixed(3)),
        diff: Number(diff.toFixed(3)),
        isMatch: isMatch ? 'YES' : 'MISMATCH',
        directLinesCount: directLines.length
      });
    }
  }

  console.table(results);
  console.log(`\nSummary:
  Total parent accounts evaluated: ${results.length}
  Total matched: ${results.length - mismatchCount}
  Total mismatched: ${mismatchCount}
  Parents with direct journal entries: ${parentWithDirectLinesCount}
  `);

  // Print any parent accounts with direct lines
  for (const r of results) {
    if (r.directLinesCount > 0) {
      console.warn(`CRITICAL: Parent Account ${r.code} - ${r.name} has ${r.directLinesCount} DIRECT journal lines!`);
    }
  }
}

runRollupAudit().catch(console.error);
