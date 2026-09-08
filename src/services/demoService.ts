/**
 * LOGIX Demo Company Service
 * Provides single-click instant trial access for prospective clients with full sandbox isolation.
 * Fixed Demo Company ID: 00000000-0000-0000-0000-000000000099
 */

import {
  CompanyProfile,
  SystemUser,
  InventoryItem,
  Customer,
  Supplier,
  Invoice,
  JournalEntry,
  Account,
  PaymentVoucher,
  UnitDefinition,
} from '../types.js';
import { supabase, isSupabaseConfigured, setCurrentCompanyId, getCurrentCompanyId, STORAGE_KEYS } from './supabaseClient.js';
import { INITIAL_ACCOUNTS, INITIAL_UNITS } from '../server/defaultData.js';

export const DEMO_COMPANY_ID = '00000000-0000-0000-0000-000000000099';
export const DEMO_RESET_KEY = 'logix_demo_last_reset_timestamp';

export const DEMO_COMPANY: CompanyProfile = {
  id: DEMO_COMPANY_ID,
  nameAr: 'شركة تجريبية - LOGIX Demo',
  nameEn: 'LOGIX Cloud ERP Demo Enterprise',
  tradeName: 'شركة تجريبية للحلول السحابية (نسخة العرض الحي)',
  legalForm: 'شركة مساهمة مقفلة (نسخة تجريبية)',
  crNumber: '1010009999',
  taxNumber: '399999999900003',
  chamberNumber: '778899',
  crIssueDate: '2025-01-01',
  crExpiryDate: '2030-01-01',
  buildingNo: 'برج التجربة الرقمية',
  streetName: 'طريق الملك عبد العزيز',
  district: 'حي الصحافة',
  city: 'الرياض',
  country: 'المملكة العربية السعودية',
  postalCode: '13315',
  additionalNo: '9900',
  phone: '+966 11 000 0099',
  mobile: '+966 55 000 0099',
  email: 'demo@logix-system.com',
  website: 'https://demo.logix-system.com',
  vatRate: 15,
  vatType: 'QUARTERLY',
  zatcaPhase: 'PHASE_2_INTEGRATED',
  zatcaEnv: 'SANDBOX',
  fiscalYearStart: '2026-01-01',
  fiscalYearEnd: '2026-12-31',
  accountingBasis: 'ACCRUAL',
  functionalCurrency: 'SAR',
  inventoryCosting: 'WEIGHTED_AVERAGE',
  depreciationMethod: 'STRAIGHT_LINE',
  decimalPlaces: 2,
  generalManager: 'م. راشد بن فهد (تجريبي)',
  financialManager: 'أ. طارق المحمود (تجريبي)',
  chiefAccountant: 'أ. سامي الزهراني (تجريبي)',
  headerNotes: 'بيئة تجريبية تفاعلية لنظام لوجيكس لإدارة الموارد السحابية (LOGIX Cloud ERP)',
  footerNotes: 'هذه نسخة عرض تجريبية حية — البيانات للعرض والتجربة فقط ولا يُعتد بها رسمياً.',
  showDigitalStamp: true,
};

export const DEMO_USER: SystemUser = {
  id: 'user-demo-001',
  name: 'مستخدم تجريبي (Demo User)',
  username: 'demo',
  email: 'demo@logix-system.com',
  role: 'ADMIN',
  roleTitleAr: 'مدير النظام (نسخة تجريبية)',
  isActive: true,
  pinCode: '1234',
  createdAt: '2026-01-01T00:00:00.000Z',
};

