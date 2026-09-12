import React, { useState, useMemo } from 'react';
import { Invoice, Customer, CompanyProfile, InventoryItem, JournalEntry, Account, PaymentVoucher } from '../../types.js';
import { formatCurrency } from '../../utils/formatters.ts';
import {
  DollarSign,
  TrendingUp,
  FileSpreadsheet,
  Printer,
  Search,
  Calendar,
  Percent,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Package,
  Users,
  Building2,
  CheckCircle2,
  Eye,
  Scale,
} from 'lucide-react';
import { AccountStatementView } from '../AccountStatementView.tsx';
import { GlCustomerBalancesReport } from '../reports/GlCustomerBalancesReport.tsx';
import { GlPostedSalesReport } from '../reports/GlPostedSalesReport.tsx';

interface SalesReportsViewProps {
  invoices: Invoice[];
  customers: Customer[];
  inventory: InventoryItem[];
  journals?: JournalEntry[];
  accounts?: Account[];
  vouchers?: PaymentVoucher[];
  company: CompanyProfile | null;
  currency: string;
  initialReport?: 'customer-balances' | 'gl-sales' | 'consolidated' | 'profit' | 'statements';
  onViewInvoice?: (invoice: Invoice) => void;
  onViewAccountStatement?: (customerId: string) => void;
}

