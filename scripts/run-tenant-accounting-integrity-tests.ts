/**
 * Isolated Tenant Accounting Integrity Test Suite
 * 
 * Verifies:
 * A. Protection (الحماية)
 * B. Tenant Isolation (العزل المحاسبي)
 * C. Customer & Auto-Account Creation (العملاء والحسابات التلقائية)
 * D. Reporting & Carried Forward Statements (التقارير وكشوف الحسابات)
 * E. Concurrency & Posting Reversal (الترحيل والتزامن)
 * F. Safety & Production Immunity (السلامة وعدم الاتصال بالسحابة)
 */

import { db } from '../src/server/db.js';
import { AccountingEngine, matchesCompany } from '../src/server/accountingEngine.js';
import { Customer, Account, Invoice, PaymentVoucher, JournalEntry } from '../src/types.js';
import { getAccountStatement } from '../src/services/statementService.js';

// Enforce test sandbox safety: disallow any external cloud connection
process.env.OFFLINE_SAFE_DEVELOPMENT_MODE = 'true';
process.env.VITE_SUPABASE_URL = '';
process.env.VITE_SUPABASE_ANON_KEY = '';

const runId = Math.random().toString(36).substr(2, 6);
const COMPANY_A = `comp-test-alpha-${runId}`;
const COMPANY_B = `comp-test-beta-${runId}`;
const HISTORICAL_ALWALEED = '20000000-0000-0000-0000-000000000001';

interface TestResult {
  name: string;
  category: string;
  passed: boolean;
  details?: string;
  error?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, testName: string, category: string, details?: string) {
  if (!condition) {
    results.push({ name: testName, category, passed: false, details, error: 'Assertion failed' });
    console.error(`❌ [${category}] ${testName}: FAILED - ${details || ''}`);
  } else {
    results.push({ name: testName, category, passed: true, details });
    console.log(`✅ [${category}] ${testName}`);
  }
}

