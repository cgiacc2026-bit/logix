import React, { useState, useMemo } from 'react';
import {
  Invoice,
  PaymentVoucher,
  Customer,
  Supplier,
  Account,
  JournalEntry,
  InventoryItem,
  CompanyProfile
} from '../types.js';
import { formatCurrency } from '../utils/formatters.ts';
import {
  TrendingUp,
  ShoppingCart,
  Receipt,
  Users,
  Building2,
  DollarSign,
  Calendar,
  Search,
  Filter,
  Download,
  Printer,
  ChevronDown,
  ChevronUp,
  Eye,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  Sparkles,
  Package,
  Activity,
  FileSpreadsheet,
  ArrowLeftRight,
  Scale,
} from 'lucide-react';
import { GlCustomerBalancesReport } from './reports/GlCustomerBalancesReport.tsx';
import { GlInventoryValuationReport } from './reports/GlInventoryValuationReport.tsx';
import { GlPostedSalesReport } from './reports/GlPostedSalesReport.tsx';
import { getCalculatedCustomerBalance, getCalculatedSupplierBalance, isDocMatchingEntity } from '../services/statementService.ts';

interface OperationalReportsProps {
  invoices: Invoice[];
  vouchers: PaymentVoucher[];
  customers: Customer[];
  suppliers: Supplier[];
  accounts: Account[];
  journals: JournalEntry[];
  inventory: InventoryItem[];
  company: CompanyProfile | null;
  currency: string;
  onViewInvoice?: (invoice: Invoice) => void;
  onViewAccountStatement?: (entityId: string, entityType: 'CUSTOMER' | 'SUPPLIER') => void;
}

export type ReportCategory = 'customers' | 'sales' | 'inventory-valuation' | 'purchases' | 'expenses' | 'suppliers';

