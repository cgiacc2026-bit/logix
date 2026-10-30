import assert from 'assert';
import { localDataStore, DataService } from '../src/services/dataService.ts';
import { matchesSearch } from '../src/utils/searchUtils.ts';
import { PaymentVoucher, JournalEntry, Customer } from '../src/types.ts';

async function runTest() {
  console.log('🧪 Starting Vouchers and Invoices Non-destructive Reconciliation Test...');

  // Setup mock customers
  const custQairawan: Customer = {
    id: 'cust-qairawan',
    code: 'CUST-1001',
    nameAr: 'جمعية القيروان التعاونية',
    nameEn: 'Qairawan Cooperative',
    account_id: 'acc-cust-1',
    balance: 0,
    companyId: 'company-test-1',
  };

  const custAliSabah: Customer = {
    id: 'cust-ali-sabah',
    code: 'CUST-1002',
    nameAr: 'جمعية علي صباح السالم التعاونية',
    nameEn: 'Ali Sabah Al-Salem Cooperative',
    account_id: 'acc-cust-2',
    balance: 0,
    companyId: 'company-test-1',
  };

  localDataStore.saveCustomers([custQairawan, custAliSabah]);

  // Test 1: Deduplication must NEVER discard vouchers belonging to different customers sharing voucherNumber sequence
  const v1: PaymentVoucher = {
    id: 'vch-1',
    voucherNumber: 'RCV-2026-0001',
    companyId: 'company-test-1',
    type: 'RECEIPT',
    date: '2026-10-28',
    amount: 90,
    paymentMethod: 'BANK',
    bankAccountId: 'acc-1111',
    entityType: 'CUSTOMER',
    entityId: custQairawan.id,
    entityNameAr: custQairawan.nameAr,
    status: 'POSTED',
    notes: 'تحصيل',
    createdAt: '2026-10-28T10:00:00Z',
  };

  const v2: PaymentVoucher = {
    id: 'vch-2',
    voucherNumber: 'RCV-2026-0001',
    companyId: 'company-test-1',
    type: 'RECEIPT',
    date: '2026-10-29',
    amount: 290,
    paymentMethod: 'BANK',
    bankAccountId: 'acc-1111',
    entityType: 'CUSTOMER',
    entityId: custAliSabah.id,
    entityNameAr: custAliSabah.nameAr,
    status: 'POSTED',
    notes: 'تحصيل',
    createdAt: '2026-10-29T10:00:00Z',
  };

  const deduped = localDataStore.deduplicateVouchers([v1, v2]);
  assert.strictEqual(deduped.length, 2, 'Deduplication MUST retain both vouchers because entities are different');
  console.log('✅ Test 1 Passed: Deduplication preserved both vouchers with same sequence number for different entities.');

  // Test 2: Journal-backed receipt voucher recovery for جمعية علي صباح السالم (JV-2026-0112)
  localDataStore.saveVouchers([v1]);

  const jvAliSabah: JournalEntry = {
    id: 'jv-2026-0112',
    entryNumber: 'JV-2026-0112',
    reference: 'RCV-2026-0001',
    date: '2026-10-29',
    description: 'قبض مبالغ سند رقم RCV-2026-0001 - جمعية علي صباح السالم التعاونية',
    status: 'POSTED',
    totalDebit: 290,
    totalCredit: 290,
    companyId: 'company-test-1',
    createdAt: '2026-10-29T10:00:00Z',
    lines: [
      {
        id: 'jl-1',
        accountId: 'acc-1111',
        accountCode: '1111',
        accountNameAr: 'البنك التجاري الكويتي',
        debit: 290,
        credit: 0,
        memo: 'إيداع بنكي',
      },
      {
        id: 'jl-2',
        accountId: 'acc-cust-2',
        accountCode: '1120',
        accountNameAr: 'الذمم المدينة',
        debit: 0,
        credit: 290,
        entityId: custAliSabah.id,
        entityType: 'CUSTOMER',
        memo: 'تحصيل من العميل جمعية علي صباح السالم التعاونية',
      },
    ],
  };

  localDataStore.saveJournals([jvAliSabah]);

  await DataService.syncVouchersWithJournals([jvAliSabah]);

  const syncedVouchers = localDataStore.getVouchers();
  assert.strictEqual(syncedVouchers.length, 2, 'Must have 2 vouchers after sync: Qairawan and Ali Sabah Al-Salem');
  
  const foundAliSabah = syncedVouchers.find(
    (v) => v.entityId === custAliSabah.id || v.entityNameAr.includes('علي صباح السالم')
  );
  assert.ok(foundAliSabah, 'Restored Ali Sabah Al-Salem voucher must be present in vouchers store');
  assert.strictEqual(foundAliSabah.amount, 290, 'Restored voucher must have correct amount of 290');
  console.log('✅ Test 2 Passed: Reverse-sync restored Ali Sabah Al-Salem voucher (290 KWD) without overwriting Qairawan (90 KWD).');

  // Test 3: Search matching across variations of Arabic, amounts, and numbers
  assert.ok(matchesSearch(foundAliSabah.entityNameAr, 'علي صباح السالم'), 'Matches exact name');
  assert.ok(matchesSearch(foundAliSabah.entityNameAr, 'على صباح السالم'), 'Matches with Alif Maqsura / Yaa variation');
  assert.ok(matchesSearch(foundAliSabah.entityNameAr, 'صباح السالم'), 'Matches partial token');
  assert.ok(matchesSearch(String(foundAliSabah.amount), '290'), 'Matches amount');
  assert.ok(matchesSearch(foundAliSabah.voucherNumber, 'RCV'), 'Matches voucher prefix');
  console.log('✅ Test 3 Passed: Normalized Arabic & amount search matches correctly.');

  // Test 4: Invoices sync with journals
  const jvInvoice: JournalEntry = {
    id: 'jv-inv-0089',
    entryNumber: 'JV-INV-SAL-2026-0089',
    reference: 'INV-SAL-2026-0089',
    date: '2026-09-22',
    description: 'فاتورة مبيعات آجلة رقم INV-SAL-2026-0089 - جمعية القيروان التعاونية',
    status: 'POSTED',
    totalDebit: 492.014,
    totalCredit: 492.014,
    companyId: 'company-test-1',
    createdAt: '2026-09-22T10:00:00Z',
    lines: [
      {
        id: 'jl-1',
        accountId: 'acc-cust-1',
        accountCode: '1120',
        accountNameAr: 'الذمم المدينة',
        debit: 492.014,
        credit: 0,
        memo: 'فاتورة مبيعات',
        entityId: custQairawan.id,
      },
      {
        id: 'jl-2',
        accountId: 'acc-rev',
        accountCode: '4100',
        accountNameAr: 'المبيعات',
        debit: 0,
        credit: 492.014,
        memo: 'إيراد مبيعات',
      },
    ],
  };

  localDataStore.saveInvoices([]);
  await DataService.syncInvoicesWithJournals([jvInvoice]);

  const restoredInvoices = localDataStore.getInvoices();
  assert.strictEqual(restoredInvoices.length, 1, 'Invoice must be restored from journal');
  assert.strictEqual(restoredInvoices[0].invoiceNumber, 'INV-SAL-2026-0089');
  assert.strictEqual(restoredInvoices[0].grandTotal, 492.014);
  console.log('✅ Test 4 Passed: Invoice successfully restored from journal with 100% data integrity.');

  console.log('🎉 ALL VOUCHER & INVOICE RECONCILIATION TESTS PASSED 100%!');
}

runTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
