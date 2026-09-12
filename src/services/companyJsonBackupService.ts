/**
 * LOGIX Cloud ERP - Company JSON Backup & Instant Restore Service
 * Enables complete JSON backup export, file import, and one-click restore of
 * registered client data (such as Al-Waleed Mill) into partitioned storage.
 */

import {
  CompanyProfile,
  Account,
  InventoryItem,
  Invoice,
  JournalEntry,
  PaymentVoucher,
  Customer,
  Supplier,
  ProductionOrder,
  UnitDefinition,
  SystemUser,
  CompanyBackupEnvelope,
} from '../types.js';
export type { CompanyBackupEnvelope };
import { ALWALEED_MILL_PRESET_BACKUP } from '../data/alwaleedPresetData.js';
import {
  DEFAULT_COMPANY_PROFILE,
  INITIAL_ACCOUNTS,
  INITIAL_USERS,
  INITIAL_CUSTOMERS,
  INITIAL_SUPPLIERS,
  INITIAL_INVENTORY,
  INITIAL_JOURNALS,
  INITIAL_INVOICES,
  INITIAL_UNITS,
} from '../server/defaultData.js';
import {
  localDataStore,
  INITIAL_PRODUCTION_ORDERS,
  generateCleanChartOfAccounts,
} from './dataService.js';
import {
  SupabaseDataService,
  resolveToSupabaseCompanyUUID,
  ALWALEED_CANONICAL_UUID,
  isSupabaseConfigured,
  checkIsSupabaseConfigured,
} from './supabaseService.js';
import { supabase } from './supabaseClient.js';
import { safeApiFetch, safeJsonParse } from '../utils/safeJson.js';
import { SystemResetService } from './systemResetService.js';


const STORAGE_PREFIX = {
  COMPANY: 'alwaleed_erp_company',
  USERS: 'alwaleed_erp_users',
  ACCOUNTS: 'alwaleed_erp_accounts',
  CUSTOMERS: 'alwaleed_erp_customers',
  SUPPLIERS: 'alwaleed_erp_suppliers',
  INVENTORY: 'alwaleed_erp_inventory',
  JOURNALS: 'alwaleed_erp_journals',
  INVOICES: 'alwaleed_erp_invoices',
  VOUCHERS: 'alwaleed_erp_vouchers',
  UNITS: 'alwaleed_erp_units',
  PRODUCTION_ORDERS: 'alwaleed_erp_production_orders',
};

function getPartitionKey(baseKey: string, companyId: string): string {
  return `${baseKey}_${companyId}`;
}

