import React, { useMemo } from 'react';
import {
  Building2,
  Package,
  Users,
  UserCheck,
  ShoppingCart,
  ShoppingBag,
  ArrowDown,
  ArrowUp,
  Receipt,
  DollarSign,
  TrendingUp,
  FileBarChart,
  BookOpen,
  Boxes,
  ArrowRight,
  Sparkles,
  Layers,
  ChevronLeft,
  ChevronsUp,
  ChevronsDown,
  Warehouse as WarehouseIcon,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  CompanyProfile,
  Customer,
  Supplier,
  InventoryItem,
  Invoice,
  PaymentVoucher,
  Account,
  JournalEntry,
  Warehouse,
  Branch,
} from '../types.js';
import { TabType } from './Navigation.tsx';
import { formatCurrency } from '../utils/formatters.ts';

interface ExecutiveDashboardViewProps {
  company: CompanyProfile;
  currency: string;
  customers: Customer[];
  suppliers: Supplier[];
  inventory: InventoryItem[];
  invoices: Invoice[];
  vouchers: PaymentVoucher[];
  accounts: Account[];
  journals: JournalEntry[];
  warehouses: Warehouse[];
  branches?: Branch[];
  onNavigateTab: (tab: TabType) => void;
  onOpenReport?: (reportType: string) => void;
}

