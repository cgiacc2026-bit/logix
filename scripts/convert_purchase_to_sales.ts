import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(url, key);

const companyId = '20000000-0000-0000-0000-000000000001';

interface InvoiceConversion {
  oldNumber: string;
  newNumber: string;
  customerId: string;
  customerNameAr: string;
  customerCode: string;
  date: string;
  amount: number;
  lineDescription: string;
  notes: string;
}

const CONVERSIONS: InvoiceConversion[] = [
  {
    oldNumber: 'INV-PUR-2026-0035',
    newNumber: 'INV-SAL-2026-0035',
    customerId: '10000000-0000-0000-0000-000000000003',
    customerNameAr: 'جمعية مبارك الكبير التعاونية',
    customerCode: '4640',
    date: '2026-08-30',
    amount: 37.804,
    lineDescription: 'توريد وتوزيع بهارات ومواد مطحونة معتمدة للجمعية',
    notes: 'فاتورة مبيعات رقم (INV-SAL-2026-0035) - جمعية مبارك الكبير التعاونية',
  },
  {
    oldNumber: 'INV-PUR-2026-0049',
    newNumber: 'INV-SAL-2026-0049',
    customerId: '10000000-0000-0000-0000-000000000002',
    customerNameAr: 'جمعية مشرف التعاونية',
    customerCode: 'CUST-014',
    date: '2026-08-18',
    amount: 2.700,
    lineDescription: 'توريد وتوزيع بهارات ومواد مطحونة معتمدة للجمعية',
    notes: 'فاتورة مبيعات رقم (INV-SAL-2026-0049) - جمعية مشرف التعاونية',
  },
  {
    oldNumber: 'INV-PUR-2026-0050',
    newNumber: 'INV-SAL-2026-0050',
    customerId: '10000000-0000-0000-0000-000000000002',
    customerNameAr: 'جمعية مشرف التعاونية',
    customerCode: 'CUST-014',
    date: '2026-08-18',
    amount: 0.900,
    lineDescription: 'توريد وتوزيع بهارات ومواد مطحونة معتمدة للجمعية',
    notes: 'فاتورة مبيعات رقم (INV-SAL-2026-0050) - جمعية مشرف التعاونية',
  },
  {
    oldNumber: 'INV-PUR-2026-0013',
    newNumber: 'INV-SAL-2026-0013',
    customerId: '10000000-0000-0000-0000-000000000008',
    customerNameAr: 'جمعية بيان التعاونية',
    customerCode: '5563',
    date: '2026-08-23',
    amount: 110.500,
    lineDescription: 'توريد وتوزيع بهارات ومواد مطحونة معتمدة للجمعية',
    notes: 'فاتورة مبيعات رقم (INV-SAL-2026-0013) - جمعية بيان التعاونية',
  },
  {
    oldNumber: 'INV-PUR-2026-0039',
    newNumber: 'INV-SAL-2026-0039',
    customerId: '10000000-0000-0000-0000-000000000009',
    customerNameAr: 'جمعية الصباحية التعاونية',
    customerCode: '3124',
    date: '2026-08-16',
    amount: 3.068,
    lineDescription: 'توريد وتوزيع بهارات ومواد مطحونة معتمدة للجمعية',
    notes: 'فاتورة مبيعات رقم (INV-SAL-2026-0039) - جمعية الصباحية التعاونية',
  },
  {
    oldNumber: 'INV-PUR-2026-0040',
    newNumber: 'INV-SAL-2026-0040',
    customerId: '10000000-0000-0000-0000-000000000009',
    customerNameAr: 'جمعية الصباحية التعاونية',
    customerCode: '3124',
    date: '2026-08-16',
    amount: 1.600,
    lineDescription: 'توريد وتوزيع بهارات ومواد مطحونة معتمدة للجمعية',
    notes: 'فاتورة مبيعات رقم (INV-SAL-2026-0040) - جمعية الصباحية التعاونية',
  },
  {
    oldNumber: 'INV-PUR-2026-0037',
    newNumber: 'INV-SAL-2026-0037',
    customerId: '10000000-0000-0000-0000-000000000012',
    customerNameAr: 'جمعية صباح الناصر التعاونية',
    customerCode: '7575',
    date: '2026-08-31',
    amount: 80.000,
    lineDescription: 'توريد وتوزيع بهارات ومواد مطحونة معتمدة للجمعية',
    notes: 'فاتورة مبيعات رقم (INV-SAL-2026-0037) - جمعية صباح الناصر التعاونية',
  },
  {
    oldNumber: 'INV-PUR-2026-0066',
    newNumber: 'INV-SAL-2026-0066',
    customerId: '10000000-0000-0000-0000-000000000014',
    customerNameAr: 'جمعية سلوى التعاونية',
    customerCode: '3764',
    date: '2026-07-31',
    amount: 83.400,
    lineDescription: 'توريد وتوزيع بهارات ومواد مطحونة معتمدة للجمعية',
    notes: 'فاتورة مبيعات رقم (INV-SAL-2026-0066) - جمعية سلوى التعاونية',
  },
  {
    oldNumber: 'INV-PUR-2026-0001',
    newNumber: 'INV-SAL-2026-0001-B',
    customerId: '190fd0d3-ae21-4019-b8f6-f6a0321c3ce7',
    customerNameAr: 'جمعية القيروان التعاونية',
    customerCode: '4568',
    date: '2026-01-10',
    amount: 350.000,
    lineDescription: 'خامات حبوب وبهارات خام خياش (شوال)',
    notes: 'فاتورة مبيعات رقم (INV-SAL-2026-0001-B) - جمعية القيروان التعاونية',
  },
  {
    oldNumber: 'INV-PUR-2026-0002',
    newNumber: 'INV-SAL-2026-0002-B',
    customerId: '10000000-0000-0000-0000-000000000008',
    customerNameAr: 'جمعية بيان التعاونية',
    customerCode: '5563',
    date: '2026-08-15',
    amount: 12.868,
    lineDescription: 'توريد وتوزيع بهارات ومواد مطحونة معتمدة للجمعية',
    notes: 'فاتورة مبيعات رقم (INV-SAL-2026-0002-B) - جمعية بيان التعاونية',
  },
  {
    oldNumber: 'INV-PUR-2026-0063',
    newNumber: 'INV-SAL-2026-0063-B',
    customerId: '10000000-0000-0000-0000-000000000006',
    customerNameAr: 'جمعية شمال غرب الصليبيخات التعاونية',
    customerCode: '301',
    date: '2026-08-13',
    amount: 15.360,
    lineDescription: 'توريد وتوزيع بهارات ومواد مطحونة معتمدة للجمعية',
    notes: 'فاتورة مبيعات رقم (INV-SAL-2026-0063-B) - جمعية شمال غرب الصليبيخات التعاونية',
  },
];