// 7 Realistic Sample Items
export const DEMO_SEED_ITEMS: InventoryItem[] = [
  {
    id: 'item-demo-01',
    sku: 'ITEM-RICE-01',
    barcode: '6281001000012',
    nameAr: 'أرز بسمتي هندي فاخر 10 كجم',
    nameEn: 'Premium Indian Basmati Rice 10kg',
    category: 'مواد غذائية أساسية',
    unit: 'كيس',
    unitsPerPack: 1,
    packUnit: 'كيس',
    purchasePrice: 48,
    costPrice: 48,
    salePrice: 65,
    quantityOnHand: 140,
    minQuantityAlert: 20,
    isActive: true,
  },
  {
    id: 'item-demo-02',
    sku: 'ITEM-OIL-02',
    barcode: '6281001000029',
    nameAr: 'زيت ذرة نقي عافية 5 لتر',
    nameEn: 'Pure Corn Oil 5L',
    category: 'زيوت ودهون',
    unit: 'حبة',
    unitsPerPack: 4,
    packUnit: 'كرتون',
    purchasePrice: 34,
    costPrice: 34,
    salePrice: 46,
    quantityOnHand: 95,
    minQuantityAlert: 15,
    isActive: true,
  },
  {
    id: 'item-demo-03',
    sku: 'ITEM-SUGAR-03',
    barcode: '6281001000036',
    nameAr: 'سكر أبيض ناعم الأسرة 5 كجم',
    nameEn: 'Fine White Sugar 5kg',
    category: 'مواد غذائية أساسية',
    unit: 'كيس',
    unitsPerPack: 1,
    packUnit: 'كيس',
    purchasePrice: 18,
    costPrice: 18,
    salePrice: 25,
    quantityOnHand: 160,
    minQuantityAlert: 25,
    isActive: true,
  },
  {
    id: 'item-demo-04',
    sku: 'ITEM-TEA-04',
    barcode: '6281001000043',
    nameAr: 'شاي سيلاني فاخر 100 كيس',
    nameEn: 'Ceylon Black Tea 100 Bags',
    category: 'مشروبات ساخنة',
    unit: 'علبة',
    unitsPerPack: 12,
    packUnit: 'كرتون',
    purchasePrice: 12,
    costPrice: 12,
    salePrice: 17.5,
    quantityOnHand: 220,
    minQuantityAlert: 30,
    isActive: true,
  },
  {
    id: 'item-demo-05',
    sku: 'ITEM-MILK-05',
    barcode: '6281001000050',
    nameAr: 'حليب كامل الدسم طويل الأجل (كرتون 12 لتر)',
    nameEn: 'Full Cream UHT Milk (12x1L)',
    category: 'ألبان ومشتقاتها',
    unit: 'كرتون',
    unitsPerPack: 12,
    packUnit: 'كرتون',
    purchasePrice: 44,
    costPrice: 44,
    salePrice: 58,
    quantityOnHand: 75,
    minQuantityAlert: 15,
    isActive: true,
  },
  {
    id: 'item-demo-06',
    sku: 'ITEM-COFFEE-06',
    barcode: '6281001000067',
    nameAr: 'بن هرري محمص درجة أولى 1 كجم',
    nameEn: 'Roasted Harari Coffee Beans 1kg',
    category: 'قهوة ومكسرات',
    unit: 'كجم',
    unitsPerPack: 1,
    packUnit: 'كجم',
    purchasePrice: 38,
    costPrice: 38,
    salePrice: 54,
    quantityOnHand: 85,
    minQuantityAlert: 10,
    isActive: true,
  },
  {
    id: 'item-demo-07',
    sku: 'ITEM-WATER-07',
    barcode: '6281001000074',
    nameAr: 'مياه معدنية طبيعية 330 مل (كرتون 40 قارورة)',
    nameEn: 'Natural Mineral Water 330ml (40 Pack)',
    category: 'مياه ومشروبات',
    unit: 'كرتون',
    unitsPerPack: 40,
    packUnit: 'كرتون',
    purchasePrice: 13.5,
    costPrice: 13.5,
    salePrice: 19,
    quantityOnHand: 180,
    minQuantityAlert: 35,
    isActive: true,
  },
];

// 4 Realistic Customers
export const DEMO_SEED_CUSTOMERS: Customer[] = [
  {
    id: 'cust-demo-01',
    code: 'CUST-DEMO-01',
    nameAr: 'أسواق النخبة المركزية (عميل تجريبي)',
    nameEn: 'Elite Central Markets (Demo)',
    phone: '0501112233',
    address: 'شارع التخصصي',
    city: 'الرياض',
    balance: 8500,
    creditLimit: 30000,
    openingBalance: 5000,
    isActive: true,
  },
  {
    id: 'cust-demo-02',
    code: 'CUST-DEMO-02',
    nameAr: 'مؤسسة التموين الغذائي السريع (عميل تجريبي)',
    nameEn: 'Fast Catering Est (Demo)',
    phone: '0554445566',
    address: 'طريق المدينة',
    city: 'جدة',
    balance: 4200,
    creditLimit: 20000,
    openingBalance: 0,
    isActive: true,
  },
  {
    id: 'cust-demo-03',
    code: 'CUST-DEMO-03',
    nameAr: 'سوبرماركت البركة الحديث (عميل تجريبي)',
    nameEn: 'Al Baraka Supermarket (Demo)',
    phone: '0567778899',
    address: 'شارع الملك سعود',
    city: 'الدمام',
    balance: 0,
    creditLimit: 15000,
    openingBalance: 0,
    isActive: true,
  },
  {
    id: 'cust-demo-04',
    code: 'CUST-DEMO-04',
    nameAr: 'فندق قصر الرياض للضيافة (عميل تجريبي)',
    nameEn: 'Riyadh Palace Hotel (Demo)',
    phone: '0543332211',
    address: 'طريق خريص',
    city: 'الرياض',
    balance: 3450,
    creditLimit: 25000,
    openingBalance: 0,
    isActive: true,
  },
];

