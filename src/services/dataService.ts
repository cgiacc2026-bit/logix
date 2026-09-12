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
  RepCustodyRecord,
  VanStockItemMovement,
  Warehouse,
  ItemWarehouseStock,
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
  INITIAL_WAREHOUSES,
} from '../server/defaultData.js';
import { safeJsonParse, safeApiFetch } from '../utils/safeJson.js';
import { SupabaseDataService } from './supabaseService.js';
import { isSupabaseConfigured, resolveToSupabaseCompanyUUID, toValidUUID, generateUUID } from './supabaseClient.js';
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
import { getAccountStatement } from './statementService.ts';
import { IAS2CostingEngine } from './costingEngine.ts';
import { aggregateChartOfAccountsTree, isAccountLeaf } from '../utils/accountingTreeEngine.ts';

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
  REP_CUSTODY: 'alwaleed_erp_rep_custody',
  REP_VAN_STOCK: 'alwaleed_erp_rep_van_stock',
  WAREHOUSES: 'alwaleed_erp_warehouses',
  WAREHOUSE_STOCKS: 'alwaleed_erp_warehouse_stocks',
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
    nameAr: 'مندوب عام',
    nameEn: 'General Sales Representative',
    phone: '+965 9911 2233',
    email: 'sales@logix-erp.com',
    commissionRate: 2.5,
    targetAmount: 50000,
    isActive: true,
    notes: 'مندوب عام لكافة الجمعيات والمبيعات العامة',
  },
  {
    id: 'rep-002',
    code: 'REP-02',
    nameAr: 'أحمد بن عبد العزيز الكندري',
    nameEn: 'Ahmed Al-Kandari',
    phone: '+965 9944 5566',
    email: 'ahmed.k@logix-erp.com',
    commissionRate: 3.0,
    targetAmount: 35000,
    isActive: true,
    notes: 'مندوب كبار العملاء والجمعيات التعاونية',
  },
  {
    id: 'rep-003',
    code: 'REP-03',
    nameAr: 'محمد بن طارق الفضلي',
    nameEn: 'Mohammed Al-Fadhli',
    phone: '+965 9977 8899',
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

  public clearMemoryCache(): void { this.memoryFallback = {}; }

  public getEffectiveCompanyId(): string {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('supabase_company_id');
      if (saved && saved.trim() && saved.trim() !== 'default') {
        const res = resolveToSupabaseCompanyUUID(saved.trim());
        if (res) return res;
      }
      const active = window.localStorage.getItem('activeCompanyId');
      if (active && active.trim() && active.trim() !== 'default') {
        const res = resolveToSupabaseCompanyUUID(active.trim());
        if (res) return res;
      }
    }
    return '';
  }

  public isAlWaleedActive(): boolean {
    const compId = this.getEffectiveCompanyId();
    if (!compId) return false;
    return (
      compId === '20000000-0000-0000-0000-000000000001' ||
      compId === 'company-alwaleed-client-003'
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
        const item = window.localStorage.getItem(key);
        if (item) return safeJsonParse<T>(item, defaultVal);
      }
    } catch (e) {
      console.warn('LocalStorage get error, using memory fallback:', e);
    }
    const memItem = this.memoryFallback[key];
    return memItem ? safeJsonParse<T>(memItem, defaultVal) : defaultVal;
  }

  public setLocal<T>(key: string, value: T): void {
    // [ARCHITECT] Strict Bypass: Do not write financial data to LocalStorage if cloud is configured.
    if (isSupabaseConfigured && (
      key.includes(STORAGE_KEYS.INVOICES) || 
      key.includes(STORAGE_KEYS.VOUCHERS) || 
      key.includes(STORAGE_KEYS.JOURNALS) || 
      key.includes(STORAGE_KEYS.INVENTORY) ||
      key.includes(STORAGE_KEYS.CUSTOMERS) ||
      key.includes(STORAGE_KEYS.SUPPLIERS) ||
      key.includes(STORAGE_KEYS.ACCOUNTS) ||
      key.includes(STORAGE_KEYS.PRODUCTION_ORDERS)
    )) {
      return; // Absolute eradication of local writing for transactional data
    }
    
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

  /**
   * Check if tenant is initialized (prevents unwanted mock data re-seeding)
   */
  public isTenantInitialized(specificCompanyId?: string): boolean {
    const rawId = specificCompanyId || this.getEffectiveCompanyId() || 'default';
    const canonId = resolveToSupabaseCompanyUUID(rawId) || rawId;
    const initKey = `logix_tenant_init_${canonId}`;
    const altKey = `logix_tenant_init_${rawId}`;

    if (typeof window !== 'undefined' && window.localStorage) {
      if (
        window.localStorage.getItem(initKey) === 'true' ||
        window.localStorage.getItem(altKey) === 'true' ||
        window.localStorage.getItem('logix_system_initialized') === 'true'
      ) {
        return true;
      }
      // Check if any entity key has been saved for this tenant (even as empty array)
      const keysToCheck = [
        this.getKey(STORAGE_KEYS.ACCOUNTS, specificCompanyId),
        this.getKey(STORAGE_KEYS.JOURNALS, specificCompanyId),
        this.getKey(STORAGE_KEYS.CUSTOMERS, specificCompanyId),
        this.getKey(STORAGE_KEYS.INVOICES, specificCompanyId),
      ];
      for (const k of keysToCheck) {
        if (window.localStorage.getItem(k) !== null) {
          window.localStorage.setItem(initKey, 'true');
          return true;
        }
      }
    }
    return !!(this.memoryFallback[initKey] || this.memoryFallback[altKey]);
  }

  /**
   * Mark tenant as initialized
   */
  public markTenantInitialized(specificCompanyId?: string): void {
    const rawId = specificCompanyId || this.getEffectiveCompanyId() || 'default';
    const canonId = resolveToSupabaseCompanyUUID(rawId) || rawId;
    const initKey = `logix_tenant_init_${canonId}`;
    const altKey = `logix_tenant_init_${rawId}`;
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(initKey, 'true');
      window.localStorage.setItem(altKey, 'true');
      window.localStorage.setItem('logix_system_initialized', 'true');
    }
    this.memoryFallback[initKey] = 'true';
    this.memoryFallback[altKey] = 'true';
  }

  /**
   * Tombstones: Track records explicitly deleted by user to prevent resurrection
   */
  public getTombstones(type: string, specificCompanyId?: string): Set<string> {
    const rawId = specificCompanyId || this.getEffectiveCompanyId() || 'default';
    const canonId = resolveToSupabaseCompanyUUID(rawId) || rawId;
    const key = `logix_tombstones_${type}_${canonId}`;
    const altKey = `logix_tombstones_${type}_${rawId}`;
    let raw: string | null = null;
    if (typeof window !== 'undefined' && window.localStorage) {
      raw = window.localStorage.getItem(key) || window.localStorage.getItem(altKey);
    } else {
      raw = this.memoryFallback[key] || this.memoryFallback[altKey] || null;
    }
    const result = new Set<string>();
    if (type === 'journals') {
      result.add('jv-2026-0001');
      result.add('jv-2026-0002');
      result.add('jv-2026-0003');
      result.add('jv-2026-0004');
    }
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((id) => result.add(id));
        }
      } catch {}
    }
    return result;
  }

  public addTombstone(type: string, id: string, specificCompanyId?: string): void {
    if (!id) return;
    const rawId = specificCompanyId || this.getEffectiveCompanyId() || 'default';
    const canonId = resolveToSupabaseCompanyUUID(rawId) || rawId;
    const key = `logix_tombstones_${type}_${canonId}`;
    const altKey = `logix_tombstones_${type}_${rawId}`;
    const set = this.getTombstones(type, specificCompanyId);
    set.add(id);
    const serialized = JSON.stringify(Array.from(set));
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, serialized);
      window.localStorage.setItem(altKey, serialized);
    }
    this.memoryFallback[key] = serialized;
    this.memoryFallback[altKey] = serialized;
  }

  public removeTombstone(type: string, id: string, specificCompanyId?: string): void {
    if (!id) return;
    const rawId = specificCompanyId || this.getEffectiveCompanyId() || 'default';
    const canonId = resolveToSupabaseCompanyUUID(rawId) || rawId;
    const key = `logix_tombstones_${type}_${canonId}`;
    const altKey = `logix_tombstones_${type}_${rawId}`;
    const set = this.getTombstones(type, specificCompanyId);
    if (set.has(id)) {
      set.delete(id);
      const serialized = JSON.stringify(Array.from(set));
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, serialized);
        window.localStorage.setItem(altKey, serialized);
      }
      this.memoryFallback[key] = serialized;
      this.memoryFallback[altKey] = serialized;
    }
  }

  public clearTombstones(specificCompanyId?: string): void {
    const rawId = specificCompanyId || this.getEffectiveCompanyId() || 'default';
    const canonId = resolveToSupabaseCompanyUUID(rawId) || rawId;
    const types = ['customers', 'suppliers', 'inventory', 'journals', 'invoices', 'vouchers', 'accounts', 'quotations'];
    for (const type of types) {
      const key = `logix_tombstones_${type}_${canonId}`;
      const altKey = `logix_tombstones_${type}_${rawId}`;
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          window.localStorage.removeItem(key);
          window.localStorage.removeItem(altKey);
        } catch {}
      }
      delete this.memoryFallback[key];
      delete this.memoryFallback[altKey];
    }
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

  public deduplicateAccounts(accounts: Account[]): Account[] {
    if (!Array.isArray(accounts)) return [];
    const map = new Map<string, Account>();
    for (const acc of accounts) {
      if (!acc) continue;
      const key = String(acc.code || acc.id || '').trim();
      if (!key) continue;
      if (!map.has(key)) {
        map.set(key, acc);
      } else {
        const existing = map.get(key)!;
        const bestBal = Math.abs(acc.balance || 0) > Math.abs(existing.balance || 0) ? (acc.balance || 0) : (existing.balance || 0);
        const bestId = existing.id.startsWith('acc-') ? existing.id : (acc.id.startsWith('acc-') ? acc.id : existing.id);
        map.set(key, { ...existing, id: bestId, balance: bestBal });
      }
    }
    return Array.from(map.values()).sort((a, b) => (a.code || '').localeCompare(b.code || ''));
  }

  public getAccounts(): Account[] {
    const list = this.getLocal<Account[] | null>(this.getKey(STORAGE_KEYS.ACCOUNTS), null);
    if (list === null) {
      if (this.isTenantInitialized()) {
        return [];
      }
      if (this.isAlWaleedActive()) {
        const alwaleedAccounts = this.deduplicateAccounts(JSON.parse(JSON.stringify(INITIAL_ACCOUNTS)));
        this.saveAccounts(alwaleedAccounts);
        this.markTenantInitialized();
        return alwaleedAccounts;
      }
      // Default zeroed clean opening chart of accounts for first-time install
      const zeroedAccounts = this.deduplicateAccounts(generateCleanChartOfAccounts(this.getEffectiveCompanyId() || undefined));
      this.saveAccounts(zeroedAccounts);
      this.markTenantInitialized();
      return zeroedAccounts;
    }
    const tombstones = this.getTombstones('accounts');
    const filtered = tombstones.size > 0 ? list.filter((a) => !tombstones.has(a.id)) : list;
    return this.deduplicateAccounts(filtered);
  }
  public saveAccounts(accounts: Account[]): void {
    const deduped = this.deduplicateAccounts(accounts);
    this.setLocal(this.getKey(STORAGE_KEYS.ACCOUNTS), deduped);
    this.markTenantInitialized();
  }

  public getCustomers(): Customer[] {
    const list = this.getLocal<Customer[] | null>(this.getKey(STORAGE_KEYS.CUSTOMERS), null);
    if (list === null) {
      if (this.isTenantInitialized()) {
        return [];
      }
      if (this.isAlWaleedActive()) {
        const alwaleedCustomers = JSON.parse(JSON.stringify(INITIAL_CUSTOMERS));
        this.saveCustomers(alwaleedCustomers);
        this.markTenantInitialized();
        return alwaleedCustomers;
      }
      this.saveCustomers([]);
      this.markTenantInitialized();
      return [];
    }
    const tombstones = this.getTombstones('customers');
    if (tombstones.size > 0) {
      return this.deduplicateCustomers(list.filter((c) => !tombstones.has(c.id)));
    }
    return this.deduplicateCustomers(list);
  }
  public saveCustomers(customers: Customer[]): void {
    const deduped = this.deduplicateCustomers(customers);
    this.setLocal(this.getKey(STORAGE_KEYS.CUSTOMERS), deduped);
    this.markTenantInitialized();
  }

  public getSuppliers(): Supplier[] {
    const list = this.getLocal<Supplier[] | null>(this.getKey(STORAGE_KEYS.SUPPLIERS), null);
    if (list === null) {
      if (this.isTenantInitialized()) {
        return [];
      }
      if (this.isAlWaleedActive()) {
        const alwaleedSuppliers = JSON.parse(JSON.stringify(INITIAL_SUPPLIERS));
        this.saveSuppliers(alwaleedSuppliers);
        this.markTenantInitialized();
        return alwaleedSuppliers;
      }
      this.saveSuppliers([]);
      this.markTenantInitialized();
      return [];
    }
    const tombstones = this.getTombstones('suppliers');
    if (tombstones.size > 0) {
      return this.deduplicateSuppliers(list.filter((s) => !tombstones.has(s.id)));
    }
    return this.deduplicateSuppliers(list);
  }
  public saveSuppliers(suppliers: Supplier[]): void {
    const deduped = this.deduplicateSuppliers(suppliers);
    this.setLocal(this.getKey(STORAGE_KEYS.SUPPLIERS), deduped);
    this.markTenantInitialized();
  }

  public getInventory(): InventoryItem[] {
    const list = this.getLocal<InventoryItem[] | null>(this.getKey(STORAGE_KEYS.INVENTORY), null);
    if (list === null) {
      if (this.isTenantInitialized()) {
        return [];
      }
      if (this.isAlWaleedActive()) {
        const alwaleedInventory = JSON.parse(JSON.stringify(INITIAL_INVENTORY));
        this.saveInventory(alwaleedInventory);
        this.markTenantInitialized();
        return alwaleedInventory;
      }
      this.saveInventory([]);
      return [];
    }
    const tombstones = this.getTombstones('inventory');
    if (tombstones.size > 0) {
      return this.deduplicateInventory(list.filter((item) => !tombstones.has(item.id)));
    }
    return this.deduplicateInventory(list);
  }
  public saveInventory(inv: InventoryItem[]): void {
    const deduped = this.deduplicateInventory(inv);
    this.setLocal(this.getKey(STORAGE_KEYS.INVENTORY), deduped);
    this.markTenantInitialized();
  }

  public deduplicateInventory(items: InventoryItem[]): InventoryItem[] {
    if (!Array.isArray(items) || items.length <= 1) return items || [];
    const seen = new Map<string, InventoryItem>();
    const result: InventoryItem[] = [];

    for (const item of items) {
      if (!item) continue;
      const sku = (item.sku || (item as any).code || '').trim().toUpperCase();
      const barcode = (item.barcode || '').trim();
      const name = (item.nameAr || (item as any).name || '').trim().replace(/\s+/g, ' ');
      const id = (item.id || '').trim();

      const existing = (id ? seen.get(`ID_${id}`) : null) ||
                       (barcode ? seen.get(`BAR_${barcode}`) : null) ||
                       (sku ? seen.get(`SKU_${sku}`) : null) ||
                       (name ? seen.get(`NAME_${name}`) : null);

      if (existing) {
        if ((item.quantityOnHand ?? 0) !== 0 && (existing.quantityOnHand ?? 0) === 0) {
          existing.quantityOnHand = item.quantityOnHand;
        }
        if (item.salePrice && !existing.salePrice) existing.salePrice = item.salePrice;
        if (item.costPrice && !existing.costPrice) existing.costPrice = item.costPrice;
        if (item.barcode && !existing.barcode) existing.barcode = item.barcode;
        if (item.sku && !existing.sku) existing.sku = item.sku;
      } else {
        result.push(item);
        if (id) seen.set(`ID_${id}`, item);
        if (barcode) seen.set(`BAR_${barcode}`, item);
        if (sku) seen.set(`SKU_${sku}`, item);
        if (name) seen.set(`NAME_${name}`, item);
      }
    }
    return result;
  }

  public deduplicateCustomers(customers: Customer[]): Customer[] {
    if (!Array.isArray(customers) || customers.length <= 1) return customers || [];
    const seen = new Map<string, Customer>();
    const result: Customer[] = [];

    for (const c of customers) {
      if (!c) continue;
      const name = (c.nameAr || (c as any).name || '').trim().replace(/\s+/g, ' ');
      const phone = (c.phone || '').trim();
      const id = (c.id || '').trim();

      const existing = (id ? seen.get(`ID_${id}`) : null) ||
                       (name ? seen.get(`NAME_${name}`) : null) ||
                       (phone && phone.length > 5 ? seen.get(`PHONE_${phone}`) : null);

      if (existing) {
        if (c.currentBalance && !existing.currentBalance) existing.currentBalance = c.currentBalance;
        if (c.phone && !existing.phone) existing.phone = c.phone;
        if (c.address && !existing.address) existing.address = c.address;
        if (c.taxNumber && !existing.taxNumber) existing.taxNumber = c.taxNumber;
      } else {
        result.push(c);
        if (id) seen.set(`ID_${id}`, c);
        if (name) seen.set(`NAME_${name}`, c);
        if (phone && phone.length > 5) seen.set(`PHONE_${phone}`, c);
      }
    }
    return result;
  }

  public deduplicateSuppliers(suppliers: Supplier[]): Supplier[] {
    if (!Array.isArray(suppliers) || suppliers.length <= 1) return suppliers || [];
    const seen = new Map<string, Supplier>();
    const result: Supplier[] = [];

    for (const s of suppliers) {
      if (!s) continue;
      const name = (s.nameAr || (s as any).name || '').trim().replace(/\s+/g, ' ');
      const id = (s.id || '').trim();

      const existing = (id ? seen.get(`ID_${id}`) : null) || (name ? seen.get(`NAME_${name}`) : null);
      if (existing) {
        if (s.phone && !existing.phone) existing.phone = s.phone;
        if (s.address && !existing.address) existing.address = s.address;
      } else {
        result.push(s);
        if (id) seen.set(`ID_${id}`, s);
        if (name) seen.set(`NAME_${name}`, s);
      }
    }
    return result;
  }

  public deduplicateJournals(journals: JournalEntry[]): JournalEntry[] {
    if (!Array.isArray(journals) || journals.length <= 1) return journals || [];
    const seen = new Map<string, JournalEntry>();
    const result: JournalEntry[] = [];

    for (const j of journals) {
      if (!j) continue;
      const num = (j.entryNumber || '').trim().toUpperCase();
      const ref = (j.reference || '').trim().toUpperCase();
      const srcKey = j.sourceModule && j.sourceId ? `${j.sourceModule}_${j.sourceId}` : '';
      const key = num || (ref ? `REF_${ref}` : (srcKey || j.id));

      const existing = seen.get(key) || (ref ? seen.get(`REF_${ref}`) : null) || (srcKey ? seen.get(srcKey) : null);
      if (existing) {
        const existingTime = new Date(existing.postedAt || existing.createdAt || 0).getTime();
        const currentTime = new Date(j.postedAt || j.createdAt || 0).getTime();
        if (currentTime >= existingTime) {
          const idx = result.indexOf(existing);
          if (idx !== -1) {
            result[idx] = j;
          }
          seen.set(key, j);
          if (ref) seen.set(`REF_${ref}`, j);
          if (srcKey) seen.set(srcKey, j);
        }
      } else {
        result.push(j);
        seen.set(key, j);
        if (ref) seen.set(`REF_${ref}`, j);
        if (srcKey) seen.set(srcKey, j);
      }
    }
    return result;
  }

  public deduplicateInvoices(invoices: Invoice[]): Invoice[] {
    if (!Array.isArray(invoices) || invoices.length <= 1) return invoices || [];
    const seenNumbers = new Map<string, Invoice>();
    const seenIds = new Map<string, Invoice>();
    const result: Invoice[] = [];

    for (const inv of invoices) {
      if (!inv) continue;
      const num = (inv.invoiceNumber || '').trim().toUpperCase();
      const id = (inv.id || '').trim();

      const existing = (num ? seenNumbers.get(num) : null) || (id ? seenIds.get(id) : null);
      if (existing) {
        const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
        const currentTime = new Date(inv.updatedAt || inv.createdAt || 0).getTime();
        const currentHasLines = Array.isArray(inv.lines) && inv.lines.length > 0;
        const existingHasLines = Array.isArray(existing.lines) && existing.lines.length > 0;

        // Keep the more recently updated, or the one with lines if the other is empty
        if (currentTime >= existingTime || (currentHasLines && !existingHasLines)) {
          const idx = result.indexOf(existing);
          if (idx !== -1) {
            result[idx] = inv;
          }
          if (num) seenNumbers.set(num, inv);
          if (id) seenIds.set(id, inv);
          if (existing.invoiceNumber) seenNumbers.set(existing.invoiceNumber.trim().toUpperCase(), inv);
          if (existing.id) seenIds.set(existing.id.trim(), inv);
        }
      } else {
        result.push(inv);
        if (num) seenNumbers.set(num, inv);
        if (id) seenIds.set(id, inv);
      }
    }
    return result;
  }

  public deduplicateVouchers(vouchers: PaymentVoucher[]): PaymentVoucher[] {
    if (!Array.isArray(vouchers) || vouchers.length <= 1) return vouchers || [];
    const seenNumbers = new Map<string, PaymentVoucher>();
    const seenIds = new Map<string, PaymentVoucher>();
    const result: PaymentVoucher[] = [];

    for (const v of vouchers) {
      if (!v) continue;
      const num = (v.voucherNumber || '').trim().toUpperCase();
      const id = (v.id || '').trim();

      const existing = (num ? seenNumbers.get(num) : null) || (id ? seenIds.get(id) : null);
      if (existing) {
        const existingTime = new Date((existing as any).updatedAt || existing.createdAt || 0).getTime();
        const currentTime = new Date((v as any).updatedAt || v.createdAt || 0).getTime();
        if (currentTime >= existingTime) {
          const idx = result.indexOf(existing);
          if (idx !== -1) {
            result[idx] = v;
          }
          if (num) seenNumbers.set(num, v);
          if (id) seenIds.set(id, v);
          if (existing.voucherNumber) seenNumbers.set(existing.voucherNumber.trim().toUpperCase(), v);
          if (existing.id) seenIds.set(existing.id.trim(), v);
        }
      } else {
        result.push(v);
        if (num) seenNumbers.set(num, v);
        if (id) seenIds.set(id, v);
      }
    }
    return result;
  }

  public getJournals(): JournalEntry[] {
    const list = this.getLocal<JournalEntry[] | null>(this.getKey(STORAGE_KEYS.JOURNALS), null);
    const tombstones = this.getTombstones('journals');
    if (list === null) {
      if (this.isTenantInitialized()) {
        return [];
      }
      if (this.isAlWaleedActive()) {
        const alwaleedJournals = JSON.parse(JSON.stringify(INITIAL_JOURNALS)).filter((j: any) => !tombstones.has(j.id));
        this.saveJournals(alwaleedJournals);
        this.markTenantInitialized();
        return this.deduplicateJournals(alwaleedJournals);
      }
      this.saveJournals([]);
      return [];
    }
    if (tombstones.size > 0) {
      const filtered = list.filter((j) => !tombstones.has(j.id));
      const deduped = this.deduplicateJournals(filtered);
      if (filtered.length !== list.length || deduped.length !== filtered.length) {
        this.saveJournals(deduped);
      }
      return deduped;
    }
    return this.deduplicateJournals(list);
  }
  public saveJournals(j: JournalEntry[]): void {
    const deduped = this.deduplicateJournals(j);
    this.setLocal(this.getKey(STORAGE_KEYS.JOURNALS), deduped);
    this.markTenantInitialized();
  }

  public getInvoices(): Invoice[] {
    const list = this.getLocal<Invoice[] | null>(this.getKey(STORAGE_KEYS.INVOICES), null);
    if (list === null) {
      if (this.isTenantInitialized()) {
        return [];
      }
      if (this.isAlWaleedActive()) {
        const alwaleedInvoices = JSON.parse(JSON.stringify(INITIAL_INVOICES));
        this.saveInvoices(alwaleedInvoices);
        this.markTenantInitialized();
        return this.deduplicateInvoices(alwaleedInvoices);
      }
      this.saveInvoices([]);
      return [];
    }
    const tombstones = this.getTombstones('invoices');
    let filtered = list;
    if (tombstones.size > 0) {
      filtered = list.filter((inv) => !tombstones.has(inv.id));
    }
    return this.deduplicateInvoices(filtered);
  }
  public saveInvoices(inv: Invoice[]): void {
    const deduped = this.deduplicateInvoices(inv);
    this.setLocal(this.getKey(STORAGE_KEYS.INVOICES), deduped);
    this.markTenantInitialized();
  }

  public getVouchers(): PaymentVoucher[] {
    const list = this.getLocal<PaymentVoucher[] | null>(this.getKey(STORAGE_KEYS.VOUCHERS), null);
    if (!list) {
      return [];
    }
    const tombstones = this.getTombstones('vouchers');
    let filtered = list;
    if (tombstones.size > 0) {
      filtered = list.filter((v) => !tombstones.has(v.id));
    }
    return this.deduplicateVouchers(filtered);
  }
  public saveVouchers(v: PaymentVoucher[]): void {
    const deduped = this.deduplicateVouchers(v);
    this.setLocal(this.getKey(STORAGE_KEYS.VOUCHERS), deduped);
    this.markTenantInitialized();
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
    this.markTenantInitialized();
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
    if (list === null) {
      if (this.isTenantInitialized()) {
        return [];
      }
      if (this.isAlWaleedActive() || isDemoActive()) {
        this.saveQuotations(INITIAL_QUOTATIONS);
        this.markTenantInitialized();
        return INITIAL_QUOTATIONS;
      }
      this.saveQuotations([]);
      return [];
    }
    return list;
  }
  public saveQuotations(quotations: Quotation[]): void {
    this.setLocal(this.getKey(STORAGE_KEYS.QUOTATIONS), quotations);
    this.markTenantInitialized();
  }

  public getSalesReps(): SalesRep[] {
    const list = this.getLocal<SalesRep[] | null>(this.getKey(STORAGE_KEYS.SALES_REPS), null);
    if (!list || list.length === 0) {
      this.saveSalesReps(INITIAL_SALES_REPS);
      return INITIAL_SALES_REPS;
    }
    // Ensure "مندوب عام" is always available
    const hasGeneralRep = list.some((r) => r.nameAr?.includes('مندوب عام') || r.code === 'REP-01');
    if (!hasGeneralRep && INITIAL_SALES_REPS[0]) {
      const merged = [INITIAL_SALES_REPS[0], ...list];
      this.saveSalesReps(merged);
      return merged;
    }
    return list;
  }
  public saveSalesReps(reps: SalesRep[]): void {
    this.setLocal(this.getKey(STORAGE_KEYS.SALES_REPS), reps);
    this.markTenantInitialized();
  }

  public getRepCustodyRecords(): RepCustodyRecord[] {
    return this.getLocal<RepCustodyRecord[]>(this.getKey(STORAGE_KEYS.REP_CUSTODY), []);
  }

  public saveRepCustodyRecords(records: RepCustodyRecord[]): void {
    this.setLocal(this.getKey(STORAGE_KEYS.REP_CUSTODY), records);
  }

  public getVanStockMovements(): VanStockItemMovement[] {
    return this.getLocal<VanStockItemMovement[]>(this.getKey(STORAGE_KEYS.REP_VAN_STOCK), []);
  }

  public saveVanStockMovements(records: VanStockItemMovement[]): void {
    this.setLocal(this.getKey(STORAGE_KEYS.REP_VAN_STOCK), records);
  }

  public getWarehouses(): Warehouse[] {
    const list = this.getLocal<Warehouse[] | null>(this.getKey(STORAGE_KEYS.WAREHOUSES), null);
    if (!list || list.length === 0) {
      this.saveWarehouses(INITIAL_WAREHOUSES);
      return INITIAL_WAREHOUSES;
    }
    // Ensure "مخزن رئيسي" is always available and set as default
    const hasMainWh = list.some((w) => w.isDefault || w.code === 'WH-MAIN-01' || w.nameAr?.includes('مخزن رئيسي'));
    if (!hasMainWh && INITIAL_WAREHOUSES[0]) {
      const merged = [INITIAL_WAREHOUSES[0], ...list];
      this.saveWarehouses(merged);
      return merged;
    }
    return list;
  }

  public saveWarehouses(warehouses: Warehouse[]): void {
    this.setLocal(this.getKey(STORAGE_KEYS.WAREHOUSES), warehouses);
    this.markTenantInitialized();
  }

  public getWarehouseStocks(): ItemWarehouseStock[] {
    return this.getLocal<ItemWarehouseStock[]>(this.getKey(STORAGE_KEYS.WAREHOUSE_STOCKS), []);
  }

  public saveWarehouseStocks(stocks: ItemWarehouseStock[]): void {
    this.setLocal(this.getKey(STORAGE_KEYS.WAREHOUSE_STOCKS), stocks);
  }

  public resetToDefaults(): void {
    const cleanAccounts = this.deduplicateAccounts(INITIAL_ACCOUNTS.map((a) => ({ ...a, balance: 0 })));
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
    this.setLocal(this.getKey(STORAGE_KEYS.WAREHOUSES), INITIAL_WAREHOUSES);
    this.setLocal(this.getKey(STORAGE_KEYS.SALES_REPS), INITIAL_SALES_REPS);
    this.markTenantInitialized();
  }
}