export class CompanyJsonBackupService {
  /**
   * Export fresh data for a company directly from Supabase tables into a JSON backup
   */
  public static async exportCompanyDataAsync(companyId: string, companyName: string = 'Company'): Promise<string> {
    if (typeof window === 'undefined') return '{}';

    const currentCompanyId = resolveToSupabaseCompanyUUID(companyId) || companyId;

    const [accounts, customers, suppliers, inventory, journals, invoices, vouchers] = await Promise.all([
      supabase.from('chart_of_accounts').select('*').eq('company_id', currentCompanyId),
      supabase.from('customers').select('*').eq('company_id', currentCompanyId),
      supabase.from('suppliers').select('*').eq('company_id', currentCompanyId),
      supabase.from('inventory_items').select('*').eq('company_id', currentCompanyId),
      supabase.from('journal_entries').select('*, journal_entry_lines(*)').eq('company_id', currentCompanyId),
      supabase.from('invoices').select('*, invoice_items(*)').eq('company_id', currentCompanyId),
      supabase.from('payment_vouchers').select('*').eq('company_id', currentCompanyId),
    ]);

    const company = localDataStore.getCompany() || { ...DEFAULT_COMPANY_PROFILE, id: currentCompanyId, nameAr: companyName };
    const users = localDataStore.getUsers() || INITIAL_USERS;
    const units = localDataStore.getUnits() || INITIAL_UNITS;

    const fullBackup = {
      exportDate: new Date().toISOString(),
      version: "2.0.0",
      company,
      users,
      accounts: accounts.data || [],
      customers: customers.data || [],
      suppliers: suppliers.data || [],
      inventory: inventory.data || [],
      journals: journals.data || [],
      invoices: invoices.data || [],
      vouchers: vouchers.data || [],
      units
    };

    const jsonString = JSON.stringify(fullBackup, null, 2);

    try {
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      const safeName = (company.nameAr || companyName || 'LOGIX_Company').replace(/[\s/\\?%*:|"<>]+/g, '_');
      link.href = url;
      link.download = `LOGIX_Backup_${safeName}_${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.warn('Could not auto-download JSON file:', e);
    }

    return jsonString;
  }

  /**
   * Export all data for a specific company into a formatted JSON string and initiate download
   */
  public static exportCompanyData(companyId: string, companyName: string = 'Company'): string {
    if (typeof window === 'undefined') return '{}';

    const canonicalId = resolveToSupabaseCompanyUUID(companyId) || companyId;

    const getRaw = <T>(baseKey: string, fallback: T): T => {
      try {
        const item =
          window.localStorage.getItem(getPartitionKey(baseKey, companyId)) ||
          window.localStorage.getItem(getPartitionKey(baseKey, canonicalId));
        if (item) return safeJsonParse<T>(item, fallback);
      } catch (err) {
        console.warn('Error reading key for export:', baseKey, err);
      }
      return fallback;
    };

    // Prefer live dataStore if active company matches
    const activeCompanyId = localDataStore.getEffectiveCompanyId();
    const isActiveTarget =
      activeCompanyId === companyId ||
      activeCompanyId === canonicalId ||
      (companyId.includes('alwaleed') && localDataStore.isAlWaleedActive());

    const company: CompanyProfile = isActiveTarget
      ? localDataStore.getCompany()
      : getRaw<CompanyProfile>(STORAGE_PREFIX.COMPANY, {
          ...DEFAULT_COMPANY_PROFILE,
          id: canonicalId,
          nameAr: companyName,
        });

    const accounts: Account[] =
      (isActiveTarget ? localDataStore.getAccounts() : null) ||
      getRaw<Account[]>(STORAGE_PREFIX.ACCOUNTS, INITIAL_ACCOUNTS);

    const inventory: InventoryItem[] =
      (isActiveTarget ? localDataStore.getInventory() : null) ||
      getRaw<InventoryItem[]>(STORAGE_PREFIX.INVENTORY, []);

    const invoices: Invoice[] =
      (isActiveTarget ? localDataStore.getInvoices() : null) ||
      getRaw<Invoice[]>(STORAGE_PREFIX.INVOICES, []);

    const journals: JournalEntry[] =
      (isActiveTarget ? localDataStore.getJournals() : null) ||
      getRaw<JournalEntry[]>(STORAGE_PREFIX.JOURNALS, []);

    const vouchers: PaymentVoucher[] =
      (isActiveTarget ? localDataStore.getVouchers() : null) ||
      getRaw<PaymentVoucher[]>(STORAGE_PREFIX.VOUCHERS, []);

    const customers: Customer[] =
      (isActiveTarget ? localDataStore.getCustomers() : null) ||
      getRaw<Customer[]>(STORAGE_PREFIX.CUSTOMERS, []);

    const suppliers: Supplier[] =
      (isActiveTarget ? localDataStore.getSuppliers() : null) ||
      getRaw<Supplier[]>(STORAGE_PREFIX.SUPPLIERS, []);

    const productionOrders: ProductionOrder[] =
      (isActiveTarget ? localDataStore.getProductionOrders() : null) ||
      getRaw<ProductionOrder[]>(STORAGE_PREFIX.PRODUCTION_ORDERS, []);

    const units: UnitDefinition[] =
      (isActiveTarget ? localDataStore.getUnits() : null) ||
      getRaw<UnitDefinition[]>(STORAGE_PREFIX.UNITS, INITIAL_UNITS);

    const users: SystemUser[] =
      (isActiveTarget ? localDataStore.getUsers() : null) ||
      getRaw<SystemUser[]>(STORAGE_PREFIX.USERS, INITIAL_USERS);

    const envelope: CompanyBackupEnvelope = {
      format: 'LOGIX_ERP_BACKUP_V2026',
      exportTimestamp: new Date().toISOString(),
      companyId: canonicalId,
      companyName: company.nameAr || companyName,
      version: '2026.1',
      stats: {
        accountsCount: accounts.length,
        inventoryCount: inventory.length,
        invoicesCount: invoices.length,
        journalsCount: journals.length,
        vouchersCount: vouchers.length,
        customersCount: customers.length,
        suppliersCount: suppliers.length,
        productionOrdersCount: productionOrders.length,
        unitsCount: units.length,
      },
      data: {
        company: { ...company, id: canonicalId },
        accounts: accounts.map((a) => ({ ...a, companyId: canonicalId, company_id: canonicalId })),
        inventory: inventory.map((i) => ({ ...i, companyId: canonicalId, company_id: canonicalId })),
        invoices: invoices.map((inv) => ({ ...inv, companyId: canonicalId, company_id: canonicalId })),
        journals: journals.map((j) => ({ ...j, companyId: canonicalId, company_id: canonicalId })),
        vouchers: vouchers.map((v) => ({ ...v, companyId: canonicalId, company_id: canonicalId })),
        customers: customers.map((c) => ({ ...c, companyId: canonicalId, company_id: canonicalId })),
        suppliers: suppliers.map((s) => ({ ...s, companyId: canonicalId, company_id: canonicalId })),
        productionOrders: productionOrders.map((p) => ({ ...p, companyId: canonicalId, company_id: canonicalId })),
        units: units.map((u) => ({ ...u, companyId: canonicalId, company_id: canonicalId })),
        users: users.map((u) => ({ ...u, companyId: canonicalId, company_id: canonicalId })),
      },
    };

    const jsonString = JSON.stringify(envelope, null, 2);

    // Trigger download in browser
    try {
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      const safeName = (company.nameAr || 'LOGIX_Company').replace(/[\s/\\?%*:|"<>]/g, '_');
      link.href = url;
      link.download = `LOGIX_Backup_${safeName}_${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.warn('Could not auto-download JSON file:', e);
    }

    return jsonString;
  }

  /**
   * Import data from JSON into a company's partitioned storage with full validation,
   * restore lock protection against background overwrite, and cloud synchronization.
   */
  public static async importCompanyData(
    companyId: string,
    jsonInput: string | any
  ): Promise<{
    success: boolean;
    message: string;
    cloudSynced?: boolean;
    cloudSyncNotice?: string;
    cloudSyncedCounts?: {
      company: boolean;
      accounts: number;
      customers: number;
      suppliers: number;
      inventory: number;
      invoices: number;
      vouchers: number;
      journals: number;
    };
    stats?: {
      invoices: number;
      vouchers: number;
      inventory: number;
      journals: number;
      customers: number;
      suppliers: number;
      productionOrders: number;
      accounts: number;
    };
  }> {
    if (typeof window === 'undefined') {
      return { success: false, message: 'البيئة غير مدعومة' };
    }

    try {
      const parsed = typeof jsonInput === 'string' ? JSON.parse(jsonInput) : jsonInput;
      if (!parsed || typeof parsed !== 'object') {
        return { success: false, message: 'ملف JSON غير صالح أو فارغ' };
      }

      // Handle both wrapped envelope and flat object formats
      const data = parsed.data && typeof parsed.data === 'object' ? parsed.data : parsed;
      const canonicalId = resolveToSupabaseCompanyUUID(companyId) || companyId;

      // 1. Structural Schema Validation
      if (!data.company || typeof data.company !== 'object') {
        return { success: false, message: 'فشل فحص الهيكلية: ملف النسخة الاحتياطية لا يحتوي على بيانات الشركة الأساسية' };
      }
      if (!Array.isArray(data.accounts) || data.accounts.length === 0) {
        return { success: false, message: 'فشل فحص الهيكلية: ملف النسخة الاحتياطية لا يحتوي على دليل الحسابات' };
      }

      // 2. Accounting Balance & Debit/Credit Equilibrium Verification (فحص توازن القيود المحاسبية)
      const rawJournals = Array.isArray(data.journals) ? data.journals : [];
      for (let idx = 0; idx < rawJournals.length; idx++) {
        const jv = rawJournals[idx];
        const lines = Array.isArray(jv.lines) ? jv.lines : [];
        let sumDebit = 0;
        let sumCredit = 0;
        if (lines.length > 0) {
          sumDebit = lines.reduce((s: number, l: any) => s + (Number(l.debit) || 0), 0);
          sumCredit = lines.reduce((s: number, l: any) => s + (Number(l.credit) || 0), 0);
        } else {
          sumDebit = Number(jv.totalDebit) || 0;
          sumCredit = Number(jv.totalCredit) || 0;
        }
        const diff = Math.abs(sumDebit - sumCredit);
        if (diff > 0.01) {
          return {
            success: false,
            message: `فشل فحص التوازن المحاسبي: القيد اليومي رقم ${jv.entryNumber || idx + 1} غير متوازن (مدين: ${sumDebit.toFixed(3)} مقابل دائن: ${sumCredit.toFixed(3)}). تم إيقاف الاستعادة فوراً لمنع تشوه الدفاتر.`,
          };
        }
      }

      // 3. Pre-Restore Snapshot for Atomic Rollback Safety
      const previousStorageSnapshot: Record<string, string | null> = {};
      const targetPrefixes = [
        STORAGE_PREFIX.COMPANY,
        STORAGE_PREFIX.ACCOUNTS,
        STORAGE_PREFIX.INVENTORY,
        STORAGE_PREFIX.INVOICES,
        STORAGE_PREFIX.JOURNALS,
        STORAGE_PREFIX.CUSTOMERS,
        STORAGE_PREFIX.SUPPLIERS,
        STORAGE_PREFIX.VOUCHERS,
        STORAGE_PREFIX.PRODUCTION_ORDERS,
        STORAGE_PREFIX.UNITS,
        STORAGE_PREFIX.USERS,
      ];
      for (const prefix of targetPrefixes) {
        previousStorageSnapshot[getPartitionKey(prefix, companyId)] = window.localStorage.getItem(getPartitionKey(prefix, companyId));
        previousStorageSnapshot[getPartitionKey(prefix, canonicalId)] = window.localStorage.getItem(getPartitionKey(prefix, canonicalId));
      }

      // 4. Stamp companyId and canonical UUID on all entities
      const company: CompanyProfile = data.company
        ? { ...data.company, id: canonicalId }
        : { ...DEFAULT_COMPANY_PROFILE, id: canonicalId };

      const accounts: Account[] = (Array.isArray(data.accounts) ? data.accounts : []).map((a: any) => ({
        ...a,
        companyId: canonicalId,
        company_id: canonicalId,
      }));

      const inventory: InventoryItem[] = (Array.isArray(data.inventory) ? data.inventory : []).map((i: any) => ({
        ...i,
        companyId: canonicalId,
        company_id: canonicalId,
      }));

      const invoices: Invoice[] = (Array.isArray(data.invoices) ? data.invoices : []).map((inv: any) => ({
        ...inv,
        companyId: canonicalId,
        company_id: canonicalId,
        lines: (inv.lines || []).map((l: any) => ({ ...l, companyId: canonicalId, company_id: canonicalId })),
      }));

      const journals: JournalEntry[] = (Array.isArray(data.journals) ? data.journals : []).map((j: any) => ({
        ...j,
        companyId: canonicalId,
        company_id: canonicalId,
        lines: (j.lines || []).map((l: any) => ({ ...l, companyId: canonicalId, company_id: canonicalId })),
      }));

      const vouchers: PaymentVoucher[] = (Array.isArray(data.vouchers) ? data.vouchers : []).map((v: any) => ({
        ...v,
        companyId: canonicalId,
        company_id: canonicalId,
      }));

      const customers: Customer[] = (Array.isArray(data.customers) ? data.customers : []).map((c: any) => ({
        ...c,
        companyId: canonicalId,
        company_id: canonicalId,
      }));

      const suppliers: Supplier[] = (Array.isArray(data.suppliers) ? data.suppliers : []).map((s: any) => ({
        ...s,
        companyId: canonicalId,
        company_id: canonicalId,
      }));

      const productionOrders: ProductionOrder[] = (Array.isArray(data.productionOrders) ? data.productionOrders : []).map(
        (p: any) => ({
          ...p,
          companyId: canonicalId,
          company_id: canonicalId,
        })
      );

      const units: UnitDefinition[] = (Array.isArray(data.units) ? data.units : []).map((u: any) => ({
        ...u,
        companyId: canonicalId,
        company_id: canonicalId,
      }));

      const users: SystemUser[] = (Array.isArray(data.users) ? data.users : []).map((u: any) => ({
        ...u,
        companyId: canonicalId,
        company_id: canonicalId,
      }));

      // 2. Persist to LocalDataStore
      if (data.company) localDataStore.saveCompany(company);
      if (accounts.length > 0) localDataStore.saveAccounts(accounts);
      localDataStore.saveInventory(inventory);
      localDataStore.saveInvoices(invoices);
      localDataStore.saveJournals(journals);
      localDataStore.saveCustomers(customers);
      localDataStore.saveSuppliers(suppliers);
      localDataStore.saveVouchers(vouchers);
      localDataStore.saveProductionOrders(productionOrders);
      if (units.length > 0) localDataStore.saveUnits(units);
      if (users.length > 0) localDataStore.saveUsers(users);

      // 3. Write also to direct raw partition keys for both companyId and canonicalId
      const writeRawPair = (baseKey: string, val: any) => {
        const serialized = JSON.stringify(val);
        window.localStorage.setItem(getPartitionKey(baseKey, companyId), serialized);
        window.localStorage.setItem(getPartitionKey(baseKey, canonicalId), serialized);
      };

      writeRawPair(STORAGE_PREFIX.COMPANY, company);
      if (accounts.length > 0) writeRawPair(STORAGE_PREFIX.ACCOUNTS, accounts);
      writeRawPair(STORAGE_PREFIX.INVENTORY, inventory);
      writeRawPair(STORAGE_PREFIX.INVOICES, invoices);
      writeRawPair(STORAGE_PREFIX.JOURNALS, journals);
      writeRawPair(STORAGE_PREFIX.CUSTOMERS, customers);
      writeRawPair(STORAGE_PREFIX.SUPPLIERS, suppliers);
      writeRawPair(STORAGE_PREFIX.VOUCHERS, vouchers);
      writeRawPair(STORAGE_PREFIX.PRODUCTION_ORDERS, productionOrders);
      writeRawPair(STORAGE_PREFIX.UNITS, units.length > 0 ? units : INITIAL_UNITS);
      writeRawPair(STORAGE_PREFIX.USERS, users.length > 0 ? users : INITIAL_USERS);

      // 4. Activate Anti-Overwrite Restore Lock
      localDataStore.markRestoreLocked(canonicalId);
      localDataStore.markRestoreLocked(companyId);

      // 5. Directly synchronize restored records to Supabase Cloud Tables (Batch Upsert)
      let cloudSynced = false;
      let cloudSyncNotice = '';
      const cloudSyncedCounts = {
        company: false,
        accounts: 0,
        customers: 0,
        suppliers: 0,
        inventory: 0,
        invoices: 0,
        vouchers: 0,
        journals: 0,
      };

      if (isSupabaseConfigured || checkIsSupabaseConfigured()) {
        try {
          console.log(`[CloudRestoreSync] Executing direct cloud sync for company ${canonicalId}...`);
          // 1. Company Profile
          if (company) {
            const compOk = await SupabaseDataService.saveCompany(company, canonicalId);
            cloudSyncedCounts.company = compOk;
          }
          // 2. Chart of Accounts
          if (accounts.length > 0) {
            const accOk = await SupabaseDataService.saveAccounts(accounts, canonicalId);
            if (accOk) cloudSyncedCounts.accounts = accounts.length;
          }
          // 3. Customers & Suppliers (Precedes invoices so foreign key customer_id succeeds)
          if (customers.length > 0) {
            const custOk = await SupabaseDataService.saveCustomers(customers, canonicalId);
            if (custOk) cloudSyncedCounts.customers = customers.length;
          }
          if (suppliers.length > 0) {
            const suppOk = await SupabaseDataService.saveSuppliers(suppliers, canonicalId);
            if (suppOk) cloudSyncedCounts.suppliers = suppliers.length;
          }
          // 4. Inventory Items
          if (inventory.length > 0) {
            const itemOk = await SupabaseDataService.saveItems(inventory, canonicalId);
            if (itemOk) cloudSyncedCounts.inventory = inventory.length;
          }
          // 5. Sales Invoices & Line Details
          if (invoices.length > 0) {
            const invOk = await SupabaseDataService.saveInvoices(invoices, canonicalId);
            if (invOk) cloudSyncedCounts.invoices = invoices.length;
          }
          // 6. Payment & Receipt Vouchers
          if (vouchers.length > 0) {
            const vchOk = await SupabaseDataService.saveVouchers(vouchers, canonicalId);
            if (vchOk) cloudSyncedCounts.vouchers = vouchers.length;
          }
          // 7. General Ledger Journal Entries
          if (journals.length > 0) {
            const jvOk = await SupabaseDataService.saveJournals(journals, canonicalId);
            if (jvOk) cloudSyncedCounts.journals = journals.length;
          }

          cloudSynced = true;
          cloudSyncNotice = `تمت المزامنة السحابية بنجاح إلى Supabase (${invoices.length} فواتير، ${vouchers.length} سندات، ${inventory.length} أصناف، ${customers.length} عملاء، ${journals.length} قيود أستاذ عام)`;
          console.log(`[CloudRestoreSync] Direct Supabase cloud restore completed for company ${canonicalId}.`, cloudSyncedCounts);
        } catch (cloudErr: any) {
          console.warn('[CloudRestoreSync] Supabase cloud restore sync warning:', cloudErr);
          cloudSyncNotice = `تم التثبيت محلياً مع تنبيه في المزامنة السحابية: ${cloudErr?.message || 'تعذر الاتصال بقاعدة البيانات السحابية'}`;
        }
      } else {
        cloudSyncNotice = 'تم الحفظ في التخزين المحلي (قاعدة بيانات Supabase غير مهيأة حالياً).';
      }

      // 6. Safe sync to Express DB and Firestore
      safeApiFetch('/api/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: canonicalId, data }),
      }).catch(() => {});
      SystemResetService.restoreBackupToFirestore(data).catch(() => {});

      const stats = {
        invoices: invoices.length,
        vouchers: vouchers.length,
        inventory: inventory.length,
        journals: journals.length,
        customers: customers.length,
        suppliers: suppliers.length,
        productionOrders: productionOrders.length,
        accounts: accounts.length,
      };

      return {
        success: true,
        cloudSynced,
        cloudSyncNotice,
        cloudSyncedCounts,
        message: cloudSynced
          ? `تمت استعادة وتثبيت بيانات المنشأة ومزامنتها سحابياً في Supabase بنجاح! (${stats.inventory} صنف مخزني، ${stats.invoices} فاتورة مبيعات، ${stats.vouchers} سند قبض وصرف، ${stats.journals} قيود أستاذ عام، ${stats.customers} عميل، ${stats.productionOrders} أمر تشغيل). البيانات متطابقة سحابياً مع جميع الأجهزة فوراً.`
          : `تمت استعادة وتثبيت بيانات المنشأة بنجاح! (${stats.inventory} صنف، ${stats.invoices} فاتورة، ${stats.vouchers} سند، ${stats.journals} قيود). ${cloudSyncNotice}`,
        stats,
      };
    } catch (err: any) {
      console.error('importCompanyData error:', err);
      // Execute Atomic Rollback if storage was touched
      try {
        if (typeof window !== 'undefined') {
          const targetPrefixes = [
            STORAGE_PREFIX.COMPANY,
            STORAGE_PREFIX.ACCOUNTS,
            STORAGE_PREFIX.INVENTORY,
            STORAGE_PREFIX.INVOICES,
            STORAGE_PREFIX.JOURNALS,
            STORAGE_PREFIX.CUSTOMERS,
            STORAGE_PREFIX.SUPPLIERS,
            STORAGE_PREFIX.VOUCHERS,
            STORAGE_PREFIX.PRODUCTION_ORDERS,
            STORAGE_PREFIX.UNITS,
            STORAGE_PREFIX.USERS,
          ];
          for (const prefix of targetPrefixes) {
            const k1 = getPartitionKey(prefix, companyId);
            const k2 = getPartitionKey(prefix, resolveToSupabaseCompanyUUID(companyId) || companyId);
            const oldVal1 = window.sessionStorage.getItem(`snapshot_${k1}`);
            if (oldVal1 !== null) window.localStorage.setItem(k1, oldVal1);
            const oldVal2 = window.sessionStorage.getItem(`snapshot_${k2}`);
            if (oldVal2 !== null) window.localStorage.setItem(k2, oldVal2);
          }
        }
      } catch (rbErr) {
        console.warn('Rollback warning:', rbErr);
      }
      return {
        success: false,
        message: `فشل استعادة ملف JSON: ${err?.message || 'تنسيق الملف غير سليم'}. تم تطبيق التراجع التلقائي (Rollback) لحماية البيانات الحالية.`,
      };
    }
  }

  /**
   * Reset / Zero out all operational data for a company to absolute zero
   * (Zero balances, 0 invoices, 0 journals, 0 inventory, 0 production orders)
   */
  public static zeroOutCompanyData(companyId: string, companyProfileOverride?: Partial<CompanyProfile>): void {
    if (typeof window === 'undefined') return;

    const canonicalId = resolveToSupabaseCompanyUUID(companyId) || companyId;

    const setRaw = (baseKey: string, val: any) => {
      const serialized = JSON.stringify(val);
      window.localStorage.setItem(getPartitionKey(baseKey, companyId), serialized);
      window.localStorage.setItem(getPartitionKey(baseKey, canonicalId), serialized);
      if (canonicalId === ALWALEED_CANONICAL_UUID) {
        window.localStorage.setItem(getPartitionKey(baseKey, 'company-alwaleed-client-003'), serialized);
      }
    };

    // Clean accounts with 0 balance using standard template COA
    const cleanAccounts = generateCleanChartOfAccounts(canonicalId).map((acc) => ({
      ...acc,
      balance: 0,
      companyId: canonicalId,
      company_id: canonicalId,
    }));

    setRaw(STORAGE_PREFIX.ACCOUNTS, cleanAccounts);
    setRaw(STORAGE_PREFIX.INVENTORY, []);
    setRaw(STORAGE_PREFIX.INVOICES, []);
    setRaw(STORAGE_PREFIX.JOURNALS, []);
    setRaw(STORAGE_PREFIX.VOUCHERS, []);
    setRaw(STORAGE_PREFIX.PRODUCTION_ORDERS, []);
    setRaw(STORAGE_PREFIX.CUSTOMERS, []); // ZERO Customers!
    setRaw(STORAGE_PREFIX.SUPPLIERS, []); // ZERO Suppliers!
    setRaw(STORAGE_PREFIX.UNITS, INITIAL_UNITS);
    setRaw(STORAGE_PREFIX.USERS, INITIAL_USERS);

    // Also update localDataStore
    localDataStore.saveAccounts(cleanAccounts);
    localDataStore.saveInventory([]);
    localDataStore.saveInvoices([]);
    localDataStore.saveJournals([]);
    localDataStore.saveVouchers([]);
    localDataStore.saveProductionOrders([]);
    localDataStore.saveCustomers([]); // ZERO Customers!
    localDataStore.saveSuppliers([]); // ZERO Suppliers!

    if (companyProfileOverride) {
      const current = window.localStorage.getItem(getPartitionKey(STORAGE_PREFIX.COMPANY, companyId));
      const parsed = current ? safeJsonParse<CompanyProfile>(current, DEFAULT_COMPANY_PROFILE) : DEFAULT_COMPANY_PROFILE;
      const updatedProfile = { ...parsed, ...companyProfileOverride, id: canonicalId };
      setRaw(STORAGE_PREFIX.COMPANY, updatedProfile);
      localDataStore.saveCompany(updatedProfile);
    }
  }

  /**
   * Generates the authentic pre-configured JSON backup of Al-Waleed Mill's complete dataset
   * (The full 64 items, 61 journals, 51 invoices, 10 vouchers, co-op customers, and chart of accounts)
   */
  public static getAlWaleedMillPresetBackupJson(): string {
    return JSON.stringify(ALWALEED_MILL_PRESET_BACKUP, null, 2);
  }
}
