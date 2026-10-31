import { db } from './db.js';
import {
  Account,
  JournalEntry,
  GeneralLedgerReport,
  GeneralLedgerMovement,
  TrialBalanceReport,
  TrialBalanceItem,
  IncomeStatementReport,
  IncomeStatementItem,
  BalanceSheetReport,
  BalanceSheetSection,
  CashFlowReport,
  Invoice,
  PaymentVoucher,
  FinancialKPIs,
  ProductionOrder,
  Customer,
  Supplier
} from '../types.js';

export const ALWALEED_CANONICAL_UUID = '20000000-0000-0000-0000-000000000001';

export function normalizeCompanyId(companyId: string | null | undefined): string {
  if (!companyId) return '';
  const clean = companyId.trim();
  if (
    clean === ALWALEED_CANONICAL_UUID ||
    clean === 'company-alwaleed-client-003' ||
    clean.toLowerCase().includes('alwaleed') ||
    clean === '450912'
  ) {
    return ALWALEED_CANONICAL_UUID;
  }
  return clean;
}

export function matchesCompany(recordCompanyId: string | undefined | null, targetCompanyId: string | undefined | null): boolean {
  if (!targetCompanyId || !targetCompanyId.trim()) return false;
  const normTarget = normalizeCompanyId(targetCompanyId);
  const normRecord = normalizeCompanyId(recordCompanyId);
  if (normTarget === ALWALEED_CANONICAL_UUID) {
    return normRecord === ALWALEED_CANONICAL_UUID || !recordCompanyId;
  }
  return normRecord === normTarget;
}

// Global posting lock to strictly prevent concurrent duplicate posting of the same document
const activePostingLocks = new Set<string>();

export class AccountingEngine {
  /**
   * Validate double entry rule: Total Debit MUST equal Total Credit
   */
  public static validateJournalEntry(entry: Partial<JournalEntry>): { isValid: boolean; error?: string } {
    if (!entry.lines || entry.lines.length < 2) {
      return { isValid: false, error: 'يجب أن يحتوي القيد المحاسبي على أسطر متعددة (طرف مدين وطرف دائن على الأقل).' };
    }

    let totalDebit = 0;
    let totalCredit = 0;

    for (const line of entry.lines) {
      if (!line.accountId) {
        return { isValid: false, error: 'يوجد سطر في القيد غير مرتبطة بحساب محاسبي.' };
      }
      if (line.debit < 0 || line.credit < 0) {
        return { isValid: false, error: 'لا يمكن أن تكون قيمة المدين أو الدائن بالسالب.' };
      }
      if (line.debit > 0 && line.credit > 0) {
        return { isValid: false, error: 'السطر الواحد يجب أن يكون إما مدين وإما دائن.' };
      }
      if (line.debit === 0 && line.credit === 0) {
        return { isValid: false, error: 'يجب إدخال قيمة للمدين أو الدائن في جميع الأسطر.' };
      }

      totalDebit += Number(line.debit) || 0;
      totalCredit += Number(line.credit) || 0;
    }

    const diff = Math.abs(totalDebit - totalCredit);
    if (totalDebit <= 0) {
      return {
        isValid: false,
        error: 'لا يمكن حفظ قيد بأرصدة صفرية! يجب إدخال مبالغ أكبر من الصفر.',
      };
    }
    // Precision: Kuwaiti Dinar (KWD) has 3 decimal places (1 KWD = 1000 fils).
    // Allow max 0.0005 KWD tolerance strictly for floating-point IEEE-754 representation noise.
    if (diff > 0.0005) {
      return {
        isValid: false,
        error: `القيد غير متوازن! إجمالي المدين (${totalDebit.toFixed(3)}) لا يساوي إجمالي الدائن (${totalCredit.toFixed(3)}). الفرق: ${diff.toFixed(3)}`,
      };
    }

    return { isValid: true };
  }

  /**
   * Calculate dynamic balances for Chart of Accounts with O(N) single-pass aggregation
   * Filtered strictly by companyId to prevent cross-tenant data leakage
   */
  public static getAccountsWithBalances(companyId: string, asOfDate?: string): Account[] {
    if (!companyId || !companyId.trim()) {
      throw new Error('معرّف الشركة (companyId) إلزامي ومطلوب لعزل واستخراج الحسابات والأرصدة');
    }
    const accounts = db.getAccounts().filter((a) => matchesCompany(a.companyId, companyId));
    const journals = db.getJournals().filter((j) => (j.status === 'POSTED' || j.status === 'REVERSED') && matchesCompany(j.companyId, companyId));

    // Create balance map and account lookup map for O(1) lookups
    const balanceMap = new Map<string, number>();
    const accountLookup = new Map<string, Account>();
    
    accounts.forEach((acc) => {
      balanceMap.set(acc.id, 0);
      accountLookup.set(acc.id, acc);
    });

    for (const j of journals) {
      if (asOfDate && j.date > asOfDate) continue;
      for (const line of j.lines) {
        const acc = accountLookup.get(line.accountId);
        if (!acc) continue;

        const currentBal = balanceMap.get(acc.id) || 0;
        const debit = Number(line.debit) || 0;
        const credit = Number(line.credit) || 0;

        if (acc.normalBalance === 'DEBIT') {
          balanceMap.set(acc.id, currentBal + (debit - credit));
        } else {
          balanceMap.set(acc.id, currentBal + (credit - debit));
        }
      }
    }

    // Rollup parent account balances within this company's accounts
    const accountsCopy: Account[] = JSON.parse(JSON.stringify(accounts));
    
    // Sort by level descending (deepest level first to rollup into parents)
    accountsCopy.sort((a, b) => b.level - a.level);

    accountsCopy.forEach((acc) => {
      acc.balance = balanceMap.get(acc.id) || 0;
      if (acc.parentId) {
        const parentBal = balanceMap.get(acc.parentId) || 0;
        balanceMap.set(acc.parentId, parentBal + (balanceMap.get(acc.id) || 0));
      }
    });

    // Return in code order
    return accountsCopy.sort((a, b) => a.code.localeCompare(b.code));
  }

  /**
   * Reverse a posted journal entry (عكس القيد) with company validation
   */
  public static reverseJournalEntry(journalId: string, reason: string, companyId?: string): JournalEntry {
    const original = db.getJournals().find(
      (j) =>
        j.id === journalId ||
        (j.id && journalId && j.id.toLowerCase() === journalId.toLowerCase()) ||
        (j.entryNumber && journalId && j.entryNumber.trim().toUpperCase() === journalId.trim().toUpperCase())
    );
    if (!original) {
      throw new Error('القيد غير موجود');
    }
    const compId = companyId || original.companyId;
    if (companyId && original.companyId && !matchesCompany(original.companyId, companyId)) {
      throw new Error('القيد غير تابع للشركة المصرح بها');
    }
    if (original.status !== 'POSTED') {
      throw new Error('يمكن عكس القيود المرحلة فقط');
    }

    const today = new Date().toISOString().split('T')[0];
    const reversalNumber = `REV-${original.entryNumber}`;

    const reversedLines = original.lines.map((line) => ({
      ...line,
      id: 'jl-' + Math.random().toString(36).substr(2, 9),
      debit: line.credit, // Swap debit and credit
      credit: line.debit,
      memo: `عكس قيد: ${line.memo}`,
      companyId: compId,
    }));

    const reversalEntry: JournalEntry = {
      id: 'jv-' + Math.random().toString(36).substr(2, 9),
      companyId: compId,
      entryNumber: reversalNumber,
      date: today,
      reference: `عكس القيد ${original.entryNumber}`,
      description: `قيد عكسي للقيد رقم (${original.entryNumber}) - السبب: ${reason}`,
      status: 'POSTED',
      lines: reversedLines,
      totalDebit: original.totalCredit,
      totalCredit: original.totalDebit,
      createdAt: new Date().toISOString(),
      postedAt: new Date().toISOString(),
      isAutoGenerated: true,
      sourceModule: original.sourceModule,
      sourceId: original.sourceId,
    };

    db.addJournal(reversalEntry);
    db.updateJournal(original.id, { status: 'REVERSED' });

    // Cancel any linked voucher in vouchers
    const origRef = (original.reference || '').trim().toUpperCase();
    const origEntryNum = (original.entryNumber || '').trim().toUpperCase();
    db.getVouchers().forEach((v) => {
      const vNum = (v.voucherNumber || '').trim().toUpperCase();
      const isLinked =
        v.journalEntryId === original.id ||
        v.id === original.sourceId ||
        (vNum && (origRef === vNum || origEntryNum === `JV-${vNum}`)) ||
        (origRef && (v.reference?.trim().toUpperCase() === origRef || vNum === origRef));

      if (isLinked && v.status !== 'CANCELLED') {
        db.updateVoucher(v.id, {
          status: 'CANCELLED',
          notes: (v.notes ? v.notes + '\n' : '') + `[ملغى إثر عكس القيد المحاسبي بتاريخ ${today}: ${reason}]`,
        });
      }
    });

    // Recalculate any entities referenced in lines
    original.lines.forEach((line) => {
      if (line.entityType === 'CUSTOMER' && line.entityId) {
        this.recalculateCustomerBalance(line.entityId);
      }
      if (line.entityType === 'SUPPLIER' && line.entityId) {
        this.recalculateSupplierBalance(line.entityId);
      }
    });

    return reversalEntry;
  }

  /**
   * Generate General Ledger Report for a specific account with company isolation
   */
  public static getGeneralLedger(
    companyId: string,
    accountId: string,
    startDate?: string,
    endDate?: string
  ): GeneralLedgerReport {
    if (!companyId || !companyId.trim()) {
      throw new Error('معرّف الشركة (companyId) إلزامي ومطلوب لتقرير دفتر الأستاذ العام');
    }
    const accounts = db.getAccounts().filter((a) => matchesCompany(a.companyId, companyId));
    const targetAccount = accounts.find((a) => a.id === accountId || a.code === accountId);
    if (!targetAccount) {
      throw new Error('الحساب المحاسبي غير موجود في هذه الشركة');
    }

    const start = startDate || '2000-01-01';
    const end = endDate || '2099-12-31';

    const allPostedJournals = db
      .getJournals()
      .filter((j) => (j.status === 'POSTED' || j.status === 'REVERSED') && matchesCompany(j.companyId, companyId))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Get all descendant account IDs if this is a parent/category account
    const getChildAccountIds = (parentId: string): string[] => {
      const children = accounts.filter((a) => a.parentId === parentId);
      let ids = children.map((c) => c.id);
      children.forEach((c) => {
        ids = ids.concat(getChildAccountIds(c.id));
      });
      return ids;
    };

    const targetAccountIdsSet = new Set<string>([targetAccount.id, ...getChildAccountIds(targetAccount.id)]);

    let openingBalance = 0;
    let totalDebit = 0;
    let totalCredit = 0;
    const movements: GeneralLedgerMovement[] = [];
    let currentRunning = 0;

    // Single-pass processing of journals in date order
    for (const j of allPostedJournals) {
      if (j.date < start) {
        // Accumulate opening balance prior to start date
        for (const line of j.lines) {
          if (targetAccountIdsSet.has(line.accountId)) {
            const d = Number(line.debit) || 0;
            const c = Number(line.credit) || 0;
            if (targetAccount.normalBalance === 'DEBIT') {
              openingBalance += d - c;
            } else {
              openingBalance += c - d;
            }
          }
        }
      } else if (j.date <= end) {
        // Accumulate period movements
        if (movements.length === 0) {
          currentRunning = openingBalance;
        }
        for (const line of j.lines) {
          if (targetAccountIdsSet.has(line.accountId)) {
            const d = Number(line.debit) || 0;
            const c = Number(line.credit) || 0;
            totalDebit += d;
            totalCredit += c;

            if (targetAccount.normalBalance === 'DEBIT') {
              currentRunning += d - c;
            } else {
              currentRunning += c - d;
            }

            movements.push({
              id: line.id,
              journalEntryId: j.id,
              entryNumber: j.entryNumber,
              date: j.date,
              reference: j.reference || '',
              description: line.memo || j.description,
              debit: d,
              credit: c,
              runningBalance: currentRunning,
            });
          }
        }
      }
    }

    if (movements.length === 0) {
      currentRunning = openingBalance;
    }

    return {
      account: targetAccount,
      startDate: start,
      endDate: end,
      openingBalance,
      totalDebit,
      totalCredit,
      closingBalance: currentRunning,
      movements,
    };
  }