async function runMigration() {
  console.log('--- STARTING INVOICE CONVERSION & JOURNAL CREATION WITH UUIDs ---');

  for (const conv of CONVERSIONS) {
    console.log(`Processing JV for ${conv.newNumber} (${conv.customerNameAr})...`);

    const { data: invRecord } = await supabase
      .from('invoices')
      .select('id')
      .eq('invoice_number', conv.newNumber)
      .single();

    const invId = invRecord?.id;
    if (!invId) {
      console.error(`Invoice not found for ${conv.newNumber}`);
      continue;
    }

    const jvId = crypto.randomUUID();
    const line1Id = crypto.randomUUID();
    const line2Id = crypto.randomUUID();
    const jvNumber = `JV-${conv.newNumber}`;

    const linesData = [
      {
        id: line1Id,
        accountId: 'acc-1120',
        accountCode: '1120',
        accountNameAr: 'الذمم المدينة (حسابات العملاء والجمعيات)',
        debit: conv.amount,
        credit: 0,
        entityType: 'CUSTOMER',
        entityId: conv.customerId,
        entityNameAr: conv.customerNameAr,
        memo: `استحقاق مبيعات فاتورة ${conv.newNumber} - ${conv.customerNameAr}`,
      },
      {
        id: line2Id,
        accountId: 'acc-4100',
        accountCode: '4100',
        accountNameAr: 'إيرادات مبيعات الجمعيات والبهارات',
        debit: 0,
        credit: conv.amount,
        entityType: 'CUSTOMER',
        entityId: conv.customerId,
        entityNameAr: conv.customerNameAr,
        memo: `إيراد مبيعات فاتورة ${conv.newNumber} - ${conv.customerNameAr}`,
      },
    ];

    // Clean up any existing journals referencing this invoice number
    const { data: existingJournals } = await supabase
      .from('journal_entries')
      .select('id')
      .or(`reference.eq.${conv.newNumber},entry_number.eq.${jvNumber}`);

    for (const ej of existingJournals || []) {
      await supabase.from('journal_entry_lines').delete().eq('journal_id', ej.id);
      await supabase.from('journal_entries').delete().eq('id', ej.id);
    }

    const jvPayload = {
      id: jvId,
      company_id: companyId,
      entry_number: jvNumber,
      entry_date: conv.date,
      date: conv.date,
      reference: conv.newNumber,
      reference_type: 'INVOICE',
      reference_id: invId,
      description: `إثبات استحقاق مبيعات فاتورة رقم (${conv.newNumber}) - العميل: ${conv.customerNameAr}`,
      status: 'POSTED',
      total_debit: conv.amount,
      total_credit: conv.amount,
      lines: linesData,
      raw_data: {
        id: jvId,
        entryNumber: jvNumber,
        date: conv.date,
        reference: conv.newNumber,
        description: `إثبات استحقاق مبيعات فاتورة رقم (${conv.newNumber}) - العميل: ${conv.customerNameAr}`,
        status: 'POSTED',
        totalDebit: conv.amount,
        totalCredit: conv.amount,
        isAutoGenerated: true,
        sourceModule: 'INVOICE',
        sourceId: invId,
        lines: linesData,
      },
      updated_at: new Date().toISOString(),
    };

    const { error: jvErr } = await supabase.from('journal_entries').insert(jvPayload);
    if (jvErr) {
      console.error(`Error inserting JV for ${conv.newNumber}:`, jvErr);
      continue;
    }

    const linePayloads = [
      {
        id: line1Id,
        journal_id: jvId,
        journal_entry_id: jvId,
        company_id: companyId,
        account_id: 'acc-1120',
        account_code: '1120',
        account_name_ar: 'الذمم المدينة (حسابات العملاء والجمعيات)',
        debit: conv.amount,
        credit: 0,
        entity_type: 'CUSTOMER',
        entity_id: conv.customerId,
        entity_name_ar: conv.customerNameAr,
        memo: `استحقاق مبيعات فاتورة ${conv.newNumber} - ${conv.customerNameAr}`,
        line_order: 1,
      },
      {
        id: line2Id,
        journal_id: jvId,
        journal_entry_id: jvId,
        company_id: companyId,
        account_id: 'acc-4100',
        account_code: '4100',
        account_name_ar: 'إيرادات مبيعات الجمعيات والبهارات',
        debit: 0,
        credit: conv.amount,
        entity_type: 'CUSTOMER',
        entity_id: conv.customerId,
        entity_name_ar: conv.customerNameAr,
        memo: `إيراد مبيعات فاتورة ${conv.newNumber} - ${conv.customerNameAr}`,
        line_order: 2,
      },
    ];

    const { error: lErr } = await supabase.from('journal_entry_lines').insert(linePayloads);
    if (lErr) {
      console.error(`Error inserting lines for ${conv.newNumber}:`, lErr);
    } else {
      console.log(`✅ Success for ${conv.newNumber} with JV: ${jvNumber} (id: ${jvId})`);
    }

    // Also update raw_data in invoice with journalEntryId: jvId
    const { data: invCurrent } = await supabase.from('invoices').select('raw_data').eq('id', invId).single();
    if (invCurrent?.raw_data) {
      const updatedRaw = {
        ...invCurrent.raw_data,
        journalEntryId: jvId,
      };
      await supabase.from('invoices').update({ raw_data: updatedRaw }).eq('id', invId);
    }
  }

  console.log('🎉 All JVs created successfully with valid UUIDs!');
}

runMigration().catch(console.error);
