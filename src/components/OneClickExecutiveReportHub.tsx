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
  X,
  Check,
  Info,
  FileText,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  TrendingUp,
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
  CreditNote,
} from '../types.js';
import { formatCurrency } from '../utils/formatters.ts';
import { normalizeArabicForMatching, toValidUUID, getCalculatedCustomerBalance } from '../services/statementService.ts';
import { DataService } from '../services/dataService.ts';
import { tafqeetCurrency } from '../utils/tafqeet.ts';

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
  creditNotes?: CreditNote[];
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
  creditNotes = [],
  onViewAccountStatement,
  onViewInvoice,
}) => {
  const currencySym = company?.currencySymbol || (currency === 'KWD' ? 'د.ك' : currency === 'SAR' ? 'ر.س' : currency) || 'د.ك';
  const currencyName = company?.functionalCurrency || currency || 'KWD';
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

  const [isExportMenuOpen, setIsExportMenuOpen] = useState<boolean>(false);

  // Print Preview Modal state
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState<boolean>(false);

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
  // REPORT 1: Customer & Co-op Society Aggregated Sales (Strict Matching & GL-Verified)
  // =========================================================================

  // Strict matching of document to customer (Prevents erroneous merging of distinct entities or branches)
  const findMatchingCustomer = (
    docEntityId?: string,
    docEntityNameAr?: string,
    docEntityCode?: string
  ): Customer | undefined => {
    if (!docEntityId && !docEntityNameAr && !docEntityCode) return undefined;

    // 1. Direct ID / UUID match
    if (docEntityId) {
      const byId = customers.find((c) => c.id === docEntityId);
      if (byId) return byId;

      const validUUID = toValidUUID(docEntityId);
      if (validUUID) {
        const byUUID = customers.find((c) => toValidUUID(c.id) === validUUID);
        if (byUUID) return byUUID;
      }
    }

    // 2. Exact code match
    const codeCandidates = [docEntityCode, docEntityId].filter(Boolean) as string[];
    for (const cand of codeCandidates) {
      const trimmed = cand.trim();
      const byCode = customers.find((c) => {
        if (!c.code) return false;
        const cCode = String(c.code).trim();
        return (
          trimmed === cCode ||
          trimmed === `cust-${cCode}` ||
          trimmed === `supp-${cCode}` ||
          trimmed.endsWith(`-${cCode}`)
        );
      });
      if (byCode) return byCode;
    }

    // 3. Strict Arabic Name matching (Full exact normalized string match only)
    if (docEntityNameAr) {
      const normDoc = normalizeArabicForMatching(docEntityNameAr);
      if (normDoc && normDoc.length >= 3) {
        const byExactName = customers.find(
          (c) => normalizeArabicForMatching(c.nameAr) === normDoc
        );
        if (byExactName) return byExactName;

        // Strict registered branch match (only if customer explicitly has a registered branch with matching code/name)
        const byBranch = customers.find((c) =>
          c.branches?.some((b) => {
            if (b.id && b.id === docEntityId) return true;
            if (b.code && b.code === docEntityCode) return true;
            if (b.nameAr && normalizeArabicForMatching(b.nameAr) === normDoc) return true;
            return false;
          })
        );
        if (byBranch) return byBranch;
      }
    }

    return undefined;
  };

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

    // 1. Seed with ALL authorized customers and calculate their real GL balance
    customers.forEach((c) => {
      const isCoop =
        c.nameAr.includes('جمعية') ||
        c.nameAr.includes('تعاونية') ||
        (c.city && c.city.includes('جمعية')) ||
        (c.address && c.address.includes('جمعية'));

      // Dynamic GL Calculation as the Single Source of Truth
      const glBal = getCalculatedCustomerBalance(
        c.id,
        invoices,
        vouchers,
        journals,
        customers,
        creditNotes || []
      );
      const cardBal = Number(
        c.currentBalance ||
        c.current_balance ||
        c.balance ||
        (c as any).raw_data?.currentBalance ||
        (c as any).raw_data?.balance ||
        c.openingBalance ||
        0
      );
      const currentBalance = glBal !== 0 ? glBal : cardBal;

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
        currentBalance,
      };
    });

    // 2. Aggregate Sales Invoices without dropping any valid invoices
    validInvoices.forEach((inv) => {
      if (!inv.entityId && !inv.entityNameAr) return;

      const isReturn =
        inv.type === 'SALES_RETURN' ||
        Number(inv.grandTotal) < 0 ||
        Boolean(inv.invoiceNumber && inv.invoiceNumber.toUpperCase().startsWith('RET-'));
      const isSale = inv.type === 'SALES' && !isReturn;

      if (!isSale && !isReturn) return;

      const matchedCustomer = findMatchingCustomer(inv.entityId, inv.entityNameAr, (inv as any).entityCode);
      const targetKey = matchedCustomer ? matchedCustomer.id : (inv.entityId || inv.entityNameAr || 'GEN');

      if (!map[targetKey]) {
        const isCoop =
          (inv.entityNameAr || '').includes('جمعية') ||
          (inv.entityNameAr || '').includes('تعاونية');
        map[targetKey] = {
          id: targetKey,
          code: (inv as any).entityCode || (inv.entityId?.startsWith('cust-') ? inv.entityId.replace('cust-', '') : 'GEN'),
          nameAr: inv.entityNameAr || 'عميل عام',
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

      const row = map[targetKey];
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

    // 3. Aggregate Credit Notes (Returns)
    (creditNotes || []).forEach((cn) => {
      if (cn.status === 'REVERSED' || (cn as any).is_void || cn.is_deleted) return;
      if (datePreset !== 'ALL') {
        if (cn.date < startDate || cn.date > endDate) return;
      }
      const matchedCustomer = findMatchingCustomer(
        cn.customer_id || (cn as any).customerId,
        cn.customer_name || (cn as any).customerNameAr || (cn as any).customerName,
        (cn as any).customerCode
      );
      const targetKey = matchedCustomer ? matchedCustomer.id : (cn.customer_id || (cn as any).customerId || cn.customer_name || 'GEN');
      if (map[targetKey]) {
        const amount = Math.abs(Number(cn.total_refund_amount ?? (cn as any).totalAmount ?? (cn as any).grandTotal) || 0);
        map[targetKey].returnCount += 1;
        map[targetKey].returns += amount;
        map[targetKey].netSales = map[targetKey].grossSales - map[targetKey].returns;
      }
    });

    // 4. Include Vouchers for collected payments
    validVouchers.forEach((v) => {
      const vType = v.type || (v as any).voucher_type;
      if (vType === 'RECEIPT') {
        const matched = findMatchingCustomer(v.entityId, v.entityNameAr, (v as any).entityCode);
        const targetKey = matched ? matched.id : v.entityId;
        if (targetKey && map[targetKey]) {
          map[targetKey].paidAmount += Number(v.amount) || 0;
        }
      }
    });

    // 5. Ensure any external/unregistered customer has an accurate balance derived from net sales and payments
    Object.values(map).forEach((row) => {
      if (row.currentBalance === 0 && (row.netSales !== 0 || row.paidAmount !== 0)) {
        row.currentBalance = row.netSales - row.paidAmount;
      }
    });

    let list = Object.values(map);

    // Apply Filter
    if (selectedEntityFilter === 'COOP_ONLY') {
      list = list.filter((item) => item.isCoop);
    } else if (selectedEntityFilter === 'REGULAR_ONLY') {
      list = list.filter((item) => !item.isCoop);
    } else if (selectedEntityFilter === 'ACTIVE_ONLY') {
      list = list.filter((item) => item.invoiceCount > 0 || item.returnCount > 0 || item.currentBalance !== 0);
    }

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (item) =>
          item.nameAr.toLowerCase().includes(q) ||
          item.code.toLowerCase().includes(q)
      );
    }

    return list.sort((a, b) => {
      // Prioritize active sales or non-zero balance
      if (b.netSales !== a.netSales) return b.netSales - a.netSales;
      return Math.abs(b.currentBalance) - Math.abs(a.currentBalance);
    });
  }, [customers, validInvoices, validVouchers, creditNotes, invoices, vouchers, journals, datePreset, startDate, endDate, selectedEntityFilter, searchTerm]);

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
        if (selectedAccountId !== 'ALL') {
          const targetAcc = accounts.find((a) => a.id === selectedAccountId || a.code === selectedAccountId);
          const isMatch =
            line.accountId === selectedAccountId ||
            (targetAcc && (
              line.accountId === targetAcc.id ||
              line.accountCode === targetAcc.code ||
              line.accountId === targetAcc.code ||
              line.accountId === `acc-${targetAcc.code}`
            ));
          if (!isMatch) return;
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

    // Calculate Running Balance based on account accounting nature (DEBIT vs CREDIT)
    if (selectedAccountId !== 'ALL') {
      const targetAcc = accounts.find((a) => a.id === selectedAccountId || a.code === selectedAccountId);
      const isCredit = (targetAcc?.normalBalance || targetAcc?.nature) === 'CREDIT';
      let balance = Number(targetAcc?.openingBalance || (targetAcc as any)?.opening_balance || 0);
      rows.forEach((r) => {
        if (isCredit) {
          balance += (r.credit - r.debit);
        } else {
          balance += (r.debit - r.credit);
        }
        r.runningBalance = balance;
      });
    } else {
      // Per-account running balance for unified multi-account view
      const accBalanceMap = new Map<string, number>();
      rows.forEach((r) => {
        const acc = accounts.find((a) => a.code === r.accountCode || a.nameAr === r.accountNameAr);
        const isCredit = (acc?.normalBalance || acc?.nature) === 'CREDIT';
        const key = r.accountCode || r.accountNameAr || 'UNKNOWN';
        const initialAccOpening = Number(acc?.openingBalance || (acc as any)?.opening_balance || 0);
        const prev = accBalanceMap.has(key) ? accBalanceMap.get(key)! : initialAccOpening;
        const next = isCredit ? prev + (r.credit - r.debit) : prev + (r.debit - r.credit);
        accBalanceMap.set(key, next);
        r.runningBalance = next;
      });
    }

    return rows;
  }, [validJournals, selectedAccountId, searchTerm, accounts]);

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

  // Calculate accurate live balances for cash and bank accounts based on journals
  const cashboxAccountsWithBalances = useMemo(() => {
    return cashboxAccounts.map((acc) => {
      let movDebit = 0;
      let movCredit = 0;
      validJournals.forEach((j) => {
        j.lines?.forEach((line) => {
          const matchesAccount =
            line.accountId === acc.id ||
            line.accountCode === acc.code ||
            line.accountId === acc.code ||
            line.accountId === `acc-${acc.code}`;
          if (matchesAccount) {
            movDebit += Number(line.debit) || 0;
            movCredit += Number(line.credit) || 0;
          }
        });
      });

      const isDebit = (acc.normalBalance || (acc as any).nature || 'DEBIT') === 'DEBIT';
      const initialOpening = Number(acc.openingBalance || (acc as any)?.opening_balance || 0);
      const cardBal = Number(acc.currentBalance || acc.current_balance || acc.balance || 0);

      let liveBal = isDebit
        ? initialOpening + (movDebit - movCredit)
        : initialOpening + (movCredit - movDebit);

      if (movDebit === 0 && movCredit === 0 && cardBal !== 0) {
        liveBal = cardBal;
      }

      return {
        ...acc,
        liveBalance: liveBal,
      };
    });
  }, [cashboxAccounts, validJournals]);

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

          {/* Action Buttons: Unified Toolbar with Hierarchy */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Primary Action */}
            <button
              onClick={handleTriggerAggregation}
              disabled={isAggregating}
              className="px-4 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white shadow-xs flex items-center gap-2 transition-all cursor-pointer"
              title="إعادة التجميع والفرز اللحظي لكافة السجلات"
            >
              <RefreshCw className={`w-4 h-4 ${isAggregating ? 'animate-spin' : ''}`} />
              <span>{isAggregating ? 'جاري التجميع...' : 'تجميع واستخراج فوري'}</span>
            </button>

            {/* Secondary Action: Print Preview */}
            <button
              onClick={() => setIsPrintPreviewOpen(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-xs flex items-center gap-2 transition-all cursor-pointer"
              title="معاينة وطباعة التقرير المالي الموحد بصيغة A4 الرسمية"
            >
              <Eye className="w-4 h-4 text-emerald-400" />
              <span>معاينة وطباعة A4</span>
            </button>

            {/* Compact Export / Print Dropdown Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
                title="خيارات التصدير والطباعة الإضافية"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>خيارات التصدير</span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${isExportMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isExportMenuOpen && (
                <div className="absolute left-0 mt-1.5 w-48 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-30 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setIsExportMenuOpen(false);
                      handleExportToExcel();
                    }}
                    className="w-full px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 flex items-center gap-2 transition-colors cursor-pointer text-right"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span>تصدير Excel (.xlsx)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsExportMenuOpen(false);
                      handlePrint();
                    }}
                    className="w-full px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors cursor-pointer text-right"
                  >
                    <Printer className="w-4 h-4 text-slate-600" />
                    <span>طباعة سريعة (A4)</span>
                  </button>
                </div>
              )}
            </div>
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
        <div className="space-y-6">
          {/* Executive Audit & Integrity Status Bar */}
          <div className="bg-slate-900 text-white rounded-2xl shadow-xs border border-slate-800 p-3 sm:px-4 sm:py-3 flex flex-wrap items-center justify-between gap-3 no-print">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-white">
                    التدقيق المالي والمطابقة المحاسبية الشاملة
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    مطابق لدفتر الأستاذ العام (GL)
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  عرض شامل ومفصل لكافة الجمعيات والعملاء المعتمدين دون حذف أو اختصار مع احتساب فوري للأرصدة والمبيعات والمرتجعات
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTriggerAggregation}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isAggregating ? 'animate-spin' : 'text-emerald-400'}`} />
                <span>تحديث ومزامنة الأرقام</span>
              </button>

              <button
                type="button"
                onClick={() => setIsPrintPreviewOpen(true)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>معاينة وطباعة (A4)</span>
              </button>
            </div>
          </div>

          {/* Executive Summary Cards: Balanced Row with Hero Metric */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: إجمالي المبيعات */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">إجمالي المبيعات الصادرة</span>
                <ShoppingCart className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-base sm:text-lg font-bold font-mono text-slate-800 mt-2">
                {formatCurrency(report1Totals.grossSales, currency)}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {report1Totals.invoices} فاتورة بيع معتمدة
              </div>
            </div>

            {/* Card 2: إجمالي المرتجعات */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">إجمالي المرتجعات</span>
                <RotateCcw className="w-4 h-4 text-rose-400" />
              </div>
              <div className="text-base sm:text-lg font-bold font-mono text-rose-600 mt-2">
                {formatCurrency(report1Totals.returns, currency)}
              </div>
              <div className="text-[11px] text-rose-500/80 mt-1">
                {report1Totals.returnsCount} فاتورة مرتجع
              </div>
            </div>

            {/* Card 3: HERO METRIC - صافي المبيعات المعتمدة */}
            <div className="bg-gradient-to-br from-emerald-50 via-teal-50/40 to-white border-2 border-emerald-500 rounded-xl p-4 shadow-xs flex flex-col justify-between relative ring-2 ring-emerald-500/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black text-emerald-950">صافي المبيعات المعتمدة</span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white font-bold text-[9px]">
                    الأهم
                  </span>
                </div>
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono text-emerald-950 mt-1.5 tracking-tight">
                {formatCurrency(report1Totals.netSales, currency)}
              </div>
              <div className="text-[11px] text-emerald-700 font-bold mt-1">
                صافي الإيراد الفعلي بعد خصم المرتجعات
              </div>
            </div>

            {/* Card 4: إجمالي الأرصدة المستحقة */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">إجمالي الأرصدة المستحقة</span>
                <Scale className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-base sm:text-lg font-bold font-mono text-blue-700 mt-2">
                {formatCurrency(report1Totals.balance, currency)}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                ذمم العملاء والجمعيات الحالية
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
                          <div className="flex items-center justify-center gap-1.5">
                            {onViewAccountStatement && (
                              <button
                                onClick={() => onViewAccountStatement(row.id, 'CUSTOMER')}
                                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-700 transition-colors cursor-pointer flex items-center gap-1"
                                title="عرض وطباعة كشف الحساب المالي التفصيلي الموحد"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>كشف الحساب</span>
                              </button>
                            )}
                          </div>
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
              {cashboxAccountsWithBalances.map((acc) => {
                const bal = Number(acc.liveBalance) || 0;
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

      {/* 5. Print Preview Modal */}
      {isPrintPreviewOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto no-print animate-fade-in">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FileBarChart className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base">
                    معاينة وطباعة الكشف المالي الموحد المعتمد (A4)
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    كشف مبيعات وأرصدة الجمعيات التعاونية والعملاء - النسخة المدمجة
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    window.print();
                  }}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة فورية</span>
                </button>
                <button
                  onClick={handleExportToExcel}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white flex items-center gap-1.5 border border-white/20 transition-all cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
                  <span>Excel</span>
                </button>
                <button
                  onClick={() => setIsPrintPreviewOpen(false)}
                  className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Preview Body (A4 Paper Container) */}
            <div className="p-4 sm:p-8 overflow-y-auto bg-slate-100 flex justify-center">
              <div className="bg-white p-6 sm:p-8 rounded-xl shadow-md border border-slate-200 w-full max-w-[210mm] text-right font-sans text-xs">
                {/* Official Paper Header */}
                <div className="flex items-center justify-between pb-5 border-b-2 border-slate-900 mb-5">
                  <div className="flex items-center gap-3.5">
                    {company.logoUrl ? (
                      <img src={company.logoUrl} alt="Logo" className="w-16 h-16 object-contain" />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xl shadow-xs">
                        {company.nameAr ? company.nameAr.slice(0, 2) : 'مط'}
                      </div>
                    )}
                    <div>
                      <h2 className="text-lg font-black text-slate-950">{company.nameAr || 'مطحنة الوليد المتحدة'}</h2>
                      <p className="text-[11px] text-slate-600 mt-0.5">{company.activityAr || 'تجارة وتوزيع المواد الغذائية والحبوب والمطاحن'}</p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-1">
                        <span>س.ت: {company.crNumber || '123456'}</span>
                        <span>•</span>
                        <span>هاتف: {company.phone || '24810000'}</span>
                        <span>•</span>
                        <span>دولة الكويت</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-left text-[11px] text-slate-600">
                    <span className="inline-block px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded font-bold mb-1.5">
                      تقرير مالي وإداري معتمد
                    </span>
                    <div>التاريخ: <span className="font-mono font-bold text-slate-900">{new Date().toLocaleDateString('ar-KW')}</span></div>
                    <div>الوقت: <span className="font-mono text-slate-600">{new Date().toLocaleTimeString('ar-KW')}</span></div>
                  </div>
                </div>

                {/* Report Title & Metadata */}
                <div className="text-center mb-5 pb-3 border-b border-slate-200">
                  <h1 className="text-base font-black text-slate-950">
                    كشف مبيعات وأرصدة الجمعيات التعاونية والعملاء (التقرير المدمج والموحد)
                  </h1>
                  <p className="text-[11px] text-slate-600 mt-1">
                    الفترة: {datePreset === 'ALL' ? 'كافة الفترات المالية المسجلة' : `من ${startDate} إلى ${endDate}`} | العملة: {currencyName} ({currencySym}) | عدد السجلات المعتمدة: {customerSalesAggregated.length} جهة
                  </p>
                </div>

                {/* Unified Table */}
                <table className="w-full text-right text-[11px] border border-slate-300 mb-5">
                  <thead>
                    <tr className="bg-slate-100 text-slate-900 font-black border-b border-slate-300">
                      <th className="py-2 px-2.5 border-l border-slate-300 text-center w-8">م</th>
                      <th className="py-2 px-2.5 border-l border-slate-300 w-16">كود الجهة</th>
                      <th className="py-2 px-2.5 border-l border-slate-300">اسم الجمعية التعاونية / العميل</th>
                      <th className="py-2 px-2.5 border-l border-slate-300 text-center w-24">التصنيف</th>
                      <th className="py-2 px-2.5 border-l border-slate-300 text-center w-12">الفواتير</th>
                      <th className="py-2 px-2.5 border-l border-slate-300 text-center w-12">المرتجع</th>
                      <th className="py-2 px-2.5 border-l border-slate-300 text-left w-24">إجمالي المبيعات</th>
                      <th className="py-2 px-2.5 border-l border-slate-300 text-left w-20">المرتجع</th>
                      <th className="py-2 px-2.5 border-l border-slate-300 text-left w-24">صافي المبيعات</th>
                      <th className="py-2 px-2.5 text-left w-24">الرصيد القائم</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {customerSalesAggregated.map((row, idx) => (
                      <tr key={row.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                        <td className="py-1.5 px-2.5 border-l border-slate-200 text-center font-mono text-[10px] text-slate-500">
                          {idx + 1}
                        </td>
                        <td className="py-1.5 px-2.5 border-l border-slate-200 font-mono font-bold text-slate-700">
                          {row.code}
                        </td>
                        <td className="py-1.5 px-2.5 border-l border-slate-200 font-bold text-slate-950">
                          {row.nameAr}
                        </td>
                        <td className="py-1.5 px-2.5 border-l border-slate-200 text-center text-slate-600 text-[10px]">
                          {row.category}
                        </td>
                        <td className="py-1.5 px-2.5 border-l border-slate-200 text-center font-mono font-bold">
                          {row.invoiceCount}
                        </td>
                        <td className="py-1.5 px-2.5 border-l border-slate-200 text-center font-mono text-rose-600">
                          {row.returnCount}
                        </td>
                        <td className="py-1.5 px-2.5 border-l border-slate-200 text-left font-mono font-bold">
                          {formatCurrency(row.grossSales, currency)}
                        </td>
                        <td className="py-1.5 px-2.5 border-l border-slate-200 text-left font-mono text-rose-600">
                          {row.returns > 0 ? formatCurrency(row.returns, currency) : '0.000'}
                        </td>
                        <td className="py-1.5 px-2.5 border-l border-slate-200 text-left font-mono font-black text-emerald-800">
                          {formatCurrency(row.netSales, currency)}
                        </td>
                        <td className="py-1.5 px-2.5 text-left font-mono font-black text-slate-950">
                          {formatCurrency(row.currentBalance, currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-black text-slate-950 border-t-2 border-slate-400">
                      <td colSpan={4} className="py-2.5 px-2.5 border-l border-slate-300">
                        الإجمالي العام المعتمد ({customerSalesAggregated.length} جهة)
                      </td>
                      <td className="py-2.5 px-2.5 border-l border-slate-300 text-center font-mono">
                        {report1Totals.invoices}
                      </td>
                      <td className="py-2.5 px-2.5 border-l border-slate-300 text-center font-mono text-rose-600">
                        {report1Totals.returnsCount}
                      </td>
                      <td className="py-2.5 px-2.5 border-l border-slate-300 text-left font-mono">
                        {formatCurrency(report1Totals.grossSales, currency)}
                      </td>
                      <td className="py-2.5 px-2.5 border-l border-slate-300 text-left font-mono text-rose-600">
                        {formatCurrency(report1Totals.returns, currency)}
                      </td>
                      <td className="py-2.5 px-2.5 border-l border-slate-300 text-left font-mono text-emerald-900">
                        {formatCurrency(report1Totals.netSales, currency)}
                      </td>
                      <td className="py-2.5 px-2.5 text-left font-mono text-slate-950">
                        {formatCurrency(report1Totals.balance, currency)}
                      </td>
                    </tr>
                  </tfoot>
                </table>

                {/* Tafqeet in Words */}
                <div className="bg-slate-50 border border-slate-300 rounded-lg p-3 mb-6 text-[11px] leading-relaxed">
                  <div>
                    <span className="font-bold text-slate-700">صافي المبيعات كتابةً: </span>
                    <span className="font-black text-emerald-900">{tafqeetCurrency(report1Totals.netSales, currency)}</span>
                  </div>
                  <div className="mt-1">
                    <span className="font-bold text-slate-700">إجمالي الأرصدة القائمة كتابةً: </span>
                    <span className="font-black text-blue-900">{tafqeetCurrency(report1Totals.balance, currency)}</span>
                  </div>
                </div>

                {/* Signature Row */}
                <div className="grid grid-cols-3 gap-6 text-center text-[11px] pt-4 border-t border-slate-300">
                  <div>
                    <div className="font-bold text-slate-800">إعداد المحاسب المسؤول</div>
                    <div className="h-12 flex items-end justify-center text-slate-400 font-mono text-[10px]">...........................</div>
                  </div>
                  <div>
                    <div className="font-bold text-slate-800">مراجعة وتدقيق الحسابات</div>
                    <div className="h-12 flex items-end justify-center text-slate-400 font-mono text-[10px]">...........................</div>
                  </div>
                  <div>
                    <div className="font-bold text-slate-800">اعتماد الإدارة المالية والختم</div>
                    <div className="h-12 flex items-end justify-center text-slate-400 font-mono text-[10px]">...........................</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. Dedicated Native Print Container (Automatically picked up when printing page) */}
      <div id="printable-document" className="hidden print:block p-6 bg-white text-slate-900 font-sans dir-rtl text-right">
        {/* Official Header */}
        <div className="flex items-center justify-between pb-4 border-b-2 border-slate-900 mb-4">
          <div className="flex items-center gap-3">
            {company.logoUrl ? (
              <img src={company.logoUrl} alt="Logo" className="w-14 h-14 object-contain" />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-lg">
                {company.nameAr ? company.nameAr.slice(0, 2) : 'مط'}
              </div>
            )}
            <div>
              <h2 className="text-base font-black text-slate-900">{company.nameAr || 'مطحنة الوليد المتحدة'}</h2>
              <p className="text-[10px] text-slate-600">{company.activityAr || 'تجارة وتوزيع المواد الغذائية والحبوب والمطاحن'}</p>
              <div className="flex items-center gap-2 text-[9px] text-slate-500">
                <span>س.ت: {company.crNumber || '123456'}</span>
                <span>•</span>
                <span>هاتف: {company.phone || '24810000'}</span>
                <span>•</span>
                <span>الكويت</span>
              </div>
            </div>
          </div>
          <div className="text-left text-[10px]">
            <div className="font-bold text-slate-800">تقرير إداري مالي رسمي معتمد</div>
            <div className="text-slate-600 font-mono">التاريخ: {new Date().toLocaleDateString('ar-KW')}</div>
            <div className="text-slate-600 font-mono">الوقت: {new Date().toLocaleTimeString('ar-KW')}</div>
          </div>
        </div>

        {/* Report Title */}
        <div className="mb-4 text-center">
          <h1 className="text-sm font-black text-slate-900">
            كشف مبيعات وأرصدة الجمعيات التعاونية والعملاء (التقرير المدمج والموحد)
          </h1>
          <p className="text-[10px] text-slate-600 mt-0.5">
            الفترة: {datePreset === 'ALL' ? 'كافة الفترات المالية المعتمدة' : `من ${startDate} إلى ${endDate}`} | العملة: {currencyName} ({currencySym})
          </p>
        </div>

        {/* Table */}
        <table className="w-full text-right text-[10px] border border-slate-300 mb-4">
          <thead>
            <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300">
              <th className="py-1.5 px-2 border-l border-slate-300 text-center w-6">م</th>
              <th className="py-1.5 px-2 border-l border-slate-300 w-16">كود الجهة</th>
              <th className="py-1.5 px-2 border-l border-slate-300">اسم الجمعية التعاونية / العميل</th>
              <th className="py-1.5 px-2 border-l border-slate-300 text-center w-20">التصنيف</th>
              <th className="py-1.5 px-2 border-l border-slate-300 text-center w-10">الفواتير</th>
              <th className="py-1.5 px-2 border-l border-slate-300 text-center w-10">المرتجع</th>
              <th className="py-1.5 px-2 border-l border-slate-300 text-left w-20">إجمالي المبيعات</th>
              <th className="py-1.5 px-2 border-l border-slate-300 text-left w-16">المرتجع</th>
              <th className="py-1.5 px-2 border-l border-slate-300 text-left w-20">صافي المبيعات</th>
              <th className="py-1.5 px-2 text-left w-20">الرصيد القائم</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {customerSalesAggregated.map((row, idx) => (
              <tr key={row.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                <td className="py-1 px-2 border-l border-slate-200 text-center font-mono text-slate-500">
                  {idx + 1}
                </td>
                <td className="py-1 px-2 border-l border-slate-200 font-mono font-bold text-slate-700">
                  {row.code}
                </td>
                <td className="py-1 px-2 border-l border-slate-200 font-bold text-slate-950">
                  {row.nameAr}
                </td>
                <td className="py-1 px-2 border-l border-slate-200 text-center text-slate-600">
                  {row.category}
                </td>
                <td className="py-1 px-2 border-l border-slate-200 text-center font-mono font-bold">
                  {row.invoiceCount}
                </td>
                <td className="py-1 px-2 border-l border-slate-200 text-center font-mono text-rose-600">
                  {row.returnCount}
                </td>
                <td className="py-1 px-2 border-l border-slate-200 text-left font-mono font-bold">
                  {formatCurrency(row.grossSales, currency)}
                </td>
                <td className="py-1 px-2 border-l border-slate-200 text-left font-mono text-rose-600">
                  {row.returns > 0 ? formatCurrency(row.returns, currency) : '0.000'}
                </td>
                <td className="py-1 px-2 border-l border-slate-200 text-left font-mono font-black text-emerald-950">
                  {formatCurrency(row.netSales, currency)}
                </td>
                <td className="py-1 px-2 text-left font-mono font-black text-slate-950">
                  {formatCurrency(row.currentBalance, currency)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 font-black text-slate-950 border-t-2 border-slate-400">
              <td colSpan={4} className="py-2 px-2 border-l border-slate-300">
                الإجمالي العام المعتمد ({customerSalesAggregated.length} جهة)
              </td>
              <td className="py-2 px-2 border-l border-slate-300 text-center font-mono">
                {report1Totals.invoices}
              </td>
              <td className="py-2 px-2 border-l border-slate-300 text-center font-mono text-rose-600">
                {report1Totals.returnsCount}
              </td>
              <td className="py-2 px-2 border-l border-slate-300 text-left font-mono">
                {formatCurrency(report1Totals.grossSales, currency)}
              </td>
              <td className="py-2 px-2 border-l border-slate-300 text-left font-mono text-rose-600">
                {formatCurrency(report1Totals.returns, currency)}
              </td>
              <td className="py-2 px-2 border-l border-slate-300 text-left font-mono text-emerald-950">
                {formatCurrency(report1Totals.netSales, currency)}
              </td>
              <td className="py-2 px-2 text-left font-mono text-slate-950">
                {formatCurrency(report1Totals.balance, currency)}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Tafqeet */}
        <div className="bg-slate-50 border border-slate-300 rounded p-2 mb-4 text-[10px] leading-normal">
          <div>
            <span className="font-bold text-slate-700">صافي المبيعات كتابةً: </span>
            <span className="font-black text-emerald-950">{tafqeetCurrency(report1Totals.netSales, currency)}</span>
          </div>
          <div className="mt-0.5">
            <span className="font-bold text-slate-700">إجمالي الأرصدة القائمة كتابةً: </span>
            <span className="font-black text-blue-950">{tafqeetCurrency(report1Totals.balance, currency)}</span>
          </div>
        </div>

        {/* Signatures */}
        <div className="grid grid-cols-3 gap-6 text-center text-[10px] pt-3 border-t border-slate-300">
          <div>
            <div className="font-bold text-slate-800">إعداد المحاسب المسؤول</div>
            <div className="h-8 flex items-end justify-center text-slate-400 font-mono text-[9px]">...........................</div>
          </div>
          <div>
            <div className="font-bold text-slate-800">مراجعة وتدقيق الحسابات</div>
            <div className="h-8 flex items-end justify-center text-slate-400 font-mono text-[9px]">...........................</div>
          </div>
          <div>
            <div className="font-bold text-slate-800">اعتماد الإدارة والختم</div>
            <div className="h-8 flex items-end justify-center text-slate-400 font-mono text-[9px]">...........................</div>
          </div>
        </div>
      </div>
    </div>
  );
};
