import React, { useState, useEffect, useMemo } from 'react';
import { TrialBalanceReport } from '../types.js';
import { formatCurrency } from '../utils/formatters.ts';
import { formatKWD, isAccountLeaf } from '../utils/accountingTreeEngine.ts';
import { Scale, CheckCircle2, AlertTriangle, Printer, Download, ShieldCheck, X, RefreshCw, Filter } from 'lucide-react';
import { DataService } from '../services/dataService.ts';

interface TrialBalanceProps {
  currency: string;
}

export const TrialBalanceView: React.FC<TrialBalanceProps> = ({ currency }) => {
  const [asOfDate, setAsOfDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [report, setReport] = useState<TrialBalanceReport | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [filterMode, setFilterMode] = useState<'LEAF_ONLY' | 'ALL'>('LEAF_ONLY');
  const [isAuditModalOpen, setIsAuditModalOpen] = useState<boolean>(false);
  const [auditResult, setAuditResult] = useState<ReturnType<typeof DataService.performSelfAuditing> | null>(null);

  const displayedItems = useMemo(() => {
    if (!report) return [];
    if (filterMode === 'LEAF_ONLY') {
      const allAccs = report.items.map((i) => i.account);
      return report.items.filter((i) => i.account.isLeaf ?? isAccountLeaf(i.account, allAccs));
    }
    return report.items;
  }, [report, filterMode]);

  const handleRunAudit = () => {
    const res = DataService.performSelfAuditing();
    setAuditResult(res);
    setIsAuditModalOpen(true);
  };

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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-[#E5E1DA] p-6 rounded-lg shadow-xs no-print">
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
            onClick={handleRunAudit}
            className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-md text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-xs"
            title="فحص وتطابق الحسابات الأستاذية المساعدة مع حسابات المراقبة العامة وميزان المراجعة"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-200" />
            <span>الفحص والتدقيق الذاتي (Self-Audit)</span>
          </button>
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
          {/* Balance Status Banner & Mode Toggle */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div
              className={`p-4 rounded-md border flex items-center justify-between gap-4 text-xs flex-1 ${
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
                    حتى تاريخ {report.asOfDate} • عدد الحسابات المعروضة: {displayedItems.length} حساب
                  </p>
                </div>
              </div>
            </div>

            {/* Filter Toggle */}
            <div className="flex items-center bg-[#F2EFE9] p-1 rounded-lg border border-[#E5E1DA] text-xs no-print self-start md:self-auto">
              <button
                onClick={() => setFilterMode('LEAF_ONLY')}
                className={`px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
                  filterMode === 'LEAF_ONLY'
                    ? 'bg-white text-[#1A1A1A] shadow-xs'
                    : 'text-[#6E6659] hover:text-[#1A1A1A]'
                }`}
              >
                الحسابات الطرفية فقط (المعتمد لمنع التكرار)
              </button>
              <button
                onClick={() => setFilterMode('ALL')}
                className={`px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
                  filterMode === 'ALL'
                    ? 'bg-white text-[#1A1A1A] shadow-xs'
                    : 'text-[#6E6659] hover:text-[#1A1A1A]'
                }`}
              >
                كافة مستويات الحسابات
              </button>
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
                {displayedItems.map((item) => (
                  <tr key={item.account.id} className="hover:bg-[#FDFCFB] transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-[#B8860B]">
                      {item.account.code}
                    </td>
                    <td className="py-2.5 px-3 font-serif font-bold text-[#1A1A1A]">
                      <div className="flex items-center gap-2">
                        <span>{item.account.nameAr}</span>
                        {item.account.isLeaf ? (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                            طرفي
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-stone-100 text-stone-600 border border-stone-300">
                            تجميعي
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-[#6E6659]">
                      {item.movementDebit > 0 ? formatKWD(item.movementDebit) : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-[#6E6659]">
                      {item.movementCredit > 0 ? formatKWD(item.movementCredit) : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-[#2D6A4F]">
                      {item.endingBalanceDebit > 0 ? formatKWD(item.endingBalanceDebit) : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-[#9E2A2B]">
                      {item.endingBalanceCredit > 0 ? formatKWD(item.endingBalanceCredit) : '-'}
                    </td>
                  </tr>
                ))}

                {/* Total Summary Row */}
                <tr className="bg-[#F7F5F0] font-serif font-bold text-xs border-t-2 border-[#E5E1DA] text-[#1A1A1A]">
                  <td colSpan={2} className="py-3.5 px-4 text-left">
                    الإجمالي الكلي لميزان المراجعة (حسابات طرفية فقط لمنع الازدواجية):
                  </td>
                  <td className="py-3.5 px-3 text-center font-mono text-[#2D6A4F]">
                    {formatKWD(report.totalMovementDebit)}
                  </td>
                  <td className="py-3.5 px-3 text-center font-mono text-[#9E2A2B]">
                    {formatKWD(report.totalMovementCredit)}
                  </td>
                  <td className="py-3.5 px-3 text-center font-mono text-[#2D6A4F] bg-[#EBF5EE]">
                    {formatKWD(report.totalEndingDebit)}
                  </td>
                  <td className="py-3.5 px-3 text-center font-mono text-[#9E2A2B] bg-[#FDF0F0]">
                    {formatKWD(report.totalEndingCredit)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Self-Auditing Reconciliation Modal */}
      {isAuditModalOpen && auditResult && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-[#E5E1DA] rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-[#1A1A1A] text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-lg">تقرير التدقيق والمطابقة المحاسبية الذاتية</h3>
                  <p className="text-xs text-neutral-400">
                    التحقق الآلي من توازن الدفاتر ومطابقة الأستاذ المساعد لحسابات المراقبة (IFRS)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAuditModalOpen(false)}
                className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Overall Status */}
              <div
                className={`p-4 rounded-lg border flex items-center gap-3 ${
                  auditResult.isFullyAudited
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}
              >
                {auditResult.isFullyAudited ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
                )}
                <div>
                  <h4 className="font-bold text-sm">
                    {auditResult.isFullyAudited
                      ? 'جميع الحسابات متطابقة تماماً ومتوازنة دون أي فروقات'
                      : 'تم رصد بعض الفروقات المحاسبية أو عدم التطابق التي تتطلب مراجعة القيود'}
                  </h4>
                  <p className="text-xs mt-0.5 opacity-90">{auditResult.statusMessage}</p>
                </div>
              </div>

              {/* 4 Pillars of Reconciliation */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* 1. Trial Balance */}
                <div className="p-3.5 bg-[#F9F8F6] border border-[#E5E1DA] rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-neutral-700">1. توازن ميزان المراجعة</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        auditResult.trialBalanceBalanced
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {auditResult.trialBalanceBalanced ? 'متطابق' : 'فارق'}
                    </span>
                  </div>
                  <div className="text-xs space-y-1 font-mono text-neutral-600">
                    <div className="flex justify-between">
                      <span>إجمالي المدين:</span>
                      <span className="font-bold text-[#2D6A4F]">{formatKWD(auditResult.totalDebit)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>إجمالي الدائن:</span>
                      <span className="font-bold text-[#9E2A2B]">{formatKWD(auditResult.totalCredit)}</span>
                    </div>
                  </div>
                </div>

                {/* 2. AR (Customers) */}
                <div className="p-3.5 bg-[#F9F8F6] border border-[#E5E1DA] rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-neutral-700">2. أستاذ العملاء vs مراقبة (1120)</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        auditResult.receivableMatched
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {auditResult.receivableMatched ? 'مطابق' : 'فارق'}
                    </span>
                  </div>
                  <div className="text-xs space-y-1 font-mono text-neutral-600">
                    <div className="flex justify-between">
                      <span>أرصدة العملاء:</span>
                      <span className="font-bold">{formatKWD(auditResult.receivableSubledger)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>حساب المراقبة:</span>
                      <span className="font-bold">{formatKWD(auditResult.receivableControl)}</span>
                    </div>
                  </div>
                </div>

                {/* 3. AP (Suppliers) */}
                <div className="p-3.5 bg-[#F9F8F6] border border-[#E5E1DA] rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-neutral-700">3. أستاذ الموردين vs مراقبة (2110)</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        auditResult.payableMatched
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {auditResult.payableMatched ? 'مطابق' : 'فارق'}
                    </span>
                  </div>
                  <div className="text-xs space-y-1 font-mono text-neutral-600">
                    <div className="flex justify-between">
                      <span>أرصدة الموردين:</span>
                      <span className="font-bold">{formatKWD(auditResult.payableSubledger)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>حساب المراقبة:</span>
                      <span className="font-bold">{formatKWD(auditResult.payableControl)}</span>
                    </div>
                  </div>
                </div>

                {/* 4. Inventory */}
                <div className="p-3.5 bg-[#F9F8F6] border border-[#E5E1DA] rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-neutral-700">4. تقييم المخزون vs مراقبة (1130)</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        auditResult.inventoryMatched
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {auditResult.inventoryMatched ? 'مطابق' : 'فارق'}
                    </span>
                  </div>
                  <div className="text-xs space-y-1 font-mono text-neutral-600">
                    <div className="flex justify-between">
                      <span>تقييم الأصناف:</span>
                      <span className="font-bold">{formatKWD(auditResult.inventorySubledger)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>حساب المراقبة:</span>
                      <span className="font-bold">{formatKWD(auditResult.inventoryControl)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Discrepancies Details if any */}
              {auditResult.discrepancies.length > 0 && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg space-y-2">
                  <h5 className="font-bold text-xs text-rose-900 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    تفاصيل الفروقات المرصودة:
                  </h5>
                  <ul className="text-xs text-rose-800 space-y-1 list-disc list-inside">
                    {auditResult.discrepancies.map((d, idx) => (
                      <li key={idx}>{d}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-[#F7F5F0] border-t border-[#E5E1DA] flex items-center justify-between">
              <span className="text-[11px] text-neutral-500 font-mono">
                تاريخ الفحص: {auditResult.reconciledDate}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRunAudit}
                  className="px-3 py-1.5 bg-white border border-[#E5E1DA] hover:bg-neutral-50 text-neutral-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-neutral-500" />
                  إعادة الفحص
                </button>
                <button
                  onClick={() => setIsAuditModalOpen(false)}
                  className="px-4 py-1.5 bg-[#1A1A1A] hover:bg-black text-white rounded-lg text-xs font-bold cursor-pointer shadow-xs"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