// 3 Realistic Suppliers
export const DEMO_SEED_SUPPLIERS: Supplier[] = [
  {
    id: 'supp-demo-01',
    code: 'SUPP-DEMO-01',
    nameAr: 'شركة صوامع الغلال والمطاحن (مورد تجريبي)',
    nameEn: 'Grain Silos & Flour Mills Co (Demo)',
    phone: '0112223344',
    address: 'المنطقة الصناعية الثانية',
    city: 'الرياض',
    balance: 12500,
    creditLimit: 50000,
    openingBalance: 8000,
    isActive: true,
  },
  {
    id: 'supp-demo-02',
    code: 'SUPP-DEMO-02',
    nameAr: 'المجموعة المتحدة للزيوت والأغذية (مورد تجريبي)',
    nameEn: 'United Oils & Foods Group (Demo)',
    phone: '0126667788',
    address: 'ميناء جدة الإسلامي',
    city: 'جدة',
    balance: 4200,
    creditLimit: 30000,
    openingBalance: 0,
    isActive: true,
  },
  {
    id: 'supp-demo-03',
    code: 'SUPP-DEMO-03',
    nameAr: 'مصنع الكرتون والتغليف الخليجي (مورد تجريبي)',
    nameEn: 'Gulf Packaging & Cartons (Demo)',
    phone: '0138889900',
    address: 'صناعية الدمام الأولى',
    city: 'الدمام',
    balance: 0,
    creditLimit: 15000,
    openingBalance: 0,
    isActive: true,
  },
];

