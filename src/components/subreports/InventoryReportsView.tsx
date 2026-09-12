import React, { useState, useMemo } from 'react';
import { InventoryItem, Invoice, SalesRep, Warehouse, CompanyProfile, JournalEntry, Account } from '../../types.js';
import { formatCurrency } from '../../utils/formatters.ts';
import {
  Package,
  AlertTriangle,
  Users,
  Search,
  Printer,
  Layers,
  CheckCircle2,
  TrendingDown,
  Warehouse as WarehouseIcon,
  DollarSign,
  ArrowUpDown,
  Scale,
} from 'lucide-react';
import { StockLedgerAndAuditView } from '../StockLedgerAndAuditView.tsx';
import { GlInventoryValuationReport } from '../reports/GlInventoryValuationReport.tsx';

interface InventoryReportsViewProps {
  inventory: InventoryItem[];
  invoices: Invoice[];
  salesReps: SalesRep[];
  warehouses: Warehouse[];
  journals?: JournalEntry[];
  accounts?: Account[];
  company: CompanyProfile | null;
  currency: string;
  initialReport?: 'gl-valuation' | 'stock-ledger' | 'reps-movement' | 'reorder-deficits';
}

export const InventoryReportsView: React.FC<InventoryReportsViewProps> = ({
  inventory,
  invoices,
  salesReps,
  warehouses,
  journals = [],
  accounts = [],
  company,
  currency,
  initialReport = 'gl-valuation',
}) => {
  const [activeReport, setActiveReport] = useState<
    'gl-valuation' | 'stock-ledger' | 'reps-movement' | 'reorder-deficits'
  >(initialReport);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('ALL');
  const [stockLedgerSelectedItemId, setStockLedgerSelectedItemId] = useState<string | undefined>(undefined);

  const handleOpenStockCard = (itemId: string) => {
    setStockLedgerSelectedItemId(itemId);
    setActiveReport('stock-ledger');
  };

  // 1. Reorder Deficits (نواقص حد الطلب)
  const deficitItems = useMemo(() => {
    return inventory
      .map((item) => {
        const currentStock = Number(item.quantityOnHand) || Number(item.quantity) || 0;
        const reorderLevel = Number(item.minQuantityAlert) || 10;
        const deficitQty = Math.max(0, reorderLevel - currentStock);
        const costPrice = Number(item.costPrice) || Number(item.purchasePrice) || 0;
        const estimatedReorderCost = deficitQty * costPrice;
        const isDeficit = currentStock <= reorderLevel;

        return {
          ...item,
          currentStock,
          reorderLevel,
          deficitQty,
          costPrice,
          estimatedReorderCost,
          isDeficit,
        };
      })
      .filter((item) => item.isDeficit)
      .filter((item) => {
        if (selectedWarehouseId !== 'ALL' && (item as any).warehouseId !== selectedWarehouseId) return false;
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          (item.nameAr || '').toLowerCase().includes(q) ||
          (item.sku || '').toLowerCase().includes(q) ||
          (item.barcode || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.deficitQty - a.deficitQty);
  }, [inventory, selectedWarehouseId, searchQuery]);

  const deficitSummary = useMemo(() => {
    let totalItems = deficitItems.length;
    let totalDeficitUnits = 0;
    let totalEstimatedCost = 0;

    deficitItems.forEach((i) => {
      totalDeficitUnits += i.deficitQty;
      totalEstimatedCost += i.estimatedReorderCost;
    });

    return { totalItems, totalDeficitUnits, totalEstimatedCost };
  }, [deficitItems]);

  // 2. Sales Reps Inventory Movement (حركة بضاعة المناديب)
  const repsMovementData = useMemo(() => {
    return salesReps.map((rep) => {
      // Find invoices issued by this rep
      const repInvoices = invoices.filter(
        (inv) =>
          inv.salesRepId === rep.id ||
          inv.salesPerson === rep.nameAr ||
          inv.salesRepName === rep.nameAr
      );

      let totalSalesAmount = 0;
      let totalUnitsSold = 0;
      let salesCount = 0;
      let returnCount = 0;

      repInvoices.forEach((inv) => {
        const total = Number(inv.grandTotal) || 0;
        const lines = inv.lines || (inv as any).items || [];
        if (inv.type === 'SALES') {
          totalSalesAmount += total;
          salesCount++;
          lines.forEach((line: any) => {
            totalUnitsSold += Number(line.quantity) || 0;
          });
        } else if (inv.type === 'SALES_RETURN') {
          totalSalesAmount -= total;
          returnCount++;
          lines.forEach((line: any) => {
            totalUnitsSold -= Number(line.quantity) || 0;
          });
        }
      });

      return {
        rep,
        invoicesCount: repInvoices.length,
        salesCount,
        returnCount,
        totalSalesAmount,
        totalUnitsSold,
      };
    }).filter((row) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        (row.rep.nameAr || '').toLowerCase().includes(q) ||
        (row.rep.code || '').toLowerCase().includes(q) ||
        (row.rep.phone || '').includes(q)
      );
    });
  }, [salesReps, invoices, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Sub-report selector buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setActiveReport('gl-valuation')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeReport === 'gl-valuation'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>تقرير تقييم المخزون المالي (ح/ 1130 وح/ 5100)</span>
          </button>
          <button
            onClick={() => setActiveReport('stock-ledger')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeReport === 'stock-ledger'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            تقرير كارت الصنف وأذون الحركات (Stock Ledger)
          </button>
          <button
            onClick={() => setActiveReport('reps-movement')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeReport === 'reps-movement'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            تقرير حركة وتوزيع بضاعة المناديب
          </button>
          <button
            onClick={() => setActiveReport('reorder-deficits')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeReport === 'reorder-deficits'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            تقرير نواقص حد الطلب ومستويات الأمان
          </button>
        </div>

        {(activeReport === 'reps-movement' || activeReport === 'reorder-deficits') && (
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

      {/* 1. GL-LINKED INVENTORY VALUATION REPORT (ح/ 1130 وح/ 5100) */}
      {activeReport === 'gl-valuation' && (
        <GlInventoryValuationReport
          inventory={inventory}
          journals={journals}
          accounts={accounts}
          invoices={invoices}
          warehouses={warehouses}
          company={company}
          currency={currency}
          onViewStockCard={handleOpenStockCard}
        />
      )}

      {/* 2. Stock Ledger View Component */}
      {activeReport === 'stock-ledger' && (
        <div className="bg-white rounded-xl border border-slate-200 p-2 shadow-xs">
          <StockLedgerAndAuditView
            inventory={inventory}
            invoices={invoices}
            productionOrders={[]}
            currency={currency}
            initialItemId={stockLedgerSelectedItemId}
          />
        </div>
      )}

      {/* Filters for Reps & Deficits */}
      {(activeReport === 'reps-movement' || activeReport === 'reorder-deficits') && (
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
          {activeReport === 'reorder-deficits' && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-600 font-bold">المستودع:</span>
              <select
                value={selectedWarehouseId}
                onChange={(e) => setSelectedWarehouseId(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-slate-900 font-bold focus:outline-none"
              >
                <option value="ALL">كافة المستودعات والمخازن</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.nameAr}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
            <input
              type="text"
              placeholder={activeReport === 'reorder-deficits' ? 'بحث باسم الصنف أو الباركود...' : 'بحث باسم المندوب أو الكود...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg pr-8 pl-3 py-1 text-xs text-slate-900 focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* 2. SALES REPS MOVEMENT */}
      {activeReport === 'reps-movement' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-3 border-b border-slate-200 flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900">تقرير حركة بضاعة ومبيعات المناديب</h4>
              <span className="text-xs font-bold text-slate-500 font-mono">
                {repsMovementData.length} مندوب مسجل
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-900 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">كود المندوب</th>
                    <th className="py-2.5 px-3">اسم المندوب</th>
                    <th className="py-2.5 px-3">المنطقة / خط السير</th>
                    <th className="py-2.5 px-3 text-center">عدد فواتير البيع</th>
                    <th className="py-2.5 px-3 text-center">عدد المرتجعات</th>
                    <th className="py-2.5 px-3 text-center">إجمالي الكميات المصروفة</th>
                    <th className="py-2.5 px-3 text-left font-mono">صافي مبيعات المندوب</th>
                    <th className="py-2.5 px-3 text-center">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {repsMovementData.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500 font-bold">
                        لا توجد بيانات حركة مناديب مسجلة
                      </td>
                    </tr>
                  ) : (
                    repsMovementData.map((row) => (
                      <tr key={row.rep.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{row.rep.code || '-'}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">{row.rep.nameAr || '-'}</td>
                        <td className="py-2.5 px-3 text-slate-600">عام</td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-700">
                          {row.salesCount}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-rose-600">
                          {row.returnCount}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900">
                          {row.totalUnitsSold.toLocaleString()} قطعة
                        </td>
                        <td className="py-2.5 px-3 text-left font-mono font-bold text-slate-900">
                          {formatCurrency(row.totalSalesAmount, currency)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              row.rep.isActive
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                                : 'bg-slate-100 text-slate-700 border border-slate-300'
                            }`}
                          >
                            {row.rep.isActive ? 'نشط' : 'معطل'}
                          </span>
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

      {/* 3. REORDER DEFICITS REPORT */}
      {activeReport === 'reorder-deficits' && (
        <div className="space-y-4">
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-rose-200 shadow-xs bg-rose-50/20">
              <span className="text-xs font-bold text-rose-800 block">عدد الأصناف تحت حد الأمان</span>
              <span className="text-xl font-bold font-mono text-rose-700 block mt-1">
                {deficitSummary.totalItems} صنف
              </span>
              <span className="text-[10px] text-rose-600 mt-0.5 block font-bold">تتطلب أمر شراء عاجل</span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-amber-200 shadow-xs bg-amber-50/20">
              <span className="text-xs font-bold text-amber-800 block">إجمالي الكميات الناقصة</span>
              <span className="text-xl font-bold font-mono text-amber-700 block mt-1">
                {deficitSummary.totalDeficitUnits.toLocaleString()} وحدة
              </span>
              <span className="text-[10px] text-amber-600 mt-0.5 block font-bold">للوصول لحد الأمان</span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs font-bold text-slate-600 block">التكلفة التقديرية للشراء</span>
              <span className="text-xl font-bold font-mono text-slate-900 block mt-1">
                {formatCurrency(deficitSummary.totalEstimatedCost, currency)}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">محسوبة بآخر تكلفة شراء</span>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-3 border-b border-slate-200 flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900">سجل الأصناف الناقصة المتجاوزة لحد إعادة الطلب</h4>
              <span className="text-xs font-bold text-slate-500 font-mono">
                {deficitItems.length} صنف يحتاج توريد
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-900 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">رقم الصنف (SKU)</th>
                    <th className="py-2.5 px-3">اسم الصنف والمواصفات</th>
                    <th className="py-2.5 px-3 text-center">المستودع</th>
                    <th className="py-2.5 px-3 text-center">الرصيد الفعلي الحالي</th>
                    <th className="py-2.5 px-3 text-center">نقطة إعادة الطلب</th>
                    <th className="py-2.5 px-3 text-center font-bold text-rose-700">كمية العجز</th>
                    <th className="py-2.5 px-3 text-left font-mono">تكلفة الوحدة</th>
                    <th className="py-2.5 px-3 text-left font-mono">تكلفة إعادة التوريد</th>
                    <th className="py-2.5 px-3 text-center">مستوى الخطر</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {deficitItems.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-emerald-700 font-bold">
                        <div className="flex flex-col items-center justify-center gap-1.5">
                          <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                          <span>كافة الأصناف مخزونها آمن ومستقر فوق حد إعادة الطلب!</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    deficitItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-3 font-mono font-bold text-slate-900">{item.sku || '-'}</td>
                        <td className="py-2 px-3 font-bold text-slate-900">{item.nameAr}</td>
                        <td className="py-2 px-3 text-center text-slate-600">
                          {warehouses.find((w) => w.id === (item as any).warehouseId)?.nameAr || 'المستودع الرئيسي'}
                        </td>
                        <td className="py-2 px-3 text-center font-mono font-bold text-slate-900">
                          {item.currentStock}
                        </td>
                        <td className="py-2 px-3 text-center font-mono text-slate-600">
                          {item.reorderLevel}
                        </td>
                        <td className="py-2 px-3 text-center font-mono font-bold text-rose-700">
                          {item.deficitQty}
                        </td>
                        <td className="py-2 px-3 text-left font-mono text-slate-700">
                          {formatCurrency(item.costPrice, currency)}
                        </td>
                        <td className="py-2 px-3 text-left font-mono font-bold text-slate-900">
                          {formatCurrency(item.estimatedReorderCost, currency)}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              item.currentStock <= 0
                                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                : 'bg-amber-100 text-amber-800 border border-amber-300'
                            }`}
                          >
                            {item.currentStock <= 0 ? 'نفاد تام (رصيد صفر)' : 'تحت حد الأمان'}
                          </span>
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
