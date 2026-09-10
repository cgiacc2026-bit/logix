import React, { useState, useEffect } from 'react';
import { Account, GeneralLedgerReport } from '../types.js';
import { formatCurrency, getCategoryBadgeClass, getCategoryLabelAr } from '../utils/formatters.ts';
import { BookOpen, Calendar, Printer, Filter, ArrowLeftRight } from 'lucide-react';
import { DataService } from '../services/dataService.ts';

interface GeneralLedgerProps {
  journals?: any[];
  accounts: Account[];
  journals?: any[];
  currency: string;
  selectedAccountId?: string;
}

export const GeneralLedgerView: React.FC<GeneralLedgerProps> = ({
  accounts,
  currency,
  selectedAccountId,
  journals,
}) => {
  const [currentAccountId, setCurrentAccountId] = useState<string>(
    selectedAccountId || (accounts.length > 0 ? accounts[0].id : '')
  );
  const [startDate, setStartDate] = useState<string>('2026-01-01');
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [report, setReport] = useState<GeneralLedgerReport | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (selectedAccountId) {
      setCurrentAccountId(selectedAccountId);
    } else if (!currentAccountId && accounts.length > 0) {
      setCurrentAccountId(accounts[0].id);
    }
  }, [selectedAccountId, accounts]);

  useEffect(() => {
    if (!currentAccountId) return;

    const fetchLedger = async () => {
      setLoading(true);
      try {
        const data = await DataService.getLedger(currentAccountId, startDate, endDate);
        setReport(data);
      } catch (err) {
        console.error('Error fetching ledger report:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLedger();
  }, [currentAccountId, startDate, endDate, journals]);

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-[#E5E1DA] p-6 rounded-lg shadow-xs">
        <div>
          <h2 className="text-2xl font-serif font-bold text-[#1A1A1A] flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#B8860B]" /> دفتر الأستاذ العام (General Ledger)
          </h2>
          <p className="text-xs text-[#8C8273] mt-1 font-serif italic">
            عرض كشف حساب تفصيلي لأي حساب محاسبي مع احتساب الرصيد الافتتاحي والحركات المدينة والدائنة والرصيد التراكمي المتتابع.
          </p>
        </div>

        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-[#F2EFE9] hover:bg-[#E5E1DA] text-[#1A1A1A] border border-[#E5E1DA] rounded-md text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer no-print shadow-xs"
        >
          <Printer className="w-4 h-4 text-[#B8860B]" />
          <span>طباعة كشف الحساب</span>
        </button>
      </div>

      {/* Controls Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-[#F7F5F0] border border-[#E5E1DA] p-4 rounded-lg no-print">
        <div>
          <label className="block text-xs font-semibold text-[#1A1A1A] mb-1">
            اختر الحساب المحاسبي
          </label>
          <select
            value={currentAccountId}
            onChange={(e) => setCurrentAccountId(e.target.value)}
            className="w-full bg-white border border-[#E5E1DA] rounded-md px-3 py-2 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A] font-semibold"
          >
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.code} - {acc.nameAr}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#1A1A1A] mb-1">
            من تاريخ
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full bg-white border border-[#E5E1DA] rounded-md px-3 py-2 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A]"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#1A1A1A] mb-1">
            إلى تاريخ
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full bg-white border border-[#E5E1DA] rounded-md px-3 py-2 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A]"
          />
        </div>
      </div>

      {/* Report Content */}
      {loading ? (
        <div className="p-12 text-center text-[#8C8273] font-serif italic">جاري استخراج كشف الحساب...</div>
      ) : !report ? (
        <div className="p-12 text-center text-[#8C8273] font-serif italic">يرجى اختيار حساب لعرض كشف الحساب.</div>
      ) : (
        <div className="bg-white border border-[#E5E1DA] rounded-lg p-6 space-y-6 shadow-xs printable-card">
          {/* Account Summary Banner */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E5E1DA] pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-[#B8860B] bg-[#F2EFE9] px-3 py-1 rounded-md border border-[#E5E1DA]">
                  {report.account.code}
                </span>
                <h3 className="text-base font-serif font-bold text-[#1A1A1A]">{report.account.nameAr}</h3>
                <span
                  className={`px-2.5 py-0.5 text-[10px] font-semibold rounded-full border ${getCategoryBadgeClass(
                    report.account.category
                  )}`}
                >
                  {getCategoryLabelAr(report.account.category)}
                </span>
              </div>
              <p className="text-xs text-[#8C8273] mt-1 font-serif italic">
                طبيعة الحساب: {report.account.normalBalance === 'DEBIT' ? 'مدين (Debit)' : 'دائن (Credit)'} • للفترة من {report.startDate} إلى {report.endDate}
              </p>
            </div>

            <div className="flex items-center gap-4 bg-[#F7F5F0] p-3 rounded-md border border-[#E5E1DA]">
              <div>
                <span className="text-[11px] text-[#8C8273] block">الرصيد الافتتاحي:</span>
                <span className="font-serif font-bold text-[#1A1A1A]">
                  {formatCurrency(report.openingBalance, currency)}
                </span>
              </div>
              <div className="h-8 w-px bg-[#E5E1DA]" />
              <div>
                <span className="text-[11px] text-[#8C8273] block">رصيد ختام الفترة:</span>
                <span className="font-serif font-bold text-[#2D6A4F] text-sm">
                  {formatCurrency(report.closingBalance, currency)}
                </span>
              </div>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-[#F7F5F0] text-[#6E6659] font-serif font-bold border-b border-[#E5E1DA]">
                <tr>
                  <th className="py-3 px-4">رقم القيد</th>
                  <th className="py-3 px-4">التاريخ</th>
                  <th className="py-3 px-4">رقم المرجع</th>
                  <th className="py-3 px-4">البيان والتفاصيل</th>
                  <th className="py-3 px-4">الطرف المدين</th>
                  <th className="py-3 px-4">الطرف الدائن</th>
                  <th className="py-3 px-4">الرصيد التراكمي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E1DA]">
                {/* Opening Balance Row */}
                <tr className="bg-[#FDFCFB] italic text-[#8C8273] font-semibold font-serif">
                  <td colSpan={3} className="py-2.5 px-4">
                    --
                  </td>
                  <td className="py-2.5 px-4">الرصيد الافتتاحي السابق للفترة</td>
                  <td className="py-2.5 px-4">-</td>
                  <td className="py-2.5 px-4">-</td>
                  <td className="py-2.5 px-4 font-serif font-bold text-[#1A1A1A]">
                    {formatCurrency(report.openingBalance, currency)}
                  </td>
                </tr>

                {report.movements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[#8C8273] font-serif italic">
                      لا توجد حركات مرحّلة على هذا الحساب خلال الفترة المحددة.
                    </td>
                  </tr>
                ) : (
                  report.movements.map((m) => (
                    <tr key={m.id} className="hover:bg-[#FDFCFB] transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-[#B8860B]">
                        {m.entryNumber}
                      </td>
                      <td className="py-3 px-4 text-[#6E6659]">{m.date}</td>
                      <td className="py-3 px-4 text-[#8C8273]">{m.reference || '-'}</td>
                      <td className="py-3 px-4 font-serif font-bold text-[#1A1A1A] max-w-xs">{m.description}</td>
                      <td className="py-3 px-4 font-serif font-bold text-[#2D6A4F]">
                        {m.debit > 0 ? formatCurrency(m.debit, currency) : '-'}
                      </td>
                      <td className="py-3 px-4 font-serif font-bold text-[#9E2A2B]">
                        {m.credit > 0 ? formatCurrency(m.credit, currency) : '-'}
                      </td>
                      <td className="py-3 px-4 font-serif font-bold text-[#1A1A1A] bg-[#F7F5F0]">
                        {formatCurrency(m.runningBalance, currency)}
                      </td>
                    </tr>
                  ))
                )}

                {/* Total Row */}
                <tr className="bg-[#F7F5F0] font-serif font-bold text-[#1A1A1A] border-t-2 border-[#E5E1DA]">
                  <td colSpan={4} className="py-3 px-4 text-left">
                    مجموع حركات الفترة والرصيد النهائي:
                  </td>
                  <td className="py-3 px-4 text-[#2D6A4F] font-bold">
                    {formatCurrency(report.totalDebit, currency)}
                  </td>
                  <td className="py-3 px-4 text-[#9E2A2B] font-bold">
                    {formatCurrency(report.totalCredit, currency)}
                  </td>
                  <td className="py-3 px-4 text-[#2D6A4F] font-bold text-sm">
                    {formatCurrency(report.closingBalance, currency)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
