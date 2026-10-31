/**
 * Firebase Multi-Tenant Company Initialization & Management Service
 * Ensures every new company has its complete Firestore collection hierarchy provisioned:
 *   companies/{companyId}/
 *     ├── meta/profile
 *     ├── accounts/{accountId} (29 standard IFRS clean accounts)
 *     ├── warehouses/{warehouseId} (Main warehouse)
 *     ├── units/{unitId} (Standard measurement units)
 *     ├── partners/{partnerId} (Default cash partner)
 *     ├── customers/{customerId} (Default cash customer)
 *     ├── documents/{docId} (Document registry root)
 *     └── journalEntries/{entryId} (General Ledger journal root)
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, getDocs, collection, writeBatch } from 'firebase/firestore';
import firebaseConfigJson from '../../firebase-applet-config.json';

// Initialize Firebase App
export const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfigJson) : getApp();
export const firestoreDb = getFirestore(firebaseApp, firebaseConfigJson.firestoreDatabaseId);

// Target 29 standard verified chart of accounts
export const STANDARD_CHART_OF_ACCOUNTS_TEMPLATE = [
  { code: '1000', nameAr: 'الأصول', nameEn: 'Assets', category: 'ASSET', parentId: null, level: 1, normalBalance: 'DEBIT', type: 'ROOT' },
  { code: '1100', nameAr: 'الأصول المتداولة', nameEn: 'Current Assets', category: 'ASSET', parentId: 'acc-1000', level: 2, normalBalance: 'DEBIT', type: 'HEADER' },
  { code: '1110', nameAr: 'النقدية وما في حكمها', nameEn: 'Cash & Cash Equivalents', category: 'ASSET', parentId: 'acc-1100', level: 3, normalBalance: 'DEBIT', type: 'HEADER' },
  { code: '1111', nameAr: 'الحساب البنكي الجاري الرئيسي', nameEn: 'Main Operating Bank Account', category: 'ASSET', parentId: 'acc-1110', level: 4, normalBalance: 'DEBIT', type: 'DETAIL' },
  { code: '1112', nameAr: 'حساب بنك العمليات والمدفوعات', nameEn: 'Secondary Operations Bank Account', category: 'ASSET', parentId: 'acc-1110', level: 4, normalBalance: 'DEBIT', type: 'DETAIL' },
  { code: '1120', nameAr: 'الذمم المدينة (حسابات العملاء)', nameEn: 'Accounts Receivable', category: 'ASSET', parentId: 'acc-1100', level: 3, normalBalance: 'DEBIT', type: 'HEADER' },
  { code: '1121', nameAr: 'العملاء والجمعيات التعاونية والمدينون', nameEn: 'Trade & Cooperative Debtors', category: 'ASSET', parentId: 'acc-1120', level: 4, normalBalance: 'DEBIT', type: 'DETAIL' },
  { code: '1130', nameAr: 'مخزون البضائع والمنتجات', nameEn: 'Merchandise & Inventory', category: 'ASSET', parentId: 'acc-1100', level: 3, normalBalance: 'DEBIT', type: 'HEADER' },
  { code: '1131', nameAr: 'مخزون المنتجات التامة الصنع والمستودعات', nameEn: 'Finished Goods Inventory', category: 'ASSET', parentId: 'acc-1130', level: 4, normalBalance: 'DEBIT', type: 'DETAIL' },
  { code: '2000', nameAr: 'الخصوم والالتزامات', nameEn: 'Liabilities', category: 'LIABILITY', parentId: null, level: 1, normalBalance: 'CREDIT', type: 'ROOT' },
  { code: '2100', nameAr: 'الخصوم المتداولة (قصيرة الأجل)', nameEn: 'Current Liabilities', category: 'LIABILITY', parentId: 'acc-2000', level: 2, normalBalance: 'CREDIT', type: 'HEADER' },
  { code: '2110', nameAr: 'الذمم الدائنة (حسابات الموردين)', nameEn: 'Accounts Payable', category: 'LIABILITY', parentId: 'acc-2100', level: 3, normalBalance: 'CREDIT', type: 'HEADER' },
  { code: '2111', nameAr: 'موردو المواد والسلع التجارية', nameEn: 'Trade Creditors & Suppliers', category: 'LIABILITY', parentId: 'acc-2110', level: 4, normalBalance: 'CREDIT', type: 'HEADER' },
  { code: '2111001', nameAr: 'حساب الموردين التجاريين المعتمدين', nameEn: 'Approved Trade Suppliers', category: 'LIABILITY', parentId: 'acc-2111', level: 5, normalBalance: 'CREDIT', type: 'DETAIL' },
  { code: '2120', nameAr: 'أرصدة دائنة أخرى ومصروفات مستحقة', nameEn: 'Accrued Expenses & Other Payables', category: 'LIABILITY', parentId: 'acc-2100', level: 3, normalBalance: 'CREDIT', type: 'HEADER' },
  { code: '2122', nameAr: 'إيجارات ومصروفات تشغيلية مستحقة الدفع', nameEn: 'Accrued Operating Expenses & Rent', category: 'LIABILITY', parentId: 'acc-2120', level: 4, normalBalance: 'CREDIT', type: 'DETAIL' },
  { code: '3000', nameAr: 'حقوق الملكية', nameEn: 'Equity', category: 'EQUITY', parentId: null, level: 1, normalBalance: 'CREDIT', type: 'ROOT' },
  { code: '3100', nameAr: 'رأس المال المكتتب به / الأرصدة الافتتاحية', nameEn: 'Paid-in Capital / Opening Reserves', category: 'EQUITY', parentId: 'acc-3000', level: 2, normalBalance: 'CREDIT', type: 'HEADER' },
  { code: '3110', nameAr: 'رأس مال المنشأة المدفوع', nameEn: "Owner's / Paid-up Capital", category: 'EQUITY', parentId: 'acc-3100', level: 3, normalBalance: 'CREDIT', type: 'DETAIL' },
  { code: '3120', nameAr: 'الحساب الجاري للشركاء / صاحب المنشأة', nameEn: "Partners' / Owner Current Account", category: 'EQUITY', parentId: 'acc-3000', level: 2, normalBalance: 'CREDIT', type: 'HEADER' },
  { code: '31202', nameAr: 'الحساب الجاري للشركاء والمساهمين', nameEn: 'Partners Equity Current Account', category: 'EQUITY', parentId: 'acc-3120', level: 3, normalBalance: 'CREDIT', type: 'DETAIL' },
  { code: '4000', nameAr: 'الإيرادات والمبيعات', nameEn: 'Revenues', category: 'REVENUE', parentId: null, level: 1, normalBalance: 'CREDIT', type: 'ROOT' },
  { code: '4100', nameAr: 'إيرادات مبيعات النشاط الرئيسي', nameEn: 'Main Business Operating Revenues', category: 'REVENUE', parentId: 'acc-4000', level: 2, normalBalance: 'CREDIT', type: 'HEADER' },
  { code: '4110', nameAr: 'إيرادات المبيعات التجارية والخدمية', nameEn: 'Commercial & Sales Income', category: 'REVENUE', parentId: 'acc-4100', level: 3, normalBalance: 'CREDIT', type: 'DETAIL' },
  { code: '5000', nameAr: 'المصروفات والتكاليف', nameEn: 'Expenses', category: 'EXPENSE', parentId: null, level: 1, normalBalance: 'DEBIT', type: 'ROOT' },
  { code: '5100', nameAr: 'تكلفة البضاعة المباعة وتكاليف التشغيل (COGS)', nameEn: 'Cost of Goods Sold (COGS)', category: 'EXPENSE', parentId: 'acc-5000', level: 2, normalBalance: 'DEBIT', type: 'HEADER' },
  { code: '5110', nameAr: 'تكلفة المواد والسلع المستهلكة المباعة', nameEn: 'Cost of Consumed Goods Sold', category: 'EXPENSE', parentId: 'acc-5100', level: 3, normalBalance: 'DEBIT', type: 'DETAIL' },
  { code: '5400', nameAr: 'المصروفات والعمولات البنكية والتمويلية', nameEn: 'Bank & Financial Fees', category: 'EXPENSE', parentId: 'acc-5000', level: 2, normalBalance: 'DEBIT', type: 'HEADER' },
  { code: '5410', nameAr: 'عمولات ورسوم بنكية ورسوم K-Net وPOS', nameEn: 'Bank & POS Card Processing Fees', category: 'EXPENSE', parentId: 'acc-5400', level: 3, normalBalance: 'DEBIT', type: 'DETAIL' },
];

export const STANDARD_UNITS_TEMPLATE = [
  { id: 'u-pcs', code: 'PCS', nameAr: 'حبة / قطعة', nameEn: 'Piece', conversionFactor: 1, isBaseUnit: true, description: 'الوحدة الفردية الأساسية' },
  { id: 'u-ctn', code: 'CTN', nameAr: 'كرتون', nameEn: 'Carton', conversionFactor: 12, isBaseUnit: false, description: 'كرتون تعبئة (12 حبة)' },
  { id: 'u-pk', code: 'PK', nameAr: 'شدة / طرد', nameEn: 'Pack', conversionFactor: 6, isBaseUnit: false, description: 'شدة مغلفة (6 حبات)' },
  { id: 'u-box', code: 'BOX', nameAr: 'صندوق', nameEn: 'Box', conversionFactor: 24, isBaseUnit: false, description: 'صندوق كبير (24 حبة)' },
  { id: 'u-dzn', code: 'DZN', nameAr: 'درزن', nameEn: 'Dozen', conversionFactor: 12, isBaseUnit: false, description: 'درزن (12 حبة)' },
  { id: 'u-kg', code: 'KG', nameAr: 'كيلوجرام', nameEn: 'Kilogram', conversionFactor: 1, isBaseUnit: true, description: 'وحدة الوزن الأساسية بالكيلو' },
];

// Helper to remove any undefined or non-serializable fields for Firestore
function sanitizeDoc<T>(obj: T): any {
  return JSON.parse(JSON.stringify(obj, (key, value) => {
    if (value === undefined) return null;
    return value;
  }));
}

/**
 * Check if a company has already been initialized in Firestore
 */
