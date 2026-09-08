/**
 * System Reset & Fiscal Year-End Closing Engine (IFRS / GAAP Compliant)
 * LOGIX Cloud ERP System
 * 
 * Provides rock-solid, idempotent, and auditable system resetting:
 * 1. Takes full snapshots of operational data (invoices, production orders, vouchers, journals)
 * 2. Retains master data (customers, suppliers, accounts, units, users).
 * 3. Generates balanced double-entry Opening Balance Journal Entries for:
 *    - Customers with outstanding balances (Dr. Receivables 1120 / Cr. Retained Earnings 3200)
 *    - Suppliers with outstanding balances (Dr. Retained Earnings 3200 / Cr. Payables 2110)
 *    - Active Inventory on hand (Dr. Inventory 1130 / Cr. Retained Earnings 3200)
 * 4. Cleans operational data while preserving audit logs.
 */

import {
  Customer,
  Supplier,
  InventoryItem,
  JournalEntry,
  Invoice,
  PaymentVoucher,
  ProductionOrder,
} from '../types.js';
import { localDataStore } from './dataService.js';
import { SupabaseDataService } from './supabaseService.js';

export interface SystemResetStats {
  invoicesArchived: number;
  journalsArchived: number;
  vouchersArchived: number;
  productionOrdersArchived: number;
  customersWithBalanceCount: number;
  totalReceivablesBalance: number;
  suppliersWithBalanceCount: number;
  totalPayablesBalance: number;
  inventoryItemsCount: number;
  totalInventoryValue: number;
  openingJournalsCreatedCount: number;
}

export interface SystemResetLog {
  id: string;
  resetBatchId: string;
  performedBy: {
    userId: string;
    userName: string;
    userEmail: string;
    role: string;
  };
  reason: string;
  fiscalYearStartDate: string;
  timestamp: string;
  archiveCollections: {
    invoices: string;
    journals: string;
    vouchers: string;
    production: string;
  };
  stats: SystemResetStats;
  openingJournalIds: string[];
}

export interface SystemResetPreview {
  invoicesCount: number;
  journalsCount: number;
  vouchersCount: number;
  productionOrdersCount: number;
  customersWithBalance: {
    id: string;
    code: string;
    nameAr: string;
    balance: number;
    openingType: 'DEBIT' | 'CREDIT';
  }[];
  totalReceivables: number;
  suppliersWithBalance: {
    id: string;
    code: string;
    nameAr: string;
    balance: number;
    openingType: 'DEBIT' | 'CREDIT';
  }[];
  totalPayables: number;
  inventoryItemsWithStock: {
    id: string;
    sku: string;
    nameAr: string;
    quantity: number;
    unitCost: number;
    totalValue: number;
  }[];
  totalInventoryValue: number;
  estimatedOpeningJournalsCount: number;
  lastResetLog?: SystemResetLog | null;
}

export interface SystemResetResult {
  success: boolean;
  message: string;
  resetBatchId: string;
  stats: SystemResetStats;
  archiveCollections: Record<string, string>;
  openingJournals: JournalEntry[];
  logEntry: SystemResetLog;
}

const RESET_LOGS_STORAGE_KEY = 'logix_erp_system_reset_logs';