export const OperationalReportsView: React.FC<OperationalReportsProps> = ({
  invoices,
  vouchers,
  customers,
  suppliers,
  accounts,
  journals,
  inventory,
  company,
  currency,
  onViewInvoice,
  onViewAccountStatement,
}) => {
  const [activeReport, setActiveReport] = useState<ReportCategory>('customers');
  const [salesReportMode, setSalesReportMode] = useState<'gl' | 'invoices'>('gl');

  // Date Range Filters
  const today = new Date().toISOString().split('T')[0];
  const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const firstDayOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];

  const [datePreset, setDatePreset] = useState<'TODAY' | 'THIS_MONTH' | 'THIS_YEAR' | 'ALL' | 'CUSTOM'>('THIS_YEAR');
  const [startDate, setStartDate] = useState<string>(firstDayOfYear);
  const [endDate, setEndDate] = useState<string>(today);

  // Search & Filter criteria
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEntityId, setSelectedEntityId] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Handle Preset Change
  const handlePresetChange = (preset: 'TODAY' | 'THIS_MONTH' | 'THIS_YEAR' | 'ALL' | 'CUSTOM') => {
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

  // Helper date filter
  const isDateInRange = (dateStr: string) => {
    if (datePreset === 'ALL') return true;
    if (!dateStr) return false;
    const d = dateStr.split('T')[0];
    return d >= startDate && d <= endDate;
  };

  // -------------------------------------------------------------
  // 0. الاستبعاد الصارم للعمليات والقيود الملغاة (Strict Cancellation Filtering)
  // -------------------------------------------------------------
  const validInvoices = useMemo(() => {
    return (invoices || []).filter(
      (inv) => inv && inv.status !== 'CANCELLED' && !inv.is_void && (inv as any).status !== 'VOID'
    );
  }, [invoices]);

  const validVouchers = useMemo(() => {
    return (vouchers || []).filter(
      (v) => v && v.status !== 'CANCELLED' && !v.is_void && (v as any).status !== 'VOID'
    );
  }, [vouchers]);

  const validJournals = useMemo(() => {
    return (journals || []).filter(
      (j) =>
        j &&
        (j.status as string) === 'POSTED' &&
        (j.status as string) !== 'CANCELLED' &&
        (j.status as string) !== 'REVERSED' &&
        !(j as any).is_void &&
        !j.entryNumber?.toUpperCase().startsWith('REV-')
    );
  }, [journals]);

  // -------------------------------------------------------------
  // 1. SALES REPORT DATA
  // -------------------------------------------------------------
  const salesInvoices = useMemo(() => {
    return validInvoices.filter((inv) => {
      const isSales = inv.type === 'SALES' || inv.type === 'SALES_RETURN';
      if (!isSales) return false;
      if (!isDateInRange(inv.date)) return false;
      if (selectedEntityId !== 'ALL' && inv.entityId !== selectedEntityId) return false;
      if (selectedStatus !== 'ALL' && inv.status !== selectedStatus) return false;
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesNo = (inv.invoiceNumber || '').toLowerCase().includes(term);
        const matchesName = (inv.entityNameAr || '').toLowerCase().includes(term);
        if (!matchesNo && !matchesName) return false;
      }
      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [validInvoices, startDate, endDate, datePreset, selectedEntityId, selectedStatus, searchTerm]);

  const salesStats = useMemo(() => {
    let grossSales = 0;
    let returns = 0;
    let totalPaid = 0;
    let totalDue = 0;
    let totalDiscount = 0;
    let invoiceCount = 0;

    salesInvoices.forEach((inv) => {
      const total = Number(inv.grandTotal) || 0;
      const paid = Number(inv.paidAmount) || 0;
      const due = Number(inv.dueAmount) || 0;
      const disc = Number(inv.discountTotal) || 0;

      if (inv.type === 'SALES') {
        grossSales += total;
        totalPaid += paid;
        totalDue += due;
        totalDiscount += disc;
        invoiceCount += 1;
      } else if (inv.type === 'SALES_RETURN') {
        returns += total;
      }
    });

    const netSales = grossSales - returns;
    const avgInvoiceValue = invoiceCount > 0 ? grossSales / invoiceCount : 0;

    return { grossSales, returns, netSales, totalPaid, totalDue, totalDiscount, invoiceCount, avgInvoiceValue };
  }, [salesInvoices]);

  // Top Selling Items in Sales
  const topSellingItems = useMemo(() => {
    const itemMap = new Map<string, { nameAr: string; qty: number; totalRev: number; unit: string }>();
    salesInvoices.filter((inv) => inv.type === 'SALES').forEach((inv) => {
      (inv.lines || []).forEach((line) => {
        const existing = itemMap.get(line.itemId) || {
          nameAr: line.itemNameAr || 'صنف',
          qty: 0,
          totalRev: 0,
          unit: line.unit || 'حبة',
        };
        existing.qty += Number(line.quantity) || 0;
        existing.totalRev += Number(line.total) || 0;
        itemMap.set(line.itemId, existing);
      });
    });

    return Array.from(itemMap.values())
      .sort((a, b) => b.totalRev - a.totalRev)
      .slice(0, 5);
  }, [salesInvoices]);

  // -------------------------------------------------------------
  // 2. PURCHASES REPORT DATA
  // -------------------------------------------------------------
  const purchaseInvoices = useMemo(() => {
    return validInvoices.filter((inv) => {
      const isPurchase = inv.type === 'PURCHASE' || inv.type === 'PURCHASE_RETURN';
      if (!isPurchase) return false;
      if (!isDateInRange(inv.date)) return false;
      if (selectedEntityId !== 'ALL' && inv.entityId !== selectedEntityId) return false;
      if (selectedStatus !== 'ALL' && inv.status !== selectedStatus) return false;
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesNo = (inv.invoiceNumber || '').toLowerCase().includes(term);
        const matchesName = (inv.entityNameAr || '').toLowerCase().includes(term);
        if (!matchesNo && !matchesName) return false;
      }
      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [validInvoices, startDate, endDate, datePreset, selectedEntityId, selectedStatus, searchTerm]);

  const purchaseStats = useMemo(() => {
    let grossPurchases = 0;
    let purchaseReturns = 0;
    let totalPaidToSuppliers = 0;
    let totalDueToSuppliers = 0;
    let invoiceCount = 0;

    purchaseInvoices.forEach((inv) => {
      const total = Number(inv.grandTotal) || 0;
      const paid = Number(inv.paidAmount) || 0;
      const due = Number(inv.dueAmount) || 0;

      if (inv.type === 'PURCHASE') {
        grossPurchases += total;
        totalPaidToSuppliers += paid;
        totalDueToSuppliers += due;
        invoiceCount += 1;
      } else if (inv.type === 'PURCHASE_RETURN') {
        purchaseReturns += total;
      }
    });

    const netPurchases = grossPurchases - purchaseReturns;
    return { grossPurchases, purchaseReturns, netPurchases, totalPaidToSuppliers, totalDueToSuppliers, invoiceCount };
  }, [purchaseInvoices]);

  // -------------------------------------------------------------
  // 3. EXPENSES & OPERATIONS REPORT DATA
  // -------------------------------------------------------------
  const expenseRecords = useMemo(() => {
    const records: {
      id: string;
      date: string;
      docNumber: string;
      docType: 'سند صرف' | 'قيد محاسبي';
      categoryName: string;
      beneficiary: string;
      accountName: string;
      amount: number;
      notes: string;
    }[] = [];

    // 1. From Payment Vouchers for Expenses / Operations
    validVouchers
      .filter((v) => v.type === 'PAYMENT' && isDateInRange(v.date))
      .forEach((v) => {
        records.push({
          id: v.id,
          date: v.date,
          docNumber: v.voucherNumber,
          docType: 'سند صرف',
          categoryName: v.entityType === 'SUPPLIER' ? 'سداد موردين ومشتريات' : 'مصروفات تشغيلية وعمومية',
          beneficiary: v.entityNameAr || 'مستفيد',
          accountName: v.bankAccountId ? 'الخزينة / البنك' : 'حساب المدفوعات',
          amount: Number(v.amount) || 0,
          notes: v.notes || v.reference || '—',
        });
      });

    // 2. From Posted Journals targeting Expense Accounts (5000 series)
    validJournals
      .filter((j) => isDateInRange(j.date))
      .forEach((j) => {
        (j.lines || []).forEach((line) => {
          const code = line.accountCode || '';
          const acc = accounts.find((a) => a.id === line.accountId || a.code === code);
          const isExpenseAcc = code.startsWith('5') || acc?.category === 'EXPENSE';
          const debit = Number(line.debit) || 0;

          if (isExpenseAcc && debit > 0) {
            records.push({
              id: `${j.id}-${line.id || Math.random()}`,
              date: j.date,
              docNumber: j.entryNumber || (j as any).journalNumber || j.reference || j.id.slice(0, 8),
              docType: 'قيد محاسبي',
              categoryName: acc?.nameAr || 'مصروفات تشغيلية',
              beneficiary: line.entityNameAr || j.reference || 'المنشأة',
              accountName: `${acc?.code || ''} - ${acc?.nameAr || 'حساب المصروف'}`,
              amount: debit,
              notes: line.memo || j.description || '—',
            });
          }
        });
      });

    return records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [validVouchers, validJournals, accounts, startDate, endDate, datePreset]);

  const expenseStats = useMemo(() => {
    let totalExpenseAmount = 0;
    const categoryTotals: Record<string, number> = {};

    expenseRecords.forEach((rec) => {
      totalExpenseAmount += rec.amount;
      const cat = rec.categoryName || 'مصروفات أخرى';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + rec.amount;
    });

    const categoryBreakdown = Object.entries(categoryTotals).map(([cat, total]) => ({
      name: cat,
      total,
      percentage: totalExpenseAmount > 0 ? (total / totalExpenseAmount) * 100 : 0,
    })).sort((a, b) => b.total - a.total);

    return { totalExpenseAmount, count: expenseRecords.length, categoryBreakdown };
  }, [expenseRecords]);

  // -------------------------------------------------------------
  // 4. CUSTOMERS REPORT DATA & AGING
  // -------------------------------------------------------------
  const customerReports = useMemo(() => {
    return customers.map((cust) => {
      // Find invoices for this customer using unified entity matcher, excluding cancelled and drafts
      const custInvoices = validInvoices.filter(
        (inv) => isDocMatchingEntity(inv, cust.id, cust, 'CUSTOMER') && inv.type === 'SALES'
      );
      const custReturns = validInvoices.filter(
        (inv) => isDocMatchingEntity(inv, cust.id, cust, 'CUSTOMER') && inv.type === 'SALES_RETURN'
      );
      const custReceipts = validVouchers.filter(
        (v) => isDocMatchingEntity(v, cust.id, cust, 'CUSTOMER') && v.type === 'RECEIPT'
      );

      const totalInvoiced = custInvoices.reduce((s, i) => s + (Number(i.grandTotal) || 0), 0);
      const totalReturned = custReturns.reduce((s, i) => s + (Number(i.grandTotal) || 0), 0);
      const totalCollected = custReceipts.reduce((s, v) => s + (Number(v.amount) || 0), 0);
      const openBal = Number(cust.openingBalance) || 0;
      
      // المحرك المحاسبي الموحد لاحتساب رصيد العميل الدقيق 100% المطابق لكشف الحساب
      const currentBalance = getCalculatedCustomerBalance(cust.id, validInvoices, validVouchers, validJournals, customers);

      // Calculate Aging (0-30, 31-60, 61-90, +90 days)
      let bucket0to30 = 0;
      let bucket31to60 = 0;
      let bucket61to90 = 0;
      let bucket90plus = 0;

      const now = new Date().getTime();
      custInvoices.forEach((inv) => {
        const due = Number(inv.dueAmount) || 0;
        if (due > 0) {
          const invDate = new Date(inv.date).getTime();
          const diffDays = Math.floor((now - invDate) / (1000 * 60 * 60 * 24));
          if (diffDays <= 30) bucket0to30 += due;
          else if (diffDays <= 60) bucket31to60 += due;
          else if (diffDays <= 90) bucket61to90 += due;
          else bucket90plus += due;
        }
      });

      return {
        customer: cust,
        totalInvoiced,
        totalReturned,
        netInvoiced: totalInvoiced - totalReturned,
        totalCollected,
        openingBalance: openBal,
        currentBalance,
        invoicesCount: custInvoices.length,
        bucket0to30,
        bucket31to60,
        bucket61to90,
        bucket90plus,
      };
    }).filter((c) => {
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        c.customer.nameAr.toLowerCase().includes(term) ||
        (c.customer.code && c.customer.code.toLowerCase().includes(term)) ||
        (c.customer.phone && c.customer.phone.includes(term))
      );
    }).sort((a, b) => b.currentBalance - a.currentBalance);
  }, [customers, validInvoices, validVouchers, validJournals, searchTerm]);

  const customerStats = useMemo(() => {
    const totalReceivables = customerReports.reduce((s, c) => s + Math.max(0, c.currentBalance), 0);
    const activeDebtorsCount = customerReports.filter((c) => c.currentBalance > 0.01).length;
    const totalSalesVolume = customerReports.reduce((s, c) => s + c.netInvoiced, 0);
    const totalReceiptsVolume = customerReports.reduce((s, c) => s + c.totalCollected, 0);

    return { totalReceivables, activeDebtorsCount, totalSalesVolume, totalReceiptsVolume };
  }, [customerReports]);

  // -------------------------------------------------------------
  // 5. SUPPLIERS REPORT DATA
  // -------------------------------------------------------------
  const supplierReports = useMemo(() => {
    return suppliers.map((supp) => {
      const suppInvoices = validInvoices.filter(
        (inv) => isDocMatchingEntity(inv, supp.id, supp, 'SUPPLIER') && inv.type === 'PURCHASE'
      );
      const suppReturns = validInvoices.filter(
        (inv) => isDocMatchingEntity(inv, supp.id, supp, 'SUPPLIER') && inv.type === 'PURCHASE_RETURN'
      );
      const suppPayments = validVouchers.filter(
        (v) => isDocMatchingEntity(v, supp.id, supp, 'SUPPLIER') && v.type === 'PAYMENT'
      );

      const totalPurchased = suppInvoices.reduce((s, i) => s + (Number(i.grandTotal) || 0), 0);
      const totalReturned = suppReturns.reduce((s, i) => s + (Number(i.grandTotal) || 0), 0);
      const totalPaid = suppPayments.reduce((s, v) => s + (Number(v.amount) || 0), 0);
      const openBal = Number(supp.openingBalance) || 0;
      
      // المحرك المحاسبي الموحد لاحتساب رصيد المورد الدقيق 100% المطابق لكشف الحساب
      const currentBalance = getCalculatedSupplierBalance(supp.id, validInvoices, validVouchers, validJournals, suppliers);

      return {
        supplier: supp,
        totalPurchased,
        totalReturned,
        netPurchased: totalPurchased - totalReturned,
        totalPaid,
        openingBalance: openBal,
        currentBalance,
        invoicesCount: suppInvoices.length,
      };
    }).filter((s) => {
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        s.supplier.nameAr.toLowerCase().includes(term) ||
        (s.supplier.code && s.supplier.code.toLowerCase().includes(term))
      );
    }).sort((a, b) => b.currentBalance - a.currentBalance);
  }, [suppliers, validInvoices, validVouchers, validJournals, searchTerm]);

  const supplierStats = useMemo(() => {
    const totalPayables = supplierReports.reduce((s, supp) => s + Math.max(0, supp.currentBalance), 0);
    const activeCreditorsCount = supplierReports.filter((supp) => supp.currentBalance > 0.01).length;
    const totalPurchasesVolume = supplierReports.reduce((s, supp) => s + supp.netPurchased, 0);
    const totalPaymentsVolume = supplierReports.reduce((s, supp) => s + supp.totalPaid, 0);

    return { totalPayables, activeCreditorsCount, totalPurchasesVolume, totalPaymentsVolume };
  }, [supplierReports]);

  // CSV Export Utility with UTF-8 BOM
  const exportToCSV = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const csvContent =
      '\uFEFF' +
      [headers.join(','), ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join(
        '\n'
      );
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${today}.csv`;
    link.click();
    link.remove();
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Navigation Tabs */}
      <div className="bg-white border border-[#E5E1DA] rounded-2xl p-6 shadow-xs space-y-5 no-print">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#FAF8F5] border border-[#E5E1DA] flex items-center justify-center text-[#B8860B] shadow-xs">
              <BarChart3 className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-2xl font-serif font-black text-[#1A1A1A]">
                مركز التقارير الشاملة وتحليلات الأعمال (Operational & BI Reports)
              </h2>
              <p className="text-xs text-[#8C8273] mt-0.5">
                لوحات تحليلية دقيقة لمتابعة المبيعات، المشتريات، المصروفات، أرصدة العملاء والتحصيل، والتزامات الموردين.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2.5 bg-[#FAF8F5] hover:bg-[#E5E1DA] text-[#1A1A1A] border border-[#E5E1DA] rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-xs"
            >
              <Printer className="w-4 h-4 text-[#B8860B]" />
              <span>طباعة التقرير</span>
            </button>
          </div>
        </div>

        {/* 6 Main Report Selector Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-2 border-t border-[#E5E1DA]">
          {[
            { id: 'customers', label: 'أرصدة العملاء (ح/ 1120)', icon: Users, count: customers.length },
            { id: 'sales', label: 'المبيعات المعتمدة (ح/ 4100)', icon: TrendingUp, count: salesStats.invoiceCount },
            { id: 'inventory-valuation', label: 'تقييم المخزون (ح/ 1130)', icon: Scale, count: inventory.length },
            { id: 'purchases', label: 'تقرير المشتريات', icon: ShoppingCart, count: purchaseStats.invoiceCount },
            { id: 'expenses', label: 'تقرير المصاريف والتشغيل', icon: Receipt, count: expenseStats.count },
            { id: 'suppliers', label: 'تقرير الموردين والالتزامات', icon: Building2, count: supplierReports.length },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeReport === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveReport(tab.id as ReportCategory);
                  setSearchTerm('');
                  setSelectedEntityId('ALL');
                  setSelectedStatus('ALL');
                }}
                className={`p-3 rounded-xl text-right transition-all flex flex-col justify-between cursor-pointer border ${
                  isActive
                    ? 'bg-[#1A1A1A] text-white border-[#1A1A1A] shadow-md'
                    : 'bg-[#FAF8F5] hover:bg-white text-[#6E6659] border-[#E5E1DA]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#D4AF37]' : 'text-[#8C8273]'}`} />
                  <span
                    className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                      isActive ? 'bg-white/20 text-white' : 'bg-white text-[#8C8273] border border-[#E5E1DA]'
                    }`}
                  >
                    {tab.count}
                  </span>
                </div>
                <div className="font-bold text-xs mt-2">{tab.label}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Date & Filter Toolbar */}
      <div className="bg-white border border-[#E5E1DA] rounded-2xl p-4 shadow-xs space-y-3 no-print">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Preset Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <span className="text-xs font-bold text-[#8C8273] flex items-center gap-1 ml-1">
              <Calendar className="w-3.5 h-3.5 text-[#B8860B]" /> النطاق:
            </span>
            {[
              { id: 'TODAY', label: 'اليوم' },
              { id: 'THIS_MONTH', label: 'هذا الشهر' },
              { id: 'THIS_YEAR', label: 'السنة المالية الحالية' },
              { id: 'ALL', label: 'كافة الفترات' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => handlePresetChange(p.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  datePreset === p.id
                    ? 'bg-[#1A1A1A] text-white shadow-xs'
                    : 'bg-[#FAF8F5] hover:bg-[#E5E1DA] text-[#6E6659] border border-[#E5E1DA]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Date Pickers */}
          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 bg-[#FAF8F5] px-3 py-1.5 rounded-lg border border-[#E5E1DA]">
              <span className="text-[#8C8273]">من:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDatePreset('CUSTOM');
                }}
                className="bg-transparent text-[#1A1A1A] font-mono font-bold focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-[#FAF8F5] px-3 py-1.5 rounded-lg border border-[#E5E1DA]">
              <span className="text-[#8C8273]">إلى:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDatePreset('CUSTOM');
                }}
                className="bg-transparent text-[#1A1A1A] font-mono font-bold focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Search & Dynamic Select Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#E5E1DA]">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-[#8C8273] absolute right-3 top-2.5" />
            <input
              type="text"
              placeholder="بحث بالاسم، رقم الفاتورة، الكود، أو البيان..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#FAF8F5] border border-[#E5E1DA] rounded-xl pr-9 pl-3 py-2 text-xs text-[#1A1A1A] placeholder-[#8C8273] focus:outline-none focus:border-[#1A1A1A]"
            />
          </div>

          {activeReport === 'sales' && (
            <div className="flex items-center gap-2">
              <select
                value={selectedEntityId}
                onChange={(e) => setSelectedEntityId(e.target.value)}
                className="bg-[#FAF8F5] border border-[#E5E1DA] rounded-xl px-3 py-2 text-xs text-[#1A1A1A] font-bold focus:outline-none"
              >
                <option value="ALL">كافة العملاء والجمعيات</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nameAr}
                  </option>
                ))}
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="bg-[#FAF8F5] border border-[#E5E1DA] rounded-xl px-3 py-2 text-xs text-[#1A1A1A] font-bold focus:outline-none"
              >
                <option value="ALL">كافة حالات الفواتير</option>
                <option value="POSTED">مرحلة (POSTED)</option>
                <option value="PAID">مدفوعة بالكامل (PAID)</option>
                <option value="PARTIALLY_PAID">مدفوعة جزئياً</option>
                <option value="DRAFT">مسودة (DRAFT)</option>
              </select>
            </div>
          )}

          {activeReport === 'purchases' && (
            <div className="flex items-center gap-2">
              <select
                value={selectedEntityId}
                onChange={(e) => setSelectedEntityId(e.target.value)}
                className="bg-[#FAF8F5] border border-[#E5E1DA] rounded-xl px-3 py-2 text-xs text-[#1A1A1A] font-bold focus:outline-none"
              >
                <option value="ALL">كافة الموردين والشركات</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nameAr}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Printable Report Wrapper */}
      <div id="printable-report-area" className="printable-report-area space-y-6">
        {/* ========================================================= */}
        {/* 1. SALES REPORT VIEW */}
        {/* ========================================================= */}
      {activeReport === 'sales' && (
        <div className="space-y-6">
          {/* View Toggle */}
          <div className="flex items-center gap-2 bg-[#FAF8F5] p-1.5 rounded-xl border border-[#E5E1DA] w-fit">
            <button
              onClick={() => setSalesReportMode('gl')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                salesReportMode === 'gl'
                  ? 'bg-[#1A1A1A] text-white shadow-xs'
                  : 'bg-white text-[#6E6659] hover:bg-[#E5E1DA]'
              }`}
            >
              <Scale className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>إيرادات المبيعات المعتمدة (ح/ 4100)</span>
            </button>
            <button
              onClick={() => setSalesReportMode('invoices')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                salesReportMode === 'invoices'
                  ? 'bg-[#1A1A1A] text-white shadow-xs'
                  : 'bg-white text-[#6E6659] hover:bg-[#E5E1DA]'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>فواتير ومردودات المبيعات التشغيلية</span>
            </button>
          </div>

          {salesReportMode === 'gl' ? (
            <GlPostedSalesReport
              journals={validJournals}
              accounts={accounts}
              invoices={validInvoices}
              company={company}
              currency={currency}
              onViewInvoice={(invoiceId) => {
                const inv = validInvoices.find((i) => i.id === invoiceId) || invoices.find((i) => i.id === invoiceId);
                if (inv && onViewInvoice) onViewInvoice(inv);
              }}
            />
          ) : (
            <>
              {/* Sales KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white border border-[#E5E1DA] rounded-2xl p-4 shadow-xs space-y-1">
              <div className="text-[11px] text-[#8C8273] font-semibold flex items-center justify-between">
                <span>إجمالي المبيعات الإجمالية</span>
                <TrendingUp className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-base font-mono font-black text-blue-950">
                {formatCurrency(salesStats.grossSales, currency)}
              </div>
              <div className="text-[10px] text-[#8C8273]">{salesStats.invoiceCount} فاتورة مبيعات</div>
            </div>

            <div className="bg-white border border-[#E5E1DA] rounded-2xl p-4 shadow-xs space-y-1">
              <div className="text-[11px] text-[#8C8273] font-semibold flex items-center justify-between">
                <span>مردودات المبيعات</span>
                <ArrowDownRight className="w-4 h-4 text-rose-600" />
              </div>
              <div className="text-base font-mono font-black text-rose-900">
                {formatCurrency(salesStats.returns, currency)}
              </div>
              <div className="text-[10px] text-rose-700">خصم المرتجعات</div>
            </div>

            <div className="bg-white border border-[#E5E1DA] rounded-2xl p-4 shadow-xs space-y-1">
              <div className="text-[11px] text-[#8C8273] font-semibold flex items-center justify-between">
                <span>صافي المبيعات الفعلية</span>
                <Sparkles className="w-4 h-4 text-[#D4AF37]" />
              </div>
              <div className="text-base font-mono font-black text-emerald-800">
                {formatCurrency(salesStats.netSales, currency)}
              </div>
              <div className="text-[10px] text-emerald-700">المبيعات بعد استبعاد المردودات</div>
            </div>

            <div className="bg-white border border-[#E5E1DA] rounded-2xl p-4 shadow-xs space-y-1">
              <div className="text-[11px] text-[#8C8273] font-semibold flex items-center justify-between">
                <span>المحصل نقداً وبنكياً / المتبقي</span>
                <DollarSign className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-sm font-mono font-black text-emerald-700">
                محصل: {formatCurrency(salesStats.totalPaid, currency)}
              </div>
              <div className="text-[11px] font-mono font-bold text-rose-700">
                آجل متبقي: {formatCurrency(salesStats.totalDue, currency)}
              </div>
            </div>
          </div>

          {/* Top Selling Items Mini Widget */}
          {topSellingItems.length > 0 && (
            <div className="bg-white border border-[#E5E1DA] rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-serif font-black text-[#1A1A1A] flex items-center gap-2">
                  <Package className="w-4 h-4 text-[#B8860B]" />
                  <span>أعلى 5 أصناف وبهارات تحقيقاً للإيرادات خلال الفترة:</span>
                </h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                {topSellingItems.map((item, idx) => (
                  <div key={idx} className="bg-[#FAF8F5] border border-[#E5E1DA] rounded-xl p-3 space-y-1">
                    <div className="font-bold text-xs text-[#1A1A1A] truncate">{item.nameAr}</div>
                    <div className="text-[11px] text-[#8C8273]">
                      الكمية المباعة: <strong className="font-mono text-[#1A1A1A]">{item.qty} {item.unit}</strong>
                    </div>
                    <div className="text-xs font-mono font-black text-emerald-800">
                      {formatCurrency(item.totalRev, currency)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Detailed Sales Table */}
          <div className="bg-white border border-[#E5E1DA] rounded-2xl overflow-hidden shadow-xs space-y-2">
            <div className="p-4 bg-[#FAF8F5] border-b border-[#E5E1DA] flex items-center justify-between">
              <div className="font-serif font-black text-xs text-[#1A1A1A] flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-[#B8860B]" />
                <span>سجل فواتير ومردودات المبيعات التفصيلي ({salesInvoices.length} فاتورة)</span>
              </div>

              <button
                onClick={() =>
                  exportToCSV(
                    'sales_report',
                    ['رقم الفاتورة', 'التاريخ', 'النوع', 'العميل', 'الإجمالي', 'الخصم', 'الصافي', 'المدفوع', 'المتبقي', 'الحالة'],
                    salesInvoices.map((inv) => [
                      inv.invoiceNumber,
                      inv.date,
                      inv.type === 'SALES' ? 'مبيعات' : 'مردود مبيعات',
                      inv.entityNameAr,
                      inv.subtotal,
                      inv.discountTotal,
                      inv.grandTotal,
                      inv.paidAmount,
                      inv.dueAmount,
                      inv.status,
                    ])
                  )
                }
                className="px-3 py-1.5 bg-white hover:bg-[#E5E1DA] text-[#1A1A1A] border border-[#E5E1DA] rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5 text-emerald-700" />
                <span>تصدير Excel / CSV</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right border-collapse">
                <thead className="bg-[#FAF8F5] text-[#6E6659] font-serif font-black border-b border-[#E5E1DA]">
                  <tr>
                    <th className="p-3">رقم الفاتورة</th>
                    <th className="p-3">التاريخ</th>
                    <th className="p-3">النوع</th>
                    <th className="p-3">اسم العميل</th>
                    <th className="p-3 text-left">الإجمالي</th>
                    <th className="p-3 text-left">الخصم</th>
                    <th className="p-3 text-left">الصافي</th>
                    <th className="p-3 text-left">المدفوع</th>
                    <th className="p-3 text-left">المتبقي</th>
                    <th className="p-3 text-center">الحالة</th>
                    <th className="p-3 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E1DA]">
                  {salesInvoices.length > 0 ? (
                    salesInvoices.map((inv) => (
                      <React.Fragment key={inv.id}>
                        <tr className="hover:bg-[#FAF9F6] transition-colors">
                          <td className="p-3 font-mono font-black text-[#B8860B] whitespace-nowrap">
                            {inv.invoiceNumber}
                          </td>
                          <td className="p-3 font-mono text-[#6E6659] whitespace-nowrap">{inv.date}</td>
                          <td className="p-3 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                inv.type === 'SALES' ? 'bg-blue-50 text-blue-800' : 'bg-rose-50 text-rose-800'
                              }`}
                            >
                              {inv.type === 'SALES' ? 'فاتورة بيع' : 'مرتجع مبيعات'}
                            </span>
                          </td>
                          <td className="p-3 font-bold text-[#1A1A1A]">{inv.entityNameAr}</td>
                          <td className="p-3 font-mono text-left">{formatCurrency(inv.subtotal, currency)}</td>
                          <td className="p-3 font-mono text-left text-rose-700">
                            {inv.discountTotal > 0 ? `-${formatCurrency(inv.discountTotal, currency)}` : '0.00'}
                          </td>
                          <td className="p-3 font-mono font-black text-left text-[#1A1A1A]">
                            {formatCurrency(inv.grandTotal, currency)}
                          </td>
                          <td className="p-3 font-mono text-left text-emerald-800">
                            {formatCurrency(inv.paidAmount, currency)}
                          </td>
                          <td className="p-3 font-mono text-left text-rose-800 font-bold">
                            {formatCurrency(inv.dueAmount, currency)}
                          </td>
                          <td className="p-3 text-center whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                inv.status === 'PAID'
                                  ? 'bg-emerald-100 text-emerald-900'
                                  : inv.status === 'PARTIALLY_PAID'
                                  ? 'bg-amber-100 text-amber-900'
                                  : 'bg-slate-100 text-slate-800'
                              }`}
                            >
                              {inv.status}
                            </span>
                          </td>
                          <td className="p-3 text-center whitespace-nowrap flex items-center justify-center gap-1.5">
                            {onViewInvoice && (
                              <button
                                onClick={() => onViewInvoice(inv)}
                                title="عرض وطباعة الفاتورة"
                                className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg cursor-pointer transition-colors"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => setExpandedRowId(expandedRowId === inv.id ? null : inv.id)}
                              title="عرض بنود الأصناف"
                              className="p-1.5 bg-[#FAF8F5] hover:bg-[#E5E1DA] text-[#1A1A1A] rounded-lg cursor-pointer"
                            >
                              {expandedRowId === inv.id ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </td>
                        </tr>

                        {/* Expanded Lines View */}
                        {expandedRowId === inv.id && (
                          <tr className="bg-[#FAF9F6]">
                            <td colSpan={11} className="p-4 border-b border-[#E5E1DA]">
                              <div className="bg-white border border-[#E5E1DA] rounded-xl p-3 space-y-2">
                                <div className="font-bold text-xs text-[#1A1A1A]">
                                  تفاصيل أصناف الفاتورة ({inv.lines?.length || 0} صنف):
                                </div>
                                <table className="w-full text-xs text-right">
                                  <thead className="bg-[#FAF8F5] text-[#8C8273] border-b border-[#E5E1DA]">
                                    <tr>
                                      <th className="p-2">الصنف</th>
                                      <th className="p-2 text-center">الكمية</th>
                                      <th className="p-2 text-center">الوحدة</th>
                                      <th className="p-2 text-left">سعر الوحدة</th>
                                      <th className="p-2 text-left">الإجمالي</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-[#E5E1DA]">
                                    {(inv.lines || []).map((line, lIdx) => (
                                      <tr key={lIdx}>
                                        <td className="p-2 font-bold text-[#1A1A1A]">{line.itemNameAr}</td>
                                        <td className="p-2 font-mono text-center">{line.quantity}</td>
                                        <td className="p-2 text-center text-[#8C8273]">{line.unit}</td>
                                        <td className="p-2 font-mono text-left">{formatCurrency(line.unitPrice, currency)}</td>
                                        <td className="p-2 font-mono font-bold text-left text-[#1A1A1A]">
                                          {formatCurrency(line.total, currency)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={11} className="p-8 text-center text-[#8C8273]">
                        لا توجد فواتير مبيعات مسجلة في هذا النطاق الزمني
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
            </>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. PURCHASES REPORT VIEW */}
      {/* ========================================================= */}
      {activeReport === 'purchases' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white border border-[#E5E1DA] rounded-2xl p-4 shadow-xs space-y-1">
              <div className="text-[11px] text-[#8C8273] font-semibold flex items-center justify-between">
                <span>إجمالي المشتريات الإجمالية</span>
                <ShoppingCart className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-base font-mono font-black text-blue-950">
                {formatCurrency(purchaseStats.grossPurchases, currency)}
              </div>
              <div className="text-[10px] text-[#8C8273]">{purchaseStats.invoiceCount} فاتورة شراء</div>
            </div>

            <div className="bg-white border border-[#E5E1DA] rounded-2xl p-4 shadow-xs space-y-1">
              <div className="text-[11px] text-[#8C8273] font-semibold flex items-center justify-between">
                <span>مردودات المشتريات للموردين</span>
                <ArrowDownRight className="w-4 h-4 text-rose-600" />
              </div>
              <div className="text-base font-mono font-black text-rose-900">
                {formatCurrency(purchaseStats.purchaseReturns, currency)}
              </div>
            </div>

            <div className="bg-white border border-[#E5E1DA] rounded-2xl p-4 shadow-xs space-y-1">
              <div className="text-[11px] text-[#8C8273] font-semibold flex items-center justify-between">
                <span>صافي المشتريات وتكلفة البضاعة</span>
                <Sparkles className="w-4 h-4 text-[#D4AF37]" />
              </div>
              <div className="text-base font-mono font-black text-emerald-800">
                {formatCurrency(purchaseStats.netPurchases, currency)}
              </div>
            </div>

            <div className="bg-white border border-[#E5E1DA] rounded-2xl p-4 shadow-xs space-y-1">
              <div className="text-[11px] text-[#8C8273] font-semibold flex items-center justify-between">
                <span>المسدد للموردين / المتبقي</span>
                <DollarSign className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-sm font-mono font-black text-emerald-700">
                مسدد: {formatCurrency(purchaseStats.totalPaidToSuppliers, currency)}
              </div>
              <div className="text-[11px] font-mono font-bold text-rose-700">
                مستحق: {formatCurrency(purchaseStats.totalDueToSuppliers, currency)}
              </div>
            </div>
          </div>

          {/* Purchases Table */}
          <div className="bg-white border border-[#E5E1DA] rounded-2xl overflow-hidden shadow-xs space-y-2">
            <div className="p-4 bg-[#FAF8F5] border-b border-[#E5E1DA] flex items-center justify-between">
              <div className="font-serif font-black text-xs text-[#1A1A1A] flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-[#B8860B]" />
                <span>سجل فواتير المشتريات وتوريد المواد الخام ({purchaseInvoices.length} فاتورة)</span>
              </div>

              <button
                onClick={() =>
                  exportToCSV(
                    'purchases_report',
                    ['رقم الفاتورة', 'التاريخ', 'النوع', 'المورد', 'الإجمالي', 'المدفوع', 'المتبقي', 'الحالة'],
                    purchaseInvoices.map((inv) => [
                      inv.invoiceNumber,
                      inv.date,
                      inv.type === 'PURCHASE' ? 'مشتريات' : 'مردود مشتريات',
                      inv.entityNameAr,
                      inv.grandTotal,
                      inv.paidAmount,
                      inv.dueAmount,
                      inv.status,
                    ])
                  )
                }
                className="px-3 py-1.5 bg-white hover:bg-[#E5E1DA] text-[#1A1A1A] border border-[#E5E1DA] rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5 text-emerald-700" />
                <span>تصدير Excel / CSV</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right border-collapse">
                <thead className="bg-[#FAF8F5] text-[#6E6659] font-serif font-black border-b border-[#E5E1DA]">
                  <tr>
                    <th className="p-3">رقم الفاتورة</th>
                    <th className="p-3">التاريخ</th>
                    <th className="p-3">النوع</th>
                    <th className="p-3">اسم المورد</th>
                    <th className="p-3 text-left">قيمة الفاتورة</th>
                    <th className="p-3 text-left">المسدد</th>
                    <th className="p-3 text-left">المتبقي</th>
                    <th className="p-3 text-center">الحالة</th>
                    <th className="p-3 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E1DA]">
                  {purchaseInvoices.length > 0 ? (
                    purchaseInvoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-[#FAF9F6] transition-colors">
                        <td className="p-3 font-mono font-black text-[#B8860B] whitespace-nowrap">
                          {inv.invoiceNumber}
                        </td>
                        <td className="p-3 font-mono text-[#6E6659] whitespace-nowrap">{inv.date}</td>
                        <td className="p-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              inv.type === 'PURCHASE' ? 'bg-purple-50 text-purple-800' : 'bg-rose-50 text-rose-800'
                            }`}
                          >
                            {inv.type === 'PURCHASE' ? 'فاتورة شراء' : 'مردود مشتريات'}
                          </span>
                        </td>
                        <td className="p-3 font-bold text-[#1A1A1A]">{inv.entityNameAr}</td>
                        <td className="p-3 font-mono font-black text-left text-[#1A1A1A]">
                          {formatCurrency(inv.grandTotal, currency)}
                        </td>
                        <td className="p-3 font-mono text-left text-emerald-800">
                          {formatCurrency(inv.paidAmount, currency)}
                        </td>
                        <td className="p-3 font-mono text-left text-rose-800 font-bold">
                          {formatCurrency(inv.dueAmount, currency)}
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              inv.status === 'PAID'
                                ? 'bg-emerald-100 text-emerald-900'
                                : 'bg-slate-100 text-slate-800'
                            }`}
                          >
                            {inv.status}
                          </span>
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          {onViewInvoice && (
                            <button
                              onClick={() => onViewInvoice(inv)}
                              title="عرض الفاتورة"
                              className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-[#8C8273]">
                        لا توجد فواتير مشتريات مسجلة في هذا النطاق الزمني
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. EXPENSES REPORT VIEW */}
      {/* ========================================================= */}
      {activeReport === 'expenses' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-[#E5E1DA] rounded-2xl p-5 shadow-xs space-y-1">
              <div className="text-xs text-[#8C8273] font-semibold flex items-center justify-between">
                <span>إجمالي المصروفات التشغيلية والعمومية</span>
                <Receipt className="w-5 h-5 text-amber-600" />
              </div>
              <div className="text-xl font-mono font-black text-amber-900">
                {formatCurrency(expenseStats.totalExpenseAmount, currency)}
              </div>
              <div className="text-[11px] text-[#8C8273]">{expenseStats.count} حركة وسند صرف مسجل</div>
            </div>

            <div className="sm:col-span-2 bg-white border border-[#E5E1DA] rounded-2xl p-5 shadow-xs space-y-3">
              <div className="text-xs font-serif font-black text-[#1A1A1A] flex items-center gap-2">
                <PieChart className="w-4 h-4 text-[#B8860B]" />
                <span>توزيع المصروفات حسب الأبواب الرئيسية:</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {expenseStats.categoryBreakdown.slice(0, 6).map((cat, idx) => (
                  <div key={idx} className="bg-[#FAF8F5] border border-[#E5E1DA] rounded-xl p-2.5 space-y-1">
                    <div className="text-[11px] font-bold text-[#1A1A1A] truncate">{cat.name}</div>
                    <div className="text-xs font-mono font-black text-amber-800">
                      {formatCurrency(cat.total, currency)}
                    </div>
                    <div className="text-[10px] text-[#8C8273] font-mono">{cat.percentage.toFixed(1)}% من الإجمالي</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Expenses Table */}
          <div className="bg-white border border-[#E5E1DA] rounded-2xl overflow-hidden shadow-xs space-y-2">
            <div className="p-4 bg-[#FAF8F5] border-b border-[#E5E1DA] flex items-center justify-between">
              <div className="font-serif font-black text-xs text-[#1A1A1A] flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[#B8860B]" />
                <span>سجل سندات الصرف والمصروفات اليومية</span>
              </div>

              <button
                onClick={() =>
                  exportToCSV(
                    'expenses_report',
                    ['التاريخ', 'رقم المستند', 'نوع المستند', 'الباب / التصنيف', 'المستفيد', 'الحساب', 'المبلغ', 'البيان'],
                    expenseRecords.map((r) => [
                      r.date,
                      r.docNumber,
                      r.docType,
                      r.categoryName,
                      r.beneficiary,
                      r.accountName,
                      r.amount,
                      r.notes,
                    ])
                  )
                }
                className="px-3 py-1.5 bg-white hover:bg-[#E5E1DA] text-[#1A1A1A] border border-[#E5E1DA] rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5 text-emerald-700" />
                <span>تصدير Excel / CSV</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right border-collapse">
                <thead className="bg-[#FAF8F5] text-[#6E6659] font-serif font-black border-b border-[#E5E1DA]">
                  <tr>
                    <th className="p-3">التاريخ</th>
                    <th className="p-3">رقم المستند</th>
                    <th className="p-3">النوع</th>
                    <th className="p-3">الباب / التصنيف</th>
                    <th className="p-3">المستفيد</th>
                    <th className="p-3">البيان والشرح</th>
                    <th className="p-3 text-left">المبلغ المصروف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E1DA]">
                  {expenseRecords.length > 0 ? (
                    expenseRecords.map((r) => (
                      <tr key={r.id} className="hover:bg-[#FAF9F6] transition-colors">
                        <td className="p-3 font-mono text-[#6E6659] whitespace-nowrap">{r.date}</td>
                        <td className="p-3 font-mono font-bold text-[#B8860B] whitespace-nowrap">{r.docNumber}</td>
                        <td className="p-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 bg-[#FAF8F5] text-[#1A1A1A] border border-[#E5E1DA] rounded text-[10px] font-bold">
                            {r.docType}
                          </span>
                        </td>
                        <td className="p-3 font-bold text-amber-950 whitespace-nowrap">{r.categoryName}</td>
                        <td className="p-3 text-[#1A1A1A] font-medium">{r.beneficiary}</td>
                        <td className="p-3 text-[#6E6659] max-w-xs truncate">{r.notes}</td>
                        <td className="p-3 font-mono font-black text-left text-amber-900 whitespace-nowrap">
                          {formatCurrency(r.amount, currency)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-[#8C8273]">
                        لا توجد سندات أو قيود مصروفات مسجلة في هذا النطاق
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. CUSTOMERS & RECEIVABLES REPORT (STRICT GL LINKAGE 1120) */}
      {/* ========================================================= */}
      {activeReport === 'customers' && (
        <GlCustomerBalancesReport
          companyId={company?.id || (company as any)?.company_id}
          customers={customers}
          journals={validJournals}
          accounts={accounts}
          invoices={validInvoices}
          vouchers={validVouchers}
          company={company}
          currency={currency}
          onViewAccountStatement={(customerId) => {
            if (onViewAccountStatement) {
              onViewAccountStatement(customerId, 'CUSTOMER');
            }
          }}
        />
      )}

      {/* ========================================================= */}
      {/* 5. INVENTORY VALUATION REPORT (STRICT GL LINKAGE 1130 / 5100) */}
      {/* ========================================================= */}
      {activeReport === 'inventory-valuation' && (
        <GlInventoryValuationReport
          inventory={inventory}
          journals={validJournals}
          accounts={accounts}
          invoices={validInvoices}
          warehouses={[]}
          company={company}
          currency={currency}
        />
      )}

      {/* ========================================================= */}
      {/* 5. SUPPLIERS & PAYABLES REPORT */}
      {/* ========================================================= */}
      {activeReport === 'suppliers' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white border border-[#E5E1DA] rounded-2xl p-4 shadow-xs space-y-1">
              <div className="text-[11px] text-[#8C8273] font-semibold flex items-center justify-between">
                <span>إجمالي الذمم الدائنة القائمة (أرصدة الموردين)</span>
                <Building2 className="w-4 h-4 text-rose-600" />
              </div>
              <div className="text-base font-mono font-black text-rose-950">
                {formatCurrency(supplierStats.totalPayables, currency)}
              </div>
              <div className="text-[10px] text-rose-700">{supplierStats.activeCreditorsCount} مورد لهم مستحقات</div>
            </div>

            <div className="bg-white border border-[#E5E1DA] rounded-2xl p-4 shadow-xs space-y-1">
              <div className="text-[11px] text-[#8C8273] font-semibold flex items-center justify-between">
                <span>إجمالي المشتريات من الموردين</span>
                <ShoppingCart className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-base font-mono font-black text-blue-900">
                {formatCurrency(supplierStats.totalPurchasesVolume, currency)}
              </div>
            </div>

            <div className="bg-white border border-[#E5E1DA] rounded-2xl p-4 shadow-xs space-y-1">
              <div className="text-[11px] text-[#8C8273] font-semibold flex items-center justify-between">
                <span>إجمالي المدفوعات وسندات الصرف</span>
                <DollarSign className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-base font-mono font-black text-emerald-800">
                {formatCurrency(supplierStats.totalPaymentsVolume, currency)}
              </div>
            </div>

            <div className="bg-white border border-[#E5E1DA] rounded-2xl p-4 shadow-xs space-y-1">
              <div className="text-[11px] text-[#8C8273] font-semibold flex items-center justify-between">
                <span>عدد الموردين المسجلين</span>
                <Building2 className="w-4 h-4 text-[#B8860B]" />
              </div>
              <div className="text-base font-mono font-black text-[#1A1A1A]">{supplierReports.length} مورد</div>
            </div>
          </div>

          {/* Suppliers Table */}
          <div className="bg-white border border-[#E5E1DA] rounded-2xl overflow-hidden shadow-xs space-y-2">
            <div className="p-4 bg-[#FAF8F5] border-b border-[#E5E1DA] flex items-center justify-between">
              <div className="font-serif font-black text-xs text-[#1A1A1A] flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#B8860B]" />
                <span>أرصدة الموردين والتزامات الدفع (Supplier Balances & Payables)</span>
              </div>

              <button
                onClick={() =>
                  exportToCSV(
                    'suppliers_report',
                    ['كود المورد', 'اسم المورد', 'الرصيد الافتتاحي', 'المشتريات', 'المدفوعات', 'الرصيد المستحق'],
                    supplierReports.map((s) => [
                      s.supplier.code,
                      s.supplier.nameAr,
                      s.openingBalance,
                      s.netPurchased,
                      s.totalPaid,
                      s.currentBalance,
                    ])
                  )
                }
                className="px-3 py-1.5 bg-white hover:bg-[#E5E1DA] text-[#1A1A1A] border border-[#E5E1DA] rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5 text-emerald-700" />
                <span>تصدير Excel / CSV</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right border-collapse">
                <thead className="bg-[#FAF8F5] text-[#6E6659] font-serif font-black border-b border-[#E5E1DA]">
                  <tr>
                    <th className="p-3">كود المورد</th>
                    <th className="p-3">اسم المورد / الشركة</th>
                    <th className="p-3 text-left">إجمالي المشتريات</th>
                    <th className="p-3 text-left">المسدد للمورد</th>
                    <th className="p-3 text-left">الرصيد القائم المستحق</th>
                    <th className="p-3 text-center">كشف الحساب</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E1DA]">
                  {supplierReports.length > 0 ? (
                    supplierReports.map((s) => (
                      <tr key={s.supplier.id} className="hover:bg-[#FAF9F6] transition-colors">
                        <td className="p-3 font-mono font-bold text-[#B8860B] whitespace-nowrap">
                          {s.supplier.code}
                        </td>
                        <td className="p-3 font-bold text-[#1A1A1A]">{s.supplier.nameAr}</td>
                        <td className="p-3 font-mono text-left">{formatCurrency(s.netPurchased, currency)}</td>
                        <td className="p-3 font-mono text-left text-emerald-800">
                          {formatCurrency(s.totalPaid, currency)}
                        </td>
                        <td className="p-3 font-mono font-black text-left text-rose-900 whitespace-nowrap">
                          {formatCurrency(s.currentBalance, currency)}
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          {onViewAccountStatement && (
                            <button
                              onClick={() => onViewAccountStatement(s.supplier.id, 'SUPPLIER')}
                              title="عرض كشف حساب المورد"
                              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-lg font-bold text-[11px] cursor-pointer flex items-center gap-1 mx-auto"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>كشف الحساب</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-[#8C8273]">
                        لا توجد بيانات موردين مسجلة
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};
