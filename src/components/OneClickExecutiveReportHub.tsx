import React, { useState, useMemo } from 'react';
import {
  FileBarChart,
  Calendar,
  Search,
  Filter,
  Download,
  Printer,
  Sparkles,
  Building2,
  Users,
  Layers,
  Scale,
  DollarSign,
  ShoppingCart,
  ShoppingBag,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Eye,
  RefreshCw,
  Wallet,
  Coins,
  Package,
} from 'lucide-react';
import * as XLSX from 'xlsx';
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
} from '../types.js';
import { formatCurrency } from '../utils/formatters.ts';

interface OneClickExecutiveReportHubProps {
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
  onViewAccountStatement?: (entityId: string, entityType: 'CUSTOMER' | 'SUPPLIER') => void;
  onViewInvoice?: (invoice: Invoice) => void;
}

export type ExecutiveReportTab = 'customer-society-sales' | 'unified-account-statement' | 'inventory-cashbox';

export const OneClickExecutiveReportHub: React.FC<OneClickExecutiveReportHubProps> = ({
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
  onViewAccountStatement,
  onViewInvoice,
}) => {
  // Selected Report
  const [activeReport, setActiveReport] = useState<ExecutiveReportTab>('customer-society-sales');

  // Date Filters
  const today = new Date().toISOString().split('T')[0];
  const firstDayOfYear = `${new Date().getFullYear()}-01-01`;
  const firstDayOfMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;

  const [datePreset, setDatePreset] = useState<'ALL' | 'THIS_YEAR' | 'THIS_MONTH' | 'CUSTOM'>('ALL');
  const [startDate, setStartDate] = useState<string>(firstDayOfYear);
  const [endDate, setEndDate] = useState<string>(today);

  // Search & Filter Term
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEntityFilter, setSelectedEntityFilter] = useState<string>('ALL');

  // Instant Aggregate Refresh Trigger Animation
  const [isAggregating, setIsAggregating] = useState(false);
  const [lastAggregatedAt, setLastAggregatedAt] = useState<string>(new Date().toLocaleTimeString('ar-SA'));

  const handleTriggerAggregation = () => {
    setIsAggregating(true);
    setTimeout(() => {
      setIsAggregating(false);
      setLastAggregatedAt(new Date().toLocaleTimeString('ar-SA'));
    }, 250);
  };

  const handleDatePresetChange = (preset: 'ALL' | 'THIS_YEAR' | 'THIS_MONTH' | 'CUSTOM') => {
    setDatePreset(preset);
    if (preset === 'ALL') {
      setStartDate('2020-01-01');
      setEndDate(today);
    } else if (preset === 'THIS_YEAR') {
      setStartDate(firstDayOfYear);
      setEndDate(today);
    } else if (preset === 'THIS_MONTH') {
      setStartDate(firstDayOfMonth);
      setEndDate(today);
    }
  };

  // Valid Active Invoices (Excluding CANCELLED and VOID)
  const validInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (inv.status === 'CANCELLED' || inv.is_void || inv.is_deleted) return false;
      if (datePreset !== 'ALL') {
        if (inv.date < startDate || inv.date > endDate) return false;
      }
      return true;
    });
  }, [invoices, datePreset, startDate, endDate]);

  // Valid Active Vouchers
  const validVouchers = useMemo(() => {
    return vouchers.filter((v) => {
      if (v.status === 'CANCELLED' || v.is_void) return false;
      if (datePreset !== 'ALL') {
        if (v.date < startDate || v.date > endDate) return false;
      }
      return true;
    });
  }, [vouchers, datePreset, startDate, endDate]);

  // Valid Active Journals
  const validJournals = useMemo(() => {
    return journals.filter((j) => {
      if (j.status === 'CANCELLED' || (j as any).is_void) return false;
      if (datePreset !== 'ALL') {
        if (j.date < startDate || j.date > endDate) return false;
      }
      return true;
    });
  }, [journals, datePreset, startDate, endDate]);

  // =========================================================================
  // REPORT 1: Customer & Co-op Society Aggregated Sales
  // =========================================================================
  const customerSalesAggregated = useMemo(() => {
    const map: Record<
      string,
      {
        id: string;
        code: string;
        nameAr: string;
        isCoop: boolean;
        category: string;
        invoiceCount: number;
        returnCount: number;
        grossSales: number;
        returns: number;
        netSales: number;
        vatTotal: number;
        paidAmount: number;
        currentBalance: number;
      }
    > = {};

    // Seed with all customers
    customers.forEach((c) => {
      const isCoop =
        c.nameAr.includes('جمعية') ||
        c.nameAr.includes('تعاونية') ||
        (c.city && c.city.includes('جمعية')) ||
        (c.address && c.address.includes('جمعية'));

      map[c.id] = {
        id: c.id,
        code: c.code || 'CUST',
        nameAr: c.nameAr,
        isCoop,
        category: isCoop ? 'جمعية تعاونية' : 'عميل تجزئة / جملة',
        invoiceCount: 0,
        returnCount: 0,
        grossSales: 0,
        returns: 0,
        netSales: 0,
        vatTotal: 0,
        paidAmount: 0,
        currentBalance: Number(c.current_balance ?? c.currentBalance ?? c.balance) || 0,
      };
    });

    // Aggregate Sales Invoices
    validInvoices.forEach((inv) => {
      if (!inv.entityId) return;

      const isReturn =
        inv.type === 'SALES_RETURN' ||
        (inv.type === 'SALES' && (Number(inv.grandTotal) < 0 || inv.invoiceNumber.includes('RET')));
      const isSale = inv.type === 'SALES' && !isReturn;

      if (!isSale && !isReturn) return;

      if (!map[inv.entityId]) {
        const isCoop =
          inv.entityNameAr.includes('جمعية') ||
          inv.entityNameAr.includes('تعاونية');
        map[inv.entityId] = {
          id: inv.entityId,
          code: 'GEN',
          nameAr: inv.entityNameAr,
          isCoop,
          category: isCoop ? 'جمعية تعاونية' : 'عميل عام',
          invoiceCount: 0,
          returnCount: 0,
          grossSales: 0,
          returns: 0,
          netSales: 0,
          vatTotal: 0,
          paidAmount: 0,
          currentBalance: 0,
        };
      }

      const row = map[inv.entityId];
      const grandTotal = Math.abs(Number(inv.grandTotal) || 0);
      const vat = Math.abs(Number(inv.vatTotal) || 0);
      const paid = Math.abs(Number(inv.paidAmount) || 0);

      if (isSale) {
        row.invoiceCount += 1;
        row.grossSales += grandTotal;
        row.vatTotal += vat;
        row.paidAmount += paid;
      } else if (isReturn) {
        row.returnCount += 1;
        row.returns += grandTotal;
      }
      row.netSales = row.grossSales - row.returns;
    });

    // Also include vouchers for collected payments
    validVouchers.forEach((v) => {
      if (v.type === 'RECEIPT' && v.entityId && map[v.entityId]) {
        map[v.entityId].paidAmount += Number(v.amount) || 0;
      }
    });

    let list = Object.values(map);

    // Apply Filter
    if (selectedEntityFilter === 'COOP_ONLY') {
      list = list.filter((item) => item.isCoop);
    } else if (selectedEntityFilter === 'REGULAR_ONLY') {
      list = list.filter((item) => !item.isCoop);
    } else if (selectedEntityFilter === 'ACTIVE_ONLY') {
      list = list.filter((item) => item.invoiceCount > 0 || item.returnCount > 0);
    }

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (item) =>
          item.nameAr.toLowerCase().includes(q) ||
          item.code.toLowerCase().includes(q)
      );
    }

    return list.sort((a, b) => b.netSales - a.netSales);
  }, [customers, validInvoices, validVouchers, selectedEntityFilter, searchTerm]);

  // Report 1 Totals
  const report1Totals = useMemo(() => {
    return customerSalesAggregated.reduce(
      (acc, r) => {
        acc.grossSales += r.grossSales;
        acc.returns += r.returns;
        acc.netSales += r.netSales;
        acc.vatTotal += r.vatTotal;
        acc.paidAmount += r.paidAmount;
        acc.balance += r.currentBalance;
        acc.invoices += r.invoiceCount;
        acc.returnsCount += r.returnCount;
        return acc;
      },
      {
        grossSales: 0,
        returns: 0,
        netSales: 0,
        vatTotal: 0,
        paidAmount: 0,
        balance: 0,
        invoices: 0,
        returnsCount: 0,
      }
    );
  }, [customerSalesAggregated]);

  // =========================================================================
  // REPORT 2: Unified Financial Statement of Account (GL Ledger Movements)
  // =========================================================================
  const [selectedAccountId, setSelectedAccountId] = useState<string>('ALL');

  const unifiedStatementRows = useMemo(() => {
    interface StatementRow {
      id: string;
      date: string;
      entryNumber: string;
      docType: string;
      description: string;
      accountCode: string;
      accountNameAr: string;
      debit: number;
      credit: number;
      runningBalance: number;
    }

    const rows: StatementRow[] = [];

    // Traverse all valid journal entries
    validJournals.forEach((j) => {
      j.lines.forEach((line) => {
        if (selectedAccountId !== 'ALL' && line.accountId !== selectedAccountId) {
          return;
        }

        if (searchTerm) {
          const q = searchTerm.toLowerCase();
          const match =
            (line.accountNameAr && line.accountNameAr.toLowerCase().includes(q)) ||
            (line.accountCode && line.accountCode.toLowerCase().includes(q)) ||
            (j.description && j.description.toLowerCase().includes(q)) ||
            (j.entryNumber && j.entryNumber.toLowerCase().includes(q));
          if (!match) return;
        }

        rows.push({
          id: `${j.id}-${line.id}`,
          date: j.date,
          entryNumber: j.entryNumber,
          docType: j.sourceModule || 'قيد يومية عام',
          description: line.memo || j.description || 'حركة مالية مرحلة',
          accountCode: line.accountCode,
          accountNameAr: line.accountNameAr,
          debit: Number(line.debit) || 0,
          credit: Number(line.credit) || 0,
          runningBalance: 0,
        });
      });
    });

    // Sort chronologically
    rows.sort((a, b) => a.date.localeCompare(b.date));

    // Calculate Running Balance
    let balance = 0;
    rows.forEach((r) => {
      balance += r.debit - r.credit;
      r.runningBalance = balance;
    });

    return rows;
  }, [validJournals, selectedAccountId, searchTerm]);

  const report2Totals = useMemo(() => {
    return unifiedStatementRows.reduce(
      (acc, r) => {
        acc.debit += r.debit;
        acc.credit += r.credit;
        return acc;
      },
      { debit: 0, credit: 0 }
    );
  }, [unifiedStatementRows]);

  // =========================================================================
  // REPORT 3: Inventory Movements & Cashbox Balances
  // =========================================================================
  const cashboxAccounts = useMemo(() => {
    return accounts.filter((a) => {
      const code = a.code || '';
      return code.startsWith('1101') || code.startsWith('1102') || code.startsWith('111');
    });
  }, [accounts]);

  const inventoryValuationRows = useMemo(() => {
    return inventory.map((item) => {
      const currentQty = Number(item.quantity) || 0;
      const costPrice = Number(item.costPrice) || 0;
      const totalValuation = currentQty * costPrice;

      return {
        id: item.id,
        sku: item.sku || 'N/A',
        nameAr: item.nameAr,
        category: item.category || 'عام',
        unit: item.unit || 'حبة',
        currentQty,
        costPrice,
        salePrice: Number(item.salePrice) || 0,
        totalValuation,
        minStockLevel: Number((item as any).minStockLevel ?? item.minQuantityAlert ?? 0),
      };
    });
  }, [inventory]);

  const totalInventoryValuation = useMemo(() => {
    return inventoryValuationRows.reduce((sum, i) => sum + i.totalValuation, 0);
  }, [inventoryValuationRows]);

  // =========================================================================
  // EXCEL EXPORT (Using XLSX)
  // =========================================================================
  const handleExportToExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      if (activeReport === 'customer-society-sales') {
        const data = customerSalesAggregated.map((r) => ({
          'كود العميل': r.code,
          'اسم العميل / الجمعية': r.nameAr,
          'التصنيف': r.category,
          'عدد الفواتير': r.invoiceCount,
          'عدد المرتجعات': r.returnCount,
          [`إجمالي المبيعات (${currency})`]: r.grossSales,
          [`إجمالي المرتجعات (${currency})`]: r.returns,
          [`صافي المبيعات (${currency})`]: r.netSales,
          [`الضرائب (${currency})`]: r.vatTotal,
          [`المحصل (${currency})`]: r.paidAmount,
          [`الرصيد الحالي (${currency})`]: r.currentBalance,
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, 'مبيعات_العملاء_المجمعة');
        XLSX.writeFile(wb, `Executive_Sales_Report_${today}.xlsx`);
      } else if (activeReport === 'unified-account-statement') {
        const data = unifiedStatementRows.map((r) => ({
          'التاريخ': r.date,
          'رقم السند/القيد': r.entryNumber,
          'نوع المستند': r.docType,
          'كود الحساب': r.accountCode,
          'اسم الحساب': r.accountNameAr,
          'البيان': r.description,
          [`مدين (${currency})`]: r.debit,
          [`دائن (${currency})`]: r.credit,
          [`الرصيد التراكمي (${currency})`]: r.runningBalance,
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, 'كشف_الحساب_الموحد');
        XLSX.writeFile(wb, `Unified_Financial_Statement_${today}.xlsx`);
      } else {
        const data = inventoryValuationRows.map((r) => ({
          'كود الصنف': r.sku,
          'اسم الصنف': r.nameAr,
          'التصنيف': r.category,
          'الوحدة': r.unit,
          'الرصيد المتاح': r.currentQty,
          [`سعر التكلفة (${currency})`]: r.costPrice,
          [`سعر البيع (${currency})`]: r.salePrice,
          [`إجمالي القيمة التقديرية (${currency})`]: r.totalValuation,
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, 'حركة_وتقييم_المخزون');
        XLSX.writeFile(wb, `Inventory_Valuation_Report_${today}.xlsx`);
      }
    } catch (err) {
      console.error('Export Error:', err);
      alert('حدث خطأ أثناء تصدير ملف الإكسيل');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12 font-sans" dir="rtl">
      {/* 1. Executive Top Header */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs no-print">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
              <span className="text-emerald-700 font-bold">{company.nameAr}</span>
              <span>/</span>
              <span>مركز الإدارة التنفيذية</span>
              <span>/</span>
              <span className="text-slate-800 font-bold">التقارير المجمعة</span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
                <FileBarChart className="w-6 h-6 text-emerald-600" />
                <span>مركز التقارير المجمعة بضغطة زر واحدة</span>
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Sparkles className="w-3.5 h-3.5" />
                One-Click Aggregated Reports
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              توليد وتجميع فوري لتقارير المبيعات، كشوف الحسابات الموحدة، والمخزون مع استبعاد تلقائي للحركات الملغاة
            </p>
          </div>

          {/* Action Buttons: Instant Aggregate, Print, Excel */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleTriggerAggregation}
              disabled={isAggregating}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center gap-2 transition-all cursor-pointer"
              title="إعادة التجميع والفرز اللحظي لكافة السجلات"
            >
              <RefreshCw className={`w-4 h-4 ${isAggregating ? 'animate-spin' : ''}`} />
              <span>{isAggregating ? 'جاري التجميع...' : 'تجميع واستخراج فوري'}</span>
            </button>

            <button
              onClick={handleExportToExcel}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs flex items-center gap-2 transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>تصدير Excel</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs flex items-center gap-2 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>طباعة A4</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Primary 3-Report Selection Switcher */}
      <div className="bg-white rounded-2xl p-2 border border-slate-200 shadow-2xs no-print">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {/* Report 1: Sales to Customers & Co-op Societies */}
          <button
            onClick={() => setActiveReport('customer-society-sales')}
            className={`p-3.5 rounded-xl text-right transition-all flex items-start gap-3 cursor-pointer border ${
              activeReport === 'customer-society-sales'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-950 shadow-xs'
                : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100 text-slate-700'
            }`}
          >
            <div
              className={`p-2.5 rounded-lg shrink-0 ${
                activeReport === 'customer-society-sales'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 border border-slate-200'
              }`}
            >
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-black">تقرير مبيعات العملاء والجمعيات المجمع</div>
              <div className="text-[11px] text-slate-500 mt-0.5 font-medium">
                تجميع المبيعات والمرتجعات وصافي المسحوبات والأرصدة
              </div>
            </div>
          </button>

          {/* Report 2: Unified Financial Account Statement */}
          <button
            onClick={() => setActiveReport('unified-account-statement')}
            className={`p-3.5 rounded-xl text-right transition-all flex items-start gap-3 cursor-pointer border ${
              activeReport === 'unified-account-statement'
                ? 'bg-sky-50 border-sky-300 text-sky-950 shadow-xs'
                : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100 text-slate-700'
            }`}
          >
            <div
              className={`p-2.5 rounded-lg shrink-0 ${
                activeReport === 'unified-account-statement'
                  ? 'bg-sky-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 border border-slate-200'
              }`}
            >
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-black">كشف الحساب المالي الموحد (General Ledger)</div>
              <div className="text-[11px] text-slate-500 mt-0.5 font-medium">
                دفتر الأستاذ والقيود اليومية المتوازنة والرصيد التراكمي
              </div>
            </div>
          </button>

          {/* Report 3: Inventory Movement & Cashbox */}
          <button
            onClick={() => setActiveReport('inventory-cashbox')}
            className={`p-3.5 rounded-xl text-right transition-all flex items-start gap-3 cursor-pointer border ${
              activeReport === 'inventory-cashbox'
                ? 'bg-amber-50 border-amber-300 text-amber-950 shadow-xs'
                : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100 text-slate-700'
            }`}
          >
            <div
              className={`p-2.5 rounded-lg shrink-0 ${
                activeReport === 'inventory-cashbox'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 border border-slate-200'
              }`}
            >
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-black">تقرير حركة المخزون وأرصدة الصناديق</div>
              <div className="text-[11px] text-slate-500 mt-0.5 font-medium">
                أرصدة الخزينة والبنوك وتقييم المخزون الحالي
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* 3. Fast Filters & Date Presets */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 no-print">
        {/* Date presets */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-slate-500 ml-1">الفترة الزمنية:</span>
          {(['ALL', 'THIS_YEAR', 'THIS_MONTH', 'CUSTOM'] as const).map((p) => {
            const labels: Record<string, string> = {
              ALL: 'كافة الفترات',
              THIS_YEAR: 'هذا العام',
              THIS_MONTH: 'هذا الشهر',
              CUSTOM: 'فترة مخصصة',
            };
            return (
              <button
                key={p}
                onClick={() => handleDatePresetChange(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  datePreset === p
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {labels[p]}
              </button>
            );
          })}
        </div>

        {/* Custom Date Inputs */}
        {datePreset === 'CUSTOM' && (
          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold text-slate-500">من:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-mono font-bold"
            />
            <span className="font-bold text-slate-500">إلى:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-mono font-bold"
            />
          </div>
        )}

        {/* Instant Search Bar */}
        <div className="relative min-w-[220px]">
          <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="بحث بالاسم أو الكود..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-9 pl-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* 4. Active Report Content Section */}

      {/* REPORT 1: Customer & Society Sales */}
      {activeReport === 'customer-society-sales' && (
        <div className="space-y-4">
          {/* Executive Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-xs font-bold text-slate-500">إجمالي المبيعات الصادرة</div>
              <div className="text-base sm:text-lg font-black font-mono text-slate-900 mt-1">
                {formatCurrency(report1Totals.grossSales, currency)}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {report1Totals.invoices} فاتورة بيع
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-xs font-bold text-slate-500">إجمالي المرتجعات</div>
              <div className="text-base sm:text-lg font-black font-mono text-rose-600 mt-1">
                {formatCurrency(report1Totals.returns, currency)}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {report1Totals.returnsCount} فاتورة مرتجع
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-xs font-bold text-slate-500">صافي المبيعات المعتمدة</div>
              <div className="text-base sm:text-lg font-black font-mono text-emerald-700 mt-1">
                {formatCurrency(report1Totals.netSales, currency)}
              </div>
              <div className="text-[10px] text-emerald-600 font-bold mt-0.5">
                (المبيعات - المرتجعات)
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-xs font-bold text-slate-500">إجمالي الأرصدة المستحقة</div>
              <div className="text-base sm:text-lg font-black font-mono text-blue-700 mt-1">
                {formatCurrency(report1Totals.balance, currency)}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                أرصدة ذمم العملاء الحالية
              </div>
            </div>
          </div>

          {/* Filter Sub-toggle */}
          <div className="flex items-center gap-2 no-print">
            <span className="text-xs font-bold text-slate-600">تصنيف العرض:</span>
            <button
              onClick={() => setSelectedEntityFilter('ALL')}
              className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                selectedEntityFilter === 'ALL'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              كافة العملاء والجمعيات ({customerSalesAggregated.length})
            </button>
            <button
              onClick={() => setSelectedEntityFilter('COOP_ONLY')}
              className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                selectedEntityFilter === 'COOP_ONLY'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              الجمعيات التعاونية فقط
            </button>
            <button
              onClick={() => setSelectedEntityFilter('ACTIVE_ONLY')}
              className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                selectedEntityFilter === 'ACTIVE_ONLY'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              ذوو الحركات فقط
            </button>
          </div>

          {/* Clean Executive Light Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-black">
                    <th className="py-3 px-4">كود</th>
                    <th className="py-3 px-4">اسم العميل / الجمعية</th>
                    <th className="py-3 px-4">التصنيف</th>
                    <th className="py-3 px-4 text-center">الفواتير</th>
                    <th className="py-3 px-4 text-center">المرتجعات</th>
                    <th className="py-3 px-4 text-left">إجمالي المبيعات</th>
                    <th className="py-3 px-4 text-left">المرتجع</th>
                    <th className="py-3 px-4 text-left">صافي المبيعات</th>
                    <th className="py-3 px-4 text-left">الرصيد المستحق</th>
                    <th className="py-3 px-4 text-center no-print">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customerSalesAggregated.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-500 font-bold">
                        لا توجد مبيعات مطابقة لمعايير البحث المحددة
                      </td>
                    </tr>
                  ) : (
                    customerSalesAggregated.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-500">{row.code}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          <div className="flex items-center gap-2">
                            <span>{row.nameAr}</span>
                            {row.isCoop && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                جمعية
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-medium">{row.category}</td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-slate-700">
                          {row.invoiceCount}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-rose-600">
                          {row.returnCount}
                        </td>
                        <td className="py-3 px-4 text-left font-mono font-bold text-slate-900">
                          {formatCurrency(row.grossSales, currency)}
                        </td>
                        <td className="py-3 px-4 text-left font-mono font-bold text-rose-600">
                          {row.returns > 0 ? formatCurrency(row.returns, currency) : '0.000'}
                        </td>
                        <td className="py-3 px-4 text-left font-mono font-black text-emerald-700 bg-emerald-50/30">
                          {formatCurrency(row.netSales, currency)}
                        </td>
                        <td className="py-3 px-4 text-left font-mono font-bold text-blue-700">
                          {formatCurrency(row.currentBalance, currency)}
                        </td>
                        <td className="py-3 px-4 text-center no-print">
                          {onViewAccountStatement && (
                            <button
                              onClick={() => onViewAccountStatement(row.id, 'CUSTOMER')}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-700 transition-colors cursor-pointer"
                              title="عرض كشف الحساب المالي الفوري"
                            >
                              كشف الحساب
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300">
                    <td colSpan={3} className="py-3 px-4">الإجمالي العام المعتمد</td>
                    <td className="py-3 px-4 text-center font-mono">{report1Totals.invoices}</td>
                    <td className="py-3 px-4 text-center font-mono text-rose-600">{report1Totals.returnsCount}</td>
                    <td className="py-3 px-4 text-left font-mono">{formatCurrency(report1Totals.grossSales, currency)}</td>
                    <td className="py-3 px-4 text-left font-mono text-rose-600">{formatCurrency(report1Totals.returns, currency)}</td>
                    <td className="py-3 px-4 text-left font-mono text-emerald-800 text-sm">{formatCurrency(report1Totals.netSales, currency)}</td>
                    <td className="py-3 px-4 text-left font-mono text-blue-800">{formatCurrency(report1Totals.balance, currency)}</td>
                    <td className="no-print"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* REPORT 2: Unified Financial Account Statement */}
      {activeReport === 'unified-account-statement' && (
        <div className="space-y-4">
          {/* Account selector bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 no-print">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600">اختر الحساب المستهدف:</span>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold bg-white focus:outline-none cursor-pointer"
              >
                <option value="ALL">كافة الحسابات المالية النشطة (All Accounts)</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} - {a.nameAr}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono font-bold">
              <span className="text-slate-600">
                إجمالي المدين: <strong className="text-emerald-700">{formatCurrency(report2Totals.debit, currency)}</strong>
              </span>
              <span className="text-slate-600">
                إجمالي الدائن: <strong className="text-rose-700">{formatCurrency(report2Totals.credit, currency)}</strong>
              </span>
            </div>
          </div>

          {/* Clean Light Statement Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-black">
                    <th className="py-3 px-4">التاريخ</th>
                    <th className="py-3 px-4">رقم السند / القيد</th>
                    <th className="py-3 px-4">نوع المستند</th>
                    <th className="py-3 px-4">الحساب المالي</th>
                    <th className="py-3 px-4">البيان / الوصف</th>
                    <th className="py-3 px-4 text-left">مدين</th>
                    <th className="py-3 px-4 text-left">دائن</th>
                    <th className="py-3 px-4 text-left">الرصيد التراكمي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {unifiedStatementRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500 font-bold">
                        لا توجد حركات قيود يومية مسجلة لهذه المعايير
                      </td>
                    </tr>
                  ) : (
                    unifiedStatementRows.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-mono text-slate-600">{row.date}</td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-800">{row.entryNumber}</td>
                        <td className="py-3 px-4 text-slate-600">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-[10px] font-bold">
                            {row.docType}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          <span className="font-mono text-slate-500 ml-1">{row.accountCode}</span>
                          <span>{row.accountNameAr}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-700 max-w-xs truncate">{row.description}</td>
                        <td className="py-3 px-4 text-left font-mono font-bold text-emerald-700">
                          {row.debit > 0 ? formatCurrency(row.debit, currency) : '-'}
                        </td>
                        <td className="py-3 px-4 text-left font-mono font-bold text-rose-600">
                          {row.credit > 0 ? formatCurrency(row.credit, currency) : '-'}
                        </td>
                        <td className="py-3 px-4 text-left font-mono font-black text-slate-900 bg-slate-50/50">
                          {formatCurrency(row.runningBalance, currency)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300">
                    <td colSpan={5} className="py-3 px-4">إجمالي حركات الفترة المحددة</td>
                    <td className="py-3 px-4 text-left font-mono text-emerald-800">
                      {formatCurrency(report2Totals.debit, currency)}
                    </td>
                    <td className="py-3 px-4 text-left font-mono text-rose-800">
                      {formatCurrency(report2Totals.credit, currency)}
                    </td>
                    <td className="py-3 px-4 text-left font-mono text-slate-900">
                      {formatCurrency(report2Totals.debit - report2Totals.credit, currency)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* REPORT 3: Inventory Movement & Cashbox Balances */}
      {activeReport === 'inventory-cashbox' && (
        <div className="space-y-6">
          {/* Section A: أرصدة الصناديق والبنوك الحية */}
          <div>
            <h3 className="text-sm font-black text-slate-900 mb-3 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-emerald-600" />
              <span>أرصدة الصناديق النقدية والحسابات البنكية المعتمدة</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
              {cashboxAccounts.map((acc) => {
                const bal = Number(acc.current_balance ?? acc.currentBalance ?? acc.balance) || 0;
                return (
                  <div key={acc.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-slate-500">{acc.code}</span>
                      <Coins className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="text-sm font-black text-slate-900 mt-1">{acc.nameAr}</div>
                    <div className="text-base font-black font-mono text-emerald-700 mt-2">
                      {formatCurrency(bal, currency)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section B: تقييم المخزون */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-600" />
                <span>تقرير أرصدة وتقييم المخزون السلعي</span>
              </h3>
              <div className="text-xs font-bold text-slate-600">
                إجمالي القيمة التقديرية للمخزون:{' '}
                <strong className="text-slate-900 font-mono text-sm">
                  {formatCurrency(totalInventoryValuation, currency)}
                </strong>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-black">
                      <th className="py-3 px-4">كود الصنف (SKU)</th>
                      <th className="py-3 px-4">اسم الصنف</th>
                      <th className="py-3 px-4">التصنيف</th>
                      <th className="py-3 px-4">الوحدة</th>
                      <th className="py-3 px-4 text-center">الرصيد الحالي</th>
                      <th className="py-3 px-4 text-left">سعر التكلفة</th>
                      <th className="py-3 px-4 text-left">سعر البيع</th>
                      <th className="py-3 px-4 text-left">إجمالي القيمة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {inventoryValuationRows.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-500">{item.sku}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">{item.nameAr}</td>
                        <td className="py-3 px-4 text-slate-600">{item.category}</td>
                        <td className="py-3 px-4 text-slate-600">{item.unit}</td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-slate-900">
                          {item.currentQty}
                        </td>
                        <td className="py-3 px-4 text-left font-mono text-slate-700">
                          {formatCurrency(item.costPrice, currency)}
                        </td>
                        <td className="py-3 px-4 text-left font-mono text-slate-700">
                          {formatCurrency(item.salePrice, currency)}
                        </td>
                        <td className="py-3 px-4 text-left font-mono font-black text-emerald-700 bg-emerald-50/30">
                          {formatCurrency(item.totalValuation, currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