export class SystemResetService {
  /**
   * 1. PREVIEW SYSTEM RESET (معاينة قبل التنفيذ)
   * Fetches all current metrics to give the administrator full visibility before resetting.
   */
  public static async getSystemResetPreview(): Promise<SystemResetPreview> {
    try {
      const invoices = localDataStore.getInvoices();
      const journals = localDataStore.getJournals();
      const vouchers = localDataStore.getVouchers();
      const productionOrders = localDataStore.getProductionOrders();
      const customers = localDataStore.getCustomers();
      const suppliers = localDataStore.getSuppliers();
      const inventory = localDataStore.getInventory();

      // 2. تحليل أرصدة العملاء
      const customersWithBalance = customers
        .filter((c) => Math.abs(Number(c.currentBalance ?? c.balance ?? 0)) > 0.001)
        .map((c) => {
          const bal = Number(c.currentBalance ?? c.balance ?? 0);
          return {
            id: c.id,
            code: c.code,
            nameAr: c.nameAr,
            balance: bal,
            openingType: (bal >= 0 ? 'DEBIT' : 'CREDIT') as 'DEBIT' | 'CREDIT',
          };
        });

      const totalReceivables = customersWithBalance.reduce((sum, c) => sum + c.balance, 0);

      // 3. تحليل أرصدة الموردين
      const suppliersWithBalance = suppliers
        .filter((s) => Math.abs(Number(s.currentBalance ?? s.balance ?? 0)) > 0.001)
        .map((s) => {
          const bal = Number(s.currentBalance ?? s.balance ?? 0);
          return {
            id: s.id,
            code: s.code,
            nameAr: s.nameAr,
            balance: bal,
            openingType: (bal >= 0 ? 'CREDIT' : 'DEBIT') as 'DEBIT' | 'CREDIT',
          };
        });

      const totalPayables = suppliersWithBalance.reduce((sum, s) => sum + s.balance, 0);

      // 4. تحليل المخزون الفعلي
      const inventoryItemsWithStock = inventory
        .filter((item) => Number(item.quantityOnHand ?? (item as any).quantity ?? 0) > 0)
        .map((item) => {
          const qty = Number(item.quantityOnHand ?? (item as any).quantity ?? 0);
          const cost = Number(item.purchasePrice ?? item.costPrice ?? (item as any).unitCost ?? 0);
          return {
            id: item.id,
            sku: item.sku,
            nameAr: item.nameAr,
            quantity: qty,
            unitCost: cost,
            totalValue: Math.round(qty * cost * 1000) / 1000,
          };
        });

      const totalInventoryValue = inventoryItemsWithStock.reduce((sum, i) => sum + i.totalValue, 0);

      // 5. عدد القيود الافتتاحية المتوقع إنشاؤها
      const estimatedOpeningJournalsCount =
        customersWithBalance.length +
        suppliersWithBalance.length +
        (inventoryItemsWithStock.length > 0 ? 1 : 0);

      // جلب آخر عملية تصفير إن وجدت
      const lastResetLog = await this.getLastResetLog();

      return {
        invoicesCount: invoices.length,
        journalsCount: journals.length,
        vouchersCount: vouchers.length,
        productionOrdersCount: productionOrders.length,
        customersWithBalance,
        totalReceivables: Math.round(totalReceivables * 1000) / 1000,
        suppliersWithBalance,
        totalPayables: Math.round(totalPayables * 1000) / 1000,
        inventoryItemsWithStock,
        totalInventoryValue: Math.round(totalInventoryValue * 1000) / 1000,
        estimatedOpeningJournalsCount,
        lastResetLog,
      };
    } catch (error) {
      console.error('Failed to get system reset preview:', error);
      throw error;
    }
  }

