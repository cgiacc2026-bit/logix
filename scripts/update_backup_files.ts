import fs from 'fs';
import path from 'path';

const files = [
  'data/alwaleed_mill_full_database.json',
  'public/alwaleed_mill_latest_backup.json',
];

const CONVERSIONS_MAP: Record<string, {
  newNumber: string;
  customerId: string;
  customerNameAr: string;
  customerCode: string;
  date: string;
  amount: number;
  notes: string;
}> = {
  'INV-PUR-2026-0035': {
    newNumber: 'INV-SAL-2026-0035',
    customerId: '10000000-0000-0000-0000-000000000003',
    customerNameAr: 'جمعية مبارك الكبير التعاونية',
    customerCode: '4640',
    date: '2026-08-30',
    amount: 37.804,
    notes: 'فاتورة مبيعات رقم (INV-SAL-2026-0035) - جمعية مبارك الكبير التعاونية',
  },
  'INV-PUR-2026-0049': {
    newNumber: 'INV-SAL-2026-0049',
    customerId: '10000000-0000-0000-0000-000000000002',
    customerNameAr: 'جمعية مشرف التعاونية',
    customerCode: 'CUST-014',
    date: '2026-08-18',
    amount: 2.700,
    notes: 'فاتورة مبيعات رقم (INV-SAL-2026-0049) - جمعية مشرف التعاونية',
  },
  'INV-PUR-2026-0050': {
    newNumber: 'INV-SAL-2026-0050',
    customerId: '10000000-0000-0000-0000-000000000002',
    customerNameAr: 'جمعية مشرف التعاونية',
    customerCode: 'CUST-014',
    date: '2026-08-18',
    amount: 0.900,
    notes: 'فاتورة مبيعات رقم (INV-SAL-2026-0050) - جمعية مشرف التعاونية',
  },
  'INV-PUR-2026-0013': {
    newNumber: 'INV-SAL-2026-0013',
    customerId: '10000000-0000-0000-0000-000000000008',
    customerNameAr: 'جمعية بيان التعاونية',
    customerCode: '5563',
    date: '2026-08-23',
    amount: 110.500,
    notes: 'فاتورة مبيعات رقم (INV-SAL-2026-0013) - جمعية بيان التعاونية',
  },
  'INV-PUR-2026-0039': {
    newNumber: 'INV-SAL-2026-0039',
    customerId: '10000000-0000-0000-0000-000000000009',
    customerNameAr: 'جمعية الصباحية التعاونية',
    customerCode: '3124',
    date: '2026-08-16',
    amount: 3.068,
    notes: 'فاتورة مبيعات رقم (INV-SAL-2026-0039) - جمعية الصباحية التعاونية',
  },
  'INV-PUR-2026-0040': {
    newNumber: 'INV-SAL-2026-0040',
    customerId: '10000000-0000-0000-0000-000000000009',
    customerNameAr: 'جمعية الصباحية التعاونية',
    customerCode: '3124',
    date: '2026-08-16',
    amount: 1.600,
    notes: 'فاتورة مبيعات رقم (INV-SAL-2026-0040) - جمعية الصباحية التعاونية',
  },
  'INV-PUR-2026-0037': {
    newNumber: 'INV-SAL-2026-0037',
    customerId: '10000000-0000-0000-0000-000000000012',
    customerNameAr: 'جمعية صباح الناصر التعاونية',
    customerCode: '7575',
    date: '2026-08-31',
    amount: 80.000,
    notes: 'فاتورة مبيعات رقم (INV-SAL-2026-0037) - جمعية صباح الناصر التعاونية',
  },
  'INV-PUR-2026-0066': {
    newNumber: 'INV-SAL-2026-0066',
    customerId: '10000000-0000-0000-0000-000000000014',
    customerNameAr: 'جمعية سلوى التعاونية',
    customerCode: '3764',
    date: '2026-07-31',
    amount: 83.400,
    notes: 'فاتورة مبيعات رقم (INV-SAL-2026-0066) - جمعية سلوى التعاونية',
  },
  'INV-PUR-2026-0001': {
    newNumber: 'INV-SAL-2026-0001-B',
    customerId: '190fd0d3-ae21-4019-b8f6-f6a0321c3ce7',
    customerNameAr: 'جمعية القيروان التعاونية',
    customerCode: '4568',
    date: '2026-01-10',
    amount: 350.000,
    notes: 'فاتورة مبيعات رقم (INV-SAL-2026-0001-B) - جمعية القيروان التعاونية',
  },
  'INV-PUR-2026-0002': {
    newNumber: 'INV-SAL-2026-0002-B',
    customerId: '10000000-0000-0000-0000-000000000008',
    customerNameAr: 'جمعية بيان التعاونية',
    customerCode: '5563',
    date: '2026-08-15',
    amount: 12.868,
    notes: 'فاتورة مبيعات رقم (INV-SAL-2026-0002-B) - جمعية بيان التعاونية',
  },
  'INV-PUR-2026-0063': {
    newNumber: 'INV-SAL-2026-0063-B',
    customerId: '10000000-0000-0000-0000-000000000006',
    customerNameAr: 'جمعية شمال غرب الصليبيخات التعاونية',
    customerCode: '301',
    date: '2026-08-13',
    amount: 15.360,
    notes: 'فاتورة مبيعات رقم (INV-SAL-2026-0063-B) - جمعية شمال غرب الصليبيخات التعاونية',
  },
};