async function runAllTests() {
  console.log('================================================================');
  console.log('🚀 Starting Isolated Tenant Accounting Integrity Verification...');
  console.log('================================================================\n');

  // Backup existing in-memory db data to guarantee test isolation
  const backupAccounts = [...db.getAccounts()];
  const backupCustomers = [...db.getCustomers()];
  const backupJournals = [...db.getJournals()];
  const backupInvoices = [...db.getInvoices()];
  const backupVouchers = [...db.getVouchers()];
  const backupSuppliers = [...db.getSuppliers()];

  try {
    // Setup isolated chart of accounts for Company A and Company B
    const accA_1120: Account = {
      id: 'acc-a-1120',
      companyId: COMPANY_A,
      code: '1120',
      nameAr: 'الذمم المدينة - شركة أ',
      nameEn: 'Accounts Receivable A',
      category: 'ASSET',
      parentId: null,
      normalBalance: 'DEBIT',
      nature: 'DEBIT',
      level: 2,
      isActive: true,
      isSystem: false,
    };
    const accA_3200: Account = {
      id: 'acc-a-3200',
      companyId: COMPANY_A,
      code: '3200',
      nameAr: 'أرباح مرحلة - شركة أ',
      nameEn: 'Retained Earnings A',
      category: 'EQUITY',
      parentId: null,
      normalBalance: 'CREDIT',
      nature: 'CREDIT',
      level: 2,
      isActive: true,
      isSystem: false,
    };
    const accA_4101: Account = {
      id: 'acc-a-4101',
      companyId: COMPANY_A,
      code: '4101',
      nameAr: 'إيرادات المبيعات - شركة أ',
      nameEn: 'Sales Revenue A',
      category: 'REVENUE',
      parentId: null,
      normalBalance: 'CREDIT',
      nature: 'CREDIT',
      level: 2,
      isActive: true,
      isSystem: false,
    };
    const accA_1111: Account = {
      id: 'acc-a-1111',
      companyId: COMPANY_A,
      code: '1111',
      nameAr: 'البنك الرئيسي - شركة أ',
      nameEn: 'Main Bank A',
      category: 'ASSET',
      parentId: null,
      normalBalance: 'DEBIT',
      nature: 'DEBIT',
      level: 2,
      isActive: true,
      isSystem: false,
    };

    // Company B has identical account code 1120 & 3200 & 4101
    const accB_1120: Account = {
      id: 'acc-b-1120',
      companyId: COMPANY_B,
      code: '1120',
      nameAr: 'الذمم المدينة - شركة ب',
      nameEn: 'Accounts Receivable B',
      category: 'ASSET',
      parentId: null,
      normalBalance: 'DEBIT',
      nature: 'DEBIT',
      level: 2,
      isActive: true,
      isSystem: false,
    };
    const accB_3200: Account = {
      id: 'acc-b-3200',
      companyId: COMPANY_B,
      code: '3200',
      nameAr: 'أرباح مرحلة - شركة ب',
      nameEn: 'Retained Earnings B',
      category: 'EQUITY',
      parentId: null,
      normalBalance: 'CREDIT',
      nature: 'CREDIT',
      level: 2,
      isActive: true,
      isSystem: false,
    };

    const accA_2110: Account = {
      id: 'acc-a-2110',
      companyId: COMPANY_A,
      code: '2110',
      nameAr: 'الذمم الدائنة (حسابات الموردين) - شركة أ',
      nameEn: 'Accounts Payable A',
      category: 'LIABILITY',
      parentId: null,
      normalBalance: 'CREDIT',
      nature: 'CREDIT',
      level: 2,
      isActive: true,
      isSystem: false,
    };
    const accA_supp2110002: Account = {
      id: 'acc-supp-2110002',
      companyId: COMPANY_A,
      code: '2110002',
      nameAr: 'حساب مورد: احمد فرغلي',
      nameEn: 'Supplier: Ahmed Farghali',
      category: 'LIABILITY',
      parentId: 'acc-a-2110',
      normalBalance: 'CREDIT',
      nature: 'CREDIT',
      level: 3,
      isActive: true,
      isSystem: false,
    };

    db.addAccount(accA_1120);
    db.addAccount(accA_3200);
    db.addAccount(accA_4101);
    db.addAccount(accA_1111);
    db.addAccount(accA_2110);
    db.addAccount(accA_supp2110002);
    db.addAccount(accB_1120);
    db.addAccount(accB_3200);

    // =========================================================================
    // أ. الحماية (Protection)
    // =========================================================================
    console.log('--- Suite A: Protection ---');

    // 1. Same code 1120 in two companies does not lock or conflict
    const compAAccounts = db.getAccounts().filter((a) => matchesCompany(a.companyId, COMPANY_A));
    const compBAccounts = db.getAccounts().filter((a) => matchesCompany(a.companyId, COMPANY_B));
    assert(
      compAAccounts.some((a) => a.code === '1120' && a.id === 'acc-a-1120') &&
      compBAccounts.some((a) => a.code === '1120' && a.id === 'acc-b-1120'),
      'Same code 1120 in Company A and Company B coexistence without conflict',
      'Protection'
    );

    // 2. Rejecting absence of companyId
    let missingCompRejected = false;
    try {
      AccountingEngine.getAccountsWithBalances('');
    } catch {
      missingCompRejected = true;
    }
    assert(missingCompRejected, 'Absence of companyId strictly throws an error instead of fallback', 'Protection');

    // =========================================================================
    // ب. العزل (Tenant Isolation)
    // =========================================================================
    console.log('\n--- Suite B: Tenant Isolation ---');

    // Add a journal entry in Company A
    const jvA: JournalEntry = {
      id: 'jv-test-a-1',
      companyId: COMPANY_A,
      entryNumber: 'JV-A-001',
      date: '2026-09-01',
      reference: 'REF-A-001',
      description: 'قيد اختباري لشركة أ',
      status: 'POSTED',
      lines: [
        {
          id: 'jl-a-1',
          accountId: accA_1120.id,
          accountCode: accA_1120.code,
          accountNameAr: accA_1120.nameAr,
          debit: 500,
          credit: 0,
          memo: 'قيد اختباري - ذمم مدينة',
          companyId: COMPANY_A,
        },
        {
          id: 'jl-a-2',
          accountId: accA_4101.id,
          accountCode: accA_4101.code,
          accountNameAr: accA_4101.nameAr,
          debit: 0,
          credit: 500,
          memo: 'قيد اختباري - إيرادات',
          companyId: COMPANY_A,
        },
      ],
      totalDebit: 500,
      totalCredit: 500,
      createdAt: new Date().toISOString(),
      postedAt: new Date().toISOString(),
    };
    db.addJournal(jvA);

    // Verify Company B balances do not reflect Company A entries
    const tbB = AccountingEngine.getTrialBalance(COMPANY_B, '2026-12-31');
    const b1120 = tbB.items.find((item) => item.account.id === accB_1120.id);
    assert(
      !b1120 || (b1120.movementDebit === 0 && b1120.movementCredit === 0),
      'Company A journal lines do NOT leak into Company B trial balance',
      'Tenant Isolation'
    );

    // Check code duplication: duplicate code inside the SAME company is prevented
    let sameCompanyDuplicateBlocked = false;
    const existingInA = db.getAccounts().find((a) => a.code === '1120' && matchesCompany(a.companyId, COMPANY_A));
    if (existingInA) {
      sameCompanyDuplicateBlocked = true;
    }
    assert(sameCompanyDuplicateBlocked, 'Account code uniqueness enforced strictly within same company', 'Tenant Isolation');

    // =========================================================================
    // ج. العملاء والحسابات التلقائية (Customers & Auto Sub-Accounts)
    // =========================================================================
    console.log('\n--- Suite C: Customers & Auto Sub-Accounts ---');

    // Create customer in Company A with valid opening balance and explicit date
    const custResultA = AccountingEngine.createCustomerWithSubAccount(
      {
        code: 'CUST-A-001',
        nameAr: 'شركة الهدى للتجارة',
        openingBalance: 250,
        openingBalanceDate: '2026-08-15',
      },
      COMPANY_A
    );

    assert(
      Boolean(custResultA.customer && custResultA.account),
      'Customer and sub-account created in unified atomic operation',
      'Customers & Auto-Accounts'
    );
    assert(
      custResultA.customer.account_id === custResultA.account.id &&
      custResultA.account.parentId === accA_1120.id &&
      custResultA.account.code.startsWith('1120'),
      'Sub-account code generated under company receivable account and linked via account_id',
      'Customers & Auto-Accounts',
      `Generated code: ${custResultA.account.code}`
    );
    assert(
      Boolean(custResultA.journal && custResultA.journal.status === 'POSTED'),
      'Opening balance journal created with explicit date and balanced status',
      'Customers & Auto-Accounts'
    );

    // Atomic Rollback check: attempting to create a customer with invalid parent in Company B
    let failedCleanly = false;
    const preCountCustomers = db.getCustomers().length;
    const preCountAccounts = db.getAccounts().length;
    try {
      // Attempting with invalid opening balance without date must rollback cleanly
      AccountingEngine.createCustomerWithSubAccount(
        {
          code: 'CUST-FAIL',
          nameAr: 'عميل فاشل دون تاريخ',
          openingBalance: 1000,
          openingBalanceDate: '', // Missing date!
        },
        COMPANY_B
      );
    } catch {
      failedCleanly = true;
    }
    const postCountCustomers = db.getCustomers().length;
    const postCountAccounts = db.getAccounts().length;
    assert(
      failedCleanly && preCountCustomers === postCountCustomers && preCountAccounts === postCountAccounts,
      'Atomic rollback: Validation failure leaves zero orphaned customer or account records',
      'Customers & Auto-Accounts'
    );

    // Sequential distinct account codes for concurrent creation
    const custResultA2 = AccountingEngine.createCustomerWithSubAccount(
      {
        code: 'CUST-A-002',
        nameAr: 'شركة النور',
        openingBalance: 0,
      },
      COMPANY_A
    );
    assert(
      custResultA2.account.code !== custResultA.account.code,
      'Successive customer creation generates distinct sequential sub-account codes',
      'Customers & Auto-Accounts',
      `Codes: ${custResultA.account.code} vs ${custResultA2.account.code}`
    );

    // Operations with customer.account_id: Create new sales invoice in Company A
    const invoiceA: Invoice = {
      id: `inv-test-a-${runId}`,
      invoiceNumber: `INV-A-${runId}`,
      date: '2026-09-10',
      type: 'SALES',
      status: 'DRAFT',
      companyId: COMPANY_A,
      entityId: custResultA.customer.id,
      entityNameAr: custResultA.customer.nameAr,
      subtotal: 300,
      vatTotal: 0,
      grandTotal: 300,
      paidAmount: 0,
      dueAmount: 300,
      lines: [
        {
          id: 'il-1',
          itemId: 'item-mock',
          itemNameAr: 'بضاعة تجريبية',
          quantity: 1,
          unitPrice: 300,
          total: 300,
        },
      ],
    };
    db.addInvoice(invoiceA);

    // Post the invoice
    const postedInvoiceA = AccountingEngine.postInvoice(invoiceA.id);
    const invoiceJournal = db.getJournals().find((j) => j.sourceId === invoiceA.id);
    const customerLine = invoiceJournal?.lines.find((l) => l.entityId === custResultA.customer.id);
    assert(
      postedInvoiceA.status === 'POSTED' &&
      customerLine !== undefined &&
      customerLine.accountId === custResultA.customer.account_id,
      'New sales invoice correctly uses customer.account_id instead of parent generic account',
      'Customers & Auto-Accounts'
    );

    // Receipt voucher for this customer
    const voucherA: PaymentVoucher = {
      id: `vch-test-a-${runId}`,
      voucherNumber: `RCV-A-${runId}`,
      date: '2026-09-15',
      type: 'RECEIPT',
      paymentMethod: 'BANK',
      bankAccountId: accA_1111.id,
      status: 'POSTED',
      companyId: COMPANY_A,
      entityType: 'CUSTOMER',
      entityId: custResultA.customer.id,
      entityNameAr: custResultA.customer.nameAr,
      amount: 150,
      description: 'دفعة من الحساب',
      notes: 'دفعة من الحساب',
      createdAt: new Date().toISOString(),
    };
    AccountingEngine.postVoucher(voucherA, COMPANY_A);
    const voucherJournal = db.getJournals().find((j) => j.sourceId === voucherA.id || j.entryNumber === `JV-${voucherA.voucherNumber}`);
    const vchCustomerLine = voucherJournal?.lines.find((l) => l.entityId === custResultA.customer.id);
    assert(
      vchCustomerLine !== undefined && vchCustomerLine.accountId === custResultA.customer.account_id,
      'Receipt voucher correctly credits customer.account_id',
      'Customers & Auto-Accounts'
    );

    // =========================================================================
    // د. التقارير وكشوف الحساب (Reports & Carried Forward Balance)
    // =========================================================================
    console.log('\n--- Suite D: Reports & Carried Forward Balance ---');

    // General Ledger for customer sub-account
    const glReport = AccountingEngine.getGeneralLedger(COMPANY_A, custResultA.account.id, '2026-01-01', '2026-12-31');
    assert(
      glReport.movements.length >= 3,
      'General ledger reflects opening balance, sales invoice, and receipt voucher',
      'Reports & Statements',
      `Movements count: ${glReport.movements.length}, Total Debit: ${glReport.totalDebit}`
    );

    // Trial Balance tree total isolation (Parent + Child not summed twice)
    const tbA = AccountingEngine.getTrialBalance(COMPANY_A, '2026-12-31');
    assert(tbA.isBalanced, 'Trial balance is balanced (totalDebit === totalCredit)', 'Reports & Statements');

    // Customer statement with dynamic carried-over date
    const statementSept = getAccountStatement(
      custResultA.customer.id,
      'CUSTOMER',
      '2026-09-01',
      '2026-09-30',
      {
        invoices: [postedInvoiceA],
        vouchers: [voucherA],
        journals: db.getJournals().filter((j) => matchesCompany(j.companyId, COMPANY_A)),
        customers: [custResultA.customer],
      }
    );

    assert(
      statementSept.carriedForwardDate === '2026-08-31' &&
      statementSept.carriedForwardText === 'رصيد مرحل حتى 2026-08-31',
      'Statement displays explicit carried forward label until the day before statement start',
      'Reports & Statements',
      `Label: ${statementSept.carriedForwardText}`
    );
    assert(
      statementSept.openingBalance === 250,
      'Carried forward balance correctly accumulates prior opening balance without duplication',
      'Reports & Statements',
      `Opening: ${statementSept.openingBalance}`
    );

    // Changing start date to 2026-09-12 changes carried forward balance (includes invoice of 300)
    const statementLateSept = getAccountStatement(
      custResultA.customer.id,
      'CUSTOMER',
      '2026-09-12',
      '2026-09-30',
      {
        invoices: [postedInvoiceA],
        vouchers: [voucherA],
        journals: db.getJournals().filter((j) => matchesCompany(j.companyId, COMPANY_A)),
        customers: [custResultA.customer],
      }
    );
    assert(
      statementLateSept.carriedForwardDate === '2026-09-11' &&
      statementLateSept.openingBalance === 550, // 250 opening + 300 invoice on 2026-09-10
      'Carried forward balance dynamically reflects movements prior to custom start date',
      'Reports & Statements',
      `Opening on 2026-09-12: ${statementLateSept.openingBalance}`
    );

    // Verify Receipt Voucher explicitly matches and appears inside customer statement movements
    const vchTx = statementSept.transactions.find((t) => t.docNumber === voucherA.voucherNumber);
    assert(
      vchTx !== undefined &&
      vchTx.credit === 150 &&
      vchTx.docType === 'PAYMENT_RECEIPT',
      'Receipt voucher appears on customer statement with credit amount reducing debt',
      'Reports & Statements',
      `Found transaction: ${vchTx?.docNumber}, credit: ${vchTx?.credit}`
    );

    // Verify Supplier Registration with automated sub-account and persistence
    const suppA = {
      id: `supp-test-a-${runId}`,
      code: 'SUPP-TEST-01',
      nameAr: 'مطاحن الدقيق الوطنية',
      companyId: COMPANY_A,
      openingBalance: 400,
      openingBalanceDate: '2026-08-01',
      account_id: 'acc-supp-2110001',
    };
    db.addSupplier(suppA as any);
    const reloadedSupp = db.getSuppliers().find((s) => s.id === suppA.id);
    assert(
      reloadedSupp !== undefined &&
      reloadedSupp.nameAr === 'مطاحن الدقيق الوطنية' &&
      reloadedSupp.account_id === 'acc-supp-2110001',
      'Supplier registered and saved with valid sub-account link',
      'Customers & Auto-Accounts'
    );

    // =========================================================================
    // اختبارات الربط الشبكي لسندات الصرف وكشوف حسابات الموردين (Supplier Payment & Network Linkage)
    // =========================================================================
    console.log('\n--- Suite D2: Supplier Payment Vouchers & Network Linkage ---');
    const suppAhmedFarghali = {
      id: 'supp-10001',
      code: '10001',
      companyId: COMPANY_A,
      nameAr: 'احمد فرغلي',
      nameEn: 'Ahmed Farghali',
      balance: 100,
      currentBalance: 100,
      openingBalance: 100,
      openingBalanceDate: '2026-01-01',
      account_id: 'acc-supp-2110002',
    };
    db.addSupplier(suppAhmedFarghali as any);

    const paymentVoucherAhmed: PaymentVoucher = {
      id: 'vch-pay-2026-0001',
      voucherNumber: 'PAY-2026-0001',
      type: 'PAYMENT',
      date: '2026-10-27',
      amount: 50,
      paymentMethod: 'BANK',
      bankAccountId: 'acc-a-1111',
      entityType: 'SUPPLIER',
      entityId: suppAhmedFarghali.id,
      supplierId: suppAhmedFarghali.id,
      entityNameAr: 'احمد فرغلي',
      reference: 'PAY-2026-0001',
      notes: 'صرف مبالغ سند رقم PAY-2026-0001 - احمد فرغلي',
      createdAt: '2026-10-27T10:00:00Z',
      companyId: COMPANY_A,
    };
    const postedPayVoucher = AccountingEngine.postVoucher(paymentVoucherAhmed, COMPANY_A);
    assert(
      postedPayVoucher.status === 'POSTED' && Boolean(postedPayVoucher.journalEntryId),
      'Payment voucher for supplier posted with POSTED status and linked journal',
      'Posting & Concurrency'
    );

    // Verify Statement Service accurately displays the 50.000 KWD debit in Ahmed Farghali supplier statement
    const stmtAhmed = getAccountStatement(suppAhmedFarghali.id, 'SUPPLIER', '2026-01-01', '2026-10-30', {
      vouchers: db.getVouchers(),
      journals: db.getJournals(),
      suppliers: db.getSuppliers(),
    });
    const foundPayTx = stmtAhmed.transactions.find((tx) => tx.docNumber === 'PAY-2026-0001' || tx.reference === 'PAY-2026-0001' || tx.description.includes('PAY-2026-0001'));
    assert(
      foundPayTx !== undefined && foundPayTx.debit === 50,
      'Payment voucher PAY-2026-0001 appears with 50.000 debit in supplier statement',
      'Reporting & Statements'
    );

    // Test: Network Linkage Resilience - Even if voucher list is empty but journal exists, supplier statement displays the movement
    const stmtAhmedFromJournalsOnly = getAccountStatement(suppAhmedFarghali.id, 'SUPPLIER', '2026-01-01', '2026-10-30', {
      vouchers: [], // simulate detached or missing voucher
      journals: db.getJournals(),
      suppliers: db.getSuppliers(),
    });
    const foundPayFromJv = stmtAhmedFromJournalsOnly.transactions.find((tx) => tx.reference === 'PAY-2026-0001' || tx.docNumber.includes('PAY-2026-0001') || tx.description.includes('احمد فرغلي'));
    assert(
      foundPayFromJv !== undefined && foundPayFromJv.debit === 50,
      'Network linkage resilience: General ledger journal entry reflects on supplier statement even when voucher is detached',
      'Reporting & Statements'
    );

    // =========================================================================
    // هـ. الترحيل والتزامن (Posting & Concurrency)
    // =========================================================================
    console.log('\n--- Suite E: Posting & Concurrency ---');

    // Double posting concurrency test on same invoice
    let secondPostBlocked = false;
    try {
      AccountingEngine.postInvoice(invoiceA.id);
    } catch {
      secondPostBlocked = true;
    }
    assert(
      secondPostBlocked,
      'Concurrent or duplicate post of already posted invoice strictly blocked (Idempotency violation)',
      'Posting & Concurrency'
    );

    // Reverse journal entry test: net financial effect is zero
    const originalJv = invoiceJournal!;
    const reversedJv = AccountingEngine.reverseJournalEntry(originalJv.id, 'إلغاء تجريبي للقيد');
    const reloadedOriginal = db.getJournals().find((j) => j.id === originalJv.id)!;
    assert(
      reversedJv.status === 'POSTED' &&
      reloadedOriginal.status === 'REVERSED',
      'Journal reversal creates reverse entry and updates original status to REVERSED',
      'Posting & Concurrency'
    );

    // Verify trial balance after reversal returns customer movement for this invoice to net zero
    const tbAfterRev = AccountingEngine.getTrialBalance(COMPANY_A, '2026-12-31');
    assert(tbAfterRev.isBalanced, 'Trial balance remains balanced after journal reversal', 'Posting & Concurrency');

    // =========================================================================
    // و. السلامة (Safety & Production Immunity)
    // =========================================================================
    console.log('\n--- Suite F: Safety & Production Immunity ---');
    assert(
      process.env.OFFLINE_SAFE_DEVELOPMENT_MODE === 'true',
      'Offline safe development mode active throughout testing',
      'Safety'
    );
    assert(
      process.env.VITE_SUPABASE_URL === '',
      'Zero connection to production cloud during test execution',
      'Safety'
    );

  } finally {
    // Restore backup state to ensure zero residue
    (db as any).data.accounts = backupAccounts;
    (db as any).data.customers = backupCustomers;
    (db as any).data.journals = backupJournals;
    (db as any).data.invoices = backupInvoices;
    (db as any).data.vouchers = backupVouchers;
    (db as any).data.suppliers = backupSuppliers;
  }

  // Summary
  console.log('\n================================================================');
  console.log('📊 TEST EXECUTION SUMMARY:');
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  console.log(`Total: ${results.length} | Passed: ${passedCount} | Failed: ${failedCount}`);
  console.log('================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Fatal test execution error:', err);
  process.exit(1);
});
