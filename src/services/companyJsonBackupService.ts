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
import { INITIAL_PRODUCTION_ORDERS } from './dataService.js';
import { safeJsonParse } from '../utils/safeJson.js';

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

    const getRaw = <T>(baseKey: string, fallback: T): T => {
      try {
        const item = window.localStorage.getItem(getPartitionKey(baseKey, companyId));
        if (item) return safeJsonParse<T>(item, fallback);
        // Fallback to legacy un-suffixed key if this is Al-Waleed or default
        const legacyItem = window.localStorage.getItem(baseKey);
        if (legacyItem) return safeJsonParse<T>(legacyItem, fallback);
      } catch (err) {
        console.warn('Error reading key for export:', baseKey, err);
      }
      return fallback;
    };

    const company = getRaw<CompanyProfile>(STORAGE_PREFIX.COMPANY, {
      ...DEFAULT_COMPANY_PROFILE,
      id: companyId,
      nameAr: companyName,
    });

    const accounts = getRaw<Account[]>(STORAGE_PREFIX.ACCOUNTS, INITIAL_ACCOUNTS);
    const inventory = getRaw<InventoryItem[]>(STORAGE_PREFIX.INVENTORY, []);
    const invoices = getRaw<Invoice[]>(STORAGE_PREFIX.INVOICES, []);
    const journals = getRaw<JournalEntry[]>(STORAGE_PREFIX.JOURNALS, []);
    const vouchers = getRaw<PaymentVoucher[]>(STORAGE_PREFIX.VOUCHERS, []);
    const customers = getRaw<Customer[]>(STORAGE_PREFIX.CUSTOMERS, []);
    const suppliers = getRaw<Supplier[]>(STORAGE_PREFIX.SUPPLIERS, []);
    const productionOrders = getRaw<ProductionOrder[]>(STORAGE_PREFIX.PRODUCTION_ORDERS, []);
    const units = getRaw<UnitDefinition[]>(STORAGE_PREFIX.UNITS, INITIAL_UNITS);
    const users = getRaw<SystemUser[]>(STORAGE_PREFIX.USERS, INITIAL_USERS);

    const envelope: CompanyBackupEnvelope = {
      format: 'LOGIX_ERP_BACKUP_V2026',
      exportTimestamp: new Date().toISOString(),
      companyId,
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
        company,
        accounts,
        inventory,
        invoices,
        journals,
        vouchers,
        customers,
        suppliers,
        productionOrders,
        units,
        users,
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
   * Import data from JSON into a company's partitioned storage
   */
  public static importCompanyData(
    companyId: string,
    jsonInput: string
  ): {
    success: boolean;
    message: string;
    stats?: {
      invoices: number;
      inventory: number;
      journals: number;
      customers: number;
      suppliers: number;
      productionOrders: number;
    };
  } {
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

      const setRaw = (baseKey: string, val: any) => {
        const key = getPartitionKey(baseKey, companyId);
        window.localStorage.setItem(key, JSON.stringify(val));
      };

      if (data.company) {
        setRaw(STORAGE_PREFIX.COMPANY, { ...data.company, id: companyId });
      }
      if (Array.isArray(data.accounts) && data.accounts.length > 0) {
        setRaw(STORAGE_PREFIX.ACCOUNTS, data.accounts);
      }
      if (Array.isArray(data.inventory)) {
        setRaw(STORAGE_PREFIX.INVENTORY, data.inventory);
      }
      if (Array.isArray(data.invoices)) {
        setRaw(STORAGE_PREFIX.INVOICES, data.invoices);
      }
      if (Array.isArray(data.journals)) {
        setRaw(STORAGE_PREFIX.JOURNALS, data.journals);
      }
      if (Array.isArray(data.vouchers)) {
        setRaw(STORAGE_PREFIX.VOUCHERS, data.vouchers);
      }
      if (Array.isArray(data.customers)) {
        setRaw(STORAGE_PREFIX.CUSTOMERS, data.customers);
      }
      if (Array.isArray(data.suppliers)) {
        setRaw(STORAGE_PREFIX.SUPPLIERS, data.suppliers);
      }
      if (Array.isArray(data.productionOrders)) {
        setRaw(STORAGE_PREFIX.PRODUCTION_ORDERS, data.productionOrders);
      }
      if (Array.isArray(data.units)) {
        setRaw(STORAGE_PREFIX.UNITS, data.units);
      }
      if (Array.isArray(data.users)) {
        setRaw(STORAGE_PREFIX.USERS, data.users);
      }

      const stats = {
        invoices: Array.isArray(data.invoices) ? data.invoices.length : 0,
        inventory: Array.isArray(data.inventory) ? data.inventory.length : 0,
        journals: Array.isArray(data.journals) ? data.journals.length : 0,
        customers: Array.isArray(data.customers) ? data.customers.length : 0,
        suppliers: Array.isArray(data.suppliers) ? data.suppliers.length : 0,
        productionOrders: Array.isArray(data.productionOrders) ? data.productionOrders.length : 0,
      };

      return {
        success: true,
        message: `تم استعادة بيانات المنشأة بنجاح من ملف JSON! (${stats.inventory} صنف مخزني، ${stats.invoices} فاتورة، ${stats.journals} قيود أستاذ عام، ${stats.productionOrders} أمر تشغيل تصنيعي).`,
        stats,
      };
    } catch (err: any) {
      console.error('importCompanyData error:', err);
      return {
        success: false,
        message: `فشل قراءة ملف JSON: ${err?.message || 'تنسيق الملف غير سليم'}`,
      };
    }
  }

  /**
   * Reset / Zero out all operational data for a company to absolute zero
   * (Zero balances, 0 invoices, 0 journals, 0 inventory, 0 production orders)
   */
  public static zeroOutCompanyData(companyId: string, companyProfileOverride?: Partial<CompanyProfile>): void {
    if (typeof window === 'undefined') return;

    const setRaw = (baseKey: string, val: any) => {
      const key = getPartitionKey(baseKey, companyId);
      window.localStorage.setItem(key, JSON.stringify(val));
    };

    // Clean accounts with 0 balance
    const cleanAccounts = INITIAL_ACCOUNTS.map((acc) => ({ ...acc, balance: 0 }));
    // Clean customers with 0 balance
    const cleanCustomers = INITIAL_CUSTOMERS.map((c) => ({ ...c, balance: 0, openingBalance: 0 }));
    // Clean suppliers with 0 balance
    const cleanSuppliers = INITIAL_SUPPLIERS.map((s) => ({ ...s, balance: 0, openingBalance: 0 }));

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

    if (companyProfileOverride) {
      const current = window.localStorage.getItem(getPartitionKey(STORAGE_PREFIX.COMPANY, companyId));
      const parsed = current ? safeJsonParse<CompanyProfile>(current, DEFAULT_COMPANY_PROFILE) : DEFAULT_COMPANY_PROFILE;
      setRaw(STORAGE_PREFIX.COMPANY, { ...parsed, ...companyProfileOverride, id: companyId });
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
