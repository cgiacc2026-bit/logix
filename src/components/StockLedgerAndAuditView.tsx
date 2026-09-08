import React, { useState, useMemo } from 'react';
import {
  InventoryItem,
  Invoice,
  ProductionOrder,
  StockMovement,
  StockMovementType,
} from '../types.js';
import { StockLedgerService } from '../services/stockLedgerService.ts';
import { formatCurrency } from '../utils/formatters.ts';
import {
  Package,
  Layers,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Search,
  Filter,
  ArrowDownRight,
  ArrowUpRight,
  RotateCcw,
  FileSpreadsheet,
  Printer,
  Calendar,
  Eye,
  SlidersHorizontal,
  DollarSign,
  ShieldCheck,
  Boxes,
  ClipboardList,
  Sparkles,
  X
} from 'lucide-react';

interface StockLedgerAndAuditViewProps {
  inventory: InventoryItem[];
  invoices: Invoice[];
  productionOrders: ProductionOrder[];
  currency: string;
  onRefreshData?: () => void;
}

export const StockLedgerAndAuditView: React.FC<StockLedgerAndAuditViewProps> = ({
  inventory,
  invoices,
  productionOrders,
  currency,
  onRefreshData,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'audit' | 'ledger' | 'reconcile'>('audit');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'LOW' | 'OUT' | 'SAFE' | 'EXCESS'>('ALL');
  const [movementTypeFilter, setMovementTypeFilter] = useState<string>('ALL');
  const [inspectedItem, setInspectedItem] = useState<InventoryItem | null>(null);

  // Reconciliation States
  const [reconcileItemId, setReconcileItemId] = useState<string>('');
  const [physicalCount, setPhysicalCount] = useState<number | ''>('');
  const [reconcileReason, setReconcileReason] = useState<string>('جرد دوري ربع سنوي');
  const [reconcileSuccess, setReconcileSuccess] = useState<string>('');
  const [isSubmittingReconcile, setIsSubmittingReconcile] = useState(false);

  // 1. Compute KPIs
  const auditSummary = useMemo(() => {
    return StockLedgerService.computeStockAudit(inventory);
  }, [inventory]);

  // 2. Compute Ledger Movements
  const movements = useMemo(() => {
    return StockLedgerService.getStockMovements(inventory, invoices, productionOrders);
  }, [inventory, invoices, productionOrders]);

  // 3. Filtered Inventory
  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      const matchesSearch =
        item.nameAr.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.barcode && item.barcode.includes(searchTerm));

      const matchesCat = selectedCategory === 'ALL' || item.category === selectedCategory;

      let matchesStatus = true;
      const minAlert = item.minQuantityAlert || 10;
      if (statusFilter === 'LOW') matchesStatus = item.quantityOnHand > 0 && item.quantityOnHand <= minAlert;
      if (statusFilter === 'OUT') matchesStatus = item.quantityOnHand <= 0;
      if (statusFilter === 'SAFE') matchesStatus = item.quantityOnHand > minAlert && item.quantityOnHand <= minAlert * 5;
      if (statusFilter === 'EXCESS') matchesStatus = item.quantityOnHand > minAlert * 5;

      return matchesSearch && matchesCat && matchesStatus;
    });
  }, [inventory, searchTerm, selectedCategory, statusFilter]);

  // 4. Filtered Movements
  const filteredMovements = useMemo(() => {
    return movements.filter((mv) => {
      const matchesSearch =
        mv.itemNameAr.toLowerCase().includes(searchTerm.toLowerCase()) ||
        mv.itemSku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        mv.referenceDocNumber.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesType = movementTypeFilter === 'ALL' || mv.type === movementTypeFilter;

      return matchesSearch && matchesType;
    });
  }, [movements, searchTerm, movementTypeFilter]);

  // Categories list
  const categories = useMemo(() => {
    return Array.from(new Set(inventory.map((i) => i.category || 'عام')));
  }, [inventory]);

  // Handle reconciliation
  const handleExecuteReconciliation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reconcileItemId || physicalCount === '') return;

    setIsSubmittingReconcile(true);
    setReconcileSuccess('');

    try {
      const res = await StockLedgerService.reconcileStock(
        reconcileItemId,
        Number(physicalCount),
        reconcileReason
      );

      if (res.success) {
        setReconcileSuccess(
          `تمت التسوية بنجاح! الفارق المسجل: (${res.difference > 0 ? '+' : ''}${res.difference} وحدة) وتم تحديث رصيد المستودع فورياً.`
        );
        setPhysicalCount('');
        if (onRefreshData) onRefreshData();
      }
    } catch (err) {
      console.error('Reconciliation error:', err);
    } finally {
      setIsSubmittingReconcile(false);
    }
  };

  // Export Ledger to CSV
  const handleExportCSV = () => {
    const headers = ['التاريخ', 'نوع الحركة', 'رقم المستند', 'الصنف', 'رمز الصنف', 'وارد', 'منصرف', 'الرصيد اللحظي', 'التكلفة', 'القيمة'];
    const rows = filteredMovements.map((m) => [
      m.date,
      m.typeTitleAr,
      m.referenceDocNumber,
      `"${m.itemNameAr}"`,
      m.itemSku,
      m.quantityIn,
      m.quantityOut,
      m.balanceAfter,
      m.unitCost,
      m.totalCostValue,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Stock_Ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Title */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-6 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 border border-slate-700">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> نظام تدقيق المخزون المتقدم (معيار ERPNext / IFRS)
            </span>
          </div>
          <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
            <Boxes className="w-6 h-6 text-amber-400" />
            فحص المخزون، تقييم التكلفة، ودفتر حركة الأصناف التراكمي
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            مراقبة كميات المستودع، أرصدة الشد، متوسط التكلفة المرجح، وتتبع سجل كل حركة وارد ومنصرف لحظياً
          </p>
        </div>

        {/* Sub-tab switcher */}
        <div className="flex flex-wrap items-center gap-2 bg-slate-800/80 p-1.5 rounded-xl border border-slate-700">
          <button
            onClick={() => setActiveSubTab('audit')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'audit'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>فحص وتقييم المخزون</span>
          </button>

          <button
            onClick={() => setActiveSubTab('ledger')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'ledger'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            <span>دفتر أستاذ المخزون (Ledger)</span>
          </button>

          <button
            onClick={() => setActiveSubTab('reconcile')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'reconcile'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>التسوية الجردية وفروقات الجرد</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>القيمة الدفترية (سعر التكلفة)</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-lg font-black text-slate-900">
            {formatCurrency(auditSummary.totalValuationAtCost, currency)}
          </div>
          <div className="text-[11px] text-emerald-600 font-bold mt-1">
            إجمالي {auditSummary.totalUnitsInStock.toLocaleString()} وحدة مخزنة
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>القيمة البيعية التقديرية</span>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-lg font-black text-slate-900">
            {formatCurrency(auditSummary.totalValuationAtSale, currency)}
          </div>
          <div className="text-[11px] text-blue-600 font-bold mt-1">
            هامش ربح متوقع: {auditSummary.expectedGrossMarginPct.toFixed(1)}%
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>الربح الإجمالي المتوقع</span>
            <Package className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-lg font-black text-slate-900">
            {formatCurrency(auditSummary.expectedGrossProfit, currency)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            بناءً على أسعار البيع الحالية
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>حالة وسلامة الأصناف</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold text-xs border border-emerald-200">
              {auditSummary.safeStockCount} آمن
            </span>
            <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-bold text-xs border border-amber-200">
              {auditSummary.lowStockCount} منخفض
            </span>
            <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 font-bold text-xs border border-rose-200">
              {auditSummary.outOfStockCount} نفاد
            </span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            إجمالي {auditSummary.totalItemCount} صنف مسجل
          </div>
        </div>
      </div>

      {/* VIEW 1: AUDIT & STOCK HEALTH */}
      {activeSubTab === 'audit' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          {/* Controls */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex flex-wrap items-center gap-2">
              {/* Category */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-xs font-bold text-slate-800 outline-none"
              >
                <option value="ALL">جميع التصنيفات ({categories.length})</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              {/* Status */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-xs font-bold text-slate-800 outline-none"
              >
                <option value="ALL">جميع الحالات</option>
                <option value="LOW">أصناف قاربت على النفاد (تحت حد الطلب)</option>
                <option value="OUT">أصناف منعدمة الرصيد (0 أو سالب)</option>
                <option value="SAFE">أصناف بمستوى آمن وطبيعي</option>
                <option value="EXCESS">أصناف بمستوى مرتفع / راكد</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="بحث باسم الصنف، الباركود، أو SKU..."
                  className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <button
                onClick={() => window.print()}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                title="طباعة تقرير جرد المخزون"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة</span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3">الرمز / SKU</th>
                  <th className="py-3 px-3">اسم الصنف والمنتج</th>
                  <th className="py-3 px-3">التصنيف</th>
                  <th className="py-3 px-3 text-center">الرصيد الحالي</th>
                  <th className="py-3 px-3 text-center">حاسبة الشد والكرتون</th>
                  <th className="py-3 px-3">سعر التكلفة</th>
                  <th className="py-3 px-3">إجمالي القيمة الدفترية</th>
                  <th className="py-3 px-3">سعر البيع</th>
                  <th className="py-3 px-3 text-center">حالة الصنف</th>
                  <th className="py-3 px-3 text-center">فحص وتحليل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInventory.map((item) => {
                  const qty = item.quantityOnHand || 0;
                  const cost = item.purchasePrice || 0;
                  const totalValuation = qty * cost;
                  const minAlert = item.minQuantityAlert || 10;
                  const isLow = qty > 0 && qty <= minAlert;
                  const isOut = qty <= 0;
                  const packs = item.unitsPerPack > 1 ? Math.floor(qty / item.unitsPerPack) : 0;
                  const rem = item.unitsPerPack > 1 ? qty % item.unitsPerPack : 0;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-amber-700">{item.sku}</td>
                      <td className="py-3 px-3 font-bold text-slate-900">
                        <div>{item.nameAr}</div>
                        {item.barcode && <div className="text-[10px] text-slate-400 font-mono">باركود: {item.barcode}</div>}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[11px]">
                          {item.category || 'عام'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-extrabold text-sm">
                        <span className={isOut ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-slate-900'}>
                          {qty} {item.unit || 'حبة'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {item.unitsPerPack > 1 ? (
                          <div className="text-[11px] text-slate-700">
                            <span className="font-bold text-indigo-700">{packs}</span> {item.packUnit || 'كرتون'}
                            {rem > 0 && <span className="text-slate-500"> + {rem} {item.unit}</span>}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-700">{formatCurrency(cost, currency)}</td>
                      <td className="py-3 px-3 font-bold text-emerald-700">{formatCurrency(totalValuation, currency)}</td>
                      <td className="py-3 px-3 font-bold text-slate-900">{formatCurrency(item.salePrice || 0, currency)}</td>
                      <td className="py-3 px-3 text-center">
                        {isOut ? (
                          <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 font-bold text-[10px] border border-rose-200">
                            منعدم الرصيد
                          </span>
                        ) : isLow ? (
                          <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-bold text-[10px] border border-amber-200">
                            تحت حد الطلب
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-200">
                            رصيد آمن
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => setInspectedItem(item)}
                          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-bold text-xs transition-all flex items-center gap-1 mx-auto cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>كارت الصنف</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: STOCK LEDGER */}
      {activeSubTab === 'ledger' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-amber-500" />
                دفتر أستاذ المخزون التراكمي (Chronological Stock Ledger)
              </h3>
              <p className="text-xs text-slate-500">
                سجل إلكتروني يوثق كل إضافة وصرف وتسوية جردية مع الرصيد اللحظي التراكمي
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={movementTypeFilter}
                onChange={(e) => setMovementTypeFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-xs font-bold text-slate-800 outline-none"
              >
                <option value="ALL">جميع أنواع الحركات ({movements.length})</option>
                <option value="OPENING">أرصدة افتتاحية</option>
                <option value="SALES_ISSUE">فواتير مبيعات (صرف)</option>
                <option value="PRODUCTION_IN">إنتاج مطحنة تام الصنع (توريد)</option>
                <option value="PRODUCTION_OUT">استهلاك مواد أولية (طحن)</option>
                <option value="STOCK_ADJUSTMENT">تسويات جردية</option>
              </select>

              <button
                onClick={handleExportCSV}
                className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
                <span>تصدير Excel / CSV</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3">التاريخ والوقت</th>
                  <th className="py-3 px-3">نوع الحركة</th>
                  <th className="py-3 px-3">رقم المستند</th>
                  <th className="py-3 px-3">رمز الصنف</th>
                  <th className="py-3 px-3">اسم الصنف والمنتج</th>
                  <th className="py-3 px-3 text-center text-emerald-700">وارد (+)</th>
                  <th className="py-3 px-3 text-center text-rose-700">منصرف (-)</th>
                  <th className="py-3 px-3 text-center font-black">الرصيد التراكمي</th>
                  <th className="py-3 px-3">متوسط التكلفة</th>
                  <th className="py-3 px-3">إجمالي القيمة</th>
                  <th className="py-3 px-3">ملاحظات المستودع</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {filteredMovements.map((mv) => (
                  <tr key={mv.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                      {mv.date} {mv.time && <span className="text-[10px] text-slate-400">({mv.time})</span>}
                    </td>
                    <td className="py-2.5 px-3 font-sans font-bold">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] ${
                          mv.quantityIn > 0
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {mv.typeTitleAr}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-bold text-indigo-700 whitespace-nowrap">
                      {mv.referenceDocNumber}
                    </td>
                    <td className="py-2.5 px-3 text-amber-700 font-bold">{mv.itemSku}</td>
                    <td className="py-2.5 px-3 font-sans font-bold text-slate-900">{mv.itemNameAr}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-emerald-700">
                      {mv.quantityIn > 0 ? `+${mv.quantityIn} ${mv.unit}` : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-rose-600">
                      {mv.quantityOut > 0 ? `-${mv.quantityOut} ${mv.unit}` : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-center font-black text-slate-900 bg-slate-50/50">
                      {mv.balanceAfter} {mv.unit}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700">{formatCurrency(mv.unitCost, currency)}</td>
                    <td className="py-2.5 px-3 font-bold text-emerald-800">{formatCurrency(mv.totalCostValue, currency)}</td>
                    <td className="py-2.5 px-3 font-sans text-slate-500 text-[11px] max-w-xs truncate">
                      {mv.notes || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 3: RECONCILIATION */}
      {activeSubTab === 'reconcile' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-amber-500" />
              محضر التسوية الجردية وفروقات المخزون (Physical Inventory Reconciliation)
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              تسجيل نتيجة العد الفعلي بالمستودع ومطابقتها مع الرصيد الدفتري لتوليد قيود التسوية آلياً
            </p>
          </div>

          {reconcileSuccess && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{reconcileSuccess}</span>
            </div>
          )}

          <form onSubmit={handleExecuteReconciliation} className="max-w-2xl space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">اختر الصنف المراد تسويته:</label>
              <select
                value={reconcileItemId}
                onChange={(e) => setReconcileItemId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-amber-500"
                required
              >
                <option value="">-- اختر الصنف من القائمة --</option>
                {inventory.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nameAr} ({item.sku}) - الرصيد الدفتري: {item.quantityOnHand} {item.unit || 'حبة'}
                  </option>
                ))}
              </select>
            </div>

            {reconcileItemId && (() => {
              const selectedItem = inventory.find((i) => i.id === reconcileItemId);
              if (!selectedItem) return null;
              const bookQty = selectedItem.quantityOnHand || 0;
              const actual = physicalCount !== '' ? Number(physicalCount) : bookQty;
              const diff = actual - bookQty;
              const unitCost = selectedItem.purchasePrice || 0;
              const diffVal = Math.abs(diff) * unitCost;

              return (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2 bg-white rounded-lg border">
                      <span className="text-slate-400 block text-[10px]">الرصيد الدفتري بالنظام:</span>
                      <span className="font-extrabold text-sm text-slate-900">{bookQty} {selectedItem.unit}</span>
                    </div>
                    <div className="p-2 bg-white rounded-lg border">
                      <span className="text-slate-400 block text-[10px]">فارق الجرد الفعلي:</span>
                      <span className={`font-extrabold text-sm ${diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                        {diff > 0 ? `+${diff}` : diff} {selectedItem.unit}
                      </span>
                    </div>
                    <div className="p-2 bg-white rounded-lg border">
                      <span className="text-slate-400 block text-[10px]">القيمة المالية للفارق:</span>
                      <span className="font-extrabold text-sm text-indigo-700">{formatCurrency(diffVal, currency)}</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">الكمية الفعلية بالجرد بالمستودع:</label>
              <input
                type="number"
                step="any"
                value={physicalCount}
                onChange={(e) => setPhysicalCount(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="أدخل ناتج الجرد الفعلي..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-amber-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">سبب أو مبرر التسوية:</label>
              <input
                type="text"
                value={reconcileReason}
                onChange={(e) => setReconcileReason(e.target.value)}
                placeholder="مثال: تلف أثناء التخزين، بضاعة منتهية الصلاحية، خطأ فواتير سابقة..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmittingReconcile || !reconcileItemId || physicalCount === ''}
              className="px-5 py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{isSubmittingReconcile ? 'جارٍ تسجيل التسوية...' : 'اعتماد وترحيل التسوية الجردية'}</span>
            </button>
          </form>
        </div>
      )}

      {/* INSPECTED ITEM MODAL */}
      {inspectedItem && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-mono font-bold text-amber-700 px-2 py-0.5 bg-amber-50 rounded">
                  {inspectedItem.sku}
                </span>
                <h3 className="text-base font-black text-slate-900 mt-1">{inspectedItem.nameAr}</h3>
              </div>
              <button
                onClick={() => setInspectedItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border">
                <span className="text-slate-400 block text-[10px]">الرصيد الحالي:</span>
                <span className="font-extrabold text-slate-900 text-sm">
                  {inspectedItem.quantityOnHand} {inspectedItem.unit}
                </span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border">
                <span className="text-slate-400 block text-[10px]">سعر التكلفة:</span>
                <span className="font-extrabold text-slate-900 text-sm">
                  {formatCurrency(inspectedItem.purchasePrice, currency)}
                </span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border">
                <span className="text-slate-400 block text-[10px]">سعر البيع:</span>
                <span className="font-extrabold text-emerald-700 text-sm">
                  {formatCurrency(inspectedItem.salePrice, currency)}
                </span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border">
                <span className="text-slate-400 block text-[10px]">إجمالي التقييم:</span>
                <span className="font-extrabold text-indigo-700 text-sm">
                  {formatCurrency((inspectedItem.quantityOnHand || 0) * (inspectedItem.purchasePrice || 0), currency)}
                </span>
              </div>
            </div>

            {/* Movement Timeline for this item */}
            <div>
              <h4 className="text-xs font-bold text-slate-800 mb-2">سجل حركات هذا الصنف:</h4>
              <div className="max-h-60 overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-100 text-xs">
                {movements
                  .filter((m) => m.itemId === inspectedItem.id)
                  .map((m) => (
                    <div key={m.id} className="p-2.5 flex items-center justify-between hover:bg-slate-50">
                      <div>
                        <span className="font-bold text-slate-900">{m.typeTitleAr}</span>
                        <span className="text-[11px] text-slate-400 mr-2 font-mono">({m.referenceDocNumber})</span>
                        <div className="text-[10px] text-slate-500">{m.date} - {m.notes}</div>
                      </div>
                      <div className="text-left font-mono">
                        <span className={`font-bold ${m.quantityIn > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {m.quantityIn > 0 ? `+${m.quantityIn}` : `-${m.quantityOut}`} {m.unit}
                        </span>
                        <div className="text-[10px] text-slate-400">الرصيد بعد: {m.balanceAfter}</div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setInspectedItem(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
