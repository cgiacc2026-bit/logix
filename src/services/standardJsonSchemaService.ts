/**
 * Standard Logix Enterprise ERP JSON Schema & Template Definition
 * 
 * Provides official JSON Schema (Draft-07), sample templates, and validation utilities
 * for all system modules: Accounting, Sales, Purchasing, Inventory, POS, and Settings.
 */

export const LOGIX_ERP_JSON_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "LogixEnterpriseERPBackupSchema",
  description: "Standard data interchange and backup format for Logix Enterprise ERP",
  type: "object",
  required: ["version"],
  properties: {
    version: {
      type: "string",
      description: "Format version (e.g. '2.5.0')",
      default: "2.5.0"
    },
    exportDate: {
      type: "string",
      format: "date-time",
      description: "ISO-8601 timestamp of data export"
    },
    system: {
      type: "string",
      default: "Logix Enterprise Cloud ERP"
    },
    company: {
      type: "object",
      description: "Primary enterprise identity and regional compliance",
      required: ["nameAr"],
      properties: {
        id: { type: "string", description: "Unique UUID or identifier" },
        nameAr: { type: "string", description: "اسم المنشأة بالعربية" },
        nameEn: { type: "string", description: "Company legal name in English" },
        crNumber: { type: "string", description: "رقم السجل التجاري" },
        taxNumber: { type: "string", description: "الرقم الضريبي VAT" },
        currency: { type: "string", default: "KWD", description: "العملة الأساسية (KWD, SAR, USD, etc.)" },
        phone: { type: "string" },
        email: { type: "string", format: "email" },
        address: { type: "string" },
        city: { type: "string" },
        country: { type: "string" }
      }
    },
    accounts: {
      type: "array",
      description: "شجرة الحسابات العامة (Chart of Accounts)",
      items: {
        type: "object",
        required: ["code", "nameAr", "category"],
        properties: {
          id: { type: "string" },
          code: { type: "string", description: "رمز الحساب الرقمي (e.g., 1110, 1210, 4101)" },
          nameAr: { type: "string", description: "اسم الحساب بالعربية" },
          nameEn: { type: "string" },
          category: {
            type: "string",
            enum: ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"],
            description: "التصنيف المحاسبي الرئيسي"
          },
          normalBalance: {
            type: "string",
            enum: ["DEBIT", "CREDIT"],
            description: "طبيعة رصيد الحساب (مدين / دائن)"
          },
          level: { type: "integer", minimum: 1, maximum: 5, default: 4 },
          type: {
            type: "string",
            enum: ["HEADER", "DETAIL"],
            default: "DETAIL",
            description: "رئيسي تجميعي أو فرعي يقبل الحركة"
          },
          parentCode: { type: "string", description: "رمز الحساب الأب التجميعي" },
          balance: { type: "number", default: 0 },
          isActive: { type: "boolean", default: true },
          is_fallback: { type: "boolean", description: "هل تم إنشاؤه آلياً كبيان افتراضي أثناء الاستيراد" }
        }
      }
    },
    customers: {
      type: "array",
      description: "سجل العملاء والمدينين (Customers & Debtors)",
      items: {
        type: "object",
        required: ["nameAr"],
        properties: {
          id: { type: "string" },
          code: { type: "string", description: "كود العميل الفريد" },
          nameAr: { type: "string", description: "اسم العميل بالعربية" },
          nameEn: { type: "string" },
          phone: { type: "string" },
          taxNumber: { type: "string", description: "الرقم الضريبي للعميل" },
          address: { type: "string" },
          city: { type: "string" },
          creditLimit: { type: "number", default: 0 },
          openingBalance: { type: "number", default: 0 },
          balance: { type: "number", default: 0 },
          accountId: { type: "string", description: "ربط الحساب الفرعي في الأستاذ المساعد" },
          isActive: { type: "boolean", default: true },
          is_fallback: { type: "boolean" }
        }
      }
    },
    suppliers: {
      type: "array",
      description: "سجل الموردين والدائنين (Suppliers & Creditors)",
      items: {
        type: "object",
        required: ["nameAr"],
        properties: {
          id: { type: "string" },
          code: { type: "string", description: "كود المورد الفريد" },
          nameAr: { type: "string", description: "اسم المورد بالعربية" },
          nameEn: { type: "string" },
          phone: { type: "string" },
          taxNumber: { type: "string" },
          address: { type: "string" },
          openingBalance: { type: "number", default: 0 },
          balance: { type: "number", default: 0 },
          accountId: { type: "string" },
          isActive: { type: "boolean", default: true },
          is_fallback: { type: "boolean" }
        }
      }
    },
    inventory: {
      type: "array",
      description: "كتالوج الأصناف والمخزون (Inventory Items & Catalog)",
      items: {
        type: "object",
        required: ["nameAr"],
        properties: {
          id: { type: "string" },
          sku: { type: "string", description: "رمز التخزين التعريفي SKU / كود الصنف" },
          barcode: { type: "string" },
          nameAr: { type: "string", description: "اسم الصنف بالعربية" },
          nameEn: { type: "string" },
          category: { type: "string", default: "عام" },
          unit: { type: "string", default: "حبة", description: "وحدة القياس الأساسية" },
          costPrice: { type: "number", minimum: 0, default: 0, description: "سعر التكلفة المعياري / المتوسط المرجح" },
          salePrice: { type: "number", minimum: 0, default: 0, description: "سعر البيع الافتراضي" },
          quantityOnHand: { type: "number", default: 0, description: "الرصيد المخزني الفعلي المتاح" },
          minQuantityAlert: { type: "number", default: 10, description: "حد إعادة الطلب للتنبيه" },
          warehouseId: { type: "string", default: "wh-main-01" },
          isActive: { type: "boolean", default: true },
          is_fallback: { type: "boolean" }
        }
      }
    },
    invoices: {
      type: "array",
      description: "فواتير المبيعات والمشتريات والمردودات (Invoices)",
      items: {
        type: "object",
        required: ["invoiceNumber", "type", "date", "lines"],
        properties: {
          id: { type: "string" },
          invoiceNumber: { type: "string", description: "رقم الفاتورة التسلسلي (INV-YYYY-XXXX)" },
          type: {
            type: "string",
            enum: ["SALES", "PURCHASE", "SALES_RETURN", "PURCHASE_RETURN"],
            description: "نوع الفاتورة"
          },
          date: { type: "string", format: "date", description: "تاريخ الفاتورة (YYYY-MM-DD)" },
          dueDate: { type: "string", format: "date" },
          entityId: { type: "string", description: "معرف العميل أو المورد" },
          entityNameAr: { type: "string", description: "اسم العميل/المورد (للاستيراد التلقائي)" },
          paymentMethod: {
            type: "string",
            enum: ["CASH", "BANK", "CREDIT", "SPLIT"],
            default: "CASH"
          },
          status: {
            type: "string",
            enum: ["DRAFT", "POSTED", "PAID", "CANCELLED"],
            default: "POSTED"
          },
          warehouseId: { type: "string", default: "wh-main-01" },
          subtotal: { type: "number", minimum: 0 },
          taxAmount: { type: "number", minimum: 0, default: 0 },
          discountAmount: { type: "number", default: 0 },
          totalAmount: { type: "number", minimum: 0 },
          paidAmount: { type: "number", default: 0 },
          remainingAmount: { type: "number", default: 0 },
          journalEntryId: { type: "string", description: "معرف القيد المحاسبي المزدوج المرتبط" },
          notes: { type: "string" },
          lines: {
            type: "array",
            description: "بنود وأصناف الفاتورة",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                itemId: { type: "string", description: "معرف الصنف" },
                sku: { type: "string", description: "كود الصنف / SKU" },
                itemName: { type: "string", description: "اسم الصنف الموصوف" },
                quantity: { type: "number", minimum: 0.001 },
                unit: { type: "string", default: "حبة" },
                unitPrice: { type: "number", minimum: 0 },
                costPrice: { type: "number", default: 0 },
                taxRate: { type: "number", default: 0 },
                taxAmount: { type: "number", default: 0 },
                discountAmount: { type: "number", default: 0 },
                total: { type: "number", minimum: 0 }
              }
            }
          }
        }
      }
    },
    vouchers: {
      type: "array",
      description: "سندات القبض والصرف (Receipt & Payment Vouchers)",
      items: {
        type: "object",
        required: ["voucherNumber", "type", "date", "amount"],
        properties: {
          id: { type: "string" },
          voucherNumber: { type: "string", description: "رقم السند التسلسلي" },
          type: {
            type: "string",
            enum: ["RECEIPT", "PAYMENT"],
            description: "نوع السند: RECEIPT (قبض من عميل) أو PAYMENT (صرف لمورد/مصروف)"
          },
          date: { type: "string", format: "date" },
          entityId: { type: "string", description: "معرف العميل أو المورد" },
          entityNameAr: { type: "string" },
          amount: { type: "number", minimum: 0.001 },
          paymentMethod: {
            type: "string",
            enum: ["CASH", "BANK", "CHEQUE"],
            default: "CASH"
          },
          accountId: { type: "string", description: "معرف حساب الصندوق أو البنك" },
          accountCode: { type: "string", description: "رمز حساب الخزينة أو البنك (1110 / 1120)" },
          description: { type: "string" },
          reference: { type: "string" },
          status: {
            type: "string",
            enum: ["POSTED", "CANCELLED"],
            default: "POSTED"
          },
          journalEntryId: { type: "string" }
        }
      }
    },
    journals: {
      type: "array",
      description: "قيود اليومية المزدوجة المتوازنة (Double-Entry Journal Entries)",
      items: {
        type: "object",
        required: ["entryNumber", "date", "lines"],
        properties: {
          id: { type: "string" },
          entryNumber: { type: "string", description: "رقم القيد التسلسلي (JV-YYYY-XXXX)" },
          date: { type: "string", format: "date" },
          reference: { type: "string", description: "المرجع الخارجي أو رقم الفاتورة/السند" },
          description: { type: "string", description: "شرح وبيان القيد المحاسبي" },
          status: {
            type: "string",
            enum: ["POSTED", "REVERSED", "DRAFT"],
            default: "POSTED"
          },
          sourceModule: {
            type: "string",
            enum: ["MANUAL", "SALES", "PURCHASE", "VOUCHER", "INVENTORY", "PAYROLL", "CLOSING"],
            default: "MANUAL"
          },
          totalDebit: { type: "number", minimum: 0 },
          totalCredit: { type: "number", minimum: 0 },
          isAutoGenerated: { type: "boolean", default: false },
          lines: {
            type: "array",
            description: "أطراف القيد (مدين / دائن)",
            minItems: 2,
            items: {
              type: "object",
              required: ["debit", "credit"],
              properties: {
                id: { type: "string" },
                accountId: { type: "string" },
                accountCode: { type: "string", description: "رمز الحساب (مثل 1110، 4101)" },
                accountNameAr: { type: "string" },
                debit: { type: "number", minimum: 0, default: 0 },
                credit: { type: "number", minimum: 0, default: 0 },
                memo: { type: "string" },
                entityId: { type: "string" }
              }
            }
          }
        }
      }
    },
    warehouses: {
      type: "array",
      description: "سجل المستودعات والمخازن",
      items: {
        type: "object",
        required: ["nameAr"],
        properties: {
          id: { type: "string" },
          code: { type: "string" },
          nameAr: { type: "string" },
          nameEn: { type: "string" },
          location: { type: "string" },
          isDefault: { type: "boolean", default: false }
        }
      }
    },
    units: {
      type: "array",
      description: "وحدات القياس المعيارية",
      items: {
        type: "object",
        required: ["nameAr"],
        properties: {
          id: { type: "string" },
          code: { type: "string" },
          nameAr: { type: "string" },
          symbol: { type: "string" },
          factor: { type: "number", default: 1 }
        }
      }
    }
  }
};