export async function checkCompanyInitializedInFirebase(companyId: string): Promise<boolean> {
  try {
    if (!companyId) return false;
    const profileRef = doc(firestoreDb, `companies/${companyId}/meta/profile`);
    const snap = await getDoc(profileRef);
    return snap.exists();
  } catch (error) {
    console.warn(`[Firebase] Check error for company ${companyId}:`, error);
    return false;
  }
}

export interface InitializeNewCompanyOptions {
  customAccounts?: any[];
  customWarehouseName?: string;
  customCurrency?: string;
  customCity?: string;
}

/**
 * Centralized Initializer for New Companies in Firebase Firestore
 * Creates the complete isolated hierarchy under companies/{companyId}/
 */
export async function initializeNewCompany(
  firstArg: string | any,
  secondArg?: any,
  options?: InitializeNewCompanyOptions
): Promise<{ success: boolean; message: string; details?: any }> {
  try {
    let companyId: string;
    let companyProfile: any;

    if (typeof firstArg === 'object' && firstArg !== null) {
      companyId = firstArg.id || firstArg.companyId || firstArg.company_id;
      companyProfile = firstArg.profile || firstArg.profile_data || firstArg;
    } else {
      companyId = firstArg;
      companyProfile = secondArg || {};
    }

    if (!companyId) {
      throw new Error('Company ID is required to initialize Firebase collections');
    }

    const cleanCompanyId = String(companyId).trim();
    const basePath = `companies/${cleanCompanyId}`;
    const nowIso = new Date().toISOString();
    const todayStr = nowIso.split('T')[0];

    const companyName = companyProfile?.nameAr || companyProfile?.company_name || companyProfile?.name || 'المنشأة الجديدة';
    const companyNameEn = companyProfile?.nameEn || companyProfile?.name_en || '';
    const currency = options?.customCurrency || companyProfile?.currency || companyProfile?.functional_currency || 'KWD';
    const currencySymbol = currency === 'KWD' ? 'د.ك' : currency === 'SAR' ? 'ر.س' : currency;
    const city = options?.customCity || companyProfile?.city || 'الكويت';
    const country = companyProfile?.country || 'دولة الكويت';

    console.log(`[Firebase] Initializing collections hierarchy for company: ${companyName} (${cleanCompanyId})...`);

    // 1. Meta / Profile Document
    const profileDoc = {
      id: cleanCompanyId,
      name: companyName,
      nameAr: companyName,
      nameEn: companyNameEn,
      tradeName: companyProfile.tradeName || companyName,
      legalForm: companyProfile.legalForm || 'شركة ذات مسؤولية محدودة (ذ.م.م)',
      crNumber: companyProfile.crNumber || companyProfile.login_code || '',
      taxNumber: companyProfile.taxNumber || '',
      currency,
      currencySymbol,
      currency_symbol: currencySymbol,
      decimalPlaces: currency === 'KWD' ? 3 : 2,
      decimal_places: currency === 'KWD' ? 3 : 2,
      functionalCurrency: currency,
      functional_currency: currency,
      country,
      city,
      phone: companyProfile.phone || '',
      email: companyProfile.email || companyProfile.owner_email || '',
      status: companyProfile.status || 'active',
      is_firebase_initialized: true,
      created_at: companyProfile.created_at || nowIso,
      updated_at: nowIso,
    };

    // 2. Chart of Accounts (29 Clean Standard IFRS Accounts with 0 Balances)
    const accounts = (options?.customAccounts && options.customAccounts.length > 0)
      ? options.customAccounts.map(a => ({
          ...a,
          id: a.id || `acc-${a.code}`,
          companyId: cleanCompanyId,
          company_id: cleanCompanyId,
          balance: 0,
          opening_balance: 0,
          currency,
          isActive: true,
          created_at: nowIso,
          updated_at: nowIso,
        }))
      : STANDARD_CHART_OF_ACCOUNTS_TEMPLATE.map(a => ({
          id: `acc-${a.code}`,
          code: a.code,
          nameAr: a.nameAr,
          name_ar: a.nameAr,
          nameEn: a.nameEn,
          name_en: a.nameEn,
          category: a.category,
          parentId: a.parentId,
          parent_id: a.parentId,
          level: a.level,
          normalBalance: a.normalBalance,
          normal_balance: a.normalBalance,
          type: a.type,
          isSystem: true,
          is_system: true,
          isActive: true,
          is_active: true,
          isPostable: a.type === 'DETAIL',
          is_postable: a.type === 'DETAIL',
          balance: 0,
          opening_balance: 0,
          currency,
          companyId: cleanCompanyId,
          company_id: cleanCompanyId,
          created_at: nowIso,
          updated_at: nowIso,
        }));

    // 3. Main Starting Warehouse
    const warehouseId = `wh-${cleanCompanyId.slice(0, 8)}-01`;
    const warehouseDoc = {
      id: warehouseId,
      companyId: cleanCompanyId,
      company_id: cleanCompanyId,
      code: 'WH-01',
      nameAr: options?.customWarehouseName || 'المستودع الرئيسي العام',
      nameEn: 'Main General Warehouse',
      location: city,
      keeperName: 'مسؤول المستودع',
      isDefault: true,
      isActive: true,
      is_active: true,
      created_at: nowIso,
      updated_at: nowIso,
    };

    // 4. Units
    const units = STANDARD_UNITS_TEMPLATE.map(u => ({
      ...u,
      companyId: cleanCompanyId,
      company_id: cleanCompanyId,
      created_at: nowIso,
    }));

    // 5. Default Cash Customer & Partner
    const partnerId = `cust-${cleanCompanyId.slice(0, 8)}-cash`;
    const defaultPartner = {
      id: partnerId,
      company_id: cleanCompanyId,
      companyId: cleanCompanyId,
      type: 'CUSTOMER',
      code: 'CUST-CASH',
      nameAr: 'عميل نقدي عام (كاش)',
      name_ar: 'عميل نقدي عام (كاش)',
      nameEn: 'General Cash Customer',
      name_en: 'General Cash Customer',
      phone: '',
      email: '',
      address: '',
      city,
      balance: 0,
      creditLimit: 0,
      accountId: 'acc-1121',
      isActive: true,
      is_active: true,
      created_at: nowIso,
      updated_at: nowIso,
    };

    // 6. Starting Document Root Marker
    const docInit = {
      id: `doc-${cleanCompanyId.slice(0, 8)}-init`,
      company_id: cleanCompanyId,
      branch_id: 'br-main',
      doc_type: 'SYSTEM_INIT',
      doc_number: 'SYS-INIT-01',
      doc_date: todayStr,
      status: 'POSTED',
      notes: 'تهيئة مساحة المستندات السحابية للمنشأة',
      subtotal: 0,
      grand_total: 0,
      lines: [],
      created_by: 'system_initialization',
      created_at: nowIso,
      updated_at: nowIso,
    };

    // 7. Starting General Ledger Journal Entry Marker
    const journalInit = {
      id: `jv-${cleanCompanyId.slice(0, 8)}-init`,
      company_id: cleanCompanyId,
      entry_number: 'JV-INIT-01',
      date: todayStr,
      description: 'تهيئة دفتر الأستاذ العام وقيود اليومية للمنشأة',
      status: 'POSTED',
      source_document_type: 'SYSTEM_INIT',
      total_debit: 0,
      total_credit: 0,
      is_balanced: true,
      lines: [],
      created_by: 'system_initialization',
      created_at: nowIso,
      updated_at: nowIso,
    };

    // Commit everything in Batches to Firestore
    const batch = writeBatch(firestoreDb);

    // Meta Profile
    batch.set(doc(firestoreDb, `${basePath}/meta/profile`), sanitizeDoc(profileDoc));

    // Warehouse
    batch.set(doc(firestoreDb, `${basePath}/warehouses/${warehouseDoc.id}`), sanitizeDoc(warehouseDoc));

    // Partner & Customer
    batch.set(doc(firestoreDb, `${basePath}/partners/${defaultPartner.id}`), sanitizeDoc(defaultPartner));
    batch.set(doc(firestoreDb, `${basePath}/customers/${defaultPartner.id}`), sanitizeDoc(defaultPartner));

    // Units
    for (const unit of units) {
      batch.set(doc(firestoreDb, `${basePath}/units/${unit.id}`), sanitizeDoc(unit));
    }

    // Documents root marker
    batch.set(doc(firestoreDb, `${basePath}/documents/${docInit.id}`), sanitizeDoc(docInit));

    // Journal entries root marker
    batch.set(doc(firestoreDb, `${basePath}/journalEntries/${journalInit.id}`), sanitizeDoc(journalInit));

    // Accounts (29 standard accounts)
    for (const acc of accounts) {
      batch.set(doc(firestoreDb, `${basePath}/accounts/${acc.id}`), sanitizeDoc(acc));
    }

    await batch.commit();

    console.log(`[Firebase] ✓ Company "${companyName}" successfully initialized in Firestore under ${basePath}/`);

    return {
      success: true,
      message: `تم بنجاح إنشاء وتهيئة هيكل شركة "${companyName}" على Firebase Firestore (شجرة الحسابات، المستودع، الشركاء، المستندات، والقيود).`,
      details: {
        companyId: cleanCompanyId,
        collectionsCreated: ['meta/profile', 'accounts', 'warehouses', 'units', 'partners', 'customers', 'documents', 'journalEntries'],
        accountsCount: accounts.length,
        warehouseId: warehouseDoc.id,
      },
    };
  } catch (error: any) {
    console.error(`[Firebase] Failed to initialize company ${companyId}:`, error);
    return {
      success: false,
      message: `فشل تهيئة هيكل الشركة في Firebase: ${error?.message || 'خطأ غير معروف'}`,
    };
  }
}