export const SalesReportsView: React.FC<SalesReportsViewProps> = ({
  invoices,
  customers,
  inventory,
  journals = [],
  accounts = [],
  vouchers = [],
  company,
  currency,
  initialReport = 'customer-balances',
  onViewInvoice,
  onViewAccountStatement,
}) => {
  const [activeReport, setActiveReport] = useState<
    'customer-balances' | 'gl-sales' | 'consolidated' | 'profit' | 'statements'
  >(initialReport);
  const [statementSelectedCustomerId, setStatementSelectedCustomerId] = useState<string | undefined>(undefined);

  const handleOpenCustomerStatement = (customerId: string) => {
    setStatementSelectedCustomerId(customerId);
    setActiveReport('statements');
    if (onViewAccountStatement) {
      onViewAccountStatement(customerId);
    }
  };

  // Date filters
  const today = new Date().toISOString().split('T')[0];
  const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const firstDayOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];

  const [datePreset, setDatePreset] = useState<'TODAY' | 'THIS_MONTH' | 'THIS_YEAR' | 'ALL'>('THIS_YEAR');
  const [startDate, setStartDate] = useState<string>(firstDayOfYear);
  const [endDate, setEndDate] = useState<string>(today);
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | 'CASH' | 'CREDIT'>('ALL');

  const handlePresetChange = (preset: 'TODAY' | 'THIS_MONTH' | 'THIS_YEAR' | 'ALL') => {
    setDatePreset(preset);
    if (preset === 'TODAY') {
      setStartDate(today);
      setEndDate(today);
    } else if (preset === 'THIS_MONTH') {
      setStartDate(firstDayOfMonth);
      setEndDate(today);
    } else if (preset === 'THIS_YEAR') {
      setStartDate(firstDayOfYear);
      setEndDate(today);
    } else if (preset === 'ALL') {
      setStartDate('2020-01-01');
      setEndDate('2030-12-31');
    }
  };

  const isDateInRange = (dateStr?: string) => {
    if (datePreset === 'ALL') return true;
    if (!dateStr) return false;
    const d = dateStr.split('T')[0];
    return d >= startDate && d <= endDate;
  };

  // 1. Filtered Sales Invoices
  const salesInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const isSales = inv.type === 'SALES' || inv.type === 'SALES_RETURN';
      if (!isSales) return false;
      if (!isDateInRange(inv.date)) return false;
      if (paymentFilter !== 'ALL' && inv.paymentTerms !== paymentFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesNo = (inv.invoiceNumber || '').toLowerCase().includes(q);
        const matchesName = (inv.entityNameAr || '').toLowerCase().includes(q);
        if (!matchesNo && !matchesName) return false;
      }
      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [invoices, startDate, endDate, datePreset, paymentFilter, searchQuery]);

  // Consolidated KPIs
  const salesMetrics = useMemo(() => {
    let grossSales = 0;
    let returnsTotal = 0;
    let discountsTotal = 0;
    let netRevenue = 0;
    let cashPaid = 0;
    let creditDue = 0;
    let count = 0;

    salesInvoices.forEach((inv) => {
      const total = Number(inv.grandTotal) || 0;
      const disc = Number(inv.discountTotal) || 0;
      const paid = Number(inv.paidAmount) || 0;
      const due = Number(inv.dueAmount) || 0;

      if (inv.type === 'SALES') {
        grossSales += Number(inv.subtotal) || total;
        discountsTotal += disc;
        netRevenue += total;
        cashPaid += paid;
        creditDue += due;
        count++;
      } else if (inv.type === 'SALES_RETURN') {
        returnsTotal += total;
        netRevenue -= total;
      }
    });

    return { grossSales, returnsTotal, discountsTotal, netRevenue, cashPaid, creditDue, count };
  }, [salesInvoices]);

  // 2. Profitability Analysis per Invoice
  const profitReportRows = useMemo(() => {
    return salesInvoices
      .filter((inv) => inv.type === 'SALES')
      .map((inv) => {
        let totalCost = 0;
        const invoiceLines = (inv.lines || (inv as any).items || []);
        const lineCount = invoiceLines.length;

        invoiceLines.forEach((line: any) => {
          const matchedItem = inventory.find((i) => i.id === line.itemId || (i.sku && i.sku === line.itemSku));
          const unitCost = Number(matchedItem?.costPrice) || Number(matchedItem?.purchasePrice) || 0;
          const qty = Number(line.quantity) || 0;
          totalCost += qty * unitCost;
        });

        const revenue = Number(inv.grandTotal) || 0;
        const profit = revenue - totalCost;
        const marginPct = revenue > 0 ? (profit / revenue) * 100 : 0;

        return {
          invoice: inv,
          revenue,
          totalCost,
          profit,
          marginPct,
          lineCount,
        };
      });
  }, [salesInvoices, inventory]);

  const profitTotals = useMemo(() => {
    let totalRev = 0;
    let totalCost = 0;
    let totalProfit = 0;

    profitReportRows.forEach((r) => {
      totalRev += r.revenue;
      totalCost += r.totalCost;
      totalProfit += r.profit;
    });

    const overallMargin = totalRev > 0 ? (totalProfit / totalRev) * 100 : 0;
    return { totalRev, totalCost, totalProfit, overallMargin };
  }, [profitReportRows]);

  return (
    <div className="space-y-4">
      {/* Sub-report selector buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setActiveReport('customer-balances')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeReport === 'customer-balances'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>تقرير أرصدة العملاء (ح/ 1120)</span>
          </button>
          <button
            onClick={() => setActiveReport('gl-sales')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeReport === 'gl-sales'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>تقرير المبيعات المعتمدة (ح/ 4100)</span>
          </button>
          <button
            onClick={() => setActiveReport('consolidated')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeReport === 'consolidated'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            تقرير المبيعات المجمعة
          </button>
          <button
            onClick={() => setActiveReport('profit')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeReport === 'profit'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            تقرير أرباح وهوامش الفواتير
          </button>
          <button
            onClick={() => setActiveReport('statements')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeReport === 'statements'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            كشوف حسابات العملاء
          </button>
        </div>

        {(activeReport === 'consolidated' || activeReport === 'profit') && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 border border-slate-300 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span>طباعة التقرير</span>
            </button>
          </div>
        )}
      </div>

      {/* 1. GL-LINKED CUSTOMER BALANCES REPORT (ح/ 1120) */}
      {activeReport === 'customer-balances' && (
        <GlCustomerBalancesReport
          customers={customers}
          journals={journals}
          accounts={accounts}
          invoices={invoices}
          vouchers={vouchers}
          company={company}
          currency={currency}
          onViewAccountStatement={handleOpenCustomerStatement}
        />
      )}

      {/* 2. GL-LINKED POSTED SALES REVENUE REPORT (ح/ 4100) */}
      {activeReport === 'gl-sales' && (
        <GlPostedSalesReport
          journals={journals}
          accounts={accounts}
          invoices={invoices}
          company={company}
          currency={currency}
          onViewInvoice={(invoiceId) => {
            const inv = invoices.find((i) => i.id === invoiceId);
            if (inv && onViewInvoice) onViewInvoice(inv);
          }}
        />
      )}

      {/* 3. When Customer Statements selected */}
      {activeReport === 'statements' && (
        <div className="bg-white rounded-xl border border-slate-200 p-2 shadow-xs">
          <AccountStatementView
            customers={customers}
            suppliers={[]}
            invoices={invoices}
            vouchers={vouchers}
            journals={journals}
            company={company}
            currency={currency}
            initialEntityType="CUSTOMER"
            initialEntityId={statementSelectedCustomerId}
          />
        </div>
      )}

      {/* Filter Bar for Consolidated & Profit */}
      {(activeReport === 'consolidated' || activeReport === 'profit') && (
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Presets */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
              <button
                onClick={() => handlePresetChange('TODAY')}
                className={`px-2.5 py-1 rounded font-bold transition-colors ${
                  datePreset === 'TODAY' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                اليوم
              </button>
              <button
                onClick={() => handlePresetChange('THIS_MONTH')}
                className={`px-2.5 py-1 rounded font-bold transition-colors ${
                  datePreset === 'THIS_MONTH' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                هذا الشهر
              </button>
              <button
                onClick={() => handlePresetChange('THIS_YEAR')}
                className={`px-2.5 py-1 rounded font-bold transition-colors ${
                  datePreset === 'THIS_YEAR' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                هذا العام
              </button>
              <button
                onClick={() => handlePresetChange('ALL')}
                className={`px-2.5 py-1 rounded font-bold transition-colors ${
                  datePreset === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                كافة الفترات
              </button>
            </div>

            {/* Dates */}
            <div className="flex items-center gap-2 text-xs">
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-slate-600 font-bold">من:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setDatePreset('ALL');
                  }}
                  className="bg-transparent font-mono font-bold text-slate-900 focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-slate-600 font-bold">إلى:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setDatePreset('ALL');
                  }}
                  className="bg-transparent font-mono font-bold text-slate-900 focus:outline-none"
                />
              </div>
            </div>

            {/* Payment Filter */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-600 font-bold">طريقة السداد:</span>
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value as any)}
                className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-slate-900 font-bold focus:outline-none"
              >
                <option value="ALL">الكل (نقدي + آجل)</option>
                <option value="CASH">نقدي (كاش)</option>
                <option value="CREDIT">آجل (ذمم)</option>
              </select>
            </div>

            {/* Search */}
            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
              <input
                type="text"
                placeholder="بحث برقم الفاتورة أو العميل..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg pr-8 pl-3 py-1 text-xs text-slate-900 focus:outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* 1. REPORT: CONSOLIDATED SALES */}
      {activeReport === 'consolidated' && (
        <div className="space-y-4">
          {/* Metrics Ribbon */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 block">إجمالي المبيعات</span>
              <span className="text-base font-bold font-mono text-slate-900 block mt-1">
                {formatCurrency(salesMetrics.grossSales, currency)}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">{salesMetrics.count} فاتورة</span>
            </div>

            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 block">مرتجعات المبيعات</span>
              <span className="text-base font-bold font-mono text-rose-600 block mt-1">
                -{formatCurrency(salesMetrics.returnsTotal, currency)}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">إشعارات دائنة</span>
            </div>

            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 block">الخصومات الممنوحة</span>
              <span className="text-base font-bold font-mono text-amber-600 block mt-1">
                -{formatCurrency(salesMetrics.discountsTotal, currency)}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">تخفيضات تجارية</span>
            </div>

            <div className="bg-white p-3 rounded-xl border border-emerald-200 shadow-xs bg-emerald-50/20">
              <span className="text-[11px] font-bold text-emerald-800 block">صافي إيراد المبيعات</span>
              <span className="text-base font-bold font-mono text-emerald-700 block mt-1">
                {formatCurrency(salesMetrics.netRevenue, currency)}
              </span>
              <span className="text-[10px] text-emerald-600 mt-0.5 block font-bold">الناتج الفعلي</span>
            </div>

            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 block">المحصل نقداً (كاش)</span>
              <span className="text-base font-bold font-mono text-slate-900 block mt-1">
                {formatCurrency(salesMetrics.cashPaid, currency)}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">تم إيداعه</span>
            </div>

            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 block">المستحق على العملاء (ذمم)</span>
              <span className="text-base font-bold font-mono text-slate-900 block mt-1">
                {formatCurrency(salesMetrics.creditDue, currency)}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">آجل معلق</span>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-3 border-b border-slate-200 flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900">سجل فواتير المبيعات التفصيلي</h4>
              <span className="text-xs font-bold text-slate-500 font-mono">
                {salesInvoices.length} مستند مسجل
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-900 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">رقم الفاتورة</th>
                    <th className="py-2.5 px-3">التاريخ</th>
                    <th className="py-2.5 px-3">العميل</th>
                    <th className="py-2.5 px-3 text-center">النوع</th>
                    <th className="py-2.5 px-3 text-center">شروط الدفع</th>
                    <th className="py-2.5 px-3 text-left font-mono">المجموع</th>
                    <th className="py-2.5 px-3 text-left font-mono">الخصم</th>
                    <th className="py-2.5 px-3 text-left font-mono">الصافي</th>
                    <th className="py-2.5 px-3 text-center">الحالة</th>
                    <th className="py-2.5 px-3 text-center">معاينة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {salesInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-500 font-bold">
                        لا توجد فواتير مبيعات مطابقة لمعايير البحث المحددة
                      </td>
                    </tr>
                  ) : (
                    salesInvoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-3 font-mono font-bold text-slate-900">{inv.invoiceNumber}</td>
                        <td className="py-2 px-3 font-mono text-slate-600">{inv.date}</td>
                        <td className="py-2 px-3 font-bold text-slate-900">{inv.entityNameAr || '-'}</td>
                        <td className="py-2 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              inv.type === 'SALES'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                                : 'bg-rose-50 text-rose-700 border border-rose-300'
                            }`}
                          >
                            {inv.type === 'SALES' ? 'فاتورة بيع' : 'مرتجع بيع'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className="font-bold text-[11px] text-slate-700">
                            {inv.paymentTerms === 'CASH' ? 'نقدي' : 'آجل'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-left font-mono text-slate-700">
                          {formatCurrency(inv.subtotal, currency)}
                        </td>
                        <td className="py-2 px-3 text-left font-mono text-amber-700">
                          {inv.discountTotal > 0 ? `-${formatCurrency(inv.discountTotal, currency)}` : '-'}
                        </td>
                        <td className="py-2 px-3 text-left font-mono font-bold text-slate-900">
                          {formatCurrency(inv.grandTotal, currency)}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              inv.status === 'POSTED' || inv.status === 'PAID'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                                : inv.status === 'CANCELLED'
                                ? 'bg-rose-50 text-rose-700 border border-rose-300'
                                : 'bg-amber-50 text-amber-700 border border-amber-300'
                            }`}
                          >
                            {inv.status === 'POSTED'
                              ? 'مرحلة'
                              : inv.status === 'PAID'
                              ? 'مدفوعة'
                              : inv.status === 'CANCELLED'
                              ? 'ملغاة'
                              : 'مسودة'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center">
                          {onViewInvoice && (
                            <button
                              onClick={() => onViewInvoice(inv)}
                              className="p-1 rounded hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                              title="معاينة وطباعة الفاتورة"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. REPORT: INVOICE PROFITABILITY */}
      {activeReport === 'profit' && (
        <div className="space-y-4">
          {/* Profit KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs font-bold text-slate-500 block">إجمالي إيراد الفواتير</span>
              <span className="text-lg font-bold font-mono text-slate-900 block mt-1">
                {formatCurrency(profitTotals.totalRev, currency)}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">سعر البيع الإجمالي</span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs font-bold text-slate-500 block">تكلفة البضاعة المباعة (COGS)</span>
              <span className="text-lg font-bold font-mono text-slate-900 block mt-1">
                {formatCurrency(profitTotals.totalCost, currency)}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">تكلفة الشراء والإنتاج</span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-emerald-200 shadow-xs bg-emerald-50/20">
              <span className="text-xs font-bold text-emerald-800 block">مجمل الربح التجاري</span>
              <span className="text-lg font-bold font-mono text-emerald-700 block mt-1">
                {formatCurrency(profitTotals.totalProfit, currency)}
              </span>
              <span className="text-[10px] text-emerald-600 mt-0.5 block font-bold">الإيراد - التكلفة</span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs font-bold text-slate-500 block">متوسط هامش الربح الإجمالي</span>
              <span className="text-lg font-bold font-mono text-slate-900 block mt-1">
                {profitTotals.overallMargin.toFixed(1)}%
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">نسبة الربحية</span>
            </div>
          </div>

          {/* Profit Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-3 border-b border-slate-200 flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900">تحليل ربحية كل فاتورة بيع</h4>
              <span className="text-xs font-bold text-slate-500 font-mono">
                {profitReportRows.length} فاتورة تم تحليل تكاليفها
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-900 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">رقم الفاتورة</th>
                    <th className="py-2.5 px-3">التاريخ</th>
                    <th className="py-2.5 px-3">العميل</th>
                    <th className="py-2.5 px-3 text-center">عدد البنود</th>
                    <th className="py-2.5 px-3 text-left font-mono">قيمة الفاتورة</th>
                    <th className="py-2.5 px-3 text-left font-mono">إجمالي التكلفة</th>
                    <th className="py-2.5 px-3 text-left font-mono">الربح المحقق</th>
                    <th className="py-2.5 px-3 text-center">نسبة الهامش</th>
                    <th className="py-2.5 px-3 text-center">معاينة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {profitReportRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-500 font-bold">
                        لا توجد فواتير بيع لتحليل الربحية
                      </td>
                    </tr>
                  ) : (
                    profitReportRows.map((row) => (
                      <tr key={row.invoice.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-3 font-mono font-bold text-slate-900">
                          {row.invoice.invoiceNumber}
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-600">{row.invoice.date}</td>
                        <td className="py-2 px-3 font-bold text-slate-900">
                          {row.invoice.entityNameAr || '-'}
                        </td>
                        <td className="py-2 px-3 text-center font-mono font-bold text-slate-700">
                          {row.lineCount}
                        </td>
                        <td className="py-2 px-3 text-left font-mono font-bold text-slate-900">
                          {formatCurrency(row.revenue, currency)}
                        </td>
                        <td className="py-2 px-3 text-left font-mono text-slate-600">
                          {formatCurrency(row.totalCost, currency)}
                        </td>
                        <td className="py-2 px-3 text-left font-mono font-bold text-emerald-700">
                          {formatCurrency(row.profit, currency)}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold font-mono ${
                              row.marginPct >= 20
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                                : row.marginPct > 0
                                ? 'bg-amber-50 text-amber-700 border border-amber-300'
                                : 'bg-rose-50 text-rose-700 border border-rose-300'
                            }`}
                          >
                            {row.marginPct.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center">
                          {onViewInvoice && (
                            <button
                              onClick={() => onViewInvoice(row.invoice)}
                              className="p-1 rounded hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                              title="معاينة الفاتورة"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