/**
 * Returns the formal Draft-07 JSON Schema
 */
export function getStandardJsonSchema(): object {
  return LOGIX_ERP_JSON_SCHEMA;
}

/**
 * Generates an executive compliant JSON template with realistic sample data
 */
export function getSampleStandardBackup(companyInfo?: any): object {
  const comp = companyInfo || {
    nameAr: "شركة لوجيكس للتجارة العامة والمقاولات ذ.م.م",
    nameEn: "Logix General Trading & Contracting W.L.L",
    crNumber: "10492837",
    taxNumber: "300918273645003",
    currency: "KWD",
    phone: "+965 2200 4400",
    email: "info@logixerp.example",
    address: "مدينة الكويت - برج التجارة - الدور 18"
  };

  return {
    version: "2.5.0",
    exportDate: new Date().toISOString(),
    system: "Logix Enterprise Cloud ERP",
    company: comp,
    accounts: [
      { code: "1110", nameAr: "الصندوق والخزينة الرئيسية", category: "ASSET", normalBalance: "DEBIT", level: 4, type: "DETAIL" },
      { code: "1120", nameAr: "البنك والحسابات الجارية", category: "ASSET", normalBalance: "DEBIT", level: 4, type: "DETAIL" },
      { code: "1210", nameAr: "العملاء والمدينون التجاريون", category: "ASSET", normalBalance: "DEBIT", level: 4, type: "DETAIL" },
      { code: "1250", nameAr: "ضريبة القيمة المضافة المدخلات (استرداد)", category: "ASSET", normalBalance: "DEBIT", level: 4, type: "DETAIL" },
      { code: "1310", nameAr: "مخزون البضائع والمستودعات", category: "ASSET", normalBalance: "DEBIT", level: 4, type: "DETAIL" },
      { code: "2110", nameAr: "الموردون والدائنون التجاريون", category: "LIABILITY", normalBalance: "CREDIT", level: 4, type: "DETAIL" },
      { code: "2150", nameAr: "ضريبة القيمة المضافة المخرجات (مستحقة)", category: "LIABILITY", normalBalance: "CREDIT", level: 4, type: "DETAIL" },
      { code: "3110", nameAr: "رأس مال المنشأة", category: "EQUITY", normalBalance: "CREDIT", level: 4, type: "DETAIL" },
      { code: "3999", nameAr: "حساب تسويات وفروقات القيود المستوردة", category: "EQUITY", normalBalance: "CREDIT", level: 4, type: "DETAIL" },
      { code: "4101", nameAr: "إيرادات المبيعات والخدمات", category: "REVENUE", normalBalance: "CREDIT", level: 4, type: "DETAIL" },
      { code: "5101", nameAr: "تكلفة البضاعة المباعة والمشتريات", category: "EXPENSE", normalBalance: "DEBIT", level: 4, type: "DETAIL" }
    ],
    customers: [
      { code: "CUST-0001", nameAr: "مؤسسة الأفق للتوريدات العامة", phone: "+965 99887766", taxNumber: "300123456700003", openingBalance: 0, balance: 450.000 }
    ],
    suppliers: [
      { code: "SUPP-0001", nameAr: "شركة المطاحن والصوامع الحديثة", phone: "+965 24881122", taxNumber: "300987654300003", openingBalance: 0, balance: 1200.000 }
    ],
    inventory: [
      { sku: "SKU-1001", barcode: "628100100201", nameAr: "بهارات مشكلة فاخرة درجة أولى 1 كجم", category: "توابل معبأة", unit: "كجم", costPrice: 2.200, salePrice: 3.500, quantityOnHand: 150, minQuantityAlert: 20 }
    ],
    invoices: [
      {
        invoiceNumber: "INV-2026-0001",
        type: "SALES",
        date: new Date().toISOString().split('T')[0],
        entityNameAr: "مؤسسة الأفق للتوريدات العامة",
        paymentMethod: "CREDIT",
        status: "POSTED",
        subtotal: 450.000,
        taxAmount: 0,
        totalAmount: 450.000,
        paidAmount: 0,
        remainingAmount: 450.000,
        lines: [
          { sku: "SKU-1001", itemName: "بهارات مشكلة فاخرة درجة أولى 1 كجم", quantity: 150, unit: "كجم", unitPrice: 3.000, total: 450.000 }
        ]
      }
    ],
    vouchers: [
      {
        voucherNumber: "RCV-2026-0001",
        type: "RECEIPT",
        date: new Date().toISOString().split('T')[0],
        entityNameAr: "مؤسسة الأفق للتوريدات العامة",
        amount: 200.000,
        paymentMethod: "CASH",
        accountCode: "1110",
        description: "دفعة نقدية تحت الحساب على فاتورة INV-2026-0001",
        status: "POSTED"
      }
    ],
    journals: [
      {
        entryNumber: "JV-2026-0001",
        date: new Date().toISOString().split('T')[0],
        reference: "INV-2026-0001",
        description: "قيد إثبات استحقاق فاتورة مبيعات INV-2026-0001",
        status: "POSTED",
        sourceModule: "SALES",
        totalDebit: 450.000,
        totalCredit: 450.000,
        isAutoGenerated: true,
        lines: [
          { accountCode: "1210", accountNameAr: "العملاء والمدينون التجاريون", debit: 450.000, credit: 0, memo: "إثبات مديونية عميل" },
          { accountCode: "4101", accountNameAr: "إيرادات المبيعات والخدمات", debit: 0, credit: 450.000, memo: "إثبات إيراد مبيعات" }
        ]
      }
    ],
    warehouses: [
      { id: "wh-main-01", code: "WH-01", nameAr: "المستودع الرئيسي المركزي", location: "منطقة الشويخ الصناعية", isDefault: true }
    ],
    units: [
      { id: "unit-pc", code: "PC", nameAr: "حبة / قطعة", symbol: "حبة", factor: 1 },
      { id: "unit-kg", code: "KG", nameAr: "كيلوجرام", symbol: "كجم", factor: 1 }
    ]
  };
}

