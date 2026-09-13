import fs from 'fs';

const filePath = 'src/data/alwaleedPresetData.ts';
let content = fs.readFileSync(filePath, 'utf8');

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

for (const [oldNum, conv] of Object.entries(CONVERSIONS_MAP)) {
  // Replace invoiceNumber
  content = content.replaceAll(`"invoiceNumber": "${oldNum}"`, `"invoiceNumber": "${conv.newNumber}"`);
  content = content.replaceAll(`"entryNumber": "JV-${oldNum}"`, `"entryNumber": "JV-${conv.newNumber}"`);
  content = content.replaceAll(`"reference": "${oldNum}"`, `"reference": "${conv.newNumber}"`);
  content = content.replaceAll(`"line-${oldNum}-1"`, `"line-${conv.newNumber}-1"`);
  content = content.replaceAll(`قيد ترحيل فاتورة مشتريات رقم (${oldNum}) - `, conv.notes);
  content = content.replaceAll(`فاتورة مشتريات ${oldNum} - `, `استحقاق مبيعات فاتورة ${conv.newNumber} - ${conv.customerNameAr}`);
  content = content.replaceAll(`استحقاق مشتريات فاتورة ${oldNum}`, `إيراد مبيعات فاتورة ${conv.newNumber} - ${conv.customerNameAr}`);
}

// Also rename the test 0.650 KWD cancelled invoice
content = content.replace(
  `"invoiceNumber": "INV-SAL-2026-0013",\n        "date": "2026-09-09"`,
  `"invoiceNumber": "INV-SAL-2026-0013-TEST-CANCELLED",\n        "date": "2026-09-09"`
);

// For the invoices that had "type": "PURCHASE", replace them where appropriate
// We can do this safely using regex or JSON parse
fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated alwaleedPresetData.ts text occurrences');
