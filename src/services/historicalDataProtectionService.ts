/**
 * خدمة حماية البيانات التاريخية وسياج الأمان المحاسبي المطلق
 * Historical Data Protection Service & Immutability Guard
 * 
 * يطبق المبدأ الأول: حماية البيانات القديمة حماية مطلقة
 * الحماية مقتصرة حصرياً على الشركة المؤسسة التاريخية (PROTECTED_LEGACY_COMPANY_ID)
 * أي شركة أخرى لا تخضع لأي قفل تاريخي وتدير بياناتها ودليل حساباتها وفق الضوابط المحاسبية المعيارية.
 */

import historicalSnapshotData from '../data/historicalSnapshot.json';

// الشركة المؤسسة الوحيدة المحمية تاريخياً
export const PROTECTED_LEGACY_COMPANY_ID = '20000000-0000-0000-0000-000000000001';

// فحص صريح لمعرف الشركة المؤسسة المحمية
export function isProtectedCompany(companyId?: string): boolean {
  if (!companyId) return false;
  return String(companyId).trim() === PROTECTED_LEGACY_COMPANY_ID;
}

// تاريخ ووقت نقطة القطع المعتمد رسمياً
export const SYSTEM_CUTOVER_AT = '2026-10-05T00:00:00.000Z';
export const SYSTEM_CUTOVER_TIMESTAMP = new Date(SYSTEM_CUTOVER_AT).getTime();

// مجموعات المعرفات الثابتة للسجلات التاريخية لحظة القطع (Snapshot Lookup)
export const HISTORICAL_INVOICE_IDS = new Set<string>(historicalSnapshotData.invoiceIds || []);
export const HISTORICAL_JOURNAL_IDS = new Set<string>(historicalSnapshotData.journalIds || []);
export const HISTORICAL_CUSTOMER_IDS = new Set<string>(historicalSnapshotData.customerIds || []);
export const HISTORICAL_SUPPLIER_IDS = new Set<string>(historicalSnapshotData.supplierIds || []);
export const HISTORICAL_ITEM_IDS = new Set<string>(historicalSnapshotData.itemIds || []);
export const HISTORICAL_ACCOUNT_IDS = new Set<string>((historicalSnapshotData as any).accountIds || []);
export const HISTORICAL_ACCOUNT_CODES = new Set<string>((historicalSnapshotData as any).accountCodes || []);

/**
 * فحص ما إذا كان التاريخ المدخل يسبق نقطة القطع
 */
export function isBeforeCutover(dateStr?: string): boolean {
  if (!dateStr) return false;
  try {
    const t = new Date(dateStr).getTime();
    if (isNaN(t)) return false;
    return t < SYSTEM_CUTOVER_TIMESTAMP;
  } catch {
    return false;
  }
}

/**
 * فحص ما إذا كانت الفاتورة سجلاً تاريخياً محمياً
 * لا يُعتبر السجل تاريخياً إلا إذا كان تابعاً حصرياً للشركة المؤسسة المحمية
 */
export function isHistoricalInvoice(id?: string, createdAt?: string, date?: string, companyId?: string): boolean {
  if (!id) return false;
  if (companyId && !isProtectedCompany(companyId)) return false;
  const cleanId = String(id).trim();
  if (HISTORICAL_INVOICE_IDS.has(cleanId)) return true;
  if (createdAt && isBeforeCutover(createdAt)) return true;
  if (date && isBeforeCutover(date + 'T23:59:59.999Z')) return true;
  return false;
}

/**
 * فحص ما إذا كان القيد المحاسبي سجلاً تاريخياً محمياً
 * لا يُعتبر السجل تاريخياً إلا إذا كان تابعاً حصرياً للشركة المؤسسة المحمية
 */
export function isHistoricalJournal(id?: string, createdAt?: string, date?: string, companyId?: string): boolean {
  if (!id) return false;
  if (companyId && !isProtectedCompany(companyId)) return false;
  const cleanId = String(id).trim();
  if (HISTORICAL_JOURNAL_IDS.has(cleanId)) return true;
  if (createdAt && isBeforeCutover(createdAt)) return true;
  if (date && isBeforeCutover(date + 'T23:59:59.999Z')) return true;
  return false;
}

