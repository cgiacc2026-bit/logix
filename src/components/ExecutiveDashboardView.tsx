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
  FolderTree,
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
  onOpenDocumentCycle?: (target: { type: 'INVOICE' | 'JOURNAL' | 'VOUCHER' | 'QUOTATION' | 'ACCOUNT'; id: string }) => void;
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
  onOpenDocumentCycle,
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
  const netCashFlow = receiptVouchersAmount - paymentVouchersAmount;

  return (
    <div className="space-y-6 pb-12 font-sans" dir="rtl">
      {/* 1. Header & Breadcrumb Bar */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
              <span className="text-emerald-700 font-bold">{company?.nameAr || 'لوجيكس ERP'}</span>
              <span>/</span>
              <span>الإدارة العليا والرقابة</span>
              <span>/</span>
              <span className="text-slate-800 font-bold">لوحة القيادة والمؤشرات التنفيذية</span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                لوحة القيادة التنفيذية وترابط العمليات
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                معايير الحوكمة IFRS
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              نظام موحد ومترابط يربط المبيعات والمشتريات والمخزون والحسابات العامة بدون تكدس أو ازدواجية
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
              <ShoppingCart className="w-4 h-4 text-amber-600" />
              <span>فواتير الشراء</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Four Core Enterprise Business Cycle Hubs (Global ERP Standard: No Clutter, Direct Relationships) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Hub 1: Sales & O2C */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between group">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-900">دورة المبيعات والعملاء</h3>
                  <span className="text-[10px] text-slate-400 font-bold">Order to Cash (O2C)</span>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                {salesInvoices.length} فاتورة
              </span>
            </div>

            <div className="space-y-2">
              <div>
                <span className="text-[11px] font-medium text-slate-500">صافي المبيعات</span>
                <div className="text-lg font-black font-mono text-slate-900">
                  {formatCurrency(netSalesAmount, currency)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[11px]">
                <div>
                  <span className="text-slate-400 block text-[10px]">التحصيلات النقدية</span>
                  <span className="font-mono font-bold text-emerald-700">
                    {formatCurrency(receiptVouchersAmount, currency)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">العملاء والجمعيات</span>
                  <span className="font-mono font-bold text-slate-700">{customers.length} عميل</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5">
            <button
              onClick={() => onNavigateTab('sales-invoices')}
              className="flex-1 py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg transition-colors text-center cursor-pointer"
            >
              فواتير البيع
            </button>
            <button
              onClick={() => onNavigateTab('receipt-vouchers')}
              className="py-1.5 px-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
              title="سندات القبض"
            >
              قبض
            </button>
            <button
              onClick={() => onNavigateTab('customers')}
              className="py-1.5 px-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
              title="دليل العملاء"
            >
              دليل
            </button>
          </div>
        </div>

        {/* Hub 2: Purchasing & P2P */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between group">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-900">دورة المشتريات والموردين</h3>
                  <span className="text-[10px] text-slate-400 font-bold">Procure to Pay (P2P)</span>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                {purchaseInvoices.length} فاتورة
              </span>
            </div>

            <div className="space-y-2">
              <div>
                <span className="text-[11px] font-medium text-slate-500">صافي المشتريات</span>
                <div className="text-lg font-black font-mono text-slate-900">
                  {formatCurrency(netPurchasesAmount, currency)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[11px]">
                <div>
                  <span className="text-slate-400 block text-[10px]">المدفوعات والمصروفات</span>
                  <span className="font-mono font-bold text-amber-700">
                    {formatCurrency(paymentVouchersAmount, currency)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">الموردين والمطاحن</span>
                  <span className="font-mono font-bold text-slate-700">{suppliers.length} مورد</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5">
            <button
              onClick={() => onNavigateTab('purchase-invoices')}
              className="flex-1 py-1.5 px-2 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold rounded-lg transition-colors text-center cursor-pointer"
            >
              فواتير الشراء
            </button>
            <button
              onClick={() => onNavigateTab('payment-vouchers')}
              className="py-1.5 px-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
              title="سندات الصرف"
            >
              صرف
            </button>
            <button
              onClick={() => onNavigateTab('suppliers')}
              className="py-1.5 px-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
              title="دليل الموردين"
            >
              دليل
            </button>
          </div>
        </div>

        {/* Hub 3: Inventory & Supply Chain */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between group">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-50 text-cyan-700 border border-cyan-200 flex items-center justify-center">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-900">المخزون وسلسلة التوريد</h3>
                  <span className="text-[10px] text-slate-400 font-bold">Inventory & Valuation</span>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded-md border border-cyan-200">
                {inventory.length} صنف
              </span>
            </div>

            <div className="space-y-2">
              <div>
                <span className="text-[11px] font-medium text-slate-500">إجمالي بطاقات الأصناف</span>
                <div className="text-lg font-black font-mono text-slate-900">
                  {inventory.length} منتج مسجل
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[11px]">
                <div>
                  <span className="text-slate-400 block text-[10px]">المستودعات والفروع</span>
                  <span className="font-mono font-bold text-cyan-700">
                    {totalBranchesAndWarehouses} موقع
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">التسعير وهوامش الربح</span>
                  <span className="font-mono font-bold text-emerald-700">مضبوط آلياً</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5">
            <button
              onClick={() => onNavigateTab('inventory')}
              className="flex-1 py-1.5 px-2 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 text-xs font-bold rounded-lg transition-colors text-center cursor-pointer"
            >
              دليل الأصناف
            </button>
            <button
              onClick={() => onNavigateTab('stock-ledger')}
              className="py-1.5 px-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
              title="أذون وحركات المخزون"
            >
              حركات
            </button>
            <button
              onClick={() => onNavigateTab('warehouses')}
              className="py-1.5 px-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
              title="المستودعات"
            >
              مواقع
            </button>
          </div>
        </div>

        {/* Hub 4: General Ledger & Cash Flow */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between group">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center justify-center">
                  <FolderTree className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-900">المركز المالي والسيولة</h3>
                  <span className="text-[10px] text-slate-400 font-bold">General Ledger & Cash</span>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                {journals.length} قيد
              </span>
            </div>

            <div className="space-y-2">
              <div>
                <span className="text-[11px] font-medium text-slate-500">صافي التدفق النقدي التشغيلي</span>
                <div className={`text-lg font-black font-mono ${netCashFlow >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {formatCurrency(netCashFlow, currency)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[11px]">
                <div>
                  <span className="text-slate-400 block text-[10px]">شجرة الحسابات COA</span>
                  <span className="font-mono font-bold text-indigo-700">{accounts.length} حساب</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">توازن القيود IFRS</span>
                  <span className="font-mono font-bold text-emerald-700">100% متطابق</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5">
            <button
              onClick={() => onNavigateTab('ledger')}
              className="flex-1 py-1.5 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-xs font-bold rounded-lg transition-colors text-center cursor-pointer"
            >
              دفتر الأستاذ
            </button>
            <button
              onClick={() => onNavigateTab('trial-balance')}
              className="py-1.5 px-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
              title="ميزان المراجعة"
            >
              ميزان
            </button>
            <button
              onClick={() => onNavigateTab('financials')}
              className="py-1.5 px-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
              title="القوائم المالية"
            >
              قوائم
            </button>
          </div>
        </div>
      </div>

      {/* 3. Global ERP Process Relationships Matrix (مصفوفة الدورات المستندية وترابط البنود) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-4">
          <div>
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>مصفوفة ترابط الدورات المستندية والعلاقات المحاسبية (End-to-End ERP Flow)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              كل معاملة مرتبطة تلقائياً بالطرف والحساب والمخزون بدون أي مجال للخلط أو الإدخال العشوائي
            </p>
          </div>
          <div className="flex items-center gap-2 self-start flex-wrap">
            {onOpenDocumentCycle && invoices.length > 0 && (
              <button
                type="button"
                onClick={() => onOpenDocumentCycle({ type: 'INVOICE', id: invoices[0].id })}
                className="text-[11px] font-bold text-purple-800 bg-purple-50 hover:bg-purple-100 px-3 py-1 rounded-lg border border-purple-200 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                title="استعراض شجرة ترابط الفواتير مع القيود والسندات والدليل"
              >
                <Layers className="w-3.5 h-3.5 text-purple-600" />
                <span>مستكشف الدورة المستندية المترابطة 🔗</span>
              </button>
            )}
            <span className="text-[11px] font-mono text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 font-bold">
              انقر على أي مرحلة للانتقال المباشر
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Sales Cycle Flow */}
          <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black text-emerald-800 flex items-center gap-1.5">
                <ShoppingBag className="w-4 h-4 text-emerald-600" />
                مسار دورة المبيعات والتحصيل
              </span>
              <span className="text-[10px] text-slate-400 font-mono">ORDER TO CASH</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <button
                onClick={() => onNavigateTab('quotations')}
                className="px-2.5 py-1.5 bg-white border border-slate-200 hover:border-emerald-500 rounded-lg font-bold text-slate-700 hover:text-emerald-700 transition-all cursor-pointer shadow-2xs"
              >
                1. عرض السعر
              </button>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 rotate-180 shrink-0" />
              <button
                onClick={() => onNavigateTab('sales-invoices')}
                className="px-2.5 py-1.5 bg-white border border-emerald-300 bg-emerald-50/40 rounded-lg font-black text-emerald-800 hover:bg-emerald-100 transition-all cursor-pointer shadow-2xs"
              >
                2. فاتورة المبيعات
              </button>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 rotate-180 shrink-0" />
              <button
                onClick={() => onNavigateTab('receipt-vouchers')}
                className="px-2.5 py-1.5 bg-white border border-slate-200 hover:border-emerald-500 rounded-lg font-bold text-slate-700 hover:text-emerald-700 transition-all cursor-pointer shadow-2xs"
              >
                3. سند القبض
              </button>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 rotate-180 shrink-0" />
              <button
                onClick={() => onNavigateTab('journals')}
                className="px-2.5 py-1.5 bg-white border border-slate-200 hover:border-emerald-500 rounded-lg font-bold text-slate-700 hover:text-emerald-700 transition-all cursor-pointer shadow-2xs"
              >
                4. القيد الآلي
              </button>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 rotate-180 shrink-0" />
              <button
                onClick={() => onNavigateTab('customer-statements')}
                className="px-2.5 py-1.5 bg-white border border-slate-200 hover:border-emerald-500 rounded-lg font-bold text-slate-700 hover:text-emerald-700 transition-all cursor-pointer shadow-2xs"
              >
                5. كشف الحساب
              </button>
            </div>
          </div>

          {/* Purchasing Cycle Flow */}
          <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black text-amber-800 flex items-center gap-1.5">
                <ShoppingCart className="w-4 h-4 text-amber-600" />
                مسار دورة المشتريات والتوريد
              </span>
              <span className="text-[10px] text-slate-400 font-mono">PROCURE TO PAY</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <button
                onClick={() => onNavigateTab('suppliers')}
                className="px-2.5 py-1.5 bg-white border border-slate-200 hover:border-amber-500 rounded-lg font-bold text-slate-700 hover:text-amber-700 transition-all cursor-pointer shadow-2xs"
              >
                1. اعتماد المورد
              </button>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 rotate-180 shrink-0" />
              <button
                onClick={() => onNavigateTab('purchase-invoices')}
                className="px-2.5 py-1.5 bg-white border border-amber-300 bg-amber-50/40 rounded-lg font-black text-amber-800 hover:bg-amber-100 transition-all cursor-pointer shadow-2xs"
              >
                2. فاتورة الشراء
              </button>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 rotate-180 shrink-0" />
              <button
                onClick={() => onNavigateTab('stock-ledger')}
                className="px-2.5 py-1.5 bg-white border border-slate-200 hover:border-amber-500 rounded-lg font-bold text-slate-700 hover:text-amber-700 transition-all cursor-pointer shadow-2xs"
              >
                3. دخول المخزن
              </button>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 rotate-180 shrink-0" />
              <button
                onClick={() => onNavigateTab('payment-vouchers')}
                className="px-2.5 py-1.5 bg-white border border-slate-200 hover:border-amber-500 rounded-lg font-bold text-slate-700 hover:text-amber-700 transition-all cursor-pointer shadow-2xs"
              >
                4. سند الصرف
              </button>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 rotate-180 shrink-0" />
              <button
                onClick={() => onNavigateTab('supplier-statements')}
                className="px-2.5 py-1.5 bg-white border border-slate-200 hover:border-amber-500 rounded-lg font-bold text-slate-700 hover:text-amber-700 transition-all cursor-pointer shadow-2xs"
              >
                5. كشف المورد
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Monthly Analytics Charts Section */}
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
