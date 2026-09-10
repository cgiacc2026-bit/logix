/**
 * Universal Data & Accounting Service with Full IFRS Accounting Engine & Cloud Firebase Sync
 * Completely eliminates any "JSON.parse: unexpected end of data" runtime crashes.
 */

import {
  Account,
  Customer,
  Supplier,
  InventoryItem,
  JournalEntry,
  Invoice,
  PaymentVoucher,
  CompanyProfile,
  SystemUser,
  UnitDefinition,
  ProductionOrder,
  ProductionOrderStatus,
  ManufacturingStandardSettings,
  ManufacturingIndustryType,
  FinancialKPIs,
  GeneralLedgerReport,
  TrialBalanceReport,
  IncomeStatementReport,
  BalanceSheetReport,
  CashFlowReport,
  DefaultAccountsMapping,
  Quotation,
  QuotationLine,
  SalesRep,
} from '../types.js';
import {
  DEFAULT_COMPANY_PROFILE,
  INITIAL_USERS,
  INITIAL_ACCOUNTS,
  INITIAL_CUSTOMERS,
  INITIAL_SUPPLIERS,
  INITIAL_INVENTORY,
  INITIAL_JOURNALS,
  INITIAL_INVOICES,
  INITIAL_UNITS,
} from '../server/defaultData.js';
import { safeJsonParse, safeApiFetch } from '../utils/safeJson.js';
import { SupabaseDataService } from './supabaseService.js';
import { isSupabaseConfigured, resolveToSupabaseCompanyUUID } from './supabaseClient.js';
import {
  DEMO_COMPANY,
  DEMO_USER,
  DEMO_SEED_ITEMS,
  DEMO_SEED_CUSTOMERS,
  DEMO_SEED_SUPPLIERS,
  DEMO_SEED_INVOICES,
  DEMO_SEED_JOURNALS,
  DEMO_SEED_VOUCHERS,
  isDemoActive,
} from './demoService.js';
import { ThemeService } from './themeService.ts';
import { cacheService } from './cacheService.ts';
import { backgroundSync } from './backgroundSyncService.ts';

const STORAGE_KEYS = {
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
  MANUFACTURING_SETTINGS: 'alwaleed_erp_mfg_settings',
  QUOTATIONS: 'alwaleed_erp_quotations',
  SALES_REPS: 'alwaleed_erp_sales_reps',
};

export const DEFAULT_MANUFACTURING_PROFILES: Record<ManufacturingIndustryType, ManufacturingStandardSettings> = {
  FOOD_MILLING: {
    industryType: 'FOOD_MILLING',
    standardCategories: [
      { id: 'cat-raw-spices', nameAr: 'بهارات وتوابل خام أولية', nameEn: 'Raw Spices & Herbs', type: 'INPUT' },
      { id: 'cat-raw-grains', nameAr: 'حبوب وبذور خام', nameEn: 'Raw Grains & Seeds', type: 'INPUT' },
      { id: 'cat-food-pkg', nameAr: 'مواد تعبئة وتغليف غذائي', nameEn: 'Food Packaging', type: 'INPUT' },
      { id: 'cat-additives', nameAr: 'نكهات وإضافات طبيعية', nameEn: 'Natural Flavors', type: 'INPUT' },
      { id: 'cat-ground-pure', nameAr: 'بهارات مطحونة نقية تامة', nameEn: 'Pure Ground Spices', type: 'OUTPUT' },
      { id: 'cat-spice-blends', nameAr: 'خلطات بهارات فاخرة معبأة', nameEn: 'Packaged Spice Blends', type: 'OUTPUT' },
      { id: 'cat-co-bran', nameAr: 'منتجات فرعية (نخالة وقشور)', nameEn: 'Bran & By-Products', type: 'OUTPUT' },
      { id: 'cat-scrap-sift', nameAr: 'هالك غربلة وتنقية', nameEn: 'Sifting Waste', type: 'OUTPUT' },
    ],
    standardLines: [
      { id: 'line-mill-1', nameAr: 'خط الطحن والتنعيم الميكانيكي 01', nameEn: 'Milling Line 01', description: 'طحن فائق النعومة للبهارات الجافة' },
      { id: 'line-roast-sift', nameAr: 'خط الغربلة والتنقية والتحميص', nameEn: 'Sifting & Roasting Line', description: 'تنقية الحبوب وتحميصها بدرجات حرارة معيارية' },
      { id: 'line-blend-1', nameAr: 'خط الخلط والمجانسة الآلي', nameEn: 'Auto Blending Line', description: 'خلط دقيق للبهارات المشكلة والبهارات الخاصة' },
      { id: 'line-pack-nitro', nameAr: 'خط التعبئة والختم النيتروجيني', nameEn: 'Nitrogen Pack Line', description: 'تعبئة عبوات وأكياس مع حفظ النكهة' },
    ],
    standardWorkstations: [
      { id: 'ws-sift', nameAr: 'محطة الغربلة ونزع الشوائب' },
      { id: 'ws-mill', nameAr: 'محطة الطواحين الميكانيكية' },
      { id: 'ws-blend', nameAr: 'محطة خلاطات الدفعات' },
      { id: 'ws-pack', nameAr: 'محطة موازين التعبئة والتغليف' },
      { id: 'ws-qc-lab', nameAr: 'محطة الفحص المخبري وضبط الجودة' },
    ],
  },
  ELECTRICAL_LIGHTING: {
    industryType: 'ELECTRICAL_LIGHTING',
    standardCategories: [
      { id: 'cat-smd-led', nameAr: 'شرائح ومصفوفات LED الإلكترونية', nameEn: 'LED SMD Modules', type: 'INPUT' },
      { id: 'cat-drivers', nameAr: 'محولات ودوائر التشغيل (Drivers)', nameEn: 'LED Power Drivers', type: 'INPUT' },
      { id: 'cat-heatsink', nameAr: 'هياكل ومشتتات حرارية ألومنيوم', nameEn: 'Aluminum Heat Sinks', type: 'INPUT' },
      { id: 'cat-optics', nameAr: 'عدسات وأغطية بصرية ناشرة', nameEn: 'Diffusers & Optics', type: 'INPUT' },
      { id: 'cat-wires', nameAr: 'أسلاك وموصلات نحاسية معزولة', nameEn: 'Wires & Connectors', type: 'INPUT' },
      { id: 'cat-elec-pkg', nameAr: 'كراتين حماية ممتصة للصدمات', nameEn: 'Shockproof Packaging', type: 'INPUT' },
      { id: 'cat-finished-bulbs', nameAr: 'لمبات ووحدات إنارة ليد تامة', nameEn: 'Finished LED Luminaires', type: 'OUTPUT' },
      { id: 'cat-co-subassy', nameAr: 'وحدات نصف مصنعة (WIP)', nameEn: 'Sub-Assemblies', type: 'OUTPUT' },
      { id: 'cat-scrap-elec', nameAr: 'هالك لحام وتجميع وأسلاك', nameEn: 'Assembly Scrap', type: 'OUTPUT' },
    ],
    standardLines: [
      { id: 'line-smt-mount', nameAr: 'خط التركيب السطحي واللحام SMT', nameEn: 'SMT Placement Line', description: 'تثبيت ولحام رقائق الليد على اللوحات المطبوعة' },
      { id: 'line-mech-assy', nameAr: 'خط التجميع الميكانيكي والهياكل', nameEn: 'Mechanical Assembly Line', description: 'تركيب المشتتات والعدسات والمحولات' },
      { id: 'line-burn-in', nameAr: 'خط اختبار الحرق والتحمل (Burn-in)', nameEn: 'Burn-in Test Chamber', description: 'تشغيل مستمر بدرجات جهد متغيرة لكشف العيوب المبكرة' },
      { id: 'line-elec-pack', nameAr: 'خط الفحص الكهربائي النهائي والتغليف', nameEn: 'Testing & Packaging Line', description: 'قياس كفاءة اللومن والعزل والتغليف الآلي' },
    ],
    standardWorkstations: [
      { id: 'ws-pick-place', nameAr: 'محطة ماكينة SMT والتثبيت' },
      { id: 'ws-reflow', nameAr: 'محطة فرن اللحام الحراري Reflow' },
      { id: 'ws-housing', nameAr: 'محطة تجميع الهيكل وتطبيق المعجون الحراري' },
      { id: 'ws-burn-rack', nameAr: 'محطة حوامل اختبار الحرق والجهد' },
      { id: 'ws-hipot', nameAr: 'محطة اختبار العزل الكهربائي Hi-Pot' },
    ],
  },
  CHEMICALS_DETERGENTS: {
    industryType: 'CHEMICALS_DETERGENTS',
    standardCategories: [
      { id: 'cat-surfactants', nameAr: 'مواد فعالة سطحياً وسلفونيك', nameEn: 'Surfactants & Acids', type: 'INPUT' },
      { id: 'cat-alkalis', nameAr: 'قلويات ومحسنات قوام ورغوة', nameEn: 'Alkalis & Stabilizers', type: 'INPUT' },
      { id: 'cat-perfumes', nameAr: 'عطور ومواد حافظة وملونات', nameEn: 'Fragrances & Colorants', type: 'INPUT' },
      { id: 'cat-chem-bottles', nameAr: 'عبوات بلاستيكية وبخاخات وأغطية', nameEn: 'Bottles, Pumps & Caps', type: 'INPUT' },
      { id: 'cat-labels', nameAr: 'ملصقات وبطاقات بيانات كيميائية', nameEn: 'Chemical Labels & SDS', type: 'INPUT' },
      { id: 'cat-finished-chem', nameAr: 'منظفات ومطهرات سائلة تامة الصنع', nameEn: 'Finished Detergents & Disinfectants', type: 'OUTPUT' },
      { id: 'cat-scrap-chem', nameAr: 'هالك تعبئة ورواسب خلط', nameEn: 'Mixing Sludge & Spillage', type: 'OUTPUT' },
    ],
    standardLines: [
      { id: 'line-react-mix', nameAr: 'خط المفاعلات والخلط المتجانس', nameEn: 'Homogenization Reactors', description: 'خلط وتفاعل المركبات الكيميائية بدرجات حرارة مضبوطة' },
      { id: 'line-vol-fill', nameAr: 'خط التعبئة الحجمية الآلية', nameEn: 'Volumetric Filling Line', description: 'تعبئة دقيقة للسوائل المركزة في العبوات' },
      { id: 'line-cap-label', nameAr: 'خط تركيب الأغطية والوسم الأوتوماتيكي', nameEn: 'Capping & Labeling Line', description: 'إحكام الإغلاق وطباعة تاريخ الصلاحية والباركود' },
    ],
    standardWorkstations: [
      { id: 'ws-reactor-1', nameAr: 'محطة مفاعل الخلط الرئيسي' },
      { id: 'ws-viscosity', nameAr: 'محطة ضبط اللزوجة والرقم الهيدروجيني pH' },
      { id: 'ws-nozzles', nameAr: 'محطة فوهات التعبئة الآلية' },
      { id: 'ws-capper', nameAr: 'محطة ربط الأغطية بالهواء المضغوط' },
      { id: 'ws-labeler', nameAr: 'محطة لصق البطاقات وطباعة الدفعة' },
    ],
  },
  PACKAGING_CONVERTING: {
    industryType: 'PACKAGING_CONVERTING',
    standardCategories: [
      { id: 'cat-paper-reels', nameAr: 'رولات ورق مقوى وكرافت', nameEn: 'Kraft & Fluting Paper Reels', type: 'INPUT' },
      { id: 'cat-inks-glue', nameAr: 'أحبار مائية وغراء صناعي نشوي', nameEn: 'Water Inks & Starch Glue', type: 'INPUT' },
      { id: 'cat-strapping', nameAr: 'أشرطة تحزيم وأفلام استريتش', nameEn: 'Strapping & Stretch Films', type: 'INPUT' },
      { id: 'cat-finished-boxes', nameAr: 'كراتين مضلعة مطبوعة تامة الصنع', nameEn: 'Finished Corrugated Boxes', type: 'OUTPUT' },
      { id: 'cat-scrap-paper', nameAr: 'قصاصات وهالك ورق قابل للتدوير', nameEn: 'Recyclable Paper Offcuts', type: 'OUTPUT' },
    ],
    standardLines: [
      { id: 'line-corrugator', nameAr: 'خط إنتاج الكرتون المضلع (Corrugator)', nameEn: 'Corrugator Line', description: 'تمويج ولصق طبقات الورق' },
      { id: 'line-flexo-die', nameAr: 'خط الطباعة فليكسو والتكسير والقص', nameEn: 'Flexo Printing & Die-Cut', description: 'طباعة متعددة الألوان وقص دقيق' },
      { id: 'line-fold-glue', nameAr: 'خط الطي واللصق والتحزيم الآلي', nameEn: 'Folder Gluer & Strapping', description: 'طي أوتوماتيكي ولصق الحواف وتحزيم البالات' },
    ],
    standardWorkstations: [
      { id: 'ws-reel-stand', nameAr: 'محطة حوامل رولات الورق' },
      { id: 'ws-flexo-print', nameAr: 'محطة وحدات الطباعة فليكسو' },
      { id: 'ws-rotary-die', nameAr: 'محطة قالب التكسير الدوار' },
      { id: 'ws-gluer', nameAr: 'محطة حقن الغراء والكبس' },
      { id: 'ws-bundler', nameAr: 'محطة الرص والتحزيم على طبالي' },
    ],
  },
  GENERAL_ASSEMBLY: {
    industryType: 'GENERAL_ASSEMBLY',
    standardCategories: [
      { id: 'cat-gen-raw', nameAr: 'مواد خام ومكونات أساسية', nameEn: 'Raw Materials', type: 'INPUT' },
      { id: 'cat-gen-parts', nameAr: 'أجزاء وقطع تجميع نصف مصنعة', nameEn: 'Assembly Parts', type: 'INPUT' },
      { id: 'cat-gen-fasteners', nameAr: 'مسامير ومثبتات ومواد تثبيت', nameEn: 'Fasteners & Hardware', type: 'INPUT' },
      { id: 'cat-gen-pack', nameAr: 'مستلزمات تعبئة وتغليف وحماية', nameEn: 'Packaging & Boxing', type: 'INPUT' },
      { id: 'cat-gen-finished', nameAr: 'منتجات تامة الصنع وجاهزة للتوزيع', nameEn: 'Finished Goods', type: 'OUTPUT' },
      { id: 'cat-gen-wip', nameAr: 'منتجات قيد التشغيل (WIP)', nameEn: 'Work In Progress', type: 'OUTPUT' },
      { id: 'cat-gen-scrap', nameAr: 'مخلفات وهالك تشغيل وإنتاج', nameEn: 'Production Scrap & Waste', type: 'OUTPUT' },
    ],
    standardLines: [
      { id: 'line-gen-prep', nameAr: 'خط التجهيز والقص والمعالجة', nameEn: 'Preparation & Cutting Line', description: 'تجهيز الخامات وقطعها وضبط المقاسات' },
      { id: 'line-gen-assy', nameAr: 'خط التجميع والتركيب الرئيسي', nameEn: 'Main Assembly Line', description: 'تجميع المكونات وبناء المنتج النهائي' },
      { id: 'line-gen-test', nameAr: 'خط الفحص والاختبار والمعايرة', nameEn: 'Inspection & Testing Line', description: 'فحص الأداء والتطابق مع المواصفات الفنية' },
      { id: 'line-gen-pack', nameAr: 'خط التعبئة والتغليف النهائي', nameEn: 'Final Packaging Line', description: 'التغليف ووضع بطاقات التعريف والتسليم للمستودع' },
    ],
    standardWorkstations: [
      { id: 'ws-gen-prep', nameAr: 'محطة التجهيز المسبق' },
      { id: 'ws-gen-assembly', nameAr: 'محطة التجميع اليدوي والآلي' },
      { id: 'ws-gen-inspect', nameAr: 'محطة ضبط الجودة والفحص' },
      { id: 'ws-gen-packing', nameAr: 'محطة التعبئة والرص' },
    ],
  },
};

export const INITIAL_PRODUCTION_ORDERS: ProductionOrder[] = [
  {
    id: 'prd-001',
    orderNumber: 'PRD-2026-001',
    date: '2026-08-10',
    targetItemId: 'inv-102',
    targetItemNameAr: 'فلفل اسود ناعم 80 جم',
    targetSku: '2881016018610',
    targetQuantity: 200,
    targetUnit: 'حبة',
    rawMaterials: [
      {
        itemId: 'inv-101',
        itemSku: '2881016018603',
        itemNameAr: 'فلفل اسود حب 80 جم (مادة خام)',
        unit: 'حبة',
        quantityRequired: 200,
        unitCost: 0.24,
        totalCost: 48.0,
      },
    ],
    overheadCost: 6.0,
    totalProductionCost: 54.0,
    unitProductionCost: 0.27,
    status: 'COMPLETED',
    notes: 'تشغيل خط الطحن والتعبئة الآلية للمطحنة - تم الفحص والاعتماد',
    millLine: 'خط طحن وتعبئة البهارات رقم 1',
    operatorName: 'مودي جميل',
    createdAt: '2026-08-10T09:00:00.000Z',
    completedAt: '2026-08-10T14:30:00.000Z',
  },
];

export const INITIAL_SALES_REPS: SalesRep[] = [
  {
    id: 'rep-001',
    code: 'REP-01',
    nameAr: 'أحمد بن عبد العزيز الكندري',
    nameEn: 'Ahmed Al-Kandari',
    phone: '+965 9911 2233',
    email: 'ahmed.k@logix-erp.com',
    commissionRate: 2.5,
    targetAmount: 50000,
    isActive: true,
    notes: 'مندوب كبار العملاء والجمعيات التعاونية',
  },
  {
    id: 'rep-002',
    code: 'REP-02',
    nameAr: 'محمد بن طارق الفضلي',
    nameEn: 'Mohammed Al-Fadhli',
    phone: '+965 9944 5566',
    email: 'mohammed.f@logix-erp.com',
    commissionRate: 3.0,
    targetAmount: 35000,
    isActive: true,
    notes: 'مندوب قطاع التجزئة والمطاعم',
  },
];

export const INITIAL_QUOTATIONS: Quotation[] = [
  {
    id: 'quo-001',
    quotationNumber: 'QUO-2026-0001',
    date: '2026-09-01',
    expiryDate: '2026-09-30',
    customerId: 'cust-1',
    customerNameAr: 'شركة المطاحن الأولى للإنتاج الغذائي',
    salesRepId: 'rep-001',
    salesRepName: 'أحمد بن عبد العزيز الكندري',
    status: 'SENT',
    lines: [
      {
        id: 'qline-1',
        itemId: 'inv-101',
        itemSku: '2881016018603',
        itemNameAr: 'فلفل اسود حب 80 جم (مادة خام)',
        unit: 'حبة',
        quantity: 500,
        unitPrice: 0.25,
        subtotal: 125.0,
        vatRate: 0,
        vatAmount: 0,
        total: 125.0,
      },
    ],
    subtotal: 125.0,
    vatTotal: 0,
    discountTotal: 0,
    grandTotal: 125.0,
    notes: 'عرض سعر توريد بهارات خامات للمطاحن - ينتهي بعد 30 يوم',
    createdAt: '2026-09-01T10:00:00.000Z',
  },
];