/**
 * فحص ما إذا كان العميل مسجلاً قبل تاريخ القطع
 * لا يُعتبر السجل تاريخياً إلا إذا كان تابعاً حصرياً للشركة المؤسسة المحمية
 */
export function isHistoricalCustomer(id?: string, companyId?: string): boolean {
  if (!id) return false;
  if (companyId && !isProtectedCompany(companyId)) return false;
  return HISTORICAL_CUSTOMER_IDS.has(String(id).trim());
}

/**
 * فحص ما إذا كان المورد مسجلاً قبل تاريخ القطع
 * لا يُعتبر السجل تاريخياً إلا إذا كان تابعاً حصرياً للشركة المؤسسة المحمية
 */
export function isHistoricalSupplier(id?: string, companyId?: string): boolean {
  if (!id) return false;
  if (companyId && !isProtectedCompany(companyId)) return false;
  return HISTORICAL_SUPPLIER_IDS.has(String(id).trim());
}

/**
 * فحص ما إذا كان الصنف مسجلاً قبل تاريخ القطع
 * لا يُعتبر السجل تاريخياً إلا إذا كان تابعاً حصرياً للشركة المؤسسة المحمية
 */
export function isHistoricalItem(id?: string, companyId?: string): boolean {
  if (!id) return false;
  if (companyId && !isProtectedCompany(companyId)) return false;
  return HISTORICAL_ITEM_IDS.has(String(id).trim());
}

/**
 * فحص ما إذا كان الحساب في دليل الحسابات مسجلاً قبل تاريخ القطع ومحمياً
 * لا يُعتبر الحساب تاريخياً إلا إذا كان تابعاً حصرياً للشركة المؤسسة المحمية
 */
export function isHistoricalAccount(id?: string, code?: string, companyId?: string): boolean {
  if (!id && !code) return false;
  if (companyId && !isProtectedCompany(companyId)) return false;
  if (id && HISTORICAL_ACCOUNT_IDS.has(String(id).trim())) return true;
  if (code && HISTORICAL_ACCOUNT_CODES.has(String(code).trim())) return true;
  return false;
}

/**
 * فحص عام لأي جدول
 */
export function isHistoricalRecord(table: string, id?: string, createdAt?: string, code?: string, companyId?: string): boolean {
  if (!id) return false;
  if (companyId && !isProtectedCompany(companyId)) return false;
  const cleanId = String(id).trim();
  switch (table.toLowerCase()) {
    case 'invoices':
      return isHistoricalInvoice(cleanId, createdAt, undefined, companyId);
    case 'journal_entries':
    case 'journals':
      return isHistoricalJournal(cleanId, createdAt, undefined, companyId);
    case 'customers':
      return isHistoricalCustomer(cleanId, companyId);
    case 'suppliers':
      return isHistoricalSupplier(cleanId, companyId);
    case 'items':
      return isHistoricalItem(cleanId, companyId);
    case 'chart_of_accounts':
    case 'accounts':
      return isHistoricalAccount(cleanId, code, companyId);
    default:
      return createdAt ? isBeforeCutover(createdAt) : false;
  }
}

/**
 * سياج التحقق الصارم: يمنع العمليات المحظورة على البيانات القديمة
 * يلقي استثناء فورياً لمنع تنفيذ العملية على الشركة المؤسسة فقط
 */
export function assertOperationAllowed(
  operation: 'UPDATE' | 'DELETE' | 'TRUNCATE' | 'CANCEL' | 'REVERSE' | 'RECONCILE',
  table: string,
  id: string,
  createdAt?: string,
  companyId?: string
): void {
  if (companyId && !isProtectedCompany(companyId)) {
    return; // لا حظر تاريخي على الشركات الجديدة
  }
  if (isHistoricalRecord(table, id, createdAt, undefined, companyId)) {
    const errorMsg = `[حظر حماية البيانات التاريخية الصارم]: محاولة تنفيذ عملية (${operation}) على السجل (${id}) في جدول (${table}) تم رفضها! هذا السجل تاريخي ومحمي حماية قانونية ومحاسبية مطلقة قبل تاريخ القطع (${SYSTEM_CUTOVER_AT}).`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
}