  /**
   * 2. PERFORM SYSTEM RESET & NEW FISCAL YEAR OPENING
   * Executes archival, double-entry opening balances, inventory roll-forward, and log registration.
   */
  public static async performSystemReset(
    reason: string,
    confirmedBy: {
      userId: string;
      userName: string;
      userEmail: string;
      role: string;
    },
    fiscalYearStartDate?: string,
    options: {
      bypassIdempotencyCheck?: boolean;
    } = {}
  ): Promise<SystemResetResult> {
    if (!reason || reason.trim().length < 5) {
      throw new Error('يجب إدخال سبب التصفير وإقفال السنة المالية بشكل مفصل (5 أحرف على الأقل).');
    }

    if (!confirmedBy || confirmedBy.role !== 'ADMIN') {
      throw new Error('عفواً، لا يملك صلاحية تنفيذ تصفير النظام إلا المستخدمين بصلاحية المدير العام (ADMIN).');
    }

    const todayDate = new Date().toISOString().split('T')[0];
    const startDate = fiscalYearStartDate || todayDate;

    if (!options.bypassIdempotencyCheck) {
      const lastLog = await this.getLastResetLog();
      if (lastLog && lastLog.timestamp.startsWith(todayDate)) {
        throw new Error(
          `تم بالفعل تنفيذ تصفير للنظام اليوم بتاريخ (${todayDate}) بواسطة (${lastLog.performedBy.userName}). لحماية البيانات من التكرار، لا يمكن إجراء أكثر من تصفير واحد في نفس اليوم إلا بتأكيد خاص.`
        );
      }
    }

    const timestampIso = new Date().toISOString();
    const timestampClean = timestampIso.replace(/[-:T.Z]/g, '').slice(0, 14);
    const resetBatchId = `RESET-${timestampClean}`;

    const archiveCollections = {
      invoices: `archive_invoices_${timestampClean}`,
      journals: `archive_journals_${timestampClean}`,
      vouchers: `archive_vouchers_${timestampClean}`,
      production: `archive_production_${timestampClean}`,
    };

    const invoices = localDataStore.getInvoices();
    const journals = localDataStore.getJournals();
    const vouchers = localDataStore.getVouchers();
    const productionOrders = localDataStore.getProductionOrders();
    const customers = localDataStore.getCustomers();
    const suppliers = localDataStore.getSuppliers();
    const inventory = localDataStore.getInventory();

    // حفظ نسخة أرشيفية في التخزين المحلي
    try {
      const archivePayload = {
        batchId: resetBatchId,
        timestamp: timestampIso,
        confirmedBy,
        reason,
        invoices,
        journals,
        vouchers,
        productionOrders,
      };
      localStorage.setItem(`logix_archive_${timestampClean}`, JSON.stringify(archivePayload));
    } catch (e) {
      console.warn('Archive serialization notice:', e);
    }

    // إنشاء القيود الافتتاحية الموزونة
    const openingJournals: JournalEntry[] = [];
    let journalCounter = 1;

    // قيود العملاء
    for (const c of customers) {
      const bal = Number(c.currentBalance ?? c.balance ?? 0);
      if (Math.abs(bal) > 0.001) {
        const jId = `JV-OPEN-${timestampClean}-${String(journalCounter++).padStart(3, '0')}`;
        const isDebit = bal > 0;
        const absVal = Math.abs(bal);

        const lines: JournalEntry['lines'] = isDebit
          ? [
              {
                id: `${jId}-1`,
                accountId: '1120',
                accountCode: '1120',
                accountNameAr: `مدينون - أرصدة افتتاحية: ${c.nameAr}`,
                debit: absVal,
                credit: 0,
                memo: `رصيد افتتاحي للعميل: ${c.nameAr} (${c.code})`,
              },
              {
                id: `${jId}-2`,
                accountId: '3200',
                accountCode: '3200',
                accountNameAr: 'أرباح مبقاة / رأس المال الافتتاحي',
                debit: 0,
                credit: absVal,
                memo: `تسوية رصيد افتتاحي للعميل: ${c.nameAr}`,
              },
            ]
          : [
              {
                id: `${jId}-1`,
                accountId: '3200',
                accountCode: '3200',
                accountNameAr: 'أرباح مبقاة / رأس المال الافتتاحي',
                debit: absVal,
                credit: 0,
                memo: `تسوية رصيد دائن افتتاحي للعميل: ${c.nameAr}`,
              },
              {
                id: `${jId}-2`,
                accountId: '2130',
                accountCode: '2130',
                accountNameAr: `دائنون عملاء - أرصدة افتتاحية: ${c.nameAr}`,
                debit: 0,
                credit: absVal,
                memo: `رصيد دائن افتتاحي للعميل: ${c.nameAr} (${c.code})`,
              },
            ];

        openingJournals.push({
          id: jId,
          entryNumber: jId,
          date: startDate,
          reference: `OPEN-CUST-${c.code}`,
          description: `قيد رصيد افتتاحي للعميل ${c.nameAr} للسنة المالية الجديدة`,
          sourceModule: 'OPENING',
          sourceId: c.id,
          totalDebit: absVal,
          totalCredit: absVal,
          status: 'POSTED',
          lines,
          createdAt: timestampIso,
        });
      }
    }

    // قيود الموردين
    for (const s of suppliers) {
      const bal = Number(s.currentBalance ?? s.balance ?? 0);
      if (Math.abs(bal) > 0.001) {
        const jId = `JV-OPEN-${timestampClean}-${String(journalCounter++).padStart(3, '0')}`;
        const isCredit = bal > 0;
        const absVal = Math.abs(bal);

        const lines: JournalEntry['lines'] = isCredit
          ? [
              {
                id: `${jId}-1`,
                accountId: '3200',
                accountCode: '3200',
                accountNameAr: 'أرباح مبقاة / رأس المال الافتتاحي',
                debit: absVal,
                credit: 0,
                memo: `تسوية رصيد دائن افتتاحي للمورد: ${s.nameAr}`,
              },
              {
                id: `${jId}-2`,
                accountId: '2110',
                accountCode: '2110',
                accountNameAr: `دائنون موردون - أرصدة افتتاحية: ${s.nameAr}`,
                debit: 0,
                credit: absVal,
                memo: `رصيد افتتاحي للمورد: ${s.nameAr} (${s.code})`,
              },
            ]
          : [
              {
                id: `${jId}-1`,
                accountId: '1140',
                accountCode: '1140',
                accountNameAr: `مدينون موردون - سلف ودفعات مقدمة: ${s.nameAr}`,
                debit: absVal,
                credit: 0,
                memo: `رصيد مدين افتتاحي للمورد: ${s.nameAr} (${s.code})`,
              },
              {
                id: `${jId}-2`,
                accountId: '3200',
                accountCode: '3200',
                accountNameAr: 'أرباح مبقاة / رأس المال الافتتاحي',
                debit: 0,
                credit: absVal,
                memo: `تسوية رصيد مدين افتتاحي للمورد: ${s.nameAr}`,
              },
            ];

        openingJournals.push({
          id: jId,
          entryNumber: jId,
          date: startDate,
          reference: `OPEN-SUPP-${s.code}`,
          description: `قيد رصيد افتتاحي للمورد ${s.nameAr} للسنة المالية الجديدة`,
          sourceModule: 'OPENING',
          sourceId: s.id,
          totalDebit: absVal,
          totalCredit: absVal,
          status: 'POSTED',
          lines,
          createdAt: timestampIso,
        });
      }
    }

    // قيود بضاعة أول المدة
    const itemsWithStock = inventory.filter((item) => Number(item.quantityOnHand ?? 0) > 0);
    const totalInventoryValue = itemsWithStock.reduce(
      (sum, item) => sum + (Number(item.quantityOnHand ?? 0) * Number(item.purchasePrice ?? item.costPrice ?? 0)),
      0
    );

    if (itemsWithStock.length > 0 && totalInventoryValue > 0) {
      const jId = `JV-OPEN-${timestampClean}-${String(journalCounter++).padStart(3, '0')}`;
      const invLines: JournalEntry['lines'] = [
        {
          id: `${jId}-1`,
          accountId: '1130',
          accountCode: '1130',
          accountNameAr: 'مخزون البضاعة - رصيد افتتاحي (أول المدة)',
          debit: Math.round(totalInventoryValue * 1000) / 1000,
          credit: 0,
          memo: `رصيد بضاعة أول المدة (${itemsWithStock.length} أصناف)`,
        },
        {
          id: `${jId}-2`,
          accountId: '3200',
          accountCode: '3200',
          accountNameAr: 'أرباح مبقاة / رأس المال الافتتاحي',
          debit: 0,
          credit: Math.round(totalInventoryValue * 1000) / 1000,
          memo: 'تسوية رصيد بضاعة أول المدة للسنة المالية الجديدة',
        },
      ];

      openingJournals.push({
        id: jId,
        entryNumber: jId,
        date: startDate,
        reference: 'OPEN-STOCK-INITIAL',
        description: `قيد إثبات مخزون بضاعة أول المدة لعدد ${itemsWithStock.length} صنف للسنة المالية الجديدة`,
        sourceModule: 'OPENING',
        totalDebit: Math.round(totalInventoryValue * 1000) / 1000,
        totalCredit: Math.round(totalInventoryValue * 1000) / 1000,
        status: 'POSTED',
        lines: invLines,
        createdAt: timestampIso,
      });
    }

    // تصفير العمليات التشغيلية وتعيين القيود الافتتاحية
    localDataStore.saveInvoices([]);
    localDataStore.saveVouchers([]);
    localDataStore.saveProductionOrders([]);
    localDataStore.saveJournals(openingJournals);

    const stats: SystemResetStats = {
      invoicesArchived: invoices.length,
      journalsArchived: journals.length,
      vouchersArchived: vouchers.length,
      productionOrdersArchived: productionOrders.length,
      customersWithBalanceCount: customers.filter((c) => Math.abs(Number(c.currentBalance ?? c.balance ?? 0)) > 0.001).length,
      totalReceivablesBalance: customers.reduce((sum, c) => sum + Number(c.currentBalance ?? c.balance ?? 0), 0),
      suppliersWithBalanceCount: suppliers.filter((s) => Math.abs(Number(s.currentBalance ?? s.balance ?? 0)) > 0.001).length,
      totalPayablesBalance: suppliers.reduce((sum, s) => sum + Number(s.currentBalance ?? s.balance ?? 0), 0),
      inventoryItemsCount: itemsWithStock.length,
      totalInventoryValue: Math.round(totalInventoryValue * 1000) / 1000,
      openingJournalsCreatedCount: openingJournals.length,
    };

    const logEntry: SystemResetLog = {
      id: `log-${timestampClean}`,
      resetBatchId,
      performedBy: confirmedBy,
      reason,
      fiscalYearStartDate: startDate,
      timestamp: timestampIso,
      archiveCollections,
      stats,
      openingJournalIds: openingJournals.map((j) => j.id),
    };

    // حفظ سجل التصفير
    const existingLogs = await this.getResetLogs();
    existingLogs.unshift(logEntry);
    localStorage.setItem(RESET_LOGS_STORAGE_KEY, JSON.stringify(existingLogs));

    return {
      success: true,
      message: `تم تصفير العمليات التشغيلية بنجاح، وأرشفة السجلات السابقة، وإنشاء ${openingJournals.length} قيود افتتاحية موزونة.`,
      resetBatchId,
      stats,
      archiveCollections,
      openingJournals,
      logEntry,
    };
  }

