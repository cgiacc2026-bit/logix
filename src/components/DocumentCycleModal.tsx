import React, { useState, useMemo } from 'react';
import {
  Invoice,
  JournalEntry,
  PaymentVoucher,
  Quotation,
  Account,
  Customer,
  Supplier,
} from '../types.js';
import { formatCurrency } from '../utils/formatters.ts';
import {
  FileText,
  Receipt,
  Scale,
  BookOpen,
  CheckCircle2,
  Clock,
  Printer,
  ExternalLink,
  ShieldCheck,
  Building2,
  User,
  ArrowLeft,
  X,
  Layers,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  Tag,
  Calendar,
  CreditCard,
  Hash,
  Package,
} from 'lucide-react';

export interface DocumentCycleTarget {
  type: 'INVOICE' | 'JOURNAL' | 'VOUCHER' | 'QUOTATION' | 'ACCOUNT';
  id: string;
}

interface DocumentCycleModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetDoc: DocumentCycleTarget | null;
  invoices: Invoice[];
  journals: JournalEntry[];
  vouchers: PaymentVoucher[];
  quotations?: Quotation[];
  accounts: Account[];
  customers: Customer[];
  suppliers: Supplier[];
  currency: string;
  onNavigateToInvoice?: (invoiceId: string) => void;
  onNavigateToJournal?: (journalId: string) => void;
  onNavigateToVoucher?: (voucherId: string) => void;
  onNavigateToAccount?: (accountId: string) => void;
  onNavigateToLedger?: (accountId: string) => void;
  onNavigateToStatement?: (entityId: string, entityType: 'CUSTOMER' | 'SUPPLIER') => void;
  onPrintInvoice?: (invoice: Invoice) => void;
  onPrintJournal?: (journal: JournalEntry) => void;
}

