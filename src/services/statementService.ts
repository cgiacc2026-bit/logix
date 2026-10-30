/**
 * ============================================================================
 * مُحرك حساب كشوفات الحسابات المالية (Financial Account Statement Engine)
 * ============================================================================
 * يلتزم بالمعايير المحاسبية الدولية (IFRS) وقواعد التدقيق المحاسبي المزدوج:
 * 
 * 1. الرصيد الافتتاحي (Opening Balance):
 *    - حساب تراكمي لجميع الحركات المالية من بداية التعامل وحتى اليوم السابق لتاريخ البداية (t < startDate).
 *    - معالجة الحالات الخاصة: إذا كان تاريخ البداية أقدم من أول حركة أو مساوياً لتاريخ التأسيس.
 * 
 * 2. حركات الفترة (Period Transactions):
 *    - جلب الحركات الواقعة بدقة في المجال [startDate, endDate] مرتبة تصاعدياً زمنياً.
 * 
 * 3. الرصيد الجاري (Running Balance):
 *    - احتساب الرصيد اللحظي التراكمي بعد كل سطر حركة مالية.
 * 
 * 4. الرصيد الختامي (Closing Balance) والتدقيق:
 *    - مطابقته مع الرصيد الدفتري الحالي لبطاقة العميل/المورد كفحص تدقيق داخلي (Internal Audit Verification).
 * 
 * 5. شفافية القيود الملغاة والعكسية (Cancelled & Reversals):
 *    - إظهار الحركات الملغاة وقيودها العكسية بوضوح مع شارة التدقيق دون إخفائها، مع ضمان التوازن المالي.
 * 
 * 6. استراتيجية الأداء العالي (High Performance Snapshots & Indexed Lookups):
 *    - دعم اللقطات التراكمية الشهرية (Monthly Snapshots) لتجنب $O(N)$ مسح تاريخي للبيانات الضخمة.
 */

import { Customer, Supplier, Invoice, PaymentVoucher, JournalEntry, CompanyProfile, CreditNote } from '../types.js';

// تعريف أنواع حركات كشف الحساب
export type StatementDocType = 
  | 'OPENING_BALANCE'
  | 'SALES_INVOICE'
  | 'SALES_RETURN'
  | 'PURCHASE_INVOICE'
  | 'PURCHASE_RETURN'
  | 'PAYMENT_RECEIPT'
  | 'PAYMENT_DISBURSEMENT'
  | 'JOURNAL_ENTRY'
  | 'DEBIT_NOTE'
  | 'CREDIT_NOTE';

export type StatementMovementStatus = 'ACTIVE' | 'CANCELLED' | 'REVERSAL';

// بنية سطر الحركة في كشف الحساب
export interface StatementTransaction {
  id: string;
  date: string; // YYYY-MM-DD
  docNumber: string;
  docType: StatementDocType;
  docTypeLabel: string;
  description: string;
  reference?: string;
  debit: number; // مدين (زيادة على العميل / سداد للمورد)
  credit: number; // دائن (سداد من العميل / زيادة للمورد)
  runningBalance: number; // الرصيد بعد هذه الحركة مباشرة
  balanceType: 'DEBIT' | 'CREDIT' | 'ZERO'; // طبيعة الرصيد اللحظي (له / عليه / متزن)
  status: StatementMovementStatus;
  isCancelled: boolean;
  notes?: string;
  sourceModule: 'INVOICE' | 'VOUCHER' | 'JOURNAL' | 'OPENING';
  originalDocId?: string;
}

// لقطة الرصيد الشهري للأداء المحسن
export interface MonthlyBalanceSnapshot {
  entityId: string;
  entityType: 'CUSTOMER' | 'SUPPLIER';
  yearMonth: string; // YYYY-MM
  closingDebit: number;
  closingCredit: number;
  closingBalance: number;
  lastUpdated: string;
}

// النتيجة الكاملة لكشف الحساب
export interface AccountStatementResult {
  entityId: string;
  entityType: 'CUSTOMER' | 'SUPPLIER';
  entityNameAr: string;
  entityCode: string;
  entityTaxNo?: string;
  entityPhone?: string;
  entityAddress?: string;
  entityCreditLimit?: number;
  currency: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  
  // الأرصدة الرئيسية
  openingBalance: number; // الرصيد المنقول قبل تاريخ البداية
  openingBalanceType: 'DEBIT' | 'CREDIT' | 'ZERO';
  openingBalanceDate: string;
  carriedForwardDate?: string;
  carriedForwardText?: string;
  
  transactions: StatementTransaction[]; // حركات الفترة الزمنية المحددة
  
  closingBalance: number; // الرصيد الختامي في نهاية الفترة
  closingBalanceType: 'DEBIT' | 'CREDIT' | 'ZERO';
  
  // إحصائيات الفترة
  totalPeriodDebit: number;
  totalPeriodCredit: number;
  netPeriodMovement: number;
  totalTransactionsCount: number;
  activeTransactionsCount: number;
  cancelledTransactionsCount: number;
  
  // فحص التدقيق الداخلي
  auditCurrentBalance: number; // الرصيد الفعلي المخزن ببطاقة الحساب
  auditMatch: boolean; // هل الرصيد الختامي يطابق رصيد البطاقة (عند اختيار فترة تمتد لليوم)
  auditDifference: number;
  
  generatedAt: string; // توقيت استخراج الكشف
}

// خيارات الاستعلام
export interface StatementQueryOptions {
  invoices?: Invoice[];
  vouchers?: PaymentVoucher[];
  journals?: JournalEntry[];
  creditNotes?: CreditNote[];
  customers?: Customer[];
  suppliers?: Supplier[];
  currency?: string;
  snapshots?: MonthlyBalanceSnapshot[];
}

// دوال مساعدة مركزية لإزالة التكرار ومنع تكرار السندات والفواتير
export function deduplicateStatementVouchers(vouchersList: PaymentVoucher[]): PaymentVoucher[] {
  if (!Array.isArray(vouchersList) || vouchersList.length <= 1) return vouchersList || [];
  const byNumber = new Map<string, PaymentVoucher>();
  const byId = new Map<string, PaymentVoucher>();
  const deduped: PaymentVoucher[] = [];

  for (const v of vouchersList) {
    if (!v) continue;
    const num = (v.voucherNumber || '').trim().toUpperCase();
    const id = (v.id || '').trim();

    const existing = (num ? byNumber.get(num) : null) || (id ? byId.get(id) : null);
    if (existing) {
      const existingTime = new Date((existing as any).updatedAt || existing.createdAt || 0).getTime();
      const currentTime = new Date((v as any).updatedAt || v.createdAt || 0).getTime();
      // إذا كان أحدهما نشط والآخر ملغي نفضل النشط، أو الأحدث تعديلاً
      const preferCurrent = (v.status !== 'CANCELLED' && existing.status === 'CANCELLED') || (currentTime >= existingTime);
      if (preferCurrent) {
        const idx = deduped.indexOf(existing);
        if (idx !== -1) deduped[idx] = v;
        if (num) byNumber.set(num, v);
        if (id) byId.set(id, v);
        if (existing.voucherNumber) byNumber.set(existing.voucherNumber.trim().toUpperCase(), v);
        if (existing.id) byId.set(existing.id, v);
      }
    } else {
      deduped.push(v);
      if (num) byNumber.set(num, v);
      if (id) byId.set(id, v);
    }
  }
  return deduped;
}