// 8 Invoices (5 Sales + 3 Purchases) distributed over the last two months
export const DEMO_SEED_INVOICES: Invoice[] = [
  // 1. Sales - أسواق النخبة (Paid)
  {
    id: 'inv-demo-001',
    invoiceNumber: 'INV-2026-001',
    type: 'SALES',
    paymentTerms: 'CREDIT',
    entityId: 'cust-demo-01',
    entityNameAr: 'أسواق النخبة المركزية (عميل تجريبي)',
    date: '2026-08-05',
    dueDate: '2026-09-05',
    status: 'PAID',
    lines: [
      {
        id: 'line-demo-101',
        itemId: 'item-demo-01',
        itemSku: 'ITEM-RICE-01',
        itemNameAr: 'أرز بسمتي هندي فاخر 10 كجم',
        unit: 'كيس',
        unitsPerPack: 1,
        quantity: 30,
        unitPrice: 65,
        subtotal: 1950,
        vatRate: 15,
        vatAmount: 292.5,
        total: 2242.5,
      },
      {
        id: 'line-demo-102',
        itemId: 'item-demo-02',
        itemSku: 'ITEM-OIL-02',
        itemNameAr: 'زيت ذرة نقي عافية 5 لتر',
        unit: 'حبة',
        unitsPerPack: 4,
        quantity: 20,
        unitPrice: 46,
        subtotal: 920,
        vatRate: 15,
        vatAmount: 138,
        total: 1058,
      },
    ],
    subtotal: 2870,
    vatTotal: 430.5,
    discountTotal: 0,
    grandTotal: 3300.5,
    paidAmount: 3300.5,
    dueAmount: 0,
    createdAt: '2026-08-05T09:00:00.000Z',
  },
  // 2. Sales - مؤسسة التموين الغذائي (Partially Paid)
  {
    id: 'inv-demo-002',
    invoiceNumber: 'INV-2026-002',
    type: 'SALES',
    paymentTerms: 'CREDIT',
    entityId: 'cust-demo-02',
    entityNameAr: 'مؤسسة التموين الغذائي السريع (عميل تجريبي)',
    date: '2026-08-12',
    dueDate: '2026-09-12',
    status: 'PARTIALLY_PAID',
    lines: [
      {
        id: 'line-demo-201',
        itemId: 'item-demo-03',
        itemSku: 'ITEM-SUGAR-03',
        itemNameAr: 'سكر أبيض ناعم الأسرة 5 كجم',
        unit: 'كيس',
        unitsPerPack: 1,
        quantity: 50,
        unitPrice: 25,
        subtotal: 1250,
        vatRate: 15,
        vatAmount: 187.5,
        total: 1437.5,
      },
      {
        id: 'line-demo-202',
        itemId: 'item-demo-05',
        itemSku: 'ITEM-MILK-05',
        itemNameAr: 'حليب كامل الدسم طويل الأجل (كرتون 12 لتر)',
        unit: 'كرتون',
        unitsPerPack: 12,
        quantity: 30,
        unitPrice: 58,
        subtotal: 1740,
        vatRate: 15,
        vatAmount: 261,
        total: 2001,
      },
      {
        id: 'line-demo-203',
        itemId: 'item-demo-04',
        itemSku: 'ITEM-TEA-04',
        itemNameAr: 'شاي سيلاني فاخر 100 كيس',
        unit: 'علبة',
        unitsPerPack: 12,
        quantity: 40,
        unitPrice: 17.5,
        subtotal: 700,
        vatRate: 15,
        vatAmount: 105,
        total: 805,
      },
    ],
    subtotal: 3690,
    vatTotal: 553.5,
    discountTotal: 0,
    grandTotal: 4243.5,
    paidAmount: 2000,
    dueAmount: 2243.5,
    createdAt: '2026-08-12T10:30:00.000Z',
  },
  // 3. Sales - سوبرماركت البركة (Paid)
  {
    id: 'inv-demo-003',
    invoiceNumber: 'INV-2026-003',
    type: 'SALES',
    paymentTerms: 'CASH',
    entityId: 'cust-demo-03',
    entityNameAr: 'سوبرماركت البركة الحديث (عميل تجريبي)',
    date: '2026-08-20',
    dueDate: '2026-08-20',
    status: 'PAID',
    lines: [
      {
        id: 'line-demo-301',
        itemId: 'item-demo-07',
        itemSku: 'ITEM-WATER-07',
        itemNameAr: 'مياه معدنية طبيعية 330 مل (كرتون 40 قارورة)',
        unit: 'كرتون',
        unitsPerPack: 40,
        quantity: 60,
        unitPrice: 19,
        subtotal: 1140,
        vatRate: 15,
        vatAmount: 171,
        total: 1311,
      },
      {
        id: 'line-demo-302',
        itemId: 'item-demo-06',
        itemSku: 'ITEM-COFFEE-06',
        itemNameAr: 'بن هرري محمص درجة أولى 1 كجم',
        unit: 'كجم',
        unitsPerPack: 1,
        quantity: 15,
        unitPrice: 54,
        subtotal: 810,
        vatRate: 15,
        vatAmount: 121.5,
        total: 931.5,
      },
    ],
    subtotal: 1950,
    vatTotal: 292.5,
    discountTotal: 0,
    grandTotal: 2242.5,
    paidAmount: 2242.5,
    dueAmount: 0,
    createdAt: '2026-08-20T11:15:00.000Z',
  },
  // 4. Sales - فندق قصر الرياض (Unpaid)
  {
    id: 'inv-demo-004',
    invoiceNumber: 'INV-2026-004',
    type: 'SALES',
    paymentTerms: 'CREDIT',
    entityId: 'cust-demo-04',
    entityNameAr: 'فندق قصر الرياض للضيافة (عميل تجريبي)',
    date: '2026-08-28',
    dueDate: '2026-09-28',
    status: 'POSTED',
    lines: [
      {
        id: 'line-demo-401',
        itemId: 'item-demo-06',
        itemSku: 'ITEM-COFFEE-06',
        itemNameAr: 'بن هرري محمص درجة أولى 1 كجم',
        unit: 'كجم',
        unitsPerPack: 1,
        quantity: 25,
        unitPrice: 54,
        subtotal: 1350,
        vatRate: 15,
        vatAmount: 202.5,
        total: 1552.5,
      },
      {
        id: 'line-demo-402',
        itemId: 'item-demo-04',
        itemSku: 'ITEM-TEA-04',
        itemNameAr: 'شاي سيلاني فاخر 100 كيس',
        unit: 'علبة',
        unitsPerPack: 12,
        quantity: 50,
        unitPrice: 17.5,
        subtotal: 875,
        vatRate: 15,
        vatAmount: 131.25,
        total: 1006.25,
      },
      {
        id: 'line-demo-403',
        itemId: 'item-demo-07',
        itemSku: 'ITEM-WATER-07',
        itemNameAr: 'مياه معدنية طبيعية 330 مل (كرتون 40 قارورة)',
        unit: 'كرتون',
        unitsPerPack: 40,
        quantity: 40,
        unitPrice: 19,
        subtotal: 760,
        vatRate: 15,
        vatAmount: 114,
        total: 874,
      },
    ],
    subtotal: 2985,
    vatTotal: 447.75,
    discountTotal: 0,
    grandTotal: 3432.75,
    paidAmount: 0,
    dueAmount: 3432.75,
    createdAt: '2026-08-28T14:20:00.000Z',
  },
  // 5. Sales - أسواق النخبة (Recent)
  {
    id: 'inv-demo-005',
    invoiceNumber: 'INV-2026-005',
    type: 'SALES',
    paymentTerms: 'CREDIT',
    entityId: 'cust-demo-01',
    entityNameAr: 'أسواق النخبة المركزية (عميل تجريبي)',
    date: '2026-09-02',
    dueDate: '2026-10-02',
    status: 'POSTED',
    lines: [
      {
        id: 'line-demo-501',
        itemId: 'item-demo-01',
        itemSku: 'ITEM-RICE-01',
        itemNameAr: 'أرز بسمتي هندي فاخر 10 كجم',
        unit: 'كيس',
        unitsPerPack: 1,
        quantity: 20,
        unitPrice: 65,
        subtotal: 1300,
        vatRate: 15,
        vatAmount: 195,
        total: 1495,
      },
      {
        id: 'line-demo-502',
        itemId: 'item-demo-03',
        itemSku: 'ITEM-SUGAR-03',
        itemNameAr: 'سكر أبيض ناعم الأسرة 5 كجم',
        unit: 'كيس',
        unitsPerPack: 1,
        quantity: 30,
        unitPrice: 25,
        subtotal: 750,
        vatRate: 15,
        vatAmount: 112.5,
        total: 862.5,
      },
    ],
    subtotal: 2050,
    vatTotal: 307.5,
    discountTotal: 0,
    grandTotal: 2357.5,
    paidAmount: 0,
    dueAmount: 2357.5,
    createdAt: '2026-09-02T16:45:00.000Z',
  },
  // 6. Purchase - شركة صوامع الغلال (Paid)
  {
    id: 'pur-demo-001',
    invoiceNumber: 'PINV-2026-001',
    type: 'PURCHASE',
    paymentTerms: 'CREDIT',
    entityId: 'supp-demo-01',
    entityNameAr: 'شركة صوامع الغلال والمطاحن (مورد تجريبي)',
    date: '2026-07-25',
    dueDate: '2026-08-25',
    status: 'PAID',
    lines: [
      {
        id: 'line-pur-101',
        itemId: 'item-demo-01',
        itemSku: 'ITEM-RICE-01',
        itemNameAr: 'أرز بسمتي هندي فاخر 10 كجم',
        unit: 'كيس',
        unitsPerPack: 1,
        quantity: 100,
        unitPrice: 48,
        subtotal: 4800,
        vatRate: 15,
        vatAmount: 720,
        total: 5520,
      },
      {
        id: 'line-pur-102',
        itemId: 'item-demo-03',
        itemSku: 'ITEM-SUGAR-03',
        itemNameAr: 'سكر أبيض ناعم الأسرة 5 كجم',
        unit: 'كيس',
        unitsPerPack: 1,
        quantity: 150,
        unitPrice: 18,
        subtotal: 2700,
        vatRate: 15,
        vatAmount: 405,
        total: 3105,
      },
    ],
    subtotal: 7500,
    vatTotal: 1125,
    discountTotal: 0,
    grandTotal: 8625,
    paidAmount: 8625,
    dueAmount: 0,
    createdAt: '2026-07-25T08:30:00.000Z',
  },
  // 7. Purchase - المجموعة المتحدة للزيوت (Partially Paid)
  {
    id: 'pur-demo-002',
    invoiceNumber: 'PINV-2026-002',
    type: 'PURCHASE',
    paymentTerms: 'CREDIT',
    entityId: 'supp-demo-02',
    entityNameAr: 'المجموعة المتحدة للزيوت والأغذية (مورد تجريبي)',
    date: '2026-08-10',
    dueDate: '2026-09-10',
    status: 'PARTIALLY_PAID',
    lines: [
      {
        id: 'line-pur-201',
        itemId: 'item-demo-02',
        itemSku: 'ITEM-OIL-02',
        itemNameAr: 'زيت ذرة نقي عافية 5 لتر',
        unit: 'حبة',
        unitsPerPack: 4,
        quantity: 80,
        unitPrice: 34,
        subtotal: 2720,
        vatRate: 15,
        vatAmount: 408,
        total: 3128,
      },
      {
        id: 'line-pur-202',
        itemId: 'item-demo-05',
        itemSku: 'ITEM-MILK-05',
        itemNameAr: 'حليب كامل الدسم طويل الأجل (كرتون 12 لتر)',
        unit: 'كرتون',
        unitsPerPack: 12,
        quantity: 50,
        unitPrice: 44,
        subtotal: 2200,
        vatRate: 15,
        vatAmount: 330,
        total: 2530,
      },
    ],
    subtotal: 4920,
    vatTotal: 738,
    discountTotal: 0,
    grandTotal: 5658,
    paidAmount: 3000,
    dueAmount: 2658,
    createdAt: '2026-08-10T09:15:00.000Z',
  },
  // 8. Purchase - مصنع الكرتون والتغليف (Paid)
  {
    id: 'pur-demo-003',
    invoiceNumber: 'PINV-2026-003',
    type: 'PURCHASE',
    paymentTerms: 'CASH',
    entityId: 'supp-demo-03',
    entityNameAr: 'مصنع الكرتون والتغليف الخليجي (مورد تجريبي)',
    date: '2026-08-18',
    dueDate: '2026-08-18',
    status: 'PAID',
    lines: [
      {
        id: 'line-pur-301',
        itemId: 'item-demo-07',
        itemSku: 'ITEM-WATER-07',
        itemNameAr: 'مياه معدنية طبيعية 330 مل (كرتون 40 قارورة)',
        unit: 'كرتون',
        unitsPerPack: 40,
        quantity: 150,
        unitPrice: 13.5,
        subtotal: 2025,
        vatRate: 15,
        vatAmount: 303.75,
        total: 2328.75,
      },
    ],
    subtotal: 2025,
    vatTotal: 303.75,
    discountTotal: 0,
    grandTotal: 2328.75,
    paidAmount: 2328.75,
    dueAmount: 0,
    createdAt: '2026-08-18T10:00:00.000Z',
  },
];

