import { ALWALEED_MILL_PRESET_BACKUP } from '../src/data/alwaleedPresetData.ts';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SUPABASE_URL = 'https://exupcqbzfngpbsjrzhjw.supabase.co';
const key = Buffer.from('c2Jfc2VjcmV0X3pCY2tDWUQ0bTNKMmZ5UXJsZUFEdndfNFBZdUoyOXk=', 'base64').toString('utf-8');
const client = createClient(SUPABASE_URL, key);
const compId = '20000000-0000-0000-0000-000000000001';

async function run() {
  const { data: entries } = await client
    .from('journal_entries')
    .select('*')
    .eq('company_id', compId)
    .order('entry_date');

  const { data: lines } = await client
    .from('journal_entry_lines')
    .select('journal_entry_id')
    .eq('company_id', compId);

  const lineSet = new Set((lines || []).map((l: any) => l.journal_entry_id));
  const ghostEntries = (entries || []).filter((e: any) => !lineSet.has(e.id));

  const presetJournals = ALWALEED_MILL_PRESET_BACKUP.data?.journals || [];

  const { data: invoices } = await client
    .from('invoices')
    .select('*')
    .eq('company_id', compId);

  const { data: vouchers } = await client
    .from('payment_vouchers')
    .select('*')
    .eq('company_id', compId);

  const report: any[] = [];

  for (let i = 0; i < ghostEntries.length; i++) {
    const g = ghostEntries[i];
    const inPreset = presetJournals.find((pj: any) => 
      pj.entryNumber === g.entry_number || 
      pj.id === g.id || 
      (pj.reference && pj.reference === g.reference)
    );

    const linkedInvoice = (invoices || []).find((inv: any) => 
      inv.invoice_number === g.reference || 
      (g.entry_number && g.entry_number.includes(inv.invoice_number))
    );

    const linkedVoucher = (vouchers || []).find((v: any) => 
      v.voucher_number === g.reference || 
      (g.entry_number && g.entry_number.includes(v.voucher_number))
    );

    let source = '';
    let hasLines = false;
    let lineCount = 0;
    let linesData: any[] = [];

    if (inPreset && Array.isArray(inPreset.lines) && inPreset.lines.length > 0) {
      source = 'ملف alwaleedPresetData.ts (السطور متوفرة وموثقة بالكامل)';
      hasLines = true;
      lineCount = inPreset.lines.length;
      linesData = inPreset.lines;
    } else if (linkedVoucher) {
      source = `سند دفع/قبض بقاعدة البيانات (${linkedVoucher.voucher_number})`;
      hasLines = false;
    } else if (linkedInvoice) {
      source = `فاتورة بقاعدة البيانات (${linkedInvoice.invoice_number})`;
      hasLines = false;
    } else if (g.entry_number?.startsWith('REV-')) {
      source = 'قيد عكسي آلي في قاعدة البيانات';
      hasLines = false;
    } else {
      source = 'قيد مسجل في قاعدة البيانات دون سطور';
      hasLines = false;
    }

    report.push({
      index: i + 1,
      id: g.id,
      entry_number: g.entry_number,
      entry_date: g.entry_date || g.date || '',
      amount: Number(g.total_debit || 0),
      description: g.description || '',
      reference: g.reference || '',
      source,
      hasLines,
      lineCount,
      linesData
    });
  }

  fs.writeFileSync('./scripts/ghost_entries_audit.json', JSON.stringify(report, null, 2));

  console.log(`Audited ${report.length} ghost entries.`);
  const withLines = report.filter(r => r.hasLines).length;
  const withoutLines = report.filter(r => !r.hasLines).length;
  console.log(`Entries with full lines in preset file: ${withLines}`);
  console.log(`Entries needing lines generation from linked documents: ${withoutLines}`);

  const categories: Record<string, number> = {};
  for (const r of report) {
    categories[r.source] = (categories[r.source] || 0) + 1;
  }
  console.log('\nCategories:');
  console.table(categories);
}

run().catch(console.error);