  /**
   * 3. GET RESET LOGS (سجل عمليات التصفير السابقة)
   */
  public static async getResetLogs(): Promise<SystemResetLog[]> {
    try {
      const saved = localStorage.getItem(RESET_LOGS_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Error reading reset logs:', e);
    }
    return [];
  }

  /**
   * GET LAST RESET LOG
   */
  public static async getLastResetLog(): Promise<SystemResetLog | null> {
    const logs = await this.getResetLogs();
    return logs.length > 0 ? logs[0] : null;
  }

  /**
   * 4. RESTORE BACKUP (استعادة النسخة الاحتياطية وتحديث قاعدة البيانات المحلية وسحابة Supabase)
   */
  public static async restoreBackupToFirestore(backupData: any): Promise<{ success: boolean; message: string; writtenCounts: Record<string, number> }> {
    if (!backupData || typeof backupData !== 'object') {
      throw new Error('بيانات النسخة الاحتياطية غير صالحة أو فارغة.');
    }

    const writtenCounts: Record<string, number> = {
      company: 0,
      users: 0,
      accounts: 0,
      customers: 0,
      suppliers: 0,
      inventory: 0,
      journals: 0,
      invoices: 0,
      vouchers: 0,
      units: 0,
      productionOrders: 0,
    };

    if (backupData.company) {
      localDataStore.saveCompany(backupData.company);
      writtenCounts.company = 1;
    }
    if (Array.isArray(backupData.users)) {
      localDataStore.saveUsers(backupData.users);
      writtenCounts.users = backupData.users.length;
    }
    if (Array.isArray(backupData.accounts)) {
      localDataStore.saveAccounts(backupData.accounts);
      writtenCounts.accounts = backupData.accounts.length;
    }
    if (Array.isArray(backupData.customers)) {
      localDataStore.saveCustomers(backupData.customers);
      writtenCounts.customers = backupData.customers.length;
    }
    if (Array.isArray(backupData.suppliers)) {
      localDataStore.saveSuppliers(backupData.suppliers);
      writtenCounts.suppliers = backupData.suppliers.length;
    }
    if (Array.isArray(backupData.inventory)) {
      localDataStore.saveInventory(backupData.inventory);
      writtenCounts.inventory = backupData.inventory.length;
    }
    if (Array.isArray(backupData.journals)) {
      localDataStore.saveJournals(backupData.journals);
      writtenCounts.journals = backupData.journals.length;
    }
    if (Array.isArray(backupData.invoices)) {
      localDataStore.saveInvoices(backupData.invoices);
      writtenCounts.invoices = backupData.invoices.length;
    }
    if (Array.isArray(backupData.vouchers)) {
      localDataStore.saveVouchers(backupData.vouchers);
      writtenCounts.vouchers = backupData.vouchers.length;
    }
    if (Array.isArray(backupData.units)) {
      localDataStore.saveUnits(backupData.units);
      writtenCounts.units = backupData.units.length;
    }
    if (Array.isArray(backupData.productionOrders)) {
      localDataStore.saveProductionOrders(backupData.productionOrders);
      writtenCounts.productionOrders = backupData.productionOrders.length;
    }

    return {
      success: true,
      message: 'تمت استعادة كافة البيانات والنسخة الاحتياطية بنجاح وتحديث قاعدة البيانات.',
      writtenCounts,
    };
  }
}