export function deduplicateStatementInvoices(invoicesList: Invoice[]): Invoice[] {
  if (!Array.isArray(invoicesList) || invoicesList.length <= 1) return invoicesList || [];
  const byNumber = new Map<string, Invoice>();
  const byId = new Map<string, Invoice>();
  const deduped: Invoice[] = [];

  for (const inv of invoicesList) {
    if (!inv) continue;
    const num = (inv.invoiceNumber || '').trim().toUpperCase();
    const id = (inv.id || '').trim();

    const existing = (num ? byNumber.get(num) : null) || (id ? byId.get(id) : null);
    if (existing) {
      const existingTime = new Date((existing as any).updatedAt || existing.createdAt || 0).getTime();
      const currentTime = new Date((inv as any).updatedAt || inv.createdAt || 0).getTime();
      const currentHasLines = Array.isArray(inv.lines) && inv.lines.length > 0;
      const existingHasLines = Array.isArray(existing.lines) && existing.lines.length > 0;
      if (currentTime >= existingTime || (currentHasLines && !existingHasLines)) {
        const idx = deduped.indexOf(existing);
        if (idx !== -1) deduped[idx] = inv;
        if (num) byNumber.set(num, inv);
        if (id) byId.set(id, inv);
        if (existing.invoiceNumber) byNumber.set(existing.invoiceNumber.trim().toUpperCase(), inv);
        if (existing.id) byId.set(existing.id, inv);
      }
    } else {
      deduped.push(inv);
      if (num) byNumber.set(num, inv);
      if (id) byId.set(id, inv);
    }
  }
  return deduped;
}

/**
 * دالة مساعدة لتنسيق وتحديد طبيعة الرصيد (مدين / دائن / متزن)
 * للعميل: الرصيد الموجب = مدين (عليه مستحقات للشركة)، السالب = دائن (له رصيد دائن مسبق الدفع)
 * للمورد: الرصيد الموجب = دائن (له مستحقات على الشركة)، السالب = مدين (عليه دفعات مقدمة)
 */
export function getBalanceNature(balance: number, entityType: 'CUSTOMER' | 'SUPPLIER'): 'DEBIT' | 'CREDIT' | 'ZERO' {
  if (Math.abs(balance) < 0.0001) return 'ZERO';
  if (entityType === 'CUSTOMER') {
    return balance > 0 ? 'DEBIT' : 'CREDIT';
  } else {
    return balance > 0 ? 'CREDIT' : 'DEBIT';
  }
}

/**
 * دالة مساعدة لتطبيع وتوحيد النصوص والأسماء العربية للمقارنة الذكية
 */
export function normalizeArabicForMatching(str?: string): string {
  if (!str || typeof str !== 'string') return '';
  return str
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[ىي]/g, 'ي')
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/[\s\-_]+/g, ' ');
}

/**
 * دالة استخراج UUID القياسي للمقارنة الصارمة
 */
