import * as XLSX from 'xlsx';
import {
  Account,
  JournalEntry,
  Customer,
  Supplier,
  Invoice,
  PaymentVoucher,
  InventoryItem,
  ProductionOrder,
  UnitDefinition,
  CompanyProfile,
  SystemUser,
} from '../types.js';
import { DataService, localDataStore } from './dataService.ts';

export interface SystemDataSnapshot {
  company: CompanyProfile | null;
  accounts: Account[];
  journals: JournalEntry[];
  customers: Customer[];
  suppliers: Supplier[];
  invoices: Invoice[];
  vouchers: PaymentVoucher[];
  inventory: InventoryItem[];
  productionOrders: ProductionOrder[];
  units: UnitDefinition[];
  users: SystemUser[];
}

export class ExcelBackupService {
  /**
   * جلب أحدث البيانات الحالية من التخزين المحلي وقاعدة البيانات
   */
  public static getFullSystemSnapshot(): SystemDataSnapshot {
    return {
      company: localDataStore.getCompany(),
      accounts: localDataStore.getAccounts(),
      journals: localDataStore.getJournals(),
      customers: localDataStore.getCustomers(),
      suppliers: localDataStore.getSuppliers(),
      invoices: localDataStore.getInvoices(),
      vouchers: localDataStore.getVouchers(),
      inventory: localDataStore.getInventory(),
      productionOrders: localDataStore.getProductionOrders(),
      units: localDataStore.getUnits(),
      users: localDataStore.getUsers(),
    };
  }