/**
 * Generate a pristine, completely clean opening chart of accounts with 0 balances
 * Ensures no fake numbers or residual test balances exist for new companies.
 */
export function generateCleanChartOfAccounts(companyId?: string): Account[] {
  return INITIAL_ACCOUNTS.map((acc) => ({
    ...acc,
    id: `acc-${acc.code}`,
    balance: 0,
    isActive: true,
  }));
}

/**
 * Automatically determine default accounting mapping based on active company's chart of accounts
 */
export function getDefaultMappingForAccounts(accounts: Account[]): DefaultAccountsMapping {
  const findId = (code: string, keywords: string[]): string | undefined => {
    const byCode = accounts.find((a) => a.code === code);
    if (byCode) return byCode.id;
    const byKw = accounts.find((a) => {
      const ar = a.nameAr || '';
      const en = (a.nameEn || '').toLowerCase();
      return keywords.some((k) => ar.includes(k) || en.includes(k.toLowerCase()));
    });
    return byKw ? byKw.id : undefined;
  };

  return {
    cashAccountId: findId('1113', ['صندوق', 'خزينة', 'cash']),
    bankAccountId: findId('1111', ['بنك', 'bank']),
    receivableAccountId: findId('1120', ['عملاء', 'مدينون', 'receivable']),
    payableAccountId: findId('2110', ['موردين', 'دائنون', 'payable']),
    inventoryAccountId: findId('1130', ['مخزون', 'بضائع', 'inventory']),
    salesAccountId: findId('4100', ['مبيعات', 'إيراد', 'sales', 'revenue']),
    cogsAccountId: findId('5100', ['تكلفة', 'cogs', 'cost of goods']),
    retainedEarningsAccountId: findId('3200', ['أرباح مبقاة', 'أرباح مرحلة', 'retained earnings']),
    vatAccountId: findId('2120', ['ضريبة', 'vat', 'tax']),
  };
}

class LocalDataStore {
  private memoryFallback: Record<string, string> = {};

  public getEffectiveCompanyId(): string | null {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('supabase_company_id');
      if (saved && saved.trim()) return saved.trim();
    }
    return null;
  }

  public isAlWaleedActive(): boolean {
    const compId = this.getEffectiveCompanyId();
    if (!compId) return false;
    return (
      compId === '20000000-0000-0000-0000-000000000001' ||
      compId === 'company-alwaleed-client-003' ||
      compId.toLowerCase().includes('alwaleed') ||
      compId === '450912'
    );
  }

  public getKey(baseKey: string, specificCompanyId?: string): string {
    const rawId = specificCompanyId || this.getEffectiveCompanyId();
    if (!rawId) {
      return `${baseKey}_unauthenticated`;
    }
    if (isDemoActive() || rawId === '00000000-0000-0000-0000-000000000099' || rawId === 'company-demo-clients-002') {
      return `${baseKey}_demo`;
    }
    const compId = resolveToSupabaseCompanyUUID(rawId) || rawId;
    return `${baseKey}_${compId}`;
  }

  public getLocal<T>(key: string, defaultVal: T): T {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        let item = window.localStorage.getItem(key);
        if (!item) {
          const compId = this.getEffectiveCompanyId();
          if (compId && key.includes(compId)) {
            const rawId = window.localStorage.getItem('supabase_company_id');
            if (rawId && rawId !== compId) {
              item = window.localStorage.getItem(key.replace(compId, rawId));
            }
          }
        }
        if (item) return safeJsonParse<T>(item, defaultVal);
      }
    } catch (e) {
      console.warn('LocalStorage get error, using memory fallback:', e);
    }
    const memItem = this.memoryFallback[key];
    return memItem ? safeJsonParse<T>(memItem, defaultVal) : defaultVal;
  }

  public setLocal<T>(key: string, value: T): void {
    const serialized = JSON.stringify(value);
    this.memoryFallback[key] = serialized;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, serialized);
        const compId = this.getEffectiveCompanyId();
        if (compId && key.includes(compId)) {
          const rawId = window.localStorage.getItem('supabase_company_id');
          if (rawId && rawId !== compId) {
            window.localStorage.setItem(key.replace(compId, rawId), serialized);
          }
        }
      }
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
  }

  public markRestoreLocked(specificCompanyId?: string): void {
    const rawId = specificCompanyId || this.getEffectiveCompanyId();
    if (!rawId) return;
    const canonId = resolveToSupabaseCompanyUUID(rawId) || rawId;
    const lockObj = { timestamp: Date.now(), locked: true };
    const serialized = JSON.stringify(lockObj);

    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(`logix_restore_lock_${rawId}`, serialized);
      window.localStorage.setItem(`logix_restore_lock_${canonId}`, serialized);
      window.localStorage.setItem('logix_last_restored_company_id', canonId);
      window.localStorage.setItem('logix_last_restore_time', String(Date.now()));
    }
    this.memoryFallback[`logix_restore_lock_${rawId}`] = serialized;
    this.memoryFallback[`logix_restore_lock_${canonId}`] = serialized;
  }

  public isRestoreLocked(specificCompanyId?: string): boolean {
    const rawId = specificCompanyId || this.getEffectiveCompanyId();
    if (!rawId) return false;
    const canonId = resolveToSupabaseCompanyUUID(rawId) || rawId;

    const checkLock = (k: string) => {
      let lockObj = this.getLocal<{ timestamp: number; locked: boolean } | null>(k, null);
      if (!lockObj && typeof window !== 'undefined' && window.localStorage) {
        const item = window.localStorage.getItem(k);
        if (item) lockObj = safeJsonParse(item, null);
      }
      if (lockObj && lockObj.locked) {
        const elapsed = Date.now() - (lockObj.timestamp || 0);
        // Protect restored JSON data for 45 minutes against background cloud wipes
        if (elapsed < 45 * 60 * 1000) return true;
      }
      return false;
    };

    return checkLock(`logix_restore_lock_${canonId}`) || checkLock(`logix_restore_lock_${rawId}`);
  }

  public clearRestoreLock(specificCompanyId?: string): void {
    const rawId = specificCompanyId || this.getEffectiveCompanyId();
    if (!rawId) return;
    const canonId = resolveToSupabaseCompanyUUID(rawId) || rawId;
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(`logix_restore_lock_${rawId}`);
      window.localStorage.removeItem(`logix_restore_lock_${canonId}`);
    }
    delete this.memoryFallback[`logix_restore_lock_${rawId}`];
    delete this.memoryFallback[`logix_restore_lock_${canonId}`];
  }

  public getCompany(): CompanyProfile {
    const compId = this.getEffectiveCompanyId();
    const dedicatedLogo = typeof window !== 'undefined'
      ? window.localStorage.getItem(compId ? `logix_company_logo_${compId}` : 'logix_current_company_logo') || window.localStorage.getItem('logix_current_company_logo')
      : null;

    if (!compId) {
      const stored = this.getLocal<CompanyProfile | null>(this.getKey(STORAGE_KEYS.COMPANY), null);
      if (stored && stored.nameAr) {
        if (dedicatedLogo && !stored.logoUrl) stored.logoUrl = dedicatedLogo;
        return stored;
      }
      return {
        ...DEFAULT_COMPANY_PROFILE,
        id: '',
        nameAr: 'يرجى تسجيل الدخول واختيار المنشأة',
        nameEn: 'Please Login & Select Enterprise',
        logoUrl: dedicatedLogo || '',
      };
    }

    const stored = this.getLocal<CompanyProfile | null>(this.getKey(STORAGE_KEYS.COMPANY), null);
    if (stored && (stored.id === compId || !stored.id) && stored.nameAr) {
      if (dedicatedLogo && !stored.logoUrl) {
        stored.logoUrl = dedicatedLogo;
      }
      return stored;
    }

    if (compId === '10000000-0000-0000-0000-000000000001' || compId === 'company-logix-official-001') {
      const officialProfile: CompanyProfile = {
        ...DEFAULT_COMPANY_PROFILE,
        id: '10000000-0000-0000-0000-000000000001',
        nameAr: 'شركة لوجيكس للأنظمة السحابية',
        nameEn: 'LOGIX Cloud ERP Systems Co. W.L.L',
        tradeName: 'لوجيكس للحلول السحابية وتخطيط الموارد',
        legalForm: 'شركة ذات مسؤولية محدودة',
        taxNumber: '300100200300003',
        crNumber: '554433',
        chamberNumber: '99112',
        functionalCurrency: 'KWD',
        vatRate: 0,
        city: 'مدينة الكويت',
        country: 'دولة الكويت',
        streetName: 'شارع أحمد الجابر - برج الراية',
        buildingNo: 'طابق 24',
        district: 'شرق',
        phone: '+965 2200 8800',
        email: 'cgiacc2026@gmail.com',
        generalManager: 'المشرف العام (CGI Admin)',
        financialManager: 'أ. عبد العزيز الكندري',
        chiefAccountant: 'أ. طارق الفهد',
        logoUrl: dedicatedLogo || '',
        headerNotes: 'المنشأة الرسمية لنظام لوجيكس السحابي - بيئة تشغيلية نظيفة خاضعة لإشراف الآدمن',
        footerNotes: 'نظام لوجيكس السحابي لإدارة وتخطيط موارد المنشآت الصناعية والتجارية',
      };
      this.saveCompany(officialProfile);
      return officialProfile;
    }

    if (compId === '00000000-0000-0000-0000-000000000099' || compId === 'company-demo-clients-002') {
      const demoProfile: CompanyProfile = {
        ...DEFAULT_COMPANY_PROFILE,
        id: '00000000-0000-0000-0000-000000000099',
        nameAr: 'شركة تجريبية - LOGIX Demo',
        nameEn: 'LOGIX Demo Company for Prospective Clients',
        tradeName: 'بيئة تجريبية مخصصة لعروض العملاء',
        legalForm: 'شركة مساهمة مقفلة',
        taxNumber: '310098765400003',
        crNumber: '1010998877',
        chamberNumber: '88200',
        functionalCurrency: 'KWD',
        vatRate: 0,
        city: 'مدينة الكويت',
        country: 'دولة الكويت',
        streetName: 'شارع أحمد الجابر - برج الراية',
        buildingNo: 'طابق 22',
        district: 'شرق',
        phone: '+965 2299 1100',
        email: 'demo@logix-system.com',
        generalManager: 'م. فهد السالم (مدير عام تجريبي)',
        financialManager: 'أ. ريم المطيري (المدير المالي)',
        chiefAccountant: 'أ. عمر الدوسري (رئيس الحسابات)',
        logoUrl: dedicatedLogo || '',
        headerNotes: 'بيئة تجريبية لاختبار دورات التصنيع وإدارة سلاسل الإمداد وعروض العملاء',
        footerNotes: 'نسخة تجريبية لعرض إمكانيات نظام لوجيكس السحابي للعملاء المحتملين',
      };
      this.saveCompany(demoProfile);
      return demoProfile;
    }

    if (compId === '20000000-0000-0000-0000-000000000001' || compId === 'company-alwaleed-client-003' || compId.includes('alwaleed')) {
      const alwaleedProfile: CompanyProfile = {
        ...DEFAULT_COMPANY_PROFILE,
        id: '20000000-0000-0000-0000-000000000001',
        nameAr: 'مطحنة الوليد المتحدة (ذ.م.م)',
        nameEn: 'Al-Waleed United Mill & Food Industries Co. W.L.L',
        tradeName: 'مطحنة الوليد للبهارات والمواد التموينية والصناعات الغذائية',
        legalForm: 'شركة ذات مسؤولية محدودة (ذ.م.م)',
        taxNumber: '',
        crNumber: '450912',
        chamberNumber: '78214',
        functionalCurrency: 'KWD',
        currency: 'KWD',
        decimalPlaces: 3,
        vatRate: 0,
        city: 'الكويت',
        country: 'دولة الكويت',
        streetName: 'شارع الغزالي',
        buildingNo: 'قسيمة 42',
        district: 'منطقة الري الصناعية',
        phone: '+965 2484 1888',
        email: 'alwaleed.mill@logixerp.com',
        generalManager: 'د. خالد السليمان',
        financialManager: 'أ. محمد الشمري',
        chiefAccountant: 'أ. محمد الشمري',
        logoUrl: dedicatedLogo || '',
        headerNotes: 'مستند تجاري ومالي رسمي معتمد • مطحنة الوليد المتحدة • دولة الكويت',
        footerNotes: 'الدفع خلال 30 يوماً من تاريخ الفاتورة • خاضع للقوانين التجارية بدولة الكويت',
      };
      this.saveCompany(alwaleedProfile);
      return alwaleedProfile;
    }

    // Look up in registered companies / tenants cache
    try {
      const cacheRaw = typeof window !== 'undefined' ? localStorage.getItem('all_tenants_cache') || localStorage.getItem('logix_registered_companies') : null;
      if (cacheRaw) {
        const tenants = JSON.parse(cacheRaw);
        if (Array.isArray(tenants)) {
          const found = tenants.find((t: any) => t.id === compId);
          if (found) {
            const p = found.profile_data || {};
            const createdProfile: CompanyProfile = {
              ...DEFAULT_COMPANY_PROFILE,
              id: found.id,
              nameAr: found.company_name || p.nameAr || 'منشأة جديدة',
              nameEn: p.nameEn || found.company_name || 'New Enterprise',
              tradeName: p.tradeName || found.company_name || 'منشأة جديدة',
              email: found.owner_email || p.email || '',
              legalForm: p.legalForm || 'شركة ذات مسؤولية محدودة',
              functionalCurrency: p.functionalCurrency || 'KWD',
              currency: p.currency || 'KWD',
              decimalPlaces: p.decimalPlaces ?? 3,
              vatRate: p.vatRate ?? 0,
              crNumber: p.crNumber || found.login_code || '',
              logoUrl: found.logo_url || found.logo || p.logoUrl || dedicatedLogo || '',
              themeColor: p.themeColor || 'blue',
              themeMode: p.themeMode || 'light',
            };
            this.saveCompany(createdProfile);
            return createdProfile;
          }
        }
      }
    } catch (err) {
      console.warn('Error reading tenant cache in getCompany:', err);
    }

    const result = stored || DEFAULT_COMPANY_PROFILE;
    if (dedicatedLogo && !result.logoUrl) {
      result.logoUrl = dedicatedLogo;
    }
    if (!result.themeColor) {
      result.themeColor = ThemeService.getSavedThemeColor();
    }
    if (!result.themeMode) {
      result.themeMode = ThemeService.getSavedThemeMode();
    }
    if (!result.defaultAccounts) {
      const accs = this.getLocal<Account[] | null>(this.getKey(STORAGE_KEYS.ACCOUNTS), null);
      if (accs && accs.length > 0) {
        result.defaultAccounts = getDefaultMappingForAccounts(accs);
      } else {
        result.defaultAccounts = DEFAULT_COMPANY_PROFILE.defaultAccounts;
      }
    }
    return result;
  }

  public saveCompany(comp: CompanyProfile): CompanyProfile {
    const compId = comp.id || this.getEffectiveCompanyId();
    if (compId && !comp.id) {
      comp.id = compId;
    }

    // Immediately apply and synchronize theme preferences
    if (comp.themeColor || comp.themeMode) {
      ThemeService.syncWithCompany(comp);
    }

    // Dedicated Logo Storage for Guaranteed Persistence
    if (typeof window !== 'undefined' && window.localStorage && compId) {
      try {
        if (comp.logoUrl) {
          window.localStorage.setItem(`logix_company_logo_${compId}`, comp.logoUrl);
          window.localStorage.setItem('logix_current_company_logo', comp.logoUrl);
        } else if (comp.logoUrl === '') {
          window.localStorage.removeItem(`logix_company_logo_${compId}`);
          window.localStorage.removeItem('logix_current_company_logo');
        }
      } catch (e) {
        console.warn('Dedicated logo storage notice:', e);
      }
    }

    this.setLocal(this.getKey(STORAGE_KEYS.COMPANY, compId || undefined), comp);

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem('supabase_company_info', JSON.stringify(comp));

        // Update tenant caches
        const cacheRaw = window.localStorage.getItem('all_tenants_cache') || window.localStorage.getItem('logix_registered_companies');
        if (cacheRaw) {
          const tenants = JSON.parse(cacheRaw);
          if (Array.isArray(tenants)) {
            const idx = tenants.findIndex((t: any) => t.id === comp.id);
            if (idx >= 0) {
              tenants[idx] = {
                ...tenants[idx],
                company_name: comp.nameAr,
                logo_url: comp.logoUrl || '',
                profile_data: comp,
                updated_at: new Date().toISOString(),
              };
              window.localStorage.setItem('all_tenants_cache', JSON.stringify(tenants));
              window.localStorage.setItem('logix_registered_companies', JSON.stringify(tenants));
            }
          }
        }
      } catch (err) {
        console.warn('Error syncing company profile to local storage:', err);
      }
    }
    return comp;
  }

  public getUsers(): SystemUser[] {
    return this.getLocal<SystemUser[]>(this.getKey(STORAGE_KEYS.USERS), INITIAL_USERS);
  }
  public saveUsers(users: SystemUser[]): void {
    this.setLocal(this.getKey(STORAGE_KEYS.USERS), users);
  }

  public getAccounts(): Account[] {
    const list = this.getLocal<Account[] | null>(this.getKey(STORAGE_KEYS.ACCOUNTS), null);
    if (!list || list.length === 0) {
      if (this.isAlWaleedActive()) {
        const alwaleedAccounts = JSON.parse(JSON.stringify(INITIAL_ACCOUNTS));
        this.saveAccounts(alwaleedAccounts);
        return alwaleedAccounts;
      }
      // Default zeroed clean opening chart of accounts
      const zeroedAccounts = generateCleanChartOfAccounts(this.getEffectiveCompanyId() || undefined);
      this.saveAccounts(zeroedAccounts);
      return zeroedAccounts;
    }
    return list;
  }
  public saveAccounts(accounts: Account[]): void {
    this.setLocal(this.getKey(STORAGE_KEYS.ACCOUNTS), accounts);
  }

  public getCustomers(): Customer[] {
    const list = this.getLocal<Customer[] | null>(this.getKey(STORAGE_KEYS.CUSTOMERS), null);
    if (!list || (list.length === 0 && this.isAlWaleedActive())) {
      if (this.isAlWaleedActive()) {
        const alwaleedCustomers = JSON.parse(JSON.stringify(INITIAL_CUSTOMERS));
        this.saveCustomers(alwaleedCustomers);
        return alwaleedCustomers;
      }
      if (isDemoActive()) {
        const zeroedCustomers = INITIAL_CUSTOMERS.map((c) => ({ ...c, balance: 0, openingBalance: 0 }));
        this.saveCustomers(zeroedCustomers);
        return zeroedCustomers;
      }
      return [];
    }
    return list;
  }
  public saveCustomers(customers: Customer[]): void {
    this.setLocal(this.getKey(STORAGE_KEYS.CUSTOMERS), customers);
  }

  public getSuppliers(): Supplier[] {
    const list = this.getLocal<Supplier[] | null>(this.getKey(STORAGE_KEYS.SUPPLIERS), null);
    if (!list || (list.length === 0 && this.isAlWaleedActive())) {
      if (this.isAlWaleedActive()) {
        const alwaleedSuppliers = JSON.parse(JSON.stringify(INITIAL_SUPPLIERS));
        this.saveSuppliers(alwaleedSuppliers);
        return alwaleedSuppliers;
      }
      if (isDemoActive()) {
        const zeroedSuppliers = INITIAL_SUPPLIERS.map((s) => ({ ...s, balance: 0, openingBalance: 0 }));
        this.saveSuppliers(zeroedSuppliers);
        return zeroedSuppliers;
      }
      return [];
    }
    return list;
  }
  public saveSuppliers(suppliers: Supplier[]): void {
    this.setLocal(this.getKey(STORAGE_KEYS.SUPPLIERS), suppliers);
  }

  public getInventory(): InventoryItem[] {
    const list = this.getLocal<InventoryItem[] | null>(this.getKey(STORAGE_KEYS.INVENTORY), null);
    if (!list || (list.length === 0 && this.isAlWaleedActive())) {
      if (this.isAlWaleedActive()) {
        const alwaleedInventory = JSON.parse(JSON.stringify(INITIAL_INVENTORY));
        this.saveInventory(alwaleedInventory);
        return alwaleedInventory;
      }
      return [];
    }
    return list;
  }
  public saveInventory(inv: InventoryItem[]): void {
    this.setLocal(this.getKey(STORAGE_KEYS.INVENTORY), inv);
  }

  public getJournals(): JournalEntry[] {
    const list = this.getLocal<JournalEntry[] | null>(this.getKey(STORAGE_KEYS.JOURNALS), null);
    if (!list || (list.length === 0 && this.isAlWaleedActive())) {
      if (this.isAlWaleedActive()) {
        const alwaleedJournals = JSON.parse(JSON.stringify(INITIAL_JOURNALS));
        this.saveJournals(alwaleedJournals);
        return alwaleedJournals;
      }
      return [];
    }
    return list;
  }
  public saveJournals(j: JournalEntry[]): void {
    this.setLocal(this.getKey(STORAGE_KEYS.JOURNALS), j);
  }

  public getInvoices(): Invoice[] {
    const list = this.getLocal<Invoice[] | null>(this.getKey(STORAGE_KEYS.INVOICES), null);
    if (!list || (list.length === 0 && this.isAlWaleedActive())) {
      if (this.isAlWaleedActive()) {
        const alwaleedInvoices = JSON.parse(JSON.stringify(INITIAL_INVOICES));
        this.saveInvoices(alwaleedInvoices);
        return alwaleedInvoices;
      }
      return [];
    }
    return list;
  }
  public saveInvoices(inv: Invoice[]): void {
    this.setLocal(this.getKey(STORAGE_KEYS.INVOICES), inv);
  }

  public getVouchers(): PaymentVoucher[] {
    const list = this.getLocal<PaymentVoucher[] | null>(this.getKey(STORAGE_KEYS.VOUCHERS), null);
    if (!list) {
      return [];
    }
    return list;
  }
  public saveVouchers(v: PaymentVoucher[]): void {
    this.setLocal(this.getKey(STORAGE_KEYS.VOUCHERS), v);
  }

  public getUnits(): UnitDefinition[] {
    return this.getLocal<UnitDefinition[]>(this.getKey(STORAGE_KEYS.UNITS), INITIAL_UNITS);
  }
  public saveUnits(u: UnitDefinition[]): void {
    this.setLocal(this.getKey(STORAGE_KEYS.UNITS), u);
  }

  public getProductionOrders(): ProductionOrder[] {
    const list = this.getLocal<ProductionOrder[] | null>(this.getKey(STORAGE_KEYS.PRODUCTION_ORDERS), null);
    if (!list) {
      return [];
    }
    return list;
  }
  public saveProductionOrders(orders: ProductionOrder[]): void {
    this.setLocal(this.getKey(STORAGE_KEYS.PRODUCTION_ORDERS), orders);
  }

  public getManufacturingSettings(): ManufacturingStandardSettings {
    const saved = this.getLocal<ManufacturingStandardSettings | null>(
      this.getKey(STORAGE_KEYS.MANUFACTURING_SETTINGS),
      null
    );
    if (saved && saved.standardCategories && saved.standardCategories.length > 0) {
      return saved;
    }
    const defType: ManufacturingIndustryType = this.isAlWaleedActive() ? 'FOOD_MILLING' : 'GENERAL_ASSEMBLY';
    const initial = DEFAULT_MANUFACTURING_PROFILES[defType];
    this.saveManufacturingSettings(initial);
    return initial;
  }
  public saveManufacturingSettings(s: ManufacturingStandardSettings): void {
    this.setLocal(this.getKey(STORAGE_KEYS.MANUFACTURING_SETTINGS), s);
  }

  public getQuotations(): Quotation[] {
    const list = this.getLocal<Quotation[] | null>(this.getKey(STORAGE_KEYS.QUOTATIONS), null);
    if (!list) {
      if (this.isAlWaleedActive() || isDemoActive()) {
        this.saveQuotations(INITIAL_QUOTATIONS);
        return INITIAL_QUOTATIONS;
      }
      return [];
    }
    return list;
  }
  public saveQuotations(quotations: Quotation[]): void {
    this.setLocal(this.getKey(STORAGE_KEYS.QUOTATIONS), quotations);
  }

  public getSalesReps(): SalesRep[] {
    const list = this.getLocal<SalesRep[] | null>(this.getKey(STORAGE_KEYS.SALES_REPS), null);
    if (!list || list.length === 0) {
      this.saveSalesReps(INITIAL_SALES_REPS);
      return INITIAL_SALES_REPS;
    }
    return list;
  }
  public saveSalesReps(reps: SalesRep[]): void {
    this.setLocal(this.getKey(STORAGE_KEYS.SALES_REPS), reps);
  }

  public resetToDefaults(): void {
    const cleanAccounts = INITIAL_ACCOUNTS.map((a) => ({ ...a, balance: 0 }));
    this.setLocal(this.getKey(STORAGE_KEYS.COMPANY), this.getCompany());
    this.setLocal(this.getKey(STORAGE_KEYS.USERS), INITIAL_USERS);
    this.setLocal(this.getKey(STORAGE_KEYS.ACCOUNTS), cleanAccounts);
    this.setLocal(this.getKey(STORAGE_KEYS.CUSTOMERS), []);
    this.setLocal(this.getKey(STORAGE_KEYS.SUPPLIERS), []);
    this.setLocal(this.getKey(STORAGE_KEYS.INVENTORY), []);
    this.setLocal(this.getKey(STORAGE_KEYS.JOURNALS), []);
    this.setLocal(this.getKey(STORAGE_KEYS.INVOICES), []);
    this.setLocal(this.getKey(STORAGE_KEYS.VOUCHERS), []);
    this.setLocal(this.getKey(STORAGE_KEYS.UNITS), INITIAL_UNITS);
    this.setLocal(this.getKey(STORAGE_KEYS.PRODUCTION_ORDERS), []);
  }
}