export const ExecutiveDashboardView: React.FC<ExecutiveDashboardViewProps> = ({
  company,
  currency,
  customers,
  suppliers,
  inventory,
  invoices,
  vouchers,
  accounts,
  journals,
  warehouses,
  branches = [],
  onNavigateTab,
  onOpenReport,
}) => {
  // 1. Filter out CANCELLED or VOID invoices for true financial figures
  const validInvoices = useMemo(() => {
    return invoices.filter((inv) => inv.status !== 'CANCELLED' && !inv.is_void && !inv.is_deleted);
  }, [invoices]);

  // 2. Sales Invoices vs Sales Returns
  const salesInvoices = useMemo(() => {
    return validInvoices.filter(
      (inv) => inv.type === 'SALES' && (Number(inv.grandTotal) >= 0 && !inv.invoiceNumber.includes('RET'))
    );
  }, [validInvoices]);

  const salesReturns = useMemo(() => {
    return validInvoices.filter(
      (inv) => inv.type === 'SALES_RETURN' || (inv.type === 'SALES' && (Number(inv.grandTotal) < 0 || inv.invoiceNumber.includes('RET')))
    );
  }, [validInvoices]);

  // 3. Purchase Invoices vs Purchase Returns
  const purchaseInvoices = useMemo(() => {
    return validInvoices.filter(
      (inv) => inv.type === 'PURCHASE' && (Number(inv.grandTotal) >= 0 && !inv.invoiceNumber.includes('RET'))
    );
  }, [validInvoices]);

  const purchaseReturns = useMemo(() => {
    return validInvoices.filter(
      (inv) => inv.type === 'PURCHASE_RETURN' || (inv.type === 'PURCHASE' && (Number(inv.grandTotal) < 0 || inv.invoiceNumber.includes('RET')))
    );
  }, [validInvoices]);

  // 4. Financial Sums
  const grossSalesAmount = useMemo(() => {
    return salesInvoices.reduce((sum, inv) => sum + Math.abs(Number(inv.grandTotal) || 0), 0);
  }, [salesInvoices]);

  const salesReturnsAmount = useMemo(() => {
    return salesReturns.reduce((sum, inv) => sum + Math.abs(Number(inv.grandTotal) || 0), 0);
  }, [salesReturns]);

  const netSalesAmount = grossSalesAmount - salesReturnsAmount;

  const grossPurchasesAmount = useMemo(() => {
    return purchaseInvoices.reduce((sum, inv) => sum + Math.abs(Number(inv.grandTotal) || 0), 0);
  }, [purchaseInvoices]);

  const purchaseReturnsAmount = useMemo(() => {
    return purchaseReturns.reduce((sum, inv) => sum + Math.abs(Number(inv.grandTotal) || 0), 0);
  }, [purchaseReturns]);

  const netPurchasesAmount = grossPurchasesAmount - purchaseReturnsAmount;

  // 5. Vouchers: Receipts (سندات القبض) & Payments (سندات الصرف)
  const validVouchers = useMemo(() => {
    return vouchers.filter((v) => v.status !== 'CANCELLED' && !v.is_void);
  }, [vouchers]);

  const receiptVouchersAmount = useMemo(() => {
    return validVouchers
      .filter((v) => v.type === 'RECEIPT')
      .reduce((sum, v) => sum + (Number(v.amount) || 0), 0);
  }, [validVouchers]);

  const paymentVouchersAmount = useMemo(() => {
    return validVouchers
      .filter((v) => v.type === 'PAYMENT')
      .reduce((sum, v) => sum + (Number(v.amount) || 0), 0);
  }, [validVouchers]);

  // 6. Monthly Time-Series Analytics (Matching the charts in 00.png)
  const monthlyChartData = useMemo(() => {
    const monthsMap: Record<
      string,
      {
        month: string;
        salesCount: number;
        returnsCount: number;
        salesAmount: number;
        returnsAmount: number;
      }
    > = {};

    // Generate last 12 months baseline if no records exist
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthsMap[key] = {
        month: key,
        salesCount: 0,
        returnsCount: 0,
        salesAmount: 0,
        returnsAmount: 0,
      };
    }

    // Populate with real invoice data
    validInvoices.forEach((inv) => {
      if (!inv.date) return;
      const key = inv.date.substring(0, 7); // YYYY-MM
      if (!monthsMap[key]) {
        monthsMap[key] = {
          month: key,
          salesCount: 0,
          returnsCount: 0,
          salesAmount: 0,
          returnsAmount: 0,
        };
      }

      const isReturn =
        inv.type === 'SALES_RETURN' ||
        (inv.type === 'SALES' && (Number(inv.grandTotal) < 0 || inv.invoiceNumber.includes('RET')));
      const isSale = inv.type === 'SALES' && !isReturn;

      if (isSale) {
        monthsMap[key].salesCount += 1;
        monthsMap[key].salesAmount += Math.abs(Number(inv.grandTotal) || 0);
      } else if (isReturn) {
        monthsMap[key].returnsCount += 1;
        monthsMap[key].returnsAmount += Math.abs(Number(inv.grandTotal) || 0);
      }
    });

    return Object.values(monthsMap).sort((a, b) => a.month.localeCompare(b.month));
  }, [validInvoices]);

  const totalBranchesAndWarehouses = warehouses.length > 0 ? warehouses.length : Math.max(branches.length, 1);

  return (
    <div className="space-y-6 pb-12 font-sans" dir="rtl">
      {/* 1. Header & Breadcrumb Bar (Matching 00.png header) */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
              <span className="text-emerald-700 font-bold">{company?.nameAr || 'لوجيكس ERP'}</span>
              <span>/</span>
              <span>إدارة النظام</span>
              <span>/</span>
              <span className="text-slate-800 font-bold">إحصائيات النظام</span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                إحصائيات النظام
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                لوحة التحكم المباشرة • IFRS
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              إحصائية عامة شاملة لكافة الأقسام والمؤشرات المالية والتشغيلية مع التوجيه المباشر بنقرة واحدة
            </p>
          </div>

          {/* Quick Hub Navigation Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => onNavigateTab('reports')}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center gap-2 transition-all cursor-pointer"
            >
              <FileBarChart className="w-4 h-4" />
              <span>مركز التقارير المجمعة</span>
            </button>
            <button
              onClick={() => onNavigateTab('sales-invoices')}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 flex items-center gap-2 transition-all cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4 text-emerald-600" />
              <span>فواتير المبيعات</span>
            </button>
            <button
              onClick={() => onNavigateTab('purchase-invoices')}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 flex items-center gap-2 transition-all cursor-pointer"
            >
              <ShoppingCart className="w-4 h-4 text-sky-600" />
              <span>فواتير الشراء</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Top 8 Vibrant KPI Cards (Faithful to 00.png with direct "الذهاب" one-click action) */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>إحصائية عامة لمكونات النظام الأساسية</span>
          </h2>
          <span className="text-xs text-slate-500 font-mono">DIRECT ONE-CLICK ROUTING</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          {/* 1. الفروع / المستودعات (Sky Blue #00c0ef) */}
          <div className="rounded-xl overflow-hidden shadow-2xs transition-all hover:shadow-md text-white bg-[#00c0ef] flex flex-col justify-between group">
            <div className="p-4 pb-2 flex items-start justify-between">
              <div>
                <div className="text-3xl font-black font-mono leading-none tracking-tight">
                  {totalBranchesAndWarehouses}
                </div>
                <div className="text-xs font-bold mt-1.5 opacity-95">الفروع/المستودعات</div>
              </div>
              <Building2 className="w-9 h-9 opacity-40 group-hover:scale-110 transition-transform" />
            </div>
            <button
              onClick={() => onNavigateTab('warehouses')}
              className="w-full py-1.5 px-3 bg-black/15 hover:bg-black/25 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border-t border-white/10"
            >
              <span>الذهاب</span>
              <ArrowRight className="w-3.5 h-3.5 rotate-180" />
            </button>
          </div>

          {/* 2. الأصناف (Vibrant Emerald #00a65a) */}
          <div className="rounded-xl overflow-hidden shadow-2xs transition-all hover:shadow-md text-white bg-[#00a65a] flex flex-col justify-between group">
            <div className="p-4 pb-2 flex items-start justify-between">
              <div>
                <div className="text-3xl font-black font-mono leading-none tracking-tight">
                  {inventory.length}
                </div>
                <div className="text-xs font-bold mt-1.5 opacity-95">الأصناف</div>
              </div>
              <Package className="w-9 h-9 opacity-40 group-hover:scale-110 transition-transform" />
            </div>
            <button
              onClick={() => onNavigateTab('inventory')}
              className="w-full py-1.5 px-3 bg-black/15 hover:bg-black/25 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border-t border-white/10"
            >
              <span>الذهاب</span>
              <ArrowRight className="w-3.5 h-3.5 rotate-180" />
            </button>
          </div>

          {/* 3. الموردين (Warm Amber/Orange #f39c12) */}
          <div className="rounded-xl overflow-hidden shadow-2xs transition-all hover:shadow-md text-white bg-[#f39c12] flex flex-col justify-between group">
            <div className="p-4 pb-2 flex items-start justify-between">
              <div>
                <div className="text-3xl font-black font-mono leading-none tracking-tight">
                  {suppliers.length}
                </div>
                <div className="text-xs font-bold mt-1.5 opacity-95">الموردين</div>
              </div>
              <Users className="w-9 h-9 opacity-40 group-hover:scale-110 transition-transform" />
            </div>
            <button
              onClick={() => onNavigateTab('suppliers')}
              className="w-full py-1.5 px-3 bg-black/15 hover:bg-black/25 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border-t border-white/10"
            >
              <span>الذهاب</span>
              <ArrowRight className="w-3.5 h-3.5 rotate-180" />
            </button>
          </div>

          {/* 4. العملاء (Emerald Green #00e676 / #00a65a) */}
          <div className="rounded-xl overflow-hidden shadow-2xs transition-all hover:shadow-md text-white bg-[#00a65a] flex flex-col justify-between group">
            <div className="p-4 pb-2 flex items-start justify-between">
              <div>
                <div className="text-3xl font-black font-mono leading-none tracking-tight">
                  {customers.length}
                </div>
                <div className="text-xs font-bold mt-1.5 opacity-95">العملاء</div>
              </div>
              <UserCheck className="w-9 h-9 opacity-40 group-hover:scale-110 transition-transform" />
            </div>
            <button
              onClick={() => onNavigateTab('customers')}
              className="w-full py-1.5 px-3 bg-black/15 hover:bg-black/25 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border-t border-white/10"
            >
              <span>الذهاب</span>
              <ArrowRight className="w-3.5 h-3.5 rotate-180" />
            </button>
          </div>

          {/* 5. فواتير المشتريات (Deep Blue #0073b7) */}
          <div className="rounded-xl overflow-hidden shadow-2xs transition-all hover:shadow-md text-white bg-[#0073b7] flex flex-col justify-between group">
            <div className="p-4 pb-2 flex items-start justify-between">
              <div>
                <div className="text-3xl font-black font-mono leading-none tracking-tight">
                  {purchaseInvoices.length}
                </div>
                <div className="text-xs font-bold mt-1.5 opacity-95">فواتير المشتريات</div>
              </div>
              <ShoppingCart className="w-9 h-9 opacity-40 group-hover:scale-110 transition-transform" />
            </div>
            <button
              onClick={() => onNavigateTab('purchase-invoices')}
              className="w-full py-1.5 px-3 bg-black/15 hover:bg-black/25 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border-t border-white/10"
            >
              <span>الذهاب</span>
              <ArrowRight className="w-3.5 h-3.5 rotate-180" />
            </button>
          </div>

          {/* 6. فواتير مرتجع المشتريات (Teal #00c0ef) */}
          <div className="rounded-xl overflow-hidden shadow-2xs transition-all hover:shadow-md text-white bg-[#00c0ef] flex flex-col justify-between group">
            <div className="p-4 pb-2 flex items-start justify-between">
              <div>
                <div className="text-3xl font-black font-mono leading-none tracking-tight">
                  {purchaseReturns.length}
                </div>
                <div className="text-xs font-bold mt-1.5 opacity-95">فواتير مرتجع المشتريات</div>
              </div>
              <ChevronsUp className="w-9 h-9 opacity-40 group-hover:scale-110 transition-transform" />
            </div>
            <button
              onClick={() => onNavigateTab('purchase-invoices')}
              className="w-full py-1.5 px-3 bg-black/15 hover:bg-black/25 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border-t border-white/10"
            >
              <span>الذهاب</span>
              <ArrowRight className="w-3.5 h-3.5 rotate-180" />
            </button>
          </div>

          {/* 7. فواتير المبيعات (Indigo Blue #3c8dbc) */}
          <div className="rounded-xl overflow-hidden shadow-2xs transition-all hover:shadow-md text-white bg-[#3c8dbc] flex flex-col justify-between group">
            <div className="p-4 pb-2 flex items-start justify-between">
              <div>
                <div className="text-3xl font-black font-mono leading-none tracking-tight">
                  {salesInvoices.length}
                </div>
                <div className="text-xs font-bold mt-1.5 opacity-95">فواتير المبيعات</div>
              </div>
              <ShoppingBag className="w-9 h-9 opacity-40 group-hover:scale-110 transition-transform" />
            </div>
            <button
              onClick={() => onNavigateTab('sales-invoices')}
              className="w-full py-1.5 px-3 bg-black/15 hover:bg-black/25 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border-t border-white/10"
            >
              <span>الذهاب</span>
              <ArrowRight className="w-3.5 h-3.5 rotate-180" />
            </button>
          </div>

          {/* 8. فواتير مرتجع المبيعات (Rose/Pink #e91e63) */}
          <div className="rounded-xl overflow-hidden shadow-2xs transition-all hover:shadow-md text-white bg-[#e91e63] flex flex-col justify-between group">
            <div className="p-4 pb-2 flex items-start justify-between">
              <div>
                <div className="text-3xl font-black font-mono leading-none tracking-tight">
                  {salesReturns.length}
                </div>
                <div className="text-xs font-bold mt-1.5 opacity-95">فواتير مرتجع المبيعات</div>
              </div>
              <ChevronsDown className="w-9 h-9 opacity-40 group-hover:scale-110 transition-transform" />
            </div>
            <button
              onClick={() => onNavigateTab('sales-invoices')}
              className="w-full py-1.5 px-3 bg-black/15 hover:bg-black/25 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border-t border-white/10"
            >
              <span>الذهاب</span>
              <ArrowRight className="w-3.5 h-3.5 rotate-180" />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Row of 8 Financial Metric Summary Cards (Clean Light Theme, matching 00.png) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {/* إجمالي المشتريات */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500">إجمالي المشتريات</div>
            <div className="text-base font-black font-mono text-slate-900 mt-1">
              {formatCurrency(grossPurchasesAmount, currency)}
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#00c0ef] flex items-center justify-center text-white shrink-0 shadow-2xs">
            <ArrowDown className="w-5 h-5" />
          </div>
        </div>

        {/* إجمالي مرتجع المشتريات */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500">إجمالي مرتجع المشتريات</div>
            <div className="text-base font-black font-mono text-slate-900 mt-1">
              {formatCurrency(purchaseReturnsAmount, currency)}
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#00a65a] flex items-center justify-center text-white shrink-0 shadow-2xs">
            <ArrowUp className="w-5 h-5" />
          </div>
        </div>

        {/* صافي المشتريات */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500">صافي المشتريات</div>
            <div className="text-base font-black font-mono text-slate-900 mt-1">
              {formatCurrency(netPurchasesAmount, currency)}
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#00c0ef] flex items-center justify-center text-white shrink-0 shadow-2xs">
            <ShoppingCart className="w-5 h-5" />
          </div>
        </div>

        {/* سندات الصرف */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500">سندات الصرف</div>
            <div className="text-base font-black font-mono text-slate-900 mt-1">
              {formatCurrency(paymentVouchersAmount, currency)}
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#f39c12] flex items-center justify-center text-white shrink-0 shadow-2xs">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        {/* إجمالي المبيعات */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500">إجمالي المبيعات</div>
            <div className="text-base font-black font-mono text-slate-900 mt-1">
              {formatCurrency(grossSalesAmount, currency)}
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#00a65a] flex items-center justify-center text-white shrink-0 shadow-2xs">
            <ArrowUp className="w-5 h-5" />
          </div>
        </div>

        {/* إجمالي مرتجع المبيعات */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500">إجمالي مرتجع المبيعات</div>
            <div className="text-base font-black font-mono text-slate-900 mt-1">
              {formatCurrency(salesReturnsAmount, currency)}
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#00c0ef] flex items-center justify-center text-white shrink-0 shadow-2xs">
            <ArrowDown className="w-5 h-5" />
          </div>
        </div>

        {/* صافي المبيعات */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500">صافي المبيعات</div>
            <div className="text-base font-black font-mono text-slate-900 mt-1">
              {formatCurrency(netSalesAmount, currency)}
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#e91e63] flex items-center justify-center text-white shrink-0 shadow-2xs">
            <ShoppingBag className="w-5 h-5" />
          </div>
        </div>

        {/* سندات القبض */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500">سندات القبض</div>
            <div className="text-base font-black font-mono text-slate-900 mt-1">
              {formatCurrency(receiptVouchersAmount, currency)}
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#00e676] flex items-center justify-center text-white shrink-0 shadow-2xs">
            <Receipt className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 4. Monthly Analytics Charts Section (Exact Match to 00.png) */}
      <div className="space-y-6">
        {/* Chart 1: Line Chart: إحصائية (عدد فواتير المبيعات - عدد فواتير مرتجع المبيعات) في كل شهر */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <h3 className="text-sm font-black text-slate-900">
              إحصائية (عدد فواتير المبيعات - عدد فواتير مرتجع المبيعات) في كل شهر
            </h3>
            <div className="flex items-center gap-4 text-xs font-bold">
              <span className="flex items-center gap-1.5 text-[#3c8dbc]">
                <span className="w-3 h-3 rounded-full bg-[#3c8dbc]" />
                عدد فواتير المبيعات
              </span>
              <span className="flex items-center gap-1.5 text-[#00c0ef]">
                <span className="w-3 h-3 rounded-full bg-[#00c0ef]" />
                عدد فواتير مرتجع المبيعات
              </span>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyChartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#e2e8f0',
                    borderRadius: '12px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    fontSize: '12px',
                    direction: 'rtl',
                  }}
                  formatter={(value: any, name: any) => [
                    `${value} فاتورة`,
                    name === 'salesCount' ? 'فواتير المبيعات' : 'فواتير المرتجع',
                  ]}
                  labelFormatter={(label) => `الشهر: ${label}`}
                />
                <Line
                  type="monotone"
                  dataKey="salesCount"
                  name="salesCount"
                  stroke="#3c8dbc"
                  strokeWidth={2.5}
                  dot={{ r: 3.5, fill: '#3c8dbc' }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="returnsCount"
                  name="returnsCount"
                  stroke="#00c0ef"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#00c0ef' }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Bar Chart: إحصائية (إجمالي مبلغ فواتير المبيعات - إجمالي مبلغ فواتير مرتجع المبيعات) في كل شهر */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <h3 className="text-sm font-black text-slate-900">
              إحصائية (إجمالي مبلغ فواتير المبيعات - إجمالي مبلغ فواتير مرتجع المبيعات) في كل شهر
            </h3>
            <div className="flex items-center gap-4 text-xs font-bold">
              <span className="flex items-center gap-1.5 text-[#3c8dbc]">
                <span className="w-3 h-3 rounded-full bg-[#3c8dbc]" />
                إجمالي مبيعات ({currency})
              </span>
              <span className="flex items-center gap-1.5 text-[#00c0ef]">
                <span className="w-3 h-3 rounded-full bg-[#00c0ef]" />
                إجمالي مرتجعات ({currency})
              </span>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyChartData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickFormatter={(val) => (val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#e2e8f0',
                    borderRadius: '12px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    fontSize: '12px',
                    direction: 'rtl',
                  }}
                  formatter={(value: any, name: any) => [
                    formatCurrency(Number(value) || 0, currency),
                    name === 'salesAmount' ? 'إجمالي مبلغ المبيعات' : 'إجمالي مبلغ المرتجع',
                  ]}
                  labelFormatter={(label) => `الشهر: ${label}`}
                />
                <Bar
                  dataKey="salesAmount"
                  name="salesAmount"
                  fill="#3c8dbc"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={30}
                />
                <Bar
                  dataKey="returnsAmount"
                  name="returnsAmount"
                  fill="#00c0ef"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={30}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 5. One-Click Executive Reporting Hub Gateway */}
      <div className="bg-gradient-to-r from-emerald-900 to-slate-900 rounded-2xl p-5 text-white shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="space-y-1 text-center md:text-right">
          <div className="flex items-center justify-center md:justify-start gap-2">
            <FileBarChart className="w-5 h-5 text-emerald-400" />
            <h4 className="text-base font-black">مركز التقارير المجمعة بضغطة زر واحدة (Executive Hub)</h4>
          </div>
          <p className="text-xs text-slate-300">
            استخراج تقرير مبيعات العملاء والجمعيات، كشف الحساب المالي الموحد، وتقارير حركة المخزون بلحظة واحدة
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          <button
            onClick={() => onNavigateTab('reports')}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all cursor-pointer shadow-xs flex items-center gap-2 font-sans"
          >
            <span>فتح مركز التقارير المجمعة</span>
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