export const localDataStore = new LocalDataStore();

// Legacy Cloud Sync Helper no-ops (Supabase handles cloud persistence directly)
/**
 * Centralized Cloud Sync Error Notification
 * Logs error and dispatches system notification for full transparency
 */
export function notifyCloudSyncError(operation: string, err: any): void {
  console.warn('[DataService CloudSync Notice - ' + operation + ']:', err?.message || err);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('logix_system_notice', {
        detail: {
          type: 'warning',
          message: 'تنبيه مزامنة سحابية (' + operation + '): ' + (err?.message || 'تعذر استكمال المزامنة الفورية مع السحابة'),
        },
      })
    );
  }
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
    const invoices = isSupabaseConfigured ? await this.getInvoices() : localDataStore.getInvoices();
    const inventory = isSupabaseConfigured ? await this.getInventory() : localDataStore.getInventory();

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
    const result = aggregateChartOfAccountsTree(accounts, journals);
    return result.accounts;
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
    const tombstones = localDataStore.getTombstones('accounts');
    const localAccounts = localDataStore.getAccounts().filter((a) => !tombstones.has(a.id));
    const isLocked = localDataStore.isRestoreLocked();

    if (isSupabaseConfigured) {
      try {
        const fromSupabase = await SupabaseDataService.getAccounts();
        if (Array.isArray(fromSupabase) && fromSupabase.length > 0) {
          const remoteTombstoned = fromSupabase.filter((a) => tombstones.has(a.id));
          if (remoteTombstoned.length > 0) {
            Promise.all(remoteTombstoned.map((a) => SupabaseDataService.deleteAccount(a.id))).catch((err) => notifyCloudSyncError("CloudSync", err));
          }
          const validRemote = fromSupabase.filter((a) => !tombstones.has(a.id));
          if (localAccounts && localAccounts.length > 0 && isLocked) {
            accounts = localAccounts;
          } else if (validRemote.length > 0) {
            accounts = validRemote;
          }
        }
      } catch (e) {
        console.warn('Supabase getAccounts notice:', e);
      }
    }

    if (!accounts || accounts.length === 0) {
      accounts = localAccounts;
      if ((!accounts || accounts.length === 0) && !localDataStore.isTenantInitialized()) {
        accounts = generateCleanChartOfAccounts(localDataStore.getEffectiveCompanyId() || undefined);
        localDataStore.saveAccounts(accounts);
        if (isSupabaseConfigured) {
          SupabaseDataService.saveAccounts(accounts).catch((err) => notifyCloudSyncError("CloudSync", err));
        }
      }
    }

    const journals = await this.getJournals();
    const withBalances = this.calculateDynamicAccountBalances(accounts || [], journals);
    const deduped = localDataStore.deduplicateAccounts(withBalances);
    localDataStore.saveAccounts(deduped);
    return deduped;
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
    localDataStore.removeTombstone('accounts', newAcc.id);
    accounts.push(newAcc);
    localDataStore.saveAccounts(accounts);
    if (isSupabaseConfigured) {
      SupabaseDataService.saveAccounts(accounts).catch((err) =>
        console.warn('Supabase createAccount notice:', err)
      );
    }
    await safeApiFetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(accData),
    });
    return newAcc;
  }

  public static async updateAccount(id: string, accData: Partial<Account>): Promise<Account | null> {
    localDataStore.removeTombstone('accounts', id);
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
    await safeApiFetch(`/api/accounts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(accData),
    });
    return accounts[idx];
  }

  public static async deleteAccount(id: string): Promise<boolean> {
    localDataStore.addTombstone('accounts', id);
    const accounts = localDataStore.getAccounts();
    const filtered = accounts.filter((a) => a.id !== id);
    localDataStore.saveAccounts(filtered);
    if (isSupabaseConfigured) {
      SupabaseDataService.deleteAccount(id).catch((err) =>
        console.warn('Supabase deleteAccount notice:', err)
      );
    }
    await safeApiFetch(`/api/accounts/${id}`, { method: 'DELETE' });
    return true;
  }

  public static async syncServerTombstones(): Promise<void> {
    try {
      const res = await safeApiFetch<{ tombstones: Record<string, string[]> }>('/api/tombstones');
      if (res && res.tombstones) {
        for (const [type, ids] of Object.entries(res.tombstones)) {
          if (Array.isArray(ids)) {
            for (const id of ids) {
              localDataStore.addTombstone(type, id);
            }
          }
        }
        if (Array.isArray(res.tombstones.journals)) {
          const tombstones = localDataStore.getTombstones('journals');
          const currentJournals = localDataStore.getJournals();
          const cleanJournals = currentJournals.filter((j) => !tombstones.has(j.id));
          if (cleanJournals.length !== currentJournals.length) {
            localDataStore.saveJournals(cleanJournals);
          }
        }
      }
    } catch {}
  }

  // Journals
  public static async getJournals(): Promise<JournalEntry[]> {
    await this.syncServerTombstones();
    const tombstones = localDataStore.getTombstones('journals');
    let localJournals = localDataStore.getJournals().filter((j) => !tombstones.has(j.id));
    const isLocked = localDataStore.isRestoreLocked();

    try {
      const fromServer = await safeApiFetch<JournalEntry[]>('/api/journals');
      if (Array.isArray(fromServer)) {
        const validServer = fromServer.filter((j) => !tombstones.has(j.id));
        const localMap = new Map(localJournals.map((j) => [j.id, j]));
        let hasNew = false;
        for (const sj of validServer) {
          if (!localMap.has(sj.id)) {
            localJournals.push(sj);
            hasNew = true;
          }
        }
        if (hasNew) {
          localDataStore.saveJournals(localJournals);
        }
      }
    } catch {}

    try {
      const fromSupabase = await SupabaseDataService.getJournals();
      if (Array.isArray(fromSupabase)) {
        const remoteTombstoned = fromSupabase.filter((j) => tombstones.has(j.id));
        if (remoteTombstoned.length > 0 && isSupabaseConfigured) {
          Promise.all(remoteTombstoned.map((j) => SupabaseDataService.deleteJournal(j.id))).catch((err) => notifyCloudSyncError("CloudSync", err));
        }
        const validRemote = fromSupabase.filter((j) => !tombstones.has(j.id));

        if (localJournals.length > 0 || localDataStore.isTenantInitialized()) {
          const localMap = new Map(localJournals.map((j) => [j.id, j]));
          let hasNew = false;
          for (const rj of validRemote) {
            if (!localMap.has(rj.id)) {
              localJournals.push(rj);
              hasNew = true;
            }
          }
          if (hasNew) {
            localDataStore.saveJournals(localJournals);
          }
          return localJournals;
        }

        if (validRemote.length > 0) {
          localDataStore.saveJournals(validRemote);
          return validRemote;
        }
      }
    } catch (e) {
      console.warn('Supabase getJournals notice:', e);
    }

    try {
      const vouchers = isSupabaseConfigured ? await this.getVouchers() : localDataStore.getVouchers();
      if (vouchers.length > 0) {
        const jMap = new Set(localJournals.map((j) => j.sourceId || j.id || j.reference));
        const missing = vouchers.some((v) => v.amount > 0 && !jMap.has(v.id) && !jMap.has(v.voucherNumber));
        if (missing) {
          this.syncVouchersWithJournals(localJournals).catch((err) => notifyCloudSyncError("CloudSync", err));
        }
      }
    } catch {}

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
    const journals = isSupabaseConfigured ? await this.getJournals() : localDataStore.getJournals();
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

    localDataStore.removeTombstone('journals', newJournal.id);
    journals.unshift(newJournal);
    localDataStore.saveJournals(journals);
    try {
      await SupabaseDataService.saveJournal(newJournal);
    } catch (e) {
      console.warn('Supabase saveJournal notice:', e);
    }
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
    localDataStore.removeTombstone('journals', id);
    let journals = localDataStore.getJournals();

    const isMatch = (j: JournalEntry) => {
      if (!j) return false;
      if (j.id === id) return true;
      if (j.id && id && j.id.toLowerCase() === id.toLowerCase()) return true;
      if ((j as any).raw_data?.id === id) return true;
      if ((j as any)._id === id) return true;
      try {
        if (toValidUUID(j.id) === toValidUUID(id)) return true;
      } catch {}
      if (j.entryNumber && id && j.entryNumber.trim().toUpperCase() === id.trim().toUpperCase()) return true;
      if (j.reference && id && j.reference.trim() === id.trim()) return true;
      return false;
    };

    let idx = journals.findIndex(isMatch);

    // 1. If not found in localDataStore, attempt fetching from Supabase
    if (idx === -1 && isSupabaseConfigured) {
      try {
        const singleJ = await SupabaseDataService.getJournal(id);
        if (singleJ) {
          journals.unshift(singleJ);
          localDataStore.saveJournals(journals);
          idx = 0;
        } else {
          const fromSupabase = await SupabaseDataService.getJournals();
          if (Array.isArray(fromSupabase) && fromSupabase.length > 0) {
            const map = new Map(journals.map((j) => [j.id, j]));
            for (const sj of fromSupabase) {
              if (!map.has(sj.id)) {
                journals.push(sj);
                map.set(sj.id, sj);
              }
            }
            localDataStore.saveJournals(journals);
            idx = journals.findIndex(isMatch);
          }
        }
      } catch (e) {
        console.warn('updateJournal Supabase retrieval notice:', e);
      }
    }

    // 2. If still not found, check server API
    if (idx === -1) {
      try {
        const fromServer = await safeApiFetch<JournalEntry[]>('/api/journals');
        if (Array.isArray(fromServer) && fromServer.length > 0) {
          const map = new Map(journals.map((j) => [j.id, j]));
          for (const sj of fromServer) {
            if (!map.has(sj.id)) {
              journals.push(sj);
              map.set(sj.id, sj);
            }
          }
          localDataStore.saveJournals(journals);
          idx = journals.findIndex(isMatch);
        }
      } catch (e) {
        console.warn('updateJournal Server API retrieval notice:', e);
      }
    }

    // 3. Graceful fallback: If not found anywhere, create/upsert rather than blocking the user
    if (idx === -1) {
      const fallbackEntry: JournalEntry = {
        id,
        entryNumber: updated.entryNumber || `JV-${id.slice(-6).toUpperCase()}`,
        date: updated.date || new Date().toISOString().split('T')[0],
        reference: updated.reference || '',
        description: updated.description || 'قيد محاسبي',
        status: updated.status || 'POSTED',
        lines: updated.lines || [],
        totalDebit: 0,
        totalCredit: 0,
        createdAt: new Date().toISOString(),
        isAutoGenerated: false,
      };
      journals.unshift(fallbackEntry);
      idx = 0;
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

    const oldLines = journals[idx].lines || [];
    journals[idx] = {
      ...journals[idx],
      ...updated,
      id: journals[idx].id || id,
      companyId: compId,
      lines: formattedLines,
      totalDebit: Math.round(totalDebit * 1000) / 1000,
      totalCredit: Math.round(totalCredit * 1000) / 1000,
    };

    localDataStore.saveJournals(journals);

    // Recalculate customer / supplier ledger balances if affected
    const touchedCustomerIds = new Set<string>();
    const touchedSupplierIds = new Set<string>();
    [...oldLines, ...formattedLines].forEach((l: any) => {
      if (l.entityType === 'CUSTOMER' && l.entityId) touchedCustomerIds.add(l.entityId);
      if (l.entityType === 'SUPPLIER' && l.entityId) touchedSupplierIds.add(l.entityId);
    });
    for (const cId of touchedCustomerIds) {
      this.recalculateCustomerBalance(cId);
    }
    for (const sId of touchedSupplierIds) {
      this.recalculateSupplierBalance(sId);
    }
    this.syncAccountBalances();

    // Persist to Supabase
    if (isSupabaseConfigured) {
      try {
        await SupabaseDataService.saveJournal(journals[idx]);
      } catch (e) {
        console.warn('Supabase updateJournal notice:', e);
      }
    }

    try {
      await safeApiFetch<JournalEntry>(`/api/journals/${encodeURIComponent(journals[idx].id)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-company-id': compId || '',
        },
        body: JSON.stringify({ ...updated, companyId: compId, lines: formattedLines }),
      });
    } catch (e) {
      console.warn('Server API updateJournal notice:', e);
    }

    return journals[idx];
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
    }
    return apiRes;
  }

  public static async reverseJournal(id: string, reason: string): Promise<JournalEntry | null> {
    localDataStore.removeTombstone('journals', id);
    let journals = localDataStore.getJournals();
    const isMatch = (j: JournalEntry) =>
      j.id === id ||
      (j.id && id && j.id.toLowerCase() === id.toLowerCase()) ||
      (j as any).raw_data?.id === id ||
      (j as any)._id === id ||
      toValidUUID(j.id) === toValidUUID(id) ||
      (j.entryNumber && id && j.entryNumber.trim().toUpperCase() === id.trim().toUpperCase());

    let orig = journals.find(isMatch);
    if (!orig && isSupabaseConfigured) {
      try {
        const singleJ = await SupabaseDataService.getJournal(id);
        if (singleJ) {
          journals.unshift(singleJ);
          localDataStore.saveJournals(journals);
          orig = singleJ;
        }
      } catch {}
    }
    if (!orig) return null;

    orig.status = 'CANCELLED';
    localDataStore.saveJournals(journals);
    if (isSupabaseConfigured) {
      SupabaseDataService.saveJournal(orig).catch((err) =>
        console.warn('Supabase reverseJournal orig notice:', err)
      );
    }

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

    await safeApiFetch(`/api/journals/${id}/reverse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    return revEntry;
  }

  public static async deleteJournal(id: string): Promise<boolean> {
    localDataStore.addTombstone('journals', id);
    let journals = localDataStore.getJournals();
    const isMatch = (j: JournalEntry) =>
      j.id === id ||
      (j.id && id && j.id.toLowerCase() === id.toLowerCase()) ||
      (j as any).raw_data?.id === id ||
      (j as any)._id === id ||
      toValidUUID(j.id) === toValidUUID(id) ||
      (j.entryNumber && id && j.entryNumber.trim().toUpperCase() === id.trim().toUpperCase());

    const filtered = journals.filter((j) => !isMatch(j));
    localDataStore.saveJournals(filtered);

    // Unlink from invoices in localDataStore
    const invoices = localDataStore.getInvoices();
    let invChanged = false;
    invoices.forEach((inv) => {
      if (inv.journalEntryId === id) {
        inv.journalEntryId = undefined;
        invChanged = true;
      }
    });
    if (invChanged) {
      localDataStore.saveInvoices(invoices);
    }

    // Broadcast across tabs/windows on device
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel('logix_erp_sync');
        bc.postMessage({ type: 'JOURNAL_DELETED', id });
        bc.close();
      }
    } catch {}

    try {
      await SupabaseDataService.deleteJournal(id);
    } catch (e) {
      console.warn('Supabase deleteJournal notice:', e);
    }

    await safeApiFetch(`/api/journals/${id}`, { method: 'DELETE' });
    await safeApiFetch('/api/tombstones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'journals', id }),
    });
    return true;
  }

  // Invoices
  public static async getInvoices(): Promise<Invoice[]> {
    const tombstones = localDataStore.getTombstones('invoices');
    let localInvoices = localDataStore.getInvoices().filter((inv) => !tombstones.has(inv.id));
    const isLocked = localDataStore.isRestoreLocked();

    try {
      const fromSupabase = await SupabaseDataService.getInvoices();
      if (Array.isArray(fromSupabase)) {
        const remoteTombstoned = fromSupabase.filter((inv) => tombstones.has(inv.id));
        if (remoteTombstoned.length > 0 && isSupabaseConfigured) {
          Promise.all(remoteTombstoned.map((inv) => SupabaseDataService.deleteInvoice(inv.id))).catch((err) => notifyCloudSyncError("CloudSync", err));
        }
        const validRemote = fromSupabase.filter((inv) => !tombstones.has(inv.id));

        if (localInvoices.length > 0 || localDataStore.isTenantInitialized()) {
          const localById = new Map<string, Invoice>();
          const localByNumber = new Map<string, Invoice>();
          for (const inv of localInvoices) {
            if (inv.id) localById.set(inv.id, inv);
            if (inv.invoiceNumber) localByNumber.set(inv.invoiceNumber.trim().toUpperCase(), inv);
          }

          let hasChanges = false;
          for (const rInv of validRemote) {
            const rNum = (rInv.invoiceNumber || '').trim().toUpperCase();
            const existing = (rInv.id ? localById.get(rInv.id) : null) || (rNum ? localByNumber.get(rNum) : null);
            if (!existing) {
              localInvoices.push(rInv);
              if (rInv.id) localById.set(rInv.id, rInv);
              if (rNum) localByNumber.set(rNum, rInv);
              hasChanges = true;
            } else {
              // Existing record found: reconcile without creating duplicate
              const localTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
              const remoteTime = new Date(rInv.updatedAt || rInv.createdAt || 0).getTime();
              const remoteHasLines = Array.isArray(rInv.lines) && rInv.lines.length > 0;
              const localHasLines = Array.isArray(existing.lines) && existing.lines.length > 0;

              if (remoteTime > localTime || (remoteHasLines && !localHasLines)) {
                Object.assign(existing, rInv);
                hasChanges = true;
              }
            }
          }
          const deduplicated = localDataStore.deduplicateInvoices(localInvoices);
          deduplicated.sort((a, b) => new Date(b.createdAt || b.date || 0).getTime() - new Date(a.createdAt || a.date || 0).getTime());
          if (hasChanges || deduplicated.length !== localInvoices.length) {
            localDataStore.saveInvoices(deduplicated);
          }
          return deduplicated;
        }

        if (validRemote.length > 0) {
          const deduplicated = localDataStore.deduplicateInvoices(validRemote);
          deduplicated.sort((a, b) => new Date(b.createdAt || b.date || 0).getTime() - new Date(a.createdAt || a.date || 0).getTime());
          localDataStore.saveInvoices(deduplicated);
          return deduplicated;
        }
      }
    } catch (e) {
      console.warn('Supabase getInvoices notice:', e);
    }

    const finalLocal = localDataStore.deduplicateInvoices(localInvoices);
    return finalLocal.sort((a, b) => new Date(b.createdAt || b.date || 0).getTime() - new Date(a.createdAt || a.date || 0).getTime());
  }

  public static async getNextInvoiceNumber(isSales: boolean, targetCompanyId?: string): Promise<string> {
    const rawCompanyId = targetCompanyId || localDataStore.getEffectiveCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (isSupabaseConfigured && companyId) {
      try {
        const nextNum = await SupabaseDataService.getNextUniqueInvoiceNumber(isSales, companyId);
        if (nextNum) return nextNum;
      } catch (err) {
        console.warn('[DataService] Error querying next invoice number from Supabase:', err);
      }
    }
    const prefix = isSales ? 'INV-SAL-2026-' : 'INV-PUR-2026-';
    const invoices = localDataStore.getInvoices();
    let maxSeq = 0;
    for (const inv of invoices) {
      if (inv.invoiceNumber && inv.invoiceNumber.startsWith(prefix)) {
        const numPart = parseInt(inv.invoiceNumber.replace(prefix, ''), 10);
        if (!isNaN(numPart) && numPart > maxSeq) {
          maxSeq = numPart;
        }
      }
    }
    return `${prefix}${String(maxSeq + 1).padStart(4, '0')}`;
  }

  public static async createInvoice(data: any): Promise<Invoice> {
    const invoices = localDataStore.getInvoices();
    const customers = isSupabaseConfigured ? await this.getCustomers() : localDataStore.getCustomers();
    const suppliers = isSupabaseConfigured ? await this.getSuppliers() : localDataStore.getSuppliers();
    const inventory = localDataStore.getInventory();
    
    const isSales = data.type === 'SALES' || data.type === 'SALES_RETURN' || !data.type;
    const isSalesReturn = data.type === 'SALES_RETURN';
    const isPurchase = data.type === 'PURCHASE';
    const isPurchaseReturn = data.type === 'PURCHASE_RETURN';
    
    const invoiceNumber = (data.invoiceNumber && String(data.invoiceNumber).trim())
      ? String(data.invoiceNumber).trim()
      : await this.getNextInvoiceNumber(isSales, data.companyId || data.company_id);
    
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
      const vatRate = Number(item.vatRate) || 0;
      const vatAmount = Number(item.vatAmount) || (lineNet * vatRate / 100);

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
        vatRate,
        vatAmount,
        total: lineNet + vatAmount,
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
    const computedVatTotal = lines.reduce((s: number, it: any) => s + (it.vatAmount || 0), 0);
    const grandTotal = Math.max(0, grossSubtotal - discountTotal) + computedVatTotal;
    
    const paidAmount = data.paidAmount !== undefined
      ? Math.max(0, Number(data.paidAmount))
      : (data.paymentTerms === 'CASH' ? grandTotal : 0);
    const dueAmount = Math.max(0, grandTotal - paidAmount);
    
    let entityNameAr = data.entityNameAr || data.entityName || '';
    if (isSales || isSalesReturn) {
      const cust = customers.find((c) => c.id === data.entityId);
      if (cust) entityNameAr = cust.nameAr;
    } else {
      const supp = suppliers.find((s) => s.id === data.entityId);
      if (supp) entityNameAr = supp.nameAr;
    }

    const newId = generateUUID();

    const newInvoice: Invoice = {
      id: newId,
      invoiceNumber,
      type: data.type || 'SALES',
      date: data.date || new Date().toISOString().split('T')[0],
      dueDate: data.dueDate || new Date().toISOString().split('T')[0],
      entityId: data.entityId || '',
      entityNameAr,
      status: data.status || 'POSTED',
      lines,
      subtotal: grossSubtotal,
      vatTotal: computedVatTotal,
      discountType: invDiscType,
      discountValue: invDiscVal,
      discountTotal,
      grandTotal,
      paidAmount,
      dueAmount,
      paymentTerms: data.paymentTerms || (paidAmount >= grandTotal && grandTotal > 0 ? 'CASH' : 'CREDIT'),
      salesPerson: data.salesPerson || data.salesRepName || '',
      salesRepId: data.salesRepId || data.rep_id || data.sales_rep_id || undefined,
      salesRepName: data.salesRepName || data.salesPerson || undefined,
      rep_id: data.rep_id || data.salesRepId || data.sales_rep_id || undefined,
      sales_rep_id: data.salesRepId || data.rep_id || data.sales_rep_id || undefined,
      warehouseId: data.warehouseId || data.warehouse_id || undefined,
      warehouse_id: data.warehouse_id || data.warehouseId || undefined,
      warehouseName: data.warehouseName || undefined,
      pos_session_id: data.pos_session_id || data.posSessionId || undefined,
      posSessionId: data.posSessionId || data.pos_session_id || undefined,
      cashierName: data.cashierName || undefined,
      receiverName: data.receiverName || '',
      customerBranchId: data.customerBranchId || undefined,
      customerBranchName: data.customerBranchName || undefined,
      priceListApplied: data.priceListApplied || undefined,
      notes: data.notes,
      companyId: data.companyId || data.company_id || undefined,
      company_id: data.company_id || data.companyId || undefined,
      createdAt: new Date().toISOString(),
    };

    const activeCompanyId = localDataStore.getEffectiveCompanyId() || 'default';
    const company = localDataStore.getCompany();
    // Allow negative stock if company permits it (default: true) or explicitly specified in payload
    const companyAllowsNegative = company ? company.allowNegativeInventory !== false : true;
    const allowNegativeStock = Boolean(
      data.allowNegativeStock === true ||
      data.allowNegative === true ||
      companyAllowsNegative
    );

    // Negative Inventory Check (only blocks if negative stock is strictly forbidden)
    if ((isSales || isPurchaseReturn) && !allowNegativeStock) {
      for (const it of lines) {
        const invItem = inventory.find((i) => i.id === it.itemId);
        const currentQty = invItem ? Number(invItem.quantityOnHand) : 0;
        if (currentQty < it.quantity) {
          throw new Error(
            `لا يمكن إتمام الفاتورة: رصيد الصنف (${it.itemNameAr}) غير كافٍ في المخزن. المتوفر حالياً: ${currentQty} والكمية المطلوبة: ${it.quantity}. يرجى فحص المخزون أو تفعيل خيار السماح بالبيع بالسالب من إعدادات الشركة.`
          );
        }
      }
    }

    const effectiveWarehouseId = newInvoice.warehouseId || newInvoice.warehouse_id || company?.posDefaultWarehouseId || 'wh-main-01';
    newInvoice.warehouseId = effectiveWarehouseId;
    newInvoice.warehouse_id = effectiveWarehouseId;
    if (!newInvoice.warehouseName) {
      const allWh = localDataStore.getWarehouses();
      const matchWh = allWh.find((w) => w.id === effectiveWarehouseId);
      newInvoice.warehouseName = matchWh ? matchWh.nameAr : 'المستودع الرئيسي (الشويخ)';
    }

    // Inventory Updates with robust identification and atomic Supabase stock sync
    for (const it of lines) {
      const invItem = inventory.find(
        (i) => i.id === it.itemId ||
               (it.itemSku && (i.sku === it.itemSku || (i as any).code === it.itemSku)) ||
               (it.barcode && (i.barcode === it.barcode || (i as any).code === it.barcode)) ||
               (it.itemNameAr && i.nameAr === it.itemNameAr)
      );
      const isOutbound = isSales || isPurchaseReturn;
      const qtyDelta = isOutbound ? -Number(it.quantity) : Number(it.quantity);

      if (invItem) {
        let newUnitCost: number | undefined = undefined;

        if (isOutbound) {
          // Outbound sales or purchase return: unit cost remains constant (IAS-2 rule)
          invItem.quantityOnHand = allowNegativeStock
            ? (invItem.quantityOnHand || 0) - Number(it.quantity)
            : Math.max(0, (invItem.quantityOnHand || 0) - Number(it.quantity));
        } else {
          // Inbound: purchase or sales return
          const currentQty = Number(invItem.quantityOnHand) || 0;
          const currentCost = Number(invItem.costPrice ?? invItem.purchasePrice ?? 0);
          const incomingQty = Number(it.quantity) || 0;
          const purchasePrice = Number(it.unitPrice) || 0;

          if (isPurchase) {
            // IAS-2 Moving Weighted Average Cost (MAC) Formula:
            newUnitCost = IAS2CostingEngine.calculateMovingAverageCost(
              currentQty,
              currentCost,
              incomingQty,
              purchasePrice
            );
            invItem.costPrice = newUnitCost;
            invItem.purchasePrice = newUnitCost;
          }

          invItem.quantityOnHand = currentQty + incomingQty;
        }

        if (isSupabaseConfigured) {
          await SupabaseDataService.adjustItemStock(
            it.itemId,
            it.itemSku || invItem.sku,
            it.barcode || invItem.barcode,
            invItem.quantityOnHand,
            activeCompanyId,
            newUnitCost
          ).catch((e) => console.warn('Supabase adjustItemStock notice:', e));
        }
      }

      // Warehouse-level stock update
      DataService.adjustWarehouseStock(effectiveWarehouseId, it.itemId, qtyDelta);
    }
    localDataStore.saveInventory(inventory);

    // =========================================================================
    // [ARCHITECT] IFRS Compliant Automated Journal Entry Generation
    // =========================================================================
    const resolved = this.getResolvedAccounts();
    let jLines: any[] = [];
    
    if (isSales) {
      const netRevenue = Math.max(0, grandTotal - computedVatTotal);
      if (paidAmount > 0 && dueAmount > 0) {
        jLines.push({ id: 'jl-1', accountId: resolved.cash.id, accountCode: resolved.cash.code, accountNameAr: resolved.cash.nameAr, debit: paidAmount, credit: 0, memo: `دفعة نقدية مسددة - فاتورة مبيعات ${invoiceNumber} - ${entityNameAr}` });
        jLines.push({ id: 'jl-2', accountId: resolved.receivable.id, accountCode: resolved.receivable.code, accountNameAr: resolved.receivable.nameAr, debit: dueAmount, credit: 0, memo: `المبلغ الآجل المستحق - فاتورة مبيعات ${invoiceNumber} - ${entityNameAr}` });
      } else {
        const paymentAcc = paidAmount >= grandTotal ? resolved.cash : resolved.receivable;
        jLines.push({ id: 'jl-1', accountId: paymentAcc.id, accountCode: paymentAcc.code, accountNameAr: paymentAcc.nameAr, debit: grandTotal, credit: 0, memo: `فاتورة مبيعات ${invoiceNumber} - ${entityNameAr}` });
      }
      jLines.push({ id: `jl-${jLines.length + 1}`, accountId: resolved.sales.id, accountCode: resolved.sales.code, accountNameAr: resolved.sales.nameAr, debit: 0, credit: netRevenue, memo: `إيراد مبيعات فاتورة ${invoiceNumber}` });
      if (computedVatTotal > 0) {
        jLines.push({ id: `jl-${jLines.length + 1}`, accountId: resolved.vat.id, accountCode: resolved.vat.code, accountNameAr: resolved.vat.nameAr, debit: 0, credit: computedVatTotal, memo: `ضريبة القيمة المضافة المحصلة - فاتورة ${invoiceNumber}` });
      }
      // IAS-2 COGS: Calculated at latest Moving Weighted Average Cost (Unit cost unchanged on sales)
      const totalCost = lines.reduce((sum: number, line: any) => {
        const invItem = inventory.find(i => i.id === line.itemId || (line.itemSku && (i.sku === line.itemSku || (i as any).code === line.itemSku)));
        const unitCost = Number(invItem ? (invItem.costPrice ?? invItem.purchasePrice ?? 0) : 0);
        return sum + (unitCost * line.quantity);
      }, 0);
      const roundedCOGS = IAS2CostingEngine.roundToPrecision(totalCost);
      if (roundedCOGS > 0) {
        jLines.push({ id: `jl-${jLines.length + 1}`, accountId: resolved.cogs.id, accountCode: resolved.cogs.code, accountNameAr: resolved.cogs.nameAr, debit: roundedCOGS, credit: 0, memo: `تكلفة بضاعة مباعة (IAS-2 MAC) - فاتورة ${invoiceNumber}` });
        jLines.push({ id: `jl-${jLines.length + 1}`, accountId: resolved.inventory.id, accountCode: resolved.inventory.code, accountNameAr: resolved.inventory.nameAr, debit: 0, credit: roundedCOGS, memo: `تخفيض المخزون المباع - فاتورة ${invoiceNumber}` });
      }
    } else if (isSalesReturn) {
      const netRevenue = Math.max(0, grandTotal - computedVatTotal);
      jLines.push({ id: 'jl-1', accountId: resolved.sales.id, accountCode: resolved.sales.code, accountNameAr: resolved.sales.nameAr, debit: netRevenue, credit: 0, memo: `مردودات ومسموحات المبيعات ${invoiceNumber} - ${entityNameAr}` });
      if (computedVatTotal > 0) {
        jLines.push({ id: `jl-${jLines.length + 1}`, accountId: resolved.vat.id, accountCode: resolved.vat.code, accountNameAr: resolved.vat.nameAr, debit: computedVatTotal, credit: 0, memo: `عكس ضريبة مبيعات مرتجعة - مرتجع ${invoiceNumber}` });
      }
      if (paidAmount > 0 && dueAmount > 0) {
        jLines.push({ id: `jl-${jLines.length + 1}`, accountId: resolved.cash.id, accountCode: resolved.cash.code, accountNameAr: resolved.cash.nameAr, debit: 0, credit: paidAmount, memo: `رد نقدي مسدد للعميل - مرتجع مبيعات ${invoiceNumber}` });
        jLines.push({ id: `jl-${jLines.length + 1}`, accountId: resolved.receivable.id, accountCode: resolved.receivable.code, accountNameAr: resolved.receivable.nameAr, debit: 0, credit: dueAmount, memo: `تخفيض حساب العميل الآجل ${entityNameAr}` });
      } else {
        const paymentAcc = paidAmount >= grandTotal ? resolved.cash : resolved.receivable;
        jLines.push({ id: `jl-${jLines.length + 1}`, accountId: paymentAcc.id, accountCode: paymentAcc.code, accountNameAr: paymentAcc.nameAr, debit: 0, credit: grandTotal, memo: `تخفيض رصيد حساب العميل ${entityNameAr}` });
      }
      // IAS-2 Sales Return: Returned items restore to inventory at their sold unit cost
      const totalCost = lines.reduce((sum: number, line: any) => {
        const invItem = inventory.find(i => i.id === line.itemId || (line.itemSku && (i.sku === line.itemSku || (i as any).code === line.itemSku)));
        const unitCost = Number(line.costPrice ?? (invItem ? (invItem.costPrice ?? invItem.purchasePrice ?? 0) : 0));
        return sum + (unitCost * line.quantity);
      }, 0);
      const roundedCOGS = IAS2CostingEngine.roundToPrecision(totalCost);
      if (roundedCOGS > 0) {
        jLines.push({ id: `jl-${jLines.length + 1}`, accountId: resolved.inventory.id, accountCode: resolved.inventory.code, accountNameAr: resolved.inventory.nameAr, debit: roundedCOGS, credit: 0, memo: `رد بضاعة للمخزون (مرتجع مبيعات) - مرتجع ${invoiceNumber}` });
        jLines.push({ id: `jl-${jLines.length + 1}`, accountId: resolved.cogs.id, accountCode: resolved.cogs.code, accountNameAr: resolved.cogs.nameAr, debit: 0, credit: roundedCOGS, memo: `تخفيض تكلفة بضاعة مباعة - مرتجع ${invoiceNumber}` });
      }
    } else if (isPurchase) {
      const netPurchase = Math.max(0, grandTotal - computedVatTotal);
      jLines.push({ id: 'jl-1', accountId: resolved.inventory.id, accountCode: resolved.inventory.code, accountNameAr: resolved.inventory.nameAr, debit: netPurchase, credit: 0, memo: `شراء بضاعة للمخزون - فاتورة ${invoiceNumber} - ${entityNameAr}` });
      if (computedVatTotal > 0) {
        jLines.push({ id: `jl-${jLines.length + 1}`, accountId: resolved.vat.id, accountCode: resolved.vat.code, accountNameAr: resolved.vat.nameAr, debit: computedVatTotal, credit: 0, memo: `ضريبة القيمة المضافة المدفوعة - فاتورة ${invoiceNumber}` });
      }
      if (paidAmount > 0 && dueAmount > 0) {
        jLines.push({ id: `jl-${jLines.length + 1}`, accountId: resolved.cash.id, accountCode: resolved.cash.code, accountNameAr: resolved.cash.nameAr, debit: 0, credit: paidAmount, memo: `دفعة نقدية لمورد - فاتورة مشتريات ${invoiceNumber}` });
        jLines.push({ id: `jl-${jLines.length + 1}`, accountId: resolved.payable.id, accountCode: resolved.payable.code, accountNameAr: resolved.payable.nameAr, debit: 0, credit: dueAmount, memo: `مبلغ آجل مستحق للمورد - فاتورة مشتريات ${invoiceNumber}` });
      } else {
        const paymentAcc = paidAmount >= grandTotal ? resolved.cash : resolved.payable;
        jLines.push({ id: `jl-${jLines.length + 1}`, accountId: paymentAcc.id, accountCode: paymentAcc.code, accountNameAr: paymentAcc.nameAr, debit: 0, credit: grandTotal, memo: `سداد فاتورة مشتريات ${invoiceNumber} - ${entityNameAr}` });
      }
    } else if (isPurchaseReturn) {
      const netPurchase = Math.max(0, grandTotal - computedVatTotal);
      if (paidAmount > 0 && dueAmount > 0) {
        jLines.push({ id: 'jl-1', accountId: resolved.cash.id, accountCode: resolved.cash.code, accountNameAr: resolved.cash.nameAr, debit: paidAmount, credit: 0, memo: `استرداد نقدي من المورد - مرتجع مشتريات ${invoiceNumber}` });
        jLines.push({ id: 'jl-2', accountId: resolved.payable.id, accountCode: resolved.payable.code, accountNameAr: resolved.payable.nameAr, debit: dueAmount, credit: 0, memo: `تخفيض حساب المورد الآجل - ${entityNameAr}` });
      } else {
        const paymentAcc = paidAmount >= grandTotal ? resolved.cash : resolved.payable;
        jLines.push({ id: 'jl-1', accountId: paymentAcc.id, accountCode: paymentAcc.code, accountNameAr: paymentAcc.nameAr, debit: grandTotal, credit: 0, memo: `تخفيض حساب المورد - مرتجع ${invoiceNumber}` });
      }
      jLines.push({ id: `jl-${jLines.length + 1}`, accountId: resolved.inventory.id, accountCode: resolved.inventory.code, accountNameAr: resolved.inventory.nameAr, debit: 0, credit: netPurchase, memo: `رد بضاعة للمورد من المخزون - مرتجع ${invoiceNumber}` });
      if (computedVatTotal > 0) {
        jLines.push({ id: `jl-${jLines.length + 1}`, accountId: resolved.vat.id, accountCode: resolved.vat.code, accountNameAr: resolved.vat.nameAr, debit: 0, credit: computedVatTotal, memo: `عكس ضريبة مشتريات مستردة - مرتجع ${invoiceNumber}` });
      }
    }

    const entryDebit = jLines.reduce((s, l) => s + (l.debit || 0), 0);
    const entryCredit = jLines.reduce((s, l) => s + (l.credit || 0), 0);

    const jEntry: JournalEntry = {
      id: 'jv-' + Math.random().toString(36).substr(2, 9),
      entryNumber: `JV-${invoiceNumber}`,
      date: newInvoice.date,
      reference: invoiceNumber,
      description: `قيد ترحيل فاتورة ${isSales ? 'مبيعات' : 'مشتريات'} رقم (${invoiceNumber}) - ${entityNameAr}`,
      status: 'POSTED',
      lines: jLines,
      totalDebit: entryDebit,
      totalCredit: entryCredit,
      createdAt: new Date().toISOString(),
      postedAt: new Date().toISOString(),
      isAutoGenerated: true,
      sourceModule: isSales ? 'SALES_INVOICE' : 'PURCHASE_INVOICE',
      sourceId: newInvoice.id,
    };

    const journals = localDataStore.getJournals();
    journals.unshift(jEntry);
    localDataStore.saveJournals(journals);
    
    newInvoice.journalEntryId = jEntry.id;
    localDataStore.removeTombstone('invoices', newInvoice.id);
    localDataStore.removeTombstone('journals', jEntry.id);
    
    // Immediate Synchronous Supabase Persistence for zero-lag consistency
    if (isSupabaseConfigured) {
      // Must NOT swallow errors! Enforce strict database persistence before updating state.
      await SupabaseDataService.saveInvoice(newInvoice, activeCompanyId);

      // Save to local store ONLY after Supabase successfully confirmed persistence
      invoices.unshift(newInvoice);
      localDataStore.saveInvoices(invoices);

      if (jEntry) {
        await SupabaseDataService.saveJournal(jEntry, activeCompanyId).catch((jeErr) => {
          console.warn('[DataService] Direct saveJournal notice:', jeErr);
        });
      }
    } else {
      invoices.unshift(newInvoice);
      localDataStore.saveInvoices(invoices);
    }

    // Smart Caching update
    if ((isSales || isSalesReturn) && newInvoice.entityId) {
      this.recalculateCustomerBalance(newInvoice.entityId);
    } else if ((isPurchase || isPurchaseReturn) && newInvoice.entityId) {
      this.recalculateSupplierBalance(newInvoice.entityId);
    }
    backgroundSync.enqueueInvoiceCreate(newInvoice, data, activeCompanyId);

    return newInvoice;
  }
  public static async postInvoice(id: string): Promise<Invoice | null> {
    const invoices = localDataStore.getInvoices();
    const inv = invoices.find((i) => i.id === id);
    if (!inv) return null;
    inv.status = 'POSTED';
    localDataStore.saveInvoices(invoices);
    const activeCompanyId = localDataStore.getEffectiveCompanyId();
    if (isSupabaseConfigured) {
      SupabaseDataService.saveInvoice(inv, activeCompanyId).catch((err) =>
        console.warn('Supabase postInvoice notice:', err)
      );
      if (inv.journalEntryId) {
        const journals = localDataStore.getJournals();
        const jEntry = journals.find((j) => j.id === inv.journalEntryId);
        if (jEntry) {
          jEntry.status = 'POSTED';
          localDataStore.saveJournals(journals);
          SupabaseDataService.saveJournal(jEntry, activeCompanyId).catch((err) =>
            console.warn('Supabase postInvoice journal notice:', err)
          );
        }
      }
    }
    await safeApiFetch(`/api/invoices/${id}/post`, { method: 'POST' });
    return inv;
  }

  public static async recordPosShiftClosingGL(session: any): Promise<JournalEntry | null> {
    const diff = Number(session.difference) || 0;
    if (Math.abs(diff) < 0.001) {
      return null;
    }
    const absAmount = Math.abs(diff);
    const resolved = this.getResolvedAccounts();
    const diffExpenseAcc = { id: 'acc-5290', code: '5290', nameAr: 'مصروفات عجز وفروقات الصندوق والوردية' };
    const diffRevenueAcc = { id: 'acc-4200', code: '4200', nameAr: 'إيرادات وفروقات الصندوق والوردية المتنوعة' };

    const jLines = diff < 0
      ? [
          {
            id: 'jl-1',
            accountId: diffExpenseAcc.id,
            accountCode: diffExpenseAcc.code,
            accountNameAr: diffExpenseAcc.nameAr,
            debit: absAmount,
            credit: 0,
            memo: `إثبات عجز نقدي في وردية الكاشير رقم ${session.session_number || session.id}`,
          },
          {
            id: 'jl-2',
            accountId: resolved.cash.id,
            accountCode: resolved.cash.code,
            accountNameAr: resolved.cash.nameAr,
            debit: 0,
            credit: absAmount,
            memo: `تسوية صندوق الكاشير بعد إغلاق الوردية ${session.session_number || session.id}`,
          },
        ]
      : [
          {
            id: 'jl-1',
            accountId: resolved.cash.id,
            accountCode: resolved.cash.code,
            accountNameAr: resolved.cash.nameAr,
            debit: absAmount,
            credit: 0,
            memo: `إثبات زيادة نقدية في وردية الكاشير رقم ${session.session_number || session.id}`,
          },
          {
            id: 'jl-2',
            accountId: diffRevenueAcc.id,
            accountCode: diffRevenueAcc.code,
            accountNameAr: diffRevenueAcc.nameAr,
            debit: 0,
            credit: absAmount,
            memo: `تسوية صندوق الكاشير فائض الوردية ${session.session_number || session.id}`,
          },
        ];

    const jEntry: JournalEntry = {
      id: 'jv-pos-' + Math.random().toString(36).substr(2, 9),
      entryNumber: `JV-POS-${session.session_number || session.id.slice(-4)}`,
      date: new Date().toISOString().split('T')[0],
      reference: `POS-SHIFT-${session.session_number || session.id}`,
      description: `قيد تسوية الفوارق النقدية لإغلاق وردية كاشير (${session.user_name || 'الكاشير'}) - ${diff < 0 ? 'عجز' : 'فائض'} بقيمة ${absAmount.toFixed(3)}`,
      status: 'POSTED',
      lines: jLines,
      totalDebit: absAmount,
      totalCredit: absAmount,
      createdAt: new Date().toISOString(),
      postedAt: new Date().toISOString(),
      isAutoGenerated: true,
      sourceModule: 'POS_SHIFT' as any,
      sourceId: session.id,
    };

    const journals = localDataStore.getJournals();
    journals.unshift(jEntry);
    localDataStore.saveJournals(journals);
    if (isSupabaseConfigured) {
      SupabaseDataService.saveJournal(jEntry).catch((err) => notifyCloudSyncError("CloudSync", err));
    }
    return jEntry;
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

    // If the invoice was posted or paid, perform complete atomic accounting & inventory rollback:
    if (wasPostedOrPaid) {
      // 1. Locate and reverse any associated journals
      const journals = localDataStore.getJournals();
      const matchingJournals = journals.filter(
        (j) => j.id === inv.journalEntryId || j.sourceId === inv.id || j.reference === inv.invoiceNumber
      );

      for (const origJournal of matchingJournals) {
        // المحاسبة المعيارية IFRS: نضبط القيد الأصلي إلى REVERSED وننشئ القيد العكسي بـ POSTED
        // ليتساوى المجموع الجبري للطرفين ويصبح الأثر المالي في الأستاذ العام صفراً تماماً دون أي رصيد سالب زائف
        origJournal.status = 'REVERSED';

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

        (origJournal as any).reversalJournalId = revJournal.id;

        journals.unshift(revJournal);
        SupabaseDataService.saveJournal(origJournal).catch((err) => console.warn('Supabase save original journal status notice:', err));
        SupabaseDataService.saveJournal(revJournal).catch((err) => console.warn('Supabase save reversal journal notice:', err));
      }
      localDataStore.saveJournals(journals);

      // 2. Restore Inventory Quantities & Warehouse Stock
      const inventory = localDataStore.getInventory();
      const cancelWhId = inv.warehouseId || 'wh-main-01';
      (inv.lines || []).forEach((line: any) => {
        const invItem = inventory.find((i) => i.id === line.itemId);
        const q = Number(line.quantity) || 0;
        let cancelWhDelta = 0;
        if (invItem) {
          if (inv.type === 'SALES') {
            invItem.quantityOnHand += q;
            cancelWhDelta = q;
          } else if (inv.type === 'PURCHASE') {
            invItem.quantityOnHand = Math.max(0, invItem.quantityOnHand - q);
            cancelWhDelta = -q;
          } else if (inv.type === 'SALES_RETURN') {
            invItem.quantityOnHand = Math.max(0, invItem.quantityOnHand - q);
            cancelWhDelta = -q;
          } else if (inv.type === 'PURCHASE_RETURN') {
            invItem.quantityOnHand += q;
            cancelWhDelta = q;
          }
        }
        DataService.adjustWarehouseStock(cancelWhId, line.itemId, cancelWhDelta);
      });
      localDataStore.saveInventory(inventory);

      // 3. Reverse Customer/Supplier Balances
      if ((inv.type === 'SALES' || inv.type === 'SALES_RETURN') && inv.entityId) {
        this.recalculateCustomerBalance(inv.entityId);
      } else if ((inv.type === 'PURCHASE' || inv.type === 'PURCHASE_RETURN') && inv.entityId) {
        this.recalculateSupplierBalance(inv.entityId);
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

    localDataStore.addTombstone('invoices', id);

    // If not already cancelled, perform complete reversal first
    if (inv.status === 'POSTED' || inv.status === 'PAID') {
      await this.cancelInvoice(id, 'حذف الفاتورة بالكامل وعكس القيود والمخزون');
    }

    // Clean up any remaining associated journals from journals list & Firestore
    const journals = localDataStore.getJournals();
    const matchingJournals = journals.filter(
      (j) => j.id === inv.journalEntryId || j.sourceId === inv.id || j.reference === inv.invoiceNumber
    );
    for (const mj of matchingJournals) {
      localDataStore.addTombstone('journals', mj.id);
      if (isSupabaseConfigured) {
        SupabaseDataService.deleteJournal(mj.id).catch((err) => notifyCloudSyncError("CloudSync", err));
      }
    }
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

    await safeApiFetch(`/api/invoices/${id}`, { method: 'DELETE' });
    return true;
  }

  public static async updateInvoice(id: string, data: any): Promise<Invoice | null> {
    localDataStore.removeTombstone('invoices', id);
    const invoices = localDataStore.getInvoices();
    const targetInvoiceNumber = (data.invoiceNumber || '').trim().toUpperCase();
    let originalIdx = invoices.findIndex((i) => i.id === id);
    if (originalIdx === -1 && targetInvoiceNumber) {
      originalIdx = invoices.findIndex((i) => i.invoiceNumber && i.invoiceNumber.trim().toUpperCase() === targetInvoiceNumber);
    }
    if (originalIdx === -1) {
      console.warn(`updateInvoice: Invoice ${id} not found.`);
      return null;
    }
    const original = invoices[originalIdx];

    const customers = localDataStore.getCustomers();
    const suppliers = localDataStore.getSuppliers();
    const wasPostedOrPaid = original.status === 'POSTED' || original.status === 'PAID' || original.status === 'PARTIALLY_PAID';

    // 1. If previously posted or paid, roll back original inventory and customer/supplier balances
    if (wasPostedOrPaid) {
      // Rollback old stock impact and warehouse stocks
      const inventory = localDataStore.getInventory();
      const oldWhId = original.warehouseId || 'wh-main-01';
      (original.lines || []).forEach((line: any) => {
        const invItem = inventory.find((i) => i.id === line.itemId);
        const q = Number(line.quantity) || 0;
        let rollbackWhDelta = 0;
        if (invItem) {
          if (original.type === 'SALES') {
            invItem.quantityOnHand += q;
            rollbackWhDelta = q;
          } else if (original.type === 'PURCHASE') {
            invItem.quantityOnHand = Math.max(0, invItem.quantityOnHand - q);
            rollbackWhDelta = -q;
          } else if (original.type === 'SALES_RETURN') {
            invItem.quantityOnHand = Math.max(0, invItem.quantityOnHand - q);
            rollbackWhDelta = -q;
          } else if (original.type === 'PURCHASE_RETURN') {
            invItem.quantityOnHand += q;
            rollbackWhDelta = q;
          }
        }
        DataService.adjustWarehouseStock(oldWhId, line.itemId, rollbackWhDelta);
      });
      localDataStore.saveInventory(inventory);

      // Rollback old customer/supplier balance from first principles
      if ((original.type === 'SALES' || original.type === 'SALES_RETURN') && original.entityId) {
        this.recalculateCustomerBalance(original.entityId);
      } else if ((original.type === 'PURCHASE' || original.type === 'PURCHASE_RETURN') && original.entityId) {
        this.recalculateSupplierBalance(original.entityId);
      }
    }

    // 2. Recalculate updated lines and discounts
    const isSales = (data.type || original.type) === 'SALES';
    const isSalesReturn = (data.type || original.type) === 'SALES_RETURN';
    const isPurchase = (data.type || original.type) === 'PURCHASE';
    const isPurchaseReturn = (data.type || original.type) === 'PURCHASE_RETURN';

    const sourceLines = data.lines !== undefined ? data.lines : (data.items !== undefined ? data.items : original.lines);
    const updatedLines = (sourceLines || []).map((item: any, i: number) => {
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

    const grossSubtotal = updatedLines.reduce((s: number, it: any) => s + (it.subtotal || it.quantity * it.unitPrice), 0);
    const lineDiscountsSum = updatedLines.reduce((s: number, it: any) => s + (it.discountAmount || 0), 0);
    const subtotalAfterLines = Math.max(0, grossSubtotal - lineDiscountsSum);

    const invDiscType: 'PERCENT' | 'FIXED' = (data.discountType !== undefined ? data.discountType : original.discountType) === 'PERCENT' ? 'PERCENT' : 'FIXED';
    const invDiscVal = Number(data.discountValue !== undefined ? data.discountValue : original.discountValue) || 0;
    let invDiscAmt = 0;
    if (invDiscType === 'PERCENT') {
      invDiscAmt = (subtotalAfterLines * Math.min(100, Math.max(0, invDiscVal))) / 100;
    } else {
      invDiscAmt = Math.min(subtotalAfterLines, Math.max(0, invDiscVal));
    }

    const discountTotal = lineDiscountsSum + invDiscAmt;
    const grandTotal = Math.max(0, grossSubtotal - discountTotal);

    const paymentTerms = data.paymentTerms || original.paymentTerms || (data.paidAmount >= grandTotal && grandTotal > 0 ? 'CASH' : 'CREDIT');
    const paidAmount = data.paidAmount !== undefined
      ? Math.max(0, Number(data.paidAmount))
      : (paymentTerms === 'CASH' ? grandTotal : (original.paidAmount || 0));
    const dueAmount = Math.max(0, grandTotal - paidAmount);

    const newEntityId = data.entityId !== undefined ? data.entityId : original.entityId;
    let entityNameAr = data.entityNameAr || data.entityName || original.entityNameAr || '';
    if (isSales || isSalesReturn) {
      const cust = customers.find((c) => c.id === newEntityId);
      if (cust) entityNameAr = cust.nameAr;
    } else {
      const supp = suppliers.find((s) => s.id === newEntityId);
      if (supp) entityNameAr = supp.nameAr;
    }

    const updatedStatus = data.status || original.status || 'POSTED';
    const invoiceNumber = original.invoiceNumber;

    const updatedInvoice: Invoice = {
      ...original,
      ...data,
      lines: updatedLines,
      entityId: newEntityId,
      entityNameAr,
      subtotal: grossSubtotal,
      discountType: invDiscType,
      discountValue: invDiscVal,
      discountTotal,
      grandTotal,
      paidAmount,
      dueAmount,
      paymentTerms,
      status: updatedStatus,
      updatedAt: new Date().toISOString(),
    };

    // 3. If the invoice is now POSTED or PAID, apply new stock movements, balances and journals
    const isNowActive = updatedStatus === 'POSTED' || updatedStatus === 'PAID' || updatedStatus === 'PARTIALLY_PAID';

    if (isNowActive) {
      // Apply new inventory movements and warehouse stock
      const inventory = localDataStore.getInventory();
      const newWhId = updatedInvoice.warehouseId || original.warehouseId || 'wh-main-01';
      const updateCompany = localDataStore.getCompany();
      const allowNegStockInUpdate = Boolean(
        data.allowNegativeStock === true ||
        data.allowNegative === true ||
        (updateCompany ? updateCompany.allowNegativeInventory !== false : true)
      );
      updatedLines.forEach((it: any) => {
        const invItem = inventory.find((i) => i.id === it.itemId);
        const q = Number(it.quantity) || 0;
        let applyWhDelta = 0;
        if (invItem) {
          if (isSales) {
            invItem.quantityOnHand = allowNegStockInUpdate ? invItem.quantityOnHand - q : Math.max(0, invItem.quantityOnHand - q);
            applyWhDelta = -q;
          } else if (isSalesReturn) {
            invItem.quantityOnHand += q;
            applyWhDelta = q;
          } else if (isPurchase) {
            invItem.quantityOnHand += q;
            applyWhDelta = q;
          } else if (isPurchaseReturn) {
            invItem.quantityOnHand = allowNegStockInUpdate ? invItem.quantityOnHand - q : Math.max(0, invItem.quantityOnHand - q);
            applyWhDelta = -q;
          }
        }
        DataService.adjustWarehouseStock(newWhId, it.itemId, applyWhDelta);
      });
      localDataStore.saveInventory(inventory);

      // Apply new customer/supplier balance from first principles
      if (original.entityId && original.entityId !== newEntityId) {
        if (isSales || isSalesReturn) this.recalculateCustomerBalance(original.entityId);
        else this.recalculateSupplierBalance(original.entityId);
      }
      if (newEntityId) {
        if (isSales || isSalesReturn) this.recalculateCustomerBalance(newEntityId);
        else this.recalculateSupplierBalance(newEntityId);
      }

      // Generate or update double-entry journal entry with perpetual inventory, COGS, and VAT
      const resolved = this.getResolvedAccounts();
      const computedVatTotal = updatedLines.reduce((s: number, it: any) => s + (it.vatAmount || 0), 0);
      const totalCost = updatedLines.reduce((sum: number, line: any) => {
        const invItem = inventory.find((i) => i.id === line.itemId);
        return sum + ((invItem ? (Number(invItem.costPrice || invItem.purchasePrice || 0)) : 0) * line.quantity);
      }, 0);

      let jLines: any[] = [];

      if (isSales) {
        const netRevenue = Math.max(0, grandTotal - computedVatTotal);
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
            entityType: 'CUSTOMER' as const,
            entityId: newEntityId,
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
            ...(paymentAcc.id === resolved.receivable.id ? { entityType: 'CUSTOMER' as const, entityId: newEntityId } : {}),
          });
        }
        jLines.push({
          id: `jl-${jLines.length + 1}`,
          accountId: resolved.sales.id,
          accountCode: resolved.sales.code,
          accountNameAr: resolved.sales.nameAr,
          debit: 0,
          credit: netRevenue,
          memo: `إيراد مبيعات فاتورة ${invoiceNumber}`,
        });
        if (computedVatTotal > 0) {
          jLines.push({
            id: `jl-${jLines.length + 1}`,
            accountId: resolved.vat.id,
            accountCode: resolved.vat.code,
            accountNameAr: resolved.vat.nameAr,
            debit: 0,
            credit: computedVatTotal,
            memo: `ضريبة القيمة المضافة المحصلة - فاتورة ${invoiceNumber}`,
          });
        }
        if (totalCost > 0) {
          jLines.push({
            id: `jl-${jLines.length + 1}`,
            accountId: resolved.cogs.id,
            accountCode: resolved.cogs.code,
            accountNameAr: resolved.cogs.nameAr,
            debit: totalCost,
            credit: 0,
            memo: `تكلفة بضاعة مباعة - فاتورة ${invoiceNumber}`,
          });
          jLines.push({
            id: `jl-${jLines.length + 1}`,
            accountId: resolved.inventory.id,
            accountCode: resolved.inventory.code,
            accountNameAr: resolved.inventory.nameAr,
            debit: 0,
            credit: totalCost,
            memo: `تخفيض المخزون المباع - فاتورة ${invoiceNumber}`,
          });
        }
      } else if (isSalesReturn) {
        const netRevenue = Math.max(0, grandTotal - computedVatTotal);
        jLines.push({
          id: 'jl-1',
          accountId: resolved.sales.id,
          accountCode: resolved.sales.code,
          accountNameAr: resolved.sales.nameAr,
          debit: netRevenue,
          credit: 0,
          memo: `مردودات ومسموحات المبيعات ${invoiceNumber} - ${entityNameAr}`,
        });
        if (computedVatTotal > 0) {
          jLines.push({
            id: `jl-${jLines.length + 1}`,
            accountId: resolved.vat.id,
            accountCode: resolved.vat.code,
            accountNameAr: resolved.vat.nameAr,
            debit: computedVatTotal,
            credit: 0,
            memo: `عكس ضريبة مبيعات مرتجعة - مرتجع ${invoiceNumber}`,
          });
        }
        if (paidAmount > 0 && dueAmount > 0) {
          jLines.push({
            id: `jl-${jLines.length + 1}`,
            accountId: resolved.cash.id,
            accountCode: resolved.cash.code,
            accountNameAr: resolved.cash.nameAr,
            debit: 0,
            credit: paidAmount,
            memo: `رد نقدي مسدد للعميل - مرتجع مبيعات ${invoiceNumber}`,
          });
          jLines.push({
            id: `jl-${jLines.length + 1}`,
            accountId: resolved.receivable.id,
            accountCode: resolved.receivable.code,
            accountNameAr: resolved.receivable.nameAr,
            debit: 0,
            credit: dueAmount,
            memo: `تخفيض حساب العميل الآجل ${entityNameAr}`,
            entityType: 'CUSTOMER' as const,
            entityId: newEntityId,
          });
        } else {
          const paymentAcc = paidAmount >= grandTotal ? resolved.cash : resolved.receivable;
          jLines.push({
            id: `jl-${jLines.length + 1}`,
            accountId: paymentAcc.id,
            accountCode: paymentAcc.code,
            accountNameAr: paymentAcc.nameAr,
            debit: 0,
            credit: grandTotal,
            memo: `تخفيض حساب العميل ${entityNameAr}`,
            ...(paymentAcc.id === resolved.receivable.id ? { entityType: 'CUSTOMER' as const, entityId: newEntityId } : {}),
          });
        }
        if (totalCost > 0) {
          jLines.push({
            id: `jl-${jLines.length + 1}`,
            accountId: resolved.inventory.id,
            accountCode: resolved.inventory.code,
            accountNameAr: resolved.inventory.nameAr,
            debit: totalCost,
            credit: 0,
            memo: `رد بضاعة للمخزون - مرتجع ${invoiceNumber}`,
          });
          jLines.push({
            id: `jl-${jLines.length + 1}`,
            accountId: resolved.cogs.id,
            accountCode: resolved.cogs.code,
            accountNameAr: resolved.cogs.nameAr,
            debit: 0,
            credit: totalCost,
            memo: `تخفيض تكلفة بضاعة مباعة - مرتجع ${invoiceNumber}`,
          });
        }
      } else if (isPurchase) {
        const netPurchase = Math.max(0, grandTotal - computedVatTotal);
        jLines.push({
          id: 'jl-1',
          accountId: resolved.inventory.id,
          accountCode: resolved.inventory.code,
          accountNameAr: resolved.inventory.nameAr,
          debit: netPurchase,
          credit: 0,
          memo: `شراء بضاعة للمخزون - فاتورة ${invoiceNumber} - ${entityNameAr}`,
        });
        if (computedVatTotal > 0) {
          jLines.push({
            id: `jl-${jLines.length + 1}`,
            accountId: resolved.vat.id,
            accountCode: resolved.vat.code,
            accountNameAr: resolved.vat.nameAr,
            debit: computedVatTotal,
            credit: 0,
            memo: `ضريبة القيمة المضافة المدفوعة - فاتورة ${invoiceNumber}`,
          });
        }
        if (paidAmount > 0 && dueAmount > 0) {
          jLines.push({
            id: `jl-${jLines.length + 1}`,
            accountId: resolved.cash.id,
            accountCode: resolved.cash.code,
            accountNameAr: resolved.cash.nameAr,
            debit: 0,
            credit: paidAmount,
            memo: `سداد نقدي فوري لمشتريات فاتورة ${invoiceNumber}`,
          });
          jLines.push({
            id: `jl-${jLines.length + 1}`,
            accountId: resolved.payable.id,
            accountCode: resolved.payable.code,
            accountNameAr: resolved.payable.nameAr,
            debit: 0,
            credit: dueAmount,
            memo: `استحقاق آجل للمورد ${entityNameAr} - فاتورة ${invoiceNumber}`,
            entityType: 'SUPPLIER' as const,
            entityId: newEntityId,
          });
        } else {
          const purchasePaymentAcc = paidAmount >= grandTotal ? resolved.cash : resolved.payable;
          jLines.push({
            id: `jl-${jLines.length + 1}`,
            accountId: purchasePaymentAcc.id,
            accountCode: purchasePaymentAcc.code,
            accountNameAr: purchasePaymentAcc.nameAr,
            debit: 0,
            credit: grandTotal,
            memo: `استحقاق مشتريات فاتورة ${invoiceNumber}`,
            ...(purchasePaymentAcc.id === resolved.payable.id ? { entityType: 'SUPPLIER' as const, entityId: newEntityId } : {}),
          });
        }
      } else {
        // PURCHASE_RETURN
        const netPurchase = Math.max(0, grandTotal - computedVatTotal);
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
            entityType: 'SUPPLIER' as const,
            entityId: newEntityId,
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
            ...(purchasePaymentAcc.id === resolved.payable.id ? { entityType: 'SUPPLIER' as const, entityId: newEntityId } : {}),
          });
        }
        jLines.push({
          id: `jl-${jLines.length + 1}`,
          accountId: resolved.inventory.id,
          accountCode: resolved.inventory.code,
          accountNameAr: resolved.inventory.nameAr,
          debit: 0,
          credit: netPurchase,
          memo: `تخفيض المخزون لمرتجع المشتريات ${invoiceNumber}`,
        });
        if (computedVatTotal > 0) {
          jLines.push({
            id: `jl-${jLines.length + 1}`,
            accountId: resolved.vat.id,
            accountCode: resolved.vat.code,
            accountNameAr: resolved.vat.nameAr,
            debit: 0,
            credit: computedVatTotal,
            memo: `عكس ضريبة مشتريات مستردة - مرتجع ${invoiceNumber}`,
          });
        }
      }

      const entryDebit = jLines.reduce((s, l) => s + (l.debit || 0), 0);
      const entryCredit = jLines.reduce((s, l) => s + (l.credit || 0), 0);

      const journals = localDataStore.getJournals();
      let linkedJournal = journals.find(
        (j) => j.id === original.journalEntryId || j.sourceId === original.id || j.reference === original.invoiceNumber
      );

      if (linkedJournal) {
        linkedJournal.lines = jLines;
        linkedJournal.totalDebit = entryDebit;
        linkedJournal.totalCredit = entryCredit;
        linkedJournal.date = updatedInvoice.date;
        linkedJournal.description = `قيد ترحيل فاتورة ${isSales ? 'مبيعات' : 'مشتريات'} معدلة رقم (${invoiceNumber}) - ${entityNameAr}`;
        linkedJournal.status = 'POSTED';
        linkedJournal.updatedAt = new Date().toISOString();
        updatedInvoice.journalEntryId = linkedJournal.id;
      } else {
        const newJournal: JournalEntry = {
          id: 'jv-' + Math.random().toString(36).substr(2, 9),
          entryNumber: `JV-${invoiceNumber}`,
          date: updatedInvoice.date,
          reference: invoiceNumber,
          description: `قيد ترحيل فاتورة ${isSales ? 'مبيعات' : 'مشتريات'} رقم (${invoiceNumber}) - ${entityNameAr}`,
          status: 'POSTED',
          lines: jLines,
          totalDebit: entryDebit,
          totalCredit: entryCredit,
          createdAt: new Date().toISOString(),
          postedAt: new Date().toISOString(),
          isAutoGenerated: true,
          sourceModule: isSales ? 'SALES_INVOICE' : 'PURCHASE_INVOICE',
          sourceId: updatedInvoice.id,
        };
        journals.unshift(newJournal);
        updatedInvoice.journalEntryId = newJournal.id;
        linkedJournal = newJournal;
      }
      // Purge any extraneous duplicate journal entries with same reference or entryNumber
      const cleanJournals = journals.filter((j) => {
        if (j === linkedJournal) return true;
        if (invoiceNumber) {
          const numUpper = invoiceNumber.trim().toUpperCase();
          if (j.reference && j.reference.trim().toUpperCase() === numUpper) return false;
          if (j.entryNumber && j.entryNumber.trim().toUpperCase() === `JV-${numUpper}`) return false;
        }
        if (j.sourceId === updatedInvoice.id) return false;
        return true;
      });
      localDataStore.saveJournals(cleanJournals);

      if (isSupabaseConfigured && linkedJournal) {
        SupabaseDataService.saveJournal(linkedJournal).catch((err) => notifyCloudSyncError("CloudSync", err));
      }
    }

    // 4. Update the invoice in invoices list with strict deduplication
    const finalNumber = (original.invoiceNumber || data.invoiceNumber || '').trim().toUpperCase();
    const finalId = original.id;
    updatedInvoice.id = finalId;
    updatedInvoice.invoiceNumber = original.invoiceNumber || data.invoiceNumber;

    const cleanInvoices = invoices.filter((inv, idx) => {
      if (idx === originalIdx) return false;
      const num = (inv.invoiceNumber || '').trim().toUpperCase();
      if (num && finalNumber && num === finalNumber) return false;
      if (inv.id === finalId) return false;
      return true;
    });
    cleanInvoices.splice(originalIdx, 0, updatedInvoice);
    localDataStore.saveInvoices(cleanInvoices);

    // 5. Update Bank & Cash balances
    const updatedAccounts = this.syncAccountBalances();

    // 6. Persist to Supabase
    if (isSupabaseConfigured) {
      SupabaseDataService.saveInvoice(updatedInvoice).catch((e) =>
        console.warn('Supabase updateInvoice notice:', e)
      );
      SupabaseDataService.saveAccounts(updatedAccounts).catch((err) => notifyCloudSyncError("CloudSync", err));
      if (newEntityId) {
        if (isSales || isSalesReturn) {
          const c = localDataStore.getCustomers().find((x) => x.id === newEntityId);
          if (c) SupabaseDataService.saveCustomer(c).catch((err) => notifyCloudSyncError("CloudSync", err));
        } else {
          const s = localDataStore.getSuppliers().find((x) => x.id === newEntityId);
          if (s) SupabaseDataService.saveSupplier(s).catch((err) => notifyCloudSyncError("CloudSync", err));
        }
      }
      if (original.entityId && original.entityId !== newEntityId) {
        if (isSales || isSalesReturn) {
          const c = localDataStore.getCustomers().find((x) => x.id === original.entityId);
          if (c) SupabaseDataService.saveCustomer(c).catch((err) => notifyCloudSyncError("CloudSync", err));
        } else {
          const s = localDataStore.getSuppliers().find((x) => x.id === original.entityId);
          if (s) SupabaseDataService.saveSupplier(s).catch((err) => notifyCloudSyncError("CloudSync", err));
        }
      }
    }

    // 7. Background API Call
    safeApiFetch<Invoice>(`/api/invoices/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).catch((err) => notifyCloudSyncError("CloudSync", err));

    return updatedInvoice;
  }

  // Vouchers
  public static async getVouchers(): Promise<PaymentVoucher[]> {
    if (isSupabaseConfigured) {
      const fromSupabase = await SupabaseDataService.getVouchers();
      if (Array.isArray(fromSupabase)) {
        const tombstones = localDataStore.getTombstones('vouchers');
        const validSupabase = fromSupabase.filter((v) => !tombstones.has(v.id));
        localDataStore.saveVouchers(validSupabase);
        return validSupabase;
      }
    }
    const tombstones = localDataStore.getTombstones('vouchers');
    let localVouchers = localDataStore.getVouchers().filter((v) => !tombstones.has(v.id));
    const isLocked = localDataStore.isRestoreLocked();

    try {
      const fromSupabase = await SupabaseDataService.getVouchers();
      if (Array.isArray(fromSupabase)) {
        const remoteTombstoned = fromSupabase.filter((v) => tombstones.has(v.id));
        if (remoteTombstoned.length > 0 && isSupabaseConfigured) {
          Promise.all(remoteTombstoned.map((v) => SupabaseDataService.deleteVoucher(v.id))).catch((err) => notifyCloudSyncError("CloudSync", err));
        }
        const validRemote = fromSupabase.filter((v) => !tombstones.has(v.id));

        if (localVouchers.length > 0 || localDataStore.isTenantInitialized()) {
          const localById = new Map<string, PaymentVoucher>();
          const localByNumber = new Map<string, PaymentVoucher>();
          for (const v of localVouchers) {
            if (v.id) localById.set(v.id, v);
            if (v.voucherNumber) localByNumber.set(v.voucherNumber.trim().toUpperCase(), v);
          }

          let hasChanges = false;
          for (const rv of validRemote) {
            const rvNum = (rv.voucherNumber || '').trim().toUpperCase();
            const existing = (rv.id ? localById.get(rv.id) : null) || (rvNum ? localByNumber.get(rvNum) : null);
            if (!existing) {
              localVouchers.push(rv);
              if (rv.id) localById.set(rv.id, rv);
              if (rvNum) localByNumber.set(rvNum, rv);
              hasChanges = true;
            } else {
              // Existing voucher found: reconcile without creating duplicate
              const localTime = new Date(existing.createdAt || 0).getTime();
              const remoteTime = new Date(rv.createdAt || 0).getTime();
              if (remoteTime > localTime) {
                Object.assign(existing, rv);
                hasChanges = true;
              }
            }
          }
          const deduplicated = localDataStore.deduplicateVouchers(localVouchers);
          if (hasChanges || deduplicated.length !== localVouchers.length) {
            localDataStore.saveVouchers(deduplicated);
          }
          return deduplicated;
        }

        if (validRemote.length > 0) {
          const deduplicated = localDataStore.deduplicateVouchers(validRemote);
          localDataStore.saveVouchers(deduplicated);
          return deduplicated;
        }
      }
    } catch (e) {
      console.warn('Supabase getVouchers notice:', e);
    }

    return localDataStore.deduplicateVouchers(localVouchers);
  }

  /**
   * Dynamically recalculates customer balance from first principles (Opening + Invoices - Returns - Receipts + Payments + Journals)
   */
  public static recalculateCustomerBalance(customerId: string): number {
    const customers = localDataStore.getCustomers();
    const cust = customers.find((c) => c.id === customerId);
    if (!cust) return 0;

    let balance = Number(cust.openingBalance) || 0;

    // Invoices
    const invoices = localDataStore.getInvoices().filter((i) => i.entityId === customerId && i.status !== 'CANCELLED');
    for (const inv of invoices) {
      if (inv.type === 'SALES') {
        balance += Number(inv.grandTotal) || 0;
      } else if (inv.type === 'SALES_RETURN') {
        balance -= Number(inv.grandTotal) || 0;
      }
    }

    // Vouchers
    const vouchers = localDataStore.getVouchers().filter((v) => v.entityId === customerId && v.status !== 'CANCELLED');
    for (const v of vouchers) {
      if (v.type === 'RECEIPT') {
        balance -= Number(v.amount) || 0;
      } else if (v.type === 'PAYMENT') {
        balance += Number(v.amount) || 0;
      }
    }

    // Manual Journals touching this customer
    const journals = localDataStore.getJournals().filter((j) => (j.status === 'POSTED' || j.status === 'REVERSED') && !j.isAutoGenerated);
    for (const j of journals) {
      for (const line of j.lines || []) {
        if (line.entityId === customerId || (line.entityType === 'CUSTOMER' && line.entityId === customerId)) {
          balance += (Number(line.debit) || 0) - (Number(line.credit) || 0);
        }
      }
    }

    balance = Math.round(balance * 1000) / 1000;
    cust.balance = balance;
    localDataStore.saveCustomers(customers);
    if (isSupabaseConfigured) {
      SupabaseDataService.saveCustomer(cust).catch((err) => notifyCloudSyncError("CloudSync", err));
    }
    return balance;
  }

  /**
   * Dynamically recalculates supplier balance from first principles (Opening + Purchases - Returns - Payments + Receipts + Journals)
   */
  public static recalculateSupplierBalance(supplierId: string): number {
    const suppliers = localDataStore.getSuppliers();
    const sup = suppliers.find((s) => s.id === supplierId);
    if (!sup) return 0;

    let balance = Number(sup.openingBalance) || 0;

    // Invoices
    const invoices = localDataStore.getInvoices().filter((i) => i.entityId === supplierId && i.status !== 'CANCELLED');
    for (const inv of invoices) {
      if (inv.type === 'PURCHASE') {
        balance += Number(inv.grandTotal) || 0;
      } else if (inv.type === 'PURCHASE_RETURN') {
        balance -= Number(inv.grandTotal) || 0;
      }
    }

    // Vouchers
    const vouchers = localDataStore.getVouchers().filter((v) => v.entityId === supplierId && v.status !== 'CANCELLED');
    for (const v of vouchers) {
      if (v.type === 'PAYMENT') {
        balance -= Number(v.amount) || 0;
      } else if (v.type === 'RECEIPT') {
        balance += Number(v.amount) || 0;
      }
    }

    // Manual Journals touching this supplier
    const journals = localDataStore.getJournals().filter((j) => (j.status === 'POSTED' || j.status === 'REVERSED') && !j.isAutoGenerated);
    for (const j of journals) {
      for (const line of j.lines || []) {
        if (line.entityId === supplierId || (line.entityType === 'SUPPLIER' && line.entityId === supplierId)) {
          balance += (Number(line.credit) || 0) - (Number(line.debit) || 0);
        }
      }
    }

    balance = Math.round(balance * 1000) / 1000;
    sup.balance = balance;
    localDataStore.saveSuppliers(suppliers);
    if (isSupabaseConfigured) {
      SupabaseDataService.saveSupplier(sup).catch((err) => notifyCloudSyncError("CloudSync", err));
    }
    return balance;
  }

  /**
   * Recalculates dynamic Chart of Accounts balances (including Bank/Cash accounts) and saves to local store immediately.
   */
  public static syncAccountBalances(): Account[] {
    const accounts = localDataStore.getAccounts();
    const journals = localDataStore.getJournals().filter((j) => j.status === 'POSTED');
    const withBalances = this.calculateDynamicAccountBalances(accounts, journals);
    localDataStore.saveAccounts(withBalances);
    return withBalances;
  }

  /**
   * Enterprise-Grade Double-Entry Voucher-to-Ledger Synchronization
   * Ensures every active receipt and payment voucher has a matching, balanced double-entry journal entry,
   * updates the Chart of Accounts dynamic balances (Bank/Cash accounts), and recalculates Customer/Supplier balances.
   */
  public static async syncVouchersWithJournals(targetJournals?: JournalEntry[]): Promise<{
    journalsCount: number;
    accountsUpdated: number;
    vouchersSynced: number;
  }> {
    const vouchers = localDataStore.getVouchers();
    const journals = targetJournals || localDataStore.getJournals();
    const accounts = localDataStore.getAccounts();
    const customers = localDataStore.getCustomers();
    const suppliers = localDataStore.getSuppliers();
    const resolved = this.getResolvedAccounts();

    let vouchersSynced = 0;
    let journalsChanged = false;
    const syncedJournalEntries: JournalEntry[] = [];

    const journalMap = new Map<string, JournalEntry>();
    for (const j of journals) {
      if (j.id) journalMap.set(j.id, j);
      if (j.sourceId) journalMap.set(j.sourceId, j);
      if (j.reference) journalMap.set(j.reference, j);
      if (j.entryNumber) journalMap.set(j.entryNumber, j);
    }

    for (const v of vouchers) {
      const isReceipt = v.type === 'RECEIPT';
      const amount = Number(v.amount) || 0;
      if (amount <= 0 && v.status !== 'CANCELLED') continue;

      const voucherNum = v.voucherNumber || v.id;
      const jvNum = `JV-${voucherNum}`;

      let entityNameAr = v.entityNameAr || '';
      if (!entityNameAr && v.entityId) {
        if (isReceipt) {
          const c = customers.find((x) => x.id === v.entityId);
          if (c) entityNameAr = c.nameAr;
        } else {
          const s = suppliers.find((x) => x.id === v.entityId);
          if (s) entityNameAr = s.nameAr;
        }
      }

      // Resolve liquid account (Bank or Cash)
      const targetBankAccId = v.bankAccountId || (v.paymentMethod === 'CASH' ? resolved.cash.id : resolved.bank.id);
      let liquidAcc = accounts.find((a) => a.id === targetBankAccId || a.code === targetBankAccId);
      if (!liquidAcc) {
        if (v.paymentMethod === 'CASH') {
          liquidAcc = accounts.find((a) => a.code === '1113' || a.nameAr.includes('صندوق') || a.nameAr.includes('خزينة')) || resolved.cash;
        } else {
          liquidAcc = accounts.find((a) => a.code === '1111' || a.code === '1112' || a.nameAr.includes('بنك') || a.nameAr.includes('تمويل') || a.nameAr.includes('مصرف')) || resolved.bank;
        }
      }

      const existingJ = (v.journalEntryId && journalMap.get(v.journalEntryId)) ||
        journalMap.get(v.id) ||
        journalMap.get(voucherNum) ||
        journalMap.get(jvNum);

      if (v.status === 'CANCELLED') {
        if (existingJ && existingJ.status !== 'CANCELLED') {
          existingJ.status = 'CANCELLED';
          existingJ.updatedAt = new Date().toISOString();
          journalsChanged = true;
          syncedJournalEntries.push(existingJ);
        }
        continue;
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
              memo: `قبض مبالغ سند رقم ${voucherNum} - ${entityNameAr}`,
            },
            {
              id: 'jl-2',
              accountId: resolved.receivable.id,
              accountCode: resolved.receivable.code,
              accountNameAr: resolved.receivable.nameAr,
              debit: 0,
              credit: amount,
              memo: `تحصيل من العميل ${entityNameAr}`,
              entityType: 'CUSTOMER' as const,
              entityId: v.entityId || '',
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
              entityType: 'SUPPLIER' as const,
              entityId: v.entityId || '',
            },
            {
              id: 'jl-2',
              accountId: liquidAcc.id,
              accountCode: liquidAcc.code,
              accountNameAr: liquidAcc.nameAr,
              debit: 0,
              credit: amount,
              memo: `صرف مبالغ سند رقم ${voucherNum} - ${entityNameAr}`,
            },
          ];

      if (existingJ) {
        const needsUpdate =
          existingJ.status !== 'POSTED' ||
          existingJ.totalDebit !== amount ||
          existingJ.totalCredit !== amount ||
          !existingJ.lines ||
          existingJ.lines.length < 2;

        if (needsUpdate) {
          existingJ.status = 'POSTED';
          existingJ.date = v.date || existingJ.date;
          existingJ.lines = jLines;
          existingJ.totalDebit = amount;
          existingJ.totalCredit = amount;
          existingJ.updatedAt = new Date().toISOString();
          journalsChanged = true;
          syncedJournalEntries.push(existingJ);
        }
        v.journalEntryId = existingJ.id;
      } else {
        const newJ: JournalEntry = {
          id: 'jv-' + (v.id.startsWith('v-') || v.id.startsWith('pv-') ? v.id : 'vch-' + voucherNum),
          entryNumber: jvNum,
          date: v.date || new Date().toISOString().split('T')[0],
          reference: voucherNum,
          description: `قيد ترحيل سند ${isReceipt ? 'قبض' : 'صرف'} رقم (${voucherNum}) - ${entityNameAr}`,
          status: 'POSTED',
          lines: jLines,
          totalDebit: amount,
          totalCredit: amount,
          createdAt: v.createdAt || new Date().toISOString(),
          postedAt: v.createdAt || new Date().toISOString(),
          isAutoGenerated: true,
          sourceModule: v.type,
          sourceId: v.id,
        };

        journals.unshift(newJ);
        journalMap.set(newJ.id, newJ);
        journalMap.set(v.id, newJ);
        journalMap.set(voucherNum, newJ);
        journalMap.set(jvNum, newJ);
        v.journalEntryId = newJ.id;
        journalsChanged = true;
        vouchersSynced++;
        syncedJournalEntries.push(newJ);
      }
    }

    if (journalsChanged || vouchersSynced > 0) {
      localDataStore.saveJournals(journals);
      localDataStore.saveVouchers(vouchers);
    }

    // Recalculate dynamic account balances with all posted journals
    const postedJournals = journals.filter((j) => j.status === 'POSTED');
    const updatedAccounts = this.calculateDynamicAccountBalances(accounts, postedJournals);
    localDataStore.saveAccounts(updatedAccounts);

    // Recalculate all customer & supplier balances
    for (const cust of customers) {
      this.recalculateCustomerBalance(cust.id);
    }
    for (const supp of suppliers) {
      this.recalculateSupplierBalance(supp.id);
    }

    // Persist to Supabase if configured
    if (isSupabaseConfigured) {
      try {
        if (syncedJournalEntries.length > 0) {
          await SupabaseDataService.saveJournals(syncedJournalEntries);
        }
        await SupabaseDataService.saveAccounts(updatedAccounts);
        await SupabaseDataService.saveCustomers(localDataStore.getCustomers());
        await SupabaseDataService.saveSuppliers(localDataStore.getSuppliers());
        await SupabaseDataService.syncAllVouchersToLedgerRemote();
      } catch (err) {
        console.warn('Supabase sync warning in syncVouchersWithJournals:', err);
      }
    }

    return {
      journalsCount: journals.length,
      accountsUpdated: updatedAccounts.length,
      vouchersSynced,
    };
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
      if (c) entityNameAr = c.nameAr;
    } else if (!isReceipt && data.entityId) {
      const s = suppliers.find((x) => x.id === data.entityId);
      if (s) entityNameAr = s.nameAr;
    }

    if (data.invoiceId) {
      const inv = invoices.find((i) => i.id === data.invoiceId);
      if (inv) {
        inv.paidAmount = (inv.paidAmount || 0) + amount;
        inv.dueAmount = Math.max(0, inv.grandTotal - inv.paidAmount);
        if (inv.dueAmount <= 0) {
          inv.paymentStatus = 'PAID';
          if (inv.status !== 'CANCELLED') inv.status = 'POSTED';
        } else {
          inv.paymentStatus = 'PARTIALLY_PAID';
          if (inv.status !== 'CANCELLED') inv.status = 'POSTED';
        }
        localDataStore.saveInvoices(invoices);
        if (isSupabaseConfigured) {
          SupabaseDataService.saveInvoice(inv).catch((err) => notifyCloudSyncError("CloudSync", err));
        }
      }
    }

    const resolved = this.getResolvedAccounts();
    const accounts = localDataStore.getAccounts();
    const targetBankAccId = data.bankAccountId || (data.paymentMethod === 'CASH' ? resolved.cash.id : resolved.bank.id);
    let liquidAcc = accounts.find((a) => a.id === targetBankAccId || a.code === targetBankAccId) ||
      (data.paymentMethod === 'CASH' ? resolved.cash : resolved.bank);

    const newVoucher: PaymentVoucher = {
      id: 'vch-' + Math.random().toString(36).substr(2, 9),
      voucherNumber,
      type: data.type || 'RECEIPT',
      date: data.date || new Date().toISOString().split('T')[0],
      amount,
      paymentMethod: data.paymentMethod === 'CASH' ? 'CASH' : 'BANK',
      bankAccountId: liquidAcc.id,
      entityType: data.entityType || (isReceipt ? 'CUSTOMER' : 'SUPPLIER'),
      entityId: data.entityId || '',
      entityNameAr,
      invoiceId: data.invoiceId,
      salesRepId: data.salesRepId || undefined,
      salesRepName: data.salesRepName || undefined,
      reference: data.reference || data.referenceNumber || '',
      notes: data.notes || '',
      createdAt: new Date().toISOString(),
    };

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
            entityType: 'CUSTOMER' as const,
            entityId: newVoucher.entityId,
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
            entityType: 'SUPPLIER' as const,
            entityId: newVoucher.entityId,
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

    newVoucher.journalEntryId = jEntry.id;
    localDataStore.removeTombstone('vouchers', newVoucher.id);
    localDataStore.removeTombstone('journals', jEntry.id);
    vouchers.unshift(newVoucher);
    localDataStore.saveVouchers(vouchers);

    // Recalculate customer/supplier balance from first principles
    if (isReceipt && newVoucher.entityId) {
      this.recalculateCustomerBalance(newVoucher.entityId);
    } else if (!isReceipt && newVoucher.entityId) {
      this.recalculateSupplierBalance(newVoucher.entityId);
    }

    // Immediately sync and update Bank/Cash account balances in local store!
    const updatedAccounts = this.syncAccountBalances();

    // High-Performance Optimistic UI: Background Non-Blocking Persistence
    const activeCompanyId = localDataStore.getEffectiveCompanyId() || 'default';
    backgroundSync.enqueueVoucherCreate(newVoucher, data, activeCompanyId);

    if (isSupabaseConfigured) {
      SupabaseDataService.saveVoucher(newVoucher).catch((err) => notifyCloudSyncError("CloudSync", err));
      SupabaseDataService.saveJournal(jEntry).catch((err) => notifyCloudSyncError("CloudSync", err));
      SupabaseDataService.saveAccounts(updatedAccounts).catch((err) => notifyCloudSyncError("CloudSync", err));
      if (isReceipt && newVoucher.entityId) {
        const c = localDataStore.getCustomers().find((x) => x.id === newVoucher.entityId);
        if (c) SupabaseDataService.saveCustomer(c).catch((err) => notifyCloudSyncError("CloudSync", err));
      } else if (!isReceipt && newVoucher.entityId) {
        const s = localDataStore.getSuppliers().find((x) => x.id === newVoucher.entityId);
        if (s) SupabaseDataService.saveSupplier(s).catch((err) => notifyCloudSyncError("CloudSync", err));
      }
    }

    safeApiFetch('/api/vouchers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newVoucher),
    }).catch((err) => notifyCloudSyncError("CloudSync", err));

    return newVoucher;
  }

  public static async cancelVoucher(id: string, reason: string): Promise<PaymentVoucher | null> {
    const vouchers = localDataStore.getVouchers();
    const v = vouchers.find((x) => x.id === id);
    if (!v) return null;
    if (v.status === 'CANCELLED') return v;

    // 1. Cancel associated journal entry
    const journals = localDataStore.getJournals();
    const j = journals.find((item) => item.id === v.journalEntryId || item.sourceId === id);
    if (j) {
      j.status = 'CANCELLED';
      localDataStore.saveJournals(journals);
    }

    // 2. Revert invoice if linked
    if (v.invoiceId) {
      const invoices = localDataStore.getInvoices();
      const inv = invoices.find((i) => i.id === v.invoiceId);
      if (inv) {
        inv.paidAmount = Math.max(0, (inv.paidAmount || 0) - v.amount);
        inv.dueAmount = Math.max(0, inv.grandTotal - inv.paidAmount);
        inv.status = inv.dueAmount === 0 ? 'PAID' : (inv.paidAmount > 0 ? 'PARTIALLY_PAID' : 'POSTED');
        localDataStore.saveInvoices(invoices);
      }
    }

    // 3. Mark voucher cancelled
    v.status = 'CANCELLED';
    v.notes = (v.notes ? v.notes + '\n' : '') + `[ملغى بتاريخ ${new Date().toISOString().split('T')[0]}: ${reason}]`;
    localDataStore.saveVouchers(vouchers);

    // 4. Recalculate entity balance
    if (v.entityType === 'CUSTOMER' && v.entityId) {
      this.recalculateCustomerBalance(v.entityId);
    } else if (v.entityId) {
      this.recalculateSupplierBalance(v.entityId);
    }

    // 5. Instantly restore Bank/Cash balances
    const updatedAccounts = this.syncAccountBalances();

    const activeCompanyId = localDataStore.getEffectiveCompanyId() || 'default';
    backgroundSync.enqueueVoucherCancel(v, reason, activeCompanyId);

    if (isSupabaseConfigured) {
      SupabaseDataService.saveVoucher(v).catch((err) => notifyCloudSyncError("CloudSync", err));
      if (j) SupabaseDataService.saveJournal(j).catch((err) => notifyCloudSyncError("CloudSync", err));
      SupabaseDataService.saveAccounts(updatedAccounts).catch((err) => notifyCloudSyncError("CloudSync", err));
      if (v.entityType === 'CUSTOMER' && v.entityId) {
        const c = localDataStore.getCustomers().find((x) => x.id === v.entityId);
        if (c) SupabaseDataService.saveCustomer(c).catch((err) => notifyCloudSyncError("CloudSync", err));
      } else if (v.entityId) {
        const s = localDataStore.getSuppliers().find((x) => x.id === v.entityId);
        if (s) SupabaseDataService.saveSupplier(s).catch((err) => notifyCloudSyncError("CloudSync", err));
      }
    }

    safeApiFetch<PaymentVoucher>(`/api/vouchers/${id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    }).catch((err) => notifyCloudSyncError("CloudSync", err));

    return v;
  }

  public static async updateVoucher(id: string, data: any): Promise<PaymentVoucher | null> {
    localDataStore.removeTombstone('vouchers', id);
    const vouchers = localDataStore.getVouchers();
    const targetVoucherNumber = (data.voucherNumber || '').trim().toUpperCase();
    let idx = vouchers.findIndex((x) => x.id === id);
    if (idx === -1 && targetVoucherNumber) {
      idx = vouchers.findIndex((x) => x.voucherNumber && x.voucherNumber.trim().toUpperCase() === targetVoucherNumber);
    }
    if (idx === -1) return null;

    const original = { ...vouchers[idx] };
    const oldAmount = Number(original.amount) || 0;
    const newAmount = data.amount !== undefined ? Number(data.amount) : oldAmount;
    const oldInvoiceId = original.invoiceId;
    const newInvoiceId = data.invoiceId !== undefined ? data.invoiceId : oldInvoiceId;
    const oldEntityId = original.entityId;
    const newEntityId = data.entityId || oldEntityId;
    const oldEntityType = original.entityType;
    const isReceipt = (data.type || original.type) === 'RECEIPT';

    // 1. Reconcile invoices
    const invoices = localDataStore.getInvoices();
    if (oldInvoiceId && oldInvoiceId !== newInvoiceId) {
      const oldInv = invoices.find((i) => i.id === oldInvoiceId);
      if (oldInv) {
        oldInv.paidAmount = Math.max(0, (oldInv.paidAmount || 0) - oldAmount);
        oldInv.dueAmount = Math.max(0, oldInv.grandTotal - oldInv.paidAmount);
        oldInv.status = oldInv.dueAmount === 0 ? 'PAID' : (oldInv.paidAmount > 0 ? 'PARTIALLY_PAID' : 'POSTED');
      }
      if (newInvoiceId) {
        const newInv = invoices.find((i) => i.id === newInvoiceId);
        if (newInv) {
          newInv.paidAmount = (newInv.paidAmount || 0) + newAmount;
          newInv.dueAmount = Math.max(0, newInv.grandTotal - newInv.paidAmount);
          newInv.status = newInv.dueAmount === 0 ? 'PAID' : (newInv.paidAmount > 0 ? 'PARTIALLY_PAID' : 'POSTED');
        }
      }
      localDataStore.saveInvoices(invoices);
    } else if (newInvoiceId) {
      const inv = invoices.find((i) => i.id === newInvoiceId);
      if (inv) {
        const delta = newAmount - oldAmount;
        inv.paidAmount = Math.max(0, (inv.paidAmount || 0) + delta);
        inv.dueAmount = Math.max(0, inv.grandTotal - inv.paidAmount);
        inv.status = inv.dueAmount === 0 ? 'PAID' : (inv.paidAmount > 0 ? 'PARTIALLY_PAID' : 'POSTED');
        localDataStore.saveInvoices(invoices);
      }
    }

    // 2. Resolve target Bank/Cash account
    const resolved = this.getResolvedAccounts();
    const accounts = localDataStore.getAccounts();
    const targetBankAccId = data.bankAccountId || original.bankAccountId || (original.paymentMethod === 'CASH' ? resolved.cash.id : resolved.bank.id);
    const liquidAcc = accounts.find((a) => a.id === targetBankAccId || a.code === targetBankAccId) ||
      ((data.paymentMethod || original.paymentMethod) === 'CASH' ? resolved.cash : resolved.bank);

    // Resolve entity name
    let entityNameAr = data.entityNameAr || original.entityNameAr || '';
    if (newEntityId && newEntityId !== oldEntityId) {
      if (isReceipt) {
        const cust = localDataStore.getCustomers().find((c) => c.id === newEntityId);
        if (cust) entityNameAr = cust.nameAr;
      } else {
        const sup = localDataStore.getSuppliers().find((s) => s.id === newEntityId);
        if (sup) entityNameAr = sup.nameAr;
      }
    }

    // 3. Update Voucher object with strict deduplication
    const finalVoucherNumber = original.voucherNumber || data.voucherNumber;
    const finalId = original.id;
    const updatedVoucher: PaymentVoucher = {
      ...original,
      ...data,
      id: finalId,
      voucherNumber: finalVoucherNumber,
      amount: newAmount,
      bankAccountId: liquidAcc.id,
      entityNameAr,
      entityId: newEntityId,
    };
    const cleanVouchers = vouchers.filter((v, vIdx) => {
      if (vIdx === idx) return false;
      const num = (v.voucherNumber || '').trim().toUpperCase();
      if (num && finalVoucherNumber && num === finalVoucherNumber.trim().toUpperCase()) return false;
      if (v.id === finalId) return false;
      return true;
    });
    cleanVouchers.splice(idx, 0, updatedVoucher);
    localDataStore.saveVouchers(cleanVouchers);

    // 4. Update Journal Entry with double-entry integrity
    const journals = localDataStore.getJournals();
    let linkedJournal: JournalEntry | null = null;
    const jIdx = journals.findIndex((j) => 
      j.id === original.journalEntryId || 
      j.sourceId === finalId ||
      (j.reference && finalVoucherNumber && j.reference.trim().toUpperCase() === finalVoucherNumber.trim().toUpperCase()) ||
      (j.entryNumber && finalVoucherNumber && j.entryNumber.trim().toUpperCase() === `JV-${finalVoucherNumber.trim().toUpperCase()}`)
    );

    const jLines = isReceipt
      ? [
          {
            id: 'jl-1',
            accountId: liquidAcc.id,
            accountCode: liquidAcc.code,
            accountNameAr: liquidAcc.nameAr,
            debit: newAmount,
            credit: 0,
            memo: `قبض مبالغ سند معدل رقم ${updatedVoucher.voucherNumber} - ${entityNameAr}`,
          },
          {
            id: 'jl-2',
            accountId: resolved.receivable.id,
            accountCode: resolved.receivable.code,
            accountNameAr: resolved.receivable.nameAr,
            debit: 0,
            credit: newAmount,
            memo: `تحصيل من العميل ${entityNameAr}`,
            entityType: 'CUSTOMER' as const,
            entityId: newEntityId,
          },
        ]
      : [
          {
            id: 'jl-1',
            accountId: resolved.payable.id,
            accountCode: resolved.payable.code,
            accountNameAr: resolved.payable.nameAr,
            debit: newAmount,
            credit: 0,
            memo: `سداد للمورد ${entityNameAr}`,
            entityType: 'SUPPLIER' as const,
            entityId: newEntityId,
          },
          {
            id: 'jl-2',
            accountId: liquidAcc.id,
            accountCode: liquidAcc.code,
            accountNameAr: liquidAcc.nameAr,
            debit: 0,
            credit: newAmount,
            memo: `صرف مبالغ سند معدل رقم ${updatedVoucher.voucherNumber} - ${entityNameAr}`,
          },
        ];

    if (jIdx !== -1) {
      journals[jIdx] = {
        ...journals[jIdx],
        date: updatedVoucher.date,
        description: `قيد ترحيل سند معدل ${isReceipt ? 'قبض' : 'صرف'} رقم (${updatedVoucher.voucherNumber}) - ${entityNameAr}`,
        lines: jLines,
        totalDebit: newAmount,
        totalCredit: newAmount,
        status: 'POSTED',
      };
      linkedJournal = journals[jIdx];
    } else {
      const newJ: JournalEntry = {
        id: 'jv-' + Math.random().toString(36).substr(2, 9),
        entryNumber: `JV-${updatedVoucher.voucherNumber}`,
        date: updatedVoucher.date,
        reference: updatedVoucher.voucherNumber,
        description: `قيد ترحيل سند معدل ${isReceipt ? 'قبض' : 'صرف'} رقم (${updatedVoucher.voucherNumber}) - ${entityNameAr}`,
        status: 'POSTED',
        lines: jLines,
        totalDebit: newAmount,
        totalCredit: newAmount,
        createdAt: new Date().toISOString(),
        postedAt: new Date().toISOString(),
        isAutoGenerated: true,
        sourceModule: isReceipt ? 'RECEIPT' : 'PAYMENT',
        sourceId: updatedVoucher.id,
      };
      journals.unshift(newJ);
      updatedVoucher.journalEntryId = newJ.id;
      linkedJournal = newJ;
    }
    // Purge duplicate journal entries
    const cleanJournals = journals.filter((j) => {
      if (j === linkedJournal || (jIdx !== -1 && j === journals[jIdx])) return true;
      if (finalVoucherNumber) {
        const numUpper = finalVoucherNumber.trim().toUpperCase();
        if (j.reference && j.reference.trim().toUpperCase() === numUpper) return false;
        if (j.entryNumber && j.entryNumber.trim().toUpperCase() === `JV-${numUpper}`) return false;
      }
      if (j.sourceId === finalId) return false;
      return true;
    });
    localDataStore.saveJournals(cleanJournals);

    // 5. Recalculate customer / supplier balances
    if (oldEntityId && oldEntityId !== newEntityId) {
      if (oldEntityType === 'CUSTOMER') {
        this.recalculateCustomerBalance(oldEntityId);
      } else {
        this.recalculateSupplierBalance(oldEntityId);
      }
    }
    if (isReceipt && newEntityId) {
      this.recalculateCustomerBalance(newEntityId);
    } else if (newEntityId) {
      this.recalculateSupplierBalance(newEntityId);
    }

    // 6. Instantly update dynamic Bank / Cash account balances in local store!
    const updatedAccounts = this.syncAccountBalances();

    // 7. Background sync & API call
    if (isSupabaseConfigured) {
      SupabaseDataService.saveVoucher(updatedVoucher).catch((err) => notifyCloudSyncError("CloudSync", err));
      const updatedJournal = journals.find((j) => j.id === updatedVoucher.journalEntryId);
      if (updatedJournal) {
        SupabaseDataService.saveJournal(updatedJournal).catch((err) => notifyCloudSyncError("CloudSync", err));
      }
      SupabaseDataService.saveAccounts(updatedAccounts).catch((err) => notifyCloudSyncError("CloudSync", err));
      if (oldEntityId) {
        if (oldEntityType === 'CUSTOMER') {
          const c = localDataStore.getCustomers().find((x) => x.id === oldEntityId);
          if (c) SupabaseDataService.saveCustomer(c).catch((err) => notifyCloudSyncError("CloudSync", err));
        } else {
          const s = localDataStore.getSuppliers().find((x) => x.id === oldEntityId);
          if (s) SupabaseDataService.saveSupplier(s).catch((err) => notifyCloudSyncError("CloudSync", err));
        }
      }
      if (newEntityId && newEntityId !== oldEntityId) {
        if (isReceipt) {
          const c = localDataStore.getCustomers().find((x) => x.id === newEntityId);
          if (c) SupabaseDataService.saveCustomer(c).catch((err) => notifyCloudSyncError("CloudSync", err));
        } else {
          const s = localDataStore.getSuppliers().find((x) => x.id === newEntityId);
          if (s) SupabaseDataService.saveSupplier(s).catch((err) => notifyCloudSyncError("CloudSync", err));
        }
      }
    }

    safeApiFetch<PaymentVoucher>(`/api/vouchers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).catch((err) => notifyCloudSyncError("CloudSync", err));

    return updatedVoucher;
  }

  public static async deleteVoucher(id: string): Promise<boolean> {
    localDataStore.addTombstone('vouchers', id);
    const vouchers = localDataStore.getVouchers();
    const v = vouchers.find((x) => x.id === id);
    if (v) {
      // Revert invoice
      if (v.invoiceId) {
        const invoices = localDataStore.getInvoices();
        const inv = invoices.find((i) => i.id === v.invoiceId);
        if (inv) {
          inv.paidAmount = Math.max(0, (inv.paidAmount || 0) - v.amount);
          inv.dueAmount = Math.max(0, inv.grandTotal - inv.paidAmount);
          inv.status = inv.dueAmount === 0 ? 'PAID' : (inv.paidAmount > 0 ? 'PARTIALLY_PAID' : 'POSTED');
          localDataStore.saveInvoices(invoices);
        }
      }

      // Cancel or tombstone journal
      if (v.journalEntryId) {
        const journals = localDataStore.getJournals();
        const j = journals.find((item) => item.id === v.journalEntryId || item.sourceId === id);
        if (j) {
          j.status = 'CANCELLED';
          localDataStore.saveJournals(journals);
        }
        localDataStore.addTombstone('journals', v.journalEntryId);
      }

      // Recalculate entity
      if (v.entityType === 'CUSTOMER' && v.entityId) {
        this.recalculateCustomerBalance(v.entityId);
      } else if (v.entityId) {
        this.recalculateSupplierBalance(v.entityId);
      }
    }

    const filtered = vouchers.filter((x) => x.id !== id);
    localDataStore.saveVouchers(filtered);

    // Sync bank balances
    this.syncAccountBalances();

    if (isSupabaseConfigured) {
      SupabaseDataService.deleteVoucher(id).catch((err) =>
        console.warn('Supabase deleteVoucher notice:', err)
      );
    }
    safeApiFetch(`/api/vouchers/${id}`, { method: 'DELETE' }).catch((err) => notifyCloudSyncError("CloudSync", err));
    return true;
  }

  // Customers & Suppliers
  public static async getCustomers(): Promise<Customer[]> {
    if (isSupabaseConfigured) {
      const fromSupabase = await SupabaseDataService.getCustomers();
      if (Array.isArray(fromSupabase)) {
        const tombstones = localDataStore.getTombstones('customers');
        const validSupabase = fromSupabase.filter((c) => !tombstones.has(c.id));
        localDataStore.saveCustomers(validSupabase);
        const compId = localDataStore.getEffectiveCompanyId() || 'default';
        cacheService.setCustomers(compId, validSupabase);
        return validSupabase;
      }
    }
    const compId = localDataStore.getEffectiveCompanyId() || 'default';
    const tombstones = localDataStore.getTombstones('customers');
    const cached = cacheService.getCustomers(compId);
    if (cached && cached.length > 0) {
      const filteredCached = cached.filter((c) => !tombstones.has(c.id));
      if (filteredCached.length !== cached.length) {
        cacheService.setCustomers(compId, filteredCached);
      }
      return filteredCached;
    }

    let localCustomers = localDataStore.getCustomers().filter((c) => !tombstones.has(c.id));
    if (localCustomers.length > 0) {
      cacheService.setCustomers(compId, localCustomers);
    }
    const isLocked = localDataStore.isRestoreLocked();

    const fetchRemote = async () => {
      try {
        const fromSupabase = await SupabaseDataService.getCustomers();
        if (Array.isArray(fromSupabase)) {
          const remoteTombstoned = fromSupabase.filter((c) => tombstones.has(c.id));
          if (remoteTombstoned.length > 0 && isSupabaseConfigured) {
            Promise.all(remoteTombstoned.map((c) => SupabaseDataService.deleteCustomer(c.id))).catch((err) => notifyCloudSyncError("CloudSync", err));
          }
          const validRemote = fromSupabase.filter((c) => !tombstones.has(c.id));

          if (localCustomers.length > 0 || localDataStore.isTenantInitialized()) {
            const localMap = new Map<string, Customer>();
            for (const c of localCustomers) {
              if (c.id) localMap.set(`ID_${c.id}`, c);
              if (c.nameAr) localMap.set(`NAME_${c.nameAr.trim().replace(/\s+/g, ' ')}`, c);
              if (c.phone && c.phone.trim().length > 5) localMap.set(`PHONE_${c.phone.trim()}`, c);
            }
            let hasNew = false;
            for (const rc of validRemote) {
              const rName = rc.nameAr ? `NAME_${rc.nameAr.trim().replace(/\s+/g, ' ')}` : '';
              const rPhone = rc.phone && rc.phone.trim().length > 5 ? `PHONE_${rc.phone.trim()}` : '';
              const existing = (rc.id ? localMap.get(`ID_${rc.id}`) : null) ||
                               (rName ? localMap.get(rName) : null) ||
                               (rPhone ? localMap.get(rPhone) : null);
              if (!existing) {
                localCustomers.push(rc);
                if (rc.id) localMap.set(`ID_${rc.id}`, rc);
                if (rName) localMap.set(rName, rc);
                if (rPhone) localMap.set(rPhone, rc);
                hasNew = true;
              } else {
                Object.assign(existing, rc);
                hasNew = true;
              }
            }
            if (hasNew) {
              const deduped = localDataStore.deduplicateCustomers(localCustomers);
              localDataStore.saveCustomers(deduped);
              cacheService.setCustomers(compId, deduped);
              return deduped;
            }
            return localCustomers;
          }

          if (validRemote.length > 0) {
            localDataStore.saveCustomers(validRemote);
            cacheService.setCustomers(compId, validRemote);
            return validRemote;
          }
        }
      } catch (e) {
        console.warn('Supabase getCustomers notice:', e);
      }
      return localCustomers;
    };

    if (localCustomers.length > 0) {
      fetchRemote().catch((err) => notifyCloudSyncError("CloudSync", err));
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
    localDataStore.removeTombstone('customers', newCust.id);
    list.push(newCust);
    localDataStore.saveCustomers(list);
    const compId = localDataStore.getEffectiveCompanyId() || 'default';
    cacheService.setCustomers(compId, list);
    try {
      await SupabaseDataService.saveCustomer(newCust);
    } catch (e) {
      console.warn('Supabase saveCustomer notice:', e);
    }

    // [ARCHITECT] Automated Balanced GL Opening Entry Generation
    if (newCust.openingBalance && Number(newCust.openingBalance) > 0) {
      const openAmount = Number(newCust.openingBalance);
      const resolved = this.getResolvedAccounts();
      const equityAcc = (resolved as any).retainedEarnings || (resolved as any).capital || { id: 'acc-3200', code: '3200', nameAr: 'الأرباح المرحلة / الأرصدة الافتتاحية' };
      const jEntry: JournalEntry = {
        id: 'jv-' + Math.random().toString(36).substr(2, 9),
        entryNumber: `JV-OP-CUST-${newCust.id.slice(-4)}`,
        date: newCust.openingBalanceDate || new Date().toISOString().split('T')[0],
        reference: `OP-${newCust.nameAr}`,
        description: `قيد رصيد أول المدة الافتتاحي للعميل (${newCust.nameAr})`,
        status: 'POSTED',
        lines: [
          {
            id: 'jl-1',
            accountId: resolved.receivable.id,
            accountCode: resolved.receivable.code,
            accountNameAr: resolved.receivable.nameAr,
            debit: openAmount,
            credit: 0,
            memo: `رصيد أول المدة للعميل ${newCust.nameAr}`,
            entityType: 'CUSTOMER',
            entityId: newCust.id,
          },
          {
            id: 'jl-2',
            accountId: equityAcc.id,
            accountCode: equityAcc.code,
            accountNameAr: equityAcc.nameAr,
            debit: 0,
            credit: openAmount,
            memo: `حقوق الملكية / أرصدة افتتاحية - ${newCust.nameAr}`,
          },
        ],
        totalDebit: openAmount,
        totalCredit: openAmount,
        createdAt: new Date().toISOString(),
        postedAt: new Date().toISOString(),
        isAutoGenerated: true,
        sourceModule: 'CUSTOMER_OPENING_BALANCE' as any,
        sourceId: newCust.id,
      };
      const journals = localDataStore.getJournals();
      journals.unshift(jEntry);
      localDataStore.saveJournals(journals);
    }

    await safeApiFetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return newCust;
  }

  public static async updateCustomer(id: string, data: any): Promise<Customer | null> {
    localDataStore.removeTombstone('customers', id);
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

    if (diff !== 0) {
      const resolved = this.getResolvedAccounts();
      const accounts = localDataStore.getAccounts();
      const equityAcc = accounts.find((a) => a.code === '3100' || a.category === 'EQUITY') || {
        id: 'acc-equity-01',
        code: '3100',
        nameAr: 'رأس المال والاحتياطيات',
      };
      const journals = localDataStore.getJournals();
      const existingJ = journals.find((j) => (j.sourceModule as string) === 'CUSTOMER_OPENING_BALANCE' && j.sourceId === id);

      if (newOpening > 0) {
        if (existingJ) {
          existingJ.lines = [
            {
              id: 'jl-1',
              accountId: resolved.receivable.id,
              accountCode: resolved.receivable.code,
              accountNameAr: resolved.receivable.nameAr,
              debit: newOpening,
              credit: 0,
              memo: `رصيد أول المدة - ${list[idx].nameAr}`,
              entityType: 'CUSTOMER',
              entityId: id,
            },
            {
              id: 'jl-2',
              accountId: equityAcc.id,
              accountCode: equityAcc.code,
              accountNameAr: equityAcc.nameAr,
              debit: 0,
              credit: newOpening,
              memo: `حقوق الملكية / أرصدة افتتاحية - ${list[idx].nameAr}`,
            },
          ];
          existingJ.totalDebit = newOpening;
          existingJ.totalCredit = newOpening;
          existingJ.status = 'POSTED';
        } else {
          const jEntry: JournalEntry = {
            id: 'jv-cust-op-' + Math.random().toString(36).substr(2, 9),
            entryNumber: `JV-OP-CUST-${list[idx].code || id.slice(-4)}`,
            date: list[idx].openingBalanceDate || '2026-07-01',
            reference: `OP-${list[idx].code || id.slice(-4)}`,
            description: `قيد رصيد افتتاحي للعميل (${list[idx].nameAr})`,
            status: 'POSTED',
            lines: [
              {
                id: 'jl-1',
                accountId: resolved.receivable.id,
                accountCode: resolved.receivable.code,
                accountNameAr: resolved.receivable.nameAr,
                debit: newOpening,
                credit: 0,
                memo: `رصيد أول المدة - ${list[idx].nameAr}`,
                entityType: 'CUSTOMER',
                entityId: id,
              },
              {
                id: 'jl-2',
                accountId: equityAcc.id,
                accountCode: equityAcc.code,
                accountNameAr: equityAcc.nameAr,
                debit: 0,
                credit: newOpening,
                memo: `حقوق الملكية / أرصدة افتتاحية - ${list[idx].nameAr}`,
              },
            ],
            totalDebit: newOpening,
            totalCredit: newOpening,
            createdAt: new Date().toISOString(),
            postedAt: new Date().toISOString(),
            isAutoGenerated: true,
            sourceModule: 'CUSTOMER_OPENING_BALANCE' as any,
            sourceId: id,
          };
          journals.unshift(jEntry);
        }
      } else if (existingJ) {
        existingJ.status = 'CANCELLED';
      }
      localDataStore.saveJournals(journals);
      this.recalculateCustomerBalance(id);
    }
    const compId = localDataStore.getEffectiveCompanyId() || 'default';
    cacheService.setCustomers(compId, list);
    try {
      await SupabaseDataService.saveCustomer(list[idx]);
    } catch (e) {
      console.warn('Supabase updateCustomer notice:', e);
    }
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
    localDataStore.addTombstone('customers', id);
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
    await safeApiFetch(`/api/customers/${id}`, { method: 'DELETE' });
    return true;
  }

  public static async getSuppliers(): Promise<Supplier[]> {
    if (isSupabaseConfigured) {
      const fromSupabase = await SupabaseDataService.getSuppliers();
      if (Array.isArray(fromSupabase)) {
        const tombstones = localDataStore.getTombstones('suppliers');
        const validSupabase = fromSupabase.filter((s) => !tombstones.has(s.id));
        localDataStore.saveSuppliers(validSupabase);
        const compId = localDataStore.getEffectiveCompanyId() || 'default';
        cacheService.setSuppliers(compId, validSupabase);
        return validSupabase;
      }
    }
    const compId = localDataStore.getEffectiveCompanyId() || 'default';
    const tombstones = localDataStore.getTombstones('suppliers');
    const cached = cacheService.getSuppliers(compId);
    if (cached && cached.length > 0) {
      const filteredCached = cached.filter((s) => !tombstones.has(s.id));
      if (filteredCached.length !== cached.length) {
        cacheService.setSuppliers(compId, filteredCached);
      }
      return filteredCached;
    }

    let localSuppliers = localDataStore.getSuppliers().filter((s) => !tombstones.has(s.id));
    if (localSuppliers.length > 0) {
      cacheService.setSuppliers(compId, localSuppliers);
    }
    const isLocked = localDataStore.isRestoreLocked();

    const fetchRemote = async () => {
      try {
        const fromSupabase = await SupabaseDataService.getSuppliers();
        if (Array.isArray(fromSupabase)) {
          const remoteTombstoned = fromSupabase.filter((s) => tombstones.has(s.id));
          if (remoteTombstoned.length > 0 && isSupabaseConfigured) {
            Promise.all(remoteTombstoned.map((s) => SupabaseDataService.deleteSupplier(s.id))).catch((err) => notifyCloudSyncError("CloudSync", err));
          }
          const validRemote = fromSupabase.filter((s) => !tombstones.has(s.id));

          if (localSuppliers.length > 0 || localDataStore.isTenantInitialized()) {
            const localMap = new Map<string, Supplier>();
            for (const s of localSuppliers) {
              if (s.id) localMap.set(`ID_${s.id}`, s);
              if (s.nameAr) localMap.set(`NAME_${s.nameAr.trim().replace(/\s+/g, ' ')}`, s);
              if (s.phone && s.phone.trim().length > 5) localMap.set(`PHONE_${s.phone.trim()}`, s);
            }
            let hasNew = false;
            for (const rs of validRemote) {
              const rName = rs.nameAr ? `NAME_${rs.nameAr.trim().replace(/\s+/g, ' ')}` : '';
              const rPhone = rs.phone && rs.phone.trim().length > 5 ? `PHONE_${rs.phone.trim()}` : '';
              const existing = (rs.id ? localMap.get(`ID_${rs.id}`) : null) ||
                               (rName ? localMap.get(rName) : null) ||
                               (rPhone ? localMap.get(rPhone) : null);
              if (!existing) {
                localSuppliers.push(rs);
                if (rs.id) localMap.set(`ID_${rs.id}`, rs);
                if (rName) localMap.set(rName, rs);
                if (rPhone) localMap.set(rPhone, rs);
                hasNew = true;
              } else {
                Object.assign(existing, rs);
                hasNew = true;
              }
            }
            if (hasNew) {
              const deduped = localDataStore.deduplicateSuppliers(localSuppliers);
              localDataStore.saveSuppliers(deduped);
              cacheService.setSuppliers(compId, deduped);
              return deduped;
            }
            return localSuppliers;
          }

          if (validRemote.length > 0) {
            localDataStore.saveSuppliers(validRemote);
            cacheService.setSuppliers(compId, validRemote);
            return validRemote;
          }
        }
      } catch (e) {
        console.warn('Supabase getSuppliers notice:', e);
      }
      return localSuppliers;
    };

    if (localSuppliers.length > 0) {
      fetchRemote().catch((err) => notifyCloudSyncError("CloudSync", err));
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
    localDataStore.removeTombstone('suppliers', newSupp.id);
    list.push(newSupp);
    localDataStore.saveSuppliers(list);
    const compId = localDataStore.getEffectiveCompanyId() || 'default';
    cacheService.setSuppliers(compId, list);
    try {
      await SupabaseDataService.saveSupplier(newSupp);
    } catch (e) {
      console.warn('Supabase saveSupplier notice:', e);
    }

    // [ARCHITECT] Automated Balanced GL Opening Entry Generation
    if (newSupp.openingBalance && Number(newSupp.openingBalance) > 0) {
      const openAmount = Number(newSupp.openingBalance);
      const resolved = this.getResolvedAccounts();
      const equityAcc = (resolved as any).retainedEarnings || (resolved as any).capital || { id: 'acc-3200', code: '3200', nameAr: 'الأرباح المرحلة / الأرصدة الافتتاحية' };
      const jEntry: JournalEntry = {
        id: 'jv-' + Math.random().toString(36).substr(2, 9),
        entryNumber: `JV-OP-SUPP-${newSupp.id.slice(-4)}`,
        date: newSupp.openingBalanceDate || new Date().toISOString().split('T')[0],
        reference: `OP-${newSupp.nameAr}`,
        description: `قيد رصيد أول المدة الافتتاحي للمورد (${newSupp.nameAr})`,
        status: 'POSTED',
        lines: [
          {
            id: 'jl-1',
            accountId: equityAcc.id,
            accountCode: equityAcc.code,
            accountNameAr: equityAcc.nameAr,
            debit: openAmount,
            credit: 0,
            memo: `حقوق الملكية / أرصدة افتتاحية - ${newSupp.nameAr}`,
          },
          {
            id: 'jl-2',
            accountId: resolved.payable.id,
            accountCode: resolved.payable.code,
            accountNameAr: resolved.payable.nameAr,
            debit: 0,
            credit: openAmount,
            memo: `رصيد أول المدة للمورد ${newSupp.nameAr}`,
            entityType: 'SUPPLIER',
            entityId: newSupp.id,
          },
        ],
        totalDebit: openAmount,
        totalCredit: openAmount,
        createdAt: new Date().toISOString(),
        postedAt: new Date().toISOString(),
        isAutoGenerated: true,
        sourceModule: 'SUPPLIER_OPENING_BALANCE' as any,
        sourceId: newSupp.id,
      };
      const journals = localDataStore.getJournals();
      journals.unshift(jEntry);
      localDataStore.saveJournals(journals);
    }

    await safeApiFetch('/api/suppliers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return newSupp;
  }

  public static async updateSupplier(id: string, data: any): Promise<Supplier | null> {
    localDataStore.removeTombstone('suppliers', id);
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

    if (diff !== 0) {
      const resolved = this.getResolvedAccounts();
      const accounts = localDataStore.getAccounts();
      const equityAcc = accounts.find((a) => a.code === '3100' || a.category === 'EQUITY') || {
        id: 'acc-equity-01',
        code: '3100',
        nameAr: 'رأس المال والاحتياطيات',
      };
      const journals = localDataStore.getJournals();
      const existingJ = journals.find((j) => (j.sourceModule as string) === 'SUPPLIER_OPENING_BALANCE' && j.sourceId === id);

      if (newOpening > 0) {
        if (existingJ) {
          existingJ.lines = [
            {
              id: 'jl-1',
              accountId: equityAcc.id,
              accountCode: equityAcc.code,
              accountNameAr: equityAcc.nameAr,
              debit: newOpening,
              credit: 0,
              memo: `حقوق الملكية / أرصدة افتتاحية - ${list[idx].nameAr}`,
            },
            {
              id: 'jl-2',
              accountId: resolved.payable.id,
              accountCode: resolved.payable.code,
              accountNameAr: resolved.payable.nameAr,
              debit: 0,
              credit: newOpening,
              memo: `رصيد أول المدة للمورد - ${list[idx].nameAr}`,
              entityType: 'SUPPLIER',
              entityId: id,
            },
          ];
          existingJ.totalDebit = newOpening;
          existingJ.totalCredit = newOpening;
          existingJ.status = 'POSTED';
        } else {
          const jEntry: JournalEntry = {
            id: 'jv-supp-op-' + Math.random().toString(36).substr(2, 9),
            entryNumber: `JV-OP-SUPP-${list[idx].code || id.slice(-4)}`,
            date: list[idx].openingBalanceDate || '2026-07-01',
            reference: `OP-${list[idx].code || id.slice(-4)}`,
            description: `قيد رصيد افتتاحي للمورد (${list[idx].nameAr})`,
            status: 'POSTED',
            lines: [
              {
                id: 'jl-1',
                accountId: equityAcc.id,
                accountCode: equityAcc.code,
                accountNameAr: equityAcc.nameAr,
                debit: newOpening,
                credit: 0,
                memo: `حقوق الملكية / أرصدة افتتاحية - ${list[idx].nameAr}`,
              },
              {
                id: 'jl-2',
                accountId: resolved.payable.id,
                accountCode: resolved.payable.code,
                accountNameAr: resolved.payable.nameAr,
                debit: 0,
                credit: newOpening,
                memo: `رصيد أول المدة للمورد - ${list[idx].nameAr}`,
                entityType: 'SUPPLIER',
                entityId: id,
              },
            ],
            totalDebit: newOpening,
            totalCredit: newOpening,
            createdAt: new Date().toISOString(),
            postedAt: new Date().toISOString(),
            isAutoGenerated: true,
            sourceModule: 'SUPPLIER_OPENING_BALANCE' as any,
            sourceId: id,
          };
          journals.unshift(jEntry);
        }
      } else if (existingJ) {
        existingJ.status = 'CANCELLED';
      }
      localDataStore.saveJournals(journals);
      this.recalculateSupplierBalance(id);
    }
    const compId = localDataStore.getEffectiveCompanyId() || 'default';
    cacheService.setSuppliers(compId, list);
    try {
      await SupabaseDataService.saveSupplier(list[idx]);
    } catch (e) {
      console.warn('Supabase updateSupplier notice:', e);
    }
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
    localDataStore.addTombstone('suppliers', id);
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
    await safeApiFetch(`/api/suppliers/${id}`, { method: 'DELETE' });
    return true;
  }

  // Inventory
  public static async getInventory(): Promise<InventoryItem[]> {
    if (isSupabaseConfigured) {
      const fromSupabase = await SupabaseDataService.getItems();
      if (Array.isArray(fromSupabase)) {
        const tombstones = localDataStore.getTombstones('inventory');
        const validSupabase = fromSupabase.filter((i) => !tombstones.has(i.id));
        localDataStore.saveInventory(validSupabase);
        const compId = localDataStore.getEffectiveCompanyId() || 'default';
        cacheService.setItems(compId, validSupabase);
        return validSupabase;
      }
    }
    const compId = localDataStore.getEffectiveCompanyId() || 'default';
    const tombstones = localDataStore.getTombstones('inventory');
    const cached = cacheService.getItems(compId);
    if (cached && cached.length > 0) {
      const filteredCached = cached.filter((i) => !tombstones.has(i.id));
      if (filteredCached.length !== cached.length) {
        cacheService.setItems(compId, filteredCached);
      }
      return filteredCached;
    }

    let localInventory = localDataStore.getInventory().filter((i) => !tombstones.has(i.id));
    if (localInventory.length > 0) {
      cacheService.setItems(compId, localInventory);
    }
    const isLocked = localDataStore.isRestoreLocked();

    const fetchRemote = async () => {
      try {
        const fromSupabase = await SupabaseDataService.getItems();
        if (Array.isArray(fromSupabase)) {
          const remoteTombstoned = fromSupabase.filter((i) => tombstones.has(i.id));
          if (remoteTombstoned.length > 0 && isSupabaseConfigured) {
            Promise.all(remoteTombstoned.map((i) => SupabaseDataService.deleteItem(i.id))).catch((err) => notifyCloudSyncError("CloudSync", err));
          }
          const validRemote = fromSupabase.filter((i) => !tombstones.has(i.id));

          if (localInventory.length > 0 || localDataStore.isTenantInitialized()) {
            const localMap = new Map<string, InventoryItem>();
            for (const i of localInventory) {
              if (i.id) localMap.set(`ID_${i.id}`, i);
              if (i.sku) localMap.set(`SKU_${i.sku.trim().toUpperCase()}`, i);
              if (i.barcode) localMap.set(`BAR_${i.barcode.trim()}`, i);
              if (i.nameAr) localMap.set(`NAME_${i.nameAr.trim().replace(/\s+/g, ' ')}`, i);
            }
            let hasNew = false;
            for (const rItem of validRemote) {
              const rSku = (rItem.sku || (rItem as any).code || '').trim().toUpperCase();
              const rBar = (rItem.barcode || '').trim();
              const rName = (rItem.nameAr || (rItem as any).name || '').trim().replace(/\s+/g, ' ');
              const existing = (rItem.id ? localMap.get(`ID_${rItem.id}`) : null) ||
                               (rBar ? localMap.get(`BAR_${rBar}`) : null) ||
                               (rSku ? localMap.get(`SKU_${rSku}`) : null) ||
                               (rName ? localMap.get(`NAME_${rName}`) : null);
              if (!existing) {
                localInventory.push(rItem);
                if (rItem.id) localMap.set(`ID_${rItem.id}`, rItem);
                if (rBar) localMap.set(`BAR_${rBar}`, rItem);
                if (rSku) localMap.set(`SKU_${rSku}`, rItem);
                if (rName) localMap.set(`NAME_${rName}`, rItem);
                hasNew = true;
              } else {
                Object.assign(existing, rItem);
                hasNew = true;
              }
            }
            if (hasNew) {
              const deduped = localDataStore.deduplicateInventory(localInventory);
              localDataStore.saveInventory(deduped);
              cacheService.setItems(compId, deduped);
              return deduped;
            }
            return localInventory;
          }

          if (validRemote.length > 0) {
            localDataStore.saveInventory(validRemote);
            cacheService.setItems(compId, validRemote);
            return validRemote;
          }
        }
      } catch (e) {
        console.warn('Supabase getInventory notice:', e);
      }
      return localInventory;
    };

    if (localInventory.length > 0) {
      fetchRemote().catch((err) => notifyCloudSyncError("CloudSync", err));
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
    localDataStore.removeTombstone('inventory', newItem.id);
    list.push(newItem);
    localDataStore.saveInventory(list);
    const compId = localDataStore.getEffectiveCompanyId() || 'default';
    cacheService.setItems(compId, list);
    try {
      await SupabaseDataService.saveItem(newItem);
    } catch (e) {
      console.warn('Supabase saveItem notice:', e);
    }

    // [ARCHITECT] Automated Balanced GL Opening Entry Generation
    const initialValuation = (Number(newItem.quantityOnHand) || 0) * (Number(newItem.purchasePrice) || 0);
    if (initialValuation > 0) {
      const resolved = this.getResolvedAccounts();
      const equityAcc = (resolved as any).retainedEarnings || (resolved as any).capital || { id: 'acc-3200', code: '3200', nameAr: 'الأرباح المرحلة / الأرصدة الافتتاحية' };
      const jEntry: JournalEntry = {
        id: 'jv-' + Math.random().toString(36).substr(2, 9),
        entryNumber: `JV-OP-INV-${newItem.id.slice(-4)}`,
        date: new Date().toISOString().split('T')[0],
        reference: `OP-${newItem.sku}`,
        description: `قيد إثبات رصيد أول المدة للصنف (${newItem.nameAr}) - كمية ${newItem.quantityOnHand}`,
        status: 'POSTED',
        lines: [
          {
            id: 'jl-1',
            accountId: resolved.inventory.id,
            accountCode: resolved.inventory.code,
            accountNameAr: resolved.inventory.nameAr,
            debit: initialValuation,
            credit: 0,
            memo: `إثبات مخزون أول المدة للصنف ${newItem.nameAr}`,
          },
          {
            id: 'jl-2',
            accountId: equityAcc.id,
            accountCode: equityAcc.code,
            accountNameAr: equityAcc.nameAr,
            debit: 0,
            credit: initialValuation,
            memo: `حقوق الملكية / أرصدة افتتاحية - مخزون ${newItem.nameAr}`,
          },
        ],
        totalDebit: initialValuation,
        totalCredit: initialValuation,
        createdAt: new Date().toISOString(),
        postedAt: new Date().toISOString(),
        isAutoGenerated: true,
        sourceModule: 'INVENTORY_OPENING_BALANCE' as any,
        sourceId: newItem.id,
      };
      const journals = localDataStore.getJournals();
      journals.unshift(jEntry);
      localDataStore.saveJournals(journals);
    }

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
    localDataStore.removeTombstone('inventory', id);
    const list = localDataStore.getInventory();
    const idx = list.findIndex((i) => i.id === id);
    if (idx === -1) return null;

    const oldCost = Number(list[idx].costPrice || list[idx].purchasePrice || 0);
    const oldOpeningQty = Number((list[idx] as any).openingBalance ?? (list[idx] as any).openingStock ?? 0);
    const newCost = Number(data.costPrice !== undefined ? data.costPrice : oldCost);
    const newOpeningQty = Number(data.openingBalance !== undefined ? data.openingBalance : (data.openingStock !== undefined ? data.openingStock : oldOpeningQty));
    const valuationChanged = (newCost !== oldCost) || (newOpeningQty !== oldOpeningQty);

    list[idx] = { ...list[idx], ...data };
    localDataStore.saveInventory(list);

    if (valuationChanged) {
      const newValuation = Math.max(0, newOpeningQty * newCost);
      const resolved = this.getResolvedAccounts();
      const accounts = localDataStore.getAccounts();
      const equityAcc = accounts.find((a) => a.code === '3100' || a.category === 'EQUITY') || {
        id: 'acc-equity-01',
        code: '3100',
        nameAr: 'رأس المال والاحتياطيات',
      };
      const journals = localDataStore.getJournals();
      const existingJ = journals.find((j) => (j.sourceModule as string) === 'INVENTORY_OPENING_BALANCE' && j.sourceId === id);

      if (newValuation > 0) {
        if (existingJ) {
          existingJ.lines = [
            {
              id: 'jl-1',
              accountId: resolved.inventory.id,
              accountCode: resolved.inventory.code,
              accountNameAr: resolved.inventory.nameAr,
              debit: newValuation,
              credit: 0,
              memo: `إثبات مخزون أول المدة للصنف ${list[idx].nameAr}`,
            },
            {
              id: 'jl-2',
              accountId: equityAcc.id,
              accountCode: equityAcc.code,
              accountNameAr: equityAcc.nameAr,
              debit: 0,
              credit: newValuation,
              memo: `حقوق الملكية / أرصدة افتتاحية - مخزون ${list[idx].nameAr}`,
            },
          ];
          existingJ.totalDebit = newValuation;
          existingJ.totalCredit = newValuation;
          existingJ.status = 'POSTED';
        } else {
          const jEntry: JournalEntry = {
            id: 'jv-inv-op-' + Math.random().toString(36).substr(2, 9),
            entryNumber: `JV-OP-INV-${list[idx].sku || id.slice(-4)}`,
            date: '2026-07-01',
            reference: `OP-${list[idx].sku || id.slice(-4)}`,
            description: `قيد مخزون أول المدة للصنف (${list[idx].nameAr})`,
            status: 'POSTED',
            lines: [
              {
                id: 'jl-1',
                accountId: resolved.inventory.id,
                accountCode: resolved.inventory.code,
                accountNameAr: resolved.inventory.nameAr,
                debit: newValuation,
                credit: 0,
                memo: `إثبات مخزون أول المدة للصنف ${list[idx].nameAr}`,
              },
              {
                id: 'jl-2',
                accountId: equityAcc.id,
                accountCode: equityAcc.code,
                accountNameAr: equityAcc.nameAr,
                debit: 0,
                credit: newValuation,
                memo: `حقوق الملكية / أرصدة افتتاحية - مخزون ${list[idx].nameAr}`,
              },
            ],
            totalDebit: newValuation,
            totalCredit: newValuation,
            createdAt: new Date().toISOString(),
            postedAt: new Date().toISOString(),
            isAutoGenerated: true,
            sourceModule: 'INVENTORY_OPENING_BALANCE' as any,
            sourceId: id,
          };
          journals.unshift(jEntry);
        }
      } else if (existingJ) {
        existingJ.status = 'CANCELLED';
      }
      localDataStore.saveJournals(journals);
    }
    const compId = localDataStore.getEffectiveCompanyId() || 'default';
    cacheService.setItems(compId, list);
    try {
      await SupabaseDataService.saveItem(list[idx]);
    } catch (e) {
      console.warn('Supabase updateItem notice:', e);
    }
    await safeApiFetch(`/api/inventory/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return list[idx];
  }

  public static async deleteInventoryItem(id: string): Promise<boolean> {
    localDataStore.addTombstone('inventory', id);
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
    await safeApiFetch(`/api/units/${id}`, { method: 'DELETE' });
    return true;
  }

  // Production Orders
  public static async getProductionOrders(): Promise<ProductionOrder[]> {
    if (isSupabaseConfigured) {
      const fromSupabase = await SupabaseDataService.getProductionOrders();
      if (Array.isArray(fromSupabase)) {
        return fromSupabase;
      }
    }
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
      SupabaseDataService.saveJournal(jEntry).catch((err) => notifyCloudSyncError("CloudSync", err));
    }

    orders.unshift(newOrder);
    localDataStore.saveProductionOrders(orders);
    SupabaseDataService.saveProductionOrder(newOrder).catch((err) => notifyCloudSyncError("CloudSync", err));

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
    SupabaseDataService.saveManufacturingSettings(settings).catch((err) => notifyCloudSyncError("CloudSync", err));
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
      const isLeaf = isAccountLeaf(acc, accounts);
      const movDeb = debitMap.get(acc.id) || 0;
      const movCred = creditMap.get(acc.id) || 0;

      // Strict rule: Only leaf accounts accumulate into grand totals to prevent double-counting
      if (isLeaf) {
        totalMovementDebit += movDeb;
        totalMovementCredit += movCred;
      }

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

      if (isLeaf) {
        totalEndingDebit += endDeb;
        totalEndingCredit += endCred;
      }

      return {
        account: { ...acc, isLeaf } as any,
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

    const isLeaf = isAccountLeaf(account, accounts);
    const targetIds = new Set<string>();
    targetIds.add(account.id);
    if (!isLeaf) {
      const code = String(account.code || '').trim();
      accounts.forEach((a) => {
        if (a.id === account.id) return;
        const c = String(a.code || '').trim();
        if (a.parentId === account.id || (code && c.startsWith(code))) {
          if (isAccountLeaf(a, accounts)) {
            targetIds.add(a.id);
          }
        }
      });
    }

    const movements: any[] = [];

    journals.forEach((j) => {
      j.lines.forEach((l) => {
        const isMatch = targetIds.has(l.accountId) || accounts.some((a) => targetIds.has(a.id) && a.code === l.accountCode);
        if (isMatch) {
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
      // Leaf accounts only - prevent double counting
      if (!isAccountLeaf(acc, accounts)) return;

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
      // Leaf accounts only - prevent double counting
      if (!isAccountLeaf(acc, withBalances)) return;

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

  public static clearLocalMemory(): void { localDataStore.clearMemoryCache(); }

  /**
   * Ensures opening balances dated 2026-08-01 are established in chart of accounts and customers
   * if not already present, and guarantees "مخزن رئيسي" and "مندوب عام" exist as core master data.
   */
  public static async ensureOpeningBalancesAndMasterData(): Promise<{
    openingBalancesAdded: boolean;
    mainWarehouseAdded: boolean;
    generalRepAdded: boolean;
  }> {
    let openingBalancesAdded = false;
    let mainWarehouseAdded = false;
    let generalRepAdded = false;

    // 1. Ensure "مخزن رئيسي" (Main Warehouse) exists
    const warehouses = localDataStore.getWarehouses();
    const hasMainWh = warehouses.some((w) => w.isDefault || w.code === 'WH-MAIN-01' || w.nameAr?.includes('مخزن رئيسي'));
    if (!hasMainWh) {
      const defaultWh: Warehouse = {
        id: 'wh-main-01',
        code: 'WH-MAIN-01',
        nameAr: 'مخزن رئيسي (المستودع الرئيسي - الشويخ)',
        nameEn: 'Main Warehouse - Shuwaikh',
        location: 'الشويخ الصناعية، ق 3',
        keeperName: 'سالم الكندري',
        isDefault: true,
        isActive: true,
      };
      const updatedWhs = [defaultWh, ...warehouses];
      localDataStore.saveWarehouses(updatedWhs);
      if (isSupabaseConfigured) {
        await SupabaseDataService.saveWarehouses(updatedWhs).catch((err) => notifyCloudSyncError("CloudSync", err));
      }
      mainWarehouseAdded = true;
    }

    // 2. Ensure "مندوب عام" (General Sales Rep) exists
    const salesReps = localDataStore.getSalesReps();
    const hasGeneralRep = salesReps.some((r) => r.nameAr?.includes('مندوب عام') || r.code === 'REP-01');
    if (!hasGeneralRep) {
      const generalRep: SalesRep = {
        id: 'rep-001',
        code: 'REP-01',
        nameAr: 'مندوب عام',
        nameEn: 'General Sales Representative',
        phone: '+965 9911 2233',
        email: 'sales@logix-erp.com',
        commissionRate: 2.5,
        targetAmount: 50000,
        isActive: true,
        notes: 'مندوب عام لكافة الجمعيات والمبيعات العامة',
      };
      const updatedReps = [generalRep, ...salesReps];
      localDataStore.saveSalesReps(updatedReps);
      if (isSupabaseConfigured) {
        await SupabaseDataService.saveSalesReps(updatedReps).catch((err) => notifyCloudSyncError("CloudSync", err));
      }
      generalRepAdded = true;
    }

    // 3. Ensure Opening Balances dated 2026-08-01 exist (STRICTLY for authentic Al-Waleed tenant only - zero leak to new tenants)
    if (localDataStore.isAlWaleedActive()) {
      const accounts = await this.getAccounts();
      const journals = await this.getJournals();
      const customers = localDataStore.getCustomers();

      const hasOpeningJournal = journals.some(
        (j) => j.date === '2026-08-01' && (j.description?.includes('رصيد') || j.description?.includes('افتتاحي'))
      );
      const acc1120 = accounts.find((a) => a.code === '1120');
      const acc3100 = accounts.find((a) => a.code === '3100');

      if (!hasOpeningJournal || !acc1120 || acc1120.balance === 0) {
        const COOP_BALANCES = [
          { code: '9407', nameAr: 'جمعية الجليب التعاونية', nameEn: 'Jleeb Al-Shuyoukh Co-op Society', balance: 2811.222, phone: '+965 2431 0000', city: 'الفروانية' },
          { code: '4568', nameAr: 'جمعية القيروان التعاونية', nameEn: 'Qairawan Co-op Society', balance: 1514.395, phone: '+965 2467 0000', city: 'العاصمة' },
          { code: '3124', nameAr: 'جمعية الصباحية التعاونية', nameEn: 'Sabahiya Co-op Society', balance: 2010.164, phone: '+965 2361 0000', city: 'الأحمدي' },
          { code: '875',  nameAr: 'جمعية الأحمدي التعاونية', nameEn: 'Ahmadi Co-op Society', balance: 950.313, phone: '+965 2398 0000', city: 'الأحمدي' },
          { code: '3900', nameAr: 'جمعية صباح الأحمد التعاونية', nameEn: 'Sabah Al-Ahmad Co-op Society', balance: 895.338, phone: '+965 2326 0000', city: 'الأحمدي' },
          { code: '301',  nameAr: 'جمعية شمال غرب الصليبيخات التعاونية', nameEn: 'NW Sulaibikhat Co-op Society', balance: 2941.297, phone: '+965 2467 1111', city: 'العاصمة' },
          { code: '5563', nameAr: 'جمعية بيان التعاونية', nameEn: 'Bayan Co-op Society', balance: 1743.973, phone: '+965 2538 0000', city: 'حولي' },
          { code: '2035', nameAr: 'جمعية مدينة سعد العبدالله التعاونية', nameEn: 'Saad Al-Abdullah Co-op Society', balance: 711.214, phone: '+965 2454 0000', city: 'الجهراء' },
          { code: '3764', nameAr: 'جمعية سلوى التعاونية', nameEn: 'Salwa Co-op Society', balance: 1002.707, phone: '+965 2561 0000', city: 'حولي' },
          { code: '2537', nameAr: 'جمعية علي صباح السالم التعاونية', nameEn: 'Ali Sabah Al-Salem Co-op Society', balance: 931.940, phone: '+965 2328 8000', city: 'الأحمدي' },
          { code: '7575', nameAr: 'جمعية صباح الناصر التعاونية', nameEn: 'Sabah Al-Nasser Co-op Society', balance: 760.456, phone: '+965 2471 0000', city: 'الفروانية' },
          { code: '4640', nameAr: 'جمعية مبارك الكبير التعاونية', nameEn: 'Mubarak Al-Kabeer Co-op Society', balance: 4921.986, phone: '+965 2542 0000', city: 'مبارك الكبير' },
          { code: '1804', nameAr: 'جمعية إشبيلية التعاونية', nameEn: 'Ishbiliya Co-op Society', balance: 441.429, phone: '+965 2476 0000', city: 'الفروانية' },
        ];

        const totalCoopBalance = COOP_BALANCES.reduce((sum, c) => sum + c.balance, 0);

        // Merge or update customers
        const updatedCustomers = [...customers];
        for (const coop of COOP_BALANCES) {
          const cleanName = coop.nameAr.replace('جمعية ', '').replace(' التعاونية', '');
          const existingIdx = updatedCustomers.findIndex(
            (c) => c.code === coop.code || c.nameAr?.includes(cleanName)
          );
          if (existingIdx !== -1) {
            updatedCustomers[existingIdx] = {
              ...updatedCustomers[existingIdx],
              openingBalance: coop.balance,
              openingBalanceDate: '2026-08-01',
              balance: updatedCustomers[existingIdx].balance || coop.balance,
            };
          } else {
            updatedCustomers.push({
              id: `cust-${coop.code}`,
              code: coop.code,
              nameAr: coop.nameAr,
              nameEn: coop.nameEn,
              phone: coop.phone,
              city: coop.city,
              governorate: coop.city,
              address: coop.city,
              openingBalance: coop.balance,
              openingBalanceDate: '2026-08-01',
              balance: coop.balance,
              isActive: true,
            } as Customer);
          }
        }
        localDataStore.saveCustomers(updatedCustomers);
        if (isSupabaseConfigured) {
          await SupabaseDataService.saveCustomers(updatedCustomers).catch((err) => notifyCloudSyncError("CloudSync", err));
        }

        // Add Opening Journal Entry for 2026-08-01 if not already present
        if (!hasOpeningJournal) {
          const totalAmount = Number(totalCoopBalance.toFixed(3));
          const newJournal: JournalEntry = {
            id: 'jv-ob-2026-08-01',
            entryNumber: 'JV-2026-0001',
            date: '2026-08-01',
            reference: 'OB-2026-08-01',
            description: 'الأرصدة الافتتاحية للجمعيات وحسابات العملاء بتاريخ 2026-08-01',
            status: 'POSTED',
            totalDebit: totalAmount,
            totalCredit: totalAmount,
            createdAt: '2026-08-01T00:00:00.000Z',
            sourceModule: 'OPENING',
            lines: [
              {
                id: 'line-ob-dr',
                accountId: acc1120?.id || 'acc-1120',
                accountCode: '1120',
                accountNameAr: 'الذمم المدينة (حسابات العملاء والجمعيات التعاونية)',
                memo: 'إجمالي الأرصدة الافتتاحية لعملاء الجمعيات التعاونية بتاريخ 2026-08-01',
                debit: totalAmount,
                credit: 0,
              },
              {
                id: 'line-ob-cr',
                accountId: acc3100?.id || 'acc-3100',
                accountCode: '3100',
                accountNameAr: 'رأس المال المكتتب به / الأرصدة الافتتاحية',
                memo: 'مقابل الأرصدة الافتتاحية المدينة بتاريخ 2026-08-01',
                debit: 0,
                credit: totalAmount,
              },
            ],
          };
          const updatedJournals = [newJournal, ...journals.filter((j) => j.id !== newJournal.id)];
          localDataStore.saveJournals(updatedJournals);
          if (isSupabaseConfigured) {
            await SupabaseDataService.saveJournal(newJournal).catch((err) => notifyCloudSyncError("CloudSync", err));
          }
        }

        // Update accounts dynamic balances
        const refreshedAccounts = localDataStore.getAccounts().map((a) => {
          if (a.code === '1120') return { ...a, balance: Number(totalCoopBalance.toFixed(3)) };
          if (a.code === '3100') return { ...a, balance: Number(totalCoopBalance.toFixed(3)) };
          return a;
        });
        localDataStore.saveAccounts(refreshedAccounts);
        if (isSupabaseConfigured) {
          await SupabaseDataService.saveAccounts(refreshedAccounts).catch((err) => notifyCloudSyncError("CloudSync", err));
        }
        openingBalancesAdded = true;
      }
    }

    return { openingBalancesAdded, mainWarehouseAdded, generalRepAdded };
  }

  public static async resetDatabase(): Promise<void> {
    const compId = localDataStore.getEffectiveCompanyId();
    localDataStore.resetToDefaults();
    await safeApiFetch('/api/seed/reset', { method: 'POST' });
    if (isSupabaseConfigured) {
      await SupabaseDataService.resetTenantData(compId || undefined);
    }
    // Guarantee opening balances as of 2026-08-01, main warehouse, and general sales rep
    await this.ensureOpeningBalancesAndMasterData();
  }

  public static async syncSystemIntegrity(): Promise<any> {
    await this.syncServerTombstones();
    const compId = localDataStore.getEffectiveCompanyId();
    // 1. If restore lock is active, completely bypass remote overwrites to safeguard restored JSON data
    if (localDataStore.isRestoreLocked(compId || undefined)) {
      return { success: true, message: 'Restore lock active, local state strictly preserved', source: 'restore_lock' };
    }

    if (isSupabaseConfigured) {
      try {
        const [customers, suppliers, inventory, journals, invoices, vouchers, salesRepsFromSb, warehousesFromSb] = await Promise.all([
          SupabaseDataService.getCustomers(),
          SupabaseDataService.getSuppliers(),
          SupabaseDataService.getItems(),
          SupabaseDataService.getJournals(),
          SupabaseDataService.getInvoices(),
          SupabaseDataService.getVouchers(),
          SupabaseDataService.getSalesReps(),
          SupabaseDataService.getWarehouses(),
        ]);
        if (salesRepsFromSb && salesRepsFromSb.length > 0) {
          localDataStore.saveSalesReps(salesRepsFromSb);
        }
        if (warehousesFromSb && warehousesFromSb.length > 0) {
          localDataStore.saveWarehouses(warehousesFromSb);
        }
        const custTombstones = localDataStore.getTombstones('customers');
        const suppTombstones = localDataStore.getTombstones('suppliers');
        const invTombstones = localDataStore.getTombstones('inventory');
        const journalTombstones = localDataStore.getTombstones('journals');
        const invoiceTombstones = localDataStore.getTombstones('invoices');
        const voucherTombstones = localDataStore.getTombstones('vouchers');

        const localCust = localDataStore.getCustomers().filter((c) => !custTombstones.has(c.id));
        const localSupp = localDataStore.getSuppliers().filter((s) => !suppTombstones.has(s.id));
        const localInv = localDataStore.getInventory().filter((i) => !invTombstones.has(i.id));
        const localJournals = localDataStore.getJournals().filter((j) => !journalTombstones.has(j.id));
        const localInvoices = localDataStore.getInvoices().filter((inv) => !invoiceTombstones.has(inv.id));
        const localVouchers = localDataStore.getVouchers().filter((v) => !voucherTombstones.has(v.id));

        // Background purge of tombstoned records from remote Supabase
        if (Array.isArray(customers)) {
          const remoteCustTomb = customers.filter((c) => custTombstones.has(c.id));
          if (remoteCustTomb.length > 0) Promise.all(remoteCustTomb.map((c) => SupabaseDataService.deleteCustomer(c.id))).catch((err) => notifyCloudSyncError("CloudSync", err));
        }
        if (Array.isArray(suppliers)) {
          const remoteSuppTomb = suppliers.filter((s) => suppTombstones.has(s.id));
          if (remoteSuppTomb.length > 0) Promise.all(remoteSuppTomb.map((s) => SupabaseDataService.deleteSupplier(s.id))).catch((err) => notifyCloudSyncError("CloudSync", err));
        }
        if (Array.isArray(inventory)) {
          const remoteInvTomb = inventory.filter((i) => invTombstones.has(i.id));
          if (remoteInvTomb.length > 0) Promise.all(remoteInvTomb.map((i) => SupabaseDataService.deleteItem(i.id))).catch((err) => notifyCloudSyncError("CloudSync", err));
        }
        if (Array.isArray(journals)) {
          const remoteJrnTomb = journals.filter((j) => journalTombstones.has(j.id));
          if (remoteJrnTomb.length > 0) Promise.all(remoteJrnTomb.map((j) => SupabaseDataService.deleteJournal(j.id))).catch((err) => notifyCloudSyncError("CloudSync", err));
        }
        if (Array.isArray(invoices)) {
          const remoteInvTomb = invoices.filter((i) => invoiceTombstones.has(i.id));
          if (remoteInvTomb.length > 0) Promise.all(remoteInvTomb.map((i) => SupabaseDataService.deleteInvoice(i.id))).catch((err) => notifyCloudSyncError("CloudSync", err));
        }
        if (Array.isArray(vouchers)) {
          const remoteVchTomb = vouchers.filter((v) => voucherTombstones.has(v.id));
          if (remoteVchTomb.length > 0) Promise.all(remoteVchTomb.map((v) => SupabaseDataService.deleteVoucher(v.id))).catch((err) => notifyCloudSyncError("CloudSync", err));
        }

        // Merge genuinely new remote records, never overwriting existing local or deleted tombstoned records
        if (Array.isArray(customers)) {
          const validRemote = customers.filter((c) => !custTombstones.has(c.id));
          const localMap = new Map<string, Customer>();
          for (const c of localCust) {
            if (c.id) localMap.set(`ID_${c.id}`, c);
            if (c.nameAr) localMap.set(`NAME_${c.nameAr.trim().replace(/\s+/g, ' ')}`, c);
            if (c.phone && c.phone.trim().length > 5) localMap.set(`PHONE_${c.phone.trim()}`, c);
          }
          let changed = false;
          for (const rc of validRemote) {
            const rName = rc.nameAr ? `NAME_${rc.nameAr.trim().replace(/\s+/g, ' ')}` : '';
            const rPhone = rc.phone && rc.phone.trim().length > 5 ? `PHONE_${rc.phone.trim()}` : '';
            const existing = (rc.id ? localMap.get(`ID_${rc.id}`) : null) ||
                             (rName ? localMap.get(rName) : null) ||
                             (rPhone ? localMap.get(rPhone) : null);
            if (!existing) {
              localCust.push(rc);
              if (rc.id) localMap.set(`ID_${rc.id}`, rc);
              if (rName) localMap.set(rName, rc);
              if (rPhone) localMap.set(rPhone, rc);
              changed = true;
            } else {
              Object.assign(existing, rc);
              changed = true;
            }
          }
          if (changed) {
            const deduped = localDataStore.deduplicateCustomers(localCust);
            localDataStore.saveCustomers(deduped);
          }
        }

        if (Array.isArray(suppliers)) {
          const validRemote = suppliers.filter((s) => !suppTombstones.has(s.id));
          const localMap = new Map<string, Supplier>();
          for (const s of localSupp) {
            if (s.id) localMap.set(`ID_${s.id}`, s);
            if (s.nameAr) localMap.set(`NAME_${s.nameAr.trim().replace(/\s+/g, ' ')}`, s);
            if (s.phone && s.phone.trim().length > 5) localMap.set(`PHONE_${s.phone.trim()}`, s);
          }
          let changed = false;
          for (const rs of validRemote) {
            const rName = rs.nameAr ? `NAME_${rs.nameAr.trim().replace(/\s+/g, ' ')}` : '';
            const rPhone = rs.phone && rs.phone.trim().length > 5 ? `PHONE_${rs.phone.trim()}` : '';
            const existing = (rs.id ? localMap.get(`ID_${rs.id}`) : null) ||
                             (rName ? localMap.get(rName) : null) ||
                             (rPhone ? localMap.get(rPhone) : null);
            if (!existing) {
              localSupp.push(rs);
              if (rs.id) localMap.set(`ID_${rs.id}`, rs);
              if (rName) localMap.set(rName, rs);
              if (rPhone) localMap.set(rPhone, rs);
              changed = true;
            } else {
              Object.assign(existing, rs);
              changed = true;
            }
          }
          if (changed) {
            const deduped = localDataStore.deduplicateSuppliers(localSupp);
            localDataStore.saveSuppliers(deduped);
          }
        }

        if (Array.isArray(inventory)) {
          const validRemote = inventory.filter((i) => !invTombstones.has(i.id));
          const localMap = new Map<string, InventoryItem>();
          for (const i of localInv) {
            if (i.id) localMap.set(`ID_${i.id}`, i);
            if (i.sku) localMap.set(`SKU_${i.sku.trim().toUpperCase()}`, i);
            if (i.barcode) localMap.set(`BAR_${i.barcode.trim()}`, i);
            if (i.nameAr) localMap.set(`NAME_${i.nameAr.trim().replace(/\s+/g, ' ')}`, i);
          }
          let changed = false;
          for (const ri of validRemote) {
            const rSku = (ri.sku || (ri as any).code || '').trim().toUpperCase();
            const rBar = (ri.barcode || '').trim();
            const rName = (ri.nameAr || (ri as any).name || '').trim().replace(/\s+/g, ' ');
            const existing = (ri.id ? localMap.get(`ID_${ri.id}`) : null) ||
                             (rBar ? localMap.get(`BAR_${rBar}`) : null) ||
                             (rSku ? localMap.get(`SKU_${rSku}`) : null) ||
                             (rName ? localMap.get(`NAME_${rName}`) : null);
            if (!existing) {
              localInv.push(ri);
              if (ri.id) localMap.set(`ID_${ri.id}`, ri);
              if (rBar) localMap.set(`BAR_${rBar}`, ri);
              if (rSku) localMap.set(`SKU_${rSku}`, ri);
              if (rName) localMap.set(`NAME_${rName}`, ri);
              changed = true;
            } else {
              Object.assign(existing, ri);
              changed = true;
            }
          }
          if (changed) {
            const deduped = localDataStore.deduplicateInventory(localInv);
            localDataStore.saveInventory(deduped);
          }
        }

        if (Array.isArray(journals)) {
          const validRemote = journals.filter((j) => !journalTombstones.has(j.id));
          const localById = new Map<string, JournalEntry>();
          const localByNumber = new Map<string, JournalEntry>();
          for (const j of localJournals) {
            if (j.id) localById.set(j.id, j);
            if (j.entryNumber) localByNumber.set(j.entryNumber.trim().toUpperCase(), j);
            if (j.reference) localByNumber.set(`REF_${j.reference.trim().toUpperCase()}`, j);
          }
          let changed = false;
          for (const rj of validRemote) {
            const rNum = (rj.entryNumber || '').trim().toUpperCase();
            const rRef = (rj.reference || '').trim().toUpperCase();
            const existing = (rj.id ? localById.get(rj.id) : null) || 
                             (rNum ? localByNumber.get(rNum) : null) || 
                             (rRef ? localByNumber.get(`REF_${rRef}`) : null);
            if (!existing) {
              localJournals.push(rj);
              if (rj.id) localById.set(rj.id, rj);
              if (rNum) localByNumber.set(rNum, rj);
              if (rRef) localByNumber.set(`REF_${rRef}`, rj);
              changed = true;
            } else {
              const localTime = new Date(existing.postedAt || existing.createdAt || 0).getTime();
              const remoteTime = new Date(rj.postedAt || rj.createdAt || 0).getTime();
              if (remoteTime > localTime) {
                Object.assign(existing, rj);
                changed = true;
              }
            }
          }
          const dedupedJournals = localDataStore.deduplicateJournals(localJournals);
          localDataStore.saveJournals(dedupedJournals);
        }

        if (Array.isArray(invoices)) {
          const validRemote = invoices.filter((i) => !invoiceTombstones.has(i.id));
          const localById = new Map<string, Invoice>();
          const localByNumber = new Map<string, Invoice>();
          for (const inv of localInvoices) {
            if (inv.id) localById.set(inv.id, inv);
            if (inv.invoiceNumber) localByNumber.set(inv.invoiceNumber.trim().toUpperCase(), inv);
          }
          let changed = false;
          for (const ri of validRemote) {
            const rNum = (ri.invoiceNumber || '').trim().toUpperCase();
            const existing = (ri.id ? localById.get(ri.id) : null) || (rNum ? localByNumber.get(rNum) : null);
            if (!existing) {
              localInvoices.push(ri);
              if (ri.id) localById.set(ri.id, ri);
              if (rNum) localByNumber.set(rNum, ri);
              changed = true;
            } else {
              const localTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
              const remoteTime = new Date(ri.updatedAt || ri.createdAt || 0).getTime();
              const remoteHasLines = Array.isArray(ri.lines) && ri.lines.length > 0;
              const localHasLines = Array.isArray(existing.lines) && existing.lines.length > 0;
              if (remoteTime > localTime || (remoteHasLines && !localHasLines)) {
                Object.assign(existing, ri);
                changed = true;
              }
            }
          }
          const dedupedInvoices = localDataStore.deduplicateInvoices(localInvoices);
          localDataStore.saveInvoices(dedupedInvoices);
        }

        if (Array.isArray(vouchers)) {
          const validRemote = vouchers.filter((v) => !voucherTombstones.has(v.id));
          const localById = new Map<string, PaymentVoucher>();
          const localByNumber = new Map<string, PaymentVoucher>();
          for (const v of localVouchers) {
            if (v.id) localById.set(v.id, v);
            if (v.voucherNumber) localByNumber.set(v.voucherNumber.trim().toUpperCase(), v);
          }
          let changed = false;
          for (const rv of validRemote) {
            const rvNum = (rv.voucherNumber || '').trim().toUpperCase();
            const existing = (rv.id ? localById.get(rv.id) : null) || (rvNum ? localByNumber.get(rvNum) : null);
            if (!existing) {
              localVouchers.push(rv);
              if (rv.id) localById.set(rv.id, rv);
              if (rvNum) localByNumber.set(rvNum, rv);
              changed = true;
            } else {
              const localTime = new Date(existing.createdAt || 0).getTime();
              const remoteTime = new Date(rv.createdAt || 0).getTime();
              if (remoteTime > localTime) {
                Object.assign(existing, rv);
                changed = true;
              }
            }
          }
          const dedupedVouchers = localDataStore.deduplicateVouchers(localVouchers);
          localDataStore.saveVouchers(dedupedVouchers);
        }

        let accounts = await SupabaseDataService.getAccounts();
        if (!accounts || accounts.length === 0) {
          accounts = localDataStore.getAccounts();
        }
        if (Array.isArray(accounts) && accounts.length > 0) {
          const withBal = this.calculateDynamicAccountBalances(
            accounts,
            localJournals
          );
          localDataStore.saveAccounts(withBal);
        }
        return { success: true, source: 'supabase' };
      } catch (err) {
        console.warn('Sync integrity Supabase warning:', err);
      }
    }

    // For non-initialized new tenants, ensure virgin state is cleanly preserved and marked
    if (!localDataStore.isTenantInitialized()) {
      localDataStore.markTenantInitialized();
    }

    return { success: true, message: 'Local data retained safely' };
  }

  // ==========================================
  // QUOTATIONS & PROPOSALS API
  // ==========================================
  public static async getQuotations(): Promise<Quotation[]> {
    const tombstones = localDataStore.getTombstones('quotations');
    return localDataStore.getQuotations().filter((q) => !tombstones.has(q.id));
  }

  public static async saveQuotation(quotation: Quotation): Promise<Quotation> {
    localDataStore.removeTombstone('quotations', quotation.id);
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
    localDataStore.addTombstone('quotations', id);
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
      discountType: q.discountType || 'FIXED',
      discountValue: q.discountValue || 0,
      companyId: q.companyId || (q as any).company_id || undefined,
      company_id: (q as any).company_id || q.companyId || undefined,
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
      notes: q.notes ? `${q.notes} (محولة بضغطة زر تلقائياً من عرض السعر ${q.quotationNumber})` : `محولة بضغطة زر تلقائياً من عرض السعر رقم (${q.quotationNumber})`,
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
  public static getSalesReps(): SalesRep[] {
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
    if (isSupabaseConfigured) {
      await SupabaseDataService.saveSalesReps(list).catch((err) => notifyCloudSyncError("CloudSync", err));
    }
    return rep;
  }

  public static async deleteSalesRep(id: string): Promise<boolean> {
    const list = localDataStore.getSalesReps();
    const filtered = list.filter((r) => r.id !== id);
    localDataStore.saveSalesReps(filtered);
    if (isSupabaseConfigured) {
      await SupabaseDataService.deleteSalesRep(id).catch((err) => notifyCloudSyncError("CloudSync", err));
    }
    return true;
  }

  // ==========================================
  // SALES REPS CUSTODY & SUB-LEDGER API
  // ==========================================
  public static getRepCustodyRecords(repId?: string): RepCustodyRecord[] {
    const list = localDataStore.getRepCustodyRecords();
    if (!repId || repId === 'ALL') return list;
    return list.filter((r) => r.repId === repId);
  }

  public static saveRepCustodyRecord(record: RepCustodyRecord): RepCustodyRecord {
    const list = localDataStore.getRepCustodyRecords();
    const idx = list.findIndex((r) => r.id === record.id);
    if (idx !== -1) {
      list[idx] = record;
    } else {
      list.unshift(record);
    }
    localDataStore.saveRepCustodyRecords(list);
    return record;
  }

  public static deleteRepCustodyRecord(id: string): boolean {
    const list = localDataStore.getRepCustodyRecords();
    const filtered = list.filter((r) => r.id !== id);
    localDataStore.saveRepCustodyRecords(filtered);
    return true;
  }

  public static getVanStockMovements(repId?: string): VanStockItemMovement[] {
    const list = localDataStore.getVanStockMovements();
    if (!repId || repId === 'ALL') return list;
    return list.filter((m) => m.repId === repId);
  }

  public static saveVanStockMovement(movement: VanStockItemMovement): VanStockItemMovement {
    const list = localDataStore.getVanStockMovements();
    const idx = list.findIndex((m) => m.id === movement.id || (m.repId === movement.repId && m.itemId === movement.itemId));
    if (idx !== -1) {
      list[idx] = movement;
    } else {
      list.push(movement);
    }
    localDataStore.saveVanStockMovements(list);
    return movement;
  }

  // ==========================================
  // WAREHOUSES & STOCK MOVEMENT API
  // ==========================================
  public static getWarehouses(): Warehouse[] {
    return localDataStore.getWarehouses();
  }

  public static async saveWarehouse(warehouse: Warehouse): Promise<Warehouse> {
    const list = localDataStore.getWarehouses();
    const idx = list.findIndex((w) => w.id === warehouse.id);
    if (idx !== -1) {
      list[idx] = warehouse;
    } else {
      list.push(warehouse);
    }
    localDataStore.saveWarehouses(list);
    if (isSupabaseConfigured) {
      await SupabaseDataService.saveWarehouses(list).catch((err) => notifyCloudSyncError("CloudSync", err));
    }
    return warehouse;
  }

  public static async deleteWarehouse(id: string): Promise<boolean> {
    const list = localDataStore.getWarehouses();
    const filtered = list.filter((w) => w.id !== id);
    localDataStore.saveWarehouses(filtered);
    if (isSupabaseConfigured) {
      await SupabaseDataService.deleteWarehouse(id).catch((err) => notifyCloudSyncError("CloudSync", err));
    }
    return true;
  }

  public static getWarehouseStock(warehouseId: string, itemId: string): number {
    const stocks = localDataStore.getWarehouseStocks();
    const entry = stocks.find((s) => s.warehouseId === warehouseId && s.itemId === itemId);
    if (entry) return entry.quantityOnHand;
    const inventory = localDataStore.getInventory();
    const item = inventory.find((i) => i.id === itemId);
    return item ? item.quantityOnHand : 0;
  }

  public static adjustWarehouseStock(warehouseId: string, itemId: string, delta: number): void {
    const stocks = localDataStore.getWarehouseStocks();
    const idx = stocks.findIndex((s) => s.warehouseId === warehouseId && s.itemId === itemId);
    if (idx !== -1) {
      stocks[idx].quantityOnHand += delta;
    } else {
      const inventory = localDataStore.getInventory();
      const item = inventory.find((i) => i.id === itemId);
      const baseQty = item ? item.quantityOnHand : 0;
      stocks.push({
        id: 'ws-' + Math.random().toString(36).substr(2, 9),
        warehouseId,
        itemId,
        quantityOnHand: baseQty + delta,
      });
    }
    localDataStore.saveWarehouseStocks(stocks);
  }

  // ==========================================
  // [ARCHITECT] SELF-AUDITING ENGINE (تطابق الأرصدة والتحقق الذاتي)
  // ==========================================
  public static performSelfAuditing(): {
    isFullyAudited: boolean;
    trialBalanceBalanced: boolean;
    totalDebit: number;
    totalCredit: number;
    trialBalanceDiff: number;
    receivableMatched: boolean;
    receivableSubledger: number;
    receivableControl: number;
    receivableDiff: number;
    payableMatched: boolean;
    payableSubledger: number;
    payableControl: number;
    payableDiff: number;
    inventoryMatched: boolean;
    inventorySubledger: number;
    inventoryControl: number;
    inventoryDiff: number;
    statusMessage: string;
    discrepancies: string[];
    reconciledDate: string;
  } {
    const customers = localDataStore.getCustomers();
    const suppliers = localDataStore.getSuppliers();
    const inventory = localDataStore.getInventory();
    const journals = localDataStore.getJournals();
    const resolved = this.getResolvedAccounts();

    // 1. Trial Balance Equilibrium (ميزان المراجعة وتساوي المدين والدائن)
    let totalDebit = 0;
    let totalCredit = 0;
    for (const j of journals) {
      for (const line of j.lines || []) {
        totalDebit += Number(line.debit) || 0;
        totalCredit += Number(line.credit) || 0;
      }
    }
    const trialBalanceDiff = Math.abs(totalDebit - totalCredit);
    const trialBalanceBalanced = trialBalanceDiff < 0.01;

    // 2. Customers Subsidiary Ledger vs Accounts Receivable Control Account (1120)
    let receivableSubledger = 0;
    for (const c of customers) {
      const b = Number(c.balance !== undefined ? c.balance : c.openingBalance) || 0;
      receivableSubledger += b;
    }

    let receivableControl = 0;
    const recAccId = resolved.receivable.id;
    const recAccCode = resolved.receivable.code;
    for (const j of journals) {
      for (const line of j.lines || []) {
        if (line.accountId === recAccId || line.accountCode === recAccCode) {
          receivableControl += (Number(line.debit) || 0) - (Number(line.credit) || 0);
        }
      }
    }
    const receivableDiff = Math.abs(receivableSubledger - receivableControl);
    const receivableMatched = receivableDiff < 0.05;

    // 3. Suppliers Subsidiary Ledger vs Accounts Payable Control Account (2110)
    let payableSubledger = 0;
    for (const s of suppliers) {
      const b = Number(s.balance !== undefined ? s.balance : s.openingBalance) || 0;
      payableSubledger += b;
    }

    let payableControl = 0;
    const payAccId = resolved.payable.id;
    const payAccCode = resolved.payable.code;
    for (const j of journals) {
      for (const line of j.lines || []) {
        if (line.accountId === payAccId || line.accountCode === payAccCode) {
          payableControl += (Number(line.credit) || 0) - (Number(line.debit) || 0);
        }
      }
    }
    const payableDiff = Math.abs(payableSubledger - payableControl);
    const payableMatched = payableDiff < 0.05;

    // 4. Inventory Subsidiary Valuation vs Inventory Control Account (1130 / 1140)
    let inventorySubledger = 0;
    for (const it of inventory) {
      const qty = Number(it.quantityOnHand) || 0;
      const cost = Number(it.costPrice || it.purchasePrice || 0);
      inventorySubledger += qty * cost;
    }

    let inventoryControl = 0;
    const invAccId = resolved.inventory.id;
    const invAccCode = resolved.inventory.code;
    for (const j of journals) {
      for (const line of j.lines || []) {
        if (line.accountId === invAccId || line.accountCode === invAccCode) {
          inventoryControl += (Number(line.debit) || 0) - (Number(line.credit) || 0);
        }
      }
    }
    const inventoryDiff = Math.abs(inventorySubledger - inventoryControl);
    const inventoryMatched = inventoryDiff < 0.05;

    const discrepancies: string[] = [];
    if (!trialBalanceBalanced) {
      discrepancies.push(`عدم توازن ميزان المراجعة العام: إجمالي المدين (${totalDebit.toFixed(3)}) لا يساوي إجمالي الدائن (${totalCredit.toFixed(3)}) بفارق (${trialBalanceDiff.toFixed(3)}).`);
    }
    if (!receivableMatched) {
      discrepancies.push(`عدم تطابق أستاذ العملاء: إجمالي أرصدة العملاء (${receivableSubledger.toFixed(3)}) يختلف عن حساب المراقبة العام (${receivableControl.toFixed(3)}) بفارق (${receivableDiff.toFixed(3)}).`);
    }
    if (!payableMatched) {
      discrepancies.push(`عدم تطابق أستاذ الموردين: إجمالي أرصدة الموردين (${payableSubledger.toFixed(3)}) يختلف عن حساب المراقبة العام (${payableControl.toFixed(3)}) بفارق (${payableDiff.toFixed(3)}).`);
    }
    if (!inventoryMatched) {
      discrepancies.push(`فارق تقييم المخزون: إجمالي تقييم أصناف المخزن (${inventorySubledger.toFixed(3)}) يختلف عن حساب مراقبة المخزون بالدفتر العام (${inventoryControl.toFixed(3)}) بفارق (${inventoryDiff.toFixed(3)}).`);
    }

    const isFullyAudited = trialBalanceBalanced && receivableMatched && payableMatched && inventoryMatched;

    return {
      isFullyAudited,
      trialBalanceBalanced,
      totalDebit,
      totalCredit,
      trialBalanceDiff,
      receivableMatched,
      receivableSubledger,
      receivableControl,
      receivableDiff,
      payableMatched,
      payableSubledger,
      payableControl,
      payableDiff,
      inventoryMatched,
      inventorySubledger,
      inventoryControl,
      inventoryDiff,
      statusMessage: isFullyAudited
        ? 'تم التحقق الذاتي الكامل: جميع حسابات الأستاذ المساعد متطابقة 100% مع الحسابات الرقابية (Control Accounts) وميزان المراجعة متوازن تماماً.'
        : `تنبيه تدقيق داخلي: تم رصد ${discrepancies.length} فروقات محاسبية تتطلب المراجعة.`,
      discrepancies,
      reconciledDate: new Date().toISOString(),
    };
  }

  /**
   * Comprehensive Immediate Repair & Deduplication (إصلاح فوري شامل وتطهير التكرارات)
   * Enforces unique identifiers for every invoice, voucher, and journal entry.
   * Purges duplicate entries and recalculates accounting ledgers and customer balances.
   */
  public static async executeImmediateRepairAndDeduplication(): Promise<{
    invoicesDeduplicated: number;
    vouchersDeduplicated: number;
    journalsDeduplicated: number;
    message: string;
  }> {
    // 1. Invoices deduplication based on unique invoiceNumber and ID
    const rawInvoices = localDataStore.getLocal<Invoice[] | null>(localDataStore.getKey(STORAGE_KEYS.INVOICES), []) || [];
    const dedupedInvoices = localDataStore.deduplicateInvoices(rawInvoices);
    const invoicesDeduplicated = Math.max(0, rawInvoices.length - dedupedInvoices.length);
    localDataStore.saveInvoices(dedupedInvoices);

    // 2. Vouchers deduplication based on unique voucherNumber and ID
    const rawVouchers = localDataStore.getLocal<PaymentVoucher[] | null>(localDataStore.getKey(STORAGE_KEYS.VOUCHERS), []) || [];
    const dedupedVouchers = localDataStore.deduplicateVouchers(rawVouchers);
    const vouchersDeduplicated = Math.max(0, rawVouchers.length - dedupedVouchers.length);
    localDataStore.saveVouchers(dedupedVouchers);

    // 3. Journals deduplication based on unique entryNumber, reference, and ID
    const rawJournals = localDataStore.getLocal<JournalEntry[] | null>(localDataStore.getKey(STORAGE_KEYS.JOURNALS), []) || [];
    const dedupedJournals = localDataStore.deduplicateJournals(rawJournals);
    const journalsDeduplicated = Math.max(0, rawJournals.length - dedupedJournals.length);
    localDataStore.saveJournals(dedupedJournals);

    // 4. Sync vouchers with journals (updates existing, creates missing, purges orphans)
    await this.syncVouchersWithJournals();

    // 5. Update Bank & Cash dynamic account balances
    const updatedAccounts = this.syncAccountBalances();

    // 6. Recalculate customer & supplier balances dynamically
    const customers = localDataStore.getCustomers();
    for (const c of customers) {
      this.recalculateCustomerBalance(c.id);
    }
    const suppliers = localDataStore.getSuppliers();
    for (const s of suppliers) {
      this.recalculateSupplierBalance(s.id);
    }

    // 7. Push clean deduplicated data to Supabase if configured
    if (isSupabaseConfigured) {
      try {
        await Promise.all([
          SupabaseDataService.saveInvoices(dedupedInvoices),
          SupabaseDataService.saveVouchers(dedupedVouchers),
          SupabaseDataService.saveJournals(dedupedJournals),
          SupabaseDataService.saveAccounts(updatedAccounts),
        ]);
      } catch (err) {
        console.warn('Supabase immediate repair sync notice:', err);
      }
    }

    // 8. Run system integrity check
    await this.syncSystemIntegrity();

    const totalPurged = invoicesDeduplicated + vouchersDeduplicated + journalsDeduplicated;
    const message = totalPurged > 0
      ? `تم الإصلاح الفوري وتطهير ${totalPurged} سجل مكرر (${invoicesDeduplicated} فاتورة، ${vouchersDeduplicated} سند، ${journalsDeduplicated} قيد يومية) وضبط الأرقام المميزة بنجاح.`
      : `تم فحص وتأكيد سلامة النظام بنجاح. كافة الفواتير والسندات تحمل أرقاماً مميزة وفريدة ولا توجد أي سجلات مكررة.`;

    return {
      invoicesDeduplicated,
      vouchersDeduplicated,
      journalsDeduplicated,
      message,
    };
  }

  /**
   * [ARCHITECT & ENTERPRISE ERP SPECIALIST] Safe Zero-Loss Data Standardization Engine
   * Conforms strictly to ZERO DATA LOSS POLICY:
   * - Absolutely NO deletions or drops.
   * - Backfills missing relations (warehouseId, salesRepId, journalEntryId, customer_id).
   * - Automatically generates balanced journal entries for orphan posted invoices/vouchers.
   * - Reconciles item warehouse stocks and recalculates ledger balances.
   */
  public static async runSafeZeroLossDataStandardization(): Promise<{
    success: boolean;
    invoicesExamined: number;
    invoicesLinked: number;
    journalsGenerated: number;
    vouchersExamined: number;
    vouchersLinked: number;
    warehouseStocksLinked: number;
    message: string;
  }> {
    const compId = localDataStore.getEffectiveCompanyId();
    const invoices = localDataStore.getInvoices();
    const vouchers = localDataStore.getVouchers();
    let journals = localDataStore.getJournals();
    const inventory = localDataStore.getInventory();
    const warehouses = localDataStore.getWarehouses();
    const salesReps = localDataStore.getSalesReps();
    const defaultWh = warehouses.find((w) => w.isDefault) || warehouses[0] || {
      id: 'wh-main-01',
      code: 'WH-01',
      nameAr: 'المستودع الرئيسي (الشويخ)',
    };
    const defaultRep = salesReps[0] || {
      id: 'rep-01',
      code: 'REP-01',
      nameAr: 'المندوب العام',
    };

    let invoicesLinked = 0;
    let journalsGenerated = 0;
    let vouchersLinked = 0;
    let warehouseStocksLinked = 0;

    // 1. Standardize Invoices & Link/Generate Missing Accounting Journals
    for (const inv of invoices) {
      let modified = false;

      // Ensure warehouse link
      if (!inv.warehouseId || !inv.warehouseId.trim()) {
        inv.warehouseId = defaultWh.id;
        inv.warehouseName = defaultWh.nameAr;
        modified = true;
      } else if (!inv.warehouseName) {
        const whMatch = warehouses.find((w) => w.id === inv.warehouseId);
        if (whMatch) {
          inv.warehouseName = whMatch.nameAr;
          modified = true;
        }
      }

      // Ensure sales rep link
      if (!inv.salesRepId || !inv.salesRepId.trim()) {
        const matchRep = salesReps.find((r) => r.nameAr === inv.salesPerson || (inv as any).sales_person === r.nameAr);
        inv.salesRepId = matchRep ? matchRep.id : defaultRep.id;
        inv.salesRepName = matchRep ? matchRep.nameAr : (inv.salesPerson || defaultRep.nameAr);
        modified = true;
      }

      // Ensure entityId / customer_id consistency
      if (!inv.entityId && (inv as any).customerId) {
        inv.entityId = (inv as any).customerId;
        modified = true;
      }
      if (!(inv as any).customerId && inv.entityId) {
        (inv as any).customerId = inv.entityId;
        modified = true;
      }

      // Check Journal Entry Link
      if (inv.status === 'POSTED') {
        const existingJournal = journals.find(
          (j) => (inv.journalEntryId && j.id === inv.journalEntryId) ||
                 j.reference === inv.invoiceNumber ||
                 j.sourceId === inv.id
        );

        if (existingJournal) {
          if (inv.journalEntryId !== existingJournal.id) {
            inv.journalEntryId = existingJournal.id;
            modified = true;
            invoicesLinked++;
          }
        } else {
          // Generate balanced journal entry safely without affecting existing data
          try {
            const resolved = this.getResolvedAccounts();
            const grandTotal = Number(inv.grandTotal || (inv as any).totalAmount || 0);
            const vatTotal = Number(inv.vatTotal || (inv as any).vatAmount || 0);
            const netRevenue = Math.max(0, grandTotal - vatTotal);
            const paid = Number(inv.paidAmount || 0);
            const due = Number(inv.dueAmount !== undefined ? inv.dueAmount : (grandTotal - paid));
            const isSales = inv.type === 'SALES' || !inv.type;
            const isSalesReturn = inv.type === 'SALES_RETURN';
            const isPurchase = inv.type === 'PURCHASE';
            const isPurchaseReturn = inv.type === 'PURCHASE_RETURN';
            const lines: any[] = [];

            if (isSales) {
              if (paid > 0 && due > 0) {
                lines.push({ id: 'jl-1', accountId: resolved.cash.id, accountCode: resolved.cash.code, accountNameAr: resolved.cash.nameAr, debit: paid, credit: 0, memo: `دفعة نقدية - فاتورة ${inv.invoiceNumber}` });
                lines.push({ id: 'jl-2', accountId: resolved.receivable.id, accountCode: resolved.receivable.code, accountNameAr: resolved.receivable.nameAr, debit: due, credit: 0, memo: `مبلغ آجل - فاتورة ${inv.invoiceNumber}`, entityType: 'CUSTOMER', entityId: inv.entityId });
              } else {
                const paymentAcc = paid >= grandTotal ? resolved.cash : resolved.receivable;
                lines.push({ id: 'jl-1', accountId: paymentAcc.id, accountCode: paymentAcc.code, accountNameAr: paymentAcc.nameAr, debit: grandTotal, credit: 0, memo: `فاتورة مبيعات ${inv.invoiceNumber}`, entityType: paymentAcc.id === resolved.receivable.id ? 'CUSTOMER' : undefined, entityId: inv.entityId });
              }
              lines.push({ id: `jl-${lines.length + 1}`, accountId: resolved.sales.id, accountCode: resolved.sales.code, accountNameAr: resolved.sales.nameAr, debit: 0, credit: netRevenue, memo: `إيراد مبيعات فاتورة ${inv.invoiceNumber}` });
              if (vatTotal > 0) {
                lines.push({ id: `jl-${lines.length + 1}`, accountId: resolved.vat.id, accountCode: resolved.vat.code, accountNameAr: resolved.vat.nameAr, debit: 0, credit: vatTotal, memo: `ضريبة القيمة المضافة - فاتورة ${inv.invoiceNumber}` });
              }
            } else if (isPurchase) {
              lines.push({ id: 'jl-1', accountId: resolved.inventory.id, accountCode: resolved.inventory.code, accountNameAr: resolved.inventory.nameAr, debit: netRevenue, credit: 0, memo: `مخزون بضاعة - فاتورة شراء ${inv.invoiceNumber}` });
              if (vatTotal > 0) {
                lines.push({ id: `jl-${lines.length + 1}`, accountId: resolved.vat.id, accountCode: resolved.vat.code, accountNameAr: resolved.vat.nameAr, debit: vatTotal, credit: 0, memo: `ضريبة مشتريات - فاتورة ${inv.invoiceNumber}` });
              }
              const payAcc = paid >= grandTotal ? resolved.cash : resolved.payable;
              lines.push({ id: `jl-${lines.length + 1}`, accountId: payAcc.id, accountCode: payAcc.code, accountNameAr: payAcc.nameAr, debit: 0, credit: grandTotal, memo: `فاتورة مشتريات ${inv.invoiceNumber}`, entityType: payAcc.id === resolved.payable.id ? 'SUPPLIER' : undefined, entityId: inv.entityId });
            }

            if (lines.length > 0) {
              const sumDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
              const sumCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
              if (Math.abs(sumDebit - sumCredit) <= 0.05) {
                const newJv: JournalEntry = {
                  id: 'jv-std-' + Math.random().toString(36).substr(2, 9),
                  entryNumber: `JV-${inv.invoiceNumber}`,
                  date: inv.date || (inv as any).invoiceDate || new Date().toISOString().split('T')[0],
                  reference: inv.invoiceNumber,
                  description: `قيد تسوية آمن - فاتورة (${inv.invoiceNumber})`,
                  status: 'POSTED',
                  lines,
                  totalDebit: sumDebit,
                  totalCredit: sumCredit,
                  createdAt: new Date().toISOString(),
                  postedAt: new Date().toISOString(),
                  isAutoGenerated: true,
                  sourceModule: isSales ? 'SALES_INVOICE' : isPurchase ? 'PURCHASE_INVOICE' : 'SALES_INVOICE',
                  sourceId: inv.id,
                };
                journals.unshift(newJv);
                inv.journalEntryId = newJv.id;
                journalsGenerated++;
                modified = true;
              }
            }
          } catch (genErr) {
            console.warn('Journal generation note for invoice:', inv.invoiceNumber, genErr);
          }
        }
      }

      if (modified) invoicesLinked++;
    }

    // 2. Standardize Vouchers & Link/Generate Missing Accounting Journals
    for (const vch of vouchers) {
      if (vch.status === 'POSTED') {
        const existingJournal = journals.find(
          (j) => (vch.journalEntryId && j.id === vch.journalEntryId) ||
                 j.reference === vch.voucherNumber ||
                 j.sourceId === vch.id
        );

        if (existingJournal) {
          if (vch.journalEntryId !== existingJournal.id) {
            vch.journalEntryId = existingJournal.id;
            vouchersLinked++;
          }
        } else {
          try {
            const resolved = this.getResolvedAccounts();
            const amount = Number(vch.amount || 0);
            const lines: any[] = [];

            if (vch.type === 'RECEIPT') {
              lines.push(
                { id: 'jl-1', accountId: resolved.cash.id, accountCode: resolved.cash.code, accountNameAr: resolved.cash.nameAr, debit: amount, credit: 0, memo: `سند قبض ${vch.voucherNumber} - ${vch.entityNameAr || ''}` },
                { id: 'jl-2', accountId: resolved.receivable.id, accountCode: resolved.receivable.code, accountNameAr: resolved.receivable.nameAr, debit: 0, credit: amount, memo: `تحصيل من العميل ${vch.entityNameAr || ''}`, entityType: 'CUSTOMER', entityId: vch.entityId }
              );
            } else {
              lines.push(
                { id: 'jl-1', accountId: resolved.payable.id, accountCode: resolved.payable.code, accountNameAr: resolved.payable.nameAr, debit: amount, credit: 0, memo: `سداد للمورد ${vch.entityNameAr || ''}`, entityType: 'SUPPLIER', entityId: vch.entityId },
                { id: 'jl-2', accountId: resolved.cash.id, accountCode: resolved.cash.code, accountNameAr: resolved.cash.nameAr, debit: 0, credit: amount, memo: `سند صرف ${vch.voucherNumber} - ${vch.entityNameAr || ''}` }
              );
            }

            if (lines.length > 0) {
              const newJv: JournalEntry = {
                id: 'jv-std-' + Math.random().toString(36).substr(2, 9),
                entryNumber: `JV-${vch.voucherNumber}`,
                date: vch.date || new Date().toISOString().split('T')[0],
                reference: vch.voucherNumber,
                description: `قيد تسوية آمن - ${vch.type === 'RECEIPT' ? 'سند قبض' : 'سند صرف'} (${vch.voucherNumber})`,
                status: 'POSTED',
                lines,
                totalDebit: amount,
                totalCredit: amount,
                createdAt: new Date().toISOString(),
                postedAt: new Date().toISOString(),
                isAutoGenerated: true,
                sourceModule: vch.type === 'RECEIPT' ? 'RECEIPT' : 'PAYMENT',
                sourceId: vch.id,
              };
              journals.unshift(newJv);
              vch.journalEntryId = newJv.id;
              journalsGenerated++;
              vouchersLinked++;
            }
          } catch (genErr) {
            console.warn('Journal generation note for voucher:', vch.voucherNumber, genErr);
          }
        }
      }
    }

    // 3. Ensure Item Warehouse Stocks Integrity
    const currentStocks = localDataStore.getWarehouseStocks();
    for (const item of inventory) {
      if (item.costPrice === undefined || item.costPrice === null || item.costPrice === 0) {
        if (item.purchasePrice && item.purchasePrice > 0) item.costPrice = item.purchasePrice;
      }
      if (item.purchasePrice === undefined || item.purchasePrice === null || item.purchasePrice === 0) {
        if (item.costPrice && item.costPrice > 0) item.purchasePrice = item.costPrice;
      }

      for (const wh of warehouses) {
        const stockExists = currentStocks.some((s) => s.warehouseId === wh.id && s.itemId === item.id);
        if (!stockExists) {
          currentStocks.push({
            id: 'ws-' + Math.random().toString(36).substr(2, 9),
            warehouseId: wh.id,
            itemId: item.id,
            quantityOnHand: wh.isDefault ? Number(item.quantityOnHand || 0) : 0,
          });
          warehouseStocksLinked++;
        }
      }
    }

    // 4. Save and Recalculate
    localDataStore.saveInvoices(invoices);
    localDataStore.saveVouchers(vouchers);
    localDataStore.saveJournals(journals);
    localDataStore.saveInventory(inventory);
    localDataStore.saveWarehouseStocks(currentStocks);

    // Recalculate Customer & Supplier balances
    const customers = localDataStore.getCustomers();
    for (const c of customers) {
      this.recalculateCustomerBalance(c.id);
    }
    const suppliers = localDataStore.getSuppliers();
    for (const s of suppliers) {
      this.recalculateSupplierBalance(s.id);
    }

    // Sync Account Balances
    const updatedAccounts = this.syncAccountBalances();

    // Push to Supabase if configured
    if (isSupabaseConfigured) {
      try {
        await Promise.all([
          SupabaseDataService.saveInvoices(invoices),
          SupabaseDataService.saveVouchers(vouchers),
          SupabaseDataService.saveJournals(journals),
          SupabaseDataService.saveInventory(inventory),
          SupabaseDataService.saveAccounts(updatedAccounts),
        ]);
      } catch (err) {
        console.warn('Supabase safe standardization sync notice:', err);
      }
    }

    await this.syncSystemIntegrity();

    return {
      success: true,
      invoicesExamined: invoices.length,
      invoicesLinked,
      journalsGenerated,
      vouchersExamined: vouchers.length,
      vouchersLinked,
      warehouseStocksLinked,
      message: `تم توحيد الربط البرمجي وتعبئة الروابط المحاسبية والمخزنية بنجاح تام وفق سياسة ZERO DATA LOSS: تم فحص ${invoices.length} فاتورة، وتوليد/ربط ${journalsGenerated} قيد متوازن، وربط ${warehouseStocksLinked} رصيد مستودعي دون أي مسح أو حذف.`,
    };
  }
}
