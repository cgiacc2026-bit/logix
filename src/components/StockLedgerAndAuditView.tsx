import React, { useState, useMemo, useCallback } from 'react';
import {
  InventoryItem,
  Invoice,
  ProductionOrder,
  StockMovement,
  StockMovementType,
} from '../types.js';
import { StockLedgerService } from '../services/stockLedgerService.ts';
import { formatCurrency } from '../utils/formatters.ts';
import { resolveActiveCompany } from '../utils/companyResolver.ts';
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
  X,
  FileCheck2,
  Tag,
  Check
} from 'lucide-react';

interface StockLedgerAndAuditViewProps {
  inventory: InventoryItem[];
  invoices: Invoice[];
  productionOrders: ProductionOrder[];
  currency: string;
  onRefreshData?: () => void;
  initialItemId?: string;
  initialSubTab?: 'audit' | 'ledger' | 'item_card' | 'reconcile';
}

export const StockLedgerAndAuditView: React.FC<StockLedgerAndAuditViewProps> = ({
  inventory,
  invoices,
  productionOrders,
  currency,
  onRefreshData,
  initialItemId,
  initialSubTab,
}) => {
  const activeCompany = resolveActiveCompany(null, inventory[0]?.companyId || inventory[0]?.company_id);

  const [activeSubTab, setActiveSubTab] = useState<'audit' | 'ledger' | 'item_card' | 'reconcile'>(
    initialSubTab || (initialItemId ? 'item_card' : 'audit')
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'LOW' | 'OUT' | 'SAFE' | 'EXCESS'>('ALL');
  const [movementTypeFilter, setMovementTypeFilter] = useState<string>('ALL');
  const [inspectedItem, setInspectedItem] = useState<InventoryItem | null>(null);

  // Item Card State
  const [selectedCardItemId, setSelectedCardItemId] = useState<string>(initialItemId || inventory[0]?.id || '');

  React.useEffect(() => {
    if (initialItemId) {
      setSelectedCardItemId(initialItemId);
      if (!initialSubTab) {
        setActiveSubTab('item_card');
      }
    }
  }, [initialItemId]);

  React.useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  const [selectedItemForPrintCard, setSelectedItemForPrintCard] = useState<InventoryItem | null>(null);

  // Reconciliation States
  const [reconcileItemId, setReconcileItemId] = useState<string>('');
  const [reconcileMode, setReconcileMode] = useState<'PHYSICAL_COUNT' | 'DIRECT_ADJUSTMENT'>('PHYSICAL_COUNT');
  const [physicalCount, setPhysicalCount] = useState<number | ''>('');
  const [directDelta, setDirectDelta] = useState<number | ''>('');
  const [reconcileReason, setReconcileReason] = useState<string>('جرد دوري ربع سنوي');
  const [reconcileSuccess, setReconcileSuccess] = useState<string>('');
  const [isSubmittingReconcile, setIsSubmittingReconcile] = useState(false);

  // 1. Compute Ledger Movements (Synthesized from Opening, Sales, Purchases, Returns & Production)
  const movements = useMemo(() => {
    return StockLedgerService.getStockMovements(inventory, invoices, productionOrders);
  }, [inventory, invoices, productionOrders]);

  // 2. Dynamic Live Running Balance Map (Calculated strictly from movements array via cumulative reduce)
  const itemLiveBalances = useMemo(() => {
    const map = new Map<string, number>();

    inventory.forEach((item) => {
      const itemMvs = movements.filter(
        (m) => m.itemId === item.id || (item.sku && m.itemSku === item.sku)
      );

      if (itemMvs.length > 0) {
        const sorted = [...itemMvs].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        const hasOpening = sorted.some((m) => m.type === 'OPENING');
        const openingBalance = hasOpening
          ? 0
          : Number(item.initialQuantity ?? item.quantityOnHand ?? 0);

        const liveBal = sorted.reduce((acc, row) => {
          const qtyIn = Number(row.qty_in ?? row.quantityIn ?? 0);
          const qtyOut = Number(row.qty_out ?? row.quantityOut ?? 0);
          return acc + qtyIn - qtyOut;
        }, openingBalance);

        const finalBal =
          sorted[sorted.length - 1].balanceAfter !== undefined
            ? sorted[sorted.length - 1].balanceAfter
            : liveBal;

        map.set(item.id, finalBal);
      } else {
        map.set(item.id, Number(item.quantityOnHand || 0));
      }
    });

    return map;
  }, [inventory, movements]);

  // Helper to retrieve dynamic live balance for any inventory item
  const getItemLiveBalance = useCallback(
    (item: InventoryItem | null | undefined): number => {
      if (!item) return 0;
      if (itemLiveBalances.has(item.id)) {
        return itemLiveBalances.get(item.id)!;
      }
      const itemMvs = movements.filter(
        (m) => m.itemId === item.id || (item.sku && m.itemSku === item.sku)
      );
      if (itemMvs.length === 0) return Number(item.quantityOnHand || 0);
      const sorted = [...itemMvs].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      const hasOpening = sorted.some((m) => m.type === 'OPENING');
      const openingBalance = hasOpening
        ? 0
        : Number(item.initialQuantity ?? item.quantityOnHand ?? 0);
      const liveBal = sorted.reduce((acc, row) => {
        const qtyIn = Number(row.qty_in ?? row.quantityIn ?? 0);
        const qtyOut = Number(row.qty_out ?? row.quantityOut ?? 0);
        return acc + qtyIn - qtyOut;
      }, openingBalance);
      return sorted[sorted.length - 1]?.balanceAfter !== undefined
        ? sorted[sorted.length - 1].balanceAfter
        : liveBal;
    },
    [itemLiveBalances, movements]
  );

  // 3. Compute KPIs using live dynamic balances
  const auditSummary = useMemo(() => {
    const inventoryWithLiveBalances = inventory.map((it) => ({
      ...it,
      quantityOnHand: itemLiveBalances.get(it.id) ?? it.quantityOnHand,
    }));
    return StockLedgerService.computeStockAudit(inventoryWithLiveBalances);
  }, [inventory, itemLiveBalances]);

  // 4. Filtered Inventory using live dynamic balances
  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      const matchesSearch =
        item.nameAr.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.barcode && item.barcode.includes(searchTerm));

      const matchesCat = selectedCategory === 'ALL' || item.category === selectedCategory;

      let matchesStatus = true;
      const minAlert = item.minQuantityAlert || 10;
      const liveQty = getItemLiveBalance(item);
      if (statusFilter === 'LOW') matchesStatus = liveQty > 0 && liveQty <= minAlert;
      if (statusFilter === 'OUT') matchesStatus = liveQty <= 0;
      if (statusFilter === 'SAFE') matchesStatus = liveQty > minAlert && liveQty <= minAlert * 5;
      if (statusFilter === 'EXCESS') matchesStatus = liveQty > minAlert * 5;

      return matchesSearch && matchesCat && matchesStatus;
    });
  }, [inventory, searchTerm, selectedCategory, statusFilter, getItemLiveBalance]);

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
    if (!reconcileItemId) return;
    if (reconcileMode === 'PHYSICAL_COUNT' && physicalCount === '') return;
    if (reconcileMode === 'DIRECT_ADJUSTMENT' && directDelta === '') return;

    const selectedItem = inventory.find((i) => i.id === reconcileItemId);
    const valueToPass = reconcileMode === 'DIRECT_ADJUSTMENT' ? Number(directDelta) : Number(physicalCount);

    setIsSubmittingReconcile(true);
    setReconcileSuccess('');

    try {
      const res = await StockLedgerService.reconcileStock(
        reconcileItemId,
        valueToPass,
        reconcileReason,
        'مدير المستودع',
        reconcileMode
      );

      if (res.success) {
        const diffSign = res.difference > 0 ? '+' : '';
        const unitName = selectedItem?.unit || 'حبة';
        setReconcileSuccess(
          `تمت التسوية بنجاح! حركة التسوية: (${diffSign}${res.difference} ${unitName}) | الرصيد المعتمد الجديد: (${res.newBalance} ${unitName}). تم ترحيل الأثر إلى دفتر الأستاذ، أرصدة المستودع، وإثبات القيد المحاسبي آلياً.`
        );
        setPhysicalCount('');
        setDirectDelta('');
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
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-6 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 border border-slate-700 no-print">
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
            onClick={() => setActiveSubTab('item_card')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'item_card'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <Tag className="w-4 h-4" />
            <span>كارت حركة الصنف التفصيلي</span>
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

      {/* KPI Cards - Structured with Clear Visual Hierarchy */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: القيمة الدفترية (Neutral) */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-bold">القيمة الدفترية (سعر التكلفة)</span>
            <DollarSign className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-lg font-bold font-mono text-slate-800 mt-2">
            {formatCurrency(auditSummary.totalValuationAtCost, currency)}
          </div>
          <div className="text-[11px] text-slate-400 font-semibold mt-1">
            إجمالي {auditSummary.totalUnitsInStock.toLocaleString()} وحدة مخزنة
          </div>
        </div>

        {/* Card 2: القيمة البيعية التقديرية (Neutral) */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-bold">القيمة البيعية التقديرية</span>
            <Package className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-lg font-bold font-mono text-slate-800 mt-2">
            {formatCurrency(auditSummary.totalValuationAtSale, currency)}
          </div>
          <div className="text-[11px] text-slate-400 font-semibold mt-1">
            بناءً على قائمة أسعار البيع الحالية
          </div>
        </div>

        {/* Card 3: HERO METRIC 1 - الربح الإجمالي المتوقع */}
        <div className="bg-gradient-to-br from-emerald-50/70 via-teal-50/20 to-white border-2 border-emerald-500 rounded-xl p-4 shadow-xs ring-2 ring-emerald-500/10 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-emerald-950">الربح الإجمالي المتوقع</span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white font-bold text-[9px]">
              هامش {auditSummary.expectedGrossMarginPct.toFixed(1)}%
            </span>
          </div>
          <div className="text-xl font-black font-mono text-emerald-950 mt-1.5">
            {formatCurrency(auditSummary.expectedGrossProfit, currency)}
          </div>
          <div className="text-[11px] text-emerald-700 font-bold mt-1">
            العائد الربحي المتوقع عند تصريف المخزون
          </div>
        </div>

        {/* Card 4: HERO METRIC 2 - حالة وسلامة الأصناف */}
        <div className="bg-gradient-to-br from-amber-50/80 via-white to-amber-50/30 border-2 border-amber-400 rounded-xl p-4 shadow-xs ring-2 ring-amber-400/15 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-amber-950">حالة وسلامة الأصناف</span>
              <span className="px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-black text-[9px]">
                فحص المخزون
              </span>
            </div>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-black text-xs border border-emerald-200">
              {auditSummary.safeStockCount} آمن
            </span>
            <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-black text-xs border border-amber-300">
              {auditSummary.lowStockCount} منخفض
            </span>
            <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-black text-xs border border-rose-200">
              {auditSummary.outOfStockCount} نفاد
            </span>
          </div>
          <div className="text-[11px] text-slate-500 font-semibold mt-1">
            إجمالي {auditSummary.totalItemCount} صنف مسجل بالمستودع
          </div>
        </div>
      </div>

      {/* VIEW 1: AUDIT & STOCK HEALTH */}
      {activeSubTab === 'audit' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          {/* Controls */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 border-b border-slate-100 pb-4 no-print">
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
                  const qty = getItemLiveBalance(item);
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

      {/* VIEW 3: ITEM CARD (حركة مخزنية لكل صنف) */}
      {activeSubTab === 'item_card' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Tag className="w-4 h-4 text-amber-600" />
                  بطاقة حركة الصنف التفصيلية (Item Stock Movement Card)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  دفتر أستاذ تحليلي مخصص لكل صنف يعرض الأرصدة الافتتاحية والوارد والمنصرف والرصيد اللحظي التراكمي
                </p>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <select
                  value={selectedCardItemId}
                  onChange={(e) => setSelectedCardItemId(e.target.value)}
                  className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-amber-500 w-full sm:w-72"
                >
                  {inventory.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.nameAr} ({it.sku}) - الرصيد: {getItemLiveBalance(it)} {it.unit || 'حبة'}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => {
                    const it = inventory.find((i) => i.id === selectedCardItemId) || inventory[0];
                    setSelectedItemForPrintCard(it);
                  }}
                  className="px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-xs transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>طباعة كارت الصنف</span>
                </button>
              </div>
            </div>

            {/* Item Card Overview Box */}
            {(() => {
              const currentItem = inventory.find((i) => i.id === selectedCardItemId) || inventory[0];
              if (!currentItem) return null;

              // Filter movements for this specific item (matching by ID or SKU)
              const itemMvs = movements.filter(
                (m) => m.itemId === currentItem.id || (currentItem.sku && m.itemSku === currentItem.sku)
              );

              // Chronological sort ascending to guarantee strict sequential integrity
              const sortedMvs = [...itemMvs].sort(
                (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
              );

              // Determine opening balance:
              // If an OPENING movement exists in the array, cumulative accumulation starts at 0.
              // Otherwise, start from item's opening balance.
              const hasOpeningMovement = sortedMvs.some((m) => m.type === 'OPENING');
              const openingBalance = hasOpeningMovement
                ? 0
                : Number(currentItem.initialQuantity ?? currentItem.quantityOnHand ?? 0);

              // 1. Cumulative reduce calculation exactly as required by formula:
              const liveBalance = sortedMvs.length > 0
                ? sortedMvs.reduce((acc, row) => {
                    const qtyIn = Number(row.qty_in ?? row.quantityIn ?? 0);
                    const qtyOut = Number(row.qty_out ?? row.quantityOut ?? 0);
                    return acc + qtyIn - qtyOut;
                  }, openingBalance)
                : Number(currentItem.quantityOnHand || 0);

              // 2. Final running balance from the last chronological movement row:
              const finalRunningBalance =
                sortedMvs.length > 0 && sortedMvs[sortedMvs.length - 1].balanceAfter !== undefined
                  ? sortedMvs[sortedMvs.length - 1].balanceAfter
                  : liveBalance;

              // Total In & Out
              const totalIn = sortedMvs.reduce((acc, m) => acc + Number(m.qty_in ?? m.quantityIn ?? 0), 0);
              const totalOut = sortedMvs.reduce((acc, m) => acc + Number(m.qty_out ?? m.quantityOut ?? 0), 0);

              // The active display balance (368 حبة) strictly derived from movements:
              const runningBal = finalRunningBalance;

              return (
                <div className="space-y-4">
                  {/* Detailed Specs Grid with Hierarchy */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {/* Item Basic Info */}
                    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
                      <span className="text-[10px] text-slate-500 block font-bold">اسم الصنف:</span>
                      <span className="text-xs font-black text-slate-900 truncate block mt-0.5">{currentItem.nameAr}</span>
                      <span className="text-[10px] font-mono text-slate-400 block">{currentItem.sku}</span>
                    </div>

                    {/* Category & Unit */}
                    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
                      <span className="text-[10px] text-slate-500 block font-bold">التصنيف والوحدة:</span>
                      <span className="text-xs font-bold text-slate-800 block mt-0.5">{currentItem.category || 'مواد غذائية'}</span>
                      <span className="text-[10px] text-slate-500 block">وحدة القياس: {currentItem.unit || 'حبة'}</span>
                    </div>

                    {/* Total In */}
                    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
                      <span className="text-[10px] text-slate-500 block font-bold">إجمالي الوارد (+):</span>
                      <span className="text-xs font-black text-emerald-700 block mt-0.5">
                        +{totalIn.toLocaleString()} {currentItem.unit}
                      </span>
                      <span className="text-[10px] text-slate-400">حركات الإضافة</span>
                    </div>

                    {/* Total Out */}
                    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
                      <span className="text-[10px] text-slate-500 block font-bold">إجمالي المنصرف (-):</span>
                      <span className="text-xs font-black text-rose-700 block mt-0.5">
                        -{totalOut.toLocaleString()} {currentItem.unit}
                      </span>
                      <span className="text-[10px] text-slate-400">فواتير الصرف</span>
                    </div>

                    {/* HERO METRIC: Current Stock Balance */}
                    <div className="bg-gradient-to-br from-amber-50 to-amber-100/70 p-3 rounded-xl border-2 border-amber-400 shadow-xs ring-2 ring-amber-400/15 flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-amber-900 block font-black">الرصيد الفعلي الحالي:</span>
                        <span className="px-1 py-0.2 rounded bg-amber-500 text-slate-950 font-black text-[8px]">الرصيد</span>
                      </div>
                      <span className="text-base sm:text-lg font-black text-amber-950 font-mono block mt-0.5">
                        {runningBal.toLocaleString()} {currentItem.unit}
                      </span>
                      <span className="text-[10px] text-amber-800/80 font-bold">بالمستودع الرئيسي</span>
                    </div>

                    {/* Valuation Metric */}
                    <div className="bg-gradient-to-br from-indigo-50/70 to-white p-3 rounded-xl border border-indigo-200 shadow-2xs flex flex-col justify-between">
                      <span className="text-[10px] text-indigo-900 block font-bold">إجمالي التقييم المالي:</span>
                      <span className="text-xs font-black text-indigo-950 font-mono block mt-0.5">
                        {formatCurrency(runningBal * (currentItem.purchasePrice || (currentItem as any).costPrice || 0), currency)}
                      </span>
                      <span className="text-[10px] text-indigo-600/80">بسعر التكلفة المرجح</span>
                    </div>
                  </div>

                  {/* Movements Table for this specific item */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
                      <span>سجل حركات الصنف ({sortedMvs.length} حركة مسجلة)</span>
                      <span className="text-[11px] text-slate-500 font-normal">مرتبة ترتيباً زمنياً تصاعدياً</span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3">التاريخ</th>
                            <th className="py-2.5 px-3">نوع الحركة</th>
                            <th className="py-2.5 px-3">رقم المستند</th>
                            <th className="py-2.5 px-3 text-center text-emerald-700">وارد (+)</th>
                            <th className="py-2.5 px-3 text-center text-rose-700">منصرف (-)</th>
                            <th className="py-2.5 px-3 text-center font-black bg-slate-200/50">الرصيد التراكمي</th>
                            <th className="py-2.5 px-3">سعر الوحدة</th>
                            <th className="py-2.5 px-3">إجمالي القيمة</th>
                            <th className="py-2.5 px-3">البيان والملاحظات</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono">
                          {sortedMvs.length === 0 ? (
                            <tr>
                              <td colSpan={9} className="p-6 text-center text-slate-400 font-sans font-bold">
                                لا توجد حركات مسجلة لهذا الصنف حتى الآن.
                              </td>
                            </tr>
                          ) : (
                            sortedMvs.map((m) => (
                              <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                                <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">{m.date}</td>
                                <td className="py-2.5 px-3 font-sans">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      (m.qty_in ?? m.quantityIn) > 0
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                                    }`}
                                  >
                                    {m.typeTitleAr}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-indigo-700 font-bold whitespace-nowrap">
                                  {m.referenceDocNumber}
                                </td>
                                <td className="py-2.5 px-3 text-center font-bold text-emerald-700">
                                  {(m.qty_in ?? m.quantityIn) > 0 ? `+${m.qty_in ?? m.quantityIn}` : '-'}
                                </td>
                                <td className="py-2.5 px-3 text-center font-bold text-rose-600">
                                  {(m.qty_out ?? m.quantityOut) > 0 ? `-${m.qty_out ?? m.quantityOut}` : '-'}
                                </td>
                                <td className="py-2.5 px-3 text-center font-black text-slate-900 bg-slate-50">
                                  {m.balanceAfter} {m.unit}
                                </td>
                                <td className="py-2.5 px-3 text-slate-600">{formatCurrency(m.unitCost, currency)}</td>
                                <td className="py-2.5 px-3 font-bold text-slate-800">
                                  {formatCurrency(m.totalCostValue, currency)}
                                </td>
                                <td className="py-2.5 px-3 font-sans text-slate-500 text-[11px]">{m.notes || '-'}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* VIEW 4: RECONCILIATION */}
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

          <form onSubmit={handleExecuteReconciliation} className="max-w-3xl space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">اختر الصنف المراد تسويته:</label>
              <select
                value={reconcileItemId}
                onChange={(e) => {
                  setReconcileItemId(e.target.value);
                  setPhysicalCount('');
                  setDirectDelta('');
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-amber-500"
                required
              >
                <option value="">-- اختر الصنف من القائمة --</option>
                {inventory.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nameAr} ({item.sku}) - الرصيد الدفتري اللحظي: {getItemLiveBalance(item)} {item.unit || 'حبة'}
                  </option>
                ))}
              </select>
            </div>

            {/* Reconciliation Mode Switcher */}
            <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200">
              <button
                type="button"
                onClick={() => setReconcileMode('PHYSICAL_COUNT')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  reconcileMode === 'PHYSICAL_COUNT'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                1. جرد فعلي على الرف (Physical Stock Count)
              </button>
              <button
                type="button"
                onClick={() => setReconcileMode('DIRECT_ADJUSTMENT')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  reconcileMode === 'DIRECT_ADJUSTMENT'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                2. تسوية مباشرة بالكمية (Direct Adjustment +/-)
              </button>
            </div>

            {reconcileItemId && (() => {
              const selectedItem = inventory.find((i) => i.id === reconcileItemId);
              if (!selectedItem) return null;
              const bookQty = getItemLiveBalance(selectedItem);
              const unitCost = Number(selectedItem.costPrice ?? selectedItem.purchasePrice ?? 0);
              const unitName = selectedItem.unit || 'حبة';

              if (reconcileMode === 'PHYSICAL_COUNT') {
                const actual = physicalCount !== '' ? Number(physicalCount) : bookQty;
                const diff = actual - bookQty;
                const diffVal = Math.abs(diff) * unitCost;
                const isNegativeInput = physicalCount !== '' && Number(physicalCount) < 0;

                return (
                  <div className="space-y-4">
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                        <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                          <span className="text-slate-400 block text-[10px] mb-0.5">الرصيد الدفتري الحالي:</span>
                          <span className="font-extrabold text-sm text-slate-900">{bookQty} {unitName}</span>
                        </div>
                        <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                          <span className="text-slate-400 block text-[10px] mb-0.5">الرصيد الفعلي الجديد:</span>
                          <span className="font-extrabold text-sm text-indigo-900">{actual} {unitName}</span>
                        </div>
                        <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                          <span className="text-slate-400 block text-[10px] mb-0.5">فارق التسوية المعتمد:</span>
                          <span className={`font-extrabold text-sm ${diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                            {diff > 0 ? `+${diff}` : diff} {unitName}
                          </span>
                        </div>
                        <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                          <span className="text-slate-400 block text-[10px] mb-0.5">القيمة المالية للفارق:</span>
                          <span className="font-extrabold text-sm text-amber-700">{formatCurrency(diffVal, currency)}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        الكمية الفعلية الموجودة على الرف (الرصيد النهائي المتبقي):
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={physicalCount}
                        onChange={(e) => setPhysicalCount(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder={`مثال: أدخل الكمية الفعلية (الرصيد الحالي بالنظام هو ${bookQty})...`}
                        className={`w-full bg-slate-50 border rounded-xl p-2.5 text-xs font-bold text-slate-900 outline-none focus:ring-2 ${
                          isNegativeInput ? 'border-rose-400 focus:ring-rose-400' : 'border-slate-200 focus:ring-amber-500'
                        }`}
                        required
                      />
                      {isNegativeInput && (
                        <p className="text-[11px] font-bold text-rose-600 mt-1">
                          ⚠️ تنبيه محاسبي: لا يمكن أن يكون ناتج الجرد الفعلي على الرف سالباً. إذا كنت ترغب في خصم أو تصفير رصيد، استخدم خيار "تسوية مباشرة بالكمية" أو أدخل 0 لتصفير الرصيد.
                        </p>
                      )}
                    </div>
                  </div>
                );
              } else {
                // DIRECT_ADJUSTMENT mode
                const delta = directDelta !== '' ? Number(directDelta) : 0;
                const newBal = Math.max(0, bookQty + delta);
                const diffVal = Math.abs(delta) * unitCost;

                return (
                  <div className="space-y-4">
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                        <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                          <span className="text-slate-400 block text-[10px] mb-0.5">الرصيد الدفتري الحالي:</span>
                          <span className="font-extrabold text-sm text-slate-900">{bookQty} {unitName}</span>
                        </div>
                        <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                          <span className="text-slate-400 block text-[10px] mb-0.5">كمية التسوية المدخلة:</span>
                          <span className={`font-extrabold text-sm ${delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                            {delta > 0 ? `+${delta}` : delta} {unitName}
                          </span>
                        </div>
                        <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                          <span className="text-slate-400 block text-[10px] mb-0.5">الرصيد الجديد بعد التسوية:</span>
                          <span className="font-extrabold text-sm text-indigo-900">{newBal} {unitName}</span>
                        </div>
                        <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                          <span className="text-slate-400 block text-[10px] mb-0.5">القيمة المالية للتسوية:</span>
                          <span className="font-extrabold text-sm text-amber-700">{formatCurrency(diffVal, currency)}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-slate-700">
                          كمية التسوية المباشرة (+ لإضافة رصيد / - لخصم رصيد أو تالف):
                        </label>
                        {bookQty > 0 && (
                          <button
                            type="button"
                            onClick={() => setDirectDelta(-bookQty)}
                            className="text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                          >
                            تصفير الرصيد بالكامل (خصم {bookQty}-)
                          </button>
                        )}
                      </div>
                      <input
                        type="number"
                        step="any"
                        value={directDelta}
                        onChange={(e) => setDirectDelta(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder={`أدخل كمية التسوية (مثال: +10 للإضافة أو -${bookQty} للخصم)...`}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-amber-500"
                        required
                      />

                      {/* Quick Buttons */}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {[-10, -50, -100].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setDirectDelta(val)}
                            className="px-2.5 py-1 text-[11px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg cursor-pointer transition-all"
                          >
                            خصم ({val})
                          </button>
                        ))}
                        {[+10, +50, +100].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setDirectDelta(val)}
                            className="px-2.5 py-1 text-[11px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg cursor-pointer transition-all"
                          >
                            إضافة (+{val})
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              }
            })()}

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
              disabled={
                isSubmittingReconcile ||
                !reconcileItemId ||
                (reconcileMode === 'PHYSICAL_COUNT' && (physicalCount === '' || Number(physicalCount) < 0)) ||
                (reconcileMode === 'DIRECT_ADJUSTMENT' && (directDelta === '' || Number(directDelta) === 0))
              }
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

            {(() => {
              const liveQty = getItemLiveBalance(inspectedItem);
              const itemMvs = movements.filter(
                (m) => m.itemId === inspectedItem.id || (inspectedItem.sku && m.itemSku === inspectedItem.sku)
              );
              const sortedItemMvs = [...itemMvs].sort(
                (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
              );

              return (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="bg-slate-50 p-3 rounded-xl border">
                      <span className="text-slate-400 block text-[10px]">الرصيد اللحظي الحالي:</span>
                      <span className="font-extrabold text-slate-900 text-sm">
                        {liveQty} {inspectedItem.unit}
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
                      <span className="text-slate-400 block text-[10px]">إجمالي التقييم اللحظي:</span>
                      <span className="font-extrabold text-indigo-700 text-sm">
                        {formatCurrency(liveQty * (inspectedItem.purchasePrice || 0), currency)}
                      </span>
                    </div>
                  </div>

                  {/* Movement Timeline for this item */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 mb-2">
                      سجل حركات هذا الصنف ({sortedItemMvs.length} حركة):
                    </h4>
                    <div className="max-h-60 overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-100 text-xs">
                      {sortedItemMvs.length === 0 ? (
                        <div className="p-4 text-center text-slate-400">لا توجد حركات مسجلة لهذا الصنف</div>
                      ) : (
                        sortedItemMvs.map((m) => (
                          <div key={m.id} className="p-2.5 flex items-center justify-between hover:bg-slate-50">
                            <div>
                              <span className="font-bold text-slate-900">{m.typeTitleAr}</span>
                              <span className="text-[11px] text-slate-400 mr-2 font-mono">({m.referenceDocNumber})</span>
                              <div className="text-[10px] text-slate-500">{m.date} - {m.notes}</div>
                            </div>
                            <div className="text-left font-mono">
                              <span className={`font-bold ${(m.qty_in ?? m.quantityIn) > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {(m.qty_in ?? m.quantityIn) > 0 ? `+${m.qty_in ?? m.quantityIn}` : `-${m.qty_out ?? m.quantityOut}`} {m.unit}
                              </span>
                              <div className="text-[10px] text-slate-400">الرصيد بعد: {m.balanceAfter}</div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              );
            })()}

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

      {/* PRINTABLE ITEM STOCK CARD MODAL */}
      {selectedItemForPrintCard && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[95vh] overflow-y-auto p-8 space-y-6 border border-slate-300 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-4 no-print">
              <span className="text-xs font-black text-slate-700">معاينة طباعة بطاقة حركة الصنف المخزنية</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-[#D4AF37] hover:bg-[#b8952b] text-black font-black text-xs rounded-lg flex items-center gap-2 cursor-pointer shadow-md"
                >
                  <Printer className="w-4 h-4" />
                  طباعة فورية (Print A4)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedItemForPrintCard(null)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </div>

            {/* Printable Document Body */}
            <div className="space-y-6 text-black print:p-0">
              <div className="flex items-start justify-between border-b-2 border-black pb-4">
                <div className="space-y-1 text-right">
                  <h2 className="text-2xl font-black">{activeCompany.nameAr || activeCompany.headerTitle || 'إدارة المستودعات وسلاسل الإمداد'}</h2>
                  <p className="text-xs text-slate-600 font-bold">إدارة المستودعات وسلاسل الإمداد - بطاقة حركة صنف رسمي</p>
                  <p className="text-xs text-slate-500 font-mono">س.ت: {activeCompany.crNumber || activeCompany.commercialRegNumber || '-'} | {activeCompany.city || 'دولة الكويت'}</p>
                </div>
                <div className="text-left font-mono space-y-1">
                  <div className="text-sm font-black text-slate-900">ITEM STOCK CARD</div>
                  <div className="text-xs text-slate-500">تاريخ الطباعة: {new Date().toISOString().split('T')[0]}</div>
                </div>
              </div>

              {/* Item Info Box & Movements Table with Dynamic Live Balance */}
              {(() => {
                const cardMvs = movements.filter(
                  (m) =>
                    m.itemId === selectedItemForPrintCard.id ||
                    (selectedItemForPrintCard.sku && m.itemSku === selectedItemForPrintCard.sku)
                );
                const sortedCardMvs = [...cardMvs].sort(
                  (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
                );
                const hasOpening = sortedCardMvs.some((m) => m.type === 'OPENING');
                const openBal = hasOpening
                  ? 0
                  : Number(selectedItemForPrintCard.initialQuantity ?? selectedItemForPrintCard.quantityOnHand ?? 0);
                const livePrintBal = sortedCardMvs.length > 0
                  ? sortedCardMvs.reduce((acc, row) => {
                      const qtyIn = Number(row.qty_in ?? row.quantityIn ?? 0);
                      const qtyOut = Number(row.qty_out ?? row.quantityOut ?? 0);
                      return acc + qtyIn - qtyOut;
                    }, openBal)
                  : Number(selectedItemForPrintCard.quantityOnHand || 0);

                const finalPrintBal =
                  sortedCardMvs.length > 0 && sortedCardMvs[sortedCardMvs.length - 1].balanceAfter !== undefined
                    ? sortedCardMvs[sortedCardMvs.length - 1].balanceAfter
                    : livePrintBal;

                return (
                  <>
                    <div className="grid grid-cols-3 gap-4 border border-black p-4 rounded-lg bg-slate-50 text-xs">
                      <div>
                        <span className="text-slate-500 block">اسم الصنف:</span>
                        <span className="text-base font-black">{selectedItemForPrintCard.nameAr}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">رمز الصنف / SKU:</span>
                        <span className="text-base font-mono font-bold">{selectedItemForPrintCard.sku}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">الرصيد اللحظي الحالي:</span>
                        <span className="text-base font-black text-emerald-800 font-mono">
                          {finalPrintBal.toLocaleString()} {selectedItemForPrintCard.unit || 'حبة'}
                        </span>
                      </div>
                    </div>

                    {/* Movements Table */}
                    <table className="w-full text-right text-xs border border-black border-collapse">
                      <thead>
                        <tr className="bg-slate-200 border-b border-black text-black font-black">
                          <th className="p-2 border border-black">التاريخ</th>
                          <th className="p-2 border border-black">نوع الحركة</th>
                          <th className="p-2 border border-black">رقم المستند</th>
                          <th className="p-2 border border-black text-center">وارد (+)</th>
                          <th className="p-2 border border-black text-center">منصرف (-)</th>
                          <th className="p-2 border border-black text-center">الرصيد التراكمي</th>
                          <th className="p-2 border border-black">سعر التكلفة</th>
                          <th className="p-2 border border-black">البيان</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedCardMvs.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="p-4 text-center text-slate-400 font-sans font-bold">
                              لا توجد حركات مسجلة
                            </td>
                          </tr>
                        ) : (
                          sortedCardMvs.map((m) => (
                            <tr key={m.id} className="border-b border-slate-300 font-mono">
                              <td className="p-2 border border-slate-300">{m.date}</td>
                              <td className="p-2 border border-slate-300 font-sans font-bold">{m.typeTitleAr}</td>
                              <td className="p-2 border border-slate-300 font-bold">{m.referenceDocNumber}</td>
                              <td className="p-2 border border-slate-300 text-center font-bold">
                                {(m.qty_in ?? m.quantityIn) > 0 ? `+${m.qty_in ?? m.quantityIn}` : '-'}
                              </td>
                              <td className="p-2 border border-slate-300 text-center font-bold">
                                {(m.qty_out ?? m.quantityOut) > 0 ? `-${m.qty_out ?? m.quantityOut}` : '-'}
                              </td>
                              <td className="p-2 border border-slate-300 text-center font-black bg-slate-100">
                                {m.balanceAfter}
                              </td>
                              <td className="p-2 border border-slate-300">{formatCurrency(m.unitCost, currency)}</td>
                              <td className="p-2 border border-slate-300 font-sans text-[11px]">{m.notes || '-'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </>
                );
              })()}

              {/* Signatures */}
              <div className="grid grid-cols-3 gap-8 pt-8 text-center text-xs font-bold">
                <div className="border-t border-black pt-2">أمين المستودع (المستلم)</div>
                <div className="border-t border-black pt-2">مسؤول تدقيق الجرد</div>
                <div className="border-t border-black pt-2">اعتماد الإدارة العامة</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
