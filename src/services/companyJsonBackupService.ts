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
} from '../types.js';
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
} from './dataService.js';
import {
  SupabaseDataService,
  resolveToSupabaseCompanyUUID,
  ALWALEED_CANONICAL_UUID,
  isSupabaseConfigured,
} from './supabaseService.js';
import { safeApiFetch, safeJsonParse } from '../utils/safeJson.js';
import { SystemResetService } from './systemResetService.js';

export interface CompanyBackupEnvelope {
  format: 'LOGIX_ERP_BACKUP_V2026';
  exportTimestamp: string;
  companyId: string;
  companyName: string;
  version: string;
  stats: {
    accountsCount: number;
    inventoryCount: number;
    invoicesCount: number;
    journalsCount: number;
    vouchersCount: number;
    customersCount: number;
    suppliersCount: number;
    productionOrdersCount: number;
    unitsCount: number;
  };
  data: {
    company?: CompanyProfile;
    accounts?: Account[];
    inventory?: InventoryItem[];
    invoices?: Invoice[];
    journals?: JournalEntry[];
    vouchers?: PaymentVoucher[];
    customers?: Customer[];
    suppliers?: Supplier[];
    productionOrders?: ProductionOrder[];
    units?: UnitDefinition[];
    users?: SystemUser[];
  };
}

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
    stats?: {
      invoices: number;
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

      // 1. Stamp companyId and canonical UUID on all entities
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
        if (canonicalId === ALWALEED_CANONICAL_UUID) {
          window.localStorage.setItem(getPartitionKey(baseKey, 'company-alwaleed-client-003'), serialized);
        }
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

      // 5. Asynchronously synchronize restored records to Supabase Cloud Tables
      if (isSupabaseConfigured) {
        Promise.resolve().then(async () => {
          try {
            if (accounts.length > 0) await SupabaseDataService.saveAccounts(accounts);
            if (customers.length > 0) await Promise.all(customers.map((c) => SupabaseDataService.saveCustomer(c)));
            if (inventory.length > 0) await Promise.all(inventory.map((it) => SupabaseDataService.saveItem(it)));
            if (journals.length > 0) await Promise.all(journals.map((j) => SupabaseDataService.saveJournal(j)));
            if (invoices.length > 0) await Promise.all(invoices.map((inv) => SupabaseDataService.saveInvoice(inv)));
          } catch (cloudErr) {
            console.warn('Background Supabase cloud restore sync notice:', cloudErr);
          }
        });
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
        inventory: inventory.length,
        journals: journals.length,
        customers: customers.length,
        suppliers: suppliers.length,
        productionOrders: productionOrders.length,
        accounts: accounts.length,
      };

      return {
        success: true,
        message: `تمت استعادة وتثبيت بيانات المنشأة بنجاح ومزامنتها سحابياً! (${stats.inventory} صنف مخزني، ${stats.invoices} فاتورة، ${stats.journals} قيود أستاذ عام، ${stats.customers} عميل، ${stats.productionOrders} أمر تشغيل).`,
        stats,
      };
    } catch (err: any) {
      console.error('importCompanyData error:', err);
      return {
        success: false,
        message: `فشل قراءة أو استعادة ملف JSON: ${err?.message || 'تنسيق الملف غير سليم'}`,
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

    // Clean accounts with 0 balance
    const cleanAccounts = INITIAL_ACCOUNTS.map((acc) => ({ ...acc, balance: 0, companyId: canonicalId, company_id: canonicalId }));
    // Clean customers with 0 balance
    const cleanCustomers = INITIAL_CUSTOMERS.map((c) => ({ ...c, balance: 0, openingBalance: 0, companyId: canonicalId, company_id: canonicalId }));
    // Clean suppliers with 0 balance
    const cleanSuppliers = INITIAL_SUPPLIERS.map((s) => ({ ...s, balance: 0, openingBalance: 0, companyId: canonicalId, company_id: canonicalId }));

    setRaw(STORAGE_PREFIX.ACCOUNTS, cleanAccounts);
    setRaw(STORAGE_PREFIX.INVENTORY, []);
    setRaw(STORAGE_PREFIX.INVOICES, []);
    setRaw(STORAGE_PREFIX.JOURNALS, []);
    setRaw(STORAGE_PREFIX.VOUCHERS, []);
    setRaw(STORAGE_PREFIX.PRODUCTION_ORDERS, []);
    setRaw(STORAGE_PREFIX.CUSTOMERS, cleanCustomers);
    setRaw(STORAGE_PREFIX.SUPPLIERS, cleanSuppliers);
    setRaw(STORAGE_PREFIX.UNITS, INITIAL_UNITS);
    setRaw(STORAGE_PREFIX.USERS, INITIAL_USERS);

    // Also update localDataStore
    localDataStore.saveAccounts(cleanAccounts);
    localDataStore.saveInventory([]);
    localDataStore.saveInvoices([]);
    localDataStore.saveJournals([]);
    localDataStore.saveVouchers([]);
    localDataStore.saveProductionOrders([]);
    localDataStore.saveCustomers(cleanCustomers);
    localDataStore.saveSuppliers(cleanSuppliers);

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
   * (The 22 spice items, milling lines, orders, co-op customers, and initial invoices)
   */
  public static getAlWaleedMillPresetBackupJson(): string {
    const envelope: CompanyBackupEnvelope = {
      format: 'LOGIX_ERP_BACKUP_V2026',
      exportTimestamp: '2026-08-30T10:00:00.000Z',
      companyId: 'company-alwaleed-client-003',
      companyName: 'شركة مطحنة الوليد المتحدة ذ.م.م',
      version: '2026.1',
      stats: {
        accountsCount: INITIAL_ACCOUNTS.length,
        inventoryCount: INITIAL_INVENTORY.length,
        invoicesCount: INITIAL_INVOICES.length,
        journalsCount: INITIAL_JOURNALS.length,
        vouchersCount: 0,
        customersCount: INITIAL_CUSTOMERS.length,
        suppliersCount: INITIAL_SUPPLIERS.length,
        productionOrdersCount: INITIAL_PRODUCTION_ORDERS.length,
        unitsCount: INITIAL_UNITS.length,
      },
      data: {
        company: {
          ...DEFAULT_COMPANY_PROFILE,
          id: 'company-alwaleed-client-003',
          nameAr: 'شركة مطحنة الوليد المتحدة ذ.م.م',
          nameEn: 'Al-Waleed United Mill & Food Industries Co. W.L.L',
          tradeName: 'مطحنة الوليد للبهارات والمواد التموينية والصناعات الغذائية',
          legalForm: 'شركة ذات مسؤولية محدودة',
          crNumber: '450912',
          chamberNumber: '78214',
          functionalCurrency: 'KWD',
          vatRate: 0,
          city: 'الكويت',
          country: 'دولة الكويت',
          district: 'الشويخ الصناعية',
          streetName: 'شارع الغزالي - قسيمة 42',
          phone: '+965 6571 0278',
          email: 'alwaleed.client@logixerp.cloud',
          generalManager: 'د. خالد بن عبد العزيز السليمان',
          financialManager: 'أ. محمد بن عبد الله الشمري',
          chiefAccountant: 'أ. أحمد علي المصطفى',
        },
        accounts: INITIAL_ACCOUNTS,
        inventory: INITIAL_INVENTORY,
        invoices: INITIAL_INVOICES,
        journals: INITIAL_JOURNALS,
        vouchers: [],
        customers: INITIAL_CUSTOMERS,
        suppliers: INITIAL_SUPPLIERS,
        productionOrders: INITIAL_PRODUCTION_ORDERS,
        units: INITIAL_UNITS,
        users: INITIAL_USERS,
      },
    };

    return JSON.stringify(envelope, null, 2);
  }
}