/**
 * Validates and audits an arbitrary input JSON against the standard schema.
 * Returns non-blocking diagnostic reports and recommendations.
 */
export function auditImportJsonStructure(data: any): {
  isValid: boolean;
  score: number;
  detectedModules: string[];
  missingRecommendedFields: string[];
  recommendations: string[];
} {
  if (!data || typeof data !== 'object') {
    return {
      isValid: false,
      score: 0,
      detectedModules: [],
      missingRecommendedFields: ['Root JSON object'],
      recommendations: ['يجب أن يكون الملف كائن JSON صالحاً وليس مصفوفة أو نص مجرد.']
    };
  }

  const detectedModules: string[] = [];
  const missingRecommendedFields: string[] = [];
  const recommendations: string[] = [];

  let score = 0;

  if (Array.isArray(data.accounts) && data.accounts.length > 0) {
    detectedModules.push(`الحسابات (${data.accounts.length})`);
    score += 15;
  } else {
    missingRecommendedFields.push('accounts (شجرة الحسابات)');
    recommendations.push('لم يتم العثور على شجرة حسابات في الملف، سيقوم النظام تلقائياً بتوليد واستخدام الحسابات الافتراضية.');
  }

  if (Array.isArray(data.customers) && data.customers.length > 0) {
    detectedModules.push(`العملاء (${data.customers.length})`);
    score += 15;
  }
  if (Array.isArray(data.suppliers) && data.suppliers.length > 0) {
    detectedModules.push(`الموردين (${data.suppliers.length})`);
    score += 15;
  }
  if (Array.isArray(data.inventory) && data.inventory.length > 0) {
    detectedModules.push(`المخزون (${data.inventory.length})`);
    score += 15;
  }
  if (Array.isArray(data.invoices) && data.invoices.length > 0) {
    detectedModules.push(`الفواتير (${data.invoices.length})`);
    score += 20;
  }
  if (Array.isArray(data.vouchers) && data.vouchers.length > 0) {
    detectedModules.push(`السندات (${data.vouchers.length})`);
    score += 10;
  }
  if (Array.isArray(data.journals) && data.journals.length > 0) {
    detectedModules.push(`القيود المحاسبية (${data.journals.length})`);
    score += 10;
  } else if (Array.isArray(data.invoices) && data.invoices.length > 0) {
    recommendations.push('الفواتير لا تحتوي على قيود محاسبية، سيقوم النظام بتوليد القيود المزدوجة المتوازنة آلياً وفورياً.');
  }

  return {
    isValid: true,
    score: Math.min(100, Math.max(score, 20)),
    detectedModules,
    missingRecommendedFields,
    recommendations
  };
}
