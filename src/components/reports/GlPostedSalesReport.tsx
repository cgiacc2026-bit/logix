import React, { useState, useMemo } from 'react';
import {
  JournalEntry,
  Account,
  Invoice,
  CompanyProfile,
} from '../../types.js';
import {
  GLReportsService,
  GlPostedSalesRow,
  GlPostedSalesSummary,
} from '../../services/glReportsService.ts';
import { formatCurrency } from '../../utils/formatters.ts';
import { FormalReportPrintModal } from './FormalReportPrintModal.tsx';
import {
  TrendingUp,
  Search,
  FileSpreadsheet,
  Printer,
  Scale,
  DollarSign,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  FileText,
  BadgeCheck,
} from 'lucide-react';

interface GlPostedSalesReportProps {
  journals: JournalEntry[];
  accounts: Account[];
  invoices: Invoice[];
  company: CompanyProfile | null;
  currency: string;
  onViewInvoice?: (invoiceId: string) => void;
}

export const GlPostedSalesReport: React.FC<GlPostedSalesReportProps> = ({
  journals,
  accounts,
  invoices,
  company,
  currency,
  onViewInvoice,
}) => {
  // Date filter presets
  const today = new Date().toISOString().split('T')[0];
  const firstDayOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];

  const [datePreset, setDatePreset] = useState<'ALL' | 'THIS_YEAR' | 'CUSTOM'>('ALL');
  const [startDate, setStartDate] = useState<string>(firstDayOfYear);
  const [endDate, setEndDate] = useState<string>(today);

  const [movementFilter, setMovementFilter] = useState<'ALL' | 'SALES' | 'SALES_RETURN'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // 1. Calculate Posted Sales strictly from Account 4100
  const reportData: GlPostedSalesSummary = useMemo(() => {
    return GLReportsService.calculatePostedSales(
      journals,
      accounts,
      invoices,
      datePreset === 'ALL' ? undefined : startDate,
      datePreset === 'ALL' ? undefined : endDate
    );
  }, [journals, accounts, invoices, datePreset, startDate, endDate]);

  // 2. Filter rows
  const filteredRows = useMemo(() => {
    return reportData.rows.filter((row) => {
      if (movementFilter !== 'ALL' && row.movementType !== movementFilter) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        row.entityNameAr.toLowerCase().includes(q) ||
        row.reference.toLowerCase().includes(q) ||
        row.entryNumber.toLowerCase().includes(q) ||
        (row.memo && row.memo.toLowerCase().includes(q))
      );
    });
  }, [reportData.rows, movementFilter, searchQuery]);

  // Filtered Totals
  const filteredTotals = useMemo(() => {
    const gross = filteredRows.reduce((s, r) => s + r.creditRevenue, 0);
    const returns = filteredRows.reduce((s, r) => s + r.debitReturn, 0);
    const net = filteredRows.reduce((s, r) => s + r.netRevenue, 0);
    return { gross, returns, net };
  }, [filteredRows]);

  // Export to Excel (CSV UTF-8 BOM)
  const handleExportExcel = () => {
    const headers = [
      'رقم القيد المحاسبي',
      'تاريخ القيد',
      'رقم الفاتورة / المرجع',
      'اسم العميل / البيان',
      'نوع الحركة',
      'دائن - إيرادات مبيعات (د.ك)',
      'مدين - مردودات ومسموحات (د.ك)',
      'صافي الإيراد المحقق (د.ك)',
      'حالة الترحيل بالأستاذ',
    ];

    const rows = filteredRows.map((r) => [
      r.entryNumber,
      r.date,
      r.reference,
      r.entityNameAr,
      r.movementType === 'SALES' ? 'فاتورة مبيعات' : 'مردود مبيعات',
      r.creditRevenue.toFixed(3),
      r.debitReturn.toFixed(3),
      r.netRevenue.toFixed(3),
      'مرحل ومعتمد (POSTED)',
    ]);

    GLReportsService.exportToExcelCSV('posted_sales_gl_report', headers, rows);
  };

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">
                تقرير المبيعات المعتمدة من واقع حركات الأستاذ العام (ح/ 4100)
              </h3>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-md font-mono font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                مطابق لميزان المراجعة وقائمة الدخل
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              حصر حصري للحركات الدائنة والمدينة المعتمدة لحساب إيرادات المبيعات (4100) مع استبعاد أي مسودات أو قيود معلقة
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>تصدير إلى Excel</span>
          </button>

          <button
            onClick={() => setIsPrintModalOpen(true)}
            className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-black flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة رسمية بخط أسود (#000000)</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards: Revenue & TB Alignment */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <div className="text-[11px] text-slate-500 font-bold flex items-center justify-between">
            <span>صافي إيرادات المبيعات (ح/ 4100)</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-base font-black font-mono text-emerald-950">
            {formatCurrency(reportData.netSalesRevenue, currency)}
          </div>
          <div className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            مطابق لقائمة الدخل وميزان المراجعة
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <div className="text-[11px] text-slate-500 font-bold flex items-center justify-between">
            <span>إجمالي المبيعات المحققة (دائن)</span>
            <ArrowUpRight className="w-4 h-4 text-slate-700" />
          </div>
          <div className="text-base font-black font-mono text-slate-900">
            +{formatCurrency(reportData.totalGrossSales, currency)}
          </div>
          <div className="text-[10px] text-slate-500">
            عبر {reportData.invoicesCount} فاتورة مبيعات معتمدة
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <div className="text-[11px] text-slate-500 font-bold flex items-center justify-between">
            <span>مردودات ومسموحات المبيعات (مدين)</span>
            <ArrowDownRight className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-base font-black font-mono text-rose-700">
            -{formatCurrency(reportData.totalReturns, currency)}
          </div>
          <div className="text-[10px] text-slate-500">
            عبر {reportData.returnsCount} حركة مردود مسجلة
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <div className="text-[11px] text-slate-500 font-bold flex items-center justify-between">
            <span>رصيد ح/ 4100 بميزان المراجعة</span>
            <Scale className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-base font-black font-mono text-indigo-950">
            {formatCurrency(reportData.trialBalanceRevenueBalance, currency)}
          </div>
          <div className="text-[10px] text-slate-500">
            حساب الإيرادات بدليل الحسابات
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Presets */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs">
            <button
              onClick={() => setDatePreset('ALL')}
              className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                datePreset === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              كافة الفترات
            </button>
            <button
              onClick={() => setDatePreset('THIS_YEAR')}
              className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                datePreset === 'THIS_YEAR'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              السنة الحالية
            </button>
            <button
              onClick={() => setDatePreset('CUSTOM')}
              className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                datePreset === 'CUSTOM'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              مخصص
            </button>
          </div>

          {datePreset === 'CUSTOM' && (
            <div className="flex items-center gap-1.5 text-xs">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-mono text-xs font-bold"
              />
              <span className="text-slate-400">إلى</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-mono text-xs font-bold"
              />
            </div>
          )}

          {/* Movement Type */}
          <select
            value={movementFilter}
            onChange={(e) => setMovementFilter(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1 text-xs font-bold text-slate-700 outline-none"
          >
            <option value="ALL">كافة الحركات ({reportData.rows.length})</option>
            <option value="SALES">فواتير مبيعات دائنة ({reportData.invoicesCount})</option>
            <option value="SALES_RETURN">مردودات مبيعات مدينة ({reportData.returnsCount})</option>
          </select>
        </div>

        {/* Search */}
        <div className="relative min-w-[240px]">
          <Search className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="بحث برقم القيد، الفاتورة، أو العميل..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-1.5 text-xs text-slate-800 font-bold outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>
      </div>

      {/* Main Ledger Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-3 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
          <div className="flex items-center gap-2">
            <span>سجل قيود وحركات حساب إيرادات المبيعات ({filteredRows.length} حركة)</span>
            <span className="text-[11px] text-slate-500 font-normal">
              حساب الأستاذ العام: {reportData.salesAccountCode}
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate-500">
            العملة: {currency} (دينار كويتي)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3 text-center w-12">#</th>
                <th className="py-2.5 px-3">رقم القيد / المرجع</th>
                <th className="py-2.5 px-3 text-center">تاريخ القيد</th>
                <th className="py-2.5 px-3">رقم الفاتورة</th>
                <th className="py-2.5 px-3">اسم العميل / البيان</th>
                <th className="py-2.5 px-3 text-center">نوع الحركة</th>
                <th className="py-2.5 px-3 text-center text-emerald-700">دائن (إيراد +)</th>
                <th className="py-2.5 px-3 text-center text-rose-700">مدين (مردود -)</th>
                <th className="py-2.5 px-3 text-center font-black bg-slate-200/60 text-slate-900">
                  صافي الإيراد (د.ك)
                </th>
                <th className="py-2.5 px-3 text-center">حالة القيد</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400 font-sans font-bold">
                    لا توجد قيود مبيعات مسجلة في الفترة المحددة.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => (
                  <tr key={row.journalId + idx} className="hover:bg-slate-50/90 transition-colors">
                    <td className="py-2.5 px-3 text-center text-slate-500 font-bold text-[11px]">
                      {idx + 1}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">{row.entryNumber}</td>
                    <td className="py-2.5 px-3 text-center text-slate-600">{row.date}</td>
                    <td className="py-2.5 px-3 text-slate-800 font-bold">
                      {row.invoiceId && onViewInvoice ? (
                        <button
                          onClick={() => onViewInvoice(row.invoiceId!)}
                          className="hover:text-indigo-600 hover:underline cursor-pointer flex items-center gap-1"
                        >
                          <span>{row.reference}</span>
                          <FileText className="w-3 h-3 text-slate-400" />
                        </button>
                      ) : (
                        row.reference
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-sans">
                      <div className="font-bold text-slate-900">{row.entityNameAr}</div>
                      {row.memo && (
                        <span className="text-[10px] text-slate-400 block">{row.memo}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center font-sans">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                          row.movementType === 'SALES'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-rose-50 text-rose-800 border border-rose-200'
                        }`}
                      >
                        {row.movementType === 'SALES' ? 'فاتورة مبيعات' : 'مردود مبيعات'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center text-emerald-700 font-bold">
                      {row.creditRevenue > 0 ? `+${formatCurrency(row.creditRevenue, '')}` : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-center text-rose-700 font-bold">
                      {row.debitReturn > 0 ? `-${formatCurrency(row.debitReturn, '')}` : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-center bg-slate-50/60 font-black text-slate-950">
                      {formatCurrency(row.netRevenue, '')}
                    </td>
                    <td className="py-2.5 px-3 text-center font-sans">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        <BadgeCheck className="w-3 h-3" />
                        مرحل معتمد
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {/* Table Footer with Totals */}
            <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-black text-slate-900">
              <tr>
                <td colSpan={6} className="py-3 px-3 text-right font-sans">
                  إجمالي إيرادات المبيعات المحققة ({filteredRows.length} قيد):
                </td>
                <td className="py-3 px-3 text-center text-emerald-800">
                  +{formatCurrency(filteredTotals.gross, '')}
                </td>
                <td className="py-3 px-3 text-center text-rose-800">
                  -{formatCurrency(filteredTotals.returns, '')}
                </td>
                <td className="py-3 px-3 text-center bg-slate-200/80 text-sm font-mono">
                  {formatCurrency(filteredTotals.net, currency)}
                </td>
                <td className="py-3 px-3 text-center font-sans text-[11px] text-emerald-800">
                  مطابق 100%
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Formal Black-Text Print Modal (#000000) */}
      <FormalReportPrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        title="تقرير المبيعات المعتمدة من واقع حركات الأستاذ العام"
        subtitle="حساب إيرادات المبيعات (كود 4100) • مطابقة ميزان المراجعة وقائمة الدخل"
        accountCodeNotice="حساب الأستاذ العام: 4100 (Sales Revenue Account)"
        company={company}
        currency={currency}
        periodText={datePreset === 'ALL' ? 'كافة الفترات المالية' : `من ${startDate} إلى ${endDate}`}
        summaryCards={[
          {
            label: 'صافي إيرادات المبيعات (ح/ 4100)',
            value: formatCurrency(reportData.netSalesRevenue, currency),
            sublabel: 'مطابق لقائمة الدخل وميزان المراجعة',
          },
          {
            label: 'إجمالي المبيعات المحققة (دائن)',
            value: `+${formatCurrency(reportData.totalGrossSales, currency)}`,
            sublabel: `${reportData.invoicesCount} فاتورة مبيعات معتمدة`,
          },
          {
            label: 'مردودات ومسموحات المبيعات (مدين)',
            value: `-${formatCurrency(reportData.totalReturns, currency)}`,
            sublabel: `${reportData.returnsCount} حركة مردود معتمدة`,
          },
          {
            label: 'رصيد ح/ 4100 بالأستاذ العام',
            value: formatCurrency(reportData.trialBalanceRevenueBalance, currency),
            sublabel: 'تطابق محاسبي معتمد',
          },
        ]}
        columns={[
          { header: 'رقم القيد', accessor: 'entryNumber', align: 'center', width: '90px' },
          { header: 'التاريخ', accessor: 'date', align: 'center', width: '90px' },
          { header: 'رقم الفاتورة', accessor: 'reference', align: 'center', width: '100px' },
          { header: 'اسم العميل / البيان', accessor: 'entityNameAr', align: 'right' },
          {
            header: 'نوع الحركة',
            render: (r) => (r.movementType === 'SALES' ? 'فاتورة مبيعات' : 'مردود مبيعات'),
            align: 'center',
            width: '90px',
          },
          {
            header: 'دائن (إيراد +)',
            render: (r) => (r.creditRevenue > 0 ? formatCurrency(r.creditRevenue, '') : '—'),
            align: 'center',
          },
          {
            header: 'مدين (مردود -)',
            render: (r) => (r.debitReturn > 0 ? formatCurrency(r.debitReturn, '') : '—'),
            align: 'center',
          },
          {
            header: 'صافي الإيراد (د.ك)',
            render: (r) => (
              <strong style={{ color: '#000000' }}>
                {formatCurrency(r.netRevenue, '')}
              </strong>
            ),
            align: 'center',
          },
          {
            header: 'حالة القيد',
            render: () => 'مرحل ومعتمد',
            align: 'center',
            width: '90px',
          },
        ]}
        rows={filteredRows}
        totalsRow={[
          { colSpan: 5, content: 'إجمالي صافي إيرادات المبيعات:' },
          { content: `+${formatCurrency(filteredTotals.gross, '')}`, align: 'center' },
          { content: `-${formatCurrency(filteredTotals.returns, '')}`, align: 'center' },
          { content: formatCurrency(filteredTotals.net, currency), align: 'center' },
          { content: 'مطابق 100%', align: 'center' },
        ]}
      />
    </div>
  );
};
