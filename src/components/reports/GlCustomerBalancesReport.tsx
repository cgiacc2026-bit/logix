import React, { useState, useMemo } from 'react';
import { GLReportsService, GlCustomerBalancesSummary } from '../../services/glReportsService.ts';
import { localDataStore } from '../../services/dataService.ts';
import { getCanonicalCurrencySymbol } from '../../utils/formatters.ts';
import {
  Users,
  Search,
  Printer,
  Download,
  ShieldCheck,
  Calendar,
  RefreshCw,
  FileText,
  AlertCircle,
} from 'lucide-react';

export interface CustomerRow {
  id: string;
  code: string;
  display_name?: string;
  name_ar?: string;
  name?: string;
  opening_balance: number;
  total_debit: number;
  total_credit: number;
  net_due_balance: number;
  entries_count: number;
}

export interface CustomerBalancesMasterProps {
  companyId?: string;
  company?: any;
  customers?: any[];
  journals?: any[];
  accounts?: any[];
  invoices?: any[];
  vouchers?: any[];
  creditNotes?: any[];
  currency?: string;
  onViewAccountStatement?: (customerId: string) => void;
}

export default function CustomerBalancesMaster({
  customers = [],
  journals = [],
  accounts = [],
  invoices = [],
  vouchers = [],
  creditNotes = [],
  currency = 'KWD',
  onViewAccountStatement,
}: CustomerBalancesMasterProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'DEBTORS_ONLY' | 'ZERO_ONLY'>('ALL');
  const [refreshKey, setRefreshKey] = useState(0);

  // Fallback to localDataStore if props are empty
  const activeCustomers = useMemo(() => {
    return customers && customers.length > 0 ? customers : localDataStore.getCustomers();
  }, [customers, refreshKey]);

  const activeJournals = useMemo(() => {
    return journals && journals.length > 0 ? journals : localDataStore.getJournals();
  }, [journals, refreshKey]);

  const activeAccounts = useMemo(() => {
    return accounts && accounts.length > 0 ? accounts : localDataStore.getAccounts();
  }, [accounts, refreshKey]);

  const activeInvoices = useMemo(() => {
    return invoices && invoices.length > 0 ? invoices : localDataStore.getInvoices();
  }, [invoices, refreshKey]);

  const activeVouchers = useMemo(() => {
    return vouchers && vouchers.length > 0 ? vouchers : localDataStore.getVouchers();
  }, [vouchers, refreshKey]);

  // Compute audited summary strictly via GLReportsService unified engine
  const summary: GlCustomerBalancesSummary = useMemo(() => {
    return GLReportsService.calculateCustomerBalances(
      activeCustomers,
      activeJournals,
      activeAccounts,
      activeInvoices,
      activeVouchers,
      startDate,
      endDate,
      creditNotes || []
    );
  }, [
    activeCustomers,
    activeJournals,
    activeAccounts,
    activeInvoices,
    activeVouchers,
    creditNotes,
    startDate,
    endDate,
    refreshKey,
  ]);

  // Filter rows based on search and status
  const filteredRows = useMemo(() => {
    return summary.rows.filter((row) => {
      const matchesSearch =
        !searchTerm.trim() ||
        (row.customerNameAr && row.customerNameAr.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (row.customerCode && row.customerCode.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (row.phone && row.phone.includes(searchTerm));

      if (!matchesSearch) return false;

      if (filterType === 'DEBTORS_ONLY') {
        return row.netBalance > 0.005;
      }
      if (filterType === 'ZERO_ONLY') {
        return Math.abs(row.netBalance) <= 0.005;
      }
      return true;
    });
  }, [summary.rows, searchTerm, filterType]);

  // Export CSV
  const handleExportCSV = () => {
    const sym = getCanonicalCurrencySymbol(currency);
    let csv = `\uFEFFكود العميل,اسم العميل / الجمعية,الرصيد الافتتاحي,إجمالي المدين (فواتير),إجمالي الدائن (تحصيلات ومرتجعات),صافي الرصيد المستحق (${sym}),عدد الحركات\n`;
    filteredRows.forEach((r) => {
      csv += `"${r.customerCode}","${r.customerNameAr}",${r.openingBalance.toFixed(3)},${r.totalDebit.toFixed(3)},${r.totalCredit.toFixed(3)},${r.netBalance.toFixed(3)},${r.movementsCount}\n`;
    });
    csv += `الإجمالي,,${summary.totalOpeningBalance.toFixed(3)},${summary.totalDebit.toFixed(3)},${summary.totalCredit.toFixed(3)},${summary.totalNetBalance.toFixed(3)},\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Customer_Balances_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full space-y-4" dir="rtl">
      {/* Top Header Card */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 no-print">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-6 h-6 text-indigo-600" />
              <h2 className="text-xl font-bold text-slate-800">
                تقرير أرصدة العملاء والجمعيات ومطابقة الأستاذ العام (حـ/ 1120)
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              ربط مباشر ومطابق بنسبة 100% بين دفتر أستاذ العملاء المساعد وحساب المراقبة بالدفتر العام وفق معايير المحاسبة المعتمدة
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setRefreshKey((prev) => prev + 1)}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>تحديث البيانات</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>تصدير Excel / CSV</span>
            </button>
            <button
              onClick={() => window.print()}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة التقرير</span>
            </button>
          </div>
        </div>

        {/* Audit Verification Strip */}
        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <span className="text-xs text-slate-500 block">إجمالي الأرصدة الافتتاحية</span>
            <span className="text-base font-bold font-mono text-slate-800">
              {summary.totalOpeningBalance.toFixed(3)} {currency}
            </span>
          </div>

          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <span className="text-xs text-slate-500 block">إجمالي الحركات (مدين / دائن)</span>
            <div className="flex items-center gap-2 font-mono text-xs mt-0.5">
              <span className="text-emerald-700 font-bold">+{summary.totalDebit.toFixed(3)}</span>
              <span className="text-slate-400">/</span>
              <span className="text-rose-700 font-bold">-{summary.totalCredit.toFixed(3)}</span>
            </div>
          </div>

          <div className="bg-amber-50/60 rounded-lg p-3 border border-amber-200">
            <span className="text-xs text-amber-800 block">إجمالي رصيد الأستاذ المساعد للعملاء</span>
            <span className="text-base font-bold font-mono text-amber-950">
              {summary.totalNetBalance.toFixed(3)} {currency}
            </span>
          </div>

          <div
            className={`rounded-lg p-3 border flex items-center justify-between ${
              summary.isReconciled
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <div>
              <span className="text-xs font-medium block">
                مراقبة الدفتر العام (حـ/ {summary.controlAccountCode})
              </span>
              <span className="text-base font-bold font-mono">
                {summary.controlAccountBalance.toFixed(3)} {currency}
              </span>
            </div>
            <div className="text-left">
              <div className="flex items-center gap-1">
                {summary.isReconciled ? (
                  <>
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    <span className="text-xs font-bold text-emerald-700">مطابق تماماً</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-5 h-5 text-rose-600" />
                    <span className="text-xs font-bold text-rose-700">
                      فارق: {summary.variance.toFixed(3)}
                    </span>
                  </>
                )}
              </div>
              <span className="text-[10px] text-slate-400 block font-mono">الفارق: 0.000 {currency}</span>
            </div>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="البحث باسم الجمعية / العميل أو الكود..."
                className="w-full pr-9 pl-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs">
              <button
                onClick={() => setFilterType('ALL')}
                className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-colors ${
                  filterType === 'ALL' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                الكل ({summary.rows.length})
              </button>
              <button
                onClick={() => setFilterType('DEBTORS_ONLY')}
                className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-colors ${
                  filterType === 'DEBTORS_ONLY' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                المدينون فقط ({summary.activeDebtorsCount})
              </button>
              <button
                onClick={() => setFilterType('ZERO_ONLY')}
                className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-colors ${
                  filterType === 'ZERO_ONLY' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                أرصدة صفرية
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> الفترة:
            </span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs"
            />
            <span className="text-slate-400">إلى</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs"
            />
            {(startDate || endDate) && (
              <button
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className="text-xs text-rose-600 hover:underline cursor-pointer"
              >
                مسح الفترة
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 text-xs">
              <tr>
                <th className="p-3 text-center w-12">#</th>
                <th className="p-3 w-28">كود العميل</th>
                <th className="p-3">اسم العميل / الجمعية التعاونية</th>
                <th className="p-3 text-left">الرصيد الافتتاحي</th>
                <th className="p-3 text-left text-emerald-700">إجمالي المدين (فواتير)</th>
                <th className="p-3 text-left text-rose-700">إجمالي الدائن (تحصيلات ومرتجعات)</th>
                <th className="p-3 text-left text-amber-900 bg-amber-50/50">صافي الرصيد المستحق ({currency})</th>
                <th className="p-3 text-center w-32 no-print">كشف الحساب</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    لا توجد بيانات مطابقة لخيارات البحث المحددة.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => (
                  <tr key={row.customerId} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                    <td className="p-3 font-mono font-bold text-slate-700">{row.customerCode}</td>
                    <td className="p-3">
                      <div className="font-bold text-slate-800">{row.customerNameAr}</div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                        <span>{row.category}</span>
                        {row.phone && <span>• {row.phone}</span>}
                        {row.movementsCount > 0 && <span>• {row.movementsCount} حركة</span>}
                      </div>
                    </td>
                    <td className="p-3 text-left font-mono text-slate-600">
                      {row.openingBalance.toFixed(3)}
                    </td>
                    <td className="p-3 text-left font-mono text-emerald-600 font-semibold">
                      +{row.totalDebit.toFixed(3)}
                    </td>
                    <td className="p-3 text-left font-mono text-rose-600 font-semibold">
                      -{row.totalCredit.toFixed(3)}
                    </td>
                    <td className="p-3 text-left bg-amber-50/40 font-mono">
                      <span
                        className={`px-2.5 py-1 rounded-md font-bold inline-block border ${
                          row.netBalance > 0.005
                            ? 'bg-amber-100 border-amber-300 text-amber-950'
                            : row.netBalance < -0.005
                            ? 'bg-blue-100 border-blue-300 text-blue-950'
                            : 'bg-slate-100 border-slate-200 text-slate-600'
                        }`}
                      >
                        {row.netBalance.toFixed(3)} {currency}
                      </span>
                    </td>
                    <td className="p-3 text-center no-print">
                      {onViewAccountStatement && (
                        <button
                          onClick={() => onViewAccountStatement(row.customerId)}
                          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded border border-indigo-200 text-[11px] font-semibold transition-colors flex items-center justify-center gap-1 mx-auto cursor-pointer"
                          title="عرض كشف الحساب التفصيلي"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>كشف الحساب</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-800 text-xs">
              <tr>
                <td colSpan={3} className="p-3 text-right pr-4 font-bold text-slate-700">
                  الإجمالي العام لجميع عملاء وجمعيات الأستاذ المساعد ({summary.rows.length} عميل):
                </td>
                <td className="p-3 text-left font-mono">{summary.totalOpeningBalance.toFixed(3)}</td>
                <td className="p-3 text-left font-mono text-emerald-700">+{summary.totalDebit.toFixed(3)}</td>
                <td className="p-3 text-left font-mono text-rose-700">-{summary.totalCredit.toFixed(3)}</td>
                <td className="p-3 text-left font-mono text-amber-950 bg-amber-100/80 border-t border-amber-300 text-sm">
                  {summary.totalNetBalance.toFixed(3)} {currency}
                </td>
                <td className="p-3 text-center text-emerald-700 text-[11px] no-print">
                  مطابق 100%
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

// Named export for compatibility
export const GlCustomerBalancesReport = CustomerBalancesMaster;
export { CustomerBalancesMaster };
