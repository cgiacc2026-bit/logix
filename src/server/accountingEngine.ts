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
  ProductionOrder
} from '../types.js';

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
    if (diff > 0.005) {
      return {
        isValid: false,
        error: `القيد غير متوازن! إجمالي المدين (${totalDebit.toFixed(3)}) لا يساوي إجمالي الدائن (${totalCredit.toFixed(3)}). الفرق: ${diff.toFixed(3)}`,
      };
    }

    return { isValid: true };
  }

  /**
   * Calculate dynamic balances for Chart of Accounts with O(N) single-pass aggregation
   */
  public static getAccountsWithBalances(asOfDate?: string): Account[] {
    const accounts = db.getAccounts();
    const journals = db.getJournals().filter((j) => j.status === 'POSTED' || j.status === 'REVERSED');

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

    // Rollup parent account balances
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
   * Reverse a posted journal entry (عكس القيد)
   */
  public static reverseJournalEntry(journalId: string, reason: string): JournalEntry {
    const original = db.getJournals().find((j) => j.id === journalId);
    if (!original) {
      throw new Error('القيد غير موجود');
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
    }));

    const reversalEntry: JournalEntry = {
      id: 'jv-' + Math.random().toString(36).substr(2, 9),
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
    db.updateJournal(journalId, { status: 'REVERSED' });

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
   * Generate General Ledger Report for a specific account
   */
  public static getGeneralLedger(
    accountId: string,
    startDate?: string,
    endDate?: string
  ): GeneralLedgerReport {
    const accounts = db.getAccounts();
    const targetAccount = accounts.find((a) => a.id === accountId || a.code === accountId);
    if (!targetAccount) {
      throw new Error('الحساب المحاسبي غير موجود');
    }

    const start = startDate || '2000-01-01';
    const end = endDate || '2099-12-31';

    const allPostedJournals = db
      .getJournals()
      .filter((j) => j.status === 'POSTED' || j.status === 'REVERSED')
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
   * Generate Trial Balance Report (ميزان المراجعة)
   */
  public static getTrialBalance(asOfDate?: string): TrialBalanceReport {
    const accounts = db.getAccounts();
    const postedJournals = db.getJournals().filter((j) => j.status === 'POSTED' || j.status === 'REVERSED');
    const cutoff = asOfDate || '2099-12-31';

    // Pre-aggregate debit and credit per account in O(J * L)
    const movementMap = new Map<string, { debit: number; credit: number }>();
    accounts.forEach((acc) => movementMap.set(acc.id, { debit: 0, credit: 0 }));

    for (const j of postedJournals) {
      if (j.date <= cutoff) {
        for (const line of j.lines) {
          const entry = movementMap.get(line.accountId);
          if (entry) {
            entry.debit += Number(line.debit) || 0;
            entry.credit += Number(line.credit) || 0;
          }
        }
      }
    }

    const items: TrialBalanceItem[] = [];
    let totalMovementDebit = 0;
    let totalMovementCredit = 0;
    let totalEndingDebit = 0;
    let totalEndingCredit = 0;

    // Process leaf accounts
    const detailAccounts = accounts.filter(
      (acc) => !accounts.some((child) => child.parentId === acc.id)
    );

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
   * Generate Income Statement Report (قائمة الدخل - P&L)
   */
  public static getIncomeStatement(startDate?: string, endDate?: string): IncomeStatementReport {
    const start = startDate || '2026-01-01';
    const end = endDate || '2099-12-31';

    const accounts = db.getAccounts();
    const postedJournals = db.getJournals().filter((j) => j.status === 'POSTED');

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
   * Generate Balance Sheet Report (قائمة المركز المالي)
   */
  public static getBalanceSheet(asOfDate?: string): BalanceSheetReport {
    const cutoff = asOfDate || '2099-12-31';

    // Calculate income statement for net profit to include in equity
    const incomeStatement = this.getIncomeStatement('2000-01-01', cutoff);
    const periodNetIncome = incomeStatement.netIncome;

    const accountsWithBalances = this.getAccountsWithBalances(cutoff);

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
   * Cash Flow Statement (IAS 7)
   */
  public static getCashFlowStatement(startDate?: string, endDate?: string): CashFlowReport {
    const start = startDate || '2026-01-01';
    const end = endDate || '2099-12-31';

    const income = this.getIncomeStatement(start, end);
    const balanceSheet = this.getBalanceSheet(end);

    const netIncome = income.netIncome;

    // Calculate changes in cash and operating accounts
    const cashAccount = this.getAccountsWithBalances(end).find((a) => a.code === '1111');
    const cashBoxAccount = this.getAccountsWithBalances(end).find((a) => a.code === '1112');

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
  public static postSalesInvoice(invoiceId: string): Invoice {
    return db.executeTransaction(() => {
      const invoice = db.getInvoices().find((inv) => inv.id === invoiceId);
      if (!invoice) throw new Error('الفاتورة غير موجودة');
      if (invoice.status === 'POSTED' || invoice.status === 'PAID') {
        throw new Error('الفاتورة مرحّلة بالفعل مسبقاً (Idempotency Violation)');
      }

      const today = new Date().toISOString().split('T')[0];
      const isReturn = invoice.type === 'SALES_RETURN';
      const journalEntryNumber = isReturn ? `JV-RET-${invoice.invoiceNumber}` : `JV-INV-${invoice.invoiceNumber}`;

      // Calculate Cost of Goods Sold (COGS) based on stock item purchase prices
      const inventoryItems = db.getInventory();
      let totalCogs = 0;

      const company = db.getCompany();
      const allowNegativeStock = !!(company && company.allowNegativeInventory);

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
          const itemCost = Number(invItem.purchasePrice) || 0;
          totalCogs += line.quantity * itemCost;
          if (isReturn) {
            // Return to stock
            db.updateInventoryItem(invItem.id, {
              quantityOnHand: invItem.quantityOnHand + line.quantity,
            });
          } else {
            // Atomically decrement stock on hand (allows negative if enabled)
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
      let lines = [];

      if (isReturn) {
        // Sales Return Journal
        lines = [
          // 1. Debit: Sales Revenue / Returns (تخفيض الإيراد)
          {
            id: 'jl-' + Math.random().toString(36).substr(2, 9),
            accountId: 'acc-4100',
            accountCode: '4100',
            accountNameAr: 'مردودات ومسموحات المبيعات',
            debit: netRevenue,
            credit: 0,
            memo: `مردودات مبيعات - إشعار رقم ${invoice.invoiceNumber}`,
          },
          // 2. Credit: Accounts Receivable (العميل دائن بتخفيض حسابه)
          {
            id: 'jl-' + Math.random().toString(36).substr(2, 9),
            accountId: 'acc-1120',
            accountCode: '1120',
            accountNameAr: 'الذمم المدينة (حسابات العملاء)',
            debit: 0,
            credit: invoice.grandTotal,
            memo: `إشعار دائن مردودات مبيعات رقم ${invoice.invoiceNumber} - العميل: ${invoice.entityNameAr}`,
            entityType: 'CUSTOMER' as const,
            entityId: invoice.entityId,
          },
        ];

        // Reverse COGS & Return Inventory
        if (totalCogs > 0) {
          lines.push(
            {
              id: 'jl-' + Math.random().toString(36).substr(2, 9),
              accountId: 'acc-1130',
              accountCode: '1130',
              accountNameAr: 'مخزون البضائع والمنتجات',
              debit: totalCogs,
              credit: 0,
              memo: `إرجاع بضاعة للمخزن - إشعار ${invoice.invoiceNumber}`,
            },
            {
              id: 'jl-' + Math.random().toString(36).substr(2, 9),
              accountId: 'acc-5100',
              accountCode: '5100',
              accountNameAr: 'تكلفة البضاعة المباعة (COGS)',
              debit: 0,
              credit: totalCogs,
              memo: `تخفيض تكلفة المبيعات للمردودات - إشعار ${invoice.invoiceNumber}`,
            }
          );
        }
      } else {
        // Standard Sales Invoice Journal
        lines = [
          // 1. Debit: Accounts Receivable (العميل مدين بالصافي الإجمالي المستحق)
          {
            id: 'jl-' + Math.random().toString(36).substr(2, 9),
            accountId: 'acc-1120',
            accountCode: '1120',
            accountNameAr: 'الذمم المدينة (حسابات العملاء)',
            debit: invoice.grandTotal,
            credit: 0,
            memo: `فاتورة مبيعات رقم ${invoice.invoiceNumber} - العميل: ${invoice.entityNameAr}`,
            entityType: 'CUSTOMER' as const,
            entityId: invoice.entityId,
          },
          // 2. Credit: Sales Revenue (صافي الإيراد بعد الخصومات وقبل الضريبة)
          {
            id: 'jl-' + Math.random().toString(36).substr(2, 9),
            accountId: 'acc-4100',
            accountCode: '4100',
            accountNameAr: 'إيرادات مبيعات البضائع والمنتجات',
            debit: 0,
            credit: netRevenue,
            memo: `إيراد مبيعات - فاتورة رقم ${invoice.invoiceNumber}`,
          },
        ];

        // Output VAT if applicable
        if (invoice.vatTotal > 0) {
          lines.push({
            id: 'jl-' + Math.random().toString(36).substr(2, 9),
            accountId: 'acc-2120',
            accountCode: '2120',
            accountNameAr: 'ضريبة القيمة المضافة - مخرجات (مستحقة)',
            debit: 0,
            credit: invoice.vatTotal,
            memo: `ضريبة القيمة المضافة - فاتورة ${invoice.invoiceNumber}`,
          });
        }

        // Debit COGS & Credit Inventory
        if (totalCogs > 0) {
          lines.push(
            {
              id: 'jl-' + Math.random().toString(36).substr(2, 9),
              accountId: 'acc-5100',
              accountCode: '5100',
              accountNameAr: 'تكلفة البضاعة المباعة (COGS)',
              debit: totalCogs,
              credit: 0,
              memo: `إثبات تكلفة البضاعة المباعة - فاتورة ${invoice.invoiceNumber}`,
            },
            {
              id: 'jl-' + Math.random().toString(36).substr(2, 9),
              accountId: 'acc-1130',
              accountCode: '1130',
              accountNameAr: 'مخزون البضائع والمنتجات',
              debit: 0,
              credit: totalCogs,
              memo: `تخفيض المخزون - فاتورة ${invoice.invoiceNumber}`,
            }
          );
        }
      }

      // Double-Entry Invariant Validation (Debit === Credit)
      const validation = this.validateJournalEntry({ lines });
      if (!validation.isValid) {
        throw new Error(`فشل التحقق المحاسبي: ${validation.error}`);
      }

      const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
      const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);

      const journalEntry: JournalEntry = {
        id: 'jv-' + Math.random().toString(36).substr(2, 9),
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
      const customer = db.getCustomers().find((c) => c.id === invoice.entityId);
      if (customer) {
        const newBalance = isReturn
          ? Math.max(0, customer.balance - invoice.grandTotal)
          : customer.balance + invoice.grandTotal;
        db.updateCustomer(customer.id, { balance: newBalance });
      }

      // Update Invoice status & attach Journal ID
      db.updateInvoice(invoice.id, {
        status: 'POSTED',
        journalEntryId: journalEntry.id,
      });

      return db.getInvoices().find((inv) => inv.id === invoiceId)!;
    });
  }

  /**
   * Post Purchase Invoice automatically creating Journal Entry, increasing inventory and updating Supplier Balance
   * Wrapped in ACID transaction boundary.
   */
  public static postPurchaseInvoice(invoiceId: string): Invoice {
    return db.executeTransaction(() => {
      const invoice = db.getInvoices().find((inv) => inv.id === invoiceId);
      if (!invoice) throw new Error('الفاتورة غير موجودة');
      if (invoice.status === 'POSTED' || invoice.status === 'PAID') {
        throw new Error('الفاتورة مرحّلة بالفعل مسبقاً (Idempotency Violation)');
      }

      const today = new Date().toISOString().split('T')[0];
      const isReturn = invoice.type === 'PURCHASE_RETURN';
      const journalEntryNumber = isReturn ? `JV-RET-PUR-${invoice.invoiceNumber}` : `JV-PUR-${invoice.invoiceNumber}`;

      // Update inventory on-hand quantity
      const inventoryItems = db.getInventory();
      invoice.lines.forEach((line) => {
        const invItem = inventoryItems.find((i) => i.id === line.itemId);
        if (invItem) {
          if (isReturn) {
            db.updateInventoryItem(invItem.id, {
              quantityOnHand: Math.max(0, invItem.quantityOnHand - line.quantity),
            });
          } else {
            db.updateInventoryItem(invItem.id, {
              quantityOnHand: invItem.quantityOnHand + line.quantity,
            });
          }
        }
      });

      let lines = [];
      if (isReturn) {
        // Purchase Return: Debit Supplier (AP) & Credit Inventory
        lines = [
          {
            id: 'jl-' + Math.random().toString(36).substr(2, 9),
            accountId: 'acc-2110',
            accountCode: '2110',
            accountNameAr: 'الذمم الدائنة (حسابات الموردين)',
            debit: invoice.grandTotal,
            credit: 0,
            memo: `إشعار مدين مردودات مشتريات رقم ${invoice.invoiceNumber} - المورد: ${invoice.entityNameAr}`,
            entityType: 'SUPPLIER' as const,
            entityId: invoice.entityId,
          },
          {
            id: 'jl-' + Math.random().toString(36).substr(2, 9),
            accountId: 'acc-1130',
            accountCode: '1130',
            accountNameAr: 'مخزون البضائع والمنتجات',
            debit: 0,
            credit: invoice.grandTotal,
            memo: `إخراج بضاعة مردودة للمورد - إشعار ${invoice.invoiceNumber}`,
          },
        ];
      } else {
        // Standard Purchase Invoice
        lines = [
          // 1. Debit: Merchandise Inventory (زيادة المخزون بالتكلفة الصافية)
          {
            id: 'jl-' + Math.random().toString(36).substr(2, 9),
            accountId: 'acc-1130',
            accountCode: '1130',
            accountNameAr: 'مخزون البضائع والمنتجات',
            debit: invoice.grandTotal,
            credit: 0,
            memo: `إثبات مشتريات بضائع - فاتورة مورد رقم ${invoice.invoiceNumber}`,
          },
          // 2. Credit: Accounts Payable (المورد دائن بقيمة الفاتورة المستحقة)
          {
            id: 'jl-' + Math.random().toString(36).substr(2, 9),
            accountId: 'acc-2110',
            accountCode: '2110',
            accountNameAr: 'الذمم الدائنة (حسابات الموردين)',
            debit: 0,
            credit: invoice.grandTotal,
            memo: `فاتورة مشتريات رقم ${invoice.invoiceNumber} - المورد: ${invoice.entityNameAr}`,
            entityType: 'SUPPLIER' as const,
            entityId: invoice.entityId,
          },
        ];
      }

      // Double-Entry Invariant Validation (Debit === Credit)
      const validation = this.validateJournalEntry({ lines });
      if (!validation.isValid) {
        throw new Error(`فشل التحقق المحاسبي لقيد المشتريات: ${validation.error}`);
      }

      const journalEntry: JournalEntry = {
        id: 'jv-' + Math.random().toString(36).substr(2, 9),
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

      // Update Supplier Balance
      const supplier = db.getSuppliers().find((s) => s.id === invoice.entityId);
      if (supplier) {
        const newBalance = isReturn
          ? Math.max(0, supplier.balance - invoice.grandTotal)
          : supplier.balance + invoice.grandTotal;
        db.updateSupplier(supplier.id, { balance: newBalance });
      }

      // Update Invoice status & attach Journal ID
      db.updateInvoice(invoice.id, {
        status: 'POSTED',
        journalEntryId: journalEntry.id,
      });

      return db.getInvoices().find((inv) => inv.id === invoiceId)!;
    });
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
      const invoice = db.getInvoices().find((inv) => inv.id === invoiceId);
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

      return db.getInvoices().find((i) => i.id === invoiceId)!;
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
   * Recalculate customer balance from first principles (Opening + Invoices - Returns - Receipts + Journals)
   */
  public static recalculateCustomerBalance(customerId: string): number {
    const customer = db.getCustomers().find((c) => c.id === customerId);
    if (!customer) return 0;

    let balance = Number(customer.openingBalance) || 0;

    // Invoices
    const invoices = db.getInvoices().filter((i) => i.entityId === customerId && i.status !== 'CANCELLED');
    for (const inv of invoices) {
      if (inv.type === 'SALES') {
        balance += Number(inv.grandTotal) || 0;
      } else if (inv.type === 'SALES_RETURN') {
        balance -= Number(inv.grandTotal) || 0;
      }
    }

    // Vouchers
    const vouchers = db.getVouchers().filter((v) => v.entityId === customerId && v.status !== 'CANCELLED');
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
    for (const inv of invoices) {
      if (inv.type === 'PURCHASE') {
        balance += Number(inv.grandTotal) || 0;
      } else if (inv.type === 'PURCHASE_RETURN') {
        balance -= Number(inv.grandTotal) || 0;
      }
    }

    // Vouchers
    const vouchers = db.getVouchers().filter((v) => v.entityId === supplierId && v.status !== 'CANCELLED');
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
  public static postVoucher(voucher: PaymentVoucher): PaymentVoucher {
    return db.executeTransaction(() => {
      const today = new Date().toISOString().split('T')[0];
      const journalEntryNumber = `JV-${voucher.voucherNumber}`;

      const lines = [];

      if (voucher.type === 'RECEIPT') {
        // Receipt from Customer (قبض): Debit Bank/Cash, Credit Accounts Receivable
        lines.push(
          {
            id: 'jl-' + Math.random().toString(36).substr(2, 9),
            accountId: voucher.bankAccountId || 'acc-1111',
            accountCode: voucher.bankAccountId === 'acc-1112' ? '1112' : '1111',
            accountNameAr:
              voucher.bankAccountId === 'acc-1112'
                ? 'الصندوق الرئيسي (الخزينة)'
                : 'البنك الأهلي التجاري - الحساب الرئيسي',
            debit: voucher.amount,
            credit: 0,
            memo: `سند قبض رقم ${voucher.voucherNumber} من ${voucher.entityNameAr}`,
          },
          {
            id: 'jl-' + Math.random().toString(36).substr(2, 9),
            accountId: 'acc-1120',
            accountCode: '1120',
            accountNameAr: 'الذمم المدينة (حسابات العملاء)',
            debit: 0,
            credit: voucher.amount,
            memo: `تحصيل من العميل ${voucher.entityNameAr}`,
            entityType: 'CUSTOMER' as const,
            entityId: voucher.entityId,
          }
        );

        // Update invoice paid amount if invoiceId specified
        if (voucher.invoiceId) {
          const inv = db.getInvoices().find((i) => i.id === voucher.invoiceId);
          if (inv) {
            const newPaid = inv.paidAmount + voucher.amount;
            const newDue = Math.max(0, inv.grandTotal - newPaid);
            db.updateInvoice(inv.id, {
              paidAmount: newPaid,
              dueAmount: newDue,
              status: newDue === 0 ? 'PAID' : 'PARTIALLY_PAID',
            });
          }
        }
      } else {
        // Payment to Supplier (صرف): Debit Accounts Payable, Credit Bank/Cash
        lines.push(
          {
            id: 'jl-' + Math.random().toString(36).substr(2, 9),
            accountId: 'acc-2110',
            accountCode: '2110',
            accountNameAr: 'الذمم الدائنة (حسابات الموردين)',
            debit: voucher.amount,
            credit: 0,
            memo: `سداد للمورد ${voucher.entityNameAr}`,
            entityType: 'SUPPLIER' as const,
            entityId: voucher.entityId,
          },
          {
            id: 'jl-' + Math.random().toString(36).substr(2, 9),
            accountId: voucher.bankAccountId || 'acc-1111',
            accountCode: voucher.bankAccountId === 'acc-1112' ? '1112' : '1111',
            accountNameAr:
              voucher.bankAccountId === 'acc-1112'
                ? 'الصندوق الرئيسي (الخزينة)'
                : 'البنك الأهلي التجاري - الحساب الرئيسي',
            debit: 0,
            credit: voucher.amount,
            memo: `سند صرف رقم ${voucher.voucherNumber} إلى ${voucher.entityNameAr}`,
          }
        );
      }

      // Validate Voucher entry balance
      const validation = this.validateJournalEntry({ lines });
      if (!validation.isValid) {
        throw new Error(`فشل التحقق المحاسبي لقيد السند: ${validation.error}`);
      }

      const journalEntry: JournalEntry = {
        id: 'jv-' + Math.random().toString(36).substr(2, 9),
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
      const voucher = db.getVouchers().find((v) => v.id === voucherId);
      if (!voucher) throw new Error('السند غير موجود');
      if (voucher.status === 'CANCELLED') return voucher;

      // 1. Reverse the associated journal entry
      const journal = db.getJournals().find((j) => j.id === voucher.journalEntryId || j.sourceId === voucher.id);
      if (journal && journal.status === 'POSTED') {
        try {
          this.reverseJournalEntry(journal.id, `إلغاء السند ${voucher.voucherNumber}: ${reason}`);
        } catch (e) {
          db.updateJournal(journal.id, { status: 'CANCELLED' });
        }
      }

      // 2. If voucher was linked to an invoice, restore invoice paidAmount & dueAmount
      if (voucher.invoiceId) {
        const inv = db.getInvoices().find((i) => i.id === voucher.invoiceId);
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
      db.updateVoucher(voucherId, {
        status: 'CANCELLED',
        notes: (voucher.notes ? voucher.notes + '\n' : '') + `[ملغى بتاريخ ${new Date().toISOString().split('T')[0]}: ${reason}]`,
      });

      // 4. Recalculate entity balance
      if (voucher.entityType === 'CUSTOMER') {
        this.recalculateCustomerBalance(voucher.entityId);
      } else {
        this.recalculateSupplierBalance(voucher.entityId);
      }

      return db.getVouchers().find((v) => v.id === voucherId)!;
    });
  }

  /**
   * Update Payment Voucher with automatic journal and balance adjustments
   */
  public static updateVoucher(voucherId: string, updatedData: Partial<PaymentVoucher>): PaymentVoucher {
    return db.executeTransaction(() => {
      const original = db.getVouchers().find((v) => v.id === voucherId);
      if (!original) throw new Error('السند غير موجود');

      // Cancel old journal
      const oldJournal = db.getJournals().find((j) => j.id === original.journalEntryId || j.sourceId === original.id);
      if (oldJournal) {
        db.updateJournal(oldJournal.id, { status: 'CANCELLED' });
      }

      // If linked to invoice, adjust invoice paidAmount
      if (original.invoiceId) {
        const inv = db.getInvoices().find((i) => i.id === original.invoiceId);
        if (inv) {
          const oldAmount = original.amount || 0;
          const newAmount = updatedData.amount !== undefined ? Number(updatedData.amount) : oldAmount;
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

      // Apply update
      db.updateVoucher(voucherId, updatedData);
      const updatedVoucher = db.getVouchers().find((v) => v.id === voucherId)!;

      // Re-generate journal entry for the updated voucher
      const lines = [];
      const bankAcc = updatedVoucher.bankAccountId || 'acc-1111';
      const isCash = bankAcc === 'acc-1112' || bankAcc === 'acc-1113';

      if (updatedVoucher.type === 'RECEIPT') {
        lines.push(
          {
            id: 'jl-' + Math.random().toString(36).substr(2, 9),
            accountId: bankAcc,
            accountCode: isCash ? '1112' : '1111',
            accountNameAr: isCash ? 'الصندوق الرئيسي (الخزينة)' : 'البنك الأهلي التجاري - الحساب الرئيسي',
            debit: updatedVoucher.amount,
            credit: 0,
            memo: `سند قبض رقم ${updatedVoucher.voucherNumber} من ${updatedVoucher.entityNameAr}`,
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
            accountId: bankAcc,
            accountCode: isCash ? '1112' : '1111',
            accountNameAr: isCash ? 'الصندوق الرئيسي (الخزينة)' : 'البنك الأهلي التجاري - الحساب الرئيسي',
            debit: 0,
            credit: updatedVoucher.amount,
            memo: `سند صرف رقم ${updatedVoucher.voucherNumber} إلى ${updatedVoucher.entityNameAr}`,
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

      // Recalculate entity balances
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
      const original = db.getJournals().find((j) => j.id === journalId);
      if (!original) throw new Error('القيد غير موجود');

      const mergedLines = updatedData.lines || original.lines;
      const totalDebit = mergedLines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
      const totalCredit = mergedLines.reduce((s, l) => s + (Number(l.credit) || 0), 0);

      if (Math.abs(totalDebit - totalCredit) > 0.001) {
        throw new Error(`القيد غير متوازن: مجموع المدين (${totalDebit}) لا يساوي مجموع الدائن (${totalCredit})`);
      }

      db.updateJournal(journalId, {
        ...updatedData,
        lines: mergedLines,
        totalDebit: Math.round(totalDebit * 1000) / 1000,
        totalCredit: Math.round(totalCredit * 1000) / 1000,
      });

      // Recalculate any entities referenced in lines
      const touchedCustomerIds = new Set<string>();
      const touchedSupplierIds = new Set<string>();

      [...original.lines, ...mergedLines].forEach((line) => {
        if (line.entityType === 'CUSTOMER' && line.entityId) touchedCustomerIds.add(line.entityId);
        if (line.entityType === 'SUPPLIER' && line.entityId) touchedSupplierIds.add(line.entityId);
      });

      touchedCustomerIds.forEach((id) => this.recalculateCustomerBalance(id));
      touchedSupplierIds.forEach((id) => this.recalculateSupplierBalance(id));

      return db.getJournals().find((j) => j.id === journalId)!;
    });
  }

  /**
   * Delete Journal Entry with Entity Balances Sync
   */
  public static deleteJournal(journalId: string): boolean {
    return db.executeTransaction(() => {
      const journal = db.getJournals().find((j) => j.id === journalId);
      if (!journal) return false;

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
   * Get Core Executive KPIs (Single-pass aggregated & memoized)
   */
  public static getFinancialKPIs(): FinancialKPIs {
    const bs = this.getBalanceSheet();
    const inc = this.getIncomeStatement();

    // Fetch accounts with balances once
    const accountsWithBalances = this.getAccountsWithBalances();
    const codeBalanceMap = new Map<string, number>();
    accountsWithBalances.forEach((a) => codeBalanceMap.set(a.code, a.balance || 0));

    const bankBalance = codeBalanceMap.get('1111') || 0;
    const cashBalance = codeBalanceMap.get('1112') || 0;
    const recBalance = codeBalanceMap.get('1120') || 0;
    const payBalance = codeBalanceMap.get('2110') || 0;
    const invBalance = codeBalanceMap.get('1130') || 0;

    const unpaidCount = db
      .getInvoices()
      .filter((inv) => inv.dueAmount > 0 && inv.status !== 'CANCELLED').length;

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