// Sample Balanced Journals
export const DEMO_SEED_JOURNALS: JournalEntry[] = [
  // Opening Balance Journal
  {
    id: 'jv-demo-001',
    entryNumber: 'JV-2026-0001',
    date: '2026-01-01',
    reference: 'قيد افتتاحي للعام المالي 2026',
    description: 'إثبات الأرصدة الافتتاحية لحسابات البنوك والمخزون ورأس المال',
    status: 'POSTED',
    lines: [
      {
        id: 'jvl-01',
        accountId: 'acc-1111',
        accountCode: '1111',
        accountNameAr: 'مصرف الراجحي - الحساب الجاري التجريبي',
        debit: 125000,
        credit: 0,
        memo: 'رصيد افتتاحي بالبنك',
      },
      {
        id: 'jvl-02',
        accountId: 'acc-1112',
        accountCode: '1112',
        accountNameAr: 'البنك الأهلي التجاري - حساب العمليات',
        debit: 45000,
        credit: 0,
        memo: 'رصيد افتتاحي بالبنك',
      },
      {
        id: 'jvl-03',
        accountId: 'acc-1113',
        accountCode: '1113',
        accountNameAr: 'صندوق النقدية الرئيسي (الخزينة)',
        debit: 18500,
        credit: 0,
        memo: 'رصيد الصندوق الافتتاحي',
      },
      {
        id: 'jvl-04',
        accountId: 'acc-1130',
        accountCode: '1130',
        accountNameAr: 'مخزون بضاعة أول المدة',
        debit: 26500,
        credit: 0,
        memo: 'بضاعة أول المدة بالمستودع',
      },
      {
        id: 'jvl-05',
        accountId: 'acc-3100',
        accountCode: '3100',
        accountNameAr: 'رأس المال المدفوع',
        debit: 0,
        credit: 215000,
        memo: 'إثبات رأس المال',
      },
    ],
    totalDebit: 215000,
    totalCredit: 215000,
    createdAt: '2026-01-01T08:00:00.000Z',
    isAutoGenerated: false,
    sourceModule: 'OPENING',
  },
];

