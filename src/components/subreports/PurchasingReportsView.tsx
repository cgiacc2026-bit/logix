import React, { useState, useMemo } from 'react';
import { Invoice, Supplier, CompanyProfile, InventoryItem } from '../../types.js';
import { formatCurrency } from '../../utils/formatters.ts';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Printer,
  Search,
  Calendar,
  Layers,
  Building2,
  Package,
  Eye,
  AlertTriangle,
} from 'lucide-react';
import { AccountStatementView } from '../AccountStatementView.tsx';

interface PurchasingReportsViewProps {
  invoices: Invoice[];
  suppliers: Supplier[];
  inventory: InventoryItem[];
  company: CompanyProfile | null;
  currency: string;
  initialReport?: 'procurement' | 'ledger' | 'fluctuations';
  onViewInvoice?: (invoice: Invoice) => void;
}

export const PurchasingReportsView: React.FC<PurchasingReportsViewProps> = ({
  invoices,
  suppliers,
  inventory,
  company,
  currency,
  initialReport = 'procurement',
  onViewInvoice,
}) => {
  const [activeReport, setActiveReport] = useState<'procurement' | 'ledger' | 'fluctuations'>(initialReport);

  const today = new Date().toISOString().split('T')[0];
  const firstDayOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
  const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

  const [datePreset, setDatePreset] = useState<'TODAY' | 'THIS_MONTH' | 'THIS_YEAR' | 'ALL'>('THIS_YEAR');
  const [startDate, setStartDate] = useState<string>(firstDayOfYear);
  const [endDate, setEndDate] = useState<string>(today);
  const [searchQuery, setSearchQuery] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('ALL');

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

  // 1. Purchase Invoices
  const purchaseInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const isPurchase = inv.type === 'PURCHASE' || inv.type === 'PURCHASE_RETURN';
      if (!isPurchase) return false;
      if (!isDateInRange(inv.date)) return false;
      if (supplierFilter !== 'ALL' && inv.entityId !== supplierFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesNo = (inv.invoiceNumber || '').toLowerCase().includes(q);
        const matchesName = (inv.entityNameAr || '').toLowerCase().includes(q);
        if (!matchesNo && !matchesName) return false;
      }
      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [invoices, startDate, endDate, datePreset, supplierFilter, searchQuery]);

  const procurementMetrics = useMemo(() => {
    let grossPurchases = 0;
    let returnsTotal = 0;
    let discountsTotal = 0;
    let netPurchases = 0;
    let paidTotal = 0;
    let dueTotal = 0;
    let invoiceCount = 0;

    purchaseInvoices.forEach((inv) => {
      const total = Number(inv.grandTotal) || 0;
      const disc = Number(inv.discountTotal) || 0;
      const paid = Number(inv.paidAmount) || 0;
      const due = Number(inv.dueAmount) || 0;

      if (inv.type === 'PURCHASE') {
        grossPurchases += Number(inv.subtotal) || total;
        discountsTotal += disc;
        netPurchases += total;
        paidTotal += paid;
        dueTotal += due;
        invoiceCount++;
      } else if (inv.type === 'PURCHASE_RETURN') {
        returnsTotal += total;
        netPurchases -= total;
      }
    });

    return { grossPurchases, returnsTotal, discountsTotal, netPurchases, paidTotal, dueTotal, invoiceCount };
  }, [purchaseInvoices]);

  // 3. Purchase Price Fluctuations per item
  const priceFluctuations = useMemo(() => {
    // Map item -> history of purchases
    const map = new Map<string, {
      itemId: string;
      itemSku: string;
      itemName: string;
      history: { date: string; invoiceNo: string; supplierName: string; unitPrice: number }[];
    }>();

    // Scan all purchase invoices
    invoices
      .filter((inv) => inv.type === 'PURCHASE')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .forEach((inv) => {
        const invoiceLines = (inv.lines || (inv as any).items || []);
        invoiceLines.forEach((line: any) => {
          const key = line.itemId || line.itemSku || line.itemNameAr;
          if (!key) return;
          const current = map.get(key) || {
            itemId: line.itemId || '',
            itemSku: line.itemSku || '',
            itemName: line.itemNameAr || 'صنف غير مسمى',
            history: [],
          };
          current.history.push({
            date: inv.date,
            invoiceNo: inv.invoiceNumber,
            supplierName: inv.entityNameAr || 'مورد عام',
            unitPrice: Number(line.unitPrice) || 0,
          });
          map.set(key, current);
        });
      });

    // Calculate variations
    return Array.from(map.values()).map((entry) => {
      const prices = entry.history.map((h) => h.unitPrice);
      const minPrice = prices.length ? Math.min(...prices) : 0;
      const maxPrice = prices.length ? Math.max(...prices) : 0;
      const latestPrice = entry.history.length ? entry.history[entry.history.length - 1].unitPrice : 0;
      const oldestPrice = entry.history.length ? entry.history[0].unitPrice : 0;
      const fluctuationPct = oldestPrice > 0 ? ((latestPrice - oldestPrice) / oldestPrice) * 100 : 0;

      return {
        ...entry,
        minPrice,
        maxPrice,
        latestPrice,
        oldestPrice,
        fluctuationPct,
        purchaseCount: entry.history.length,
      };
    }).filter((row) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return row.itemName.toLowerCase().includes(q) || row.itemSku.toLowerCase().includes(q);
    });
  }, [invoices, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Sub-report selector buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setActiveReport('procurement')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeReport === 'procurement'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            تقرير التوريدات والمشتريات المجمعة
          </button>
          <button
            onClick={() => setActiveReport('ledger')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeReport === 'ledger'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            حركة وسجلات الموردين (كشوف الحساب)
          </button>
          <button
            onClick={() => setActiveReport('fluctuations')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeReport === 'fluctuations'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            تحليل تقلبات وتغيرات أسعار الشراء
          </button>
        </div>

        {activeReport !== 'ledger' && (
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

      {/* Supplier Ledger (Account Statements) */}
      {activeReport === 'ledger' && (
        <div className="bg-white rounded-xl border border-slate-200 p-2 shadow-xs">
          <AccountStatementView
            customers={[]}
            suppliers={suppliers}
            invoices={invoices}
            vouchers={[]}
            journals={[]}
            company={company}
            currency={currency}
            initialEntityType="SUPPLIER"
          />
        </div>
      )}

      {/* Filters for Procurement & Fluctuations */}
      {activeReport !== 'ledger' && (
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Presets */}
            {activeReport === 'procurement' && (
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
            )}

            {/* Dates for procurement */}
            {activeReport === 'procurement' && (
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
            )}

            {/* Supplier Filter */}
            {activeReport === 'procurement' && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-600 font-bold">المورد:</span>
                <select
                  value={supplierFilter}
                  onChange={(e) => setSupplierFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-slate-900 font-bold focus:outline-none"
                >
                  <option value="ALL">كافة الموردين ({suppliers.length})</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nameAr}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Search */}
            <div className="relative min-w-[220px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
              <input
                type="text"
                placeholder={activeReport === 'fluctuations' ? 'بحث باسم الصنف أو الكود...' : 'بحث برقم الفاتورة أو المورد...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg pr-8 pl-3 py-1 text-xs text-slate-900 focus:outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* 1. PROCUREMENT REPORT */}
      {activeReport === 'procurement' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 block">إجمالي المشتريات</span>
              <span className="text-base font-bold font-mono text-slate-900 block mt-1">
                {formatCurrency(procurementMetrics.grossPurchases, currency)}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">{procurementMetrics.invoiceCount} فاتورة</span>
            </div>

            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 block">مرتجعات المشتريات</span>
              <span className="text-base font-bold font-mono text-rose-600 block mt-1">
                -{formatCurrency(procurementMetrics.returnsTotal, currency)}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">إشعارات مدينة</span>
            </div>

            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 block">الخصومات المكتسبة</span>
              <span className="text-base font-bold font-mono text-emerald-600 block mt-1">
                -{formatCurrency(procurementMetrics.discountsTotal, currency)}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">خصم من الموردين</span>
            </div>

            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs bg-slate-50">
              <span className="text-[11px] font-bold text-slate-700 block">صافي التوريدات الإجمالي</span>
              <span className="text-base font-bold font-mono text-slate-900 block mt-1">
                {formatCurrency(procurementMetrics.netPurchases, currency)}
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5 block font-bold">الالتزام الفعلي</span>
            </div>

            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 block">المسدد للموردين</span>
              <span className="text-base font-bold font-mono text-emerald-700 block mt-1">
                {formatCurrency(procurementMetrics.paidTotal, currency)}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">مدفوعات وسندات</span>
            </div>

            <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-xs bg-amber-50/20">
              <span className="text-[11px] font-bold text-amber-800 block">المستحق للموردين (ذمم)</span>
              <span className="text-base font-bold font-mono text-amber-700 block mt-1">
                {formatCurrency(procurementMetrics.dueTotal, currency)}
              </span>
              <span className="text-[10px] text-amber-600 mt-0.5 block font-bold">التزامات قائمة</span>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-3 border-b border-slate-200 flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900">سجل فواتير التوريد والمشتريات</h4>
              <span className="text-xs font-bold text-slate-500 font-mono">
                {purchaseInvoices.length} فاتورة
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-900 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">رقم الفاتورة</th>
                    <th className="py-2.5 px-3">التاريخ</th>
                    <th className="py-2.5 px-3">المورد</th>
                    <th className="py-2.5 px-3 text-center">النوع</th>
                    <th className="py-2.5 px-3 text-left font-mono">المجموع</th>
                    <th className="py-2.5 px-3 text-left font-mono">الخصم</th>
                    <th className="py-2.5 px-3 text-left font-mono">صافي الفاتورة</th>
                    <th className="py-2.5 px-3 text-left font-mono">المسدد</th>
                    <th className="py-2.5 px-3 text-left font-mono">المتبقي</th>
                    <th className="py-2.5 px-3 text-center">الحالة</th>
                    <th className="py-2.5 px-3 text-center">معاينة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {purchaseInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-8 text-center text-slate-500 font-bold">
                        لا توجد فواتير توريد مطابقة لمعايير البحث المحددة
                      </td>
                    </tr>
                  ) : (
                    purchaseInvoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-3 font-mono font-bold text-slate-900">{inv.invoiceNumber}</td>
                        <td className="py-2 px-3 font-mono text-slate-600">{inv.date}</td>
                        <td className="py-2 px-3 font-bold text-slate-900">{inv.entityNameAr || '-'}</td>
                        <td className="py-2 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              inv.type === 'PURCHASE'
                                ? 'bg-blue-50 text-blue-700 border border-blue-300'
                                : 'bg-rose-50 text-rose-700 border border-rose-300'
                            }`}
                          >
                            {inv.type === 'PURCHASE' ? 'فاتورة شراء' : 'مرتجع شراء'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-left font-mono text-slate-700">
                          {formatCurrency(inv.subtotal, currency)}
                        </td>
                        <td className="py-2 px-3 text-left font-mono text-emerald-700">
                          {inv.discountTotal > 0 ? formatCurrency(inv.discountTotal, currency) : '-'}
                        </td>
                        <td className="py-2 px-3 text-left font-mono font-bold text-slate-900">
                          {formatCurrency(inv.grandTotal, currency)}
                        </td>
                        <td className="py-2 px-3 text-left font-mono text-emerald-700">
                          {formatCurrency(inv.paidAmount || 0, currency)}
                        </td>
                        <td className="py-2 px-3 text-left font-mono font-bold text-amber-700">
                          {formatCurrency(inv.dueAmount || 0, currency)}
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

      {/* 3. PRICE FLUCTUATIONS ANALYSIS */}
      {activeReport === 'fluctuations' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-3.5 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-900">تحليل تذبذب وتقلب أسعار الشراء عبر الزمن</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                مقارنة أسعار الشراء التاريخية لنفس الأصناف لكشف الارتفاعات أو الانخفاضات السعرية بين الموردين
              </p>
            </div>
            <span className="text-xs font-bold text-slate-600 font-mono">
              {priceFluctuations.length} صنف تم شراؤه
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 text-slate-900 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">كود الصنف (SKU)</th>
                  <th className="py-2.5 px-3">اسم الصنف والمواصفات</th>
                  <th className="py-2.5 px-3 text-center">مرات الشراء</th>
                  <th className="py-2.5 px-3 text-left font-mono">أدنى سعر شراء</th>
                  <th className="py-2.5 px-3 text-left font-mono">أعلى سعر شراء</th>
                  <th className="py-2.5 px-3 text-left font-mono">آخر سعر شراء</th>
                  <th className="py-2.5 px-3 text-center">نسبة التغير الكلية</th>
                  <th className="py-2.5 px-3 text-center">تقييم الحركة السعرية</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {priceFluctuations.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500 font-bold">
                      لا توجد بيانات مشتريات سابقة لتحليل تقلبات الأسعار
                    </td>
                  </tr>
                ) : (
                  priceFluctuations.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{item.itemSku || '-'}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">{item.itemName}</td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-700">
                        {item.purchaseCount}
                      </td>
                      <td className="py-2.5 px-3 text-left font-mono text-emerald-700">
                        {formatCurrency(item.minPrice, currency)}
                      </td>
                      <td className="py-2.5 px-3 text-left font-mono text-rose-700">
                        {formatCurrency(item.maxPrice, currency)}
                      </td>
                      <td className="py-2.5 px-3 text-left font-mono font-bold text-slate-900">
                        {formatCurrency(item.latestPrice, currency)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded font-mono font-bold text-[11px] inline-flex items-center gap-1 ${
                            item.fluctuationPct > 0
                              ? 'bg-rose-50 text-rose-700 border border-rose-300'
                              : item.fluctuationPct < 0
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                              : 'bg-slate-100 text-slate-700 border border-slate-300'
                          }`}
                        >
                          {item.fluctuationPct > 0 ? (
                            <>
                              <TrendingUp className="w-3 h-3" />
                              +{item.fluctuationPct.toFixed(1)}%
                            </>
                          ) : item.fluctuationPct < 0 ? (
                            <>
                              <TrendingDown className="w-3 h-3" />
                              {item.fluctuationPct.toFixed(1)}%
                            </>
                          ) : (
                            '0.0%'
                          )}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.fluctuationPct > 10
                              ? 'bg-rose-100 text-rose-800'
                              : item.fluctuationPct < -5
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {item.fluctuationPct > 10
                            ? 'ارتفاع ملحوظ في التكلفة'
                            : item.fluctuationPct < -5
                            ? 'انخفاض وتوفير سعري'
                            : 'سعر مستقر'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