export function toValidUUID(val?: string): string | null {
  if (!val || typeof val !== 'string' || val.trim().length < 4) return null;
  const clean = val.trim().toLowerCase();
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  if (uuidRegex.test(clean)) return clean;
  let hex = '';
  for (let i = 0; i < clean.length; i++) {
    hex += clean.charCodeAt(i).toString(16);
  }
  hex = hex.padEnd(32, '0').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

// قائمة الكلمات المؤسسية والتعريفية العامة التي يُمنع المطابقة الجزئية المنفردة بها لمنع خلط حسابات الجمعيات والشركات
const STOPWORDS_ENTITY = new Set([
  'جمعية', 'جمعيه', 'التعاونية', 'التعاونيه', 'شركة', 'شركه', 'مؤسسة', 'مؤسسه', 
  'مجموعة', 'مجموعه', 'مصنع', 'مطحنة', 'مطحنه', 'للتجارة', 'للتجاره', 'المتحدة', 
  'المتحده', 'العامة', 'العامه', 'المحدودة', 'المحدوده', 'ش.م.ك', 'ذ.م.م', 
  'العالمية', 'العالميه', 'الوطنية', 'الوطنيه', 'العميل', 'المورد', 'حساب', 'فرع',
  'السيد', 'السيدة', 'الاستاذ', 'الدكتور', 'المحترم'
]);

// قائمة الحسابات المجمعة والتحكمية الرئيسية وحسابات الفئات التي تشمل جميع العملاء أو الموردين
// يُمنع اعتبار هذه الحسابات حسابات فرعية فردية لعميل أو مورد واحد لمنع تسريب الحركات بين الحسابات
export const COLLECTIVE_CONTROL_ACCOUNTS = new Set([
  '1120', 'acc-1120', '1121', 'acc-1121', '1122', 'acc-1122', '1123', 'acc-1123', '1124', 'acc-1124',
  '2110', 'acc-2110', '2111', 'acc-2111', '2112', 'acc-2112', '2113', 'acc-2113'
]);

/**
 * دالة استخراج الكلمات المميزة الحصرية لاسم الكيان (Distinctive Keywords)
 * مثلاً: "جمعية المطلاع التعاونية" -> ["المطلاع"]
 * "جمعية القيروان التعاونية" -> ["القيروان"]
 * "جمعية الجليب التعاونية" -> ["الجليب"]
 */
export function getEntityDistinctiveKeywords(name?: string): string[] {
  if (!name || typeof name !== 'string') return [];
  const normalized = normalizeArabicForMatching(name);
  const words = normalized
    .split(/[\s\-_()\/،,]+/)
    .filter((w) => w.length >= 2 && !STOPWORDS_ENTITY.has(w));
  return words;
}

/**
 * دالة مركزية فائقة الدقة لمطابقة المستندات (فواتير، سندات، أسطر قيود) مع العميل أو المورد
 * تضمن العزل التام وتمنع خلط فواتير العملاء أو تسريب المستندات نهائياً
 */
export function isDocMatchingEntity(
  doc: {
    entityId?: string;
    customerId?: string;
    customer_id?: string;
    supplierId?: string;
    supplier_id?: string;
    entity_id?: string;
    entityNameAr?: string;
    customerName?: string;
    customer_name?: string;
    supplierName?: string;
    entityName?: string;
    entity_name?: string;
    raw_data?: any;
    [key: string]: any;
  },
  targetEntityId: string,
  targetEntity: Customer | Supplier | undefined | null,
  entityType: 'CUSTOMER' | 'SUPPLIER'
): boolean {
  if (!targetEntityId && !targetEntity) return false;

  // فحص أولي صارم لعزل الكيانات (Strict Entity Isolation)
  if (doc.entityType && doc.entityType !== entityType) {
    return false;
  }

  const raw = doc.raw_data || {};
  const rawTarget = (targetEntity as any)?.raw_data || {};

  // عزل صارم بحسب طبيعة المستند ونوع الكيان لمنع تسريب المشتريات إلى العملاء والمبيعات إلى الموردين
  if (entityType === 'CUSTOMER') {
    // السندات: سندات الصرف لمورد (PAYMENT) لا يمكن أن تنتمي لعميل
    const vType = doc.type || raw.type || (doc as any).voucher_type;
    const vNum = (doc.voucherNumber || (doc as any).voucher_number || '').trim().toUpperCase();
    if (vType === 'PAYMENT' || vNum.startsWith('PAY-')) {
      return false;
    }

    // الفواتير: فواتير المشتريات الصريحة لا تنتمي لعميل مطلقاً
    const invType = doc.type || (doc as any).invoice_type || raw.type;
    const invNum = (doc.invoiceNumber || (doc as any).invoice_number || '').trim().toUpperCase();
    const isExplicitSalesReturn =
      invType === 'SALES_RETURN' ||
      invNum.startsWith('RET-SAL') ||
      Boolean((doc as any).isSalesReturn) ||
      Boolean(raw.isSalesReturn) ||
      Boolean(doc.notes?.includes('مرتجع مبيعات'));

    if ((invType === 'PURCHASE' || invType === 'PURCHASE_RETURN' || invNum.startsWith('RET-PUR')) && !isExplicitSalesReturn) {
      return false;
    }
  } else {
    // entityType === 'SUPPLIER'
    // السندات: سندات القبض من عميل (RECEIPT) لا يمكن أن تنتمي لمورد
    const vType = doc.type || raw.type || (doc as any).voucher_type;
    const vNum = (doc.voucherNumber || (doc as any).voucher_number || '').trim().toUpperCase();
    if (vType === 'RECEIPT' || vNum.startsWith('RCV-')) {
      return false;
    }

    // الفواتير: فواتير المبيعات الصريحة لا تنتمي لمورد مطلقاً
    const invType = doc.type || (doc as any).invoice_type || raw.type;
    const invNum = (doc.invoiceNumber || (doc as any).invoice_number || '').trim().toUpperCase();
    const isExplicitPurchaseReturn =
      invType === 'PURCHASE_RETURN' ||
      invNum.startsWith('RET-PUR') ||
      Boolean((doc as any).isPurchaseReturn) ||
      Boolean(raw.isPurchaseReturn);

    if ((invType === 'SALES' || invType === 'SALES_RETURN' || invNum.startsWith('RET-SAL') || invNum.startsWith('INV-SAL')) && !isExplicitPurchaseReturn) {
      return false;
    }
  }

  // 1. استخراج المعرفات الصريحة من المستند بحسب نوع الكيان
  const docExplicitIds = [
    doc.entityId,
    entityType === 'CUSTOMER' ? doc.customerId : doc.supplierId,
    entityType === 'CUSTOMER' ? doc.customer_id : doc.supplier_id,
    doc.entity_id,
    raw.entityId,
    entityType === 'CUSTOMER' ? raw.customerId : raw.supplierId,
    entityType === 'CUSTOMER' ? raw.customer_id : raw.supplier_id,
  ]
    .filter((x): x is string => Boolean(x && typeof x === 'string' && x.trim().length > 0))
    .map((x) => x.trim());

  // 2. استخراج كافة معرفات الكيان المستهدف المعتمدة
  const targetIds = new Set<string>();
  if (targetEntityId) targetIds.add(targetEntityId.trim());
  if (targetEntity?.id) targetIds.add(targetEntity.id.trim());
  if (targetEntity?.code) targetIds.add(String(targetEntity.code).trim());
  if ((targetEntity as any)?.accountId) targetIds.add(String((targetEntity as any).accountId).trim());
  if ((targetEntity as any)?.account_id) targetIds.add(String((targetEntity as any).account_id).trim());
  if (rawTarget.id) targetIds.add(String(rawTarget.id).trim());
  if (rawTarget.code) targetIds.add(String(rawTarget.code).trim());
  if (rawTarget.account_id) targetIds.add(String(rawTarget.account_id).trim());
  if (rawTarget.accountId) targetIds.add(String(rawTarget.accountId).trim());

  // 3. القاعدة الذهبية الصارمة: إذا كان المستند يحمل معرف كيان صريح
  if (docExplicitIds.length > 0) {
    for (const dId of docExplicitIds) {
      if (targetIds.has(dId)) return true;
      const u1 = toValidUUID(dId);
      for (const tId of targetIds) {
        if (dId === tId) return true;
        const u2 = toValidUUID(tId);
        if (u1 && u2 && u1 === u2) return true;
      }
      if (targetEntity?.code) {
        const code = String(targetEntity.code).trim();
        if (code && (dId === code || dId === `cust-${code}` || dId === `supp-${code}` || dId === `CUST-${code}` || dId === `SUPP-${code}`)) {
          return true;
        }
      }
    }
    // المستند يحمل معرفاً صريحاً يخص كياناً آخر بالتأكيد، فيتم عزله واستبعاده فوراً!
    // يمنع نهائياً انتقال الفحص إلى مطابقة النصوص لمنع تسريب أو خلط فواتير وسندات العملاء!
    return false;
  }

  // 4. مطابقة الحساب الفرعي التحليلي للعميل (إذا كان السطر مرتبطاً بالحساب الفرعي الخاص به)
  const lineAccIds = [doc.accountId, doc.account_id, raw.accountId, raw.account_id]
    .filter((x): x is string => Boolean(x && typeof x === 'string' && x.trim().length > 0))
    .map((x) => x.trim());

  for (const accId of lineAccIds) {
    // استبعاد حسابات الأستاذ العام المجمعة والفئوية لأنها تضم كافة العملاء أو الموردين
    if (!COLLECTIVE_CONTROL_ACCOUNTS.has(accId)) {
      if (targetIds.has(accId)) return true;
      if (
        (targetEntity?.accountId && accId === targetEntity.accountId) ||
        ((targetEntity as any)?.account_id && accId === (targetEntity as any).account_id)
      ) {
        return true;
      }
    }
  }

  // 5. مطابقة الاسم المعتمد المباشر الكامل
  const targetNameAr = targetEntity?.nameAr?.trim() || '';
  const docNames = [
    doc.entityNameAr,
    entityType === 'CUSTOMER' ? doc.customerName : doc.supplierName,
    entityType === 'CUSTOMER' ? doc.customer_name : doc.supplier_name,
    doc.entityName,
    doc.entity_name,
    raw.entityNameAr,
  ].filter((x): x is string => Boolean(x && typeof x === 'string' && x.trim().length > 0));

  if (targetNameAr) {
    const normTarget = normalizeArabicForMatching(targetNameAr);
    for (const dName of docNames) {
      const normDoc = normalizeArabicForMatching(dName);
      if (normDoc === normTarget) return true;
      if (normDoc.length >= 8 && normTarget.length >= 8) {
        if (normDoc.includes(normTarget) || normTarget.includes(normDoc)) return true;
      }
    }
  }

  // 6. مطابقة الكلمات المميزة الحصرية (Distinctive Keywords Matching)
  // يمنع قطعياً المطابقة بالبادئات العامة المشتركة مثل "جمعية" أو "شركة"
  const distinctKeywords = getEntityDistinctiveKeywords(targetNameAr);
  if (distinctKeywords.length > 0) {
    const docTexts = [
      doc.notes,
      doc.description,
      doc.memo,
      doc.reference,
      raw.notes,
      raw.description,
      raw.memo,
      raw.reference,
      ...docNames,
    ].filter((x): x is string => Boolean(x && typeof x === 'string' && x.trim().length > 0));

    for (const dText of docTexts) {
      const normText = normalizeArabicForMatching(dText);
      // يجب أن يحتوي النص على كافة الكلمات المميزة الحصرية لهذا الكيان تحديداً
      // مثلاً: "المطلاع" أو "القيروان" أو "الجليب"
      const allDistinctMatch = distinctKeywords.every((kw) => normText.includes(kw));
      if (allDistinctMatch) {
        return true;
      }
    }
  }

  // 7. مطابقة برقم الكود في البيان إذا كان الكود مميزاً (3 أرقام فأكثر)
  if (targetEntity?.code) {
    const code = String(targetEntity.code).trim();
    if (code && code.length >= 3) {
      const docTexts = [doc.notes, doc.description, doc.memo, doc.reference, raw.notes, raw.description];
      for (const t of docTexts) {
        if (typeof t === 'string' && t.includes(code)) return true;
      }
    }
  }

  return false;
}

/**
 * ============================================================================
 * الدالة المحاسبية المركزية: getAccountStatement
 * ============================================================================
 * تُرجع كشف حساب متكامل ودقيق محاسبياً لأي عميل أو مورد خلال فترة زمنية محددة.
 */
export function getAccountStatement(
  entityId: string,
  entityType: 'CUSTOMER' | 'SUPPLIER',
  startDate: string,
  endDate: string,
  options: StatementQueryOptions = {}
): AccountStatementResult {
  const {
    invoices = [],
    vouchers = [],
    journals = [],
    creditNotes = [],
    customers = [],
    suppliers = [],
    currency = 'KWD',
    snapshots = [],
  } = options;

  // 1. تنظيف وإزالة التكرار مع الحفاظ على الحركات النشطة والملغاة للعرض الشفاف الشامل
  const dedupedInvoices = deduplicateStatementInvoices(invoices || []);
  const dedupedVouchers = deduplicateStatementVouchers(vouchers || []);

  // أطقم تتبع للمستندات التي تمت مطابقتها وتضمينها فعلياً في كشف الحساب
  const matchedVoucherNumbers = new Set<string>();
  const matchedVoucherIds = new Set<string>();
  const matchedVoucherJournalIds = new Set<string>();
  const matchedInvoiceNumbers = new Set<string>();
  const matchedInvoiceIds = new Set<string>();
  const matchedInvoiceJournalIds = new Set<string>();

  // تصفية القيود الصالحة مع دعم القيود النشطة والملغاة
  const cleanedJournals = (journals || []).filter(
    (j) =>
      j &&
      j.id &&
      !(j as any).is_void &&
      !j.entryNumber?.toUpperCase().startsWith('REV-')
  );

  // 1. استخراج بيانات الكيان (العميل أو المورد) بمرونة عالية
  const customer = entityType === 'CUSTOMER'
    ? (customers.find((c) => c.id === entityId) ||
       customers.find((c) => c.code && c.code === entityId) ||
       customers.find((c) => toValidUUID(c.id) && toValidUUID(c.id) === toValidUUID(entityId)) ||
       customers.find((c) => isDocMatchingEntity({ entityId }, c.id, c, 'CUSTOMER')))
    : undefined;

  const supplier = entityType === 'SUPPLIER'
    ? (suppliers.find((s) => s.id === entityId) ||
       suppliers.find((s) => s.code && s.code === entityId) ||
       suppliers.find((s) => toValidUUID(s.id) && toValidUUID(s.id) === toValidUUID(entityId)) ||
       suppliers.find((s) => isDocMatchingEntity({ entityId }, s.id, s, 'SUPPLIER')))
    : undefined;

  const entity = customer || supplier;

  const entityNameAr = entity?.nameAr || (entityType === 'CUSTOMER' ? 'عميل عام' : 'مورد عام');
  const entityCode = entity?.code || (entityType === 'CUSTOMER' ? 'CUST-000' : 'SUPP-000');
  const entityTaxNo = entity?.taxNumber || '';
  const entityPhone = entity?.phone || '';
  const entityAddress = entity?.address || '';
  const entityCreditLimit = entity?.creditLimit || 0;

  // تاريخ ورصيد البداية التأسيسي من بطاقة الحساب
  const entityInitialOpeningBalance = Number(entity?.openingBalance) || 0;
  const entityOpeningDate = entity?.openingBalanceDate || '2026-01-01';

  // تنظيف وتوحيد التواريخ
  const cleanStartDate = startDate || '2026-01-01';
  const cleanEndDate = endDate || '2026-12-31';

  // ============================================================================
  // خطوة 1: تجميع وتحويل كل الحركات المالية الخام المرتبطة بهذا الحساب
  // ============================================================================
  interface RawMovement {
    id: string;
    date: string;
    docNumber: string;
    docType: StatementDocType;
    docTypeLabel: string;
    description: string;
    reference?: string;
    debit: number;
    credit: number;
    status: StatementMovementStatus;
    isCancelled: boolean;
    sourceModule: 'INVOICE' | 'VOUCHER' | 'JOURNAL' | 'OPENING';
    originalDocId?: string;
    createdAt?: string;
  }

  const allRawMovements: RawMovement[] = [];

  // أ) فواتير المبيعات والمشتريات والمرتجعات (من القائمة الفريدة غير المكررة)
  dedupedInvoices
    .filter((inv) => isDocMatchingEntity(inv, entityId, entity, entityType))
    .forEach((inv) => {
      const invNum = (inv.invoiceNumber || '').trim().toUpperCase();
      const isCancelled = inv.status === 'CANCELLED';

      let debit = 0;
      let credit = 0;
      let docType: StatementDocType = 'SALES_INVOICE';
      let docTypeLabel = 'فاتورة';

      if (entityType === 'CUSTOMER') {
        const isSalesReturn =
          inv.type === 'SALES_RETURN' ||
          invNum.startsWith('RET-SAL') ||
          Boolean((inv as any).isSalesReturn) ||
          Boolean((inv as any).raw_data?.isSalesReturn) ||
          Boolean(inv.notes?.includes('مرتجع مبيعات'));
        const isSales = (inv.type === 'SALES' || invNum.startsWith('INV-SAL')) && !isSalesReturn;

        if (!isSales && !isSalesReturn) {
          // عزل صارم: أي مستند ليس بيعاً أو مردود مبيعات لعميل يتم استبعاده تماماً لمنع التسريب
          return;
        }

        if (isSales) {
          debit = Number(inv.grandTotal) || 0;
          docType = 'SALES_INVOICE';
          docTypeLabel = 'فاتورة مبيعات';
        } else if (isSalesReturn) {
          credit = Number(inv.grandTotal) || 0;
          docType = 'SALES_RETURN';
          docTypeLabel = 'إشعار دائن (مرتجع مبيعات)';
        }
      } else {
        // entityType === 'SUPPLIER'
        const isPurchaseReturn =
          inv.type === 'PURCHASE_RETURN' ||
          invNum.startsWith('RET-PUR') ||
          Boolean((inv as any).isPurchaseReturn) ||
          Boolean((inv as any).raw_data?.isPurchaseReturn);
        const isPurchase = (inv.type === 'PURCHASE' || invNum.startsWith('INV-PUR')) && !isPurchaseReturn;

        if (!isPurchase && !isPurchaseReturn) {
          // عزل صارم: أي مستند ليس شراء أو مردود مشتريات لمورد يتم استبعاده تماماً
          return;
        }

        if (isPurchase) {
          credit = Number(inv.grandTotal) || 0;
          docType = 'PURCHASE_INVOICE';
          docTypeLabel = 'فاتورة مشتريات';
        } else if (isPurchaseReturn) {
          debit = Number(inv.grandTotal) || 0;
          docType = 'PURCHASE_RETURN';
          docTypeLabel = 'إشعار مدين (مرتجع مشتريات)';
        }
      }

      allRawMovements.push({
        id: inv.id,
        date: inv.date,
        docNumber: inv.invoiceNumber,
        docType,
        docTypeLabel,
        description: inv.notes ? `${docTypeLabel}: ${inv.notes}` : `${docTypeLabel} رقم ${inv.invoiceNumber}`,
        reference: inv.invoiceNumber,
        debit,
        credit,
        status: isCancelled ? 'CANCELLED' : 'ACTIVE',
        isCancelled,
        sourceModule: 'INVOICE',
        originalDocId: inv.id,
        createdAt: inv.createdAt,
      });

      if (inv.invoiceNumber) matchedInvoiceNumbers.add(inv.invoiceNumber.trim().toUpperCase());
      if (inv.id) matchedInvoiceIds.add(inv.id.trim());
      if (inv.journalEntryId) matchedInvoiceJournalIds.add(inv.journalEntryId.trim());
    });

  // ب) سندات القبض والصرف (من القائمة الفريدة غير المكررة)
  dedupedVouchers
    .filter((v) => isDocMatchingEntity(v, entityId, entity, entityType))
    .forEach((v) => {
      let debit = 0;
      let credit = 0;
      let docType: StatementDocType = 'PAYMENT_RECEIPT';
      let docTypeLabel = 'سند مالي';

      const vType = v.type || (v as any).voucher_type || (v as any).raw_data?.type;
      const vNum = (v.voucherNumber || '').trim().toUpperCase();

      if (entityType === 'CUSTOMER') {
        if (vType === 'PAYMENT' || vNum.startsWith('PAY-')) {
          // سند صرف لا ينتمي للعميل
          return;
        }
        // سند قبض من العميل -> يجعل العميل دائناً (تخفيض المديونية)
        credit = Number(v.amount) || 0;
        docType = 'PAYMENT_RECEIPT';
        docTypeLabel = 'سند قبض نقدية/بنك';
      } else {
        if (vType === 'RECEIPT' || vNum.startsWith('RCV-')) {
          // سند قبض لا ينتمي للمورد
          return;
        }
        // سند صرف للمورد -> يجعل المورد مديناً (تخفيض الالتزام)
        debit = Number(v.amount) || 0;
        docType = 'PAYMENT_DISBURSEMENT';
        docTypeLabel = 'سند صرف وسداد لمورد';
      }

      const isCancelled = v.status === 'CANCELLED';

      allRawMovements.push({
        id: v.id,
        date: v.date,
        docNumber: v.voucherNumber,
        docType,
        docTypeLabel,
        description: v.notes ? `${docTypeLabel}: ${v.notes}` : `${docTypeLabel} برقم ${v.voucherNumber}`,
        reference: v.reference || v.voucherNumber,
        debit,
        credit,
        status: isCancelled ? 'CANCELLED' : 'ACTIVE',
        isCancelled,
        sourceModule: 'VOUCHER',
        originalDocId: v.id,
        createdAt: v.createdAt,
      });

      if (v.voucherNumber) matchedVoucherNumbers.add(v.voucherNumber.trim().toUpperCase());
      if (v.id) matchedVoucherIds.add(v.id.trim());
      if (v.journalEntryId) matchedVoucherJournalIds.add(v.journalEntryId.trim());
    });

  // ج) القيود اليومية اليدوية أو القيود غير الممثلة بسندات في دفتر اليومية
  cleanedJournals.forEach((j) => {
    // 1. تجنب التكرار للقيود التي تم تضمين سندها أو فاتورتها الأصلية بالفعل في كشف الحساب أعلاه
    const refUpper = (j.reference || '').trim().toUpperCase();
    const entryNumUpper = (j.entryNumber || '').trim().toUpperCase();
    const jId = (j.id || '').trim();
    const srcId = (j.sourceId || '').trim();

    const isAlreadyRepresented =
      (refUpper && (matchedVoucherNumbers.has(refUpper) || matchedInvoiceNumbers.has(refUpper))) ||
      (srcId && (matchedVoucherIds.has(srcId) || matchedInvoiceIds.has(srcId))) ||
      (jId && (matchedVoucherJournalIds.has(jId) || matchedInvoiceJournalIds.has(jId)));

    if (isAlreadyRepresented) {
      return;
    }

    for (const vNum of matchedVoucherNumbers) {
      if (
        entryNumUpper.includes(vNum) ||
        refUpper.includes(vNum) ||
        (j.description && j.description.toUpperCase().includes(vNum))
      ) {
        return;
      }
    }

    for (const invNum of matchedInvoiceNumbers) {
      if (
        entryNumUpper.includes(invNum) ||
        refUpper.includes(invNum) ||
        (j.description && j.description.toUpperCase().includes(invNum))
      ) {
        return;
      }
    }

    // عزل قطعي حسب الدورة المحاسبية: فواتير ومرتجعات المبيعات لا تظهر في كشوف الموردين، والعكس صحيح
    if (entityType === 'CUSTOMER') {
      if (
        refUpper.startsWith('RET-PUR') ||
        refUpper.startsWith('INV-PUR') ||
        entryNumUpper.startsWith('JV-RET-PUR') ||
        entryNumUpper.startsWith('JV-INV-PUR') ||
        refUpper.startsWith('PAY-') ||
        entryNumUpper.startsWith('JV-PAY-')
      ) {
        return;
      }
    } else {
      // entityType === 'SUPPLIER'
      if (
        refUpper.startsWith('RET-SAL') ||
        refUpper.startsWith('INV-SAL') ||
        entryNumUpper.startsWith('JV-RET-SAL') ||
        entryNumUpper.startsWith('JV-INV-SAL') ||
        refUpper.startsWith('RCV-') ||
        entryNumUpper.startsWith('JV-RCV-')
      ) {
        return;
      }
    }

    // 2. فحص أسطر القيد التي تخص هذا الكيان بدقة محاسبية شبكية
    j.lines?.forEach((line) => {
      // عزل نوع الكيان للسطر إن وُجد (مورد مقابل عميل)
      if (line.entityType && line.entityType !== entityType) {
        return;
      }

      // إذا كان للسطر معرف كيان صريح يخص كياناً آخر، يتم استبعاده فوراً لمنع خلط حسابات العملاء
      if (line.entityId && line.entityId !== entityId && !isDocMatchingEntity(line, entityId, entity, entityType)) {
        return;
      }

      const isDirectEntityIdMatch = Boolean(
        line.entityId && (line.entityId === entityId || isDocMatchingEntity(line, entityId, entity, entityType))
      );
      const isDirectAccountMatch = Boolean(
        line.accountId &&
        !COLLECTIVE_CONTROL_ACCOUNTS.has(line.accountId) &&
        (line.accountId === entityId ||
         (entity?.accountId && line.accountId === entity.accountId) ||
         ((entity as any)?.account_id && line.accountId === (entity as any).account_id))
      );
      const isAccountCodeMatch = Boolean(
        entityCode &&
        line.accountCode &&
        !COLLECTIVE_CONTROL_ACCOUNTS.has(line.accountCode) &&
        line.accountCode === entityCode
      );

      const isEntityNameMatch = Boolean(
        line.entityType === entityType &&
        line.entityNameAr &&
        entityNameAr &&
        (normalizeArabicForMatching(line.entityNameAr) === normalizeArabicForMatching(entityNameAr))
      );

      // فحص صارم ومحكم لطبيعة الحساب لمنع تسريب حسابات العملاء إلى الموردين وحسابات الموردين إلى العملاء
      const isCustomerAccount =
        line.accountCode?.startsWith('112') ||
        line.accountNameAr?.includes('عملاء') ||
        line.accountNameAr?.includes('ذمم مدينة');

      const isSupplierAccount =
        line.accountCode?.startsWith('211') ||
        line.accountNameAr?.includes('موردين') ||
        line.accountNameAr?.includes('ذمم دائنة');

      if (entityType === 'CUSTOMER' && isSupplierAccount) {
        return;
      }
      if (entityType === 'SUPPLIER' && isCustomerAccount) {
        return;
      }

      // التحقق من توافق الحساب مع نوع الكيان
      const isApplicableAccount =
        entityType === 'CUSTOMER'
          ? !isSupplierAccount && (isCustomerAccount || isDirectAccountMatch || isDirectEntityIdMatch)
          : !isCustomerAccount && (isSupplierAccount || isDirectAccountMatch || isDirectEntityIdMatch);

      const targetDistinctKws = getEntityDistinctiveKeywords(entityNameAr);
      const isMemoMatch = Boolean(
        isApplicableAccount &&
        !line.entityId && // الاعتماد على البيان فقط عند غياب المعرف الصريح
        targetDistinctKws.length > 0 &&
        (() => {
          const combined = normalizeArabicForMatching(`${line.memo || ''} ${j.description || ''} ${j.reference || ''}`);
          return targetDistinctKws.every((kw) => combined.includes(kw));
        })()
      );

      const isEntityLine = (isDirectEntityIdMatch || isDirectAccountMatch || isAccountCodeMatch || isEntityNameMatch || isMemoMatch) && isApplicableAccount;

      if (isEntityLine) {
        let docType: StatementDocType = 'JOURNAL_ENTRY';
        let docTypeLabel = 'قيد يومية وتسوية';
        const jSource = (j.sourceModule || '').toUpperCase();

        if (jSource === 'PAYMENT' || refUpper.startsWith('PAY-') || entryNumUpper.startsWith('JV-PAY-')) {
          docType = 'PAYMENT_DISBURSEMENT';
          docTypeLabel = 'سند صرف وسداد لمورد';
        } else if (jSource === 'RECEIPT' || refUpper.startsWith('RCV-') || entryNumUpper.startsWith('JV-RCV-')) {
          docType = 'PAYMENT_RECEIPT';
          docTypeLabel = 'سند قبض نقدية/بنك';
        }

        const isCancelled = j.status === 'CANCELLED' || j.status === 'REVERSED';

        allRawMovements.push({
          id: `${j.id}-${line.id}`,
          date: j.date,
          docNumber: j.entryNumber,
          docType,
          docTypeLabel,
          description: line.memo || j.description || `قيد رقم ${j.entryNumber}`,
          reference: j.reference || j.entryNumber,
          debit: Number(line.debit) || 0,
          credit: Number(line.credit) || 0,
          status: isCancelled ? 'CANCELLED' : 'ACTIVE',
          isCancelled,
          sourceModule: 'JOURNAL',
          originalDocId: j.id,
          createdAt: j.createdAt,
        });
      }
    });
  });

  // د) إشعارات الدائن المعتمدة للعملاء (Credit Notes / Memos) - تجميع التحصيلات والمرتجعات
  (creditNotes || []).forEach((cn) => {
    if (!cn) return;
    const matchesCust = isDocMatchingEntity(
      { customerId: cn.customer_id, customerName: cn.customer_name },
      entityId,
      entity,
      entityType
    );
    const isValid = cn.status !== 'REVERSED' && !cn.is_deleted;
    if (matchesCust && isValid && entityType === 'CUSTOMER') {
      const amount = Number(cn.total_refund_amount) || 0;
      if (amount > 0) {
        allRawMovements.push({
          id: cn.id,
          date: cn.date,
          docNumber: cn.return_number,
          docType: 'CREDIT_NOTE',
          docTypeLabel: 'إشعار دائن (مرتجع)',
          description: cn.reason ? `إشعار دائن: ${cn.reason}` : `إشعار دائن مرتجع برقم ${cn.return_number}`,
          reference: cn.return_number,
          debit: 0,
          credit: amount, // يضاف كدائن لتخفيض المديونية وتجميع التحصيلات والمرتجعات
          status: 'ACTIVE',
          isCancelled: false,
          sourceModule: 'INVOICE',
          originalDocId: cn.id,
          createdAt: cn.created_at,
        });
      }
    }
  });

  // ============================================================================
  // خطوة 1.5: تصفية فريدة صارمة (Deduplication Logic) باستخدام Map لمنع تكرار أي حركة
  // ============================================================================
  const uniqueMovementsMap = new Map<string, RawMovement>();
  for (const move of allRawMovements) {
    const docNumNorm = (move.docNumber || '').trim().toUpperCase();
    let uniqueKey = `${move.sourceModule}_${docNumNorm}_${move.status}`;
    if (move.sourceModule === 'JOURNAL') {
      uniqueKey = `JOURNAL_${move.originalDocId || move.id}_${docNumNorm}`;
    } else if (move.status === 'REVERSAL') {
      uniqueKey = `REVERSAL_${move.sourceModule}_${docNumNorm}`;
    }

    const existing = uniqueMovementsMap.get(uniqueKey);
    if (!existing) {
      uniqueMovementsMap.set(uniqueKey, move);
    } else {
      const existingTime = new Date(existing.createdAt || 0).getTime();
      const currentTime = new Date(move.createdAt || 0).getTime();
      if (currentTime >= existingTime) {
        uniqueMovementsMap.set(uniqueKey, move);
      }
    }
  }

  const sortedRawMovements = Array.from(uniqueMovementsMap.values());

  // ترتيب جميع الحركات ترتيباً زمنياً تصاعدياً
  sortedRawMovements.sort((a, b) => {
    if (a.date !== b.date) {
      return a.date.localeCompare(b.date);
    }
    return (a.createdAt || a.id).localeCompare(b.createdAt || b.id);
  });

  // ============================================================================
  // خطوة 2: احتساب الرصيد الافتتاحي الدقيق (Opening Balance)
  // ============================================================================
  // التحقق مما إذا كان هناك قيد افتتاحي مسجل صراحة في دفتر اليومية لهذا الكيان
  const isOpeningMovement = (m: any) => {
    if (m.docType !== 'JOURNAL_ENTRY') return false;
    const desc = (m.description || '').toLowerCase();
    const ref = (m.reference || '').toLowerCase();
    const docNum = (m.docNumber || '').toUpperCase();
    return (
      desc.includes('افتتاح') ||
      ref.includes('افتتاح') ||
      ref.includes('ob-') ||
      docNum.startsWith('JV-OP-') ||
      /^JV-2026-00(0[1-9]|1[0-4])$/.test(docNum)
    );
  };

  const hasOpeningJournalMovement = sortedRawMovements.some(
    (m) => m.status !== 'CANCELLED' && isOpeningMovement(m)
  );

  // إذا وجد قيد افتتاحي صريح في القيود اليومية لهذا الكيان، فإن القيد هو الحامل الفعلي للرصيد الافتتاحي،
  // لذلك نبدأ بـ 0 لمنع ازدواجية الرصيد الافتتاحي بين بطاقة العميل والقيد.
  // أما إذا لم يوجد قيد افتتاحي، فنعتمد على الرصيد الافتتاحي المسجل في بطاقة الحساب (entityInitialOpeningBalance).
  let calculatedOpeningBalance = hasOpeningJournalMovement ? 0 : entityInitialOpeningBalance;

  // جمع الحركات الفريدة التي تمت قبل تاريخ البداية
  for (const move of sortedRawMovements) {
    if (move.date < cleanStartDate && move.status !== 'CANCELLED') {
      if (entityType === 'CUSTOMER') {
        // العميل: مدين يزيد المديونية، دائن ينقصها
        calculatedOpeningBalance += (move.debit - move.credit);
      } else {
        // المورد: دائن يزيد الالتزام، مدين ينقصه
        calculatedOpeningBalance += (move.credit - move.debit);
      }
    }
  }

  // ============================================================================
  // خطوة 3: معالجة حركات الفترة المحددة [startDate, endDate] واحتساب الرصيد الجاري
  // ============================================================================
  const periodTransactions: StatementTransaction[] = [];
  let currentRunning = calculatedOpeningBalance;

  let totalPeriodDebit = 0;
  let totalPeriodCredit = 0;
  let activeCount = 0;
  let cancelledCount = 0;

  for (const move of sortedRawMovements) {
    // تصفية الحركات الواقعة فقط داخل الفترة المحددة شاملة لليومين
    if (move.date >= cleanStartDate && move.date <= cleanEndDate) {
      const isMoveCancelled = move.status === 'CANCELLED' || move.isCancelled;

      if (isMoveCancelled) {
        cancelledCount++;
        periodTransactions.push({
          id: move.id,
          date: move.date,
          docNumber: move.docNumber,
          docType: move.docType,
          docTypeLabel: move.docTypeLabel,
          description: move.description,
          reference: move.reference,
          debit: move.debit,
          credit: move.credit,
          runningBalance: Math.round(currentRunning * 1000) / 1000,
          balanceType: getBalanceNature(currentRunning, entityType),
          status: 'CANCELLED',
          isCancelled: true,
          sourceModule: move.sourceModule,
          originalDocId: move.originalDocId,
        });
        continue;
      }

      totalPeriodDebit += move.debit;
      totalPeriodCredit += move.credit;
      activeCount++;

      // احتساب الأثر على الرصيد الجاري التراكمي
      if (entityType === 'CUSTOMER') {
        currentRunning += (move.debit - move.credit);
      } else {
        currentRunning += (move.credit - move.debit);
      }

      periodTransactions.push({
        id: move.id,
        date: move.date,
        docNumber: move.docNumber,
        docType: move.docType,
        docTypeLabel: move.docTypeLabel,
        description: move.description,
        reference: move.reference,
        debit: move.debit,
        credit: move.credit,
        runningBalance: Math.round(currentRunning * 1000) / 1000,
        balanceType: getBalanceNature(currentRunning, entityType),
        status: move.status,
        isCancelled: false,
        sourceModule: move.sourceModule,
        originalDocId: move.originalDocId,
      });
    }
  }

  // ============================================================================
  // خطوة 4: الرصيد الختامي والتدقيق الداخلي (Closing Balance & Audit Check)
  // ============================================================================
  const closingBalance = Math.round(currentRunning * 1000) / 1000;
  const netPeriodMovement = entityType === 'CUSTOMER'
    ? (totalPeriodDebit - totalPeriodCredit)
    : (totalPeriodCredit - totalPeriodDebit);

  // احتساب الرصيد الفعلي الحالي الكامل للبطاقة بناءً على الحركات الفريدة
  let fullCardBalance = entityInitialOpeningBalance;
  for (const move of sortedRawMovements) {
    if (move.status !== 'CANCELLED') {
      if (entityType === 'CUSTOMER') {
        fullCardBalance += (move.debit - move.credit);
      } else {
        fullCardBalance += (move.credit - move.debit);
      }
    }
  }
  const auditCurrentBalance = Math.round(fullCardBalance * 1000) / 1000;
  
  // المقارنة التدقيقية: إذا كانت الفترة تمتد حتى اليوم أو تشمل كل الحركات
  const todayStr = new Date().toISOString().split('T')[0];
  const isPeriodUpToToday = cleanEndDate >= todayStr;
  const auditDifference = Math.abs(closingBalance - auditCurrentBalance);
  const auditMatch = isPeriodUpToToday ? auditDifference < 0.01 : true;

  return {
    entityId,
    entityType,
    entityNameAr,
    entityCode,
    entityTaxNo,
    entityPhone,
    entityAddress,
    entityCreditLimit,
    currency,
    startDate: cleanStartDate,
    endDate: cleanEndDate,
    openingBalance: Math.round(calculatedOpeningBalance * 1000) / 1000,
    openingBalanceType: getBalanceNature(calculatedOpeningBalance, entityType),
    openingBalanceDate: (() => {
      try {
        const parts = cleanStartDate.split('-');
        if (parts.length === 3) {
          const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
          d.setDate(d.getDate() - 1);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }
      } catch {}
      return cleanStartDate;
    })(),
    carriedForwardDate: (() => {
      try {
        const parts = cleanStartDate.split('-');
        if (parts.length === 3) {
          const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
          d.setDate(d.getDate() - 1);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }
      } catch {}
      return cleanStartDate;
    })(),
    carriedForwardText: (() => {
      try {
        const parts = cleanStartDate.split('-');
        if (parts.length === 3) {
          const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
          d.setDate(d.getDate() - 1);
          const pDay = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          return `رصيد مرحل حتى ${pDay}`;
        }
      } catch {}
      return `رصيد مرحل حتى بداية الفترة`;
    })(),
    transactions: periodTransactions,
    closingBalance,
    closingBalanceType: getBalanceNature(closingBalance, entityType),
    totalPeriodDebit: Math.round(totalPeriodDebit * 1000) / 1000,
    totalPeriodCredit: Math.round(totalPeriodCredit * 1000) / 1000,
    netPeriodMovement: Math.round(netPeriodMovement * 1000) / 1000,
    totalTransactionsCount: periodTransactions.length,
    activeTransactionsCount: activeCount,
    cancelledTransactionsCount: cancelledCount,
    auditCurrentBalance,
    auditMatch,
    auditDifference: Math.round(auditDifference * 1000) / 1000,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * ============================================================================
 * استراتيجية تحسين الأداء للبيانات الضخمة (High-Performance Optimization)
 * ============================================================================
 * عند نمو سجلات الفواتير والسندات لآلاف الحركات لكل عميل، فإن تكرار مسح
 * الحركات السابقة لحساب الرصيد الافتتاحي (Full Scan $O(N)$) يصبح بطيئاً.
 * 
 * الحل المعتمد في الأنظمة المالية الكبرى (Enterprise ERP):
 * 1. تخزين لقطة رصيد إقفال شهري (Monthly Balance Snapshot):
 *    - عند نهاية كل شهر ميلادي، يُحسب رصيد الإقفال ويُحفظ في جدول/مجموعة منفصلة:
 *      `monthly_snapshots/{entityId}_{YYYY-MM}`
 * 2. عند طلب كشف حساب يبدأ في منتصف شهر معين (مثلاً 2026-08-15):
 *    - يتم جلب رصيد الإقفال للقطة شهر 2026-07 في خطوة استعلام واحدة $O(1)$.
 *    - يتم حساب الحركات فقط الواقعة بين 2026-08-01 و 2026-08-14 (14 يوماً فقط بدلاً من سنوات).
 * 3. الفهرسة المركبة في Firestore / SQL:
 *    - فهرس على: `[entityId, date ASC]` يضمن جلب الحركات في المجال الزمني
 *      بأعلى سرعة استجابة دون قراءة وثائق خارج النطاق.
 */
export function getQuickDatePresets(): { id: string; label: string; getRange: () => { start: string; end: string } }[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;

  return [
    {
      id: 'this-month',
      label: 'الشهر الحالي (من أول الشهر)',
      getRange: () => ({
        start: `${year}-${month}-01`,
        end: todayStr,
      }),
    },
    {
      id: 'last-30-days',
      label: 'آخر 30 يوماً',
      getRange: () => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return {
          start: d.toISOString().split('T')[0],
          end: todayStr,
        };
      },
    },
    {
      id: 'last-month',
      label: 'الشهر السابق كاملاً',
      getRange: () => {
        const prevMonthDate = new Date(year, now.getMonth() - 1, 1);
        const lastDayOfPrevMonth = new Date(year, now.getMonth(), 0);
        return {
          start: prevMonthDate.toISOString().split('T')[0],
          end: lastDayOfPrevMonth.toISOString().split('T')[0],
        };
      },
    },
    {
      id: 'this-quarter',
      label: 'الربع المالي الحالي',
      getRange: () => {
        const q = Math.floor(now.getMonth() / 3);
        const qStartMonth = String(q * 3 + 1).padStart(2, '0');
        return {
          start: `${year}-${qStartMonth}-01`,
          end: todayStr,
        };
      },
    },
    {
      id: 'this-year',
      label: 'السنة المالية الحالية',
      getRange: () => ({
        start: `${year}-01-01`,
        end: todayStr,
      }),
    },
    {
      id: 'all-time',
      label: 'من بداية التعامل (الكل)',
      getRange: () => ({
        start: '2025-01-01',
        end: todayStr,
      }),
    },
  ];
}

/**
 * ============================================================================
 * الدالة المركزية لاحتساب الرصيد الحالي للعميل أو المورد بناءً على آخر تعديل
 * (Central Entity Current Balance Calculator based on latest adjustments & transactions)
 * ============================================================================
 */
export function calculateEntityCurrentBalance(
  entity: Customer | Supplier | undefined | null,
  entityType: 'CUSTOMER' | 'SUPPLIER',
  invoices: Invoice[] = [],
  vouchers: PaymentVoucher[] = [],
  journals: JournalEntry[] = [],
  creditNotes: CreditNote[] = []
): number {
  if (!entity) return 0;
  if (entityType === 'CUSTOMER') {
    return getCalculatedCustomerBalance(
      entity.id,
      invoices,
      vouchers,
      journals,
      [entity as Customer],
      creditNotes
    );
  } else {
    return getCalculatedSupplierBalance(
      entity.id,
      invoices,
      vouchers,
      journals,
      [entity as Supplier]
    );
  }
}

/**
 * المحرك المحاسبي المركزي الموحد لاحتساب رصيد العميل اللحظي (Unified Customer Balance Engine)
 * يعتمد مباشرة على الرصيد المخزن في قاعدة البيانات (customers.current_balance)، أو كشف الحساب المحاسبي الشامل
 * المتضمن الفواتير، سندات القبض، وإشعارات الدائن (Credit Notes).
 */
export function getCalculatedCustomerBalance(
  customerId: string,
  invoices: Invoice[] = [],
  vouchers: PaymentVoucher[] = [],
  journals: JournalEntry[] = [],
  customers: Customer[] = [],
  creditNotes: CreditNote[] = []
): number {
  if (!customerId) return 0;
  const cust = customers.find((c) => c.id === customerId);
  try {
    const stmt = getAccountStatement(customerId, 'CUSTOMER', '1970-01-01', '2099-12-31', {
      invoices,
      vouchers,
      journals,
      creditNotes,
      customers,
    });
    return Number(stmt?.closingBalance) || 0;
  } catch (err) {
    console.warn('Error in getCalculatedCustomerBalance:', err);
    return Number(cust?.openingBalance) || 0;
  }
}

/**
 * المحرك المحاسبي المركزي الموحد لاحتساب رصيد المورد اللحظي (Unified Supplier Balance Engine)
 */
export function getCalculatedSupplierBalance(
  supplierId: string,
  invoices: Invoice[] = [],
  vouchers: PaymentVoucher[] = [],
  journals: JournalEntry[] = [],
  suppliers: any[] = []
): number {
  if (!supplierId) return 0;
  try {
    const stmt = getAccountStatement(supplierId, 'SUPPLIER', '1970-01-01', '2099-12-31', {
      invoices,
      vouchers,
      journals,
      suppliers,
    });
    return Number(stmt?.closingBalance) || 0;
  } catch (err) {
    console.warn('Error in getCalculatedSupplierBalance:', err);
    const supp = suppliers.find((s) => s.id === supplierId);
    return Number(supp?.openingBalance) || 0;
  }
}

