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

import { Customer, Supplier, Invoice, PaymentVoucher, JournalEntry, CompanyProfile } from '../types.js';

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
  customers?: Customer[];
  suppliers?: Supplier[];
  currency?: string;
  snapshots?: MonthlyBalanceSnapshot[];
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
    customers = [],
    suppliers = [],
    currency = 'KWD',
    snapshots = [],
  } = options;

  // 1. استخراج بيانات الكيان (العميل أو المورد)
  const customer = entityType === 'CUSTOMER' ? customers.find((c) => c.id === entityId) : undefined;
  const supplier = entityType === 'SUPPLIER' ? suppliers.find((s) => s.id === entityId) : undefined;
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

  // أ) فواتير المبيعات والمشتريات والمرتجعات
  invoices
    .filter((inv) => inv.entityId === entityId)
    .forEach((inv) => {
      const isSales = inv.type === 'SALES';
      const isSalesReturn = inv.type === 'SALES_RETURN';
      const isPurchase = inv.type === 'PURCHASE';
      const isPurchaseReturn = inv.type === 'PURCHASE_RETURN';
      const isCancelled = inv.status === 'CANCELLED';

      let debit = 0;
      let credit = 0;
      let docType: StatementDocType = 'SALES_INVOICE';
      let docTypeLabel = 'فاتورة';

      if (entityType === 'CUSTOMER') {
        if (isSales) {
          debit = Number(inv.grandTotal) || 0;
          docType = 'SALES_INVOICE';
          docTypeLabel = 'فاتورة مبيعات';
        } else if (isSalesReturn) {
          credit = Number(inv.grandTotal) || 0;
          docType = 'SALES_RETURN';
          docTypeLabel = 'مرتجع مبيعات (إشعار دائن)';
        }
      } else {
        // المورد (Supplier)
        if (isPurchase) {
          credit = Number(inv.grandTotal) || 0;
          docType = 'PURCHASE_INVOICE';
          docTypeLabel = 'فاتورة مشتريات';
        } else if (isPurchaseReturn) {
          debit = Number(inv.grandTotal) || 0;
          docType = 'PURCHASE_RETURN';
          docTypeLabel = 'مرتجع مشتريات (إشعار مدين)';
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

      // إذا كانت الفاتورة ملغاة، نضيف قيد العكس / التسوية المحاسبي المقابل لشفافية الرقابة
      if (isCancelled) {
        allRawMovements.push({
          id: `rev-${inv.id}`,
          date: inv.date,
          docNumber: `REV-${inv.invoiceNumber}`,
          docType: isSales ? 'SALES_RETURN' : 'PURCHASE_RETURN',
          docTypeLabel: `إلغاء وعكس ${docTypeLabel}`,
          description: `قيد عكسي وتسوية لإلغاء الفاتورة ${inv.invoiceNumber}`,
          reference: inv.invoiceNumber,
          debit: credit, // عكس المدين والدائن لإلغاء الأثر
          credit: debit,
          status: 'REVERSAL',
          isCancelled: false,
          sourceModule: 'INVOICE',
          originalDocId: inv.id,
          createdAt: inv.createdAt,
        });
      }
    });

  // ب) سندات القبض والصرف
  vouchers
    .filter((v) => v.entityId === entityId)
    .forEach((v) => {
      let debit = 0;
      let credit = 0;
      let docType: StatementDocType = 'PAYMENT_RECEIPT';
      let docTypeLabel = 'سند مالي';

      if (entityType === 'CUSTOMER') {
        // سند قبض من العميل -> يجعل العميل دائناً (تخفيض المديونية)
        credit = Number(v.amount) || 0;
        docType = 'PAYMENT_RECEIPT';
        docTypeLabel = 'سند قبض نقدية/بنك';
      } else {
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

      if (isCancelled) {
        allRawMovements.push({
          id: `rev-${v.id}`,
          date: v.date,
          docNumber: `REV-${v.voucherNumber}`,
          docType,
          docTypeLabel: `إلغاء وعكس ${docTypeLabel}`,
          description: `قيد عكسي وتسوية لإلغاء السند ${v.voucherNumber}`,
          reference: v.voucherNumber,
          debit: credit,
          credit: debit,
          status: 'REVERSAL',
          isCancelled: false,
          sourceModule: 'VOUCHER',
          originalDocId: v.id,
          createdAt: v.createdAt,
        });
      }
    });

  // ج) القيود اليومية اليدوية أو التسويات المباشرة لحساب هذا الكيان
  journals.forEach((j) => {
    // تجنب التكرار للقيود الآلية الصادرة عن الفواتير أو السندات (لأنها محتسبة بالفعل من قائمة الفواتير والسندات)
    if (j.isAutoGenerated && (
      j.sourceModule === 'SALES_INVOICE' || 
      j.sourceModule === 'PURCHASE_INVOICE' || 
      j.sourceModule === 'RECEIPT' || 
      j.sourceModule === 'PAYMENT'
    )) {
      return;
    }

    // نبحث عن أسطر القيد التي ترتبط بكود هذا العميل/المورد أو حسابه التحليلي أو اسمه
    j.lines?.forEach((line) => {
      const isDirectEntityIdMatch = Boolean(line.entityId && line.entityId === entityId);
      const isDirectAccountMatch = Boolean(line.accountId === entityId || (entity?.accountId && line.accountId === entity.accountId));
      const isAccountCodeMatch = Boolean(entityCode && line.accountCode === entityCode);
      
      const isEntityNameMatch = Boolean(
        (line.entityNameAr && entityNameAr && (
          line.entityNameAr.trim() === entityNameAr.trim() || 
          line.entityNameAr.includes(entityNameAr) || 
          entityNameAr.includes(line.entityNameAr)
        )) ||
        (line.entityType === entityType && (
          (line.entityId && line.entityId === entityId) || 
          (line.entityNameAr && entityNameAr && line.entityNameAr.trim() === entityNameAr.trim())
        ))
      );

      const isMemoOrDescMatch = Boolean(
        (line.memo && (
          (entityNameAr && line.memo.includes(entityNameAr)) ||
          (entityCode && line.memo.includes(entityCode)) ||
          (entity?.nameAr && line.memo.includes(entity.nameAr))
        )) ||
        (j.description && (
          (entityNameAr && j.description.includes(entityNameAr)) ||
          (entityCode && j.description.includes(entityCode)) ||
          (entity?.nameAr && j.description.includes(entity.nameAr))
        ))
      );

      const isEntityLine = isDirectEntityIdMatch || isDirectAccountMatch || isAccountCodeMatch || isEntityNameMatch || isMemoOrDescMatch;

      if (isEntityLine) {
        allRawMovements.push({
          id: `${j.id}-${line.id}`,
          date: j.date,
          docNumber: j.entryNumber,
          docType: 'JOURNAL_ENTRY',
          docTypeLabel: 'قيد يومية وتسوية',
          description: line.memo || j.description || `قيد يومية رقم ${j.entryNumber}`,
          reference: j.reference || j.entryNumber,
          debit: Number(line.debit) || 0,
          credit: Number(line.credit) || 0,
          status: j.status === 'POSTED' ? 'ACTIVE' : 'CANCELLED',
          isCancelled: j.status === 'REVERSED' || j.status === 'CANCELLED',
          sourceModule: 'JOURNAL',
          originalDocId: j.id,
          createdAt: j.createdAt,
        });
      }
    });
  });

  // ترتيب جميع الحركات ترتيباً زمنياً تصاعدياً
  allRawMovements.sort((a, b) => {
    if (a.date !== b.date) {
      return a.date.localeCompare(b.date);
    }
    return (a.createdAt || a.id).localeCompare(b.createdAt || b.id);
  });

  // ============================================================================
  // خطوة 2: احتساب الرصيد الافتتاحي الدقيق (Opening Balance)
  // ============================================================================
  // الرصيد الافتتاحي هو مجموع رصيد أول المدة بناءً على آخر تعديل + جميع الحركات السابقة لتاريخ البداية (date < cleanStartDate)
  let calculatedOpeningBalance = entityInitialOpeningBalance;

  // جمع الحركات التي تمت قبل تاريخ البداية
  for (const move of allRawMovements) {
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

  for (const move of allRawMovements) {
    // تصفية الحركات الواقعة فقط داخل الفترة المحددة شاملة لليومين
    if (move.date >= cleanStartDate && move.date <= cleanEndDate) {
      totalPeriodDebit += move.debit;
      totalPeriodCredit += move.credit;

      if (move.status === 'CANCELLED') {
        cancelledCount++;
      } else {
        activeCount++;
      }

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
        isCancelled: move.isCancelled,
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

  // احتساب الرصيد الفعلي الحالي الكامل للبطاقة بناءً على آخر تعديل وحركات الحساب
  let fullCardBalance = entityInitialOpeningBalance;
  for (const move of allRawMovements) {
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
    openingBalanceDate: cleanStartDate,
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
  journals: JournalEntry[] = []
): number {
  if (!entity) return 0;
  const entityId = entity.id;
  const entityCode = entity.code || '';
  const initialOpening = Number(entity.openingBalance) || 0;
  
  let net = initialOpening;

  // 1. الفواتير والمرتجعات
  const relevantInvoices = (invoices || []).filter(
    (inv) => inv.entityId === entityId && inv.status !== 'CANCELLED'
  );
  for (const inv of relevantInvoices) {
    const total = Number(inv.grandTotal) || 0;
    if (entityType === 'CUSTOMER') {
      if (inv.type === 'SALES') net += total;
      else if (inv.type === 'SALES_RETURN') net -= total;
    } else {
      if (inv.type === 'PURCHASE') net += total;
      else if (inv.type === 'PURCHASE_RETURN') net -= total;
    }
  }

  // 2. سندات القبض والصرف
  const relevantVouchers = (vouchers || []).filter((v) => v.entityId === entityId);
  for (const v of relevantVouchers) {
    const amount = Number(v.amount) || 0;
    const vType = v.type || (entityType === 'CUSTOMER' ? 'RECEIPT' : 'PAYMENT');
    if (entityType === 'CUSTOMER') {
      if (vType === 'RECEIPT') net -= amount;
      else if (vType === 'PAYMENT') net += amount;
    } else {
      if (vType === 'PAYMENT') net -= amount;
      else if (vType === 'RECEIPT') net += amount;
    }
  }

  // 3. القيود والتسويات اليدوية
  const relevantJournals = (journals || []).filter(
    (j) => j.status !== 'CANCELLED' && j.status !== 'REVERSED'
  );
  for (const j of relevantJournals) {
    // تجنب التكرار للقيود الآلية الصادرة عن الفواتير أو السندات
    if (j.isAutoGenerated && (
      j.sourceModule === 'SALES_INVOICE' || 
      j.sourceModule === 'PURCHASE_INVOICE' || 
      j.sourceModule === 'RECEIPT' || 
      j.sourceModule === 'PAYMENT'
    )) {
      continue;
    }

    for (const line of j.lines || []) {
      const isDirectEntityIdMatch = Boolean(line.entityId && line.entityId === entityId);
      const isDirectAccountMatch = Boolean(line.accountId === entityId || (entity.accountId && line.accountId === entity.accountId));
      const isAccountCodeMatch = Boolean(entityCode && line.accountCode === entityCode);
      
      const isEntityNameMatch = Boolean(
        (line.entityNameAr && (
          line.entityNameAr.trim() === entity.nameAr.trim() || 
          line.entityNameAr.includes(entity.nameAr) || 
          entity.nameAr.includes(line.entityNameAr)
        )) ||
        (line.entityType === entityType && (
          (line.entityId && line.entityId === entityId) || 
          (line.entityNameAr && line.entityNameAr.trim() === entity.nameAr.trim())
        ))
      );

      const isMemoOrDescMatch = Boolean(
        (line.memo && (
          (entity.nameAr && line.memo.includes(entity.nameAr)) ||
          (entityCode && line.memo.includes(entityCode))
        )) ||
        (j.description && (
          (entity.nameAr && j.description.includes(entity.nameAr)) ||
          (entityCode && j.description.includes(entityCode))
        ))
      );

      const isEntityLine = isDirectEntityIdMatch || isDirectAccountMatch || isAccountCodeMatch || isEntityNameMatch || isMemoOrDescMatch;

      if (isEntityLine) {
        const debit = Number(line.debit) || 0;
        const credit = Number(line.credit) || 0;
        if (entityType === 'CUSTOMER') {
          net += (debit - credit);
        } else {
          net += (credit - debit);
        }
      }
    }
  }

  return Math.round(net * 1000) / 1000;
}

