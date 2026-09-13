import fs from 'fs';
import { ALWALEED_MILL_PRESET_BACKUP } from '../src/data/alwaleedPresetData';

const CONVERSIONS_MAP: Record<string, {
  customerId: string;
  customerNameAr: string;
  customerCode: string;
  notes: string;
  amount: number;
}> = {
  'INV-SAL-2026-0035': {
    customerId: '10000000-0000-0000-0000-000000000003',
    customerNameAr: 'جمعية مبارك الكبير التعاونية',
    customerCode: '4640',
    notes: 'فاتورة مبيعات رقم (INV-SAL-2026-0035) - جمعية مبارك الكبير التعاونية',
    amount: 37.804,
  },
  'INV-SAL-2026-0049': {
    customerId: '10000000-0000-0000-0000-000000000002',
    customerNameAr: 'جمعية مشرف التعاونية',
    customerCode: 'CUST-014',
    notes: 'فاتورة مبيعات رقم (INV-SAL-2026-0049) - جمعية مشرف التعاونية',
    amount: 2.700,
  },
  'INV-SAL-2026-0050': {
    customerId: '10000000-0000-0000-0000-000000000002',
    customerNameAr: 'جمعية مشرف التعاونية',
    customerCode: 'CUST-014',
    notes: 'فاتورة مبيعات رقم (INV-SAL-2026-0050) - جمعية مشرف التعاونية',
    amount: 0.900,
  },
  'INV-SAL-2026-0013': {
    customerId: '10000000-0000-0000-0000-000000000008',
    customerNameAr: 'جمعية بيان التعاونية',
    customerCode: '5563',
    notes: 'فاتورة مبيعات رقم (INV-SAL-2026-0013) - جمعية بيان التعاونية',
    amount: 110.500,
  },
  'INV-SAL-2026-0039': {
    customerId: '10000000-0000-0000-0000-000000000009',
    customerNameAr: 'جمعية الصباحية التعاونية',
    customerCode: '3124',
    notes: 'فاتورة مبيعات رقم (INV-SAL-2026-0039) - جمعية الصباحية التعاونية',
    amount: 3.068,
  },
  'INV-SAL-2026-0040': {
    customerId: '10000000-0000-0000-0000-000000000009',
    customerNameAr: 'جمعية الصباحية التعاونية',
    customerCode: '3124',
    notes: 'فاتورة مبيعات رقم (INV-SAL-2026-0040) - جمعية الصباحية التعاونية',
    amount: 1.600,
  },
  'INV-SAL-2026-0037': {
    customerId: '10000000-0000-0000-0000-000000000012',
    customerNameAr: 'جمعية صباح الناصر التعاونية',
    customerCode: '7575',
    notes: 'فاتورة مبيعات رقم (INV-SAL-2026-0037) - جمعية صباح الناصر التعاونية',
    amount: 80.000,
  },
  'INV-SAL-2026-0066': {
    customerId: '10000000-0000-0000-0000-000000000014',
    customerNameAr: 'جمعية سلوى التعاونية',
    customerCode: '3764',
    notes: 'فاتورة مبيعات رقم (INV-SAL-2026-0066) - جمعية سلوى التعاونية',
    amount: 83.400,
  },
  'INV-SAL-2026-0001-B': {
    customerId: '190fd0d3-ae21-4019-b8f6-f6a0321c3ce7',
    customerNameAr: 'جمعية القيروان التعاونية',
    customerCode: '4568',
    notes: 'فاتورة مبيعات رقم (INV-SAL-2026-0001-B) - جمعية القيروان التعاونية',
    amount: 350.000,
  },
  'INV-SAL-2026-0002-B': {
    customerId: '10000000-0000-0000-0000-000000000008',
    customerNameAr: 'جمعية بيان التعاونية',
    customerCode: '5563',
    notes: 'فاتورة مبيعات رقم (INV-SAL-2026-0002-B) - جمعية بيان التعاونية',
    amount: 12.868,
  },
  'INV-SAL-2026-0063-B': {
    customerId: '10000000-0000-0000-0000-000000000006',
    customerNameAr: 'جمعية شمال غرب الصليبيخات التعاونية',
    customerCode: '301',
    notes: 'فاتورة مبيعات رقم (INV-SAL-2026-0063-B) - جمعية شمال غرب الصليبيخات التعاونية',
    amount: 15.360,
  },
};

const backup = JSON.parse(JSON.stringify(ALWALEED_MILL_PRESET_BACKUP));

for (const inv of backup.data.invoices) {
  const match = CONVERSIONS_MAP[inv.invoiceNumber];
  if (match) {
    inv.type = 'SALES';
    inv.entityId = match.customerId;
    inv.entityNameAr = match.customerNameAr;
    inv.notes = match.notes;
    inv.lines = [
      {
        id: `line-${inv.invoiceNumber}-1`,
        itemId: 'item-spice-misc',
        itemSku: 'SPICE-MISC',
        itemNameAr: 'توريد وتوزيع بهارات ومواد مطحونة معتمدة للجمعية',
        quantity: 1,
        unitsPerPack: 1,
        unitPrice: match.amount,
        unit: 'دفعة',
        subtotal: match.amount,
        vatRate: 0,
        vatAmount: 0,
        total: match.amount,
        discountValue: 0,
        discountType: 'FIXED',
      },
    ];
  }
}

if (Array.isArray(backup.data.journals)) {
  for (const j of backup.data.journals) {
    for (const [invNum, conv] of Object.entries(CONVERSIONS_MAP)) {
      if (j.reference === invNum || j.entryNumber === `JV-${invNum}`) {
        j.description = `إثبات استحقاق مبيعات فاتورة رقم (${invNum}) - العميل: ${conv.customerNameAr}`;
        j.lines = [
          {
            id: `line-jv-${invNum}-1`,
            accountId: 'acc-1120',
            accountCode: '1120',
            accountNameAr: 'الذمم المدينة (حسابات العملاء والجمعيات)',
            debit: conv.amount,
            credit: 0,
            entityType: 'CUSTOMER',
            entityId: conv.customerId,
            entityNameAr: conv.customerNameAr,
            memo: `استحقاق مبيعات فاتورة ${invNum} - ${conv.customerNameAr}`,
          },
          {
            id: `line-jv-${invNum}-2`,
            accountId: 'acc-4100',
            accountCode: '4100',
            accountNameAr: 'إيرادات مبيعات الجمعيات والبهارات',
            debit: 0,
            credit: conv.amount,
            entityType: 'CUSTOMER',
            entityId: conv.customerId,
            entityNameAr: conv.customerNameAr,
            memo: `إيراد مبيعات فاتورة ${invNum} - ${conv.customerNameAr}`,
          },
        ];
      }
    }
  }
}

const newTsContent = `import { CompanyBackupEnvelope } from '../types';\n\nexport const ALWALEED_MILL_PRESET_BACKUP: CompanyBackupEnvelope = ${JSON.stringify(backup, null, 2)};\n`;

fs.writeFileSync('src/data/alwaleedPresetData.ts', newTsContent, 'utf8');
console.log('✅ alwaleedPresetData.ts updated completely with SALES type and customer mappings!');