  /**
   * تصدير نسخة احتياطية شاملة لجميع بيانات النظام إلى ملف Excel متعدد الصفحات
   */
  public static async exportFullSystemBackupToExcel(snapshot?: SystemDataSnapshot): Promise<void> {
    const data = snapshot || this.getFullSystemSnapshot();
    const company = data.company;
    const companyName = company?.nameAr || 'مطحنة الوليد المتحدة';
    const dateStr = new Date().toISOString().split('T')[0];
    const timestampStr = new Date().toLocaleTimeString('ar-KW', { hour12: false });

    // إنشاء مصنف Excel جديد
    const wb = XLSX.utils.book_new();

    // -------------------------------------------------------------
    // 1. ورقة بيانات المنشأة والإحصائيات العامة (Company Info)
    // -------------------------------------------------------------
    const companySheetData = [
      { 'البيان': 'اسم المنشأة بالعربي', 'القيمة': company?.nameAr || 'مطحنة الوليد المتحدة للتجارة العامة والمقاولات' },
      { 'البيان': 'اسم المنشأة بالإنجليزي', 'القيمة': company?.nameEn || 'Alwaleed United Mill & General Trading' },
      { 'البيان': 'الرقم الضريبي', 'القيمة': company?.taxNumber || '300012345600003' },
      { 'البيان': 'رقم السجل التجاري', 'القيمة': company?.crNumber || '450912' },
      { 'البيان': 'العملة الأساسية', 'القيمة': company?.currency || 'KWD' },
      { 'البيان': 'الهاتف', 'القيمة': company?.phone || '+965 2244 5566' },
      { 'البيان': 'البريد الإلكتروني', 'القيمة': company?.email || 'alwaleedmill@gmail.com' },
      { 'البيان': 'العنوان', 'القيمة': `${company?.streetName || ''} ${company?.district || ''} ${company?.city || ''}`.trim() || 'الشويخ الصناعية، شارع البنوك، قطعة 1' },
      { 'البيان': 'الدولة / المدينة', 'القيمة': `${company?.country || 'الكويت'} - ${company?.city || 'مدينة الكويت'}` },
      { 'البيان': 'تاريخ التأسيس', 'القيمة': company?.fiscalYearStart || '2026-01-01' },
      { 'البيان': 'تاريخ استخراج النسخة الاحتياطية', 'القيمة': `${dateStr} ${timestampStr}` },
      { 'البيان': 'إجمالي عدد الحسابات بدليل الحسابات', 'القيمة': data.accounts.length },
      { 'البيان': 'إجمالي عدد القيود اليومية', 'القيمة': data.journals.length },
      { 'البيان': 'إجمالي عدد العملاء', 'القيمة': data.customers.length },
      { 'البيان': 'إجمالي عدد الموردين', 'القيمة': data.suppliers.length },
      { 'البيان': 'إجمالي عدد الفواتير', 'القيمة': data.invoices.length },
      { 'البيان': 'إجمالي عدد السندات المالية', 'القيمة': data.vouchers.length },
      { 'البيان': 'إجمالي عدد أصناف المخزون', 'القيمة': data.inventory.length },
      { 'البيان': 'إجمالي عدد أوامر الإنتاج', 'القيمة': data.productionOrders.length },
    ];
    const wsCompany = XLSX.utils.json_to_sheet(companySheetData);
    XLSX.utils.book_append_sheet(wb, wsCompany, 'بيانات المنشأة');

    // -------------------------------------------------------------
    // 2. ورقة دليل الحسابات (Chart of Accounts)
    // -------------------------------------------------------------
    const accountsData = data.accounts.map((acc, index) => {
      // احتساب الرصيد الحالي من القيود
      let totalDeb = 0;
      let totalCred = 0;
      data.journals
        .filter((j) => j.status === 'POSTED')
        .forEach((j) => {
          j.lines?.forEach((l) => {
            if (l.accountId === acc.id || l.accountCode === acc.code) {
              totalDeb += Number(l.debit) || 0;
              totalCred += Number(l.credit) || 0;
            }
          });
        });

      const netBalance = acc.normalBalance === 'DEBIT' ? totalDeb - totalCred : totalCred - totalDeb;

      return {
        'م': index + 1,
        'رمز الحساب': acc.code,
        'اسم الحساب (عربي)': acc.nameAr,
        'اسم الحساب (إنجليزي)': acc.nameEn || '',
        'التصنيف المحاسبي': getAccountCategoryLabel(acc.category),
        'طبيعة الرصيد': acc.normalBalance === 'DEBIT' ? 'مدين (Debit)' : 'دائن (Credit)',
        'المستوى': acc.level,
        'إجمالي المدين': Math.round(totalDeb * 1000) / 1000,
        'إجمالي الدائن': Math.round(totalCred * 1000) / 1000,
        'الرصيد الدفتري الحالي': Math.round(netBalance * 1000) / 1000,
        'نوع الحساب': acc.isSystem ? 'حساب نظام رئيسي' : 'حساب تشغيلي',
        'الحالة': acc.isActive !== false ? 'نشط' : 'معطل',
        'ملاحظات / الوصف': acc.description || '',
      };
    });
    const wsAccounts = XLSX.utils.json_to_sheet(accountsData);
    XLSX.utils.book_append_sheet(wb, wsAccounts, 'دليل الحسابات');

    // -------------------------------------------------------------
    // 3. ورقة قيود اليومية العامة التفصيلية (Journal Entries & Lines)
    // -------------------------------------------------------------
    const journalLinesData: any[] = [];
    data.journals.forEach((j) => {
      if (!j.lines || j.lines.length === 0) {
        journalLinesData.push({
          'رقم القيد': j.entryNumber,
          'تاريخ القيد': j.date,
          'المرجع': j.reference || '',
          'البيان العام': j.description || '',
          'حالة القيد': getJournalStatusLabel(j.status),
          'رمز الحساب': '',
          'اسم الحساب': '',
          'الطرف / الكيان المستفيد': '',
          'مدين': 0,
          'دائن': 0,
          'بيان السطر': '',
          'مصدر القيد': j.isAutoGenerated ? 'آلي من النظام' : 'يدوي',
          'تاريخ الترحيل': j.postedAt || j.createdAt || '',
        });
      } else {
        j.lines.forEach((line) => {
          journalLinesData.push({
            'رقم القيد': j.entryNumber,
            'تاريخ القيد': j.date,
            'المرجع': j.reference || '',
            'البيان العام': j.description || '',
            'حالة القيد': getJournalStatusLabel(j.status),
            'رمز الحساب': line.accountCode,
            'اسم الحساب': line.accountNameAr,
            'الطرف / الكيان المستفيد': line.entityNameAr || (line.entityType === 'CUSTOMER' ? 'عميل' : line.entityType === 'SUPPLIER' ? 'مورد' : 'عام'),
            'مدين': Number(line.debit) || 0,
            'دائن': Number(line.credit) || 0,
            'بيان السطر': line.memo || j.description || '',
            'مصدر القيد': j.isAutoGenerated ? `آلي (${j.sourceModule || 'نظام'})` : 'يدوي',
            'تاريخ الترحيل': j.postedAt || j.createdAt || '',
          });
        });
      }
    });
    const wsJournals = XLSX.utils.json_to_sheet(journalLinesData);
    XLSX.utils.book_append_sheet(wb, wsJournals, 'قيود اليومية والسندات');

    // -------------------------------------------------------------
    // 4. ورقة العملاء والجمعيات (Customers)
    // -------------------------------------------------------------
    const customersData = data.customers.map((c, index) => ({
      'م': index + 1,
      'كود العميل': c.code,
      'اسم العميل / الجمعية': c.nameAr,
      'الاسم بالإنجليزي': c.nameEn || '',
      'الرقم الضريبي': c.taxNumber || '',
      'رقم الهاتف': c.phone || '',
      'المحافظة': c.governorate || '',
      'المنطقة / المدينة': c.city || '',
      'العنوان التفصيلي': c.address || '',
      'الرصيد الافتتاحي': Number(c.openingBalance) || 0,
      'تاريخ الرصيد الافتتاحي': c.openingBalanceDate || '2026-01-01',
      'الرصيد الفعلي الحالي': Number(c.balance) || 0,
      'سقف الائتمان': c.creditLimit || 0,
      'الحالة': c.isActive !== false ? 'نشط' : 'معطل',
    }));
    const wsCustomers = XLSX.utils.json_to_sheet(customersData);
    XLSX.utils.book_append_sheet(wb, wsCustomers, 'العملاء والجمعيات');

    // -------------------------------------------------------------
    // 5. ورقة الموردين والشركات (Suppliers)
    // -------------------------------------------------------------
    const suppliersData = data.suppliers.map((s, index) => ({
      'م': index + 1,
      'كود المورد': s.code,
      'اسم الشركة الموردة': s.nameAr,
      'الاسم بالإنجليزي': s.nameEn || '',
      'الرقم الضريبي': s.taxNumber || '',
      'رقم الهاتف': s.phone || '',
      'البريد الإلكتروني': s.email || '',
      'العنوان': s.address || '',
      'الرصيد الافتتاحي': Number(s.openingBalance) || 0,
      'الرصيد الفعلي الحالي المستحق': Number(s.balance) || 0,
      'سقف الائتمان': s.creditLimit || 0,
      'الحالة': s.isActive !== false ? 'نشط' : 'معطل',
    }));
    const wsSuppliers = XLSX.utils.json_to_sheet(suppliersData);
    XLSX.utils.book_append_sheet(wb, wsSuppliers, 'الموردين والشركات');

    // -------------------------------------------------------------
    // 6. ورقة الفواتير (Invoices Overview)
    // -------------------------------------------------------------
    const invoicesData = data.invoices.map((inv, index) => ({
      'م': index + 1,
      'رقم الفاتورة': inv.invoiceNumber,
      'نوع الفاتورة': getInvoiceTypeLabel(inv.type),
      'التاريخ': inv.date,
      'اسم الطرف (العميل / المورد)': inv.entityNameAr,
      'شروط الدفع': inv.paymentTerms === 'CASH' ? 'نقداً (كاش)' : 'آجل (ذمم)',
      'الإجمالي قبل الخصم': Number(inv.subtotal) || 0,
      'قيمة الخصم': Number(inv.discountTotal) || 0,
      'قيمة الضريبة': Number(inv.vatTotal) || 0,
      'صافي الفاتورة الإجمالي': Number(inv.grandTotal) || 0,
      'المبلغ المدفوع': Number(inv.paidAmount) || 0,
      'المبلغ المتبقي': Number(inv.dueAmount) || 0,
      'حالة الفاتورة': getInvoiceStatusLabel(inv.status),
      'رقم القيد المحاسبي المرتبط': inv.journalEntryId || '',
      'ملاحظات': inv.notes || '',
    }));
    const wsInvoices = XLSX.utils.json_to_sheet(invoicesData);
    XLSX.utils.book_append_sheet(wb, wsInvoices, 'فواتير المبيعات والمشتريات');

    // -------------------------------------------------------------
    // 7. ورقة بنود وتفاصيل الفواتير (Invoice Line Items)
    // -------------------------------------------------------------
    const invoiceItemsData: any[] = [];
    data.invoices.forEach((inv) => {
      inv.lines?.forEach((line, itemIdx) => {
        invoiceItemsData.push({
          'رقم الفاتورة': inv.invoiceNumber,
          'تاريخ الفاتورة': inv.date,
          'نوع الفاتورة': getInvoiceTypeLabel(inv.type),
          'العميل / المورد': inv.entityNameAr,
          'بند #': itemIdx + 1,
          'كود الصنف': line.itemSku || '',
          'اسم الصنف': line.itemNameAr,
          'الكمية': Number(line.quantity) || 0,
          'الوحدة': line.unit || 'حبة',
          'الشد (حبات بالعبوة)': line.unitsPerPack || 1,
          'سعر الوحدة': Number(line.unitPrice) || 0,
          'الإجمالي الفرعي': Number(line.subtotal) || 0,
          'الخصم': Number(line.discountAmount) || 0,
          'الضريبة': Number(line.vatAmount) || 0,
          'الصافي الإجمالي': Number(line.total) || 0,
        });
      });
    });
    const wsInvoiceItems = XLSX.utils.json_to_sheet(invoiceItemsData);
    XLSX.utils.book_append_sheet(wb, wsInvoiceItems, 'بنود وتفاصيل الفواتير');

    // -------------------------------------------------------------
    // 8. ورقة سندات القبض والصرف (Payment & Receipt Vouchers)
    // -------------------------------------------------------------
    const vouchersData = data.vouchers.map((v, index) => ({
      'م': index + 1,
      'رقم السند': v.voucherNumber,
      'نوع السند': v.type === 'RECEIPT' ? 'سند قبض نقدية/بنك' : 'سند صرف وسداد',
      'التاريخ': v.date,
      'الطرف المستفيد': v.entityNameAr || '',
      'المبلغ': Number(v.amount) || 0,
      'طريقة الدفع': getPaymentMethodLabel(v.paymentMethod),
      'رقم المرجع / الشيك': v.reference || '',
      'البيان والشرح': v.notes || '',
      'رقم القيد المحاسبي': v.journalEntryId || '',
    }));
    const wsVouchers = XLSX.utils.json_to_sheet(vouchersData);
    XLSX.utils.book_append_sheet(wb, wsVouchers, 'سندات القبض والصرف');

    // -------------------------------------------------------------
    // 9. ورقة المخزون والمنتجات (Inventory & Stock)
    // -------------------------------------------------------------
    const inventoryData = data.inventory.map((item, index) => {
      const qty = Number(item.quantityOnHand) || 0;
      const cost = Number(item.costPrice || item.purchasePrice) || 0;
      const price = Number(item.salePrice) || 0;
      const totalVal = qty * cost;

      return {
        'م': index + 1,
        'كود الصنف (SKU)': item.sku || '',
        'اسم الصنف / المنتج': item.nameAr,
        'الاسم بالإنجليزي': item.nameEn || '',
        'التصنيف': getInventoryCategoryLabel(item.category),
        'وحدة القياس': item.unit || 'كيلوجرام',
        'الشد (حبات بالعبوة)': item.unitsPerPack || 1,
        'الكمية المتوفرة بالمخزن': qty,
        'متوسط تكلفة الوحدة': cost,
        'سعر البيع الافتراضي': price,
        'إجمالي قيمة المخزون': Math.round(totalVal * 1000) / 1000,
        'حد التنبيه الأدنى': item.minQuantityAlert || 0,
        'باركود الصنف': item.barcode || '',
        'الحالة': item.isActive !== false ? 'متاح للبيع' : 'معطل',
      };
    });
    const wsInventory = XLSX.utils.json_to_sheet(inventoryData);
    XLSX.utils.book_append_sheet(wb, wsInventory, 'المخزون والمنتجات');

    // -------------------------------------------------------------
    // 10. ورقة أوامر التشغيل والإنتاج (Production Orders)
    // -------------------------------------------------------------
    const productionData = data.productionOrders.map((ord, index) => ({
      'م': index + 1,
      'رقم أمر التشغيل': ord.orderNumber,
      'التاريخ': ord.date,
      'المنتج التام المصنع': ord.targetItemNameAr,
      'الكمية المنتجة': Number(ord.targetQuantity) || 0,
      'الوحدة': ord.targetUnit || 'كيلوجرام',
      'خط الطحن والإنتاج': ord.millLine || 'خط طحن وتعبئة البهارات',
      'المشغل المسئول': ord.operatorName || '',
      'تكلفة المواد الخام المستهلكة': Number(ord.totalProductionCost || 0) - Number(ord.overheadCost || 0),
      'المصاريف التشغيلية وعمالة المطحنة': Number(ord.overheadCost) || 0,
      'إجمالي تكلفة أمر الإنتاج': Number(ord.totalProductionCost) || 0,
      'تكلفة الوحدة المنتجة': Number(ord.unitProductionCost) || 0,
      'حالة أمر الإنتاج': ord.status === 'COMPLETED' ? 'مكتمل ومرحل للمخزن' : 'قيد التشغيل',
      'ملاحظات التشغيل': ord.notes || '',
    }));
    const wsProduction = XLSX.utils.json_to_sheet(productionData);
    XLSX.utils.book_append_sheet(wb, wsProduction, 'أوامر الإنتاج والتشغيل');

    // -------------------------------------------------------------
    // 11. ورقة وحدات القياس (Units of Measurement)
    // -------------------------------------------------------------
    const unitsData = data.units.map((u, index) => ({
      'م': index + 1,
      'كود الوحدة': u.code,
      'اسم الوحدة (عربي)': u.nameAr,
      'اسم الوحدة (إنجليزي)': u.nameEn || '',
      'معامل التحويل': u.conversionFactor,
      'هل هي وحدة أساسية؟': u.isBaseUnit ? 'نعم (أساسية)' : 'لا (فرعية)',
      'الوصف': u.description || '',
    }));
    const wsUnits = XLSX.utils.json_to_sheet(unitsData);
    XLSX.utils.book_append_sheet(wb, wsUnits, 'وحدات القياس');

    // حفظ وتنزيل الملف بصيغة .xlsx
    const cleanCompanyName = companyName.replace(/[\/\\?%*:|"<>]/g, '_').replace(/\s+/g, '_');
    const fileName = `نسخة_احتياطية_شاملة_${cleanCompanyName}_${dateStr}.xlsx`;
    
    XLSX.writeFile(wb, fileName);
  }
}

// ----------------------------------------------------------------------
// دوال مساعدة لترجمة النصوص والحالات بشكل مهني سليم
// ----------------------------------------------------------------------
function getAccountCategoryLabel(category: string): string {
  switch (category) {
    case 'ASSET': return 'الأصول (Assets)';
    case 'LIABILITY': return 'الخصوم والالتزامات (Liabilities)';
    case 'EQUITY': return 'حقوق الملكية (Equity)';
    case 'REVENUE': return 'الإيرادات (Revenue)';
    case 'EXPENSE': return 'المصروفات والتكاليف (Expenses)';
    default: return category;
  }
}

function getJournalStatusLabel(status: string): string {
  switch (status) {
    case 'POSTED': return 'مرحل ومعتمد (Posted)';
    case 'DRAFT': return 'مسودة (Draft)';
    case 'CANCELLED': return 'ملغى (Cancelled)';
    case 'REVERSED': return 'معكوس (Reversed)';
    default: return status;
  }
}

function getInvoiceTypeLabel(type: string): string {
  switch (type) {
    case 'SALES': return 'فاتورة مبيعات';
    case 'SALES_RETURN': return 'مرتجع مبيعات (إشعار دائن)';
    case 'PURCHASE': return 'فاتورة مشتريات';
    case 'PURCHASE_RETURN': return 'مرتجع مشتريات (إشعار مدين)';
    default: return type;
  }
}

function getInvoiceStatusLabel(status: string): string {
  switch (status) {
    case 'PAID': return 'مدفوعة بالكامل';
    case 'PARTIALLY_PAID': return 'مدفوعة جزئياً';
    case 'POSTED': return 'مرحلة - غير مسددة';
    case 'DRAFT': return 'مسودة';
    case 'CANCELLED': return 'ملغاة';
    default: return status;
  }
}

function getPaymentMethodLabel(method?: string): string {
  switch (method) {
    case 'CASH': return 'نقداً (كاش)';
    case 'KNET': return 'كي نت (K-NET)';
    case 'BANK_TRANSFER': return 'تحويل بنكي';
    case 'CHEQUE': return 'شيك مصرفي';
    case 'CREDIT': return 'آجل (على الحساب)';
    default: return method || 'نقداً';
  }
}

function getInventoryCategoryLabel(category?: string): string {
  switch (category) {
    case 'RAW_MATERIAL': return 'مواد خام وبهارات حب';
    case 'FINISHED_GOODS': return 'منتجات تامة ومعبأة';
    case 'WORK_IN_PROGRESS': return 'إنتاج تحت التشغيل';
    case 'PACKAGING': return 'مواد تعبئة وتغليف';
    default: return category || 'عام';
  }
}
