import React, { useState, useMemo } from 'react';
import {
  Customer,
  JournalEntry,
  Account,
  Invoice,
  PaymentVoucher,
  CompanyProfile,
  CreditNote,
} from '../../types.js';
import {
  GLReportsService,
  GlCustomerBalanceRow,
  GlCustomerBalancesSummary,
} from '../../services/glReportsService.ts';
import { formatCurrency } from '../../utils/formatters.ts';
import { FormalReportPrintModal } from './FormalReportPrintModal.tsx';
import {
  Users,
  Search,
  FileSpreadsheet,
  Printer,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Scale,
  DollarSign,
  Calendar,
  Layers,
  Filter,
  Eye,
} from 'lucide-react';

interface GlCustomerBalancesReportProps {
  customers: Customer[];
  journals: JournalEntry[];
  accounts: Account[];
  invoices: Invoice[];
  vouchers: PaymentVoucher[];
  creditNotes?: CreditNote[];
  company: CompanyProfile | null;
  currency: string;
  onViewAccountStatement?: (customerId: string) => void;
}

export const GlCustomerBalancesReport: React.FC<GlCustomerBalancesReportProps> = ({
  customers,
  journals,
  accounts,
  invoices,
  vouchers,
  creditNotes = [],
  company,
  currency,
  onViewAccountStatement,
}) => {
  const currencySymbol = (company as any)?.currency_symbol || company?.currencySymbol || company?.currency || currency || 'د.ك';
  const decimals = company?.decimalPlaces ?? (company as any)?.decimal_places ?? 3;

  // Date filters
  const today = new Date().toISOString().split('T')[0];
  const firstDayOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];

  const [datePreset, setDatePreset] = useState<'ALL' | 'THIS_YEAR' | 'CUSTOM'>('ALL');
  const [startDate, setStartDate] = useState<string>(firstDayOfYear);
  const [endDate, setEndDate] = useState<string>(today);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [balanceFilter, setBalanceFilter] = useState<'ALL' | 'DEBTORS' | 'ZERO' | 'CREDITORS'>('ALL');
  const [customerStatusFilter, setCustomerStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null);

  // Print modal state
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Handle Preset change
  const handlePresetChange = (preset: 'ALL' | 'THIS_YEAR' | 'CUSTOM') => {
    setDatePreset(preset);
    if (preset === 'THIS_YEAR') {
      setStartDate(firstDayOfYear);
      setEndDate(today);
    }
  };

  // 1. Strict GL-Calculated Customer Balances (incorporating Credit Notes)
  const reportData: GlCustomerBalancesSummary = useMemo(() => {
    return GLReportsService.calculateCustomerBalances(
      customers,
      journals,
      accounts,
      invoices,
      vouchers,
      datePreset === 'ALL' ? undefined : startDate,
      datePreset === 'ALL' ? undefined : endDate,
      creditNotes
    );
  }, [customers, journals, accounts, invoices, vouchers, datePreset, startDate, endDate, creditNotes]);

  // 2. Client-side Search & Filters (Document Number, Branch/Customer Code, Status)
  const filteredRows = useMemo(() => {
    return reportData.rows.filter((row) => {
      const custObj = customers.find((c) => c.id === row.customerId);

      // Customer Activity Status Filter
      if (customerStatusFilter === 'ACTIVE' && custObj && (custObj as any).status === 'INACTIVE') return false;
      if (customerStatusFilter === 'INACTIVE' && custObj && (custObj as any).status !== 'INACTIVE') return false;

      // Balance filter
      if (balanceFilter === 'DEBTORS' && row.netBalance <= 0.005) return false;
      if (balanceFilter === 'ZERO' && Math.abs(row.netBalance) > 0.005) return false;
      if (balanceFilter === 'CREDITORS' && row.netBalance >= -0.005) return false;

      // Text search: document number, branch/customer code, and status
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();

      const matchesCustomer =
        row.customerNameAr.toLowerCase().includes(q) ||
        row.customerCode.toLowerCase().includes(q) ||
        (row.phone && row.phone.includes(q)) ||
        (custObj?.taxNumber && custObj.taxNumber.toLowerCase().includes(q));

      const matchesBranch = Boolean(
        custObj?.branches?.some((b: any) =>
          (b.branchCode && b.branchCode.toLowerCase().includes(q)) ||
          (b.branchName && b.branchName.toLowerCase().includes(q))
        )
      );

      const matchesDocNumber = row.glMovements.some(
        (m) =>
          (m.entryNumber && m.entryNumber.toLowerCase().includes(q)) ||
          (m.reference && m.reference.toLowerCase().includes(q)) ||
          (m.description && m.description.toLowerCase().includes(q))
      );

      const matchesStatus =
        (q === 'مدين' && row.netBalance > 0.005) ||
        (q === 'دائن' && row.netBalance < -0.005) ||
        (q === 'خالص' && Math.abs(row.netBalance) <= 0.005) ||
        (q === 'نشط' && (custObj as any)?.status !== 'INACTIVE') ||
        (q === 'معلق' && (custObj as any)?.status === 'INACTIVE');

      return matchesCustomer || matchesBranch || matchesDocNumber || matchesStatus;
    });
  }, [reportData.rows, balanceFilter, customerStatusFilter, searchQuery, customers]);

  // Filtered Totals
  const filteredTotals = useMemo(() => {
    const totalOpening = filteredRows.reduce((s, r) => s + r.openingBalance, 0);
    const totalDebit = filteredRows.reduce((s, r) => s + r.totalDebit, 0);
    const totalCredit = filteredRows.reduce((s, r) => s + r.totalCredit, 0);
    const totalNet = filteredRows.reduce((s, r) => s + r.netBalance, 0);
    return { totalOpening, totalDebit, totalCredit, totalNet };
  }, [filteredRows]);

  // 3. Export to Excel (CSV UTF-8 BOM)
  const handleExportExcel = () => {
    const headers = [
      'كود العميل',
      'اسم العميل / الجمعية',
      `الرصيد الافتتاحي (${currencySymbol})`,
      `إجمالي المدين - فواتير ومبيعات (${currencySymbol})`,
      `إجمالي الدائن - تحصيلات وسدادات (${currencySymbol})`,
      `صافي الرصيد المستحق (${currencySymbol})`,
      'حالة الرصيد',
      'عدد الحركات المسجلة',
    ];

    const rows = filteredRows.map((r) => [
      r.customerCode,
      r.customerNameAr,
      r.openingBalance.toFixed(decimals),
      r.totalDebit.toFixed(decimals),
      r.totalCredit.toFixed(decimals),
      r.netBalance.toFixed(decimals),
      r.netBalance > 0.005 ? 'مدين (عليه)' : r.netBalance < -0.005 ? 'دائن (له)' : 'خالص',
      r.movementsCount,
    ]);

    GLReportsService.exportToExcelCSV('customer_balances_gl_report', headers, rows);
  };

  return (
    <div className="space-y-4">
      {/* Top Banner: Strict GL Compliance Notice */}
      <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">
                تقرير أرصدة العملاء من واقع حركات الحسابات (ح/ 1120)
              </h3>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-md font-mono font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                مطابق للأستاذ العام
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              محسوب ديناميكياً من صافي قيود اليومية المعتمدة: الرصيد = (الرصيد الافتتاحي) + (المدين من فواتير المبيعات) - (الدائن من المقبوضات والمرتجعات)
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

      {/* KPI Cards: Accounting Reconciliation */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <div className="text-[11px] text-slate-500 font-bold flex items-center justify-between">
            <span>إجمالي صافي أرصدة العملاء</span>
            <Users className="w-4 h-4 text-slate-700" />
          </div>
          <div className="text-base font-black font-mono text-slate-900">
            {formatCurrency(reportData.totalNetBalance, currency)}
          </div>
          <div className="text-[10px] text-slate-500">
            {reportData.activeDebtorsCount} عميل عليهم مستحقات قائمة
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <div className="text-[11px] text-slate-500 font-bold flex items-center justify-between">
            <span>رصيد ح/ المراقبة (1120) بالأستاذ</span>
            <Scale className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-base font-black font-mono text-indigo-950">
            {formatCurrency(reportData.controlAccountBalance, currency)}
          </div>
          <div className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            فارق التطابق: {formatCurrency(reportData.variance, currency)} (متزن 100%)
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <div className="text-[11px] text-slate-500 font-bold flex items-center justify-between">
            <span>إجمالي حركات المدين (فواتير معتمدة)</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-base font-black font-mono text-emerald-700">
            +{formatCurrency(reportData.totalDebit, currency)}
          </div>
          <div className="text-[10px] text-slate-500">
            شامل الفواتير الآجلة والقيود المدينة
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <div className="text-[11px] text-slate-500 font-bold flex items-center justify-between">
            <span>إجمالي حركات الدائن (تحصيلات ومرتجعات)</span>
            <ArrowDownRight className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-base font-black font-mono text-rose-700">
            -{formatCurrency(reportData.totalCredit, currency)}
          </div>
          <div className="text-[10px] text-slate-500">
            سندات القبض ومردودات المبيعات
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Preset buttons */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs">
            <button
              onClick={() => handlePresetChange('ALL')}
              className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                datePreset === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              كافة الفترات
            </button>
            <button
              onClick={() => handlePresetChange('THIS_YEAR')}
              className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                datePreset === 'THIS_YEAR'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              السنة المالية الحالية
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

          {/* Balance Filter Pill */}
          <select
            value={balanceFilter}
            onChange={(e) => setBalanceFilter(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1 text-xs font-bold text-slate-700 outline-none"
          >
            <option value="ALL">جميع الأرصدة ({reportData.rows.length})</option>
            <option value="DEBTORS">أرصدة مدينة (عليهم مستحقات) ({reportData.activeDebtorsCount})</option>
            <option value="ZERO">أرصدة مصفية (صفر)</option>
            <option value="CREDITORS">أرصدة دائنة (لهم دفعات مقدمة)</option>
          </select>

          {/* Customer Activity Status Filter */}
          <select
            value={customerStatusFilter}
            onChange={(e) => setCustomerStatusFilter(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1 text-xs font-bold text-slate-700 outline-none"
          >
            <option value="ALL">جميع الحالات</option>
            <option value="ACTIVE">حسابات نشطة</option>
            <option value="INACTIVE">حسابات معلقة / غير نشطة</option>
          </select>
        </div>

        {/* Search */}
        <div className="relative min-w-[280px]">
          <Search className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="مسح وتصفية برقم المستند، كود العميل/الفرع، أو الحالة..."
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
            <span>سجل أرصدة وحركات العملاء ({filteredRows.length} عميل)</span>
            <span className="text-[11px] text-slate-500 font-normal">
              مرتبة حسب صافي الرصيد المستحق تنازلياً
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
                <th className="py-2.5 px-3">كود العميل</th>
                <th className="py-2.5 px-3">اسم العميل / الجمعية</th>
                <th className="py-2.5 px-3 text-center">الرصيد الافتتاحي</th>
                <th className="py-2.5 px-3 text-center text-emerald-700">
                  إجمالي المدين (حركات فواتير)
                </th>
                <th className="py-2.5 px-3 text-center text-rose-700">
                  إجمالي الدائن (تحصيلات ومرتجعات)
                </th>
                <th className="py-2.5 px-3 text-center font-black bg-slate-200/60 text-slate-900">
                  صافي الرصيد المستحق ({currencySymbol})
                </th>
                <th className="py-2.5 px-3 text-center">تفاصيل القيود</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 font-sans font-bold">
                    لا توجد بيانات مطابقة لمعايير البحث في الفترة المحددة.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => {
                  const isExpanded = expandedCustomerId === row.customerId;
                  return (
                    <React.Fragment key={row.customerId}>
                      <tr className="hover:bg-slate-50/90 transition-colors">
                        <td className="py-2.5 px-3 text-center text-slate-500 font-bold text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          {row.customerCode}
                        </td>
                        <td className="py-2.5 px-3 font-sans">
                          <div className="font-bold text-slate-900">{row.customerNameAr}</div>
                          {row.phone && (
                            <span className="text-[10px] text-slate-400 font-mono block">
                              {row.phone}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-700">
                          {formatCurrency(row.openingBalance, '')}
                        </td>
                        <td className="py-2.5 px-3 text-center text-emerald-700 font-bold">
                          +{formatCurrency(row.totalDebit, '')}
                        </td>
                        <td className="py-2.5 px-3 text-center text-rose-700 font-bold">
                          -{formatCurrency(row.totalCredit, '')}
                        </td>
                        <td className="py-2.5 px-3 text-center bg-slate-50/50">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-md text-xs font-black ${
                              row.netBalance > 0.005
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : row.netBalance < -0.005
                                ? 'bg-blue-100 text-blue-900 border border-blue-300'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {formatCurrency(row.netBalance, '')}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-sans">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() =>
                                setExpandedCustomerId(isExpanded ? null : row.customerId)
                              }
                              className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                              title="عرض قيود اليومية المرتبطة"
                            >
                              <span>{row.movementsCount} حركة</span>
                              {isExpanded ? (
                                <ChevronUp className="w-3 h-3" />
                              ) : (
                                <ChevronDown className="w-3 h-3" />
                              )}
                            </button>

                            {onViewAccountStatement && (
                              <button
                                onClick={() => onViewAccountStatement(row.customerId)}
                                className="p-1 rounded hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                                title="فتح كشف حساب تحليلي تفصيلي"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expandable row: Under-the-hood GL entries */}
                      {isExpanded && (
                        <tr className="bg-slate-50">
                          <td colSpan={8} className="p-3">
                            <div className="bg-white rounded-lg border border-slate-200 p-3 space-y-2">
                              <div className="flex items-center justify-between text-xs font-bold text-slate-800 pb-2 border-b border-slate-100">
                                <span>
                                  حركات قيود اليومية المعتمدة لحساب العميل: {row.customerNameAr}
                                </span>
                                <span className="text-[11px] text-slate-500 font-mono">
                                  كود الحساب في الدليل: {reportData.controlAccountCode} (الذمم المدينة)
                                </span>
                              </div>

                              {row.glMovements.length === 0 ? (
                                <p className="text-xs text-slate-500 text-center py-2 font-sans">
                                  لا توجد حركات ترحيل في هذه الفترة، الرصيد يمثل الرصيد الافتتاحي فقط.
                                </p>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-right text-[11px] font-mono">
                                    <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                                      <tr>
                                        <th className="py-1 px-2">التاريخ</th>
                                        <th className="py-1 px-2">رقم القيد</th>
                                        <th className="py-1 px-2">المرجع</th>
                                        <th className="py-1 px-2">البيان والملاحظات</th>
                                        <th className="py-1 px-2 text-center text-emerald-700">مدين (+)</th>
                                        <th className="py-1 px-2 text-center text-rose-700">دائن (-)</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {row.glMovements.map((mv, mIdx) => (
                                        <tr key={mIdx} className="hover:bg-slate-50">
                                          <td className="py-1.5 px-2 text-slate-600">{mv.date}</td>
                                          <td className="py-1.5 px-2 font-bold text-slate-800">
                                            {mv.entryNumber}
                                          </td>
                                          <td className="py-1.5 px-2 text-slate-600">{mv.reference}</td>
                                          <td className="py-1.5 px-2 font-sans text-slate-700">{mv.description}</td>
                                          <td className="py-1.5 px-2 text-center text-emerald-700 font-bold">
                                            {mv.debit > 0 ? formatCurrency(mv.debit, '') : '—'}
                                          </td>
                                          <td className="py-1.5 px-2 text-center text-rose-700 font-bold">
                                            {mv.credit > 0 ? formatCurrency(mv.credit, '') : '—'}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
            {/* Table Footer with Totals */}
            <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-black text-slate-900">
              <tr>
                <td colSpan={3} className="py-3 px-3 text-right font-sans">
                  الإجمالي العام للأرصدة المعروضة ({filteredRows.length} عميل):
                </td>
                <td className="py-3 px-3 text-center">
                  {formatCurrency(filteredTotals.totalOpening, '')}
                </td>
                <td className="py-3 px-3 text-center text-emerald-800">
                  +{formatCurrency(filteredTotals.totalDebit, '')}
                </td>
                <td className="py-3 px-3 text-center text-rose-800">
                  -{formatCurrency(filteredTotals.totalCredit, '')}
                </td>
                <td className="py-3 px-3 text-center bg-slate-200/80 text-sm font-mono">
                  {formatCurrency(filteredTotals.totalNet, currency)}
                </td>
                <td className="py-3 px-3 text-center font-sans text-[11px] text-slate-600">
                  متطابق مع الدفتر العام
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Formal Report Print Modal (Strict Black Text #000000) */}
      <FormalReportPrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        title="تقرير أرصدة العملاء والذمم المدينة من واقع حركات الأستاذ العام"
        subtitle="حساب مراقبة العملاء والذمم المدينة (كود 1120) • مطابقة دفتر القيود اليومية المعتمدة"
        accountCodeNotice="حساب الأستاذ العام: 1120 (Accounts Receivable Control Account)"
        company={company}
        currency={currency}
        periodText={datePreset === 'ALL' ? 'كافة الحركات المالية المسجلة' : `من ${startDate} إلى ${endDate}`}
        summaryCards={[
          {
            label: 'إجمالي الأرصدة المدينة المستحقة',
            value: formatCurrency(reportData.totalNetBalance, currency),
            sublabel: `${reportData.activeDebtorsCount} عميل عليهم مديونيات`,
          },
          {
            label: 'رصيد ح/ المراقبة (1120) بالأستاذ',
            value: formatCurrency(reportData.controlAccountBalance, currency),
            sublabel: 'حساب الذمم المدينة بدليل الحسابات',
          },
          {
            label: 'إجمالي المبيعات المعتمدة (مدين)',
            value: `+${formatCurrency(reportData.totalDebit, currency)}`,
            sublabel: 'فواتير المبيعات المرحلة',
          },
          {
            label: 'إجمالي السدادات والمرتجعات (دائن)',
            value: `-${formatCurrency(reportData.totalCredit, currency)}`,
            sublabel: 'سندات التحصيل ومردودات المبيعات',
          },
        ]}
        columns={[
          { header: 'كود العميل', accessor: 'customerCode', align: 'center', width: '90px' },
          { header: 'اسم العميل / الجمعية', accessor: 'customerNameAr', align: 'right' },
          {
            header: 'الرصيد الافتتاحي',
            render: (r) => formatCurrency(r.openingBalance, ''),
            align: 'center',
          },
          {
            header: 'إجمالي المدين (فواتير)',
            render: (r) => `+${formatCurrency(r.totalDebit, '')}`,
            align: 'center',
          },
          {
            header: 'إجمالي الدائن (تحصيلات)',
            render: (r) => `-${formatCurrency(r.totalCredit, '')}`,
            align: 'center',
          },
          {
            header: `صافي الرصيد المستحق (${currencySymbol})`,
            render: (r) => (
              <strong style={{ color: '#000000' }}>
                {formatCurrency(r.netBalance, '')}
              </strong>
            ),
            align: 'center',
          },
        ]}
        rows={filteredRows}
        totalsRow={[
          { colSpan: 2, content: 'الإجمالي العام لكافة العملاء:' },
          { content: formatCurrency(filteredTotals.totalOpening, ''), align: 'center' },
          { content: `+${formatCurrency(filteredTotals.totalDebit, '')}`, align: 'center' },
          { content: `-${formatCurrency(filteredTotals.totalCredit, '')}`, align: 'center' },
          { content: formatCurrency(filteredTotals.totalNet, currency), align: 'center' },
        ]}
      />
    </div>
  );
};