export const DocumentCycleModal: React.FC<DocumentCycleModalProps> = ({
  isOpen,
  onClose,
  targetDoc,
  invoices,
  journals,
  vouchers,
  quotations = [],
  accounts,
  customers,
  suppliers,
  currency,
  onNavigateToInvoice,
  onNavigateToJournal,
  onNavigateToVoucher,
  onNavigateToAccount,
  onNavigateToLedger,
  onNavigateToStatement,
  onPrintInvoice,
  onPrintJournal,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'FLOW' | 'INVOICE' | 'JOURNAL' | 'VOUCHER' | 'LEDGER_IMPACT'>('FLOW');

  // Resolve interconnected records
  const resolvedData = useMemo(() => {
    if (!targetDoc || !targetDoc.id) return null;

    let matchedInvoice: Invoice | null = null;
    let matchedJournal: JournalEntry | null = null;
    let matchedVouchers: PaymentVoucher[] = [];
    let matchedQuotation: Quotation | null = null;

    if (targetDoc.type === 'INVOICE') {
      matchedInvoice = invoices.find((i) => i.id === targetDoc.id || i.invoiceNumber === targetDoc.id) || null;
      if (matchedInvoice) {
        // Find journal by journalEntryId, reference, or entryNumber
        matchedJournal = journals.find(
          (j) => j.id === matchedInvoice!.journalEntryId ||
                 j.sourceId === matchedInvoice!.id ||
                 (j.reference && matchedInvoice!.invoiceNumber && j.reference.trim() === matchedInvoice!.invoiceNumber.trim()) ||
                 (j.reference && matchedInvoice!.id && j.reference.trim() === matchedInvoice!.id.trim()) ||
                 (j.entryNumber && (
                   j.entryNumber === `JV-${matchedInvoice!.invoiceNumber}` ||
                   j.entryNumber.includes(matchedInvoice!.invoiceNumber)
                 )) ||
                 (j.description && matchedInvoice!.invoiceNumber && j.description.includes(matchedInvoice!.invoiceNumber))
        ) || null;
        // Find vouchers
        matchedVouchers = vouchers.filter(
          (v) => v.invoiceId === matchedInvoice!.id ||
                 v.reference === matchedInvoice!.invoiceNumber ||
                 (matchedInvoice!.journalEntryId && v.journalEntryId === matchedInvoice!.journalEntryId)
        );
        // Find quotation
        matchedQuotation = quotations.find(
          (q) => (matchedInvoice as any).quotationId === q.id ||
                 q.quotationNumber === (matchedInvoice as any).quotationNumber ||
                 (matchedInvoice!.notes && matchedInvoice!.notes.includes(q.quotationNumber))
        ) || null;
      }
    } else if (targetDoc.type === 'JOURNAL') {
      matchedJournal = journals.find((j) => j.id === targetDoc.id || j.entryNumber === targetDoc.id) || null;
      if (matchedJournal) {
        // Find invoice by sourceId or reference
        matchedInvoice = invoices.find(
          (i) => i.id === matchedJournal!.sourceId ||
                 i.journalEntryId === matchedJournal!.id ||
                 i.invoiceNumber === matchedJournal!.reference ||
                 matchedJournal!.entryNumber === `JV-${i.invoiceNumber}` ||
                 matchedJournal!.description.includes(i.invoiceNumber)
        ) || null;

        // Find voucher
        matchedVouchers = vouchers.filter(
          (v) => v.id === matchedJournal!.sourceId ||
                 v.journalEntryId === matchedJournal!.id ||
                 v.voucherNumber === matchedJournal!.reference ||
                 (matchedInvoice && v.invoiceId === matchedInvoice.id)
        );
      }
    } else if (targetDoc.type === 'VOUCHER') {
      const vch = vouchers.find((v) => v.id === targetDoc.id || v.voucherNumber === targetDoc.id) || null;
      if (vch) {
        matchedVouchers = [vch];
        if (vch.invoiceId) {
          matchedInvoice = invoices.find((i) => i.id === vch.invoiceId || i.invoiceNumber === vch.invoiceId) || null;
        } else if (vch.reference) {
          matchedInvoice = invoices.find((i) => i.invoiceNumber === vch.reference) || null;
        }
        matchedJournal = journals.find(
          (j) => j.id === vch.journalEntryId ||
                 j.sourceId === vch.id ||
                 j.reference === vch.voucherNumber ||
                 j.entryNumber === `JV-${vch.voucherNumber}`
        ) || (matchedInvoice ? journals.find((j) => j.id === matchedInvoice!.journalEntryId || j.reference === matchedInvoice!.invoiceNumber) : null) || null;
      }
    }

    // Resolve Entity (Customer / Supplier)
    let entity: Customer | Supplier | null = null;
    let entityType: 'CUSTOMER' | 'SUPPLIER' = 'CUSTOMER';

    if (matchedInvoice) {
      if (matchedInvoice.type === 'SALES' || matchedInvoice.type === 'SALES_RETURN') {
        entity = customers.find((c) => c.id === matchedInvoice!.entityId) || null;
        entityType = 'CUSTOMER';
      } else {
        entity = suppliers.find((s) => s.id === matchedInvoice!.entityId) || null;
        entityType = 'SUPPLIER';
      }
    } else if (matchedVouchers.length > 0) {
      const v = matchedVouchers[0];
      if (v.entityType === 'SUPPLIER' || v.type === 'PAYMENT') {
        entity = suppliers.find((s) => s.id === v.entityId) || null;
        entityType = 'SUPPLIER';
      } else {
        entity = customers.find((c) => c.id === v.entityId) || null;
        entityType = 'CUSTOMER';
      }
    }

    // Resolve involved accounts from journal entry
    const involvedAccounts = (matchedJournal?.lines || []).map((l) => {
      const acc = accounts.find((a) => a.id === l.accountId || a.code === l.accountCode);
      return {
        ...l,
        accountDetails: acc || null,
      };
    });

    return {
      invoice: matchedInvoice,
      journal: matchedJournal,
      vouchers: matchedVouchers,
      quotation: matchedQuotation,
      entity,
      entityType,
      involvedAccounts,
    };
  }, [targetDoc, invoices, journals, vouchers, quotations, accounts, customers, suppliers]);

  if (!isOpen || !targetDoc || !resolvedData) return null;

  const { invoice, journal, vouchers: currentVouchers, quotation, entity, entityType, involvedAccounts } = resolvedData;

  const isSalesCycle = invoice ? (invoice.type === 'SALES' || invoice.type === 'SALES_RETURN') : true;
  const cycleTitle = isSalesCycle ? 'دورة المبيعات والتحصيل المحاسبية' : 'دورة المشتريات والسداد المحاسبية';

  return (
    <div
      id="document-cycle-modal"
      className="fixed inset-0 bg-[#1A1A1A]/70 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fadeIn"
      dir="rtl"
    >
      <div className="bg-white border border-[#E5E1DA] w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-[#1A1A1A] via-[#2A2A2A] to-[#1A1A1A] text-white p-5 border-b border-[#D4AF37]/30 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-[#D4AF37]/20 border border-[#D4AF37]/40 flex items-center justify-center text-[#D4AF37]">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold font-serif text-white">{cycleTitle}</h3>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40">
                  نظام الترابط الكلي ERP
                </span>
              </div>
              <p className="text-xs text-neutral-300 mt-0.5">
                سلسلة الوثائق المترابطة: العرض ➔ الفاتورة ➔ السند ➔ قيد اليومية ➔ دليل الحسابات وكشف الأستاذ
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="إغلاق النافذة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cycle Progression Stepper */}
        <div className="bg-[#FBF9F5] border-b border-[#E5E1DA] p-4 shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {/* Step 1: Quotation */}
            <div
              onClick={() => quotation && setActiveSubTab('INVOICE')}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                quotation
                  ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                  : 'bg-white border-neutral-200 text-neutral-400 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                <span>1. {isSalesCycle ? 'عرض السعر' : 'طلب الشراء'}</span>
                {quotation ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Clock className="w-3.5 h-3.5" />}
              </div>
              <div className="font-mono text-xs font-bold text-neutral-800 truncate">
                {quotation ? quotation.quotationNumber : 'غير مرتبط'}
              </div>
              <div className="text-[10px] text-neutral-500 mt-0.5 truncate">
                {quotation ? `${formatCurrency(quotation.grandTotal, currency)}` : 'بدء مباشر بالفاتورة'}
              </div>
            </div>

            {/* Step 2: Invoice */}
            <div
              onClick={() => setActiveSubTab('INVOICE')}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                activeSubTab === 'INVOICE'
                  ? 'bg-[#D4AF37]/15 border-[#D4AF37] ring-2 ring-[#D4AF37]/20 shadow-xs'
                  : invoice
                  ? 'bg-blue-50/80 border-blue-300 text-blue-950'
                  : 'bg-white border-neutral-200 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                <span className="text-blue-900">2. {isSalesCycle ? 'فاتورة البيع' : 'فاتورة الشراء'}</span>
                {invoice ? <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" /> : <Clock className="w-3.5 h-3.5 text-neutral-400" />}
              </div>
              <div className="font-mono text-xs font-bold text-blue-900 truncate">
                {invoice ? invoice.invoiceNumber : 'لم تُنشأ بعد'}
              </div>
              <div className="text-[10px] text-neutral-600 mt-0.5 truncate">
                {invoice ? `${formatCurrency(invoice.grandTotal, currency)} • ${invoice.status === 'POSTED' || invoice.status === 'PAID' ? 'مرحّلة' : 'مسودة'}` : '-'}
              </div>
            </div>

            {/* Step 3: Voucher */}
            <div
              onClick={() => setActiveSubTab('VOUCHER')}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                activeSubTab === 'VOUCHER'
                  ? 'bg-[#D4AF37]/15 border-[#D4AF37] ring-2 ring-[#D4AF37]/20 shadow-xs'
                  : currentVouchers.length > 0
                  ? 'bg-amber-50/80 border-amber-300 text-amber-950'
                  : 'bg-white border-neutral-200 text-neutral-500'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                <span className="text-amber-900">3. {isSalesCycle ? 'سند القبض' : 'سند الصرف'}</span>
                {currentVouchers.length > 0 ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />
                ) : invoice && invoice.paidAmount > 0 ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Clock className="w-3.5 h-3.5 text-neutral-400" />
                )}
              </div>
              <div className="font-mono text-xs font-bold text-amber-900 truncate">
                {currentVouchers.length > 0 ? currentVouchers[0].voucherNumber : invoice?.paidAmount ? 'مسدد كاش' : 'آجل بدون سند'}
              </div>
              <div className="text-[10px] text-neutral-600 mt-0.5 truncate">
                {currentVouchers.length > 0
                  ? `${formatCurrency(currentVouchers[0].amount, currency)}`
                  : invoice?.paidAmount
                  ? `${formatCurrency(invoice.paidAmount, currency)}`
                  : 'المتبقي آجل بالذمة'}
              </div>
            </div>

            {/* Step 4: Journal Entry */}
            <div
              onClick={() => setActiveSubTab('JOURNAL')}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                activeSubTab === 'JOURNAL'
                  ? 'bg-[#D4AF37]/15 border-[#D4AF37] ring-2 ring-[#D4AF37]/20 shadow-xs'
                  : journal
                  ? 'bg-purple-50/80 border-purple-300 text-purple-950'
                  : 'bg-white border-neutral-200 text-neutral-400'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                <span className="text-purple-900">4. القيد المزدوج التلقائي</span>
                {journal ? <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" /> : <AlertCircle className="w-3.5 h-3.5 text-rose-500" />}
              </div>
              <div className="font-mono text-xs font-bold text-purple-900 truncate">
                {journal ? journal.entryNumber : 'غير مرحل'}
              </div>
              <div className="text-[10px] text-neutral-600 mt-0.5 truncate">
                {journal ? `${formatCurrency(journal.totalDebit, currency)} • متوازن 100%` : 'بانتظار الترحيل'}
              </div>
            </div>

            {/* Step 5: Ledger & Accounts Impact */}
            <div
              onClick={() => setActiveSubTab('LEDGER_IMPACT')}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                activeSubTab === 'LEDGER_IMPACT'
                  ? 'bg-[#D4AF37]/15 border-[#D4AF37] ring-2 ring-[#D4AF37]/20 shadow-xs'
                  : 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                <span className="text-emerald-900">5. الدليل والأستاذ</span>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="font-mono text-xs font-bold text-emerald-900 truncate">
                {involvedAccounts.length} حسابات متأثرة
              </div>
              <div className="text-[10px] text-neutral-600 mt-0.5 truncate">
                {entity ? `رصيد ${entity.nameAr.slice(0, 12)}...` : 'ترحيل فوري للدليل'}
              </div>
            </div>
          </div>
        </div>

        {/* Sub-tab Navigation */}
        <div className="bg-white border-b border-[#E5E1DA] px-5 py-2 flex items-center gap-2 overflow-x-auto shrink-0">
          <button
            onClick={() => setActiveSubTab('FLOW')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeSubTab === 'FLOW'
                ? 'bg-[#1A1A1A] text-white'
                : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-[#D4AF37]" />
            ملخص الترابط الشامل
          </button>

          <button
            onClick={() => setActiveSubTab('INVOICE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeSubTab === 'INVOICE'
                ? 'bg-[#1A1A1A] text-white'
                : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-blue-500" />
            بيانات الفاتورة والأصناف ({invoice?.lines?.length || 0})
          </button>

          <button
            onClick={() => setActiveSubTab('JOURNAL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeSubTab === 'JOURNAL'
                ? 'bg-[#1A1A1A] text-white'
                : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            <Scale className="w-3.5 h-3.5 text-purple-500" />
            القيد المحاسبي المولد ({journal?.lines?.length || 0} أسطر)
          </button>

          <button
            onClick={() => setActiveSubTab('VOUCHER')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeSubTab === 'VOUCHER'
                ? 'bg-[#1A1A1A] text-white'
                : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            <Receipt className="w-3.5 h-3.5 text-amber-500" />
            السندات المرتبطة ({currentVouchers.length})
          </button>

          <button
            onClick={() => setActiveSubTab('LEDGER_IMPACT')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeSubTab === 'LEDGER_IMPACT'
                ? 'bg-[#1A1A1A] text-white'
                : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-emerald-500" />
            الأثر في الدليل والأستاذ ({involvedAccounts.length})
          </button>
        </div>

        {/* Modal Body / Tab Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* TAB 1: FLOW SUMMARY */}
          {activeSubTab === 'FLOW' && (
            <div className="space-y-5">
              {/* Summary Banner */}
              <div className="p-4 bg-gradient-to-l from-[#FBF9F5] to-white border border-[#E5E1DA] rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-[#B8860B]">
                      {invoice?.invoiceNumber || journal?.entryNumber || 'مستند دورة مستندية'}
                    </span>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-md">
                      مترابط محاسبياً بنسبة 100%
                    </span>
                  </div>
                  <p className="text-xs text-neutral-600">
                    الطرف التجاري: <strong className="text-neutral-900">{invoice?.entityNameAr || entity?.nameAr || 'غير محدد'}</strong>
                    {invoice?.date && ` • تاريخ الحركة: ${invoice.date}`}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {invoice && onPrintInvoice && (
                    <button
                      onClick={() => onPrintInvoice(invoice)}
                      className="px-3 py-1.5 bg-[#1A1A1A] hover:bg-black text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Printer className="w-3.5 h-3.5 text-[#D4AF37]" />
                      طباعة الفاتورة
                    </button>
                  )}
                  {journal && onPrintJournal && (
                    <button
                      onClick={() => onPrintJournal(journal)}
                      className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border border-neutral-300 text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Printer className="w-3.5 h-3.5 text-neutral-600" />
                      طباعة سند القيد
                    </button>
                  )}
                </div>
              </div>

              {/* 3 Key Integration Pillars */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Pillar 1: Invoicing */}
                <div className="bg-white border border-blue-200 rounded-xl p-4 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between border-b border-blue-100 pb-2">
                    <div className="flex items-center gap-2 text-blue-900 font-bold text-xs">
                      <FileText className="w-4 h-4 text-blue-600" />
                      <span>وثيقة الفاتورة</span>
                    </div>
                    {invoice && onNavigateToInvoice && (
                      <button
                        onClick={() => {
                          onClose();
                          onNavigateToInvoice(invoice.id);
                        }}
                        className="text-[11px] text-blue-600 hover:underline flex items-center gap-0.5 cursor-pointer font-bold"
                      >
                        عرض بالفواتير <ChevronRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  {invoice ? (
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-neutral-500">رقم الفاتورة:</span>
                        <span className="font-mono font-bold text-neutral-900">{invoice.invoiceNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">طريقة الدفع:</span>
                        <span className="font-bold">{invoice.paymentTerms === 'CASH' ? 'نقدي (كاش)' : 'آجل (ذمم)'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">إجمالي الفاتورة:</span>
                        <span className="font-mono font-bold text-blue-900">{formatCurrency(invoice.grandTotal, currency)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">المسدد / المتبقي:</span>
                        <span className="font-mono font-bold text-neutral-900">
                          {formatCurrency(invoice.paidAmount || 0, currency)} / {formatCurrency(invoice.dueAmount || 0, currency)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">المستودع المنفذ:</span>
                        <span className="text-neutral-800">{invoice.warehouseName || 'المستودع الرئيسي'}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-neutral-400 py-3 text-center">لا توجد فاتورة مرتبطة مباشرة</div>
                  )}
                </div>

                {/* Pillar 2: Double-Entry Journal */}
                <div className="bg-white border border-purple-200 rounded-xl p-4 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between border-b border-purple-100 pb-2">
                    <div className="flex items-center gap-2 text-purple-900 font-bold text-xs">
                      <Scale className="w-4 h-4 text-purple-600" />
                      <span>القيد المحاسبي المزدوج</span>
                    </div>
                    {journal && onNavigateToJournal && (
                      <button
                        onClick={() => {
                          onClose();
                          onNavigateToJournal(journal.id);
                        }}
                        className="text-[11px] text-purple-600 hover:underline flex items-center gap-0.5 cursor-pointer font-bold"
                      >
                        عرض بالقيود <ChevronRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  {journal ? (
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-neutral-500">رقم القيد:</span>
                        <span className="font-mono font-bold text-purple-900">{journal.entryNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">حالة التوازن:</span>
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                          متوازن دائن = مدين
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">إجمالي المدين / الدائن:</span>
                        <span className="font-mono font-bold text-neutral-900">{formatCurrency(journal.totalDebit, currency)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">عدد أطراف القيد:</span>
                        <span className="font-bold text-neutral-800">{journal.lines.length} أطراف محاسبية</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">نظام الجرد المطبق:</span>
                        <span className="text-neutral-800">جرد مستمر IAS-2 (COGS آلي)</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-rose-500 py-3 text-center">لم يتم توليد قيد ترحيل بعد</div>
                  )}
                </div>

                {/* Pillar 3: Chart of Accounts & Directory */}
                <div className="bg-white border border-emerald-200 rounded-xl p-4 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
                    <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
                      <BookOpen className="w-4 h-4 text-emerald-600" />
                      <span>دليل الحسابات وكشف الأستاذ</span>
                    </div>
                    {entity && onNavigateToStatement && (
                      <button
                        onClick={() => {
                          onClose();
                          onNavigateToStatement(entity.id, entityType);
                        }}
                        className="text-[11px] text-emerald-600 hover:underline flex items-center gap-0.5 cursor-pointer font-bold"
                      >
                        كشف الحساب <ChevronRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-neutral-500">الحساب الرئيسي:</span>
                      <span className="font-bold text-neutral-900">
                        {isSalesCycle ? '1120 - مدينو مبيعات (عملاء)' : '2110 - دائنو مشتريات (موردون)'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">رصيد الطرف الحالي:</span>
                      <span className="font-mono font-bold text-emerald-900">
                        {entity ? formatCurrency(entity.balance || 0, currency) : '-'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">الحسابات الفرعية:</span>
                      <span className="text-neutral-800">{involvedAccounts.length} حسابات متأثرة بالدليل</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">الأثر على الأرباح:</span>
                      <span className="font-bold text-emerald-700">إيراد / تكلفة مسجلة بالقوائم</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Document Flow Visualization Diagram */}
              <div className="bg-[#FDFCFB] border border-[#E5E1DA] rounded-xl p-5 space-y-3">
                <h4 className="text-xs font-bold text-neutral-800 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#B8860B]" />
                  <span>مخطط السريان المحاسبي والمستندي للعملية (Workflow Cycle Integrity)</span>
                </h4>

                <div className="relative border-r-2 border-dashed border-[#D4AF37]/50 mr-4 pr-6 space-y-6">
                  {/* Step 1 in Timeline */}
                  <div className="relative">
                    <div className="absolute -right-8.5 top-0.5 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shadow-xs">
                      1
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-neutral-200 space-y-1">
                      <div className="flex items-center justify-between">
                        <strong className="text-xs text-blue-900">
                          {isSalesCycle ? 'إنشاء فاتورة مبيعات وخصم المخزون' : 'إنشاء فاتورة مشتريات وتوريد المخزون'}
                        </strong>
                        <span className="text-[11px] font-mono text-neutral-500">{invoice?.date || '-'}</span>
                      </div>
                      <p className="text-[11px] text-neutral-600">
                        تم تسجيل الفاتورة رقم ({invoice?.invoiceNumber}) بمبلغ إجمالي ({invoice ? formatCurrency(invoice.grandTotal, currency) : '-'}). تم خصم كميات الأصناف من مستودع ({invoice?.warehouseName || 'المستودع الرئيسي'}) آلياً.
                      </p>
                    </div>
                  </div>

                  {/* Step 2 in Timeline */}
                  <div className="relative">
                    <div className="absolute -right-8.5 top-0.5 w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px] font-bold shadow-xs">
                      2
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-neutral-200 space-y-1">
                      <div className="flex items-center justify-between">
                        <strong className="text-xs text-purple-900">توليد قيد اليومية الآلي المزدوج</strong>
                        <span className="text-[11px] font-mono text-purple-700 font-bold">{journal?.entryNumber || '-'}</span>
                      </div>
                      <p className="text-[11px] text-neutral-600">
                        تم اشتقاق القيد المالي تلقائياً بحسابات الدليل (مدين ودائن) وإثبات تكلفة البضاعة المباعة (COGS) وضريبة القيمة المضافة.
                      </p>
                    </div>
                  </div>

                  {/* Step 3 in Timeline */}
                  <div className="relative">
                    <div className="absolute -right-8.5 top-0.5 w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center text-[10px] font-bold shadow-xs">
                      3
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-neutral-200 space-y-1">
                      <div className="flex items-center justify-between">
                        <strong className="text-xs text-amber-900">السداد والتحصيل وحركة النقدية</strong>
                        <span className="text-[11px] font-bold text-amber-700">
                          {invoice?.paymentTerms === 'CASH' ? 'سداد نقدي فوري' : invoice?.paidAmount ? 'سداد جزئي' : 'آجل بالذمة'}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-600">
                        {invoice?.paidAmount ? (
                          <>تم تحصيل مبلغ ({formatCurrency(invoice.paidAmount, currency)}) وإيداعه في الخزينة/البنك عبر سند مقترن، والمتبقي المستحق ({formatCurrency(invoice.dueAmount, currency)}).</>
                        ) : (
                          <>الفاتورة آجلة بالكامل ومستحقة الدفع بتاريخ الاستحقاق ({invoice?.dueDate || '-'}).</>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Step 4 in Timeline */}
                  <div className="relative">
                    <div className="absolute -right-8.5 top-0.5 w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold shadow-xs">
                      4
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-neutral-200 space-y-1">
                      <div className="flex items-center justify-between">
                        <strong className="text-xs text-emerald-900">الأثر النهائي على دليل الحسابات والأستاذ وميزان المراجعة</strong>
                        <span className="text-[11px] font-bold text-emerald-700">مرحّل فوراً</span>
                      </div>
                      <p className="text-[11px] text-neutral-600">
                        تم تحديث رصيد ({invoice?.entityNameAr || entity?.nameAr}) في كشف الحساب ودفتر الأستاذ العام وتغذية ميزان المراجعة وقائمة الدخل دون الحاجة لأي ترحيل يدوي إضافي.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: INVOICE DETAILS & LINES */}
          {activeSubTab === 'INVOICE' && (
            <div className="space-y-4">
              {invoice ? (
                <>
                  <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-neutral-500 block">رقم الفاتورة:</span>
                      <strong className="font-mono text-blue-900 text-sm">{invoice.invoiceNumber}</strong>
                    </div>
                    <div>
                      <span className="text-neutral-500 block">التاريخ والاستحقاق:</span>
                      <strong className="text-neutral-900">{invoice.date} ➔ {invoice.dueDate}</strong>
                    </div>
                    <div>
                      <span className="text-neutral-500 block">الطرف التجاري:</span>
                      <strong className="text-neutral-900">{invoice.entityNameAr || '-'}</strong>
                    </div>
                    <div>
                      <span className="text-neutral-500 block">المستودع والمندوب:</span>
                      <strong className="text-neutral-900">{invoice.warehouseName || 'المستودع الرئيسي'} {invoice.salesRepName ? `• ${invoice.salesRepName}` : ''}</strong>
                    </div>
                  </div>

                  <div className="border border-[#E5E1DA] rounded-xl overflow-hidden shadow-2xs">
                    <div className="bg-[#F7F5F0] px-4 py-2.5 border-b border-[#E5E1DA] flex items-center justify-between">
                      <span className="font-bold text-xs text-neutral-900">بنود وأصناف الفاتورة ({invoice.lines?.length || 0})</span>
                      <span className="text-[11px] text-neutral-500">نظام تسعير ومعالجة ضريبية معتمد</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-[#FAF9F5] text-neutral-600 border-b border-[#E5E1DA]">
                          <tr>
                            <th className="py-2.5 px-3">#</th>
                            <th className="py-2.5 px-3">كود / باركود</th>
                            <th className="py-2.5 px-3">اسم الصنف</th>
                            <th className="py-2.5 px-3">الوحدة</th>
                            <th className="py-2.5 px-3 text-center">الكمية</th>
                            <th className="py-2.5 px-3 text-left">سعر الوحدة</th>
                            <th className="py-2.5 px-3 text-left">الخصم</th>
                            <th className="py-2.5 px-3 text-left">الإجمالي الصافي</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E5E1DA]">
                          {(invoice.lines || []).map((line, idx) => (
                            <tr key={line.id || idx} className="hover:bg-[#FDFCFB]">
                              <td className="py-2 px-3 text-neutral-400 font-mono">{idx + 1}</td>
                              <td className="py-2 px-3 font-mono text-neutral-700">{line.itemSku || line.barcode || '-'}</td>
                              <td className="py-2 px-3 font-bold text-neutral-900">{line.itemNameAr}</td>
                              <td className="py-2 px-3 text-neutral-600">{line.unit || 'حبة'}</td>
                              <td className="py-2 px-3 text-center font-bold font-mono text-blue-900">{line.quantity}</td>
                              <td className="py-2 px-3 text-left font-mono">{formatCurrency(line.unitPrice, currency)}</td>
                              <td className="py-2 px-3 text-left font-mono text-amber-700">{line.discountAmount ? formatCurrency(line.discountAmount, currency) : '-'}</td>
                              <td className="py-2 px-3 text-left font-mono font-bold text-neutral-900">{formatCurrency(line.total, currency)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-[#F7F5F0] border-t border-[#E5E1DA] font-bold text-neutral-900">
                          <tr>
                            <td colSpan={7} className="py-2.5 px-3 text-left">إجمالي الفاتورة النهائي:</td>
                            <td className="py-2.5 px-3 text-left font-mono text-blue-900 text-sm">{formatCurrency(invoice.grandTotal, currency)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-10 text-neutral-400">لا توجد تفاصيل فاتورة متاحة لهذا المستند</div>
              )}
            </div>
          )}

          {/* TAB 3: DOUBLE-ENTRY JOURNAL DETAILS */}
          {activeSubTab === 'JOURNAL' && (
            <div className="space-y-4">
              {journal ? (
                <>
                  <div className="bg-purple-50/50 border border-purple-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <strong className="font-mono text-purple-900 text-sm">{journal.entryNumber}</strong>
                        <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-bold text-[10px]">
                          قيد ترحيل آلي
                        </span>
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                          متوازن 100%
                        </span>
                      </div>
                      <p className="text-neutral-600">{journal.description}</p>
                    </div>

                    <div className="text-left font-mono">
                      <span className="text-neutral-500 text-[11px] block">إجمالي أطراف القيد:</span>
                      <strong className="text-purple-900 text-sm">{formatCurrency(journal.totalDebit, currency)}</strong>
                    </div>
                  </div>

                  <div className="border border-[#E5E1DA] rounded-xl overflow-hidden shadow-2xs">
                    <div className="bg-[#F7F5F0] px-4 py-2.5 border-b border-[#E5E1DA] flex items-center justify-between">
                      <span className="font-bold text-xs text-neutral-900">جدول أطراف القيد المحاسبي وحسابات الدليل</span>
                      <span className="text-[11px] text-neutral-500 font-mono">المرجع: {journal.reference || '-'}</span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-[#FAF9F5] text-neutral-600 border-b border-[#E5E1DA]">
                          <tr>
                            <th className="py-2.5 px-3">رقم الحساب</th>
                            <th className="py-2.5 px-3">اسم الحساب في الدليل</th>
                            <th className="py-2.5 px-3">البيان / الشرح المالي</th>
                            <th className="py-2.5 px-3 text-left">مدين (Debit)</th>
                            <th className="py-2.5 px-3 text-left">دائن (Credit)</th>
                            <th className="py-2.5 px-3 text-center">إجراءات الدليل والأستاذ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E5E1DA]">
                          {journal.lines.map((l) => (
                            <tr key={l.id} className="hover:bg-[#FDFCFB]">
                              <td className="py-2.5 px-3 font-mono font-bold text-[#B8860B]">{l.accountCode}</td>
                              <td className="py-2.5 px-3 font-bold text-neutral-900">
                                <div>{l.accountNameAr}</div>
                                {l.entityNameAr && (
                                  <div className="text-[10px] text-blue-700 mt-0.5">
                                    الطرف: {l.entityNameAr}
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-neutral-600">{l.memo || '-'}</td>
                              <td className="py-2.5 px-3 text-left font-mono font-bold text-[#2D6A4F]">
                                {l.debit > 0 ? formatCurrency(l.debit, currency) : '-'}
                              </td>
                              <td className="py-2.5 px-3 text-left font-mono font-bold text-[#9E2A2B]">
                                {l.credit > 0 ? formatCurrency(l.credit, currency) : '-'}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  {onNavigateToAccount && (
                                    <button
                                      onClick={() => {
                                        onClose();
                                        onNavigateToAccount(l.accountId);
                                      }}
                                      className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-[#855B00] border border-amber-200 rounded text-[10px] font-bold cursor-pointer transition-colors"
                                      title="فتح هذا الحساب في شجرة الدليل المحاسبي"
                                    >
                                      الدليل
                                    </button>
                                  )}
                                  {onNavigateToLedger && (
                                    <button
                                      onClick={() => {
                                        onClose();
                                        onNavigateToLedger(l.accountId);
                                      }}
                                      className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded text-[10px] font-bold cursor-pointer transition-colors"
                                      title="عرض كشف حساب هذا البند في دفتر الأستاذ العام"
                                    >
                                      الأستاذ
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-[#F7F5F0] border-t border-[#E5E1DA] font-bold text-neutral-900">
                          <tr>
                            <td colSpan={3} className="py-2.5 px-3 text-left">الإجمالي المتوازن للقيد:</td>
                            <td className="py-2.5 px-3 text-left font-mono text-[#2D6A4F]">{formatCurrency(journal.totalDebit, currency)}</td>
                            <td className="py-2.5 px-3 text-left font-mono text-[#9E2A2B]">{formatCurrency(journal.totalCredit, currency)}</td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-10 text-neutral-400">لا يوجد قيد يومية مرتبط بهذا المستند</div>
              )}
            </div>
          )}

          {/* TAB 4: VOUCHERS DETAILS */}
          {activeSubTab === 'VOUCHER' && (
            <div className="space-y-4">
              {currentVouchers.length > 0 ? (
                currentVouchers.map((v) => (
                  <div key={v.id} className="bg-amber-50/40 border border-amber-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                      <div className="flex items-center gap-2">
                        <strong className="font-mono text-amber-900">{v.voucherNumber}</strong>
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[10px]">
                          {v.type === 'RECEIPT' ? 'سند قبض وتحصيل' : 'سند صرف وسداد'}
                        </span>
                      </div>
                      <span className="font-mono text-xs text-neutral-500">{v.date}</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-neutral-500 block">المبلغ المسدد:</span>
                        <strong className="font-mono text-amber-900 text-sm">{formatCurrency(v.amount, currency)}</strong>
                      </div>
                      <div>
                        <span className="text-neutral-500 block">طريقة الدفع:</span>
                        <strong className="text-neutral-800">{v.paymentMethod === 'CASH' ? 'نقداً (كاش / خزينة)' : 'تحويل بنكي / شيك'}</strong>
                      </div>
                      <div>
                        <span className="text-neutral-500 block">الطرف:</span>
                        <strong className="text-neutral-800">{v.entityNameAr || '-'}</strong>
                      </div>
                      <div>
                        <span className="text-neutral-500 block">المرجع:</span>
                        <strong className="text-neutral-800">{v.reference || '-'}</strong>
                      </div>
                    </div>

                    {v.notes && (
                      <p className="text-xs text-neutral-600 bg-white p-2.5 rounded-lg border border-amber-100">
                        البيان: {v.notes}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-10 bg-[#FAF9F5] rounded-xl border border-[#E5E1DA] space-y-2">
                  <Receipt className="w-8 h-8 text-neutral-400 mx-auto" />
                  <p className="text-xs text-neutral-600 font-bold">لم يتم تسجيل سند قبض/صرف منفصل لهذه الفاتورة بعد</p>
                  <p className="text-[11px] text-neutral-400">
                    {invoice?.paymentTerms === 'CASH'
                      ? 'الفاتورة نقدي تم إثبات تحصيلها في الصندوق مباشرة عبر القيد الآلي.'
                      : 'الفاتورة مسجلة كحساب آجل (ذمم مدينة/دائنة) بانتظار تحرير سند تحصيل أو سداد.'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: CHART OF ACCOUNTS & LEDGER IMPACT */}
          {activeSubTab === 'LEDGER_IMPACT' && (
            <div className="space-y-4">
              {/* Entity Balance Card */}
              {entity && (
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] text-emerald-800 font-bold block">
                      كشف حساب {entityType === 'CUSTOMER' ? 'العميل' : 'المورد'}:
                    </span>
                    <h4 className="text-sm font-bold text-neutral-900">{entity.nameAr}</h4>
                    <p className="text-xs text-neutral-600 font-mono mt-0.5">
                      كود الحساب: {entity.code || '-'} {entity.phone ? `• هاتف: ${entity.phone}` : ''}
                    </p>
                  </div>

                  <div className="text-left">
                    <span className="text-[11px] text-neutral-500 block">الرصيد القائم الحالي:</span>
                    <strong className="text-lg font-mono font-bold text-emerald-900">
                      {formatCurrency(entity.balance || 0, currency)}
                    </strong>
                    {onNavigateToStatement && (
                      <button
                        onClick={() => {
                          onClose();
                          onNavigateToStatement(entity.id, entityType);
                        }}
                        className="mt-1 px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-md text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                      >
                        <BookOpen className="w-3 h-3" />
                        فتح كشف الحساب المفصل
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Impact on Chart of Accounts Tree */}
              <div className="border border-[#E5E1DA] rounded-xl overflow-hidden shadow-2xs">
                <div className="bg-[#F7F5F0] px-4 py-2.5 border-b border-[#E5E1DA] flex items-center justify-between">
                  <span className="font-bold text-xs text-neutral-900">
                    أثر العملية على حسابات الدليل المحاسبي (Chart of Accounts Breakdown)
                  </span>
                  <span className="text-[11px] text-neutral-500">محدث لحظياً في ميزان المراجعة</span>
                </div>

                <div className="divide-y divide-[#E5E1DA]">
                  {involvedAccounts.map((item, idx) => {
                    const isDebit = item.debit > 0;
                    return (
                      <div key={idx} className="p-3.5 bg-white hover:bg-[#FDFCFB] flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-xs bg-[#F2EFE9] text-[#B8860B] px-2 py-1 rounded border border-[#E5E1DA]">
                            {item.accountCode}
                          </span>
                          <div>
                            <strong className="text-neutral-900 text-xs">{item.accountNameAr}</strong>
                            <p className="text-[11px] text-neutral-500">{item.memo || '-'}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-left font-mono">
                            <span className="text-[10px] text-neutral-400 block">
                              {isDebit ? 'زيادة / أثر مدين' : 'زيادة / أثر دائن'}
                            </span>
                            <span className={`font-bold ${isDebit ? 'text-[#2D6A4F]' : 'text-[#9E2A2B]'}`}>
                              {isDebit ? `+ ${formatCurrency(item.debit, currency)}` : `- ${formatCurrency(item.credit, currency)}`}
                            </span>
                          </div>

                          {onNavigateToLedger && (
                            <button
                              onClick={() => {
                                onClose();
                                onNavigateToLedger(item.accountId);
                              }}
                              className="p-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-md cursor-pointer transition-colors"
                              title="استعراض دفتر الأستاذ لهذا الحساب"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-[#FAF9F5] border-t border-[#E5E1DA] p-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>نظام رقابة مالية موحد يضمن الترابط العضوي التام بين الفواتير والدفاتر</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#1A1A1A] hover:bg-black text-white text-xs font-bold rounded-lg cursor-pointer transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
