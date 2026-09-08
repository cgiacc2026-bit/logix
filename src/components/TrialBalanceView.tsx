import React, { useState, useEffect } from 'react';
import { TrialBalanceReport } from '../types.js';
import { formatCurrency } from '../utils/formatters.ts';
import { Scale, CheckCircle2, AlertTriangle, Printer, Download } from 'lucide-react';
import { DataService } from '../services/dataService.ts';

interface TrialBalanceProps {
  currency: string;
}

export const TrialBalanceView: React.FC<TrialBalanceProps> = ({ currency }) => {
  const [asOfDate, setAsOfDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [report, setReport] = useState<TrialBalanceReport | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchTrialBalance = async () => {
    setLoading(true);
    try {
      const data = await DataService.getTrialBalance(asOfDate);
      setReport(data);
    } catch (err) {
      console.error('Error fetching trial balance:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrialBalance();
  }, [asOfDate]);

  const handleExportCSV = () => {
    if (!report) return;
    let csv = 'كود الحساب,اسم الحساب,حركة مدين,حركة دائن,رصيد مدين,رصيد دائن\n';
    report.items.forEach((item) => {
      csv += `"${item.account.code}","${item.account.nameAr}",${item.movementDebit},${item.movementCredit},${item.endingBalanceDebit},${item.endingBalanceCredit}\n`;
    });
    csv += `الإجمالي,,${report.totalMovementDebit},${report.totalMovementCredit},${report.totalEndingDebit},${report.totalEndingCredit}\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Trial_Balance_${asOfDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-[#E5E1DA] p-6 rounded-lg shadow-xs">
        <div>
          <h2 className="text-2xl font-serif font-bold text-[#1A1A1A] flex items-center gap-2">
            <Scale className="w-5 h-5 text-[#B8860B]" /> ميزان المراجعة بالمجاميع والأرصدة (Trial Balance)
          </h2>
          <p className="text-xs text-[#8C8273] mt-1 font-serif italic">
            تقرير التوازن المحاسبي الشامل لجميع الحسابات للتأكد من انطباق قاعدة القيد المزدوج قبل إعداد القوائم المالية الختامية.
          </p>
        </div>

        <div className="flex items-center gap-3 no-print">
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-[#F2EFE9] hover:bg-[#E5E1DA] text-[#1A1A1A] border border-[#E5E1DA] rounded-md text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-xs"
          >
            <Download className="w-4 h-4 text-[#B8860B]" />
            <span>تصدير CSV</span>
          </button>
          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 bg-[#1A1A1A] hover:bg-[#2D2B28] text-white rounded-md text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-xs border border-[#1A1A1A]"
          >
            <Printer className="w-4 h-4 text-[#D4AF37]" />
            <span>طباعة الميزان</span>
          </button>
        </div>
      </div>

      {/* Date Bar */}
      <div className="flex items-center gap-3 bg-[#F7F5F0] border border-[#E5E1DA] p-4 rounded-lg no-print">
        <label className="text-xs font-semibold text-[#1A1A1A]">
          تاريخ ميزان المراجعة حتى:
        </label>
        <input
          type="date"
          value={asOfDate}
          onChange={(e) => setAsOfDate(e.target.value)}
          className="bg-white border border-[#E5E1DA] rounded-md px-3 py-1.5 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A]"
        />
      </div>

      {/* Trial Balance Report Card */}
      {loading ? (
        <div className="p-12 text-center text-[#8C8273] font-serif italic">جاري إعداد ميزان المراجعة...</div>
      ) : !report ? (
        <div className="p-12 text-center text-[#8C8273] font-serif italic">لا توجد بيانات متاحة لميزان المراجعة.</div>
      ) : (
        <div className="bg-white border border-[#E5E1DA] rounded-lg p-6 space-y-6 shadow-xs printable-card">
          {/* Balance Status Banner */}
          <div
            className={`p-4 rounded-md border flex items-center justify-between gap-4 text-xs ${
              report.isBalanced
                ? 'bg-[#EBF5EE] border-[#2D6A4F]/30 text-[#2D6A4F]'
                : 'bg-[#FDF0F0] border-[#9E2A2B]/30 text-[#9E2A2B]'
            }`}
          >
            <div className="flex items-center gap-2">
              {report.isBalanced ? (
                <CheckCircle2 className="w-5 h-5 text-[#2D6A4F] shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-[#9E2A2B] shrink-0" />
              )}
              <div>
                <span className="font-serif font-bold text-sm">
                  {report.isBalanced
                    ? '✅ ميزان المراجعة متوازن تماماً (إجمالي الجانب المدين = إجمالي الجانب الدائن)'
                    : '❌ تنبيه: ميزان المراجعة غير متوازن! يوجد خلل في الترحيل المحاسبي.'}
                </span>
                <p className="text-[11px] opacity-80 mt-0.5">
                  حتى تاريخ {report.asOfDate} • عدد الحسابات المتحركة: {report.items.length} حساب
                </p>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-[#F7F5F0] text-[#6E6659] font-serif font-bold border-b border-[#E5E1DA]">
                <tr>
                  <th rowSpan={2} className="py-3 px-3 border-r border-[#E5E1DA]">
                    كود الحساب
                  </th>
                  <th rowSpan={2} className="py-3 px-3 border-r border-[#E5E1DA]">
                    اسم الحساب المحاسبي
                  </th>
                  <th colSpan={2} className="py-2 px-3 text-center border-b border-[#E5E1DA]">
                    حركات الفترة (المجاميع)
                  </th>
                  <th colSpan={2} className="py-2 px-3 text-center border-b border-[#E5E1DA]">
                    الأرصدة النهائية (الصافي)
                  </th>
                </tr>
                <tr className="bg-[#F2EFE9] text-[#8C8273] text-[11px]">
                  <th className="py-2 px-3 text-center">مدين</th>
                  <th className="py-2 px-3 text-center">دائن</th>
                  <th className="py-2 px-3 text-center text-[#2D6A4F]">مدين</th>
                  <th className="py-2 px-3 text-center text-[#9E2A2B]">دائن</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E1DA]">
                {report.items.map((item) => (
                  <tr key={item.account.id} className="hover:bg-[#FDFCFB] transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-[#B8860B]">
                      {item.account.code}
                    </td>
                    <td className="py-2.5 px-3 font-serif font-bold text-[#1A1A1A]">{item.account.nameAr}</td>
                    <td className="py-2.5 px-3 text-center font-mono text-[#6E6659]">
                      {item.movementDebit > 0 ? formatCurrency(item.movementDebit, currency) : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-[#6E6659]">
                      {item.movementCredit > 0
                        ? formatCurrency(item.movementCredit, currency)
                        : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-[#2D6A4F]">
                      {item.endingBalanceDebit > 0
                        ? formatCurrency(item.endingBalanceDebit, currency)
                        : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-[#9E2A2B]">
                      {item.endingBalanceCredit > 0
                        ? formatCurrency(item.endingBalanceCredit, currency)
                        : '-'}
                    </td>
                  </tr>
                ))}

                {/* Total Summary Row */}
                <tr className="bg-[#F7F5F0] font-serif font-bold text-xs border-t-2 border-[#E5E1DA] text-[#1A1A1A]">
                  <td colSpan={2} className="py-3.5 px-4 text-left">
                    الإجمالي الكلي لميزان المراجعة:
                  </td>
                  <td className="py-3.5 px-3 text-center font-mono text-[#2D6A4F]">
                    {formatCurrency(report.totalMovementDebit, currency)}
                  </td>
                  <td className="py-3.5 px-3 text-center font-mono text-[#9E2A2B]">
                    {formatCurrency(report.totalMovementCredit, currency)}
                  </td>
                  <td className="py-3.5 px-3 text-center font-mono text-[#2D6A4F] bg-[#EBF5EE]">
                    {formatCurrency(report.totalEndingDebit, currency)}
                  </td>
                  <td className="py-3.5 px-3 text-center font-mono text-[#9E2A2B] bg-[#FDF0F0]">
                    {formatCurrency(report.totalEndingCredit, currency)}
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