for (const f of files) {
  if (!fs.existsSync(f)) continue;
  console.log('Processing JSON file:', f);
  const data = JSON.parse(fs.readFileSync(f, 'utf8'));

  // Invoices array
  if (Array.isArray(data.invoices)) {
    for (const inv of data.invoices) {
      if (inv.invoiceNumber === 'INV-SAL-2026-0013' && Number(inv.grandTotal || inv.total_amount) === 0.65) {
        inv.invoiceNumber = 'INV-SAL-2026-0013-TEST-CANCELLED';
      }
      const match = CONVERSIONS_MAP[inv.invoiceNumber];
      if (match) {
        console.log(`  Updating invoice ${inv.invoiceNumber} -> ${match.newNumber} in ${f}`);
        inv.invoiceNumber = match.newNumber;
        inv.type = 'SALES';
        inv.invoice_type = 'SALES';
        inv.entityId = match.customerId;
        inv.customer_id = match.customerId;
        inv.entityNameAr = match.customerNameAr;
        inv.customer_name = match.customerNameAr;
        inv.notes = match.notes;
        inv.lines = [
          {
            id: `line-${match.newNumber}-1`,
            itemId: 'item-spice-misc',
            itemNameAr: 'توريد وتوزيع بهارات ومواد مطحونة معتمدة للجمعية',
            quantity: 1,
            unitPrice: match.amount,
            unit: 'دفعة',
            total: match.amount,
            discountValue: 0,
            discountType: 'FIXED',
          }
        ];
      }
    }
  }

  // Journal entries array
  if (Array.isArray(data.journalEntries)) {
    for (const j of data.journalEntries) {
      if (j.entryNumber === 'JV-AUTO-INV-SAL-2026-0013') {
        j.entryNumber = 'JV-AUTO-INV-SAL-2026-0013-TEST-CANCELLED';
        j.reference = 'INV-SAL-2026-0013-TEST-CANCELLED';
      }
      for (const [oldNum, conv] of Object.entries(CONVERSIONS_MAP)) {
        if (j.reference === oldNum || j.entryNumber.includes(oldNum)) {
          j.entryNumber = `JV-${conv.newNumber}`;
          j.reference = conv.newNumber;
          j.description = `إثبات استحقاق مبيعات فاتورة رقم (${conv.newNumber}) - العميل: ${conv.customerNameAr}`;
          j.lines = [
            {
              id: `line-${conv.newNumber}-1`,
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
              id: `line-${conv.newNumber}-2`,
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
        }
      }
    }
  }

  fs.writeFileSync(f, JSON.stringify(data, null, 2), 'utf8');
  console.log(`  Saved updated ${f}`);
}

console.log('Done updating JSON backup files!');