export const localDataStore = new LocalDataStore();

// Legacy Cloud Sync Helper no-ops (Supabase handles cloud persistence directly)
async function syncToFirestore(_collectionName: string, _docId: string, _data: any): Promise<void> {
  // Legacy Firebase sync removed - purely operating on Supabase
}

async function deleteFromFirestore(_collectionName: string, _docId: string): Promise<void> {
  // Legacy Firebase delete removed - purely operating on Supabase
}

/**
 * Universal DataService with transparent API + Fallback Architecture
 */
export class DataService {
  // Company Profile
  public static async getCompany(): Promise<CompanyProfile> {
    try {
      const fromSupabase = await SupabaseDataService.getCompany();
      if (fromSupabase) {
        localDataStore.saveCompany(fromSupabase);
        return fromSupabase;
      }
    } catch (e) {
      console.warn('Supabase getCompany notice:', e);
    }
    return localDataStore.getCompany();
  }

  public static async saveCompany(comp: CompanyProfile): Promise<CompanyProfile> {
    localDataStore.saveCompany(comp);
    try {
      await SupabaseDataService.saveCompany(comp);
    } catch (e) {
      console.warn('Supabase saveCompany notice:', e);
    }
    syncToFirestore('erp_company', comp.id || localDataStore.getEffectiveCompanyId() || 'company_profile', comp);
    await safeApiFetch<CompanyProfile>('/api/company', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(comp),
    });