// Sample Vouchers
export const DEMO_SEED_VOUCHERS: PaymentVoucher[] = [
  {
    id: 'vouch-demo-01',
    voucherNumber: 'RV-2026-001',
    type: 'RECEIPT',
    date: '2026-08-07',
    entityType: 'CUSTOMER',
    entityId: 'cust-demo-01',
    entityNameAr: 'أسواق النخبة المركزية (عميل تجريبي)',
    amount: 3300.5,
    paymentMethod: 'BANK',
    bankAccountId: 'acc-1111',
    invoiceId: 'inv-demo-001',
    reference: 'تحويل بنكي سريع',
    notes: 'سداد كامل فاتورة INV-2026-001',
    status: 'POSTED',
    createdAt: '2026-08-07T10:30:00.000Z',
  },
  {
    id: 'vouch-demo-02',
    voucherNumber: 'PV-2026-001',
    type: 'PAYMENT',
    date: '2026-07-28',
    entityType: 'SUPPLIER',
    entityId: 'supp-demo-01',
    entityNameAr: 'شركة صوامع الغلال والمطاحن (مورد تجريبي)',
    amount: 8625,
    paymentMethod: 'BANK',
    bankAccountId: 'acc-1111',
    invoiceId: 'pur-demo-001',
    reference: 'سداد أمر دفع',
    notes: 'سداد كامل فاتورة الشراء PINV-2026-001',
    status: 'POSTED',
    createdAt: '2026-07-28T14:15:00.000Z',
  },
];

