import React, { useState, useMemo } from 'react';
import { Customer, Invoice, PaymentVoucher, JournalEntry, CreditNote } from '../types.ts';
import { formatCurrency } from '../utils/formatters.ts';
import { getCalculatedCustomerBalance } from '../services/statementService.ts';
import { matchesSearch } from '../utils/searchUtils.ts';
import { Users, Search, Building2, Tag, Sparkles, FileText, Plus, CheckCircle } from 'lucide-react';

export interface CustomersViewProps {
  customers: Customer[];
  invoices?: Invoice[];
  vouchers?: PaymentVoucher[];
  journals?: JournalEntry[];
  creditNotes?: CreditNote[];
  currency?: string;
  onSelectCustomer?: (customer: Customer) => void;
  onOpenStatement?: (customerId: string) => void;
  onCreateCustomer?: () => void;
}

/**
 * CustomersView - دليل وسجل العملاء الموحد
 * يعتمد حصرياً ومباشرة على دفتر الأستاذ العام وقيود اليومية عبر statementService
 * (Single Source of Truth: GL Ledger via getCalculatedCustomerBalance)
 */
export const CustomersView: React.FC<CustomersViewProps> = ({
  customers = [],
  invoices = [],
  vouchers = [],
  journals = [],
  creditNotes = [],
  currency = 'KWD',
  onSelectCustomer,
  onOpenStatement,
  onCreateCustomer,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [balanceFilter, setBalanceFilter] = useState<'ALL' | 'DEBIT' | 'CREDIT' | 'ZERO'>('ALL');

  // احتساب الأرصدة اللحظية الموحدة لجميع العملاء عبر محرك الأستاذ العام (GL Ledger)
  const customersWithCalculatedBalances = useMemo(() => {
    return customers.map((c) => {
      const glBalance = getCalculatedCustomerBalance(
        c.id,
        invoices,
        vouchers,
        journals,
        customers,
        creditNotes
      );
      return {
        customer: c,
        glBalance,
      };
    });
  }, [customers, invoices, vouchers, journals, creditNotes]);

  // تصفية العملاء وفق البحث والرصيد
  const filteredCustomers = useMemo(() => {
    return customersWithCalculatedBalances.filter(({ customer: c, glBalance }) => {
      // 1. فلتر الرصيد
      if (balanceFilter === 'DEBIT' && glBalance <= 0.001) return false;
      if (balanceFilter === 'CREDIT' && glBalance >= -0.001) return false;
      if (balanceFilter === 'ZERO' && Math.abs(glBalance) > 0.001) return false;

      // 2. فلتر البحث
      if (!searchQuery.trim()) return true;
      const q = searchQuery.trim().toLowerCase();
      const matchesBasic =
        matchesSearch(c.nameAr, q) ||
        matchesSearch((c as any).nameEn, q) ||
        matchesSearch(c.code, q) ||
        matchesSearch(c.phone, q) ||
        matchesSearch(c.taxNumber, q);

      const matchesBranch = Boolean(
        c.branches?.some((b: any) => matchesSearch(b.branchCode, q) || matchesSearch(b.branchName, q))
      );

      return matchesBasic || matchesBranch;
    });
  }, [customersWithCalculatedBalances, searchQuery, balanceFilter]);

  // ملخص إحصائي سريع من قيود اليومية
  const totalDebitBalance = useMemo(() => {
    return customersWithCalculatedBalances
      .filter((item) => item.glBalance > 0)
      .reduce((sum, item) => sum + item.glBalance, 0);
  }, [customersWithCalculatedBalances]);

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header and Summary Cards */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#F7F5F0] p-4 rounded-xl border border-[#E5E1DA]">
        <div className="space-y-1">
          <h2 className="text-base font-black text-[#1A1A1A] flex items-center gap-2">
            <Users className="w-5 h-5 text-[#B8860B]" />
            <span>سجل ودليل العملاء والجمعيات التعاونية (GL Synchronized)</span>
          </h2>
          <p className="text-xs text-[#8C8273]">
            كافة الأرصدة مستخرجة وموحدة لحظياً من قيود اليومية ودفتر الأستاذ العام (GL Ledger)
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onCreateCustomer && (
            <button
              onClick={onCreateCustomer}
              className="px-4 py-2 bg-[#1A1A1A] hover:bg-black text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5 transition-all"
            >
              <Plus className="w-4 h-4 text-[#D4AF37]" />
              <span>إضافة عميل جديد</span>
            </button>
          )}
        </div>
      </div>

      {/* Control Bar: Search & Filter Pills */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-[#8C8273]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث بالاسم، الكود، الهاتف، الفرع..."
            className="w-full pr-9 pl-4 py-2 bg-white border border-[#E5E1DA] rounded-xl text-xs text-[#1A1A1A] focus:outline-none focus:border-[#B8860B]"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-[#E5E1DA]">
          <button
            type="button"
            onClick={() => setBalanceFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              balanceFilter === 'ALL' ? 'bg-[#1A1A1A] text-white shadow-xs' : 'text-[#6E6659] hover:text-[#1A1A1A]'
            }`}
          >
            الكل ({customers.length})
          </button>
          <button
            type="button"
            onClick={() => setBalanceFilter('DEBIT')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              balanceFilter === 'DEBIT' ? 'bg-rose-700 text-white shadow-xs' : 'text-[#6E6659] hover:text-[#1A1A1A]'
            }`}
          >
            مدين ({customersWithCalculatedBalances.filter((i) => i.glBalance > 0.001).length})
          </button>
          <button
            type="button"
            onClick={() => setBalanceFilter('CREDIT')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              balanceFilter === 'CREDIT' ? 'bg-emerald-700 text-white shadow-xs' : 'text-[#6E6659] hover:text-[#1A1A1A]'
            }`}
          >
            دائن ({customersWithCalculatedBalances.filter((i) => i.glBalance < -0.001).length})
          </button>
          <button
            type="button"
            onClick={() => setBalanceFilter('ZERO')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              balanceFilter === 'ZERO' ? 'bg-neutral-600 text-white shadow-xs' : 'text-[#6E6659] hover:text-[#1A1A1A]'
            }`}
          >
            مصفى ({customersWithCalculatedBalances.filter((i) => Math.abs(i.glBalance) <= 0.001).length})
          </button>
        </div>
      </div>

      {/* Customer List */}
      <div className="bg-white border border-[#E5E1DA] rounded-2xl p-5 shadow-xs space-y-3">
        <div className="flex justify-between items-center border-b border-[#E5E1DA] pb-2.5 text-xs text-[#8C8273]">
          <span className="font-bold text-[#1A1A1A]">قائمة العملاء المعتمدة محاسبياً</span>
          <span>إجمالي الأرصدة المدينة: <strong className="text-rose-700 font-mono text-sm">{formatCurrency(totalDebitBalance, currency)}</strong></span>
        </div>

        <div className="divide-y divide-[#E5E1DA] max-h-[600px] overflow-y-auto">
          {filteredCustomers.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#8C8273]">
              لا توجد سجلات مطابقة للبحث
            </div>
          ) : (
            filteredCustomers.map(({ customer: c, glBalance }) => (
              <div key={c.id} className="py-3.5 space-y-2 text-xs">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-extrabold text-[#1A1A1A] text-sm flex items-center gap-2">
                      <span>{c.nameAr}</span>
                      {c.code && (
                        <span className="text-[10px] bg-[#F7F5F0] px-2 py-0.5 rounded-md border border-[#E5E1DA] text-[#8C8273] font-mono">
                          {c.code}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#8C8273] mt-0.5 space-x-2 space-x-reverse">
                      <span>هاتف: {c.phone || '-'}</span>
                      <span>• الضريبي: {c.taxNumber || 'غير مدخل'}</span>
                      {c.governorate && <span>• {c.governorate}</span>}
                    </div>

                    {/* Branches & Price List indicators */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                        <Building2 className="w-2.5 h-2.5 text-blue-600" />
                        {c.branches && c.branches.length > 0 ? `${c.branches.length} فروع ومواقع` : 'بدون أفرع إضافية'}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        <Tag className="w-2.5 h-2.5 text-amber-600" />
                        {c.priceListName || 'قائمة الأسعار القياسية'}
                      </span>
                      {c.customPrices && c.customPrices.length > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <Sparkles className="w-2.5 h-2.5 text-emerald-600" />
                          {c.customPrices.length} صنف مسعر
                        </span>
                      )}
                    </div>
                  </div>

                  {/* GL Ledger Closing Balance */}
                  <div className="text-left font-black text-sm bg-[#FFFDF0] px-3.5 py-2 rounded-xl border border-[#F3E5AB] flex flex-col items-end">
                    <span className="text-[10px] text-[#8C8273] font-normal block">الرصيد المعتمد (GL)</span>
                    <span
                      className={`font-mono font-bold text-sm ${
                        glBalance > 0
                          ? 'text-rose-700'
                          : glBalance < 0
                          ? 'text-emerald-700'
                          : 'text-neutral-700'
                      }`}
                    >
                      {formatCurrency(glBalance, currency)}
                    </span>
                    <span className="text-[9px] text-[#8C8273] font-normal mt-0.5">
                      {glBalance > 0 ? 'مدين للمنشأة' : glBalance < 0 ? 'دائن له' : 'رصيد مصفى'}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-1">
                  {onOpenStatement && (
                    <button
                      onClick={() => onOpenStatement(c.id)}
                      className="px-2.5 py-1 text-[11px] font-semibold text-[#B8860B] bg-[#FFFDF0] hover:bg-[#F3E5AB]/40 rounded-lg border border-[#F3E5AB] flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <FileText className="w-3 h-3" />
                      <span>كشف الحساب التفصيلي</span>
                    </button>
                  )}
                  {onSelectCustomer && (
                    <button
                      onClick={() => onSelectCustomer(c)}
                      className="px-2.5 py-1 text-[11px] font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <CheckCircle className="w-3 h-3 text-emerald-600" />
                      <span>اختيار</span>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomersView;