  /**
   * Generate Trial Balance Report (ميزان المراجعة) strictly isolated per company
   */
  public static getTrialBalance(companyId: string, asOfDate?: string): TrialBalanceReport {
    if (!companyId || !companyId.trim()) {
      throw new Error('معرّف الشركة (companyId) إلزامي ومطلوب لتقرير ميزان المراجعة');
    }
    const accounts = db.getAccounts().filter((a) => matchesCompany(a.companyId, companyId));
    const postedJournals = db.getJournals().filter((j) => (j.status === 'POSTED' || j.status === 'REVERSED') && matchesCompany(j.companyId, companyId));
    const cutoff = asOfDate || '2099-12-31';

    // Pre-aggregate debit and credit per account in O(J * L)
    const movementMap = new Map<string, { debit: number; credit: number }>();
    accounts.forEach((acc) => movementMap.set(acc.id, { debit: 0, credit: 0 }));

    // Identify leaf accounts within this company
    const leafSet = new Set<string>();
    accounts.forEach((acc) => {
      const hasChildren = accounts.some((child) => child.parentId === acc.id);
      if (!hasChildren) {
        leafSet.add(acc.id);
      }
    });

    for (const j of postedJournals) {
      if (j.date <= cutoff) {
        for (const line of j.lines) {
          const accId = line.accountId;
          const d = Number(line.debit) || 0;
          const c = Number(line.credit) || 0;

          if (leafSet.has(accId)) {
            const entry = movementMap.get(accId);
            if (entry) {
              entry.debit += d;
              entry.credit += c;
            }
          } else {
            // Line booked on parent account: map to primary leaf descendant
            const accObj = accounts.find((a) => a.id === accId);
            const leavesUnderParent = accounts.filter(
              (other) =>
                leafSet.has(other.id) &&
                (other.parentId === accId ||
                  (other.code && accObj?.code && other.code.startsWith(accObj.code) && other.code !== accObj.code))
            );
            if (leavesUnderParent.length > 0) {
              leavesUnderParent.sort((x, y) => x.code.localeCompare(y.code));
              const targetLeaf = leavesUnderParent[0];
              const entry = movementMap.get(targetLeaf.id);
              if (entry) {
                entry.debit += d;
                entry.credit += c;
              }
            } else {
              const entry = movementMap.get(accId);
              if (entry) {
                entry.debit += d;
                entry.credit += c;
              }
            }
          }
        }
      }
    }

    const items: TrialBalanceItem[] = [];
    let totalMovementDebit = 0;
    let totalMovementCredit = 0;
    let totalEndingDebit = 0;
    let totalEndingCredit = 0;

    // Process detail accounts
    const detailAccounts = accounts.filter((acc) => leafSet.has(acc.id));

    detailAccounts.forEach((acc) => {
      const { debit: mDebit, credit: mCredit } = movementMap.get(acc.id) || { debit: 0, credit: 0 };

      // Calculate Net Balance for Trial Balance
      let endingDebit = 0;
      let endingCredit = 0;

      if (acc.normalBalance === 'DEBIT') {
        const net = mDebit - mCredit;
        if (net >= 0) endingDebit = net;
        else endingCredit = Math.abs(net);
      } else {
        const net = mCredit - mDebit;
        if (net >= 0) endingCredit = net;
        else endingDebit = Math.abs(net);
      }

      totalMovementDebit += mDebit;
      totalMovementCredit += mCredit;
      totalEndingDebit += endingDebit;
      totalEndingCredit += endingCredit;

      items.push({
        account: acc,
        openingBalanceDebit: 0,
        openingBalanceCredit: 0,
        movementDebit: mDebit,
        movementCredit: mCredit,
        endingBalanceDebit: endingDebit,
        endingBalanceCredit: endingCredit,
      });
    });

    const isBalanced =
      Math.abs(totalMovementDebit - totalMovementCredit) < 0.01 &&
      Math.abs(totalEndingDebit - totalEndingCredit) < 0.01;

    return {
      asOfDate: cutoff,
      items: items.sort((a, b) => a.account.code.localeCompare(b.account.code)),
      totalOpeningDebit: 0,
      totalOpeningCredit: 0,
      totalMovementDebit,
      totalMovementCredit,
      totalEndingDebit,
      totalEndingCredit,
      isBalanced,
    };
  }

  /**
   * Generate Income Statement Report (قائمة الدخل - P&L) isolated per company
   */
  public static getIncomeStatement(companyId: string, startDate?: string, endDate?: string): IncomeStatementReport {
    if (!companyId || !companyId.trim()) {
      throw new Error('معرّف الشركة (companyId) إلزامي ومطلوب لتقرير قائمة الدخل');
    }
    const start = startDate || '2026-01-01';
    const end = endDate || '2099-12-31';

    const accounts = db.getAccounts().filter((a) => matchesCompany(a.companyId, companyId));
    const postedJournals = db.getJournals().filter((j) => j.status === 'POSTED' && matchesCompany(j.companyId, companyId));

    // Pre-aggregate movements in the date range
    const rangeMovementMap = new Map<string, { debit: number; credit: number }>();
    accounts.forEach((acc) => rangeMovementMap.set(acc.id, { debit: 0, credit: 0 }));

    for (const j of postedJournals) {
      if (j.date >= start && j.date <= end) {
        for (const line of j.lines) {
          const entry = rangeMovementMap.get(line.accountId);
          if (entry) {
            entry.debit += Number(line.debit) || 0;
            entry.credit += Number(line.credit) || 0;
          }
        }
      }
    }

    const revenues: IncomeStatementItem[] = [];
    const cogs: IncomeStatementItem[] = [];
    const expenses: IncomeStatementItem[] = [];

    let totalRevenue = 0;
    let totalCogs = 0;
    let totalExpenses = 0;

    accounts.forEach((acc) => {
      if (acc.category !== 'REVENUE' && acc.category !== 'EXPENSE') return;

      const { debit: sumDebit, credit: sumCredit } = rangeMovementMap.get(acc.id) || { debit: 0, credit: 0 };

      if (acc.category === 'REVENUE') {
        const netAmount = sumCredit - sumDebit;
        if (netAmount !== 0) {
          revenues.push({
            accountCode: acc.code,
            accountNameAr: acc.nameAr,
            amount: netAmount,
          });
          totalRevenue += netAmount;
        }
      } else if (acc.category === 'EXPENSE') {
        const netAmount = sumDebit - sumCredit;
        if (netAmount !== 0) {
          if (acc.code === '5100') {
            cogs.push({
              accountCode: acc.code,
              accountNameAr: acc.nameAr,
              amount: netAmount,
            });
            totalCogs += netAmount;
          } else {
            expenses.push({
              accountCode: acc.code,
              accountNameAr: acc.nameAr,
              amount: netAmount,
            });
            totalExpenses += netAmount;
          }
        }
      }
    });

    const grossProfit = totalRevenue - totalCogs;
    const netIncome = grossProfit - totalExpenses;

    return {
      startDate: start,
      endDate: end,
      revenues,
      totalRevenue,
      cogs,
      totalCogs,
      grossProfit,
      expenses,
      totalExpenses,
      netIncome,
    };
  }

  /**
   * Generate Balance Sheet Report (قائمة المركز المالي) isolated per company
   */
  public static getBalanceSheet(companyId: string, asOfDate?: string): BalanceSheetReport {
    if (!companyId || !companyId.trim()) {
      throw new Error('معرّف الشركة (companyId) إلزامي ومطلوب لتقرير المركز المالي');
    }
    const cutoff = asOfDate || '2099-12-31';

    // Calculate income statement for net profit to include in equity
    const incomeStatement = this.getIncomeStatement(companyId, '2000-01-01', cutoff);
    const periodNetIncome = incomeStatement.netIncome;

    const accountsWithBalances = this.getAccountsWithBalances(companyId, cutoff);

    const currentAssetsItems: { accountCode: string; accountNameAr: string; amount: number }[] = [];
    const nonCurrentAssetsItems: { accountCode: string; accountNameAr: string; amount: number }[] = [];
    const currentLiabilitiesItems: { accountCode: string; accountNameAr: string; amount: number }[] = [];
    const nonCurrentLiabilitiesItems: { accountCode: string; accountNameAr: string; amount: number }[] = [];
    const equityItems: { accountCode: string; accountNameAr: string; amount: number }[] = [];

    let totalCurrentAssets = 0;
    let totalNonCurrentAssets = 0;
    let totalCurrentLiabilities = 0;
    let totalNonCurrentLiabilities = 0;
    let totalEquityBase = 0;

    // Filter detail level accounts (level >= 3 or leaf)
    accountsWithBalances.forEach((acc) => {
      if (acc.level < 3) return; // Ignore top summary categories

      const val = acc.balance || 0;
      if (val === 0) return;

      if (acc.category === 'ASSET') {
        if (acc.code.startsWith('11')) {
          currentAssetsItems.push({ accountCode: acc.code, accountNameAr: acc.nameAr, amount: val });
          totalCurrentAssets += val;
        } else {
          nonCurrentAssetsItems.push({ accountCode: acc.code, accountNameAr: acc.nameAr, amount: val });
          totalNonCurrentAssets += val;
        }
      } else if (acc.category === 'LIABILITY') {
        if (acc.code.startsWith('21')) {
          currentLiabilitiesItems.push({ accountCode: acc.code, accountNameAr: acc.nameAr, amount: val });
          totalCurrentLiabilities += val;
        } else {
          nonCurrentLiabilitiesItems.push({ accountCode: acc.code, accountNameAr: acc.nameAr, amount: val });
          totalNonCurrentLiabilities += val;
        }
      } else if (acc.category === 'EQUITY') {
        equityItems.push({ accountCode: acc.code, accountNameAr: acc.nameAr, amount: val });
        totalEquityBase += val;
      }
    });

    const totalAssets = totalCurrentAssets + totalNonCurrentAssets;
    const totalLiabilities = totalCurrentLiabilities + totalNonCurrentLiabilities;
    const totalEquity = totalEquityBase + periodNetIncome;
    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

    const isBalanced = Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01;

    return {
      asOfDate: cutoff,
      currentAssets: {
        categoryNameAr: 'الأصول المتداولة',
        items: currentAssetsItems,
        totalAmount: totalCurrentAssets,
      },
      nonCurrentAssets: {
        categoryNameAr: 'الأصول غير المتداولة (الثابتة)',
        items: nonCurrentAssetsItems,
        totalAmount: totalNonCurrentAssets,
      },
      totalAssets,
      currentLiabilities: {
        categoryNameAr: 'الخصوم المتداولة',
        items: currentLiabilitiesItems,
        totalAmount: totalCurrentLiabilities,
      },
      nonCurrentLiabilities: {
        categoryNameAr: 'الخصوم غير المتداولة',
        items: nonCurrentLiabilitiesItems,
        totalAmount: totalNonCurrentLiabilities,
      },
      totalLiabilities,
      equity: {
        categoryNameAr: 'حقوق الملكية',
        items: [
          ...equityItems,
          { accountCode: 'NET-INC', accountNameAr: 'صافي أرباح/خسائر الفترة الحالية', amount: periodNetIncome },
        ],
        totalAmount: totalEquity,
      },
      periodNetIncome,
      totalEquity,
      totalLiabilitiesAndEquity,
      isBalanced,
    };
  }

  /**
   * Cash Flow Statement (IAS 7) isolated per company
   */
  public static getCashFlowStatement(companyId: string, startDate?: string, endDate?: string): CashFlowReport {
    if (!companyId || !companyId.trim()) {
      throw new Error('معرّف الشركة (companyId) إلزامي ومطلوب لتقرير التدفقات النقدية');
    }
    const start = startDate || '2026-01-01';
    const end = endDate || '2099-12-31';

    const income = this.getIncomeStatement(companyId, start, end);
    const balanceSheet = this.getBalanceSheet(companyId, end);

    const netIncome = income.netIncome;

    // Calculate changes in cash and operating accounts
    const companyAccs = this.getAccountsWithBalances(companyId, end);
    const cashAccount = companyAccs.find((a) => a.code === '1111');
    const cashBoxAccount = companyAccs.find((a) => a.code === '1112');

    const closingCash = (cashAccount?.balance || 0) + (cashBoxAccount?.balance || 0);

    const totalOperating = netIncome;
    const totalInvesting = 0;
    const totalFinancing = 0;

    return {
      startDate: start,
      endDate: end,
      operatingCashFlow: {
        netIncome,
        adjustments: [{ label: 'إهلاك الأصول غير النقدي', amount: 0 }],
        totalOperating,
      },
      investingCashFlow: {
        items: [{ label: 'شراء أصول ومعدات جديدة', amount: 0 }],
        totalInvesting,
      },
      financingCashFlow: {
        items: [{ label: 'مسحوبات / زيادة رأس المال', amount: 0 }],
        totalFinancing,
      },
      netCashChange: totalOperating + totalInvesting + totalFinancing,
      openingCash: closingCash - netIncome,
      closingCash,
    };
  }


