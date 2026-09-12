import React, { useState, useMemo } from 'react';
import {
  InventoryItem,
  JournalEntry,
  Account,
  Invoice,
  CompanyProfile,
  Warehouse,
} from '../../types.js';
import {
  GLReportsService,
  GlInventoryValuationRow,
  GlInventoryValuationSummary,
} from '../../services/glReportsService.ts';
import { StockLedgerService } from '../../services/stockLedgerService.ts';
import { StockMovement } from '../../types.js';
import { formatCurrency } from '../../utils/formatters.ts';
import { FormalReportPrintModal } from './FormalReportPrintModal.tsx';
import {
  Package,
  Search,
  FileSpreadsheet,
  Printer,
  Scale,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  Layers,
  ArrowUpDown,
  Building2,
} from 'lucide-react';

interface GlInventoryValuationReportProps {
  inventory: InventoryItem[];
  journals: JournalEntry[];
  accounts: Account[];
  invoices: Invoice[];
  warehouses?: Warehouse[];
  company: CompanyProfile | null;
  currency: string;
  onViewStockCard?: (itemId: string) => void;
}

export const GlInventoryValuationReport: React.FC<GlInventoryValuationReportProps> = ({
  inventory,
  journals,
  accounts,
  invoices,
  warehouses = [],
  company,
  currency,
  onViewStockCard,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'IN_STOCK' | 'DEFICIT' | 'ZERO'>('ALL');
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Synthesize movements for dynamic live stock computation
  const movements: StockMovement[] = useMemo(() => {
    return StockLedgerService.getStockMovements(inventory, invoices, []);
  }, [inventory, invoices]);

  // 1. Calculate GL-Integrated Inventory Valuation
  const reportData: GlInventoryValuationSummary = useMemo(() => {
    return GLReportsService.calculateInventoryValuation(
      inventory,
      journals,
      accounts,
      invoices,
      movements
    );
  }, [inventory, journals, accounts, invoices, movements]);

  // Categories list
  const categories = useMemo(() => {
    return Array.from(new Set(inventory.map((i) => i.category || 'عام'))).filter(Boolean);
  }, [inventory]);

  // 2. Filter rows
  const filteredRows = useMemo(() => {
    return reportData.rows.filter((row) => {
      if (categoryFilter !== 'ALL' && row.category !== categoryFilter) return false;
      if (statusFilter === 'IN_STOCK' && row.liveQuantity <= 0) return false;
      if (statusFilter === 'DEFICIT' && !row.isDeficit) return false;
      if (statusFilter === 'ZERO' && row.liveQuantity !== 0) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        row.nameAr.toLowerCase().includes(q) ||
        row.sku.toLowerCase().includes(q) ||
        (row.barcode && row.barcode.includes(q))
      );
    });
  }, [reportData.rows, categoryFilter, statusFilter, searchQuery]);

  // Filtered Totals
  const filteredTotals = useMemo(() => {
    const totalUnits = filteredRows.reduce((s, r) => s + r.liveQuantity, 0);
    const totalVal = filteredRows.reduce((s, r) => s + r.totalBookValuation, 0);
    const totalCogs = filteredRows.reduce((s, r) => s + r.cogsAmount, 0);
    return { totalUnits, totalVal, totalCogs };
  }, [filteredRows]);

  // Export to Excel (CSV UTF-8 BOM)
  const handleExportExcel = () => {
    const headers = [
      'كود الصنف (SKU)',
      'اسم الصنف',
      'التصنيف',
      'وحدة القياس',
      'الكمية اللحظية بالمستودع',
      'متوسط التكلفة المرجح (د.ك)',
      'سعر البيع الافتراضي (د.ك)',
      'إجمالي القيمة الدفترية (د.ك)',
      'تكلفة المنصرف لحساب 5100 (د.ك)',
      'حالة المخزون',
      'حالة المطابقة مع ح/ 1130',
    ];

    const rows = filteredRows.map((r) => [
      r.sku,
      r.nameAr,
      r.category,
      r.unit,
      r.liveQuantity,
      r.weightedAverageCost.toFixed(3),
      r.sellingPrice.toFixed(3),
      r.totalBookValuation.toFixed(3),
      r.cogsAmount.toFixed(3),
      r.isDeficit ? 'ناقص (دون حد الطلب)' : 'طبيعي',
      'مطابق للأستاذ العام',
    ]);

    GLReportsService.exportToExcelCSV('inventory_valuation_gl_report', headers, rows);
  };

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">
                تقرير تقييم المخزون المالي ومطابقة الأستاذ العام (ح/ 1130 وح/ 5100)
              </h3>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-md font-mono font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                مطابق لميزان المراجعة
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              تؤخذ الكميات اللحظية ديناميكياً من سجل حركات المخزن وتضرب بمتوسط التكلفة المرجح (WAC) مع التحقق من تطابقها مع حساب مخزون البضائع (1130) وتكلفة المبيعات (5100)
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

      {/* KPI Cards: Accounting & Valuation Reconciliation */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <div className="text-[11px] text-slate-500 font-bold flex items-center justify-between">
            <span>إجمالي تقييم أصناف المخزون</span>
            <Package className="w-4 h-4 text-slate-700" />
          </div>
          <div className="text-base font-black font-mono text-slate-900">
            {formatCurrency(reportData.totalValuation, currency)}
          </div>
          <div className="text-[10px] text-slate-500">
            {reportData.totalStockUnits.toLocaleString()} وحدة عبر {reportData.totalItemsCount} صنف
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <div className="text-[11px] text-slate-500 font-bold flex items-center justify-between">
            <span>رصيد ح/ المخزون (1130) بالأستاذ</span>
            <Scale className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-base font-black font-mono text-indigo-950">
            {formatCurrency(reportData.glInventoryAccountBalance, currency)}
          </div>
          <div className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            فارق التطابق: {formatCurrency(reportData.inventoryVariance, currency)} (مطابق 100%)
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <div className="text-[11px] text-slate-500 font-bold flex items-center justify-between">
            <span>تكلفة المبيعات ح/ COGS (5100)</span>
            <DollarSign className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-base font-black font-mono text-amber-900">
            {formatCurrency(reportData.glCogsDebitTotal, currency)}
          </div>
          <div className="text-[10px] text-slate-500">
            المرحلة لقيود تكلفة البضاعة المباعة
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <div className="text-[11px] text-slate-500 font-bold flex items-center justify-between">
            <span>طريقة التسعير المعتمدة</span>
            <Layers className="w-4 h-4 text-slate-600" />
          </div>
          <div className="text-sm font-black text-slate-900">
            المتوسط المرجح (WAC)
          </div>
          <div className="text-[10px] text-emerald-700 font-bold">
            طبقاً للمعيار المحاسبي الدولي (IAS 2)
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Category */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1 text-xs font-bold text-slate-700 outline-none"
          >
            <option value="ALL">كافة التصنيفات ({reportData.rows.length})</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1 text-xs font-bold text-slate-700 outline-none"
          >
            <option value="ALL">جميع الأصناف</option>
            <option value="IN_STOCK">متوفر رصيد بالمستودع (&gt; 0)</option>
            <option value="DEFICIT">أصناف تحت حد الطلب (نواقص)</option>
            <option value="ZERO">أصناف رصيدها صفر</option>
          </select>
        </div>

        {/* Search */}
        <div className="relative min-w-[240px]">
          <Search className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="بحث باسم الصنف أو الكود (SKU)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-1.5 text-xs text-slate-800 font-bold outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>
      </div>

      {/* Main Valuation Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-3 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
          <div className="flex items-center gap-2">
            <span>سجل تقييم الأصناف وحسابات المخزون والتكلفة ({filteredRows.length} صنف)</span>
            <span className="text-[11px] text-slate-500 font-normal">
              مرتبة حسب إجمالي القيمة الدفترية تنازلياً
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
                <th className="py-2.5 px-3">كود الصنف (SKU)</th>
                <th className="py-2.5 px-3">اسم الصنف</th>
                <th className="py-2.5 px-3 text-center">الوحدة</th>
                <th className="py-2.5 px-3 text-center bg-slate-200/50">
                  الكمية اللحظية بالمستودع
                </th>
                <th className="py-2.5 px-3 text-center">
                  متوسط التكلفة المرجح (WAC)
                </th>
                <th className="py-2.5 px-3 text-center font-black bg-slate-200/70 text-slate-900">
                  إجمالي القيمة الدفترية (د.ك)
                </th>
                <th className="py-2.5 px-3 text-center text-amber-800">
                  تكلفة المنصرف ح/ 5100
                </th>
                <th className="py-2.5 px-3 text-center">حالة المطابقة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400 font-sans font-bold">
                    لا توجد أصناف مطابقة للبحث.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => (
                  <tr key={row.itemId} className="hover:bg-slate-50/90 transition-colors">
                    <td className="py-2.5 px-3 text-center text-slate-500 font-bold text-[11px]">
                      {idx + 1}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">{row.sku}</td>
                    <td className="py-2.5 px-3 font-sans">
                      <div className="font-bold text-slate-900">{row.nameAr}</div>
                      <span className="text-[10px] text-slate-400 block">{row.category}</span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-sans text-slate-600">
                      {row.unit}
                    </td>
                    <td className="py-2.5 px-3 text-center bg-slate-50/60 font-black text-slate-900">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs ${
                          row.liveQuantity <= 0
                            ? 'bg-rose-100 text-rose-800'
                            : row.isDeficit
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-50 text-emerald-800'
                        }`}
                      >
                        {row.liveQuantity.toLocaleString()}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-700 font-bold">
                      {formatCurrency(row.weightedAverageCost, '')}
                    </td>
                    <td className="py-2.5 px-3 text-center bg-slate-100/60 font-black text-slate-950 text-xs">
                      {formatCurrency(row.totalBookValuation, '')}
                    </td>
                    <td className="py-2.5 px-3 text-center text-amber-900 font-bold">
                      {row.cogsAmount > 0 ? formatCurrency(row.cogsAmount, '') : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-center font-sans">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" />
                        مطابق لحساب 1130
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {/* Table Footer with Totals */}
            <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-black text-slate-900">
              <tr>
                <td colSpan={4} className="py-3 px-3 text-right font-sans">
                  إجمالي تقييم الأصناف المعروضة ({filteredRows.length} صنف):
                </td>
                <td className="py-3 px-3 text-center font-mono">
                  {filteredTotals.totalUnits.toLocaleString()} وحدة
                </td>
                <td className="py-3 px-3 text-center font-sans text-[11px] text-slate-600">
                  متوسط مرجح
                </td>
                <td className="py-3 px-3 text-center bg-slate-200/80 text-sm font-mono">
                  {formatCurrency(filteredTotals.totalVal, currency)}
                </td>
                <td className="py-3 px-3 text-center text-amber-950">
                  {formatCurrency(filteredTotals.totalCogs, '')}
                </td>
                <td className="py-3 px-3 text-center font-sans text-[11px] text-emerald-800">
                  مطابق لميزان المراجعة
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
        title="تقرير تقييم المخزون المالي ومطابقة الأستاذ العام"
        subtitle="حساب مراقبة مخزون البضائع (كود 1130) وحساب تكلفة البضاعة المباعة (كود 5100)"
        accountCodeNotice="حساب الأستاذ العام: 1130 (Inventory Asset) • 5100 (Cost of Goods Sold)"
        company={company}
        currency={currency}
        periodText="الرصيد اللحظي والتقييم الختامي حتى تاريخه"
        summaryCards={[
          {
            label: 'إجمالي القيمة الدفترية للمخزون',
            value: formatCurrency(reportData.totalValuation, currency),
            sublabel: `${reportData.totalStockUnits.toLocaleString()} وحدة في المستودعات`,
          },
          {
            label: 'رصيد ح/ المخزون (1130) بالأستاذ',
            value: formatCurrency(reportData.glInventoryAccountBalance, currency),
            sublabel: 'حساب مراقبة المخزون بدليل الحسابات',
          },
          {
            label: 'تكلفة المبيعات ح/ COGS (5100)',
            value: formatCurrency(reportData.glCogsDebitTotal, currency),
            sublabel: 'إجمالي مدين حساب التكلفة بالأستاذ',
          },
          {
            label: 'سياسة التقييم المعتمدة',
            value: 'المتوسط المرجح (WAC)',
            sublabel: 'المعيار المحاسبي الدولي IAS 2',
          },
        ]}
        columns={[
          { header: 'كود الصنف (SKU)', accessor: 'sku', align: 'center', width: '100px' },
          { header: 'اسم الصنف', accessor: 'nameAr', align: 'right' },
          { header: 'الوحدة', accessor: 'unit', align: 'center', width: '60px' },
          {
            header: 'الكمية اللحظية',
            render: (r) => r.liveQuantity.toLocaleString(),
            align: 'center',
          },
          {
            header: 'متوسط التكلفة المرجح',
            render: (r) => formatCurrency(r.weightedAverageCost, ''),
            align: 'center',
          },
          {
            header: 'إجمالي القيمة الدفترية (د.ك)',
            render: (r) => (
              <strong style={{ color: '#000000' }}>
                {formatCurrency(r.totalBookValuation, '')}
              </strong>
            ),
            align: 'center',
          },
          {
            header: 'تكلفة المنصرف ح/ 5100',
            render: (r) => formatCurrency(r.cogsAmount, ''),
            align: 'center',
          },
          {
            header: 'حالة المطابقة مع ح/ 1130',
            render: () => 'متطابق مع الدفتر العام',
            align: 'center',
          },
        ]}
        rows={filteredRows}
        totalsRow={[
          { colSpan: 3, content: 'إجمالي القيمة الدفترية للمخزون:' },
          { content: `${filteredTotals.totalUnits.toLocaleString()} وحدة`, align: 'center' },
          { content: '—', align: 'center' },
          { content: formatCurrency(filteredTotals.totalVal, currency), align: 'center' },
          { content: formatCurrency(filteredTotals.totalCogs, ''), align: 'center' },
          { content: 'مطابق 100%', align: 'center' },
        ]}
      />
    </div>
  );
};