/**
 * Check if the active session is currently running in Demo Mode
 */
export function isDemoActive(): boolean {
  if (typeof window === 'undefined') return false;
  const compId = getCurrentCompanyId();
  if (compId === DEMO_COMPANY_ID) return true;

  const authSession = localStorage.getItem(STORAGE_KEYS.AUTH_SESSION);
  if (authSession) {
    try {
      const user = JSON.parse(authSession);
      if (user?.email === 'demo@logix-system.com' || user?.username === 'demo') {
        return true;
      }
    } catch {}
  }
  return false;
}

/**
 * Synchronize or Re-seed Demo Company data into Supabase (if connected) and local storage
 */
export async function seedDemoCompanyInSupabase(): Promise<boolean> {
  if (!isSupabaseConfigured) {
    return false;
  }

  try {
    // 1. Upsert Demo Company in Supabase 'companies' table
    await supabase.from('companies').upsert([
      {
        id: DEMO_COMPANY_ID,
        company_name: DEMO_COMPANY.nameAr,
        owner_email: DEMO_COMPANY.email,
        password_hash: 'demo_auto_login_token',
        status: 'active', // always active
        profile_data: {
          ...DEMO_COMPANY,
          is_seed_data: true,
        },
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ]);

    // 2. Upsert seed Items
    const itemsPayload = DEMO_SEED_ITEMS.map((it) => ({
      id: it.id,
      company_id: DEMO_COMPANY_ID,
      code: it.sku,
      name_ar: it.nameAr,
      name_en: it.nameEn,
      category: it.category,
      unit: it.unit,
      cost_price: it.purchasePrice,
      selling_price: it.salePrice,
      current_balance: it.quantityOnHand,
      min_limit: it.minQuantityAlert,
      raw_data: {
        ...it,
        is_seed_data: true,
      },
      created_at: '2026-01-01T00:00:00.000Z',
    }));
    await supabase.from('items').upsert(itemsPayload);

    // 3. Upsert seed Customers
    const custsPayload = DEMO_SEED_CUSTOMERS.map((c) => ({
      id: c.id,
      company_id: DEMO_COMPANY_ID,
      code: c.code,
      name_ar: c.nameAr,
      name_en: c.nameEn,
      phone: c.phone,
      address: c.address,
      city: c.city,
      balance: c.balance,
      raw_data: {
        ...c,
        is_seed_data: true,
      },
      created_at: '2026-01-01T00:00:00.000Z',
    }));
    await supabase.from('customers').upsert(custsPayload);

    // 4. Upsert seed Invoices in sales_master & sales_details
    for (const inv of DEMO_SEED_INVOICES) {
      await supabase.from('sales_master').upsert([
        {
          id: inv.id,
          company_id: DEMO_COMPANY_ID,
          invoice_number: inv.invoiceNumber,
          invoice_type: inv.type,
          date: inv.date,
          due_date: inv.dueDate,
          customer_id: inv.entityId,
          customer_name: inv.entityNameAr,
          subtotal: inv.subtotal,
          tax_amount: inv.vatTotal,
          total_amount: inv.grandTotal,
          paid_amount: inv.paidAmount,
          remaining_amount: inv.dueAmount,
          status: inv.status,
          raw_data: {
            ...inv,
            is_seed_data: true,
          },
          created_at: `${inv.date}T10:00:00.000Z`,
        },
      ]);

      const linesPayload = inv.lines.map((l) => ({
        id: l.id,
        company_id: DEMO_COMPANY_ID,
        invoice_id: inv.id,
        item_id: l.itemId,
        item_name: l.itemNameAr,
        quantity: l.quantity,
        unit_price: l.unitPrice,
        tax_rate: l.vatRate,
        tax_amount: l.vatAmount,
        total_price: l.total,
        raw_data: {
          ...l,
          is_seed_data: true,
        },
        created_at: `${inv.date}T10:00:00.000Z`,
      }));
      await supabase.from('sales_details').upsert(linesPayload);
    }

    // 5. Upsert seed Journal Entries
    for (const j of DEMO_SEED_JOURNALS) {
      await supabase.from('journal_entries').upsert([
        {
          id: j.id,
          company_id: DEMO_COMPANY_ID,
          entry_number: j.entryNumber,
          date: j.date,
          description: j.description,
          status: j.status,
          reference_type: 'OPENING',
          reference_id: j.reference,
          lines: j.lines,
          raw_data: {
            ...j,
            is_seed_data: true,
          },
          created_at: j.createdAt,
        },
      ]);
    }

    return true;
  } catch (err) {
    console.warn('Supabase seedDemoCompany warning:', err);
    return false;
  }
}

/**
 * Reset Demo Data: Removes any newly created data and restores pristine seed data
 */
export async function resetDemoCompanyData(): Promise<{ success: boolean; message: string }> {
  try {
    // 1. Reset Local Storage Demo Keys
    if (typeof window !== 'undefined') {
      localStorage.setItem('alwaleed_erp_company_demo', JSON.stringify(DEMO_COMPANY));
      localStorage.setItem('alwaleed_erp_items_demo', JSON.stringify(DEMO_SEED_ITEMS));
      localStorage.setItem('alwaleed_erp_customers_demo', JSON.stringify(DEMO_SEED_CUSTOMERS));
      localStorage.setItem('alwaleed_erp_suppliers_demo', JSON.stringify(DEMO_SEED_SUPPLIERS));
      localStorage.setItem('alwaleed_erp_invoices_demo', JSON.stringify(DEMO_SEED_INVOICES));
      localStorage.setItem('alwaleed_erp_journals_demo', JSON.stringify(DEMO_SEED_JOURNALS));
      localStorage.setItem('alwaleed_erp_vouchers_demo', JSON.stringify(DEMO_SEED_VOUCHERS));
      localStorage.setItem('alwaleed_erp_accounts_demo', JSON.stringify(INITIAL_ACCOUNTS));
      localStorage.setItem('alwaleed_erp_units_demo', JSON.stringify(INITIAL_UNITS));
      localStorage.setItem('alwaleed_erp_production_orders_demo', JSON.stringify([]));
      localStorage.setItem(DEMO_RESET_KEY, String(Date.now()));
    }

    // 2. If Supabase is connected, purge unseeded records and re-seed
    if (isSupabaseConfigured) {
      // Re-seed original data
      await seedDemoCompanyInSupabase();
    }

    return {
      success: true,
      message: 'تمت إعادة ضبط بيانات الشركة التجريبية واستعادة النسخة الأصلية بنجاح.',
    };
  } catch (err: any) {
    console.error('Reset demo company error:', err);
    return {
      success: false,
      message: err?.message || 'حدث خطأ أثناء إعادة ضبط بيانات الديمو',
    };
  }
}

/**
 * Check if the demo company requires an auto-reset (e.g. every 6 hours)
 */
export function checkAndAutoResetDemo(): void {
  if (typeof window === 'undefined') return;
  const lastResetStr = localStorage.getItem(DEMO_RESET_KEY);
  const now = Date.now();
  const SIX_HOURS = 6 * 60 * 60 * 1000;

  if (!lastResetStr || now - Number(lastResetStr) > SIX_HOURS) {
    resetDemoCompanyData().catch((e) => console.warn('Auto reset demo warning:', e));
  }
}