  /**
   * Post Sales Invoice -> Creates Journal Entry with ACID Transaction Boundary
   * Ensures:
   * 1. Debit = Credit equality down to 0.001 tolerance (Accounting Invariant)
   * 2. Inventory deduction & Cost of Goods Sold (COGS) posting
   * 3. Customer accounts receivable balance synchronization
   * 4. Automatic atomic rollback on any validation failure
   */
  public static postSalesInvoice(invoiceId: string, companyId?: string): Invoice {
    if (activePostingLocks.has(invoiceId)) {
      throw new Error('عملية الترحيل قيد المعالجة بالفعل لهذا المستند (Concurrent Posting Lock)');
    }
    activePostingLocks.add(invoiceId);

    try {
      return db.executeTransaction(() => {
        const invoice = db.getInvoices().find((inv) => inv.id === invoiceId);
        if (!invoice) throw new Error('الفاتورة غير موجودة');
        const compId = companyId || invoice.companyId;
        if (companyId && invoice.companyId && !matchesCompany(invoice.companyId, companyId)) {
          throw new Error('الفاتورة غير تابعة للشركة المصرح بها');
        }
        if (invoice.status === 'POSTED' || invoice.status === 'PAID') {
          throw new Error('الفاتورة مرحّلة بالفعل مسبقاً (Idempotency Violation)');
        }

        const today = new Date().toISOString().split('T')[0];
        const isReturn = invoice.type === 'SALES_RETURN';
        const journalEntryNumber = isReturn ? `JV-RET-${invoice.invoiceNumber}` : `JV-INV-${invoice.invoiceNumber}`;

        // Calculate Cost of Goods Sold (COGS) based on stock item purchase prices
        const inventoryItems = db.getInventory().filter((i) => matchesCompany(i.companyId, compId));
        let totalCogs = 0;

        const company = db.getCompany();
        const allowNegativeStock = !!(
          (invoice as any).allowNegativeStock ||
          (invoice as any).allowNegative ||
          (company && company.allowNegativeInventory !== false)
        );

        // Validate stock availability if negative stock is NOT allowed
        if (!isReturn && !allowNegativeStock) {
          for (const line of invoice.lines) {
            const invItem = inventoryItems.find((i) => i.id === line.itemId);
            if (invItem && invItem.quantityOnHand < line.quantity) {
              throw new Error(
                `الكمية المتوفرة في المخزون (${invItem.quantityOnHand}) غير كافية لبيع (${line.quantity}) للصنف (${invItem.nameAr}). يمكنك تفعيل خيار (السماح بالقيم السالبة للمخزون) من إعدادات الشركة للمتابعة.`
              );
            }
          }
        }

        invoice.lines.forEach((line) => {
          const invItem = inventoryItems.find((i) => i.id === line.itemId);
          if (invItem) {
            const itemCost = Number((invItem as any).costPrice ?? invItem.purchasePrice ?? 0);
            totalCogs += line.quantity * itemCost;
            if (isReturn) {
              db.updateInventoryItem(invItem.id, {
                quantityOnHand: invItem.quantityOnHand + line.quantity,
              });
            } else {
              const newQty = allowNegativeStock
                ? invItem.quantityOnHand - line.quantity
                : Math.max(0, invItem.quantityOnHand - line.quantity);
              db.updateInventoryItem(invItem.id, {
                quantityOnHand: newQty,
              });
            }
          }
        });

        const netRevenue = Math.max(0, invoice.grandTotal - invoice.vatTotal);
        const compAccounts = db.getAccounts().filter((a) => matchesCompany(a.companyId, compId));

        // Resolve customer receivable account: prefer customer.account_id if valid; otherwise approved receivable account
        let recAccId = 'acc-1120';
        let recAccCode = '1120';
        let recAccNameAr = 'الذمم المدينة (حسابات العملاء)';

        if (invoice.entityId) {
          const customer = db.getCustomers().find((c) => c.id === invoice.entityId && matchesCompany(c.companyId, compId));
          if (customer) {
            const custAccId = customer.account_id || (customer as any).accountId;
            if (custAccId) {
              const matchedAcc = compAccounts.find((a) => (a.id === custAccId || a.code === custAccId) && matchesCompany(a.companyId, compId));
              if (matchedAcc) {
                recAccId = matchedAcc.id;
                recAccCode = matchedAcc.code;
                recAccNameAr = matchedAcc.nameAr;
              }
            }
          }
        }

        if (recAccId === 'acc-1120') {
          const approvedAcc = compAccounts.find(
            (a) => a.id === company?.defaultAccounts?.receivableAccountId || a.code === '1120' || (a.category === 'ASSET' && a.nameAr.includes('الذمم المدينة'))
          );
          if (approvedAcc) {
            recAccId = approvedAcc.id;
            recAccCode = approvedAcc.code;
            recAccNameAr = approvedAcc.nameAr;
          }
        }

        let lines = [];

        if (isReturn) {
          lines = [
            {
              id: 'jl-' + Math.random().toString(36).substr(2, 9),
              accountId: compAccounts.find((a) => a.code === '4101' || a.code === '4100')?.id || 'acc-4101',
              accountCode: '4101',
              accountNameAr: 'إيرادات المبيعات والخدمات (مردودات)',
              debit: netRevenue,
              credit: 0,
              memo: `مردودات مبيعات - إشعار رقم ${invoice.invoiceNumber}`,
              companyId: compId,
            },
            {
              id: 'jl-' + Math.random().toString(36).substr(2, 9),
              accountId: recAccId,
              accountCode: recAccCode,
              accountNameAr: recAccNameAr,
              debit: 0,
              credit: invoice.grandTotal,
              memo: `إشعار دائن مردودات مبيعات رقم ${invoice.invoiceNumber} - العميل: ${invoice.entityNameAr}`,
              entityType: 'CUSTOMER' as const,
              entityId: invoice.entityId,
              companyId: compId,
            },
          ];

          if (invoice.vatTotal > 0) {
            lines.push({
              id: 'jl-' + Math.random().toString(36).substr(2, 9),
              accountId: compAccounts.find((a) => a.code === '2120')?.id || 'acc-2120',
              accountCode: '2120',
              accountNameAr: 'ضريبة القيمة المضافة - مخرجات (عكس)',
              debit: invoice.vatTotal,
              credit: 0,
              memo: `عكس ضريبة القيمة المضافة لمردودات مبيعات ${invoice.invoiceNumber}`,
              companyId: compId,
            });
          }

          if (totalCogs > 0) {
            lines.push(
              {
                id: 'jl-' + Math.random().toString(36).substr(2, 9),
                accountId: compAccounts.find((a) => a.code === '1130')?.id || 'acc-1130',
                accountCode: '1130',
                accountNameAr: 'مخزون البضائع والمنتجات',
                debit: totalCogs,
                credit: 0,
                memo: `إرجاع بضاعة للمخزن - إشعار ${invoice.invoiceNumber}`,
                companyId: compId,
              },
              {
                id: 'jl-' + Math.random().toString(36).substr(2, 9),
                accountId: compAccounts.find((a) => a.code === '5101' || a.code === '5100')?.id || 'acc-5101',
                accountCode: '5101',
                accountNameAr: 'تكلفة البضاعة المباعة والمشتريات',
                debit: 0,
                credit: totalCogs,
                memo: `تخفيض تكلفة المبيعات للمردودات - إشعار ${invoice.invoiceNumber}`,
                companyId: compId,
              }
            );
          }
        } else {
          lines = [
            {
              id: 'jl-' + Math.random().toString(36).substr(2, 9),
              accountId: recAccId,
              accountCode: recAccCode,
              accountNameAr: recAccNameAr,
              debit: invoice.grandTotal,
              credit: 0,
              memo: `فاتورة مبيعات رقم ${invoice.invoiceNumber} - العميل: ${invoice.entityNameAr}`,
              entityType: 'CUSTOMER' as const,
              entityId: invoice.entityId,
              entityNameAr: invoice.entityNameAr,
              companyId: compId,
            },
            {
              id: 'jl-' + Math.random().toString(36).substr(2, 9),
              accountId: compAccounts.find((a) => a.code === '4101' || a.code === '4100')?.id || 'acc-4101',
              accountCode: '4101',
              accountNameAr: 'إيرادات المبيعات والخدمات',
              debit: 0,
              credit: netRevenue,
              memo: `إيراد مبيعات - فاتورة رقم ${invoice.invoiceNumber}`,
              companyId: compId,
            },
          ];

          if (invoice.vatTotal > 0) {
            lines.push({
              id: 'jl-' + Math.random().toString(36).substr(2, 9),
              accountId: compAccounts.find((a) => a.code === '2120')?.id || 'acc-2120',
              accountCode: '2120',
              accountNameAr: 'ضريبة القيمة المضافة - مخرجات (مستحقة)',
              debit: 0,
              credit: invoice.vatTotal,
              memo: `ضريبة القيمة المضافة - فاتورة ${invoice.invoiceNumber}`,
              companyId: compId,
            });
          }

          if (totalCogs > 0) {
            lines.push(
              {
                id: 'jl-' + Math.random().toString(36).substr(2, 9),
                accountId: compAccounts.find((a) => a.code === '5101' || a.code === '5100')?.id || 'acc-5101',
                accountCode: '5101',
                accountNameAr: 'تكلفة البضاعة المباعة والمشتريات',
                debit: totalCogs,
                credit: 0,
                memo: `إثبات تكلفة البضاعة المباعة - فاتورة ${invoice.invoiceNumber}`,
                companyId: compId,
              },
              {
                id: 'jl-' + Math.random().toString(36).substr(2, 9),
                accountId: compAccounts.find((a) => a.code === '1130')?.id || 'acc-1130',
                accountCode: '1130',
                accountNameAr: 'مخزون البضائع والمنتجات',
                debit: 0,
                credit: totalCogs,
                memo: `خصم بضاعة من المخزون - فاتورة ${invoice.invoiceNumber}`,
                companyId: compId,
              }
            );
          }
        }

        const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
        const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);

        const validation = this.validateJournalEntry({ lines });
        if (!validation.isValid) {
          throw new Error(`فشل التحقق المحاسبي لقيد المبيعات: ${validation.error}`);
        }

        const journalEntry: JournalEntry = {
          id: 'jv-' + Math.random().toString(36).substr(2, 9),
          companyId: compId,
          entryNumber: journalEntryNumber,
          date: invoice.date || today,
          reference: invoice.invoiceNumber,
          description: isReturn
            ? `قيد آلي ناتج عن إشعار دائن مردودات مبيعات رقم (${invoice.invoiceNumber}) للعميل ${invoice.entityNameAr}`
            : `قيد آلي ناتج عن إصدار فاتورة مبيعات رقم (${invoice.invoiceNumber}) للعميل ${invoice.entityNameAr}`,
          status: 'POSTED',
          lines,
          totalDebit,
          totalCredit,
          createdAt: new Date().toISOString(),
          postedAt: new Date().toISOString(),
          isAutoGenerated: true,
          sourceModule: 'SALES_INVOICE',
          sourceId: invoice.id,
        };

        db.addJournal(journalEntry);

        // Update Customer Ledger Balance
        const customer = db.getCustomers().find((c) => c.id === invoice.entityId && matchesCompany(c.companyId, compId));
        if (customer) {
          const rawBalance = isReturn
            ? (Number(customer.balance) || 0) - (Number(invoice.grandTotal) || 0)
            : (Number(customer.balance) || 0) + (Number(invoice.grandTotal) || 0);
          const newBalance = Math.round(rawBalance * 1000) / 1000;
          db.updateCustomer(customer.id, { balance: newBalance });
        }

        // Update Invoice status & attach Journal ID
        db.updateInvoice(invoice.id, {
          status: 'POSTED',
          journalEntryId: journalEntry.id,
        });

        return db.getInvoices().find((inv) => inv.id === invoiceId)!;
      });
    } finally {
      activePostingLocks.delete(invoiceId);
    }
  }

  /**
   * Post Purchase Invoice automatically creating Journal Entry, increasing inventory and updating Supplier Balance
   * Wrapped in ACID transaction boundary.
   */
  public static postPurchaseInvoice(invoiceId: string, companyId?: string): Invoice {
    if (activePostingLocks.has(invoiceId)) {
      throw new Error('عملية الترحيل قيد المعالجة بالفعل لهذا المستند (Concurrent Posting Lock)');
    }
    activePostingLocks.add(invoiceId);

    try {
      return db.executeTransaction(() => {
        const invoice = db.getInvoices().find((inv) => inv.id === invoiceId);
        if (!invoice) throw new Error('الفاتورة غير موجودة');
        const compId = companyId || invoice.companyId;
        if (companyId && invoice.companyId && !matchesCompany(invoice.companyId, companyId)) {
          throw new Error('الفاتورة غير تابعة للشركة المصرح بها');
        }
        if (invoice.status === 'POSTED' || invoice.status === 'PAID') {
          throw new Error('الفاتورة مرحّلة بالفعل مسبقاً (Idempotency Violation)');
        }

        const today = new Date().toISOString().split('T')[0];
        const isReturn = invoice.type === 'PURCHASE_RETURN';
        const journalEntryNumber = isReturn ? `JV-RET-PUR-${invoice.invoiceNumber}` : `JV-PUR-${invoice.invoiceNumber}`;

        // Update inventory on-hand quantity
        const inventoryItems = db.getInventory().filter((i) => matchesCompany(i.companyId, compId));
        invoice.lines.forEach((line) => {
          const invItem = inventoryItems.find((i) => i.id === line.itemId);
          if (invItem) {
            if (isReturn) {
              const company = db.getCompany();
              const allowNeg = !!(
                (invoice as any).allowNegativeStock ||
                (invoice as any).allowNegative ||
                (company && company.allowNegativeInventory !== false)
              );
              db.updateInventoryItem(invItem.id, {
                quantityOnHand: allowNeg ? invItem.quantityOnHand - line.quantity : Math.max(0, invItem.quantityOnHand - line.quantity),
              });
            } else {
              const currentQty = Number(invItem.quantityOnHand) || 0;
              const currentCost = Number((invItem as any).costPrice ?? invItem.purchasePrice ?? 0);
              const incomingQty = Number(line.quantity) || 0;
              const purchasePrice = Number(line.unitPrice) || 0;
              const newAvgCost = currentQty <= 0
                ? purchasePrice
                : Math.round((((currentQty * currentCost) + (incomingQty * purchasePrice)) / (currentQty + incomingQty)) * 1000) / 1000;

              db.updateInventoryItem(invItem.id, {
                quantityOnHand: currentQty + incomingQty,
                purchasePrice: newAvgCost,
                costPrice: newAvgCost,
              });
            }
          }
        });

        const netPurchase = Math.max(0, (Number(invoice.grandTotal) || 0) - (Number(invoice.vatTotal) || 0));
        const compAccounts = db.getAccounts().filter((a) => matchesCompany(a.companyId, compId));

        let payAccId = 'acc-2110';
        let payAccCode = '2110';
        let payAccNameAr = 'الذمم الدائنة (حسابات الموردين)';

        if (invoice.entityId) {
          const supplier = db.getSuppliers().find((s) => s.id === invoice.entityId && matchesCompany(s.companyId, compId));
          if (supplier) {
            const suppAccId = supplier.account_id || (supplier as any).accountId;
            if (suppAccId) {
              const matchedAcc = compAccounts.find((a) => (a.id === suppAccId || a.code === suppAccId) && matchesCompany(a.companyId, compId));
              if (matchedAcc) {
                payAccId = matchedAcc.id;
                payAccCode = matchedAcc.code;
                payAccNameAr = matchedAcc.nameAr;
              }
            }
          }
        }

        if (payAccId === 'acc-2110') {
          const approvedAcc = compAccounts.find(
            (a) => a.code === '2110' || (a.category === 'LIABILITY' && (a.nameAr.includes('الذمم الدائنة') || a.nameAr.includes('الموردين')))
          );
          if (approvedAcc) {
            payAccId = approvedAcc.id;
            payAccCode = approvedAcc.code;
            payAccNameAr = approvedAcc.nameAr;
          }
        }

        let lines = [];
        if (isReturn) {
          // Purchase Return: Debit Supplier (AP) & Credit Inventory & Reverse Input VAT
          lines = [
            {
              id: 'jl-' + Math.random().toString(36).substr(2, 9),
              accountId: payAccId,
              accountCode: payAccCode,
              accountNameAr: payAccNameAr,
              debit: invoice.grandTotal,
              credit: 0,
              memo: `إشعار مدين مردودات مشتريات رقم ${invoice.invoiceNumber} - المورد: ${invoice.entityNameAr}`,
              entityType: 'SUPPLIER' as const,
              entityId: invoice.entityId,
              companyId: compId,
            },
            {
              id: 'jl-' + Math.random().toString(36).substr(2, 9),
              accountId: compAccounts.find((a) => a.code === '1130')?.id || 'acc-1130',
              accountCode: '1130',
              accountNameAr: 'مخزون البضائع والمنتجات',
              debit: 0,
              credit: netPurchase,
              memo: `إخراج بضاعة مردودة للمورد - إشعار ${invoice.invoiceNumber}`,
              companyId: compId,
            },
          ];

          if (invoice.vatTotal > 0) {
            lines.push({
              id: 'jl-' + Math.random().toString(36).substr(2, 9),
              accountId: compAccounts.find((a) => a.code === '1140')?.id || 'acc-1140',
              accountCode: '1140',
              accountNameAr: 'ضريبة القيمة المضافة - مدخلات (عكس)',
              debit: 0,
              credit: invoice.vatTotal,
              memo: `عكس ضريبة مدخلات لمردود مشتريات ${invoice.invoiceNumber}`,
              companyId: compId,
            });
          }
        } else {
          // Standard Purchase Invoice: Debit Inventory (IAS-2 Net Cost) & Debit Input VAT, Credit Accounts Payable
          lines = [
            // 1. Debit: Merchandise Inventory (صافي تكلفة المخزون المشتراة دون الضريبة المستردة)
            {
              id: 'jl-' + Math.random().toString(36).substr(2, 9),
              accountId: compAccounts.find((a) => a.code === '1130')?.id || 'acc-1130',
              accountCode: '1130',
              accountNameAr: 'مخزون البضائع والمنتجات',
              debit: netPurchase,
              credit: 0,
              memo: `إثبات مشتريات بضائع - فاتورة مورد رقم ${invoice.invoiceNumber}`,
              companyId: compId,
            },
            // 2. Credit: Accounts Payable (المورد دائن بقيمة الفاتورة المستحقة)
            {
              id: 'jl-' + Math.random().toString(36).substr(2, 9),
              accountId: payAccId,
              accountCode: payAccCode,
              accountNameAr: payAccNameAr,
              debit: 0,
              credit: invoice.grandTotal,
              memo: `فاتورة مشتريات رقم ${invoice.invoiceNumber} - المورد: ${invoice.entityNameAr}`,
              entityType: 'SUPPLIER' as const,
              entityId: invoice.entityId,
              companyId: compId,
            },
          ];

          if (invoice.vatTotal > 0) {
            lines.push({
              id: 'jl-' + Math.random().toString(36).substr(2, 9),
              accountId: compAccounts.find((a) => a.code === '1140')?.id || 'acc-1140',
              accountCode: '1140',
              accountNameAr: 'ضريبة القيمة المضافة - مدخلات (مستردة)',
              debit: invoice.vatTotal,
              credit: 0,
              memo: `ضريبة مدخلات فاتورة مشتريات ${invoice.invoiceNumber}`,
              companyId: compId,
            });
          }
        }

        // Double-Entry Invariant Validation (Debit === Credit)
        const validation = this.validateJournalEntry({ lines });
        if (!validation.isValid) {
          throw new Error(`فشل التحقق المحاسبي لقيد المشتريات: ${validation.error}`);
        }

        const journalEntry: JournalEntry = {
          id: 'jv-' + Math.random().toString(36).substr(2, 9),
          companyId: compId,
          entryNumber: journalEntryNumber,
          date: invoice.date || today,
          reference: invoice.invoiceNumber,
          description: isReturn
            ? `قيد آلي ناتج عن إشعار مدين مردودات مشتريات رقم (${invoice.invoiceNumber}) للمورد ${invoice.entityNameAr}`
            : `قيد آلي ناتج عن إصدار فاتورة مشتريات رقم (${invoice.invoiceNumber}) للمورد ${invoice.entityNameAr}`,
          status: 'POSTED',
          lines,
          totalDebit: invoice.grandTotal,
          totalCredit: invoice.grandTotal,
          createdAt: new Date().toISOString(),
          postedAt: new Date().toISOString(),
          isAutoGenerated: true,
          sourceModule: 'PURCHASE_INVOICE',
          sourceId: invoice.id,
        };

        db.addJournal(journalEntry);

        // Update Supplier Balance without arbitrary zero-clamping
        const supplier = db.getSuppliers().find((s) => s.id === invoice.entityId && matchesCompany(s.companyId, compId));
        if (supplier) {
          const rawBalance = isReturn
            ? (Number(supplier.balance) || 0) - (Number(invoice.grandTotal) || 0)
            : (Number(supplier.balance) || 0) + (Number(invoice.grandTotal) || 0);
          const newBalance = Math.round(rawBalance * 1000) / 1000;
          db.updateSupplier(supplier.id, { balance: newBalance });
        }

        // Update Invoice status & attach Journal ID
        db.updateInvoice(invoice.id, {
          status: 'POSTED',
          journalEntryId: journalEntry.id,
        });

        return db.getInvoices().find((inv) => inv.id === invoiceId)!;
      });
    } finally {
      activePostingLocks.delete(invoiceId);
    }
  }

  /**
   * Universal Post Invoice
   */
  public static postInvoice(invoiceId: string): Invoice {
    const inv = db.getInvoices().find((i) => i.id === invoiceId);
    if (!inv) throw new Error('الفاتورة غير موجودة');
    if (inv.type === 'SALES' || inv.type === 'SALES_RETURN') {
      return this.postSalesInvoice(invoiceId);
    } else {
      return this.postPurchaseInvoice(invoiceId);
    }
  }

  /**
   * Cancel and void invoice with automatic journal reversal and inventory restoration
   * Wrapped in ACID transaction boundary.
   */
  public static cancelInvoice(invoiceId: string, reason: string = 'إلغاء الفاتورة وعكس الحركة'): Invoice {
    return db.executeTransaction(() => {
      const invoice = db.getInvoices().find(
        (inv) =>
          inv.id === invoiceId ||
          (inv.id && invoiceId && inv.id.toLowerCase() === invoiceId.toLowerCase()) ||
          (inv.invoiceNumber && invoiceId && inv.invoiceNumber.trim().toUpperCase() === invoiceId.trim().toUpperCase())
      );
      if (!invoice) throw new Error('الفاتورة غير موجودة');
      if (invoice.status === 'CANCELLED') {
        return invoice;
      }

      // If posted, reverse the journal entry & stock movements & entity balance
      if (invoice.status === 'POSTED' || invoice.status === 'PAID') {
        // 1. Reverse Journal Entry if exists
        const relatedJournal = db.getJournals().find(
          (j) => j.sourceId === invoice.id || j.id === invoice.journalEntryId
        );
        if (relatedJournal && relatedJournal.status === 'POSTED') {
          try {
            this.reverseJournalEntry(relatedJournal.id, `إلغاء الفاتورة ${invoice.invoiceNumber}: ${reason}`);
          } catch (e) {
            console.error('Journal reversal note:', e);
          }
        }

        // 2. Reverse stock movements
        const inventoryItems = db.getInventory();
        invoice.lines.forEach((line) => {
          const invItem = inventoryItems.find((i) => i.id === line.itemId);
          if (invItem) {
            if (invoice.type === 'SALES') {
              db.updateInventoryItem(invItem.id, {
                quantityOnHand: invItem.quantityOnHand + line.quantity,
              });
            } else if (invoice.type === 'PURCHASE') {
              db.updateInventoryItem(invItem.id, {
                quantityOnHand: Math.max(0, invItem.quantityOnHand - line.quantity),
              });
            } else if (invoice.type === 'SALES_RETURN') {
              db.updateInventoryItem(invItem.id, {
                quantityOnHand: Math.max(0, invItem.quantityOnHand - line.quantity),
              });
            } else if (invoice.type === 'PURCHASE_RETURN') {
              db.updateInventoryItem(invItem.id, {
                quantityOnHand: invItem.quantityOnHand + line.quantity,
              });
            }
          }
        });

        // 3. Recalculate customer/supplier balance atomically
        if (invoice.type === 'SALES' || invoice.type === 'SALES_RETURN') {
          this.recalculateCustomerBalance(invoice.entityId);
        } else if (invoice.type === 'PURCHASE' || invoice.type === 'PURCHASE_RETURN') {
          this.recalculateSupplierBalance(invoice.entityId);
        }
      }

      // 4. Update status to CANCELLED
      db.updateInvoice(invoice.id, {
        status: 'CANCELLED',
        notes: (invoice.notes ? invoice.notes + '\n' : '') + `[ملغاة بتاريخ ${new Date().toISOString().split('T')[0]}: ${reason}]`,
      });

      // 5. Final balance recalculation
      if (invoice.type === 'SALES' || invoice.type === 'SALES_RETURN') {
        this.recalculateCustomerBalance(invoice.entityId);
      } else {
        this.recalculateSupplierBalance(invoice.entityId);
      }

      return db.getInvoices().find((i) => i.id === invoice.id)!;
    });
  }

  /**
   * Complete IFRS-compliant Invoice Voiding & Reversal Engine (revertInvoicePosting)
   */
  public static revertInvoicePosting(
    invoiceId: string,
    reason: string = 'إلغاء وعكس الفاتورة محاسبياً بدقة IFRS'
  ): { invoice: Invoice; reversalJournal: JournalEntry | null } {
    return db.executeTransaction(() => {
      const invoice = db.getInvoices().find(
        (inv) =>
          inv.id === invoiceId ||
          (inv.id && invoiceId && inv.id.toLowerCase() === invoiceId.toLowerCase()) ||
          (inv.invoiceNumber && invoiceId && inv.invoiceNumber.trim().toUpperCase() === invoiceId.trim().toUpperCase())
      );
      if (!invoice) throw new Error('الفاتورة غير موجودة');

      let reversalJournal: JournalEntry | null = null;

      // If posted or paid, reverse journal entry & stock movements & entity balance
      if (invoice.status === 'POSTED' || invoice.status === 'PAID') {
        const relatedJournal = db.getJournals().find(
          (j) => j.sourceId === invoice.id || j.id === invoice.journalEntryId
        );
        if (relatedJournal && relatedJournal.status === 'POSTED') {
          try {
            reversalJournal = this.reverseJournalEntry(
              relatedJournal.id,
              `عكس قيد الفاتورة ${invoice.invoiceNumber}: ${reason}`
            );
          } catch (e) {
            console.error('revertInvoicePosting journal reversal note:', e);
          }
        }

        // Reverse stock movements
        const inventoryItems = db.getInventory();
        invoice.lines.forEach((line) => {
          const invItem = inventoryItems.find((i) => i.id === line.itemId);
          if (invItem) {
            if (invoice.type === 'SALES') {
              db.updateInventoryItem(invItem.id, {
                quantityOnHand: invItem.quantityOnHand + line.quantity,
              });
            } else if (invoice.type === 'PURCHASE') {
              db.updateInventoryItem(invItem.id, {
                quantityOnHand: Math.max(0, invItem.quantityOnHand - line.quantity),
              });
            } else if (invoice.type === 'SALES_RETURN') {
              db.updateInventoryItem(invItem.id, {
                quantityOnHand: Math.max(0, invItem.quantityOnHand - line.quantity),
              });
            } else if (invoice.type === 'PURCHASE_RETURN') {
              db.updateInventoryItem(invItem.id, {
                quantityOnHand: invItem.quantityOnHand + line.quantity,
              });
            }
          }
        });

        // Recalculate customer/supplier balance atomically
        if (invoice.type === 'SALES' || invoice.type === 'SALES_RETURN') {
          this.recalculateCustomerBalance(invoice.entityId);
        } else if (invoice.type === 'PURCHASE' || invoice.type === 'PURCHASE_RETURN') {
          this.recalculateSupplierBalance(invoice.entityId);
        }
      }

      // Update status to CANCELLED
      db.updateInvoice(invoice.id, {
        status: 'CANCELLED',
        notes:
          (invoice.notes ? invoice.notes + '\n' : '') +
          `[ملغاة وعكس القيود IFRS بتاريخ ${new Date().toISOString().split('T')[0]}: ${reason}]`,
      });

      const updatedInvoice = db.getInvoices().find((i) => i.id === invoiceId)!;
      return { invoice: updatedInvoice, reversalJournal };
    });
  }

  /**
   * Update existing invoice with full accounting recalculation and delta adjustments
   */
  public static updateInvoice(invoiceId: string, updatedData: Partial<Invoice>): Invoice {
    return db.executeTransaction(() => {
      const original = db.getInvoices().find((i) => i.id === invoiceId);
      if (!original) throw new Error('الفاتورة غير موجودة');

      const wasPosted = original.status === 'POSTED' || original.status === 'PAID' || original.status === 'PARTIALLY_PAID';

      if (wasPosted) {
        // 1. Rollback original stock movements
        const inventoryItems = db.getInventory();
        original.lines.forEach((line) => {
          const invItem = inventoryItems.find((i) => i.id === line.itemId);
          if (invItem) {
            if (original.type === 'SALES') {
              db.updateInventoryItem(invItem.id, { quantityOnHand: invItem.quantityOnHand + line.quantity });
            } else if (original.type === 'PURCHASE') {
              db.updateInventoryItem(invItem.id, { quantityOnHand: Math.max(0, invItem.quantityOnHand - line.quantity) });
            } else if (original.type === 'SALES_RETURN') {
              db.updateInventoryItem(invItem.id, { quantityOnHand: Math.max(0, invItem.quantityOnHand - line.quantity) });
            } else if (original.type === 'PURCHASE_RETURN') {
              db.updateInventoryItem(invItem.id, { quantityOnHand: invItem.quantityOnHand + line.quantity });
            }
          }
        });

        // 2. Mark old linked journal as CANCELLED
        const oldJournal = db.getJournals().find((j) => j.id === original.journalEntryId || j.sourceId === original.id);
        if (oldJournal) {
          db.updateJournal(oldJournal.id, { status: 'CANCELLED' });
        }
      }

      // 3. Update invoice properties in db
      db.updateInvoice(invoiceId, {
        ...updatedData,
        status: wasPosted ? 'DRAFT' : (updatedData.status || original.status),
      });

      // 4. Re-post if it was previously active to generate new journal & stock updates
      if (wasPosted) {
        if (original.type === 'SALES' || original.type === 'SALES_RETURN') {
          this.postSalesInvoice(invoiceId);
        } else {
          this.postPurchaseInvoice(invoiceId);
        }
      }

      // 5. Recalculate entity balances
      if (original.type === 'SALES' || original.type === 'SALES_RETURN') {
        this.recalculateCustomerBalance(original.entityId);
        if (updatedData.entityId && updatedData.entityId !== original.entityId) {
          this.recalculateCustomerBalance(updatedData.entityId);
        }
      } else {
        this.recalculateSupplierBalance(original.entityId);
        if (updatedData.entityId && updatedData.entityId !== original.entityId) {
          this.recalculateSupplierBalance(updatedData.entityId);
        }
      }

      return db.getInvoices().find((i) => i.id === invoiceId)!;
    });
  }

  /**
   * إنشاء العميل وحسابه الفرعي تلقائياً وفق ترقيم الشركة المعتمد
   * عملية ذرية كاملة (Atomic Transaction): نجاح العمليتين معاً أو فشلهما معاً
   */
  public static createCustomerWithSubAccount(
    data: any,
    companyId: string
  ): { customer: Customer; account: Account; journal?: JournalEntry } {
    if (!companyId || !companyId.trim()) {
      throw new Error('معرّف الشركة (companyId) إلزامي ومطلوب لإنشاء العميل وحسابه المحاسبي');
    }
    const cleanCompanyId = companyId.trim();

    return db.executeTransaction(() => {
      const compAccounts = db.getAccounts().filter((a) => matchesCompany(a.companyId, cleanCompanyId));
      const company = db.getCompany();

      // 1. التحقق من حساب الذمم المعتمد للشركة من إعداداتها أو الدليل المحاسبي
      let parentAccount = compAccounts.find(
        (a) =>
          a.id === company?.defaultAccounts?.receivableAccountId ||
          a.code === '1120' ||
          (a.category === 'ASSET' && (a.nameAr.includes('الذمم المدينة') || a.nameAr.includes('حسابات العملاء')))
      );

      if (!parentAccount) {
        throw new Error('تعذر العثور على حساب الذمم المدينة الرئيسي المعتمد لهذه الشركة (لا يوجد حساب 1120 أو حساب ذمم معتمد).');
      }

      if (parentAccount.isActive === false) {
        throw new Error('حساب الذمم المدينة الرئيسي معطل في هذه الشركة، يرجى تفعيله أولاً.');
      }

      // 2. توليد حساب العميل الفرعي تلقائياً وفق ترقيم الشركة
      const prefix = parentAccount.code;
      const existingCodes = new Set(compAccounts.map((a) => a.code));
      let maxSeq = 0;
      for (const acc of compAccounts) {
        if (acc.code && acc.code.startsWith(prefix) && acc.code !== prefix) {
          const suffix = acc.code.slice(prefix.length);
          const num = parseInt(suffix, 10);
          if (!isNaN(num) && num > maxSeq) {
            maxSeq = num;
          }
        }
      }
      let nextSeq = maxSeq + 1;
      let subAccountCode = `${prefix}${String(nextSeq).padStart(3, '0')}`;
      while (existingCodes.has(subAccountCode)) {
        nextSeq++;
        subAccountCode = `${prefix}${String(nextSeq).padStart(3, '0')}`;
      }

      const custNameAr = (data.nameAr || 'عميل جديد').trim();
      const custNameEn = (data.nameEn || custNameAr).trim();
      const newAccountId = 'acc-' + Math.random().toString(36).substr(2, 9);

      const subAccount: Account = {
        id: newAccountId,
        companyId: cleanCompanyId,
        code: subAccountCode,
        nameAr: `حساب عميل: ${custNameAr}`,
        nameEn: custNameEn ? `Customer: ${custNameEn}` : `Customer: ${custNameAr}`,
        category: 'ASSET',
        parentId: parentAccount.id,
        level: (parentAccount.level || 1) + 1,
        normalBalance: 'DEBIT',
        nature: 'DEBIT',
        isSystem: false,
        isActive: true,
        description: `حساب الذمة الفرعي التلقائي للعميل: ${custNameAr}`,
      };

      db.addAccount(subAccount);

      // 3. التحقق من الرصيد الافتتاحي وتاريخه
      const openingBal = Number(data.openingBalance) || 0;
      let openingJournal: JournalEntry | undefined = undefined;

      if (openingBal > 0) {
        if (!data.openingBalanceDate || !data.openingBalanceDate.trim()) {
          throw new Error('لا يمكن اعتماد رصيد افتتاحي للعميل دون تحديد تاريخ صريح للرصيد الافتتاحي.');
        }

        const equityAccount = compAccounts.find(
          (a) =>
            a.id === company?.defaultAccounts?.retainedEarningsAccountId ||
            a.code === '3200' ||
            a.code === '3100' ||
            (a.category === 'EQUITY' && (a.nameAr.includes('أرباح مرحلة') || a.nameAr.includes('أرصدة افتتاحية') || a.nameAr.includes('رأس المال')))
        );

        if (!equityAccount) {
          throw new Error('تعذر اعتماد الرصيد الافتتاحي لعدم توفر حساب حقوق ملكية / أرباح مرحلة معتمد في هذه الشركة.');
        }

        const customerIdForJv = data.id || ('cust-' + Math.random().toString(36).substr(2, 9));
        openingJournal = {
          id: 'jv-' + Math.random().toString(36).substr(2, 9),
          companyId: cleanCompanyId,
          entryNumber: `JV-OP-CUST-${customerIdForJv.slice(-4)}`,
          date: data.openingBalanceDate.trim(),
          reference: `OP-${custNameAr}`,
          description: `قيد رصيد أول المدة الافتتاحي للعميل (${custNameAr})`,
          status: 'POSTED',
          lines: [
            {
              id: 'jl-' + Math.random().toString(36).substr(2, 9),
              accountId: subAccount.id,
              accountCode: subAccount.code,
              accountNameAr: subAccount.nameAr,
              debit: openingBal,
              credit: 0,
              memo: `رصيد أول المدة للعميل ${custNameAr}`,
              entityType: 'CUSTOMER',
              entityId: customerIdForJv,
              companyId: cleanCompanyId,
            },
            {
              id: 'jl-' + Math.random().toString(36).substr(2, 9),
              accountId: equityAccount.id,
              accountCode: equityAccount.code,
              accountNameAr: equityAccount.nameAr,
              debit: 0,
              credit: openingBal,
              memo: `حقوق الملكية / أرصدة افتتاحية - ${custNameAr}`,
              companyId: cleanCompanyId,
            },
          ],
          totalDebit: openingBal,
          totalCredit: openingBal,
          createdAt: new Date().toISOString(),
          postedAt: new Date().toISOString(),
          isAutoGenerated: true,
          sourceModule: 'CUSTOMER_OPENING_BALANCE' as any,
          sourceId: customerIdForJv,
        };

        const validation = this.validateJournalEntry(openingJournal);
        if (!validation.isValid) {
          throw new Error(`فشل التحقق من توازن قيد الرصيد الافتتاحي: ${validation.error}`);
        }
        db.addJournal(openingJournal);
      }

      // 4. إنشاء سجل العميل وحفظ account_id
      const customerId = (openingJournal?.sourceId) || data.id || ('cust-' + Math.random().toString(36).substr(2, 9));
      const compCustomers = db.getCustomers().filter((c) => matchesCompany(c.companyId, cleanCompanyId));
      const customerCode = data.code || `CUST-${String(compCustomers.length + 1).padStart(3, '0')}`;

      const customer: Customer = {
        id: customerId,
        companyId: cleanCompanyId,
        company_id: cleanCompanyId,
        account_id: subAccount.id,
        accountId: subAccount.id,
        code: customerCode,
        nameAr: custNameAr,
        nameEn: custNameEn,
        taxNumber: data.taxNumber || '',
        phone: data.phone || '',
        email: data.email || '',
        address: data.address || '',
        governorate: data.governorate || data.address || '',
        city: data.city || 'الكويت',
        balance: openingBal,
        openingBalance: openingBal,
        openingBalanceDate: openingBal > 0 ? data.openingBalanceDate.trim() : (data.openingBalanceDate || undefined),
        isActive: true,
        branches: data.branches || [],
        priceListId: data.priceListId || 'standard',
        priceListName: data.priceListName || '',
        customPrices: data.customPrices || [],
        defaultDiscountRate: data.defaultDiscountRate !== undefined ? Number(data.defaultDiscountRate) : 0,
      };

      db.addCustomer(customer);

      return {
        customer,
        account: subAccount,
        journal: openingJournal,
      };
    });
  }

  /**
   * Recalculate customer balance from first principles (Opening + Invoices - Returns - Receipts + Journals)
   */
  public static recalculateCustomerBalance(customerId: string): number {
    const customer = db.getCustomers().find((c) => c.id === customerId);
    if (!customer) return 0;

    let balance = Number(customer.openingBalance) || 0;

    // Invoices
    const invoices = db.getInvoices().filter((i) => i.entityId === customerId && i.status !== 'CANCELLED');
    const vouchers = db.getVouchers().filter((v) => v.entityId === customerId && v.status !== 'CANCELLED');

    for (const inv of invoices) {
      // Direct cash payment on the invoice not captured by a standalone voucher
      const settledByVouchers = vouchers
        .filter((v) => v.invoiceId === inv.id && v.status !== 'CANCELLED')
        .reduce((sum, v) => sum + (Number(v.amount) || 0), 0);
      const directInvoicePaid = Math.max(0, (Number(inv.paidAmount) || 0) - settledByVouchers);
      const effectiveReceivableImpact = Math.max(0, (Number(inv.grandTotal) || 0) - directInvoicePaid);

      if (inv.type === 'SALES') {
        balance += effectiveReceivableImpact;
      } else if (inv.type === 'SALES_RETURN') {
        balance -= effectiveReceivableImpact;
      }
    }

    // Vouchers
    for (const v of vouchers) {
      if (v.type === 'RECEIPT') {
        balance -= Number(v.amount) || 0;
      } else if (v.type === 'PAYMENT') {
        balance += Number(v.amount) || 0;
      }
    }

    // Manual Journals touching this customer
    const journals = db.getJournals().filter((j) => (j.status === 'POSTED' || j.status === 'REVERSED') && !j.isAutoGenerated);
    for (const j of journals) {
      for (const line of j.lines) {
        if (line.entityId === customerId || (line.entityType === 'CUSTOMER' && line.entityId === customerId)) {
          balance += (Number(line.debit) || 0) - (Number(line.credit) || 0);
        }
      }
    }

    balance = Math.round(balance * 1000) / 1000;
    db.updateCustomer(customerId, { balance });
    return balance;
  }

  /**
   * Recalculate supplier balance from first principles (Opening + Invoices - Returns - Payments + Journals)
   */
  public static recalculateSupplierBalance(supplierId: string): number {
    const supplier = db.getSuppliers().find((s) => s.id === supplierId);
    if (!supplier) return 0;

    let balance = Number(supplier.openingBalance) || 0;

    // Invoices
    const invoices = db.getInvoices().filter((i) => i.entityId === supplierId && i.status !== 'CANCELLED');
    const vouchers = db.getVouchers().filter((v) => v.entityId === supplierId && v.status !== 'CANCELLED');

    for (const inv of invoices) {
      // Direct cash payment on the invoice not captured by a standalone voucher
      const settledByVouchers = vouchers
        .filter((v) => v.invoiceId === inv.id && v.status !== 'CANCELLED')
        .reduce((sum, v) => sum + (Number(v.amount) || 0), 0);
      const directInvoicePaid = Math.max(0, (Number(inv.paidAmount) || 0) - settledByVouchers);
      const effectivePayableImpact = Math.max(0, (Number(inv.grandTotal) || 0) - directInvoicePaid);

      if (inv.type === 'PURCHASE') {
        balance += effectivePayableImpact;
      } else if (inv.type === 'PURCHASE_RETURN') {
        balance -= effectivePayableImpact;
      }
    }

    // Vouchers
    for (const v of vouchers) {
      if (v.type === 'PAYMENT') {
        balance -= Number(v.amount) || 0;
      } else if (v.type === 'RECEIPT') {
        balance += Number(v.amount) || 0;
      }
    }

    // Manual Journals touching this supplier
    const journals = db.getJournals().filter((j) => (j.status === 'POSTED' || j.status === 'REVERSED') && !j.isAutoGenerated);
    for (const j of journals) {
      for (const line of j.lines) {
        if (line.entityId === supplierId || (line.entityType === 'SUPPLIER' && line.entityId === supplierId)) {
          balance += (Number(line.credit) || 0) - (Number(line.debit) || 0);
        }
      }
    }

    balance = Math.round(balance * 1000) / 1000;
    db.updateSupplier(supplierId, { balance });
    return balance;
  }

  /**
   * Full System Integrity Audit & Balances Synchronization
   */
  public static recalculateAllEntityBalances(): {
    customersCount: number;
    suppliersCount: number;
    invoicesCount: number;
    journalsCount: number;
    inventoryItemsCount: number;
  } {
    const customers = db.getCustomers();
    customers.forEach((c) => this.recalculateCustomerBalance(c.id));

    const suppliers = db.getSuppliers();
    suppliers.forEach((s) => this.recalculateSupplierBalance(s.id));

    return {
      customersCount: customers.length,
      suppliersCount: suppliers.length,
      invoicesCount: db.getInvoices().length,
      journalsCount: db.getJournals().length,
      inventoryItemsCount: db.getInventory().length,
    };
  }

  /**
   * Post Payment/Receipt Voucher (سند القبض والصرف) with ACID transaction
   */
  public static postVoucher(voucher: PaymentVoucher, companyId?: string): PaymentVoucher {
    return db.executeTransaction(() => {
      const today = new Date().toISOString().split('T')[0];
      const journalEntryNumber = `JV-${voucher.voucherNumber}`;
      const compId = companyId || voucher.companyId || (voucher as any).company_id;
      if (companyId && voucher.companyId && !matchesCompany(voucher.companyId, companyId)) {
        throw new Error('السند غير تابع للشركة المصرح بها');
      }

      const compAccounts = db.getAccounts().filter((a) => matchesCompany(a.companyId, compId));

      // Dynamically resolve Bank or Cash account from Chart of Accounts for this company
      const targetBankAccId = voucher.bankAccountId || (voucher.paymentMethod === 'CASH' ? 'acc-1112' : 'acc-1111');
      const resolvedBankAcc = compAccounts.find((a) => a.id === targetBankAccId || a.code === targetBankAccId) ||
        compAccounts.find((a) => (voucher.paymentMethod === 'CASH' ? a.code === '1112' || a.code === '1110' : a.code === '1111')) ||
        compAccounts.find((a) => a.category === 'ASSET' && (voucher.paymentMethod === 'CASH' ? a.nameAr.includes('صندوق') || a.nameAr.includes('خزينة') : a.nameAr.includes('بنك'))) || {
          id: targetBankAccId,
          code: voucher.paymentMethod === 'CASH' ? '1112' : '1111',
          nameAr: voucher.paymentMethod === 'CASH' ? 'الصندوق الرئيسي (الخزينة)' : 'البنك الأهلي التجاري - الحساب الرئيسي',
        };

      const lines = [];

      if (voucher.type === 'RECEIPT') {
        // Receipt from Customer (قبض): Debit Bank/Cash, Credit Accounts Receivable
        let recAccId = 'acc-1120';
        let recAccCode = '1120';
        let recAccNameAr = 'الذمم المدينة (حسابات العملاء)';

        if (voucher.entityId) {
          const customer = db.getCustomers().find((c) => c.id === voucher.entityId && matchesCompany(c.companyId, compId));
          if (customer) {
            const custAccId = customer.account_id || (customer as any).accountId;
            if (custAccId) {
              const matchedAcc = compAccounts.find((a) => (a.id === custAccId || a.code === custAccId) && matchesCompany(a.companyId, compId));
              if (matchedAcc) {
                recAccId = matchedAcc.id;
                recAccCode = matchedAcc.code;
                recAccNameAr = matchedAcc.nameAr;
              }
            }
          }
        }

        if (recAccId === 'acc-1120') {
          const approvedAcc = compAccounts.find(
            (a) => a.code === '1120' || (a.category === 'ASSET' && (a.nameAr.includes('الذمم المدينة') || a.nameAr.includes('حسابات العملاء')))
          );
          if (approvedAcc) {
            recAccId = approvedAcc.id;
            recAccCode = approvedAcc.code;
            recAccNameAr = approvedAcc.nameAr;
          }
        }

        lines.push(
          {
            id: 'jl-' + Math.random().toString(36).substr(2, 9),
            accountId: resolvedBankAcc.id,
            accountCode: resolvedBankAcc.code,
            accountNameAr: resolvedBankAcc.nameAr,
            debit: voucher.amount,
            credit: 0,
            memo: `سند قبض رقم ${voucher.voucherNumber} من ${voucher.entityNameAr}`,
            companyId: compId,
          },
          {
            id: 'jl-' + Math.random().toString(36).substr(2, 9),
            accountId: recAccId,
            accountCode: recAccCode,
            accountNameAr: recAccNameAr,
            debit: 0,
            credit: voucher.amount,
            memo: `تحصيل من العميل ${voucher.entityNameAr}`,
            entityType: 'CUSTOMER' as const,
            entityId: voucher.entityId,
            companyId: compId,
          }
        );
      } else {
        // Payment to Supplier (صرف): Debit Accounts Payable, Credit Bank/Cash
        let payAccId = 'acc-2110';
        let payAccCode = '2110';
        let payAccNameAr = 'الذمم الدائنة (حسابات الموردين)';

        if (voucher.entityId) {
          const supplier = db.getSuppliers().find((s) => s.id === voucher.entityId && matchesCompany(s.companyId, compId));
          if (supplier) {
            const suppAccId = supplier.account_id || (supplier as any).accountId;
            if (suppAccId) {
              const matchedAcc = compAccounts.find((a) => (a.id === suppAccId || a.code === suppAccId) && matchesCompany(a.companyId, compId));
              if (matchedAcc) {
                payAccId = matchedAcc.id;
                payAccCode = matchedAcc.code;
                payAccNameAr = matchedAcc.nameAr;
              }
            }
          }
        }

        if (payAccId === 'acc-2110') {
          const approvedAcc = compAccounts.find(
            (a) => a.code === '2110' || (a.category === 'LIABILITY' && (a.nameAr.includes('الذمم الدائنة') || a.nameAr.includes('حسابات الموردين')))
          );
          if (approvedAcc) {
            payAccId = approvedAcc.id;
            payAccCode = approvedAcc.code;
            payAccNameAr = approvedAcc.nameAr;
          }
        }

        lines.push(
          {
            id: 'jl-' + Math.random().toString(36).substr(2, 9),
            accountId: payAccId,
            accountCode: payAccCode,
            accountNameAr: payAccNameAr,
            debit: voucher.amount,
            credit: 0,
            memo: `سداد للمورد ${voucher.entityNameAr}`,
            entityType: 'SUPPLIER' as const,
            entityId: voucher.entityId,
            companyId: compId,
          },
          {
            id: 'jl-' + Math.random().toString(36).substr(2, 9),
            accountId: resolvedBankAcc.id,
            accountCode: resolvedBankAcc.code,
            accountNameAr: resolvedBankAcc.nameAr,
            debit: 0,
            credit: voucher.amount,
            memo: `سند صرف رقم ${voucher.voucherNumber} إلى ${voucher.entityNameAr}`,
            companyId: compId,
          }
        );
      }

      // Update linked invoice paid amount and status for both RECEIPT and PAYMENT
      if (voucher.invoiceId) {
        const inv = db.getInvoices().find((i) => i.id === voucher.invoiceId);
        if (inv) {
          const newPaid = Math.min(inv.grandTotal, Math.round(((inv.paidAmount || 0) + voucher.amount) * 1000) / 1000);
          const newDue = Math.max(0, Math.round((inv.grandTotal - newPaid) * 1000) / 1000);
          db.updateInvoice(inv.id, {
            paidAmount: newPaid,
            dueAmount: newDue,
            status: newDue === 0 ? 'PAID' : (newPaid > 0 ? 'PARTIALLY_PAID' : inv.status),
          });
        }
      }

      // Validate Voucher entry balance
      const validation = this.validateJournalEntry({ lines });
      if (!validation.isValid) {
        throw new Error(`فشل التحقق المحاسبي لقيد السند: ${validation.error}`);
      }

      const journalEntry: JournalEntry = {
        id: 'jv-' + Math.random().toString(36).substr(2, 9),
        companyId: compId,
        entryNumber: journalEntryNumber,
        date: voucher.date || today,
        reference: voucher.reference || voucher.voucherNumber,
        description: `قيد آلي ناتج عن ${
          voucher.type === 'RECEIPT' ? 'سند قبض' : 'سند صرف'
        } رقم (${voucher.voucherNumber}) - ${voucher.notes || ''}`,
        status: 'POSTED',
        lines,
        totalDebit: voucher.amount,
        totalCredit: voucher.amount,
        createdAt: new Date().toISOString(),
        postedAt: new Date().toISOString(),
        isAutoGenerated: true,
        sourceModule: voucher.type === 'RECEIPT' ? 'RECEIPT' : 'PAYMENT',
        sourceId: voucher.id,
      };

      db.addJournal(journalEntry);
      voucher.status = 'POSTED';
      voucher.journalEntryId = journalEntry.id;
      voucher.companyId = compId;
      db.addVoucher(voucher);

      // Dynamically recalculate entity balance
      if (voucher.entityType === 'CUSTOMER') {
        this.recalculateCustomerBalance(voucher.entityId);
      } else {
        this.recalculateSupplierBalance(voucher.entityId);
      }

      return voucher;
    });
  }

  /**
   * Cancel / Void Payment Voucher with journal reversal and balance restoration
   */
  public static cancelVoucher(voucherId: string, reason: string = 'إلغاء السند وعكس أثره المالي'): PaymentVoucher {
    return db.executeTransaction(() => {
      const cleanId = (voucherId || '').trim();
      const cleanUpper = cleanId.toUpperCase();
      const cleanNoVch = cleanUpper.replace(/^VCH-/, '');

      let voucher = db.getVouchers().find(
        (v) =>
          v.id === cleanId ||
          (v.id && v.id.toLowerCase() === cleanId.toLowerCase()) ||
          (v.voucherNumber && v.voucherNumber.trim().toUpperCase() === cleanUpper) ||
          (v.voucherNumber && v.voucherNumber.trim().toUpperCase() === cleanNoVch) ||
          (v.reference && v.reference.trim().toUpperCase() === cleanUpper) ||
          (v.reference && v.reference.trim().toUpperCase() === cleanNoVch) ||
          (cleanUpper.startsWith('VCH-') && v.id.toLowerCase() === cleanNoVch.toLowerCase()) ||
          (v.journalEntryId && (v.journalEntryId.toUpperCase() === cleanUpper || v.journalEntryId.toUpperCase() === cleanNoVch))
      );

      // If voucher not found, search in journals (synthesized or journal-backed)
      if (!voucher) {
        const journal = db.getJournals().find(
          (j) =>
            j.id.toUpperCase() === cleanUpper ||
            j.id.toUpperCase() === cleanNoVch ||
            (j.entryNumber && j.entryNumber.trim().toUpperCase() === cleanUpper) ||
            (j.entryNumber && j.entryNumber.trim().toUpperCase() === cleanNoVch) ||
            (j.entryNumber && `JV-${j.entryNumber.trim().toUpperCase()}` === cleanUpper) ||
            (j.reference && j.reference.trim().toUpperCase() === cleanUpper) ||
            (j.reference && j.reference.trim().toUpperCase() === cleanNoVch) ||
            (j.sourceId && j.sourceId.toUpperCase() === cleanUpper) ||
            (j.sourceId && j.sourceId.toUpperCase() === cleanNoVch)
        );

        if (journal) {
          db.updateJournal(journal.id, { status: 'CANCELLED' });

          const custLine = journal.lines.find((l) => l.entityType === 'CUSTOMER' || l.accountCode?.startsWith('112'));
          const suppLine = journal.lines.find((l) => l.entityType === 'SUPPLIER' || l.accountCode?.startsWith('211'));
          const isReceipt = journal.sourceModule === 'RECEIPT' || (custLine && (custLine.credit > 0 || custLine.debit > 0)) || journal.reference?.startsWith('RCV-') || journal.description?.includes('قبض');
          const entId = custLine?.entityId || suppLine?.entityId || '';
          const entName = custLine?.entityNameAr || suppLine?.entityNameAr || journal.description || '';

          voucher = {
            id: cleanId.startsWith('vch-') ? cleanId : `vch-${journal.id.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}`,
            voucherNumber: journal.reference || journal.entryNumber.replace(/^JV-/, ''),
            type: isReceipt ? 'RECEIPT' : 'PAYMENT',
            date: journal.date || new Date().toISOString().split('T')[0],
            amount: journal.totalDebit || 0,
            paymentMethod: 'BANK',
            bankAccountId: 'acc-1111',
            entityType: isReceipt ? 'CUSTOMER' : 'SUPPLIER',
            entityId: entId,
            customerId: isReceipt ? entId : undefined,
            supplierId: !isReceipt ? entId : undefined,
            entityNameAr: entName,
            entityName: entName,
            status: 'CANCELLED',
            journalEntryId: journal.id,
            reference: journal.reference || journal.entryNumber,
            notes: (journal.description ? journal.description + '\n' : '') + `[ملغى بتاريخ ${new Date().toISOString().split('T')[0]}: ${reason}]`,
            createdAt: journal.createdAt || new Date().toISOString(),
            companyId: journal.companyId || 'default',
          };

          db.addVoucher(voucher);
          if (custLine?.entityId) this.recalculateCustomerBalance(custLine.entityId);
          if (suppLine?.entityId) this.recalculateSupplierBalance(suppLine.entityId);
          return voucher;
        }

        throw new Error('السند غير موجود');
      }

      if (voucher.status === 'CANCELLED') return voucher;

      // 1. Reverse or cancel the associated journal entry
      const vNum = (voucher.voucherNumber || '').trim().toUpperCase();
      const journal = db.getJournals().find(
        (j) =>
          j.id === voucher!.journalEntryId ||
          j.sourceId === voucher!.id ||
          (vNum && j.reference && j.reference.trim().toUpperCase() === vNum) ||
          (vNum && j.entryNumber && j.entryNumber.trim().toUpperCase() === `JV-${vNum}`)
      );
      if (journal && (journal.status === 'POSTED' || journal.status !== 'CANCELLED')) {
        db.updateJournal(journal.id, { status: 'CANCELLED' });
      }

      // 2. If voucher was linked to an invoice, restore invoice paidAmount & dueAmount
      if (voucher.invoiceId) {
        const inv = db.getInvoices().find((i) => i.id === voucher!.invoiceId);
        if (inv) {
          const restoredPaid = Math.max(0, (inv.paidAmount || 0) - voucher.amount);
          const restoredDue = Math.max(0, inv.grandTotal - restoredPaid);
          db.updateInvoice(inv.id, {
            paidAmount: restoredPaid,
            dueAmount: restoredDue,
            status: restoredDue === 0 ? 'PAID' : (restoredPaid > 0 ? 'PARTIALLY_PAID' : 'POSTED'),
          });
        }
      }

      // 3. Mark voucher as cancelled
      db.updateVoucher(voucher.id, {
        status: 'CANCELLED',
        notes: (voucher.notes ? voucher.notes + '\n' : '') + `[ملغى بتاريخ ${new Date().toISOString().split('T')[0]}: ${reason}]`,
      });

      // 4. Recalculate entity balance
      if (voucher.entityType === 'CUSTOMER' && voucher.entityId) {
        this.recalculateCustomerBalance(voucher.entityId);
      } else if (voucher.entityId) {
        this.recalculateSupplierBalance(voucher.entityId);
      }

      if (journal && Array.isArray(journal.lines)) {
        journal.lines.forEach((l) => {
          if (l.entityType === 'CUSTOMER' && l.entityId) this.recalculateCustomerBalance(l.entityId);
          if (l.entityType === 'SUPPLIER' && l.entityId) this.recalculateSupplierBalance(l.entityId);
        });
      }

      return db.getVouchers().find((v) => v.id === voucher!.id)!;
    });
  }

  /**
   * Update Payment Voucher with automatic journal and balance adjustments
   */
  public static updateVoucher(voucherId: string, updatedData: Partial<PaymentVoucher>): PaymentVoucher {
    return db.executeTransaction(() => {
      const original = db.getVouchers().find((v) => v.id === voucherId);
      if (!original) throw new Error('السند غير موجود');

      const oldAmount = Number(original.amount) || 0;
      const newAmount = updatedData.amount !== undefined ? Number(updatedData.amount) : oldAmount;
      const oldInvoiceId = original.invoiceId;
      const newInvoiceId = updatedData.invoiceId !== undefined ? updatedData.invoiceId : oldInvoiceId;
      const oldEntityId = original.entityId;
      const newEntityId = updatedData.entityId || oldEntityId;
      const oldEntityType = original.entityType;

      // 1. Cancel old journal entry
      const oldJournal = db.getJournals().find((j) => j.id === original.journalEntryId || j.sourceId === original.id);
      if (oldJournal) {
        db.updateJournal(oldJournal.id, { status: 'CANCELLED' });
      }

      // 2. Reconcile invoices
      if (oldInvoiceId && oldInvoiceId !== newInvoiceId) {
        // Revert old invoice
        const oldInv = db.getInvoices().find((i) => i.id === oldInvoiceId);
        if (oldInv) {
          const restoredPaid = Math.max(0, (oldInv.paidAmount || 0) - oldAmount);
          const restoredDue = Math.max(0, oldInv.grandTotal - restoredPaid);
          db.updateInvoice(oldInv.id, {
            paidAmount: restoredPaid,
            dueAmount: restoredDue,
            status: restoredDue === 0 ? 'PAID' : (restoredPaid > 0 ? 'PARTIALLY_PAID' : 'POSTED'),
          });
        }
        // Apply to new invoice
        if (newInvoiceId) {
          const newInv = db.getInvoices().find((i) => i.id === newInvoiceId);
          if (newInv) {
            const adjustedPaid = (newInv.paidAmount || 0) + newAmount;
            const adjustedDue = Math.max(0, newInv.grandTotal - adjustedPaid);
            db.updateInvoice(newInv.id, {
              paidAmount: adjustedPaid,
              dueAmount: adjustedDue,
              status: adjustedDue === 0 ? 'PAID' : (adjustedPaid > 0 ? 'PARTIALLY_PAID' : 'POSTED'),
            });
          }
        }
      } else if (newInvoiceId) {
        // Same invoice, adjust delta
        const inv = db.getInvoices().find((i) => i.id === newInvoiceId);
        if (inv) {
          const delta = newAmount - oldAmount;
          const adjustedPaid = Math.max(0, (inv.paidAmount || 0) + delta);
          const adjustedDue = Math.max(0, inv.grandTotal - adjustedPaid);
          db.updateInvoice(inv.id, {
            paidAmount: adjustedPaid,
            dueAmount: adjustedDue,
            status: adjustedDue === 0 ? 'PAID' : (adjustedPaid > 0 ? 'PARTIALLY_PAID' : 'POSTED'),
          });
        }
      }

      // 3. Apply voucher update
      db.updateVoucher(voucherId, updatedData);
      const updatedVoucher = db.getVouchers().find((v) => v.id === voucherId)!;

      // 4. Resolve Bank or Cash account dynamically from Chart of Accounts
      const allAccounts = db.getAccounts();
      const targetBankAccId = updatedVoucher.bankAccountId || (updatedVoucher.paymentMethod === 'CASH' ? 'acc-1112' : 'acc-1111');
      const resolvedBankAcc = allAccounts.find((a) => a.id === targetBankAccId || a.code === targetBankAccId) ||
        allAccounts.find((a) => (updatedVoucher.paymentMethod === 'CASH' ? a.code === '1112' || a.code === '1110' : a.code === '1111')) || {
          id: targetBankAccId,
          code: updatedVoucher.paymentMethod === 'CASH' ? '1112' : '1111',
          nameAr: updatedVoucher.paymentMethod === 'CASH' ? 'الصندوق الرئيسي (الخزينة)' : 'البنك الأهلي التجاري - الحساب الرئيسي',
        };

      // 5. Build new Journal Entry
      const lines = [];
      if (updatedVoucher.type === 'RECEIPT') {
        lines.push(
          {
            id: 'jl-' + Math.random().toString(36).substr(2, 9),
            accountId: resolvedBankAcc.id,
            accountCode: resolvedBankAcc.code,
            accountNameAr: resolvedBankAcc.nameAr,
            debit: updatedVoucher.amount,
            credit: 0,
            memo: `سند قبض معدل رقم ${updatedVoucher.voucherNumber} من ${updatedVoucher.entityNameAr}`,
          },
          {
            id: 'jl-' + Math.random().toString(36).substr(2, 9),
            accountId: 'acc-1120',
            accountCode: '1120',
            accountNameAr: 'الذمم المدينة (حسابات العملاء)',
            debit: 0,
            credit: updatedVoucher.amount,
            memo: `تحصيل من العميل ${updatedVoucher.entityNameAr}`,
            entityType: 'CUSTOMER' as const,
            entityId: updatedVoucher.entityId,
          }
        );
      } else {
        lines.push(
          {
            id: 'jl-' + Math.random().toString(36).substr(2, 9),
            accountId: 'acc-2110',
            accountCode: '2110',
            accountNameAr: 'الذمم الدائنة (حسابات الموردين)',
            debit: updatedVoucher.amount,
            credit: 0,
            memo: `سداد للمورد ${updatedVoucher.entityNameAr}`,
            entityType: 'SUPPLIER' as const,
            entityId: updatedVoucher.entityId,
          },
          {
            id: 'jl-' + Math.random().toString(36).substr(2, 9),
            accountId: resolvedBankAcc.id,
            accountCode: resolvedBankAcc.code,
            accountNameAr: resolvedBankAcc.nameAr,
            debit: 0,
            credit: updatedVoucher.amount,
            memo: `سند صرف معدل رقم ${updatedVoucher.voucherNumber} إلى ${updatedVoucher.entityNameAr}`,
          }
        );
      }

      const journalEntry: JournalEntry = {
        id: 'jv-' + Math.random().toString(36).substr(2, 9),
        entryNumber: `JV-${updatedVoucher.voucherNumber}`,
        date: updatedVoucher.date,
        reference: updatedVoucher.reference || updatedVoucher.voucherNumber,
        description: `قيد آلي معدل ناتج عن ${
          updatedVoucher.type === 'RECEIPT' ? 'سند قبض' : 'سند صرف'
        } رقم (${updatedVoucher.voucherNumber}) - ${updatedVoucher.notes || ''}`,
        status: 'POSTED',
        lines,
        totalDebit: updatedVoucher.amount,
        totalCredit: updatedVoucher.amount,
        createdAt: new Date().toISOString(),
        postedAt: new Date().toISOString(),
        isAutoGenerated: true,
        sourceModule: updatedVoucher.type === 'RECEIPT' ? 'RECEIPT' : 'PAYMENT',
        sourceId: updatedVoucher.id,
      };

      db.addJournal(journalEntry);
      db.updateVoucher(voucherId, { journalEntryId: journalEntry.id });

      // 6. Recalculate both old and new entity balances to prevent hanging balances
      if (oldEntityId && oldEntityId !== newEntityId) {
        if (oldEntityType === 'CUSTOMER') {
          this.recalculateCustomerBalance(oldEntityId);
        } else {
          this.recalculateSupplierBalance(oldEntityId);
        }
      }
      if (updatedVoucher.entityType === 'CUSTOMER') {
        this.recalculateCustomerBalance(updatedVoucher.entityId);
      } else {
        this.recalculateSupplierBalance(updatedVoucher.entityId);
      }

      return updatedVoucher;
    });
  }

  /**
   * Delete Payment Voucher with reversal
   */
  public static deleteVoucher(voucherId: string): boolean {
    return db.executeTransaction(() => {
      const voucher = db.getVouchers().find((v) => v.id === voucherId);
      if (!voucher) return false;

      if (voucher.status !== 'CANCELLED') {
        this.cancelVoucher(voucherId, 'حذف السند نهائياً');
      }

      const oldJournal = db.getJournals().find((j) => j.id === voucher.journalEntryId || j.sourceId === voucher.id);
      if (oldJournal) {
        db.deleteJournal(oldJournal.id);
      }

      const res = db.deleteVoucher(voucherId);

      if (voucher.entityType === 'CUSTOMER') {
        this.recalculateCustomerBalance(voucher.entityId);
      } else {
        this.recalculateSupplierBalance(voucher.entityId);
      }

      return res;
    });
  }

  /**
   * Update Journal Entry with Debit/Credit Balance Verification and Entity Balances Sync
   */
  public static updateJournal(journalId: string, updatedData: Partial<JournalEntry>): JournalEntry {
    return db.executeTransaction(() => {
      let original = db.getJournals().find((j) =>
        j.id === journalId ||
        (j.id && journalId && j.id.toLowerCase() === journalId.toLowerCase()) ||
        (j.entryNumber && journalId && j.entryNumber.trim().toUpperCase() === journalId.trim().toUpperCase()) ||
        (j.reference && journalId && j.reference.trim() === journalId.trim())
      );

      if (!original) {
        const lines = updatedData.lines || [];
        const tDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
        const tCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
        const newJ: JournalEntry = {
          id: journalId,
          entryNumber: updatedData.entryNumber || `JV-${journalId.slice(-6).toUpperCase()}`,
          date: updatedData.date || new Date().toISOString().split('T')[0],
          reference: updatedData.reference || '',
          description: updatedData.description || 'قيد محاسبي',
          status: updatedData.status || 'POSTED',
          lines,
          totalDebit: Math.round(tDebit * 1000) / 1000,
          totalCredit: Math.round(tCredit * 1000) / 1000,
          createdAt: new Date().toISOString(),
          isAutoGenerated: false,
        };
        db.addJournal(newJ);
        original = newJ;
      }

      const mergedLines = updatedData.lines || original.lines;
      const totalDebit = mergedLines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
      const totalCredit = mergedLines.reduce((s, l) => s + (Number(l.credit) || 0), 0);

      if (Math.abs(totalDebit - totalCredit) > 0.001) {
        throw new Error(`القيد غير متوازن: مجموع المدين (${totalDebit}) لا يساوي مجموع الدائن (${totalCredit})`);
      }

      db.updateJournal(original.id, {
        ...updatedData,
        id: original.id,
        lines: mergedLines,
        totalDebit: Math.round(totalDebit * 1000) / 1000,
        totalCredit: Math.round(totalCredit * 1000) / 1000,
      });

      // Recalculate any entities referenced in lines
      const touchedCustomerIds = new Set<string>();
      const touchedSupplierIds = new Set<string>();

      [...(original.lines || []), ...mergedLines].forEach((line) => {
        if (line.entityType === 'CUSTOMER' && line.entityId) touchedCustomerIds.add(line.entityId);
        if (line.entityType === 'SUPPLIER' && line.entityId) touchedSupplierIds.add(line.entityId);
      });

      touchedCustomerIds.forEach((id) => this.recalculateCustomerBalance(id));
      touchedSupplierIds.forEach((id) => this.recalculateSupplierBalance(id));

      return db.getJournals().find((j) => j.id === original!.id)!;
    });
  }

  /**
   * Delete Journal Entry with Entity Balances Sync
   */
  public static deleteJournal(journalId: string): boolean {
    return db.executeTransaction(() => {
      const journal = db.getJournals().find((j) => j.id === journalId);
      if (!journal) {
        db.deleteJournal(journalId);
        return true;
      }

      const touchedCustomerIds = new Set<string>();
      const touchedSupplierIds = new Set<string>();

      journal.lines.forEach((line) => {
        if (line.entityType === 'CUSTOMER' && line.entityId) touchedCustomerIds.add(line.entityId);
        if (line.entityType === 'SUPPLIER' && line.entityId) touchedSupplierIds.add(line.entityId);
      });

      const success = db.deleteJournal(journalId);

      touchedCustomerIds.forEach((id) => this.recalculateCustomerBalance(id));
      touchedSupplierIds.forEach((id) => this.recalculateSupplierBalance(id));

      return success;
    });
  }

  /**
   * Get Core Executive KPIs (Single-pass aggregated & memoized) isolated per company
   */
  public static getFinancialKPIs(companyId: string): FinancialKPIs {
    if (!companyId || !companyId.trim()) {
      throw new Error('معرّف الشركة (companyId) إلزامي ومطلوب لتقرير المؤشرات المالية');
    }
    const bs = this.getBalanceSheet(companyId);
    const inc = this.getIncomeStatement(companyId);

    // Fetch accounts with balances once
    const accountsWithBalances = this.getAccountsWithBalances(companyId);
    const codeBalanceMap = new Map<string, number>();
    accountsWithBalances.forEach((a) => codeBalanceMap.set(a.code, a.balance || 0));

    const bankBalance = codeBalanceMap.get('1111') || 0;
    const cashBalance = codeBalanceMap.get('1112') || 0;
    const recBalance = codeBalanceMap.get('1120') || 0;
    const payBalance = codeBalanceMap.get('2110') || 0;
    const invBalance = codeBalanceMap.get('1130') || 0;

    const unpaidCount = db
      .getInvoices()
      .filter((inv) => matchesCompany(inv.companyId, companyId) && inv.dueAmount > 0 && inv.status !== 'CANCELLED').length;

    return {
      totalAssets: bs.totalAssets,
      totalLiabilities: bs.totalLiabilities,
      totalEquity: bs.totalEquity,
      totalRevenue: inc.totalRevenue,
      totalExpenses: inc.totalExpenses + inc.totalCogs,
      netProfit: inc.netIncome,
      cashAndBankBalance: bankBalance + cashBalance,
      accountsReceivableTotal: recBalance,
      accountsPayableTotal: payBalance,
      inventoryTotalValue: invBalance,
      unpaidInvoicesCount: unpaidCount,
    };
  }

  /**
   * Process & Post Universal Manufacturing Production Order (أمر تشغيل وتصنيع شامل لكافة الأنشطة)
   * ACID Transactional Transformation of Raw Materials/Components to Finished Goods + Journal Entry
   */
  public static processProductionOrder(orderData: Partial<ProductionOrder>): ProductionOrder {
    return db.executeTransaction(() => {
      const orders = db.getProductionOrders();
      const inventory = db.getInventory();

      const orderNumber = `PRD-2026-${String(orders.length + 1).padStart(3, '0')}`;
      const lineName = orderData.productionLineNameAr || orderData.millLine || 'خط الإنتاج الرئيسي';
      const industryType = orderData.industryType || 'GENERAL_ASSEMBLY';

      const newOrder: ProductionOrder = {
        id: 'prd-' + Math.random().toString(36).substr(2, 9),
        orderNumber,
        date: orderData.date || new Date().toISOString().split('T')[0],
        targetItemId: orderData.targetItemId!,
        targetItemNameAr: orderData.targetItemNameAr!,
        targetSku: orderData.targetSku || '',
        targetQuantity: Number(orderData.targetQuantity) || 1,
        targetUnit: orderData.targetUnit || 'حبة',
        rawMaterials: orderData.rawMaterials || [],
        overheadCost: Number(orderData.overheadCost) || 0,
        totalProductionCost: Number(orderData.totalProductionCost) || 0,
        unitProductionCost: Number(orderData.unitProductionCost) || 0,
        status: orderData.status || 'COMPLETED',
        notes: orderData.notes || 'أمر تشغيل وتصنيع في مركز التصنيع الشامل',
        millLine: lineName,
        productionLineId: orderData.productionLineId,
        productionLineNameAr: lineName,
        industryType,
        categoryGroup: orderData.categoryGroup,
        operatorName: orderData.operatorName || 'مشرف خط الإنتاج',
        scrapQuantity: Number(orderData.scrapQuantity) || 0,
        scrapPercentage: Number(orderData.scrapPercentage) || 0,
        scrapReason: orderData.scrapReason,
        byProducts: orderData.byProducts || [],
        qualityInspection: orderData.qualityInspection,
        routingSteps: orderData.routingSteps || [],
        createdAt: new Date().toISOString(),
        completedAt: orderData.status === 'COMPLETED' ? new Date().toISOString() : undefined,
      };

      if (newOrder.status === 'COMPLETED') {
        // 1. Deduct raw materials / components from stock
        newOrder.rawMaterials.forEach((raw) => {
          const item = inventory.find((i) => i.id === raw.itemId);
          if (item) {
            db.updateInventoryItem(item.id, {
              quantityOnHand: Math.max(0, item.quantityOnHand - raw.quantityRequired),
            });
          }
        });

        // 2. Increase finished goods in stock & optionally update unit cost
        const targetItem = inventory.find((i) => i.id === newOrder.targetItemId);
        if (targetItem) {
          const updates: any = {
            quantityOnHand: targetItem.quantityOnHand + newOrder.targetQuantity,
          };
          if (newOrder.unitProductionCost > 0) {
            updates.costPrice = newOrder.unitProductionCost;
          }
          db.updateInventoryItem(targetItem.id, updates);
        }

        // 3. Handle secondary / by-products if provided
        if (newOrder.byProducts && newOrder.byProducts.length > 0) {
          newOrder.byProducts.forEach((bp) => {
            if (bp.itemId) {
              const bpItem = inventory.find((i) => i.id === bp.itemId);
              if (bpItem) {
                db.updateInventoryItem(bpItem.id, {
                  quantityOnHand: bpItem.quantityOnHand + bp.quantity,
                });
              }
            }
          });
        }

        // 4. Post double-entry balanced industrial journal
        const totalDebit = newOrder.totalProductionCost;
        const rawCost = newOrder.rawMaterials.reduce((s, r) => s + r.totalCost, 0);

        const jLines = [
          {
            id: 'jl-1',
            accountId: 'acc-1130',
            accountCode: '1130',
            accountNameAr: 'مخزون البضائع والمنتجات التامة',
            debit: totalDebit,
            credit: 0,
            memo: `إنتاج تام - أمر تصنيع رقم ${newOrder.orderNumber} (${newOrder.targetItemNameAr}) - ${lineName}`,
          },
          {
            id: 'jl-2',
            accountId: 'acc-1130',
            accountCode: '1130',
            accountNameAr: 'مخزون المواد الأولية ومكونات التصنيع',
            debit: 0,
            credit: rawCost,
            memo: `استهلاك مكونات وخامات - أمر تصنيع ${newOrder.orderNumber}`,
          },
        ];

        if (newOrder.overheadCost > 0) {
          jLines.push({
            id: 'jl-3',
            accountId: 'acc-5100',
            accountCode: '5100',
            accountNameAr: 'تكاليف تشغيل وصناعية وعمالة مباشرة',
            debit: 0,
            credit: newOrder.overheadCost,
            memo: `تكاليف تشغيل وصناعية - أمر تصنيع رقم ${newOrder.orderNumber}`,
          });
        }

        const jEntry: JournalEntry = {
          id: 'jv-' + Math.random().toString(36).substr(2, 9),
          entryNumber: `JV-${newOrder.orderNumber}`,
          date: newOrder.date,
          reference: newOrder.orderNumber,
          description: `قيد تكاليف تشغيل وتصنيع لأمر رقم (${newOrder.orderNumber}) - ${newOrder.targetItemNameAr} [${lineName}]`,
          status: 'POSTED',
          lines: jLines,
          totalDebit,
          totalCredit: totalDebit,
          createdAt: new Date().toISOString(),
          postedAt: new Date().toISOString(),
          isAutoGenerated: true,
          sourceModule: 'INVENTORY',
          sourceId: newOrder.id,
        };

        db.addJournal(jEntry);
        newOrder.journalEntryId = jEntry.id;
      }

      db.addProductionOrder(newOrder);
      return newOrder;
    });
  }
}