    if (comp.logoUrl) {
      try {
        await safeApiFetch('/api/company/upload-logo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ logoUrl: comp.logoUrl, companyId: comp.id }),
        });
      } catch (logoErr) {
        console.warn('Logo endpoint sync notice:', logoErr);
      }
    }
    return comp;
  }

  // KPIs
  public static async getKPIs(): Promise<FinancialKPIs> {
    const accounts = localDataStore.getAccounts();
    const journals = localDataStore.getJournals().filter((j) => j.status === 'POSTED');
    const invoices = localDataStore.getInvoices();
    const inventory = localDataStore.getInventory();

    const accountsWithBalances = this.calculateDynamicAccountBalances(accounts, journals);

    let totalRevenue = 0;
    let totalExpenses = 0;
    let bankBalance = 0;
    let cashBalance = 0;
    let recBalance = 0;
    let payBalance = 0;
    let invBalance = 0;
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;

    const resolved = this.getResolvedAccounts();
    const bankIds = [resolved.bank.id, resolved.bank.code, '1111'];
    const cashIds = [resolved.cash.id, resolved.cash.code, '1112', '1113'];
    const recIds = [resolved.receivable.id, resolved.receivable.code, '1120'];
    const payIds = [resolved.payable.id, resolved.payable.code, '2110'];
    const invIds = [resolved.inventory.id, resolved.inventory.code, '1130'];

    accountsWithBalances.forEach((acc) => {
      const hasChildren = accountsWithBalances.some((child) => child.parentId === acc.id);
      const isLeaf = !hasChildren;
      const b = Number(acc.balance) || 0;
      const code = String(acc.code || '');
      const cat = String(acc.category || '');

      if (isLeaf) {
        if (cat === 'ASSET' || code.startsWith('1')) totalAssets += b;
        if (cat === 'LIABILITY' || code.startsWith('2')) totalLiabilities += b;
        if (cat === 'EQUITY' || code.startsWith('3')) totalEquity += b;
        if (cat === 'REVENUE' || code.startsWith('4')) totalRevenue += b;
        if (cat === 'EXPENSE' || code.startsWith('5')) totalExpenses += b;
      }

      if (bankIds.includes(acc.id) || bankIds.includes(code)) bankBalance += b;
      else if (cashIds.includes(acc.id) || cashIds.includes(code)) cashBalance += b;

      if (recIds.includes(acc.id) || recIds.includes(code) || (isLeaf && (cat === 'ASSET' || code.startsWith('1')) && (code.startsWith('112') || acc.nameAr.includes('عملاء')))) {
        recBalance += b;
      }
      if (payIds.includes(acc.id) || payIds.includes(code) || (isLeaf && (cat === 'LIABILITY' || code.startsWith('2')) && (code.startsWith('211') || acc.nameAr.includes('موردين')))) {
        payBalance += b;
      }
      if (invIds.includes(acc.id) || invIds.includes(code) || (isLeaf && (cat === 'ASSET' || code.startsWith('1')) && code.startsWith('113'))) {
        invBalance += b;
      }
    });

    // If inventory accounts are 0, also check physical stock valuation
    const stockValuation = inventory.reduce(
      (sum, item) => sum + (item.quantityOnHand * (item.purchasePrice || item.salePrice || 0)),
      0
    );
    if (invBalance === 0 && stockValuation > 0) {
      invBalance = stockValuation;
    }

    const unpaidCount = invoices.filter((i) => i.dueAmount > 0 && i.status !== 'CANCELLED').length;
    const netProfit = totalRevenue - totalExpenses;

    return {
      totalAssets,
      totalLiabilities,
      totalEquity: totalEquity + netProfit,
      totalRevenue,
      totalExpenses,
      netProfit,
      cashAndBankBalance: bankBalance + cashBalance,
      accountsReceivableTotal: recBalance,
      accountsPayableTotal: payBalance,
      inventoryTotalValue: invBalance,
      unpaidInvoicesCount: unpaidCount,
    };
  }

  // Accounts
  public static calculateDynamicAccountBalances(accounts: Account[], journals: JournalEntry[]): Account[] {
    const balanceMap = new Map<string, number>();
    const debitMap = new Map<string, number>();
    const creditMap = new Map<string, number>();
    const countMap = new Map<string, number>();

    const accountByLookup = new Map<string, Account>();
    accounts.forEach((a) => {
      accountByLookup.set(a.id, a);
      if (a.code) accountByLookup.set(a.code, a);
    });

    const postedJournals = (journals || []).filter((j) => j.status === 'POSTED');

    for (const journal of postedJournals) {
      for (const line of journal.lines || []) {
        const acc = accountByLookup.get(line.accountId) || accountByLookup.get(line.accountCode || '');
        if (!acc) continue;

        const currentDebit = debitMap.get(acc.id) || 0;
        const currentCredit = creditMap.get(acc.id) || 0;
        const lineDebit = Number(line.debit) || 0;
        const lineCredit = Number(line.credit) || 0;

        debitMap.set(acc.id, currentDebit + lineDebit);
        creditMap.set(acc.id, currentCredit + lineCredit);
        countMap.set(acc.id, (countMap.get(acc.id) || 0) + 1);

        const currentBal = balanceMap.get(acc.id) || 0;
        if (acc.normalBalance === 'DEBIT') {
          balanceMap.set(acc.id, currentBal + (lineDebit - lineCredit));
        } else {
          balanceMap.set(acc.id, currentBal + (lineCredit - lineDebit));
        }
      }
    }

    const accountsCopy: Account[] = JSON.parse(JSON.stringify(accounts));
    accountsCopy.sort((a, b) => b.level - a.level);

    // Roll up into parents
    accountsCopy.forEach((acc) => {
      const ownBal = balanceMap.get(acc.id) || 0;
      acc.balance = ownBal;
      (acc as any).totalDebitMovement = debitMap.get(acc.id) || 0;
      (acc as any).totalCreditMovement = creditMap.get(acc.id) || 0;
      (acc as any).movementCount = countMap.get(acc.id) || 0;

      if (acc.parentId) {
        const parentBal = balanceMap.get(acc.parentId) || 0;
        balanceMap.set(acc.parentId, parentBal + ownBal);

        const parentDeb = debitMap.get(acc.parentId) || 0;
        debitMap.set(acc.parentId, parentDeb + (debitMap.get(acc.id) || 0));

        const parentCred = creditMap.get(acc.parentId) || 0;
        creditMap.set(acc.parentId, parentCred + (creditMap.get(acc.id) || 0));

        const parentCount = countMap.get(acc.parentId) || 0;
        countMap.set(acc.parentId, parentCount + (countMap.get(acc.id) || 0));
      }
    });

    return accountsCopy.sort((a, b) => a.code.localeCompare(b.code));
  }

  /**
   * Resolves the default accounting mappings for the currently active company.
   * Ensures that all financial transactions (Invoices, Receipts, Payments, Production)
   * bind directly to the company's mapped chart of accounts.
   */
  public static getResolvedAccounts() {
    const company = localDataStore.getCompany();
    const accounts = localDataStore.getAccounts();
    const mapping = company.defaultAccounts || getDefaultMappingForAccounts(accounts);

    const resolveAccount = (targetId?: string, fallbackCode?: string, fallbackKeywords: string[] = []): Account => {
      if (targetId) {
        const found = accounts.find((a) => a.id === targetId || a.code === targetId);
        if (found) return found;
      }
      if (fallbackCode) {
        const found = accounts.find((a) => a.code === fallbackCode);
        if (found) return found;
      }
      const byKeyword = accounts.find((a) => {
        const ar = a.nameAr || '';
        const en = (a.nameEn || '').toLowerCase();
        return fallbackKeywords.some((k) => ar.includes(k) || en.includes(k.toLowerCase()));
      });
      if (byKeyword) return byKeyword;
      return accounts[0] || {
        id: 'acc-generic',
        code: '1000',
        nameAr: 'حساب عام',
        nameEn: 'General Account',
        category: 'ASSET',
        parentId: null,
        level: 1,
        normalBalance: 'DEBIT',
        isActive: true,
        isSystem: true,
        balance: 0,
      };
    };

    return {
      cash: resolveAccount(mapping.cashAccountId, '1113', ['صندوق', 'خزينة', 'نقد']),
      bank: resolveAccount(mapping.bankAccountId, '1111', ['بنك', 'مصرف', 'bank']),
      receivable: resolveAccount(mapping.receivableAccountId, '1120', ['عملاء', 'مدينون', 'ذمم مدينة', 'receivable']),
      payable: resolveAccount(mapping.payableAccountId, '2110', ['موردين', 'دائنون', 'ذمم دائنة', 'payable']),
      inventory: resolveAccount(mapping.inventoryAccountId, '1130', ['مخزون', 'بضائع', 'inventory']),
      sales: resolveAccount(mapping.salesAccountId, '4100', ['مبيعات', 'إيراد', 'sales', 'revenue']),
      cogs: resolveAccount(mapping.cogsAccountId, '5100', ['تكلفة', 'cogs', 'cost of goods']),
      retainedEarnings: resolveAccount(mapping.retainedEarningsAccountId, '3200', ['أرباح مبقاة', 'أرباح مرحلة', 'retained earnings']),
      vat: resolveAccount(mapping.vatAccountId, '2120', ['ضريبة', 'أمانات الضريبة', 'vat', 'tax']),
      mapping,
    };
  }

  /**
   * Generates a pristine clean opening chart of accounts for the current company with 0 balances.
   * Auto-links the default company mapping immediately.
   */
  public static async generateCleanCompanyChartOfAccounts(): Promise<Account[]> {
    const comp = localDataStore.getCompany();
    const cleanAccounts = generateCleanChartOfAccounts(comp.id);
    localDataStore.saveAccounts(cleanAccounts);
    
    // Auto map the new accounts
    comp.defaultAccounts = getDefaultMappingForAccounts(cleanAccounts);
    localDataStore.saveCompany(comp);
    await safeApiFetch('/api/company', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(comp),
    });
    return cleanAccounts;
  }

  public static async getAccounts(): Promise<Account[]> {
    let accounts: Account[] = [];
    const localAccounts = localDataStore.getAccounts();
    const isLocked = localDataStore.isRestoreLocked();

    try {
      const fromSupabase = await SupabaseDataService.getAccounts();
      if (Array.isArray(fromSupabase) && fromSupabase.length > 0) {
        if (localAccounts && localAccounts.length > 0 && (isLocked || fromSupabase.length < localAccounts.length)) {
          accounts = localAccounts;
        } else {
          accounts = fromSupabase;
        }
      }
    } catch (e) {
      console.warn('Supabase getAccounts notice:', e);
    }

    if (!accounts || accounts.length === 0) {
      accounts = localAccounts;
      if (!accounts || accounts.length === 0) {
        accounts = generateCleanChartOfAccounts(localDataStore.getEffectiveCompanyId() || undefined);
        localDataStore.saveAccounts(accounts);
        if (isSupabaseConfigured) {
          SupabaseDataService.saveAccounts(accounts).catch(() => {});
        }
      }
    }

    const journals = await this.getJournals();
    const withBalances = this.calculateDynamicAccountBalances(accounts, journals);
    localDataStore.saveAccounts(withBalances);
    return withBalances;
  }

  public static async createAccount(accData: Partial<Account>): Promise<Account> {
    const accounts = localDataStore.getAccounts();
    const newAcc: Account = {
      id: 'acc-' + (accData.code || Math.random().toString(36).substr(2, 9)),
      code: accData.code || '1000',
      nameAr: accData.nameAr || 'حساب جديد',
      nameEn: accData.nameEn || '',
      category: accData.category || 'ASSET',
      normalBalance: accData.normalBalance || (['ASSET', 'EXPENSE'].includes(accData.category || '') ? 'DEBIT' : 'CREDIT'),
      level: accData.level || 4,
      parentId: accData.parentId || null,
      isSystem: false,
      isActive: accData.isActive !== false,
      description: accData.description,
    };
    accounts.push(newAcc);
    localDataStore.saveAccounts(accounts);
    if (isSupabaseConfigured) {
      SupabaseDataService.saveAccounts(accounts).catch((err) =>
        console.warn('Supabase createAccount notice:', err)
      );
    }
    syncToFirestore('erp_accounts', newAcc.id, newAcc);
    await safeApiFetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(accData),
    });
    return newAcc;
  }

  public static async updateAccount(id: string, accData: Partial<Account>): Promise<Account | null> {
    const accounts = localDataStore.getAccounts();
    const idx = accounts.findIndex((a) => a.id === id);
    if (idx === -1) return null;
    accounts[idx] = { ...accounts[idx], ...accData };
    localDataStore.saveAccounts(accounts);
    if (isSupabaseConfigured) {
      SupabaseDataService.saveAccounts(accounts).catch((err) =>
        console.warn('Supabase updateAccount notice:', err)
      );
    }
    syncToFirestore('erp_accounts', id, accounts[idx]);
    await safeApiFetch(`/api/accounts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(accData),
    });
    return accounts[idx];
  }

  public static async deleteAccount(id: string): Promise<boolean> {
    const accounts = localDataStore.getAccounts();
    const filtered = accounts.filter((a) => a.id !== id);
    localDataStore.saveAccounts(filtered);
    if (isSupabaseConfigured) {
      SupabaseDataService.deleteAccount(id).catch((err) =>
        console.warn('Supabase deleteAccount notice:', err)
      );
    }
    deleteFromFirestore('erp_accounts', id);
    await safeApiFetch(`/api/accounts/${id}`, { method: 'DELETE' });
    return true;
  }

  // Journals
  public static async getJournals(): Promise<JournalEntry[]> {
    const localJournals = localDataStore.getJournals();
    const isLocked = localDataStore.isRestoreLocked();

    try {
      const fromSupabase = await SupabaseDataService.getJournals();
      if (Array.isArray(fromSupabase) && fromSupabase.length > 0) {
        if (localJournals.length > 0 && (isLocked || fromSupabase.length < localJournals.length)) {
          if (isSupabaseConfigured) {
            Promise.all(localJournals.map((j) => SupabaseDataService.saveJournal(j))).catch(() => {});
          }
          return localJournals;
        }
        localDataStore.saveJournals(fromSupabase);
        return fromSupabase;
      }
    } catch (e) {
      console.warn('Supabase getJournals notice:', e);
    }
    if (isSupabaseConfigured && localJournals.length > 0) {
      Promise.all(localJournals.map((j) => SupabaseDataService.saveJournal(j))).catch(() => {});
    }
    return localJournals;
  }

  public static async createJournal(data: Partial<JournalEntry>): Promise<JournalEntry> {
    const lines = data.lines || [];
    if (!lines || lines.length < 2) {
      throw new Error('لا يمكن حفظ القيد: يجب أن يتكون القيد المحاسبي من طرفين على الأقل (طرف مدين وطرف دائن).');
    }

    let totalDebit = 0;
    let totalCredit = 0;

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l.accountId || !l.accountId.trim()) {
        throw new Error(`لا يمكن حفظ القيد: السطر رقم (${i + 1}) غير مرتبط بحساب محاسبي.`);
      }
      const d = Number(l.debit) || 0;
      const c = Number(l.credit) || 0;
      if (d < 0 || c < 0) {
        throw new Error(`لا يمكن حفظ القيد: لا يُسمح بإدخال قيم سالبة في السطر رقم (${i + 1}).`);
      }
      if (d > 0 && c > 0) {
        throw new Error(`لا يمكن حفظ القيد: السطر رقم (${i + 1}) يحتوي على قيمتين للمدين والدائن معاً.`);
      }
      if (d === 0 && c === 0) {
        throw new Error(`لا يمكن حفظ القيد: السطر رقم (${i + 1}) فارغ من أي مبالغ.`);
      }
      totalDebit += d;
      totalCredit += c;
    }

    const diff = Math.abs(totalDebit - totalCredit);
    if (totalDebit <= 0 || totalCredit <= 0) {
      throw new Error('لا يمكن حفظ القيد: إجمالي مبالغ القيد يجب أن تكون أكبر من الصفر.');
    }
    if (diff >= 0.001) {
      throw new Error(
        `لا يمكن حفظ القيد: القيد غير متوازن إطلاقاً! إجمالي الطرف المدين (${totalDebit.toFixed(3)}) يجب أن يتطابق تماماً مع إجمالي الطرف الدائن (${totalCredit.toFixed(3)}). فارق عدم التوازن: ${diff.toFixed(3)}`
      );
    }

    const compId = localDataStore.getEffectiveCompanyId();
    const journals = localDataStore.getJournals();
    const entryNumber = `JV-${new Date().getFullYear()}-${String(journals.length + 1).padStart(4, '0')}`;

    const newJournal: JournalEntry = {
      id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'jv-' + Math.random().toString(36).substr(2, 9),
      companyId: compId,
      entryNumber,
      date: data.date || new Date().toISOString().split('T')[0],
      reference: data.reference || '',
      description: data.description || 'قيد محاسبي جديد',
      status: 'POSTED',
      lines: lines.map((l, i) => ({
        ...l,
        id: l.id || `jl-${i + 1}-${Math.random().toString(36).substr(2, 7)}`,
        companyId: compId,
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
      })),
      totalDebit: Math.round(totalDebit * 1000) / 1000,
      totalCredit: Math.round(totalCredit * 1000) / 1000,
      createdAt: new Date().toISOString(),
      postedAt: new Date().toISOString(),
      isAutoGenerated: !!data.isAutoGenerated,
      sourceModule: data.sourceModule || 'MANUAL',
      sourceId: data.sourceId,
    };

    journals.unshift(newJournal);
    localDataStore.saveJournals(journals);
    try {
      await SupabaseDataService.saveJournal(newJournal);
    } catch (e) {
      console.warn('Supabase saveJournal notice:', e);
    }
    syncToFirestore('erp_journals', newJournal.id, newJournal);
    await safeApiFetch('/api/journals', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-company-id': compId || '',
      },
      body: JSON.stringify({ ...data, companyId: compId, lines: newJournal.lines }),
    });
    return newJournal;
  }

  public static async updateJournal(id: string, updated: Partial<JournalEntry>): Promise<JournalEntry | null> {
    const journals = localDataStore.getJournals();
    const idx = journals.findIndex((j) => j.id === id);
    if (idx === -1) {
      throw new Error('القيد المحاسبي غير موجود.');
    }

    const lines = updated.lines || journals[idx].lines || [];
    if (lines.length < 2) {
      throw new Error('لا يمكن حفظ القيد: يجب أن يتكون القيد المحاسبي من طرفين على الأقل.');
    }

    let totalDebit = 0;
    let totalCredit = 0;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l.accountId || !l.accountId.trim()) {
        throw new Error(`لا يمكن حفظ التعديل: السطر رقم (${i + 1}) غير مرتبط بحساب محاسبي.`);
      }
      const d = Number(l.debit) || 0;
      const c = Number(l.credit) || 0;
      if (d < 0 || c < 0) {
        throw new Error(`لا يمكن حفظ التعديل: السطر رقم (${i + 1}) يحتوي على قيم سالبة.`);
      }
      if (d > 0 && c > 0) {
        throw new Error(`لا يمكن حفظ التعديل: السطر رقم (${i + 1}) يحتوي على مدين ودائن معاً.`);
      }
      if (d === 0 && c === 0) {
        throw new Error(`لا يمكن حفظ التعديل: السطر رقم (${i + 1}) فارغ.`);
      }
      totalDebit += d;
      totalCredit += c;
    }

    const diff = Math.abs(totalDebit - totalCredit);
    if (totalDebit <= 0 || totalCredit <= 0) {
      throw new Error('لا يمكن حفظ القيد: إجمالي المبالغ يجب أن تكون أكبر من الصفر.');
    }
    if (diff >= 0.001) {
      throw new Error(
        `لا يمكن حفظ التعديل: القيد غير متوازن إطلاقاً! إجمالي الطرف المدين (${totalDebit.toFixed(3)}) يجب أن يتطابق تماماً مع إجمالي الطرف الدائن (${totalCredit.toFixed(3)}). فارق التوازن: ${diff.toFixed(3)}`
      );
    }

    const compId = localDataStore.getEffectiveCompanyId();
    const formattedLines = lines.map((l: any, i: number) => {
      const d = Number(l.debit) || 0;
      const c = Number(l.credit) || 0;
      return {
        ...l,
        id: l.id || `line-${i + 1}`,
        companyId: compId,
        debit: d,
        credit: c,
      };
    });

    journals[idx] = {
      ...journals[idx],
      ...updated,
      companyId: compId,
      lines: formattedLines,
      totalDebit: Math.round(totalDebit * 1000) / 1000,
      totalCredit: Math.round(totalCredit * 1000) / 1000,
    };

    localDataStore.saveJournals(journals);
    try {
      await SupabaseDataService.saveJournal(journals[idx]);
    } catch (e) {
      console.warn('Supabase updateJournal notice:', e);
    }
    syncToFirestore('erp_journals', id, journals[idx]);

    const apiRes = await safeApiFetch<JournalEntry>(`/api/journals/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-company-id': compId || '',
      },
      body: JSON.stringify({ ...updated, companyId: compId, lines: formattedLines }),
    });

    return apiRes || journals[idx];
  }

  public static async rebuildOpeningJournal(): Promise<any> {
    const apiRes = await safeApiFetch<any>('/api/journals/rebuild-opening', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (apiRes?.journal) {
      const journals = localDataStore.getJournals();
      const existIdx = journals.findIndex((j) => j.id === apiRes.journal.id || j.sourceModule === 'OPENING');
      if (existIdx !== -1) {
        journals[existIdx] = apiRes.journal;
      } else {
        journals.unshift(apiRes.journal);
      }
      localDataStore.saveJournals(journals);
      if (isSupabaseConfigured) {
        SupabaseDataService.saveJournal(apiRes.journal).catch((err) =>
          console.warn('Supabase rebuildOpeningJournal notice:', err)
        );
      }
      syncToFirestore('erp_journals', apiRes.journal.id, apiRes.journal);
    }
    return apiRes;
  }

  public static async reverseJournal(id: string, reason: string): Promise<JournalEntry | null> {
    const journals = localDataStore.getJournals();
    const orig = journals.find((j) => j.id === id);
    if (!orig) return null;

    orig.status = 'CANCELLED';
    localDataStore.saveJournals(journals);
    if (isSupabaseConfigured) {
      SupabaseDataService.saveJournal(orig).catch((err) =>
        console.warn('Supabase reverseJournal orig notice:', err)
      );
    }
    syncToFirestore('erp_journals', orig.id, orig);

    const revLines = orig.lines.map((l, i) => ({
      ...l,
      id: `rev-${i + 1}`,
      debit: l.credit,
      credit: l.debit,
      memo: `عكس: ${l.memo || ''}`,
    }));

    const revEntry: JournalEntry = {
      id: 'jv-rev-' + Math.random().toString(36).substr(2, 9),
      entryNumber: `REV-${orig.entryNumber}`,
      date: new Date().toISOString().split('T')[0],
      reference: orig.entryNumber,
      description: `عكس القيد رقم ${orig.entryNumber} - السبب: ${reason || 'تصحيح محاسبي'}`,
      status: 'POSTED',
      lines: revLines,
      totalDebit: orig.totalCredit,
      totalCredit: orig.totalDebit,
      createdAt: new Date().toISOString(),
      postedAt: new Date().toISOString(),
      isAutoGenerated: true,
      sourceModule: 'MANUAL',
    };

    journals.unshift(revEntry);
    localDataStore.saveJournals(journals);
    if (isSupabaseConfigured) {
      SupabaseDataService.saveJournal(revEntry).catch((err) =>
        console.warn('Supabase reverseJournal revEntry notice:', err)
      );
    }
    syncToFirestore('erp_journals', revEntry.id, revEntry);

    await safeApiFetch(`/api/journals/${id}/reverse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    return revEntry;
  }

  public static async deleteJournal(id: string): Promise<boolean> {
    const journals = localDataStore.getJournals();
    const filtered = journals.filter((j) => j.id !== id);
    localDataStore.saveJournals(filtered);
    try {
      await SupabaseDataService.deleteJournal(id);
    } catch (e) {
      console.warn('Supabase deleteJournal notice:', e);
    }
    deleteFromFirestore('erp_journals', id);
    await safeApiFetch(`/api/journals/${id}`, { method: 'DELETE' });
    await this.syncSystemIntegrity();
    return true;
  }

  // Invoices
  public static async getInvoices(): Promise<Invoice[]> {
    const localInvoices = localDataStore.getInvoices();
    const isLocked = localDataStore.isRestoreLocked();

    try {
      const fromSupabase = await SupabaseDataService.getInvoices();
      if (Array.isArray(fromSupabase) && fromSupabase.length > 0) {
        if (localInvoices.length > 0 && (isLocked || fromSupabase.length < localInvoices.length)) {
          if (isSupabaseConfigured) {
            Promise.all(localInvoices.map((inv) => SupabaseDataService.saveInvoice(inv))).catch(() => {});
          }
          return localInvoices;
        }
        localDataStore.saveInvoices(fromSupabase);
        return fromSupabase;
      }
    } catch (e) {
      console.warn('Supabase getInvoices notice:', e);
    }
    if (isSupabaseConfigured && localInvoices.length > 0) {
      Promise.all(localInvoices.map((inv) => SupabaseDataService.saveInvoice(inv))).catch(() => {});
    }
    return localInvoices;
  }

  public static async createInvoice(data: any): Promise<Invoice> {
    const invoices = localDataStore.getInvoices();
    const customers = localDataStore.getCustomers();
    const suppliers = localDataStore.getSuppliers();
    const inventory = localDataStore.getInventory();

    const isSales = data.type === 'SALES';
    const invoiceNumber = data.invoiceNumber || `${isSales ? 'INV-SAL' : 'INV-PUR'}-2026-${String(invoices.length + 1).padStart(4, '0')}`;
    
    const lines = (data.lines || data.items || []).map((item: any, i: number) => {
      const q = Number(item.quantity) || 1;
      const p = Number(item.unitPrice) || 0;
      const unitsPerPack = Number(item.unitsPerPack) > 0 ? Number(item.unitsPerPack) : 1;
      const packQuantity = item.packQuantity !== undefined ? Number(item.packQuantity) : (unitsPerPack > 1 ? Math.floor(q / unitsPerPack) : 0);
      const dType: 'PERCENT' | 'FIXED' = item.discountType === 'PERCENT' ? 'PERCENT' : 'FIXED';
      const dVal = Number(item.discountValue) || Number(item.discount) || 0;
      
      const lineGross = q * p;
      let lineDiscAmt = 0;
      if (dType === 'PERCENT') {
        lineDiscAmt = (lineGross * Math.min(100, Math.max(0, dVal))) / 100;
      } else {
        lineDiscAmt = Math.min(lineGross, Math.max(0, dVal));
      }
      const lineNet = Math.max(0, lineGross - lineDiscAmt);

      return {
        id: item.id || `item-${i + 1}`,
        itemId: item.itemId || `inv-item-${i + 1}`,
        itemSku: item.itemSku || item.sku || '',
        barcode: item.barcode || '',
        itemNameAr: item.itemNameAr || item.nameAr || 'صنف',
        unit: item.unit || 'حبة',
        unitsPerPack,
        packQuantity,
        quantity: q,
        unitPrice: p,
        subtotal: lineGross,
        discountType: dType,
        discountValue: dVal,
        discountAmount: lineDiscAmt,
        vatRate: 0,
        vatAmount: 0,
        total: lineNet,
        notes: item.notes || '',
      };
    });

    const grossSubtotal = lines.reduce((s: number, it: any) => s + (it.subtotal || it.quantity * it.unitPrice), 0);
    const lineDiscountsSum = lines.reduce((s: number, it: any) => s + (it.discountAmount || 0), 0);
    const subtotalAfterLines = Math.max(0, grossSubtotal - lineDiscountsSum);

    const invDiscType: 'PERCENT' | 'FIXED' = data.discountType === 'PERCENT' ? 'PERCENT' : 'FIXED';
    const invDiscVal = Number(data.discountValue) || 0;
    let invDiscAmt = 0;
    if (invDiscType === 'PERCENT') {
      invDiscAmt = (subtotalAfterLines * Math.min(100, Math.max(0, invDiscVal))) / 100;
    } else {
      invDiscAmt = Math.min(subtotalAfterLines, Math.max(0, invDiscVal));
    }

    const discountTotal = lineDiscountsSum + invDiscAmt;
    const grandTotal = Math.max(0, grossSubtotal - discountTotal);
    const paidAmount = data.paidAmount !== undefined
      ? Math.max(0, Number(data.paidAmount))
      : (data.paymentTerms === 'CASH' ? grandTotal : 0);
    const dueAmount = Math.max(0, grandTotal - paidAmount);

    let entityNameAr = data.entityNameAr || data.entityName || '';
    if (isSales) {
      const cust = customers.find((c) => c.id === data.entityId);
      if (cust) entityNameAr = cust.nameAr;
    } else {
      const supp = suppliers.find((s) => s.id === data.entityId);
      if (supp) entityNameAr = supp.nameAr;
    }

    const newInvoice: Invoice = {
      id: 'inv-' + Math.random().toString(36).substr(2, 9),
      invoiceNumber,
      type: data.type || 'SALES',
      date: data.date || new Date().toISOString().split('T')[0],
      dueDate: data.dueDate || new Date().toISOString().split('T')[0],
      entityId: data.entityId || '',
      entityNameAr,
      status: data.status || 'POSTED',
      lines,
      subtotal: grossSubtotal,
      vatTotal: 0,
      discountType: invDiscType,
      discountValue: invDiscVal,
      discountTotal,
      grandTotal,
      paidAmount,
      dueAmount,
      paymentTerms: data.paymentTerms || (paidAmount >= grandTotal && grandTotal > 0 ? 'CASH' : 'CREDIT'),
      salesPerson: data.salesPerson || '',
      receiverName: data.receiverName || '',
      customerBranchId: data.customerBranchId || undefined,
      customerBranchName: data.customerBranchName || undefined,
      priceListApplied: data.priceListApplied || undefined,
      notes: data.notes,
      createdAt: new Date().toISOString(),
    };

    const isSalesReturn = data.type === 'SALES_RETURN';
    const isPurchase = data.type === 'PURCHASE';
    const isPurchaseReturn = data.type === 'PURCHASE_RETURN';

    if (isSales && newInvoice.entityId) {
      const cust = customers.find((c) => c.id === newInvoice.entityId);
      if (cust) {
        cust.balance += dueAmount;
        localDataStore.saveCustomers(customers);
        syncToFirestore('erp_customers', cust.id, cust);
      }
    } else if (isSalesReturn && newInvoice.entityId) {
      const cust = customers.find((c) => c.id === newInvoice.entityId);
      if (cust) {
        cust.balance = Math.max(0, cust.balance - dueAmount);
        localDataStore.saveCustomers(customers);
        syncToFirestore('erp_customers', cust.id, cust);
      }
    } else if (isPurchase && newInvoice.entityId) {
      const supp = suppliers.find((s) => s.id === newInvoice.entityId);
      if (supp) {
        supp.balance += dueAmount;
        localDataStore.saveSuppliers(suppliers);
        syncToFirestore('erp_suppliers', supp.id, supp);
      }
    } else if (isPurchaseReturn && newInvoice.entityId) {
      const supp = suppliers.find((s) => s.id === newInvoice.entityId);
      if (supp) {
        supp.balance = Math.max(0, supp.balance - dueAmount);
        localDataStore.saveSuppliers(suppliers);
        syncToFirestore('erp_suppliers', supp.id, supp);
      }
    }

    lines.forEach((it: any) => {
      const invItem = inventory.find((i) => i.id === it.itemId);
      if (invItem) {
        if (isSales) {
          invItem.quantityOnHand = Math.max(0, invItem.quantityOnHand - it.quantity);
        } else if (isSalesReturn) {
          invItem.quantityOnHand += it.quantity;
        } else if (isPurchase) {
          invItem.quantityOnHand += it.quantity;
        } else if (isPurchaseReturn) {
          invItem.quantityOnHand = Math.max(0, invItem.quantityOnHand - it.quantity);
        }
        syncToFirestore('erp_inventory', invItem.id, invItem);
      }
    });
    localDataStore.saveInventory(inventory);

    const resolved = this.getResolvedAccounts();

    let jLines = [];
    if (isSales) {
      if (paidAmount > 0 && dueAmount > 0) {
        jLines.push({
          id: 'jl-1',
          accountId: resolved.cash.id,
          accountCode: resolved.cash.code,
          accountNameAr: resolved.cash.nameAr,
          debit: paidAmount,
          credit: 0,
          memo: `دفعة نقدية مسددة - فاتورة مبيعات ${invoiceNumber} - ${entityNameAr}`,
        });
        jLines.push({
          id: 'jl-2',
          accountId: resolved.receivable.id,
          accountCode: resolved.receivable.code,
          accountNameAr: resolved.receivable.nameAr,
          debit: dueAmount,
          credit: 0,
          memo: `المبلغ الآجل المستحق - فاتورة مبيعات ${invoiceNumber} - ${entityNameAr}`,
        });
      } else {
        const paymentAcc = paidAmount >= grandTotal ? resolved.cash : resolved.receivable;
        jLines.push({
          id: 'jl-1',
          accountId: paymentAcc.id,
          accountCode: paymentAcc.code,
          accountNameAr: paymentAcc.nameAr,
          debit: grandTotal,
          credit: 0,
          memo: `فاتورة مبيعات ${invoiceNumber} - ${entityNameAr}`,
        });
      }
      jLines.push({
        id: `jl-${jLines.length + 1}`,
        accountId: resolved.sales.id,
        accountCode: resolved.sales.code,
        accountNameAr: resolved.sales.nameAr,
        debit: 0,
        credit: grandTotal,
        memo: `إيراد مبيعات فاتورة ${invoiceNumber}`,
      });
    } else if (isSalesReturn) {
      jLines.push({
        id: 'jl-1',
        accountId: resolved.sales.id,
        accountCode: resolved.sales.code,
        accountNameAr: resolved.sales.nameAr,
        debit: grandTotal,
        credit: 0,
        memo: `مردودات ومسموحات المبيعات ${invoiceNumber} - ${entityNameAr}`,
      });
      if (paidAmount > 0 && dueAmount > 0) {
        jLines.push({
          id: 'jl-2',
          accountId: resolved.cash.id,
          accountCode: resolved.cash.code,
          accountNameAr: resolved.cash.nameAr,
          debit: 0,
          credit: paidAmount,
          memo: `رد نقدي مسدد للعميل - مرتجع مبيعات ${invoiceNumber}`,
        });
        jLines.push({
          id: 'jl-3',
          accountId: resolved.receivable.id,
          accountCode: resolved.receivable.code,
          accountNameAr: resolved.receivable.nameAr,
          debit: 0,
          credit: dueAmount,
          memo: `تخفيض حساب العميل الآجل ${entityNameAr}`,
        });
      } else {
        const paymentAcc = paidAmount >= grandTotal ? resolved.cash : resolved.receivable;
        jLines.push({
          id: 'jl-2',
          accountId: paymentAcc.id,
          accountCode: paymentAcc.code,
          accountNameAr: paymentAcc.nameAr,
          debit: 0,
          credit: grandTotal,
          memo: `تخفيض حساب العميل ${entityNameAr}`,
        });
      }
    } else if (isPurchase) {
      jLines.push({
        id: 'jl-1',
        accountId: resolved.inventory.id,
        accountCode: resolved.inventory.code,
        accountNameAr: resolved.inventory.nameAr,
        debit: grandTotal,
        credit: 0,
        memo: `فاتورة مشتريات ${invoiceNumber} - ${entityNameAr}`,
      });
      if (paidAmount > 0 && dueAmount > 0) {
        jLines.push({
          id: 'jl-2',
          accountId: resolved.cash.id,
          accountCode: resolved.cash.code,
          accountNameAr: resolved.cash.nameAr,
          debit: 0,
          credit: paidAmount,
          memo: `سداد نقدي فوري لمشتريات فاتورة ${invoiceNumber}`,
        });
        jLines.push({
          id: 'jl-3',
          accountId: resolved.payable.id,
          accountCode: resolved.payable.code,
          accountNameAr: resolved.payable.nameAr,
          debit: 0,
          credit: dueAmount,
          memo: `استحقاق آجل للمورد ${entityNameAr} - فاتورة ${invoiceNumber}`,
        });
      } else {
        const purchasePaymentAcc = paidAmount >= grandTotal ? resolved.cash : resolved.payable;
        jLines.push({
          id: 'jl-2',
          accountId: purchasePaymentAcc.id,
          accountCode: purchasePaymentAcc.code,
          accountNameAr: purchasePaymentAcc.nameAr,
          debit: 0,
          credit: grandTotal,
          memo: `استحقاق مشتريات فاتورة ${invoiceNumber}`,
        });
      }
    } else {
      // PURCHASE_RETURN
      if (paidAmount > 0 && dueAmount > 0) {
        jLines.push({
          id: 'jl-1',
          accountId: resolved.cash.id,
          accountCode: resolved.cash.code,
          accountNameAr: resolved.cash.nameAr,
          debit: paidAmount,
          credit: 0,
          memo: `استرداد نقدي من المورد - مرتجع مشتريات ${invoiceNumber}`,
        });
        jLines.push({
          id: 'jl-2',
          accountId: resolved.payable.id,
          accountCode: resolved.payable.code,
          accountNameAr: resolved.payable.nameAr,
          debit: dueAmount,
          credit: 0,
          memo: `تخفيض حساب المورد الآجل ${entityNameAr}`,
        });
      } else {
        const purchasePaymentAcc = paidAmount >= grandTotal ? resolved.cash : resolved.payable;
        jLines.push({
          id: 'jl-1',
          accountId: purchasePaymentAcc.id,
          accountCode: purchasePaymentAcc.code,
          accountNameAr: purchasePaymentAcc.nameAr,
          debit: grandTotal,
          credit: 0,
          memo: `تخفيض حساب المورد ${entityNameAr} - مرتجع مشتريات`,
        });
      }
      jLines.push({
        id: `jl-${jLines.length + 1}`,
        accountId: resolved.inventory.id,
        accountCode: resolved.inventory.code,
        accountNameAr: resolved.inventory.nameAr,
        debit: 0,
        credit: grandTotal,
        memo: `تخفيض المخزون لمرتجع المشتريات ${invoiceNumber}`,
      });
    }

    const jEntry: JournalEntry = {
      id: 'jv-' + Math.random().toString(36).substr(2, 9),
      entryNumber: `JV-${invoiceNumber}`,
      date: newInvoice.date,
      reference: invoiceNumber,
      description: `قيد ترحيل فاتورة ${isSales ? 'مبيعات' : 'مشتريات'} رقم (${invoiceNumber}) - ${entityNameAr}`,
      status: 'POSTED',
      lines: jLines,
      totalDebit: grandTotal,
      totalCredit: grandTotal,
      createdAt: new Date().toISOString(),
      postedAt: new Date().toISOString(),
      isAutoGenerated: true,
      sourceModule: isSales ? 'SALES_INVOICE' : 'PURCHASE_INVOICE',
      sourceId: newInvoice.id,
    };

    const journals = localDataStore.getJournals();
    journals.unshift(jEntry);
    localDataStore.saveJournals(journals);
    syncToFirestore('erp_journals', jEntry.id, jEntry);

    newInvoice.journalEntryId = jEntry.id;
    invoices.unshift(newInvoice);
    localDataStore.saveInvoices(invoices);

    // Smart Caching update
    const activeCompanyId = localDataStore.getEffectiveCompanyId() || 'default';
    if (isSales && newInvoice.entityId) {
      cacheService.updateCustomerBalance(newInvoice.entityId, dueAmount);
    } else if (!isSales && newInvoice.entityId) {
      cacheService.updateSupplierBalance(newInvoice.entityId, dueAmount);
    }
    for (const line of lines) {
      if (line.itemId) {
        const delta = isSales ? -line.quantity : line.quantity;
        cacheService.updateInventoryStock(line.itemId, delta);
      }
    }

    // High-Performance Optimistic UI: Background Non-Blocking Persistence
    backgroundSync.enqueueInvoiceCreate(newInvoice, data, activeCompanyId);
    syncToFirestore('erp_invoices', newInvoice.id, newInvoice);

    return newInvoice;
  }

  public static async postInvoice(id: string): Promise<Invoice | null> {
    const invoices = localDataStore.getInvoices();
    const inv = invoices.find((i) => i.id === id);
    if (!inv) return null;
    inv.status = 'POSTED';
    localDataStore.saveInvoices(invoices);
    if (isSupabaseConfigured) {
      SupabaseDataService.saveInvoice(inv).catch((err) =>
        console.warn('Supabase postInvoice notice:', err)
      );
    }
    syncToFirestore('erp_invoices', id, inv);
    await safeApiFetch(`/api/invoices/${id}/post`, { method: 'POST' });
    return inv;
  }

  public static async cancelInvoice(id: string, reason?: string): Promise<Invoice | null> {
    const invoices = localDataStore.getInvoices();
    const inv = invoices.find((i) => i.id === id);
    if (!inv) return null;

    if (inv.status === 'CANCELLED') {
      return inv;
    }

    const wasPostedOrPaid = inv.status === 'POSTED' || inv.status === 'PAID';
    inv.status = 'CANCELLED';
    inv.notes = (inv.notes ? inv.notes + '\n' : '') + `[ملغاة بتاريخ ${new Date().toISOString().split('T')[0]}: ${reason || 'إلغاء بطلب المستخدم'}]`;
    localDataStore.saveInvoices(invoices);
    if (isSupabaseConfigured) {
      SupabaseDataService.saveInvoice(inv).catch((err) =>
        console.warn('Supabase cancelInvoice notice:', err)
      );
    }
    syncToFirestore('erp_invoices', id, inv);

    // If the invoice was posted or paid, perform complete atomic accounting & inventory rollback:
    if (wasPostedOrPaid) {
      // 1. Locate and reverse any associated journals
      const journals = localDataStore.getJournals();
      const matchingJournals = journals.filter(
        (j) => j.id === inv.journalEntryId || j.sourceId === inv.id || j.reference === inv.invoiceNumber
      );

      for (const origJournal of matchingJournals) {
        origJournal.status = 'CANCELLED';
        syncToFirestore('erp_journals', origJournal.id, origJournal);

        // Generate corresponding Reversal Journal Entry REV-
        const revLines = origJournal.lines.map((l, i) => ({
          ...l,
          id: `rev-${i + 1}`,
          debit: l.credit,
          credit: l.debit,
          memo: `عكس قيد فاتورة ملغاة (${inv.invoiceNumber}): ${l.memo || ''}`,
        }));

        const revJournal: JournalEntry = {
          id: 'jv-rev-' + Math.random().toString(36).substr(2, 9),
          entryNumber: `REV-${origJournal.entryNumber}`,
          date: new Date().toISOString().split('T')[0],
          reference: origJournal.entryNumber,
          description: `عكس وإلغاء قيد الفاتورة ${inv.invoiceNumber} - السبب: ${reason || 'إلغاء الفاتورة بالكامل'}`,
          status: 'POSTED',
          lines: revLines,
          totalDebit: origJournal.totalCredit,
          totalCredit: origJournal.totalDebit,
          createdAt: new Date().toISOString(),
          postedAt: new Date().toISOString(),
          isAutoGenerated: true,
          sourceModule: origJournal.sourceModule,
          sourceId: inv.id,
        };

        journals.unshift(revJournal);
        syncToFirestore('erp_journals', revJournal.id, revJournal);
      }
      localDataStore.saveJournals(journals);

      // 2. Restore Inventory Quantities
      const inventory = localDataStore.getInventory();
      (inv.lines || []).forEach((line: any) => {
        const invItem = inventory.find((i) => i.id === line.itemId);
        if (invItem) {
          if (inv.type === 'SALES') {
            invItem.quantityOnHand += Number(line.quantity) || 0;
          } else if (inv.type === 'PURCHASE') {
            invItem.quantityOnHand = Math.max(0, invItem.quantityOnHand - (Number(line.quantity) || 0));
          } else if (inv.type === 'SALES_RETURN') {
            invItem.quantityOnHand = Math.max(0, invItem.quantityOnHand - (Number(line.quantity) || 0));
          } else if (inv.type === 'PURCHASE_RETURN') {
            invItem.quantityOnHand += Number(line.quantity) || 0;
          }
          syncToFirestore('erp_inventory', invItem.id, invItem);
        }
      });
      localDataStore.saveInventory(inventory);

      // 3. Reverse Customer/Supplier Balances
      const effectiveDue = inv.dueAmount !== undefined ? inv.dueAmount : inv.grandTotal;
      if ((inv.type === 'SALES' || inv.type === 'SALES_RETURN') && inv.entityId) {
        const customers = localDataStore.getCustomers();
        const cust = customers.find((c) => c.id === inv.entityId);
        if (cust) {
          if (inv.type === 'SALES') {
            cust.balance = Math.max(0, cust.balance - effectiveDue);
          } else {
            cust.balance = cust.balance + effectiveDue;
          }
          localDataStore.saveCustomers(customers);
          syncToFirestore('erp_customers', cust.id, cust);
        }
      } else if ((inv.type === 'PURCHASE' || inv.type === 'PURCHASE_RETURN') && inv.entityId) {
        const suppliers = localDataStore.getSuppliers();
        const supp = suppliers.find((s) => s.id === inv.entityId);
        if (supp) {
          if (inv.type === 'PURCHASE') {
            supp.balance = Math.max(0, supp.balance - effectiveDue);
          } else {
            supp.balance = supp.balance + effectiveDue;
          }
          localDataStore.saveSuppliers(suppliers);
          syncToFirestore('erp_suppliers', supp.id, supp);
        }
      }
    }

    await safeApiFetch(`/api/invoices/${id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });

    await this.syncSystemIntegrity();
    return inv;
  }

  public static async deleteInvoice(id: string): Promise<boolean> {
    const invoices = localDataStore.getInvoices();
    const inv = invoices.find((i) => i.id === id);
    if (!inv) return true;

    // If not already cancelled, perform complete reversal first
    if (inv.status === 'POSTED' || inv.status === 'PAID') {
      await this.cancelInvoice(id, 'حذف الفاتورة بالكامل وعكس القيود والمخزون');
    }

    // Clean up any remaining associated journals from journals list & Firestore
    const journals = localDataStore.getJournals();
    const remainingJournals = journals.filter(
      (j) => !(j.id === inv.journalEntryId || j.sourceId === inv.id || j.reference === inv.invoiceNumber)
    );
    localDataStore.saveJournals(remainingJournals);

    // Delete invoice from local store & Firestore
    const filteredInvoices = localDataStore.getInvoices().filter((i) => i.id !== id);
    localDataStore.saveInvoices(filteredInvoices);
    try {
      await SupabaseDataService.deleteInvoice(id);
    } catch (e) {
      console.warn('Supabase deleteInvoice notice:', e);
    }
    deleteFromFirestore('erp_invoices', id);

    await safeApiFetch(`/api/invoices/${id}`, { method: 'DELETE' });
    setTimeout(() => { this.syncSystemIntegrity().catch(() => {}); }, 1000);
    return true;
  }

  public static async updateInvoice(id: string, data: any): Promise<Invoice | null> {
    const invoices = localDataStore.getInvoices();
    const idx = invoices.findIndex((i) => i.id === id);
    if (idx !== -1) {
      invoices[idx] = { ...invoices[idx], ...data };
      localDataStore.saveInvoices(invoices);
      try {
        await SupabaseDataService.saveInvoice(invoices[idx]);
      } catch (e) {
        console.warn('Supabase updateInvoice notice:', e);
      }
      syncToFirestore('erp_invoices', id, invoices[idx]);
    }
    const apiRes = await safeApiFetch<Invoice>(`/api/invoices/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    setTimeout(() => { this.syncSystemIntegrity().catch(() => {}); }, 1000);
    return apiRes || (idx !== -1 ? invoices[idx] : null);
  }

  // Vouchers
  public static async getVouchers(): Promise<PaymentVoucher[]> {
    const localVouchers = localDataStore.getVouchers();
    const isLocked = localDataStore.isRestoreLocked();

    try {
      const fromSupabase = await SupabaseDataService.getVouchers();
      if (Array.isArray(fromSupabase) && fromSupabase.length > 0) {
        if (localVouchers.length > 0 && (isLocked || fromSupabase.length < localVouchers.length)) {
          if (isSupabaseConfigured) {
            SupabaseDataService.saveVouchers(localVouchers).catch(() => {});
          }
          return localVouchers;
        }
        localDataStore.saveVouchers(fromSupabase);
        return fromSupabase;
      }
    } catch (e) {
      console.warn('Supabase getVouchers notice:', e);
    }
    if (isSupabaseConfigured && localVouchers.length > 0) {
      SupabaseDataService.saveVouchers(localVouchers).catch(() => {});
    }
    return localVouchers;
  }

  public static async createVoucher(data: any): Promise<PaymentVoucher> {
    const vouchers = localDataStore.getVouchers();
    const customers = localDataStore.getCustomers();
    const suppliers = localDataStore.getSuppliers();
    const invoices = localDataStore.getInvoices();

    const isReceipt = data.type === 'RECEIPT';
    const voucherNumber = `${isReceipt ? 'RCV' : 'PAY'}-2026-${String(vouchers.length + 1).padStart(4, '0')}`;
    const amount = Number(data.amount) || 0;

    let entityNameAr = data.entityNameAr || data.entityName || '';
    if (isReceipt && data.entityId) {
      const c = customers.find((x) => x.id === data.entityId);
      if (c) {
        entityNameAr = c.nameAr;
        c.balance = Math.max(0, c.balance - amount);
        localDataStore.saveCustomers(customers);
        syncToFirestore('erp_customers', c.id, c);
      }
    } else if (!isReceipt && data.entityId) {
      const s = suppliers.find((x) => x.id === data.entityId);
      if (s) {
        entityNameAr = s.nameAr;
        s.balance = Math.max(0, s.balance - amount);
        localDataStore.saveSuppliers(suppliers);
        syncToFirestore('erp_suppliers', s.id, s);
      }
    }

    if (data.invoiceId) {
      const inv = invoices.find((i) => i.id === data.invoiceId);
      if (inv) {
        inv.paidAmount += amount;
        inv.dueAmount = Math.max(0, inv.grandTotal - inv.paidAmount);
        if (inv.dueAmount <= 0) inv.status = 'PAID';
        localDataStore.saveInvoices(invoices);
        syncToFirestore('erp_invoices', inv.id, inv);
      }
    }

    const newVoucher: PaymentVoucher = {
      id: 'vch-' + Math.random().toString(36).substr(2, 9),
      voucherNumber,
      type: data.type || 'RECEIPT',
      date: data.date || new Date().toISOString().split('T')[0],
      amount,
      paymentMethod: data.paymentMethod === 'CASH' ? 'CASH' : 'BANK',
      bankAccountId: data.bankAccountId || (data.paymentMethod === 'CASH' ? this.getResolvedAccounts().cash.id : this.getResolvedAccounts().bank.id),
      entityType: data.entityType || (isReceipt ? 'CUSTOMER' : 'SUPPLIER'),
      entityId: data.entityId || '',
      entityNameAr,
      invoiceId: data.invoiceId,
      reference: data.reference || data.referenceNumber || '',
      notes: data.notes || '',
      createdAt: new Date().toISOString(),
    };

    const resolved = this.getResolvedAccounts();
    const accounts = localDataStore.getAccounts();
    let liquidAcc = newVoucher.paymentMethod === 'CASH' ? resolved.cash : resolved.bank;
    if (data.bankAccountId) {
      const found = accounts.find((a) => a.id === data.bankAccountId || a.code === data.bankAccountId);
      if (found) liquidAcc = found;
    }

    const jLines = isReceipt
      ? [
          {
            id: 'jl-1',
            accountId: liquidAcc.id,
            accountCode: liquidAcc.code,
            accountNameAr: liquidAcc.nameAr,
            debit: amount,
            credit: 0,
            memo: `قبض مبالغ سند رقم ${voucherNumber} - ${entityNameAr}`,
          },
          {
            id: 'jl-2',
            accountId: resolved.receivable.id,
            accountCode: resolved.receivable.code,
            accountNameAr: resolved.receivable.nameAr,
            debit: 0,
            credit: amount,
            memo: `تحصيل من العميل ${entityNameAr}`,
          },
        ]
      : [
          {
            id: 'jl-1',
            accountId: resolved.payable.id,
            accountCode: resolved.payable.code,
            accountNameAr: resolved.payable.nameAr,
            debit: amount,
            credit: 0,
            memo: `سداد للمورد ${entityNameAr}`,
          },
          {
            id: 'jl-2',
            accountId: liquidAcc.id,
            accountCode: liquidAcc.code,
            accountNameAr: liquidAcc.nameAr,
            debit: 0,
            credit: amount,
            memo: `صرف مبالغ سند رقم ${voucherNumber} - ${entityNameAr}`,
          },
        ];

    const jEntry: JournalEntry = {
      id: 'jv-' + Math.random().toString(36).substr(2, 9),
      entryNumber: `JV-${voucherNumber}`,
      date: newVoucher.date,
      reference: voucherNumber,
      description: `قيد ترحيل سند ${isReceipt ? 'قبض' : 'صرف'} رقم (${voucherNumber}) - ${entityNameAr}`,
      status: 'POSTED',
      lines: jLines,
      totalDebit: amount,
      totalCredit: amount,
      createdAt: new Date().toISOString(),
      postedAt: new Date().toISOString(),
      isAutoGenerated: true,
      sourceModule: isReceipt ? 'RECEIPT' : 'PAYMENT',
      sourceId: newVoucher.id,
    };

    const journals = localDataStore.getJournals();
    journals.unshift(jEntry);
    localDataStore.saveJournals(journals);
    syncToFirestore('erp_journals', jEntry.id, jEntry);

    newVoucher.journalEntryId = jEntry.id;
    vouchers.unshift(newVoucher);
    localDataStore.saveVouchers(vouchers);

    // Smart Caching update
    const activeCompanyId = localDataStore.getEffectiveCompanyId() || 'default';
    if (isReceipt && newVoucher.entityId) {
      cacheService.updateCustomerBalance(newVoucher.entityId, -amount);
    } else if (!isReceipt && newVoucher.entityId) {
      cacheService.updateSupplierBalance(newVoucher.entityId, -amount);
    }

    // High-Performance Optimistic UI: Background Non-Blocking Persistence
    backgroundSync.enqueueVoucherCreate(newVoucher, data, activeCompanyId);
    syncToFirestore('erp_vouchers', newVoucher.id, newVoucher);

    // Non-blocking background integrity check
    setTimeout(() => {
      this.syncSystemIntegrity().catch(() => {});
    }, 1000);

    return newVoucher;
  }

  public static async cancelVoucher(id: string, reason: string): Promise<PaymentVoucher | null> {
    const vouchers = localDataStore.getVouchers();
    const v = vouchers.find((x) => x.id === id);
    if (v) {
      v.status = 'CANCELLED';
      localDataStore.saveVouchers(vouchers);
      const activeCompanyId = localDataStore.getEffectiveCompanyId() || 'default';
      backgroundSync.enqueueVoucherCancel(v, reason, activeCompanyId);
      syncToFirestore('erp_vouchers', id, v);
    }
    safeApiFetch<PaymentVoucher>(`/api/vouchers/${id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    }).catch(() => {});
    return v || null;
  }

  public static async updateVoucher(id: string, data: any): Promise<PaymentVoucher | null> {
    const vouchers = localDataStore.getVouchers();
    const idx = vouchers.findIndex((x) => x.id === id);
    if (idx !== -1) {
      vouchers[idx] = { ...vouchers[idx], ...data };
      localDataStore.saveVouchers(vouchers);
      if (isSupabaseConfigured) {
        SupabaseDataService.saveVoucher(vouchers[idx]).catch(() => {});
      }
      syncToFirestore('erp_vouchers', id, vouchers[idx]);
    }
    const apiRes = await safeApiFetch<PaymentVoucher>(`/api/vouchers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    setTimeout(() => { this.syncSystemIntegrity().catch(() => {}); }, 1000);
    return apiRes || (idx !== -1 ? vouchers[idx] : null);
  }

  public static async deleteVoucher(id: string): Promise<boolean> {
    const vouchers = localDataStore.getVouchers();
    const filtered = vouchers.filter((v) => v.id !== id);
    localDataStore.saveVouchers(filtered);
    if (isSupabaseConfigured) {
      SupabaseDataService.deleteVoucher(id).catch((err) =>
        console.warn('Supabase deleteVoucher notice:', err)
      );
    }
    deleteFromFirestore('erp_vouchers', id);
    await safeApiFetch(`/api/vouchers/${id}`, { method: 'DELETE' });
    setTimeout(() => { this.syncSystemIntegrity().catch(() => {}); }, 1000);
    return true;
  }

  // Customers & Suppliers
  public static async getCustomers(): Promise<Customer[]> {
    const compId = localDataStore.getEffectiveCompanyId() || 'default';
    const cached = cacheService.getCustomers(compId);
    if (cached && cached.length > 0) {
      return cached;
    }

    const localCustomers = localDataStore.getCustomers();
    if (localCustomers.length > 0) {
      cacheService.setCustomers(compId, localCustomers);
    }
    const isLocked = localDataStore.isRestoreLocked();

    const fetchRemote = async () => {
      try {
        const fromSupabase = await SupabaseDataService.getCustomers();
        if (Array.isArray(fromSupabase) && fromSupabase.length > 0) {
          if (localCustomers.length > 0 && (isLocked || fromSupabase.length < localCustomers.length)) {
            if (isSupabaseConfigured) {
              Promise.all(localCustomers.map((c) => SupabaseDataService.saveCustomer(c))).catch(() => {});
            }
            return localCustomers;
          }
          localDataStore.saveCustomers(fromSupabase);
          cacheService.setCustomers(compId, fromSupabase);
          return fromSupabase;
        }
      } catch (e) {
        console.warn('Supabase getCustomers notice:', e);
      }
      return localCustomers;
    };

    if (localCustomers.length > 0) {
      fetchRemote().catch(() => {});
      return localCustomers;
    }
    return await fetchRemote();
  }

  public static async createCustomer(data: any): Promise<Customer> {
    const list = localDataStore.getCustomers();
    const newCust: Customer = {
      id: 'cust-' + Math.random().toString(36).substr(2, 9),
      code: data.code || `CUST-${String(list.length + 1).padStart(3, '0')}`,
      nameAr: data.nameAr || 'عميل جديد',
      nameEn: data.nameEn || '',
      taxNumber: data.taxNumber,
      phone: data.phone,
      address: data.address,
      governorate: data.governorate,
      city: data.city,
      balance: Number(data.openingBalance) || Number(data.balance) || 0,
      openingBalance: Number(data.openingBalance) || 0,
      openingBalanceDate: data.openingBalanceDate || '2026-07-01',
      isActive: true,
      branches: data.branches || [],
      priceListId: data.priceListId || 'standard',
      priceListName: data.priceListName || '',
      customPrices: data.customPrices || [],
      defaultDiscountRate: data.defaultDiscountRate !== undefined ? Number(data.defaultDiscountRate) : 0,
    };
    list.push(newCust);
    localDataStore.saveCustomers(list);
    const compId = localDataStore.getEffectiveCompanyId() || 'default';
    cacheService.setCustomers(compId, list);
    try {
      await SupabaseDataService.saveCustomer(newCust);
    } catch (e) {
      console.warn('Supabase saveCustomer notice:', e);
    }
    syncToFirestore('erp_customers', newCust.id, newCust);
    await safeApiFetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return newCust;
  }

  public static async updateCustomer(id: string, data: any): Promise<Customer | null> {
    const list = localDataStore.getCustomers();
    const idx = list.findIndex((c) => c.id === id);
    if (idx === -1) return null;

    const oldOpening = Number(list[idx].openingBalance) || 0;
    const newOpening = data.openingBalance !== undefined ? Number(data.openingBalance) : oldOpening;
    const diff = newOpening - oldOpening;

    const currentBalance = Number(list[idx].balance) || 0;
    const updatedBalance = data.balance !== undefined ? Number(data.balance) : currentBalance + diff;

    list[idx] = {
      ...list[idx],
      ...data,
      openingBalance: newOpening,
      openingBalanceDate: data.openingBalanceDate !== undefined ? data.openingBalanceDate : (list[idx].openingBalanceDate || '2026-07-01'),
      balance: updatedBalance,
      currentBalance: updatedBalance,
    };
    localDataStore.saveCustomers(list);
    const compId = localDataStore.getEffectiveCompanyId() || 'default';
    cacheService.setCustomers(compId, list);
    try {
      await SupabaseDataService.saveCustomer(list[idx]);
    } catch (e) {
      console.warn('Supabase updateCustomer notice:', e);
    }
    syncToFirestore('erp_customers', id, list[idx]);
    const apiRes = await safeApiFetch<any>(`/api/customers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, balance: updatedBalance, currentBalance: updatedBalance }),
    });
    if (apiRes && apiRes.customer) {
      list[idx] = { ...list[idx], ...apiRes.customer };
      localDataStore.saveCustomers(list);
      cacheService.setCustomers(compId, list);
    }
    return list[idx];
  }

  public static async deleteCustomer(id: string): Promise<boolean> {
    const list = localDataStore.getCustomers();
    const filtered = list.filter((c) => c.id !== id);
    localDataStore.saveCustomers(filtered);
    const compId = localDataStore.getEffectiveCompanyId() || 'default';
    cacheService.setCustomers(compId, filtered);
    try {
      await SupabaseDataService.deleteCustomer(id);
    } catch (e) {
      console.warn('Supabase deleteCustomer notice:', e);
    }
    deleteFromFirestore('erp_customers', id);
    await safeApiFetch(`/api/customers/${id}`, { method: 'DELETE' });
    return true;
  }

  public static async getSuppliers(): Promise<Supplier[]> {
    const compId = localDataStore.getEffectiveCompanyId() || 'default';
    const cached = cacheService.getSuppliers(compId);
    if (cached && cached.length > 0) {
      return cached;
    }

    const localSuppliers = localDataStore.getSuppliers();
    if (localSuppliers.length > 0) {
      cacheService.setSuppliers(compId, localSuppliers);
    }
    const isLocked = localDataStore.isRestoreLocked();

    const fetchRemote = async () => {
      try {
        const fromSupabase = await SupabaseDataService.getSuppliers();
        if (Array.isArray(fromSupabase) && fromSupabase.length > 0) {
          if (localSuppliers.length > 0 && (isLocked || fromSupabase.length < localSuppliers.length)) {
            if (isSupabaseConfigured) {
              Promise.all(localSuppliers.map((s) => SupabaseDataService.saveSupplier(s))).catch(() => {});
            }
            return localSuppliers;
          }
          localDataStore.saveSuppliers(fromSupabase);
          cacheService.setSuppliers(compId, fromSupabase);
          return fromSupabase;
        }
      } catch (e) {
        console.warn('Supabase getSuppliers notice:', e);
      }
      return localSuppliers;
    };

    if (localSuppliers.length > 0) {
      fetchRemote().catch(() => {});
      return localSuppliers;
    }
    return await fetchRemote();
  }

  public static async createSupplier(data: any): Promise<Supplier> {
    const list = localDataStore.getSuppliers();
    const newSupp: Supplier = {
      id: 'supp-' + Math.random().toString(36).substr(2, 9),
      code: data.code || `SUPP-${String(list.length + 1).padStart(3, '0')}`,
      nameAr: data.nameAr || 'مورد جديد',
      nameEn: data.nameEn || '',
      taxNumber: data.taxNumber,
      phone: data.phone,
      address: data.address,
      governorate: data.governorate,
      city: data.city,
      balance: Number(data.openingBalance) || Number(data.balance) || 0,
      openingBalance: Number(data.openingBalance) || 0,
      openingBalanceDate: data.openingBalanceDate || '2026-07-01',
      isActive: true,
    };
    list.push(newSupp);
    localDataStore.saveSuppliers(list);
    const compId = localDataStore.getEffectiveCompanyId() || 'default';
    cacheService.setSuppliers(compId, list);
    try {
      await SupabaseDataService.saveSupplier(newSupp);
    } catch (e) {
      console.warn('Supabase saveSupplier notice:', e);
    }
    syncToFirestore('erp_suppliers', newSupp.id, newSupp);
    await safeApiFetch('/api/suppliers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return newSupp;
  }

  public static async updateSupplier(id: string, data: any): Promise<Supplier | null> {
    const list = localDataStore.getSuppliers();
    const idx = list.findIndex((s) => s.id === id);
    if (idx === -1) return null;

    const oldOpening = Number(list[idx].openingBalance) || 0;
    const newOpening = data.openingBalance !== undefined ? Number(data.openingBalance) : oldOpening;
    const diff = newOpening - oldOpening;

    const currentBalance = Number(list[idx].balance) || 0;
    const updatedBalance = data.balance !== undefined ? Number(data.balance) : currentBalance + diff;

    list[idx] = {
      ...list[idx],
      ...data,
      openingBalance: newOpening,
      openingBalanceDate: data.openingBalanceDate !== undefined ? data.openingBalanceDate : (list[idx].openingBalanceDate || '2026-07-01'),
      balance: updatedBalance,
      currentBalance: updatedBalance,
    };
    localDataStore.saveSuppliers(list);
    const compId = localDataStore.getEffectiveCompanyId() || 'default';
    cacheService.setSuppliers(compId, list);
    try {
      await SupabaseDataService.saveSupplier(list[idx]);
    } catch (e) {
      console.warn('Supabase updateSupplier notice:', e);
    }
    syncToFirestore('erp_suppliers', id, list[idx]);
    const apiRes = await safeApiFetch<any>(`/api/suppliers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, balance: updatedBalance, currentBalance: updatedBalance }),
    });
    if (apiRes && apiRes.supplier) {
      list[idx] = { ...list[idx], ...apiRes.supplier };
      localDataStore.saveSuppliers(list);
      cacheService.setSuppliers(compId, list);
    }
    return list[idx];
  }

  public static async deleteSupplier(id: string): Promise<boolean> {
    const list = localDataStore.getSuppliers();
    const filtered = list.filter((s) => s.id !== id);
    localDataStore.saveSuppliers(filtered);
    const compId = localDataStore.getEffectiveCompanyId() || 'default';
    cacheService.setSuppliers(compId, filtered);
    try {
      await SupabaseDataService.deleteSupplier(id);
    } catch (e) {
      console.warn('Supabase deleteSupplier notice:', e);
    }
    deleteFromFirestore('erp_suppliers', id);
    await safeApiFetch(`/api/suppliers/${id}`, { method: 'DELETE' });
    return true;
  }

  // Inventory
  public static async getInventory(): Promise<InventoryItem[]> {
    const compId = localDataStore.getEffectiveCompanyId() || 'default';
    const cached = cacheService.getItems(compId);
    if (cached && cached.length > 0) {
      return cached;
    }

    const localInventory = localDataStore.getInventory();
    if (localInventory.length > 0) {
      cacheService.setItems(compId, localInventory);
    }
    const isLocked = localDataStore.isRestoreLocked();

    const fetchRemote = async () => {
      try {
        const fromSupabase = await SupabaseDataService.getItems();
        if (Array.isArray(fromSupabase) && fromSupabase.length > 0) {
          if (localInventory.length > 0 && (isLocked || fromSupabase.length < localInventory.length)) {
            if (isSupabaseConfigured) {
              Promise.all(localInventory.map((item) => SupabaseDataService.saveItem(item))).catch(() => {});
            }
            return localInventory;
          }
          localDataStore.saveInventory(fromSupabase);
          cacheService.setItems(compId, fromSupabase);
          return fromSupabase;
        }
      } catch (e) {
        console.warn('Supabase getInventory notice:', e);
      }
      return localInventory;
    };

    if (localInventory.length > 0) {
      fetchRemote().catch(() => {});
      return localInventory;
    }
    return await fetchRemote();
  }

  public static async createInventoryItem(data: any): Promise<InventoryItem> {
    const list = localDataStore.getInventory();
    const newItem: InventoryItem = {
      id: 'inv-' + Math.random().toString(36).substr(2, 9),
      sku: data.sku || `${Date.now()}`,
      barcode: data.barcode,
      nameAr: data.nameAr || 'صنف جديد',
      nameEn: data.nameEn || '',
      category: data.category || 'FINISHED_GOODS',
      unit: data.unit || 'حبة',
      unitsPerPack: Number(data.unitsPerPack) || 1,
      packUnit: data.packUnit,
      purchasePrice: Number(data.purchasePrice) || Number(data.unitCost) || 0,
      salePrice: Number(data.salePrice) || Number(data.unitPrice) || 0,
      quantityOnHand: Number(data.quantityOnHand) || 0,
      minQuantityAlert: Number(data.minQuantityAlert) || 10,
      isActive: true,
    };
    list.push(newItem);
    localDataStore.saveInventory(list);
    const compId = localDataStore.getEffectiveCompanyId() || 'default';
    cacheService.setItems(compId, list);
    try {
      await SupabaseDataService.saveItem(newItem);
    } catch (e) {
      console.warn('Supabase saveItem notice:', e);
    }
    syncToFirestore('erp_inventory', newItem.id, newItem);
    await safeApiFetch('/api/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return newItem;
  }

  public static async bulkImportInventory(
    items: Partial<InventoryItem>[],
    options: {
      mode?: 'upsert' | 'append' | 'update_only';
      createOpeningJournal?: boolean;
    } = {}
  ): Promise<{
    count: number;
    updatedCount: number;
    newCount: number;
    totalStockValue: number;
    journalId?: string;
    verifiedInDb?: boolean;
    totalInventoryInDb?: number;
    verifiedAt?: string;
  }> {
    const list = localDataStore.getInventory();
    const mode = options.mode || 'upsert';
    let totalStockValue = 0;
    const affectedItems: InventoryItem[] = [];
    let updatedCount = 0;
    let newCount = 0;

    const sanitizeNum = (val: any, fallback = 0): number => {
      if (val === undefined || val === null || val === '') return fallback;
      if (typeof val === 'number') return isNaN(val) ? fallback : Math.max(0, val);
      let s = String(val).trim();
      s = s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
      s = s.replace(/[^\d.-]/g, '');
      const n = parseFloat(s);
      return isNaN(n) ? fallback : Math.max(0, n);
    };

    items.forEach((it, index) => {
      const rawSku = (it.sku ? String(it.sku) : '').trim();
      const rawBarcode = (it.barcode ? String(it.barcode) : '').trim();
      const qty = sanitizeNum(it.quantityOnHand, 0);
      const cost = sanitizeNum(it.purchasePrice, 0);
      const sale = sanitizeNum(it.salePrice, 0);
      const unitsPerPack = Math.max(1, Math.round(sanitizeNum(it.unitsPerPack, 1)));
      const minAlert = sanitizeNum(it.minQuantityAlert, 5);

      const nameAr = (it.nameAr ? String(it.nameAr) : '').trim() || (it.nameEn ? String(it.nameEn) : '').trim() || `صنف مخزني ${index + 1}`;
      const nameEn = (it.nameEn ? String(it.nameEn) : '').trim() || nameAr;
      const category = (it.category ? String(it.category) : '').trim() || 'عام';
      const unit = (it.unit ? String(it.unit) : '').trim() || 'حبة';
      const packUnit = (it.packUnit ? String(it.packUnit) : '').trim() || 'كرتون';

      const existingIdx = list.findIndex(
        (existing) =>
          (rawSku && existing.sku.toLowerCase() === rawSku.toLowerCase()) ||
          (rawBarcode && existing.barcode && existing.barcode === rawBarcode)
      );

      if (existingIdx !== -1 && mode !== 'append') {
        const existing = list[existingIdx];
        const updatedItem: InventoryItem = {
          ...existing,
          sku: rawSku || existing.sku,
          barcode: rawBarcode || existing.barcode || '',
          nameAr: nameAr || existing.nameAr,
          nameEn: nameEn || existing.nameEn,
          category: category || existing.category,
          unit: unit || existing.unit,
          unitsPerPack: unitsPerPack || existing.unitsPerPack || 1,
          packUnit: packUnit || existing.packUnit || 'كرتون',
          purchasePrice: cost > 0 ? cost : existing.purchasePrice,
          salePrice: sale > 0 ? sale : existing.salePrice,
          quantityOnHand: it.quantityOnHand !== undefined ? qty : existing.quantityOnHand,
          minQuantityAlert: it.minQuantityAlert !== undefined ? minAlert : existing.minQuantityAlert,
          isActive: it.isActive !== undefined ? it.isActive : existing.isActive,
        };
        list[existingIdx] = updatedItem;
        affectedItems.push(updatedItem);
        updatedCount++;
        totalStockValue += (updatedItem.quantityOnHand || 0) * (updatedItem.purchasePrice || 0);
      } else if (mode !== 'update_only') {
        const id = it.id || 'inv-' + Math.random().toString(36).substr(2, 9);
        const sku = rawSku || `SKU-${Date.now().toString().slice(-4)}-${index + 1}`;

        const newItem: InventoryItem = {
          id,
          sku,
          barcode: rawBarcode,
          nameAr,
          nameEn,
          category,
          unit,
          unitsPerPack,
          packUnit,
          purchasePrice: cost,
          salePrice: sale,
          quantityOnHand: qty,
          minQuantityAlert: minAlert,
          isActive: it.isActive !== undefined ? it.isActive : true,
        };

        list.push(newItem);
        affectedItems.push(newItem);
        newCount++;
        totalStockValue += qty * cost;
      }
    });

    localDataStore.saveInventory(list);
    const compId = localDataStore.getEffectiveCompanyId() || 'default';
    cacheService.setItems(compId, list);

    // Sync to Supabase in background
    if (isSupabaseConfigured) {
      Promise.all(affectedItems.map((item) => SupabaseDataService.saveItem(item))).catch(console.warn);
    }

    // Call server API for state synchronization and robust persistence
    let serverJournalId: string | undefined = undefined;
    let serverTotalInDb = list.length;
    let serverVerified = true;
    try {
      const res: any = await safeApiFetch('/api/import/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, createOpeningJournal: !!options.createOpeningJournal, mode }),
      });
      if (res && res.openingJournalId) {
        serverJournalId = res.openingJournalId;
      }
      if (res && res.totalInventoryInDb) {
        serverTotalInDb = res.totalInventoryInDb;
      }
      if (res && res.verified !== undefined) {
        serverVerified = res.verified;
      }
    } catch (e) {
      console.warn('Server import sync notice:', e);
    }

    // If opening journal requested and not generated on server, create locally
    let localJournalId: string | undefined = serverJournalId;
    if (options.createOpeningJournal && totalStockValue > 0 && !serverJournalId) {
      try {
        const journal = await this.createJournal({
          entryNumber: `JV-OPEN-INV-${Date.now().toString().slice(-4)}`,
          date: new Date().toISOString().split('T')[0],
          description: `قيد افتتاحي: إثبات قيمة بضاعة ومخزون أول المدة للأصناف المستوردة (عدد ${affectedItems.length})`,
          reference: 'OPENING-STOCK',
          status: 'POSTED',
          totalDebit: totalStockValue,
          totalCredit: totalStockValue,
          lines: [
            {
              id: 'line-1',
              accountId: 'acc-1130',
              accountCode: '1130',
              accountNameAr: 'مخزون البضائع والمنتجات',
              debit: totalStockValue,
              credit: 0,
              memo: 'إثبات بضاعة ومخزون أول المدة',
            },
            {
              id: 'line-2',
              accountId: 'acc-3200',
              accountCode: '3200',
              accountNameAr: 'الأرباح (الخسائر) المرحلة والمبقاة',
              debit: 0,
              credit: totalStockValue,
              memo: 'رصيد مخزون أول المدة مقابل حقوق الملكية',
            },
          ],
        });
        localJournalId = journal?.id;
      } catch (err) {
        console.warn('Local opening journal creation notice:', err);
      }
    }

    return {
      count: affectedItems.length,
      updatedCount,
      newCount,
      totalStockValue,
      journalId: localJournalId,
      verifiedInDb: serverVerified,
      totalInventoryInDb: serverTotalInDb,
      verifiedAt: new Date().toISOString(),
    };
  }

  public static async updateInventoryItem(id: string, data: any): Promise<InventoryItem | null> {
    const list = localDataStore.getInventory();
    const idx = list.findIndex((i) => i.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...data };
    localDataStore.saveInventory(list);
    const compId = localDataStore.getEffectiveCompanyId() || 'default';
    cacheService.setItems(compId, list);
    try {
      await SupabaseDataService.saveItem(list[idx]);
    } catch (e) {
      console.warn('Supabase updateItem notice:', e);
    }
    syncToFirestore('erp_inventory', id, list[idx]);
    await safeApiFetch(`/api/inventory/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return list[idx];
  }

  public static async deleteInventoryItem(id: string): Promise<boolean> {
    const list = localDataStore.getInventory();
    const filtered = list.filter((i) => i.id !== id);
    localDataStore.saveInventory(filtered);
    const compId = localDataStore.getEffectiveCompanyId() || 'default';
    cacheService.setItems(compId, filtered);
    try {
      await SupabaseDataService.deleteItem(id);
    } catch (e) {
      console.warn('Supabase deleteItem notice:', e);
    }
    deleteFromFirestore('erp_inventory', id);
    await safeApiFetch(`/api/inventory/${id}`, { method: 'DELETE' });
    return true;
  }

  // Fast local O(1) synchronous getters for ultra-high-speed UI responsiveness
  public static getLocalInvoices(): Invoice[] {
    return localDataStore.getInvoices();
  }

  public static getLocalVouchers(): PaymentVoucher[] {
    return localDataStore.getVouchers();
  }

  public static getLocalCustomers(): Customer[] {
    return localDataStore.getCustomers();
  }

  public static getLocalSuppliers(): Supplier[] {
    return localDataStore.getSuppliers();
  }

  public static getLocalInventory(): InventoryItem[] {
    return localDataStore.getInventory();
  }

  public static getLocalJournals(): JournalEntry[] {
    return localDataStore.getJournals();
  }

  public static getLocalAccounts(): Account[] {
    return localDataStore.getAccounts();
  }

  // Units
  public static async getUnits(): Promise<UnitDefinition[]> {
    const fromApi = await safeApiFetch<UnitDefinition[]>('/api/units');
    if (fromApi) {
      localDataStore.saveUnits(fromApi);
      return fromApi;
    }
    return localDataStore.getUnits();
  }

  public static async createUnit(data: any): Promise<UnitDefinition> {
    const list = localDataStore.getUnits();
    const newUnit: UnitDefinition = {
      id: 'unit-' + Math.random().toString(36).substr(2, 9),
      code: data.code || 'UNIT',
      nameAr: data.nameAr || 'وحدة',
      nameEn: data.nameEn || '',
      conversionFactor: Number(data.conversionFactor) || 1,
      isBaseUnit: !!data.isBaseUnit,
      description: data.description,
    };
    list.push(newUnit);
    localDataStore.saveUnits(list);
    syncToFirestore('erp_units', newUnit.id, newUnit);
    await safeApiFetch('/api/units', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return newUnit;
  }

  public static async updateUnit(id: string, data: any): Promise<UnitDefinition | null> {
    const list = localDataStore.getUnits();
    const idx = list.findIndex((u) => u.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...data };
    localDataStore.saveUnits(list);
    syncToFirestore('erp_units', id, list[idx]);
    await safeApiFetch(`/api/units/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return list[idx];
  }

  public static async deleteUnit(id: string): Promise<boolean> {
    const list = localDataStore.getUnits();
    const filtered = list.filter((u) => u.id !== id);
    localDataStore.saveUnits(filtered);
    deleteFromFirestore('erp_units', id);
    await safeApiFetch(`/api/units/${id}`, { method: 'DELETE' });
    return true;
  }

  // Production Orders
  public static async getProductionOrders(): Promise<ProductionOrder[]> {
    const fromSupabase = await SupabaseDataService.getProductionOrders();
    if (fromSupabase && fromSupabase.length > 0) {
      localDataStore.saveProductionOrders(fromSupabase);
      return fromSupabase;
    }
    const fromApi = await safeApiFetch<ProductionOrder[]>('/api/production-orders');
    if (fromApi) {
      localDataStore.saveProductionOrders(fromApi);
      return fromApi;
    }
    return localDataStore.getProductionOrders();
  }

  public static async createProductionOrder(orderData: Partial<ProductionOrder>): Promise<ProductionOrder> {
    const orders = localDataStore.getProductionOrders();
    const inventory = localDataStore.getInventory();
    const journals = localDataStore.getJournals();

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
      newOrder.rawMaterials.forEach((raw) => {
        const item = inventory.find((i) => i.id === raw.itemId);
        if (item) {
          item.quantityOnHand = Math.max(0, item.quantityOnHand - raw.quantityRequired);
        }
      });

      const targetItem = inventory.find((i) => i.id === newOrder.targetItemId);
      if (targetItem) {
        targetItem.quantityOnHand += newOrder.targetQuantity;
        if (newOrder.unitProductionCost > 0) {
          targetItem.costPrice = newOrder.unitProductionCost;
        }
      }

      if (newOrder.byProducts && newOrder.byProducts.length > 0) {
        newOrder.byProducts.forEach((bp) => {
          if (bp.itemId) {
            const bpItem = inventory.find((i) => i.id === bp.itemId);
            if (bpItem) {
              bpItem.quantityOnHand += bp.quantity;
            }
          }
        });
      }

      localDataStore.saveInventory(inventory);

      const totalDebit = newOrder.totalProductionCost;
      const rawCost = newOrder.rawMaterials.reduce((s, r) => s + r.totalCost, 0);
      const resolved = this.getResolvedAccounts();

      const jLines = [
        {
          id: 'jl-1',
          accountId: resolved.inventory.id,
          accountCode: resolved.inventory.code,
          accountNameAr: resolved.inventory.nameAr,
          debit: totalDebit,
          credit: 0,
          memo: `إنتاج تام - أمر تصنيع رقم ${newOrder.orderNumber} (${newOrder.targetItemNameAr}) - ${lineName}`,
        },
        {
          id: 'jl-2',
          accountId: resolved.inventory.id,
          accountCode: resolved.inventory.code,
          accountNameAr: resolved.inventory.nameAr,
          debit: 0,
          credit: rawCost,
          memo: `استهلاك مكونات وخامات - أمر تصنيع ${newOrder.orderNumber}`,
        },
      ];

      if (newOrder.overheadCost > 0) {
        jLines.push({
          id: 'jl-3',
          accountId: resolved.cogs.id,
          accountCode: resolved.cogs.code,
          accountNameAr: resolved.cogs.nameAr,
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

      journals.push(jEntry);
      localDataStore.saveJournals(journals);
      newOrder.journalEntryId = jEntry.id;
      SupabaseDataService.saveJournal(jEntry).catch(() => {});
    }

    orders.unshift(newOrder);
    localDataStore.saveProductionOrders(orders);
    SupabaseDataService.saveProductionOrder(newOrder).catch(() => {});

    await safeApiFetch('/api/production-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData),
    });

    return newOrder;
  }

  // Manufacturing Standard Settings
  public static getLocalManufacturingSettings(companyId?: string): ManufacturingStandardSettings {
    return localDataStore.getManufacturingSettings();
  }

  public static async getManufacturingSettings(companyId?: string): Promise<ManufacturingStandardSettings> {
    const fromSupabase = await SupabaseDataService.getManufacturingSettings();
    if (fromSupabase) {
      localDataStore.saveManufacturingSettings(fromSupabase);
      return fromSupabase;
    }
    return localDataStore.getManufacturingSettings();
  }

  public static async saveManufacturingSettings(
    companyIdOrSettings: string | ManufacturingStandardSettings,
    maybeSettings?: ManufacturingStandardSettings
  ): Promise<ManufacturingStandardSettings> {
    const settings = typeof companyIdOrSettings === 'string' && maybeSettings ? maybeSettings : (companyIdOrSettings as ManufacturingStandardSettings);
    localDataStore.saveManufacturingSettings(settings);
    SupabaseDataService.saveManufacturingSettings(settings).catch(() => {});
    return settings;
  }

  // Users
  public static async getUsers(): Promise<SystemUser[]> {
    const fromApi = await safeApiFetch<SystemUser[]>('/api/users');
    if (fromApi) {
      localDataStore.saveUsers(fromApi);
      return fromApi;
    }
    return localDataStore.getUsers();
  }

  public static async saveUser(user: SystemUser): Promise<SystemUser> {
    const users = localDataStore.getUsers();
    const idx = users.findIndex((u) => u.id === user.id);
    if (idx >= 0) {
      users[idx] = user;
    } else {
      users.push(user);
    }
    localDataStore.saveUsers(users);
    syncToFirestore('erp_users', user.id, user);
    await safeApiFetch(`/api/users${idx >= 0 ? `/${user.id}` : ''}`, {
      method: idx >= 0 ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user),
    });
    return user;
  }

  public static async deleteUser(id: string): Promise<boolean> {
    const users = localDataStore.getUsers();
    const filtered = users.filter((u) => u.id !== id);
    localDataStore.saveUsers(filtered);
    deleteFromFirestore('erp_users', id);
    await safeApiFetch(`/api/users/${id}`, { method: 'DELETE' });
    return true;
  }

  // Financial Reports
  public static async getTrialBalance(asOfDate: string): Promise<TrialBalanceReport> {
    const accounts = localDataStore.getAccounts();
    const journals = localDataStore.getJournals().filter((j) => j.status === 'POSTED' && j.date <= asOfDate);

    const debitMap = new Map<string, number>();
    const creditMap = new Map<string, number>();

    journals.forEach((j) => {
      j.lines.forEach((l) => {
        const acc = accounts.find((a) => a.id === l.accountId || a.code === l.accountCode);
        if (acc) {
          debitMap.set(acc.id, (debitMap.get(acc.id) || 0) + (Number(l.debit) || 0));
          creditMap.set(acc.id, (creditMap.get(acc.id) || 0) + (Number(l.credit) || 0));
        }
      });
    });

    let totalMovementDebit = 0;
    let totalMovementCredit = 0;
    let totalEndingDebit = 0;
    let totalEndingCredit = 0;

    const items = accounts.map((acc) => {
      const movDeb = debitMap.get(acc.id) || 0;
      const movCred = creditMap.get(acc.id) || 0;
      totalMovementDebit += movDeb;
      totalMovementCredit += movCred;

      let endDeb = 0;
      let endCred = 0;

      if (acc.normalBalance === 'DEBIT') {
        const net = movDeb - movCred;
        if (net >= 0) endDeb = net;
        else endCred = -net;
      } else {
        const net = movCred - movDeb;
        if (net >= 0) endCred = net;
        else endDeb = -net;
      }

      totalEndingDebit += endDeb;
      totalEndingCredit += endCred;

      return {
        account: acc,
        openingBalanceDebit: 0,
        openingBalanceCredit: 0,
        movementDebit: movDeb,
        movementCredit: movCred,
        endingBalanceDebit: endDeb,
        endingBalanceCredit: endCred,
      };
    });

    return {
      asOfDate,
      items,
      totalOpeningDebit: 0,
      totalOpeningCredit: 0,
      totalMovementDebit,
      totalMovementCredit,
      totalEndingDebit,
      totalEndingCredit,
      isBalanced: Math.abs(totalEndingDebit - totalEndingCredit) < 0.001,
    };
  }

  public static async getLedger(accountId: string, startDate?: string, endDate?: string): Promise<GeneralLedgerReport | null> {
    const accounts = localDataStore.getAccounts();
    const account = accounts.find((a) => a.id === accountId || a.code === accountId);
    if (!account) return null;

    const journals = localDataStore.getJournals().filter((j) => j.status === 'POSTED');
    let runningBalance = 0;
    let totalDebit = 0;
    let totalCredit = 0;

    const movements: any[] = [];

    journals.forEach((j) => {
      j.lines.forEach((l) => {
        if (l.accountId === account.id || l.accountCode === account.code) {
          const d = Number(l.debit) || 0;
          const c = Number(l.credit) || 0;
          totalDebit += d;
          totalCredit += c;
          if (account.normalBalance === 'DEBIT') {
            runningBalance += d - c;
          } else {
            runningBalance += c - d;
          }
          movements.push({
            id: 'mov-' + Math.random().toString(36).substr(2, 9),
            journalEntryId: j.id,
            entryNumber: j.entryNumber,
            date: j.date,
            reference: j.reference,
            description: l.memo || j.description,
            debit: d,
            credit: c,
            runningBalance,
          });
        }
      });
    });

    return {
      account,
      startDate: startDate || '2026-01-01',
      endDate: endDate || new Date().toISOString().split('T')[0],
      openingBalance: 0,
      totalDebit,
      totalCredit,
      closingBalance: runningBalance,
      movements,
    };
  }

  public static async getPnL(startDate: string, endDate: string): Promise<IncomeStatementReport> {
    const start = startDate || '2026-01-01';
    const end = endDate || '2099-12-31';
    const accounts = localDataStore.getAccounts();
    const postedJournals = localDataStore.getJournals().filter((j) => j.status === 'POSTED');

    // Aggregate movements in date range
    const rangeMovementMap = new Map<string, { debit: number; credit: number }>();
    accounts.forEach((acc) => rangeMovementMap.set(acc.id, { debit: 0, credit: 0 }));

    for (const j of postedJournals) {
      if (j.date >= start && j.date <= end) {
        for (const line of j.lines || []) {
          const accId = line.accountId || accounts.find((a) => a.code === line.accountCode)?.id;
          if (accId) {
            const entry = rangeMovementMap.get(accId);
            if (entry) {
              entry.debit += Number(line.debit) || 0;
              entry.credit += Number(line.credit) || 0;
            }
          }
        }
      }
    }

    const revenues: { accountCode: string; accountNameAr: string; amount: number }[] = [];
    const cogs: { accountCode: string; accountNameAr: string; amount: number }[] = [];
    const expenses: { accountCode: string; accountNameAr: string; amount: number }[] = [];

    let totalRevenue = 0;
    let totalCogs = 0;
    let totalExpenses = 0;

    accounts.forEach((acc) => {
      // Leaf accounts only
      const hasChildren = accounts.some((child) => child.parentId === acc.id);
      if (hasChildren && acc.level < 4) return;

      const isRev = acc.category === 'REVENUE' || acc.code.startsWith('4');
      const isExp = acc.category === 'EXPENSE' || acc.code.startsWith('5');
      if (!isRev && !isExp) return;

      const { debit: sumDebit, credit: sumCredit } = rangeMovementMap.get(acc.id) || { debit: 0, credit: 0 };

      if (isRev) {
        const netAmount = sumCredit - sumDebit;
        if (netAmount !== 0) {
          revenues.push({
            accountCode: acc.code,
            accountNameAr: acc.nameAr,
            amount: netAmount,
          });
          totalRevenue += netAmount;
        }
      } else if (isExp) {
        const netAmount = sumDebit - sumCredit;
        if (netAmount !== 0) {
          if (acc.code.startsWith('51') || (acc.category as string) === 'COGS') {
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

  public static async getBalanceSheet(asOfDate: string): Promise<BalanceSheetReport> {
    const cutoff = asOfDate || new Date().toISOString().split('T')[0];
    const incomeStatement = await this.getPnL('2000-01-01', cutoff);
    const periodNetIncome = incomeStatement.netIncome;

    const accounts = localDataStore.getAccounts();
    const postedJournals = localDataStore.getJournals().filter((j) => j.status === 'POSTED' && j.date <= cutoff);
    const withBalances = this.calculateDynamicAccountBalances(accounts, postedJournals);

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

    withBalances.forEach((acc) => {
      const hasChildren = withBalances.some((child) => child.parentId === acc.id);
      if (hasChildren && acc.level < 4) return;

      const val = acc.balance || 0;
      if (val === 0) return;

      if (acc.category === 'ASSET' || acc.code.startsWith('1')) {
        if (acc.code.startsWith('11')) {
          currentAssetsItems.push({ accountCode: acc.code, accountNameAr: acc.nameAr, amount: val });
          totalCurrentAssets += val;
        } else {
          nonCurrentAssetsItems.push({ accountCode: acc.code, accountNameAr: acc.nameAr, amount: val });
          totalNonCurrentAssets += val;
        }
      } else if (acc.category === 'LIABILITY' || acc.code.startsWith('2')) {
        if (acc.code.startsWith('21')) {
          currentLiabilitiesItems.push({ accountCode: acc.code, accountNameAr: acc.nameAr, amount: val });
          totalCurrentLiabilities += val;
        } else {
          nonCurrentLiabilitiesItems.push({ accountCode: acc.code, accountNameAr: acc.nameAr, amount: val });
          totalNonCurrentLiabilities += val;
        }
      } else if (acc.category === 'EQUITY' || acc.code.startsWith('3')) {
        equityItems.push({ accountCode: acc.code, accountNameAr: acc.nameAr, amount: val });
        totalEquityBase += val;
      }
    });

    const totalAssets = totalCurrentAssets + totalNonCurrentAssets;
    const totalLiabilities = totalCurrentLiabilities + totalNonCurrentLiabilities;
    const totalEquity = totalEquityBase + periodNetIncome;
    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

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
        categoryNameAr: 'الالتزامات المتداولة',
        items: currentLiabilitiesItems,
        totalAmount: totalCurrentLiabilities,
      },
      nonCurrentLiabilities: {
        categoryNameAr: 'الالتزامات غير المتداولة',
        items: nonCurrentLiabilitiesItems,
        totalAmount: totalNonCurrentLiabilities,
      },
      totalLiabilities,
      equity: {
        categoryNameAr: 'حقوق الملكية',
        items: [
          ...equityItems,
          ...(periodNetIncome !== 0
            ? [{ accountCode: 'NET-INC', accountNameAr: 'صافي أرباح/خسائر الفترة الحالية', amount: periodNetIncome }]
            : []),
        ],
        totalAmount: totalEquity,
      },
      periodNetIncome,
      totalEquity,
      totalLiabilitiesAndEquity,
      isBalanced: Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01,
    };
  }

  public static async getCashFlow(startDate: string, endDate: string): Promise<CashFlowReport> {
    const start = startDate || '2026-01-01';
    const end = endDate || new Date().toISOString().split('T')[0];

    const income = await this.getPnL(start, end);
    const accounts = localDataStore.getAccounts();
    const postedJournals = localDataStore.getJournals().filter((j) => j.status === 'POSTED' && j.date <= end);
    const withBalances = this.calculateDynamicAccountBalances(accounts, postedJournals);

    const resolved = this.getResolvedAccounts();
    const cashAccount = withBalances.find((a) => a.id === resolved.bank.id || a.code === resolved.bank.code);
    const cashBoxAccount = withBalances.find((a) => a.id === resolved.cash.id || a.code === resolved.cash.code);
    const closingCash = (cashAccount?.balance || 0) + (cashBoxAccount?.balance || 0);

    const netIncome = income.netIncome;
    const totalOperating = netIncome;
    const totalInvesting = 0;
    const totalFinancing = 0;

    return {
      startDate: start,
      endDate: end,
      operatingCashFlow: {
        netIncome,
        adjustments: [],
        totalOperating,
      },
      investingCashFlow: {
        items: [],
        totalInvesting: 0,
      },
      financingCashFlow: {
        items: [],
        totalFinancing: 0,
      },
      netCashChange: totalOperating + totalInvesting + totalFinancing,
      openingCash: closingCash - netIncome,
      closingCash,
    };
  }

  public static async getStatement(customerId: string): Promise<any> {
    const customer = localDataStore.getCustomers().find((c) => c.id === customerId);
    const invoices = localDataStore.getInvoices().filter((i) => i.entityId === customerId && i.status !== 'CANCELLED');
    const vouchers = localDataStore.getVouchers().filter((v) => v.entityId === customerId);

    return {
      customer: customer || { nameAr: 'عميل' },
      transactions: [
        ...invoices.map((inv) => ({
          date: inv.date,
          type: 'INVOICE',
          reference: inv.invoiceNumber,
          description: `فاتورة مبيعات رقم ${inv.invoiceNumber}`,
          debit: inv.grandTotal,
          credit: 0,
          balance: inv.dueAmount,
        })),
        ...vouchers.map((v) => ({
          date: v.date,
          type: 'PAYMENT',
          reference: v.voucherNumber,
          description: `سند قبض نقدي/بنكي رقم ${v.voucherNumber}`,
          debit: 0,
          credit: v.amount,
          balance: 0,
        })),
      ],
      closingBalance: customer?.balance || 0,
    };
  }

  public static async resetDatabase(): Promise<void> {
    localDataStore.resetToDefaults();
    await safeApiFetch('/api/seed/reset', { method: 'POST' });
  }

  public static async syncSystemIntegrity(): Promise<any> {
    const compId = localDataStore.getEffectiveCompanyId();
    // 1. If restore lock is active, completely bypass remote overwrites to safeguard restored JSON data
    if (localDataStore.isRestoreLocked(compId || undefined)) {
      return { success: true, message: 'Restore lock active, local state strictly preserved', source: 'restore_lock' };
    }

    if (isSupabaseConfigured) {
      try {
        const [customers, suppliers, inventory, journals, invoices, vouchers] = await Promise.all([
          SupabaseDataService.getCustomers(),
          SupabaseDataService.getSuppliers(),
          SupabaseDataService.getItems(),
          SupabaseDataService.getJournals(),
          SupabaseDataService.getInvoices(),
          SupabaseDataService.getVouchers(),
        ]);
        const localCust = localDataStore.getCustomers();
        const localSupp = localDataStore.getSuppliers();
        const localInv = localDataStore.getInventory();
        const localJournals = localDataStore.getJournals();
        const localInvoices = localDataStore.getInvoices();
        const localVouchers = localDataStore.getVouchers();
        const isLocked = localDataStore.isRestoreLocked();

        if (Array.isArray(customers) && customers.length > 0) {
          localDataStore.saveCustomers(customers);
        } else if (localCust.length > 0) {
          Promise.all(localCust.map((c) => SupabaseDataService.saveCustomer(c))).catch(() => {});
        }

        if (Array.isArray(suppliers) && suppliers.length > 0) {
          localDataStore.saveSuppliers(suppliers);
        } else if (localSupp.length > 0) {
          Promise.all(localSupp.map((s) => SupabaseDataService.saveSupplier(s))).catch(() => {});
        }

        if (Array.isArray(inventory) && inventory.length > 0) {
          localDataStore.saveInventory(inventory);
        } else if (localInv.length > 0) {
          Promise.all(localInv.map((it) => SupabaseDataService.saveItem(it))).catch(() => {});
        }

        if (Array.isArray(journals) && journals.length > 0) {
          localDataStore.saveJournals(journals);
        } else if (localJournals.length > 0) {
          Promise.all(localJournals.map((j) => SupabaseDataService.saveJournal(j))).catch(() => {});
        }

        // Invoices cloud sync
        if (Array.isArray(invoices) && invoices.length > 0) {
          if (localInvoices.length > 0 && (isLocked || invoices.length < localInvoices.length)) {
            SupabaseDataService.saveInvoices(localInvoices).catch(() => {});
          } else {
            localDataStore.saveInvoices(invoices);
          }
        } else if (localInvoices.length > 0) {
          SupabaseDataService.saveInvoices(localInvoices).catch(() => {});
        }

        // Vouchers cloud sync
        if (Array.isArray(vouchers) && vouchers.length > 0) {
          if (localVouchers.length > 0 && (isLocked || vouchers.length < localVouchers.length)) {
            SupabaseDataService.saveVouchers(localVouchers).catch(() => {});
          } else {
            localDataStore.saveVouchers(vouchers);
          }
        } else if (localVouchers.length > 0) {
          SupabaseDataService.saveVouchers(localVouchers).catch(() => {});
        }

        let accounts = await SupabaseDataService.getAccounts();
        if (!accounts || accounts.length === 0) {
          accounts = localDataStore.getAccounts();
        }
        if (Array.isArray(accounts) && accounts.length > 0) {
          const withBal = this.calculateDynamicAccountBalances(
            accounts,
            Array.isArray(journals) && journals.length > 0 ? journals : localJournals
          );
          localDataStore.saveAccounts(withBal);
        }
        return { success: true, source: 'supabase' };
      } catch (err) {
        console.warn('Sync integrity Supabase warning:', err);
      }
    }

    // Secondary fallback to local API only if restore is NOT locked and local has no data to protect
    const localCust = localDataStore.getCustomers();
    const localSupp = localDataStore.getSuppliers();
    const localInv = localDataStore.getInventory();
    if (localCust.length === 0 && localSupp.length === 0 && localInv.length === 0) {
      const apiRes = await safeApiFetch<any>('/api/system/integrity-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const [customers, suppliers, inventory, accounts] = await Promise.all([
        safeApiFetch<Customer[]>('/api/customers'),
        safeApiFetch<Supplier[]>('/api/suppliers'),
        safeApiFetch<InventoryItem[]>('/api/inventory'),
        safeApiFetch<Account[]>('/api/chart-of-accounts'),
      ]);
      if (customers && customers.length > 0) localDataStore.saveCustomers(customers);
      if (suppliers && suppliers.length > 0) localDataStore.saveSuppliers(suppliers);
      if (inventory && inventory.length > 0) localDataStore.saveInventory(inventory);
      if (accounts && accounts.length > 0) localDataStore.saveAccounts(accounts);
      return apiRes;
    }

    return { success: true, message: 'Local data retained safely' };
  }

  // ==========================================
  // QUOTATIONS & PROPOSALS API
  // ==========================================
  public static async getQuotations(): Promise<Quotation[]> {
    return localDataStore.getQuotations();
  }

  public static async saveQuotation(quotation: Quotation): Promise<Quotation> {
    const list = localDataStore.getQuotations();
    const idx = list.findIndex((q) => q.id === quotation.id);
    if (idx !== -1) {
      list[idx] = quotation;
    } else {
      list.unshift(quotation);
    }
    localDataStore.saveQuotations(list);
    return quotation;
  }

  public static async deleteQuotation(id: string): Promise<boolean> {
    const list = localDataStore.getQuotations();
    const filtered = list.filter((q) => q.id !== id);
    localDataStore.saveQuotations(filtered);
    return true;
  }

  public static async convertQuotationToInvoice(
    quotationId: string,
    paymentTerms: 'CASH' | 'CREDIT' = 'CASH'
  ): Promise<{ quotation: Quotation; invoice: Invoice }> {
    const list = localDataStore.getQuotations();
    const q = list.find((x) => x.id === quotationId);
    if (!q) throw new Error('عرض السعر غير موجود');

    const invData = {
      type: 'SALES',
      status: 'POSTED',
      paymentTerms,
      entityId: q.customerId,
      entityNameAr: q.customerNameAr,
      salesPerson: q.salesRepName,
      salesRepId: q.salesRepId,
      salesRepName: q.salesRepName,
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date().toISOString().split('T')[0],
      lines: q.lines.map((l) => ({
        itemId: l.itemId,
        itemSku: l.itemSku,
        itemNameAr: l.itemNameAr,
        unit: l.unit,
        unitsPerPack: l.unitsPerPack || 1,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discountType: l.discountType || 'FIXED',
        discountValue: l.discountValue || 0,
        notes: l.notes || '',
      })),
      notes: `محولة بضغطة زر تلقائياً من عرض السعر رقم (${q.quotationNumber})`,
    };

    const createdInvoice = await this.createInvoice(invData);

    q.status = 'CONVERTED_INVOICE';
    q.convertedInvoiceId = createdInvoice.id;
    q.convertedInvoiceNumber = createdInvoice.invoiceNumber;
    localDataStore.saveQuotations(list);

    return { quotation: q, invoice: createdInvoice };
  }

  public static async convertQuotationToProductionOrder(
    quotationId: string
  ): Promise<{ quotation: Quotation; productionOrder: ProductionOrder }> {
    const list = localDataStore.getQuotations();
    const q = list.find((x) => x.id === quotationId);
    if (!q) throw new Error('عرض السعر غير موجود');

    const firstItem = q.lines[0];
    const targetItemId = firstItem?.itemId || 'inv-102';
    const targetItemNameAr = firstItem?.itemNameAr || 'منتج عرض السعر';
    const targetSku = firstItem?.itemSku || 'SKU-QUO-001';
    const targetQuantity = firstItem?.quantity || 100;
    const targetUnit = firstItem?.unit || 'حبة';

    const rawMaterials = q.lines.map((l) => ({
      itemId: l.itemId,
      itemSku: l.itemSku,
      itemNameAr: l.itemNameAr,
      unit: l.unit,
      quantityRequired: l.quantity,
      unitCost: l.unitPrice,
      totalCost: l.subtotal,
    }));

    const totalCost = rawMaterials.reduce((s, r) => s + r.totalCost, 0);

    const prdData = {
      targetItemId,
      targetItemNameAr,
      targetSku,
      targetQuantity,
      targetUnit,
      rawMaterials,
      overheadCost: 0,
      totalProductionCost: totalCost,
      unitProductionCost: targetQuantity > 0 ? totalCost / targetQuantity : 0,
      status: 'PLANNED' as ProductionOrderStatus,
      notes: `أمر تصنيع ناتج عن تحويل عرض السعر رقم (${q.quotationNumber}) للعميل: ${q.customerNameAr}`,
    };

    const createdOrder = await this.createProductionOrder(prdData);

    q.status = 'CONVERTED_PRODUCTION';
    q.convertedProductionOrderId = createdOrder.id;
    q.convertedProductionOrderNumber = createdOrder.orderNumber;
    localDataStore.saveQuotations(list);

    return { quotation: q, productionOrder: createdOrder };
  }

  // ==========================================
  // SALES REPS API
  // ==========================================
  public static async getSalesReps(): Promise<SalesRep[]> {
    return localDataStore.getSalesReps();
  }

  public static async saveSalesRep(rep: SalesRep): Promise<SalesRep> {
    const list = localDataStore.getSalesReps();
    const idx = list.findIndex((r) => r.id === rep.id);
    if (idx !== -1) {
      list[idx] = rep;
    } else {
      list.unshift(rep);
    }
    localDataStore.saveSalesReps(list);
    return rep;
  }

  public static async deleteSalesRep(id: string): Promise<boolean> {
    const list = localDataStore.getSalesReps();
    const filtered = list.filter((r) => r.id !== id);
    localDataStore.saveSalesReps(filtered);
    return true;
  }
}
