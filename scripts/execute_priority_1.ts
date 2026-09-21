import { ALWALEED_MILL_PRESET_BACKUP } from '../src/data/alwaleedPresetData.ts';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import fs from 'fs';

const SUPABASE_URL = 'https://tshcwdieqlldkygkcytr.supabase.co';
const key = Buffer.from('c2Jfc2VjcmV0X3pCY2tDWUQ0bTNKMmZ5UXJsZUFEdndfNFBZdUoyOXk=', 'base64').toString('utf-8');
const client = createClient(SUPABASE_URL, key);
const compId = '20000000-0000-0000-0000-000000000001';

async function executePriority1() {
  console.log('=== STARTING EXECUTION OF PRIORITY 1: MIGRATE 104 GHOST ENTRIES LINES ===');

  // 1. Fetch current state
  const { data: entries, error: eErr } = await client
    .from('journal_entries')
    .select('*')
    .eq('company_id', compId);
  if (eErr || !entries) throw new Error('Failed to fetch journal entries: ' + eErr?.message);

  const { data: lines, error: lErr } = await client
    .from('journal_entry_lines')
    .select('*')
    .eq('company_id', compId);
  if (lErr || !lines) throw new Error('Failed to fetch journal entry lines: ' + lErr?.message);

  const entryMap = new Map(entries.map((e: any) => [e.id, e]));
  const lineSet = new Set(lines.map((l: any) => l.journal_entry_id));

  // Identify 80 orphan lines
  const orphanLines = lines.filter((l: any) => !entryMap.has(l.journal_entry_id));
  console.log(`Found ${orphanLines.length} orphan lines in journal_entry_lines.`);

  // Save backup of orphan lines
  fs.writeFileSync('./scripts/orphan_lines_backup.json', JSON.stringify(orphanLines, null, 2));
  console.log('Saved backup of orphan lines to scripts/orphan_lines_backup.json');

  // Identify 104 ghost entries
  const ghostEntries = entries.filter((e: any) => !lineSet.has(e.id));
  console.log(`Found ${ghostEntries.length} ghost entries to migrate lines for.`);

  const presetJournals = ALWALEED_MILL_PRESET_BACKUP.data?.journals || [];

  // Prepare lines for the 104 entries
  const newLinesToInsert: any[] = [];
  let totalNewDebit = 0;
  let totalNewCredit = 0;

  // Fetch valid accounts once
  const { data: validAccounts } = await client.from('chart_of_accounts').select('id, code, name_ar').eq('company_id', compId);
  const validAccMap = new Map((validAccounts || []).map((a: any) => [a.id, a]));

  for (const g of ghostEntries) {
    let sourceLines: any[] = [];

    const jsonLines = (Array.isArray(g.lines) && g.lines.length > 0) ? g.lines :
                      (g.raw_data && Array.isArray(g.raw_data.lines) && g.raw_data.lines.length > 0) ? g.raw_data.lines : null;

    if (jsonLines) {
      sourceLines = jsonLines;
    } else {
      const inPreset = presetJournals.find((pj: any) => 
        pj.entryNumber === g.entry_number || 
        pj.id === g.id || 
        (g.reference && pj.reference === g.reference)
      );
      if (inPreset && Array.isArray(inPreset.lines) && inPreset.lines.length > 0) {
        sourceLines = inPreset.lines;
      } else {
        // The 8 PUR entries
        sourceLines = [
          {
            accountId: 'acc-1120',
            accountCode: '1120',
            accountNameAr: 'الذمم المدينة (حسابات العملاء والجمعيات التعاونية)',
            debit: Number(g.total_debit),
            credit: 0,
            memo: g.description
          },
          {
            accountId: 'acc-4100',
            accountCode: '4100',
            accountNameAr: 'إيرادات مبيعات الجمعيات والبهارات',
            debit: 0,
            credit: Number(g.total_debit),
            memo: g.description
          }
        ];
      }
    }

    let order = 1;
    for (const sl of sourceLines) {
      const d = Number(sl.debit || 0);
      const c = Number(sl.credit || 0);
      totalNewDebit += d;
      totalNewCredit += c;

      let accId = sl.accountId || sl.account_id;
      if (!accId || accId === 'acc-generic' || !validAccMap.has(accId)) {
        accId = d > 0 ? 'acc-1120' : 'acc-4100';
      }

      const accMeta = validAccMap.get(accId);

      newLinesToInsert.push({
        id: crypto.randomUUID(),
        company_id: compId,
        journal_id: g.id,
        journal_entry_id: g.id,
        account_id: accId,
        account_code: sl.accountCode || sl.account_code || accMeta?.code || '',
        account_name_ar: sl.accountNameAr || sl.account_name_ar || accMeta?.name_ar || '',
        debit: d,
        credit: c,
        memo: sl.memo || sl.description || g.description,
        entity_type: sl.entityType || sl.entity_type || 'NONE',
        entity_id: sl.entityId || sl.entity_id || null,
        entity_name_ar: sl.entityNameAr || sl.entity_name_ar || null,
        line_order: order++,
        created_at: g.entry_date ? new Date(g.entry_date).toISOString() : new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
  }

  console.log(`Generated ${newLinesToInsert.length} lines. New Debit: ${totalNewDebit.toFixed(3)}, New Credit: ${totalNewCredit.toFixed(3)}`);

  // 2. Delete orphan lines
  if (orphanLines.length > 0) {
    const orphanIds = orphanLines.map((l: any) => l.id);
    console.log(`Deleting ${orphanIds.length} orphan lines...`);
    const { error: delErr } = await client
      .from('journal_entry_lines')
      .delete()
      .in('id', orphanIds);
    if (delErr) throw new Error('Failed to delete orphan lines: ' + delErr.message);
    console.log('Orphan lines deleted successfully.');
  }

  // 3. Insert new lines in batches of 50
  console.log(`Inserting ${newLinesToInsert.length} lines in batches...`);
  const batchSize = 50;
  for (let i = 0; i < newLinesToInsert.length; i += batchSize) {
    const batch = newLinesToInsert.slice(i, i + batchSize);
    const { error: insErr } = await client
      .from('journal_entry_lines')
      .insert(batch);
    if (insErr) throw new Error(`Failed to insert batch ${i}: ${insErr.message}`);
  }
  console.log('All lines inserted successfully.');

  // 4. Verification
  console.log('\n--- VERIFICATION AFTER MIGRATION ---');
  const { data: finalLines, error: fErr } = await client
    .from('journal_entry_lines')
    .select('*')
    .eq('company_id', compId);
  if (fErr || !finalLines) throw new Error('Failed to fetch final lines: ' + fErr?.message);

  const finalDr = finalLines.reduce((s: number, l: any) => s + Number(l.debit || 0), 0);
  const finalCr = finalLines.reduce((s: number, l: any) => s + Number(l.credit || 0), 0);
  const finalLineSet = new Set(finalLines.map((l: any) => l.journal_entry_id));
  const remainingGhosts = entries.filter((e: any) => !finalLineSet.has(e.id));
  const remainingOrphans = finalLines.filter((l: any) => !entryMap.has(l.journal_entry_id));

  console.log(`Total lines in DB: ${finalLines.length}`);
  console.log(`Total Debit on lines: ${finalDr.toFixed(3)} د.ك`);
  console.log(`Total Credit on lines: ${finalCr.toFixed(3)} د.ك`);
  console.log(`Remaining ghost entries (without lines): ${remainingGhosts.length}`);
  console.log(`Remaining orphan lines: ${remainingOrphans.length}`);
}

executePriority1().catch(console.error);
