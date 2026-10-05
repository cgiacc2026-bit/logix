/**
 * خدمة حماية البيانات التاريخية وسياج الأمان المحاسبي المطلق
 * Historical Data Protection Service & Immutability Guard
 * 
 * يطبق المبدأ الأول: حماية البيانات القديمة حماية مطلقة
 * وأي سجل تم إنشاؤه قبل SYSTEM_CUTOVER_AT يعتبر Historical Legacy Data محمي.
 * ممنوع منعاً باتاً: DELETE، UPDATE، إعادة ترحيل، ربط تلقائي بأثر رجعي، أو تعديل الحالة.
 */

import historicalSnapshotData from '../data/historicalSnapshot.json';

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
 */
export function isHistoricalInvoice(id?: string, createdAt?: string, date?: string): boolean {
  if (!id) return false;
  const cleanId = String(id).trim();
  if (HISTORICAL_INVOICE_IDS.has(cleanId)) return true;
  if (createdAt && isBeforeCutover(createdAt)) return true;
  if (date && isBeforeCutover(date + 'T23:59:59.999Z')) return true;
  return false;
}

/**
 * فحص ما إذا كان القيد المحاسبي سجلاً تاريخياً محمياً
 */
export function isHistoricalJournal(id?: string, createdAt?: string, date?: string): boolean {
  if (!id) return false;
  const cleanId = String(id).trim();
  if (HISTORICAL_JOURNAL_IDS.has(cleanId)) return true;
  if (createdAt && isBeforeCutover(createdAt)) return true;
  if (date && isBeforeCutover(date + 'T23:59:59.999Z')) return true;
  return false;
}

/**
 * فحص ما إذا كان العميل مسجلاً قبل تاريخ القطع
 */
export function isHistoricalCustomer(id?: string): boolean {
  if (!id) return false;
  return HISTORICAL_CUSTOMER_IDS.has(String(id).trim());
}

/**
 * فحص ما إذا كان المورد مسجلاً قبل تاريخ القطع
 */
export function isHistoricalSupplier(id?: string): boolean {
  if (!id) return false;
  return HISTORICAL_SUPPLIER_IDS.has(String(id).trim());
}

/**
 * فحص ما إذا كان الصنف مسجلاً قبل تاريخ القطع
 */
export function isHistoricalItem(id?: string): boolean {
  if (!id) return false;
  return HISTORICAL_ITEM_IDS.has(String(id).trim());
}

/**
 * فحص ما إذا كان الحساب في دليل الحسابات مسجلاً قبل تاريخ القطع ومحمياً
 */
export function isHistoricalAccount(id?: string, code?: string): boolean {
  if (id && HISTORICAL_ACCOUNT_IDS.has(String(id).trim())) return true;
  if (code && HISTORICAL_ACCOUNT_CODES.has(String(code).trim())) return true;
  return false;
}

/**
 * فحص عام لأي جدول
 */
export function isHistoricalRecord(table: string, id?: string, createdAt?: string, code?: string): boolean {
  if (!id) return false;
  const cleanId = String(id).trim();
  switch (table.toLowerCase()) {
    case 'invoices':
      return isHistoricalInvoice(cleanId, createdAt);
    case 'journal_entries':
    case 'journals':
      return isHistoricalJournal(cleanId, createdAt);
    case 'customers':
      return isHistoricalCustomer(cleanId);
    case 'suppliers':
      return isHistoricalSupplier(cleanId);
    case 'items':
      return isHistoricalItem(cleanId);
    case 'chart_of_accounts':
    case 'accounts':
      return isHistoricalAccount(cleanId, code);
    default:
      return createdAt ? isBeforeCutover(createdAt) : false;
  }
}

/**
 * سياج التحقق الصارم: يمنع العمليات المحظورة على البيانات القديمة
 * يلقي استثناء فورياً لمنع تنفيذ العملية
 */
export function assertOperationAllowed(
  operation: 'UPDATE' | 'DELETE' | 'TRUNCATE' | 'CANCEL' | 'REVERSE' | 'RECONCILE',
  table: string,
  id: string,
  createdAt?: string
): void {
  if (isHistoricalRecord(table, id, createdAt)) {
    const errorMsg = `[حظر حماية البيانات التاريخية الصارم]: محاولة تنفيذ عملية (${operation}) على السجل (${id}) في جدول (${table}) تم رفضها! هذا السجل تاريخي ومحمي حماية قانونية ومحاسبية مطلقة قبل تاريخ القطع (${SYSTEM_CUTOVER_AT}).`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
}
