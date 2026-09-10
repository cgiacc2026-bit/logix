import React, { useState, useMemo, useEffect } from 'react';
import { Customer, Supplier, Invoice, PaymentVoucher, JournalEntry, CompanyProfile } from '../types.js';
import { formatCurrency } from '../utils/formatters.ts';
import { resolveActiveCompany } from '../utils/companyResolver.ts';
import {
  getAccountStatement,
  AccountStatementResult,
  getQuickDatePresets,
  StatementTransaction,
  calculateEntityCurrentBalance,
} from '../services/statementService.ts';
import {
  Printer,
  Calendar,
  Search,
  ArrowDownLeft,
  ArrowUpRight,
  FileSpreadsheet,
  Building2,
  User,
  Phone,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
  Filter,
  Download,
  Clock,
  Sparkles,
  CreditCard,
  Hash,
  Eye,
  FileText,
  BadgeCheck,
  Scale,
  Building,
  Award,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Type,
} from 'lucide-react';

interface AccountStatementViewProps {
  customers: Customer[];
  suppliers: Supplier[];
  invoices: Invoice[];
  vouchers: PaymentVoucher[];
  journals?: JournalEntry[];
  company: CompanyProfile | null;
  currency: string;
  initialEntityType?: 'CUSTOMER' | 'SUPPLIER';
  initialEntityId?: string;
}

export const AccountStatementView: React.FC<AccountStatementViewProps> = ({
  customers,
  suppliers,
  invoices,
  vouchers,
  journals = [],
  company,
  currency,
  initialEntityType = 'CUSTOMER',
  initialEntityId,
}) => {
  const activeCompany = resolveActiveCompany(company);

  // 1. حالة نوع الكيان والكيان المختار
  const [entityType, setEntityType] = useState<'CUSTOMER' | 'SUPPLIER'>(initialEntityType);
  const [selectedEntityId, setSelectedEntityId] = useState<string>(
    initialEntityId || (initialEntityType === 'CUSTOMER' ? customers[0]?.id || '' : suppliers[0]?.id || '')
  );

  // 2. حالة التواريخ الافتراضية (من أول يوم في الشهر الحالي إلى اليوم)
  const defaultRange = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return {
      start: `${year}-${month}-01`,
      end: `${year}-${month}-${day}`,
    };
  }, []);

  const [startDate, setStartDate] = useState<string>(defaultRange.start);
  const [endDate, setEndDate] = useState<string>(defaultRange.end);
  const [activePreset, setActivePreset] = useState<string>('this-month');

  // 3. حالة البحث وتصفية الحركات داخل الكشف
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [movementFilter, setMovementFilter] = useState<'ALL' | 'ACTIVE_ONLY' | 'CANCELLED_ONLY'>('ALL');

  // 4. أدوات التحكم في التكبير والتصغير وحجم الخط
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [fontScale, setFontScale] = useState<'NORMAL' | 'LARGE' | 'XLARGE'>('NORMAL');

  // تحديث الكيان عند تغيير نوع الكيان (عميل / مورد)
  useEffect(() => {
    if (entityType === 'CUSTOMER') {
      if (!customers.some((c) => c.id === selectedEntityId)) {
        setSelectedEntityId(customers[0]?.id || '');
      }
    } else {
      if (!suppliers.some((s) => s.id === selectedEntityId)) {
        setSelectedEntityId(suppliers[0]?.id || '');
      }
    }
  }, [entityType, customers, suppliers, selectedEntityId]);

  // الكيان المحدد حالياً
  const currentEntity = useMemo(() => {
    if (entityType === 'CUSTOMER') {
      return customers.find((c) => c.id === selectedEntityId) || null;
    }
    return suppliers.find((s) => s.id === selectedEntityId) || null;
  }, [entityType, selectedEntityId, customers, suppliers]);

  // احتساب كشف الحساب المالي الكامل من الـ Service
  const statementResult: AccountStatementResult | null = useMemo(() => {
    if (!currentEntity) return null;
    return getAccountStatement(
      currentEntity.id,
      entityType,
      startDate,
      endDate,
      {
        invoices,
        vouchers,
        journals,
        customers,
        suppliers,
        currency,
      }
    );
  }, [currentEntity, entityType, startDate, endDate, invoices, vouchers, journals, customers, suppliers, currency]);

  // تصفية الحركات بناءً على البحث ونوع الحالة
  const filteredTransactions = useMemo(() => {
    if (!statementResult) return [];

    return statementResult.transactions.filter((tx) => {
      // 1. فلتر الحالة
      if (movementFilter === 'ACTIVE_ONLY' && (tx.status === 'CANCELLED' || tx.status === 'REVERSAL')) {
        return false;
      }
      if (movementFilter === 'CANCELLED_ONLY' && tx.status === 'ACTIVE') {
        return false;
      }

      // 2. فلتر البحث
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        tx.docNumber.toLowerCase().includes(term) ||
        tx.description.toLowerCase().includes(term) ||
        tx.date.includes(term) ||
        tx.docTypeLabel.toLowerCase().includes(term)
      );
    });
  }, [statementResult, movementFilter, searchTerm]);

  // خيارات الفترات الزمنية السريعة
  const presets = useMemo(() => getQuickDatePresets(), []);

  const handleApplyPreset = (presetId: string) => {
    const p = presets.find((item) => item.id === presetId);
    if (p) {
      const range = p.getRange();
      setStartDate(range.start);
      setEndDate(range.end);
      setActivePreset(presetId);
    }
  };

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(200, prev + 10));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(70, prev - 10));
  };

  const handleResetZoom = () => {
    setZoomLevel(100);
    setFontScale('NORMAL');
  };

  const getFontScaleClass = () => {
    if (fontScale === 'XLARGE') return 'text-[15px] leading-relaxed';
    if (fontScale === 'LARGE') return 'text-[13.5px] leading-normal';
    return 'text-xs leading-normal';
  };

  // تصدير كشف الحساب إلى Excel / CSV
  const handleExportCSV = () => {
    if (!statementResult) return;

    const headers = [
      'م',
      'التاريخ',
      'رقم المستند',
      'نوع الحركة',
      'البيان المحاسبي',
      'مدين (+)',
      'دائن (-)',
      'الرصيد الجاري',
      'الحالة',
    ];

    const rows = [
      // سطر الرصيد الافتتاحي
      [
        '0',
        statementResult.startDate,
        'OPEN-BAL',
        'رصيد افتتاحي',
        `الرصيد الافتتاحي المنقول قبل تاريخ ${statementResult.startDate}`,
        statementResult.openingBalance > 0 && statementResult.openingBalanceType === 'DEBIT'
          ? statementResult.openingBalance.toFixed(3)
          : '0.000',
        statementResult.openingBalance > 0 && statementResult.openingBalanceType === 'CREDIT'
          ? statementResult.openingBalance.toFixed(3)
          : '0.000',
        statementResult.openingBalance.toFixed(3),
        'افتتاحي',
      ],
      // أسطر الحركات
      ...filteredTransactions.map((tx, idx) => [
        String(idx + 1),
        tx.date,
        tx.docNumber,
        tx.docTypeLabel,
        `"${tx.description.replace(/"/g, '""')}"`,
        tx.debit.toFixed(3),
        tx.credit.toFixed(3),
        tx.runningBalance.toFixed(3),
        tx.status === 'ACTIVE' ? 'معتمد' : tx.status === 'CANCELLED' ? 'ملغي' : 'عكسي',
      ]),
      // سطر الإجماليات
      [
        '#',
        statementResult.endDate,
        'TOTALS',
        'إجمالي حركات الفترة والرصيد الختامي',
        'المجموع الإجمالي للحركات خلال الفترة المحددة',
        statementResult.totalPeriodDebit.toFixed(3),
        statementResult.totalPeriodCredit.toFixed(3),
        statementResult.closingBalance.toFixed(3),
        'ختامي',
      ],
    ];

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `كشف_حساب_${statementResult.entityNameAr}_${statementResult.startDate}_${statementResult.endDate}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 dir-rtl text-right">
      {/* Injected Print Stylesheet for High-DPI Crisp Printing */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 7mm 8mm 7mm;
          }
          body {
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
          .print-scalable-container {
            transform: none !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          #printable-statement {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          table {
            table-layout: fixed !important;
            width: 100% !important;
            max-width: 100% !important;
            border-collapse: collapse !important;
            page-break-inside: auto;
          }
          th, td {
            word-break: break-word !important;
            overflow-wrap: break-word !important;
            box-sizing: border-box !important;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          thead {
            display: table-header-group;
          }
          tfoot {
            display: table-footer-group;
          }
          .print-avoid-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `,
        }}
      />

      {/* ========================================================================= */}
      {/* 1. قسم التحكم واختيار الحساب والفترة مع أدوات التكبير والتصغير والطباعة */}
      {/* ========================================================================= */}
      <div className="bg-white border border-[#E5E1DA] rounded-xl p-5 shadow-xs space-y-4 no-print">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#E5E1DA] pb-4">
          <div className="space-y-1">
            <h2 className="text-xl font-serif font-bold text-[#1A1A1A] flex items-center gap-2.5">
              <FileText className="w-6 h-6 text-[#B8860B]" />
              <span>كشف حساب مالي تفصيلي (Account Statement)</span>
            </h2>
            <p className="text-xs text-[#8C8273]">
              حساب دقيق للأرصدة الافتتاحية، حركات الفترة، والرصيد الجاري المتراكم وفق معايير المحاسبة الدولية IFRS
            </p>
          </div>

          {/* أزرار التكبير/التصغير والتصدير والطباعة */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Zoom Controls Pill */}
            <div className="flex items-center bg-[#F7F5F0] border border-[#E5E1DA] rounded-lg p-0.5">
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={zoomLevel <= 70}
                className="p-1.5 text-[#6E6659] hover:text-[#1A1A1A] hover:bg-[#E5E1DA] rounded-md transition-colors disabled:opacity-30 cursor-pointer"
                title="تصغير كشف الحساب (Zoom Out)"
              >
                <ZoomOut className="w-4 h-4" />
              </button>

              <div className="px-2 text-xs font-mono font-bold text-[#B8860B] min-w-[50px] text-center select-none">
                {zoomLevel}%
              </div>

              <button
                type="button"
                onClick={handleZoomIn}
                disabled={zoomLevel >= 200}
                className="p-1.5 text-[#6E6659] hover:text-[#1A1A1A] hover:bg-[#E5E1DA] rounded-md transition-colors disabled:opacity-30 cursor-pointer"
                title="تكبير كشف الحساب (Zoom In)"
              >
                <ZoomIn className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleResetZoom}
                className="p-1.5 text-[#8C8273] hover:text-[#B8860B] hover:bg-[#E5E1DA] rounded-md transition-colors border-r border-[#E5E1DA] cursor-pointer"
                title="إعادة ضبط الحجم الافتراضي 100%"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Font Size Preset Selector */}
            <div className="flex items-center bg-[#F7F5F0] border border-[#E5E1DA] rounded-lg p-0.5 text-[11px] font-bold">
              <span className="px-2 text-[#6E6659] flex items-center gap-1">
                <Type className="w-3.5 h-3.5 text-[#B8860B]" /> الخط:
              </span>
              <button
                type="button"
                onClick={() => setFontScale('NORMAL')}
                className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
                  fontScale === 'NORMAL' ? 'bg-[#1A1A1A] text-white' : 'text-[#6E6659] hover:text-[#1A1A1A]'
                }`}
              >
                عادي
              </button>
              <button
                type="button"
                onClick={() => setFontScale('LARGE')}
                className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
                  fontScale === 'LARGE' ? 'bg-[#1A1A1A] text-white' : 'text-[#6E6659] hover:text-[#1A1A1A]'
                }`}
              >
                كبير (+15%)
              </button>
              <button
                type="button"
                onClick={() => setFontScale('XLARGE')}
                className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
                  fontScale === 'XLARGE' ? 'bg-[#1A1A1A] text-white' : 'text-[#6E6659] hover:text-[#1A1A1A]'
                }`}
              >
                واضح جداً (+30%)
              </button>
            </div>

            <button
              onClick={handleExportCSV}
              disabled={!statementResult}
              className="px-3 py-2 bg-[#F2EFE9] hover:bg-[#E5E1DA] text-[#1A1A1A] rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-[#E5E1DA] disabled:opacity-40"
              title="تصدير جدول الحركات إلى ملف Excel / CSV"
            >
              <Download className="w-4 h-4 text-[#2D6A4F]" />
              <span>تصدير CSV</span>
            </button>

            <button
              onClick={() => window.print()}
              disabled={!statementResult}
              className="px-4 py-2 bg-[#1A1A1A] hover:bg-black text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer border border-[#1A1A1A] disabled:opacity-40"
              title="طباعة سند كشف الحساب الرسمي المعتمد"
            >
              <Printer className="w-4 h-4 text-[#D4AF37]" />
              <span>طباعة الكشف</span>
            </button>
          </div>
        </div>

        {/* محدد نوع الحساب (عميل / مورد) والقائمة المنسدلة */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          {/* تبديل الكيان عميل/مورد */}
          <div className="lg:col-span-4 flex items-center bg-[#F7F5F0] p-1 rounded-xl border border-[#E5E1DA]">
            <button
              type="button"
              onClick={() => setEntityType('CUSTOMER')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                entityType === 'CUSTOMER'
                  ? 'bg-white text-[#1A1A1A] shadow-xs border border-[#E5E1DA]'
                  : 'text-[#8C8273] hover:text-[#1A1A1A]'
              }`}
            >
              <User className="w-4 h-4 text-cyan-600" />
              <span>عملاء وجمعيات ({customers.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setEntityType('SUPPLIER')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                entityType === 'SUPPLIER'
                  ? 'bg-white text-[#1A1A1A] shadow-xs border border-[#E5E1DA]'
                  : 'text-[#8C8273] hover:text-[#1A1A1A]'
              }`}
            >
              <Building2 className="w-4 h-4 text-amber-600" />
              <span>موردين وشركات ({suppliers.length})</span>
            </button>
          </div>

          {/* القائمة المنسدلة للكيانات */}
          <div className="lg:col-span-8">
            <select
              value={selectedEntityId}
              onChange={(e) => setSelectedEntityId(e.target.value)}
              className="w-full bg-[#FDFCFB] border border-[#E5E1DA] rounded-xl px-3.5 py-2.5 text-xs text-[#1A1A1A] font-bold focus:outline-none focus:border-[#1A1A1A] cursor-pointer"
            >
              <option value="">-- اختر {entityType === 'CUSTOMER' ? 'العميل أو الجمعية' : 'المورد أو الشركة'} --</option>
              {entityType === 'CUSTOMER'
                ? customers.map((c) => {
                    const currentBal = calculateEntityCurrentBalance(c, 'CUSTOMER', invoices, vouchers, journals);
                    return (
                      <option key={c.id} value={c.id}>
                        {c.code} - {c.nameAr} | الرصيد الحالي: {formatCurrency(currentBal, currency)}
                      </option>
                    );
                  })
                : suppliers.map((s) => {
                    const currentBal = calculateEntityCurrentBalance(s, 'SUPPLIER', invoices, vouchers, journals);
                    return (
                      <option key={s.id} value={s.id}>
                        {s.code} - {s.nameAr} | الرصيد الحالي: {formatCurrency(currentBal, currency)}
                      </option>
                    );
                  })}
            </select>
          </div>
        </div>

        {/* شريط الفلاتر الزمنية والفترات المسبقة */}
        <div className="pt-2 border-t border-[#E5E1DA] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#6E6659] flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#B8860B]" />
                من تاريخ:
              </span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setActivePreset('');
                }}
                className="bg-[#FDFCFB] border border-[#E5E1DA] rounded-lg px-2.5 py-1.5 text-xs text-[#1A1A1A] font-mono focus:outline-none focus:border-[#1A1A1A]"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#6E6659]">إلى تاريخ:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setActivePreset('');
                }}
                className="bg-[#FDFCFB] border border-[#E5E1DA] rounded-lg px-2.5 py-1.5 text-xs text-[#1A1A1A] font-mono focus:outline-none focus:border-[#1A1A1A]"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {presets.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleApplyPreset(p.id)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer border ${
                  activePreset === p.id
                    ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]'
                    : 'bg-[#F7F5F0] text-[#6E6659] border-[#E5E1DA] hover:bg-[#E5E1DA]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. بطاقات المؤشرات المالية السريعة (KPI Overview Cards) */}
      {/* ========================================================================= */}
      {statementResult && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 no-print">
          {/* Card 1: الرصيد الافتتاحي المنقول */}
          <div className="bg-white border border-[#E5E1DA] rounded-xl p-4 shadow-xs space-y-1">
            <div className="flex items-center justify-between text-[#8C8273] text-xs font-semibold">
              <span>الرصيد الافتتاحي المنقول</span>
              <Clock className="w-4 h-4 text-[#B8860B]" />
            </div>
            <div className="text-lg font-serif font-extrabold text-[#1A1A1A] font-mono">
              {formatCurrency(statementResult.openingBalance, currency)}
            </div>
            <div className="text-[11px] text-[#8C8273]">
              ما قبل تاريخ: <span className="font-mono font-bold text-[#1A1A1A]">{statementResult.startDate}</span>
            </div>
          </div>

          {/* Card 2: إجمالي حركات المدين */}
          <div className="bg-white border border-[#E5E1DA] rounded-xl p-4 shadow-xs space-y-1">
            <div className="flex items-center justify-between text-[#8C8273] text-xs font-semibold">
              <span>إجمالي حركات المدين (+)</span>
              <ArrowUpRight className="w-4 h-4 text-[#2D6A4F]" />
            </div>
            <div className="text-lg font-serif font-extrabold text-[#2D6A4F] font-mono">
              {formatCurrency(statementResult.totalPeriodDebit, currency)}
            </div>
            <div className="text-[11px] text-[#8C8273]">فواتير ومطالبات الفترة</div>
          </div>

          {/* Card 3: إجمالي حركات الدائن */}
          <div className="bg-white border border-[#E5E1DA] rounded-xl p-4 shadow-xs space-y-1">
            <div className="flex items-center justify-between text-[#8C8273] text-xs font-semibold">
              <span>إجمالي حركات الدائن (-)</span>
              <ArrowDownLeft className="w-4 h-4 text-[#9E2A2B]" />
            </div>
            <div className="text-lg font-serif font-extrabold text-[#9E2A2B] font-mono">
              {formatCurrency(statementResult.totalPeriodCredit, currency)}
            </div>
            <div className="text-[11px] text-[#8C8273]">سدادات ومقبوضات الفترة</div>
          </div>

          {/* Card 4: صافي حركة الفترة */}
          <div className="bg-white border border-[#E5E1DA] rounded-xl p-4 shadow-xs space-y-1">
            <div className="flex items-center justify-between text-[#8C8273] text-xs font-semibold">
              <span>صافي حركة الفترة</span>
              <Scale className="w-4 h-4 text-cyan-600" />
            </div>
            <div className="text-lg font-serif font-extrabold text-[#1A1A1A] font-mono">
              {formatCurrency(statementResult.netPeriodMovement, currency)}
            </div>
            <div className="text-[11px] text-[#8C8273]">
              عدد الحركات: <span className="font-bold text-[#1A1A1A]">{statementResult.totalTransactionsCount}</span>
            </div>
          </div>

          {/* Card 5: الرصيد الختامي المستحق */}
          <div className="bg-[#FAF8F5] border-2 border-[#B8860B]/40 rounded-xl p-4 shadow-xs space-y-1">
            <div className="flex items-center justify-between text-[#B8860B] text-xs font-bold">
              <span>الرصيد الختامي المستحق</span>
              <ShieldCheck className="w-4 h-4 text-[#B8860B]" />
            </div>
            <div className="text-xl font-serif font-black text-[#1A1A1A] font-mono">
              {formatCurrency(statementResult.closingBalance, currency)}
            </div>
            <div className="flex items-center gap-1.5 text-[11px]">
              {statementResult.auditMatch ? (
                <span className="text-[#2D6A4F] font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> مطابق دفترياً
                </span>
              ) : (
                <span className="text-[#B8860B] font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> يغطي فترة جزئية
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. حاوية المستند المالي الرسمي المعتمد مع التكبير والتصغير */}
      {/* ========================================================================= */}
      {statementResult ? (
        <div
          id="printable-statement"
          className={`bg-white border border-[#E2E8F0] rounded-2xl shadow-sm overflow-hidden printable-card transition-transform duration-150 origin-top print-scalable-container print:border-none print:shadow-none print:rounded-none ${getFontScaleClass()}`}
          style={{
            transform: zoomLevel !== 100 ? `scale(${zoomLevel / 100})` : undefined,
            transformOrigin: 'top center',
            marginBottom: zoomLevel > 100 ? `${(zoomLevel - 100) * 8}px` : undefined,
          }}
        >
          {/* الترويسة العلوية الرسمية (Header) */}
          <div className="p-6 md:p-8 bg-[#FDFCFB] border-b border-[#E2E8F0] space-y-6 print:p-2.5 print:space-y-2 print:bg-white print:border-b-2 print:border-black">
            <div className="flex flex-col md:flex-row items-stretch justify-between gap-6 pb-6 border-b border-[#E2E8F0] print:pb-2 print:gap-3 print:border-b print:border-neutral-300">
              {/* الطرف الأيمن: إطار الشعار المؤسسي وبيانات الشركة */}
              <div className="flex items-center gap-4.5 flex-1 print:gap-3">
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-gradient-to-br from-[#1A1A1A] via-[#2A2A2A] to-[#1A1A1A] text-white p-0.5 shadow-md flex flex-col items-center justify-center shrink-0 border-2 border-[#D4AF37]/50 relative overflow-hidden print:w-12 print:h-12 print:rounded-lg print:border-black">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/20 via-transparent to-transparent"></div>
                  <Building2 className="w-7 h-7 md:w-8 md:h-8 text-[#D4AF37] relative z-10 mb-0.5 print:w-5 print:h-5 print:text-black" />
                  <span className="text-[9px] md:text-[10px] font-serif font-black tracking-widest text-[#D4AF37] uppercase relative z-10 print:text-[8px] print:text-black truncate max-w-full px-1">
                    {activeCompany.nameEn?.split(' ')[0] || activeCompany.tradeName?.split(' ')[0] || 'LOGIX'}
                  </span>
                </div>

                <div className="space-y-1 print:space-y-0.5">
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl md:text-2xl font-serif font-extrabold text-[#1A1A1A] tracking-tight print:text-lg">
                      {activeCompany.nameAr || activeCompany.headerTitle || 'كشف حساب معتمد'}
                    </h1>
                    <span className="px-2 py-0.5 bg-[#FAF3E0] text-[#996515] border border-[#D4AF37]/30 text-[10px] font-bold rounded-full hidden sm:inline-flex items-center gap-1 print:hidden">
                      <Award className="w-3 h-3 text-[#B8860B]" />
                      معتمد IFRS
                    </span>
                  </div>
                  <p className="text-xs text-[#64748B] font-medium leading-relaxed print:text-[10px] print:text-black">
                    {activeCompany.activityAr || activeCompany.headerNotes || 'الأعمال التجارية والأنشطة المالية المعتمدة'}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#475569] pt-1 font-sans print:pt-0.5 print:gap-x-2 print:text-[9px] print:text-neutral-800">
                    {(activeCompany.commercialRegNumber || activeCompany.crNumber) && (
                      <span className="bg-[#F1F5F9] px-2 py-0.5 rounded border border-[#E2E8F0] print:bg-white print:border-neutral-400 print:px-1">
                        سجل تجاري: <strong className="font-mono text-[#0F172A] print:text-black">{activeCompany.commercialRegNumber || activeCompany.crNumber}</strong>
                      </span>
                    )}
                    {activeCompany.taxNumber && (
                      <span className="bg-[#F1F5F9] px-2 py-0.5 rounded border border-[#E2E8F0] print:bg-white print:border-neutral-400 print:px-1">
                        الرقم الضريبي: <strong className="font-mono text-[#0F172A] print:text-black">{activeCompany.taxNumber}</strong>
                      </span>
                    )}
                    {activeCompany.phone && (
                      <span>
                        هاتف: <strong className="font-mono text-[#0F172A] print:text-black">{activeCompany.phone}</strong>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* الطرف الأيسر: بطاقة بيانات السند والكود */}
              <div className="flex flex-col justify-between bg-[#F8FAFC] p-4 rounded-xl border border-[#E2E8F0] shrink-0 min-w-[240px] text-right shadow-2xs print:p-2 print:min-w-[190px] print:bg-white print:border-black print:rounded-lg">
                <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2 mb-2 print:pb-1 print:mb-1 print:border-neutral-300">
                  <span className="text-[11px] font-serif font-black text-[#B8860B] uppercase tracking-wider flex items-center gap-1 print:text-black print:text-[10px]">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#B8860B] print:text-black" />
                    سند كشف حساب معتمد
                  </span>
                  <span className="text-[10px] font-mono text-[#64748B] bg-white px-1.5 py-0.5 rounded border border-[#E2E8F0] print:text-black print:border-black print:text-[8px]">
                    ORIGINAL
                  </span>
                </div>

                <div className="space-y-1.5 text-xs sm:text-sm print:space-y-0.5 print:text-[10px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[#64748B] font-medium print:text-neutral-700">كود الحساب:</span>
                    <span className="font-mono font-bold text-[#0F172A] bg-white px-2 py-0.5 rounded border border-[#E2E8F0] text-xs print:text-[10px] print:text-black print:border-neutral-400">
                      {statementResult.entityCode}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#64748B] font-medium print:text-neutral-700">تاريخ الطباعة:</span>
                    <span className="font-mono font-semibold text-[#334155] print:text-black">
                      {new Date().toISOString().split('T')[0]}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#64748B] font-medium print:text-neutral-700">العملة الأساسية:</span>
                    <span className="font-bold text-[#0F172A] print:text-black">{currency}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* عنوان المستند والفترة */}
            <div className="text-center space-y-2 py-2 print:py-1 print:space-y-0.5">
              <h2 className="text-xl md:text-2xl font-serif font-black text-[#0F172A] tracking-tight print:text-base print:text-black">
                كشف حساب {statementResult.entityType === 'CUSTOMER' ? 'العميل' : 'المورد'}:{' '}
                <span className="text-[#1E293B] border-b-2 border-[#D4AF37] pb-0.5 print:text-black print:border-black">
                  {statementResult.entityNameAr}
                </span>
              </h2>
              <p className="text-xs sm:text-sm font-semibold text-[#64748B] flex items-center justify-center gap-2 print:text-[10px] print:text-neutral-700">
                <span>عن الفترة المالية من:</span>
                <span className="font-mono font-bold text-[#0F172A] px-2 py-0.5 bg-[#F1F5F9] border border-[#CBD5E1] rounded print:bg-white print:border-black print:text-black print:px-1">
                  {statementResult.startDate}
                </span>
                <span>إلى:</span>
                <span className="font-mono font-bold text-[#0F172A] px-2 py-0.5 bg-[#F1F5F9] border border-[#CBD5E1] rounded print:bg-white print:border-black print:text-black print:px-1">
                  {statementResult.endDate}
                </span>
              </p>
            </div>

            {/* بطاقة تفاصيل الحساب والائتمان */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-[#F8FAFC] p-4.5 rounded-xl border border-[#E2E8F0] text-xs sm:text-sm print:p-2 print:my-1 print:grid-cols-3 print:gap-2 print:bg-white print:border-black print:rounded-lg print:text-[10px]">
              <div className="space-y-1 print:space-y-0">
                <span className="text-[#64748B] block font-medium print:text-neutral-700">اسم الجهة / الحساب التجاري:</span>
                <span className="font-bold text-[#0F172A] text-sm sm:text-base print:text-xs print:text-black">{statementResult.entityNameAr}</span>
              </div>
              <div className="space-y-1 sm:border-r sm:border-l sm:border-[#E2E8F0] sm:px-4 print:space-y-0 print:border-r print:border-l print:border-neutral-300 print:px-2">
                <span className="text-[#64748B] block font-medium print:text-neutral-700">الرقم الضريبي / السجل التجاري:</span>
                <span className="font-mono font-bold text-[#0F172A] text-sm print:text-xs print:text-black">{statementResult.entityTaxNo || 'غير مسجل'}</span>
              </div>
              <div className="space-y-1 print:space-y-0">
                <span className="text-[#64748B] block font-medium print:text-neutral-700">حد الائتمان / رقم التواصل:</span>
                <span className="font-bold text-[#0F172A] text-sm print:text-xs print:text-black">
                  {statementResult.entityCreditLimit
                    ? formatCurrency(statementResult.entityCreditLimit, currency)
                    : statementResult.entityPhone || '-'}
                </span>
              </div>
            </div>
          </div>

          {/* شريط البحث وتصفية الحركات (شاشة فقط) */}
          <div className="p-4 bg-[#F8FAFC] border-b border-[#E2E8F0] flex flex-col sm:flex-row items-center justify-between gap-3 no-print">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-[#64748B] absolute right-3 top-2.5" />
              <input
                type="text"
                placeholder="بحث برقم المستند، البيان، أو التاريخ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-[#CBD5E1] rounded-lg pr-9 pl-3 py-1.5 text-xs text-[#0F172A] focus:outline-none focus:border-[#0F172A]"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-[#64748B] font-semibold flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> تصفية الحركات:
              </span>
              <select
                value={movementFilter}
                onChange={(e) => setMovementFilter(e.target.value as any)}
                className="bg-white border border-[#CBD5E1] rounded-lg px-2.5 py-1.5 text-xs text-[#0F172A] font-semibold focus:outline-none cursor-pointer"
              >
                <option value="ALL">جميع الحركات (النشطة والملغاة)</option>
                <option value="ACTIVE_ONLY">الحركات النشطة المعتمدة فقط</option>
                <option value="CANCELLED_ONLY">الحركات الملغاة والعكسية فقط</option>
              </select>
            </div>
          </div>

          {/* جدول حركات الحساب بمعايير المحاسبة - تخطيط 100% صارم لمنع أي اقتطاع */}
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full text-right text-xs sm:text-sm border-collapse print:table-fixed print:w-full print:border print:border-black">
              <thead>
                <tr className="bg-[#F1F5F9] text-[#0F172A] border-b border-[#CBD5E1] font-serif font-bold text-xs sm:text-sm print:bg-neutral-100 print:text-black print:border-b-2 print:border-black print:text-[10px]">
                  <th className="py-3.5 px-3 border-r border-[#E2E8F0] text-center w-12 shrink-0 print:w-[4%] print:py-1.5 print:px-1 print:border print:border-black">#</th>
                  <th className="py-3.5 px-3 border-r border-[#E2E8F0] w-28 whitespace-nowrap print:w-[11%] print:py-1.5 print:px-1 print:border print:border-black print:whitespace-normal">التاريخ</th>
                  <th className="py-3.5 px-3 border-r border-[#E2E8F0] w-32 whitespace-nowrap print:w-[13%] print:py-1.5 print:px-1 print:border print:border-black print:whitespace-normal font-mono">رقم المستند</th>
                  <th className="py-3.5 px-3 border-r border-[#E2E8F0] w-36 whitespace-nowrap print:w-[12%] print:py-1.5 print:px-1 print:border print:border-black print:whitespace-normal">نوع الحركة</th>
                  <th className="py-3.5 px-4 border-r border-[#E2E8F0] min-w-[280px] print:min-w-0 print:w-[30%] print:py-1.5 print:px-1.5 print:border print:border-black">البيان والشرح المحاسبي</th>
                  <th className="py-3.5 px-3 border-r border-[#E2E8F0] text-left w-32 text-[#15803D] whitespace-nowrap print:w-[10%] print:py-1.5 print:px-1 print:border print:border-black print:text-black print:whitespace-normal font-mono">
                    مدين (+)
                  </th>
                  <th className="py-3.5 px-3 border-r border-[#E2E8F0] text-left w-32 text-[#B91C1C] whitespace-nowrap print:w-[10%] print:py-1.5 print:px-1 print:border print:border-black print:text-black print:whitespace-normal font-mono">
                    دائن (-)
                  </th>
                  <th className="py-3.5 px-3 border-r border-[#E2E8F0] text-left w-36 font-extrabold text-[#0F172A] whitespace-nowrap print:w-[10%] print:py-1.5 print:px-1 print:border print:border-black print:text-black print:whitespace-normal font-mono font-black">
                    الرصيد الجاري
                  </th>
                  <th className="py-3.5 px-2 text-center w-24 no-print whitespace-nowrap">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] print:divide-neutral-400">
                {/* سطر الرصيد الافتتاحي المنقول */}
                <tr className="bg-[#FBF9F4] font-bold text-[#0F172A] border-b border-[#E2E8F0] print:bg-white print:text-black print:border-black">
                  <td className="py-3.5 px-3 text-center border-r border-[#E2E8F0] text-[#B8860B] font-mono print:py-1.5 print:px-1 print:border print:border-black print:text-black print:text-[10px]">0</td>
                  <td className="py-3.5 px-3 border-r border-[#E2E8F0] font-mono text-[#64748B] whitespace-nowrap print:py-1.5 print:px-1 print:border print:border-black print:text-black print:text-[10px] print:whitespace-normal">
                    {statementResult.startDate}
                  </td>
                  <td className="py-3.5 px-3 border-r border-[#E2E8F0] font-mono text-[#64748B] whitespace-nowrap print:py-1.5 print:px-1 print:border print:border-black print:text-black print:text-[10px] print:whitespace-normal">
                    OPEN-BAL
                  </td>
                  <td className="py-3.5 px-3 border-r border-[#E2E8F0] whitespace-nowrap print:py-1.5 print:px-1 print:border print:border-black print:text-black print:text-[10px] print:whitespace-normal">
                    <span className="inline-flex items-center gap-1.5 text-[#B8860B] font-bold print:text-black">
                      <span className="text-[#B8860B] text-sm leading-none font-sans font-black print:hidden">▸</span>
                      <Clock className="w-3.5 h-3.5 print:hidden" />
                      <span>رصيد افتتاحي</span>
                    </span>
                  </td>
                  <td className="py-3.5 px-4 border-r border-[#E2E8F0] text-[#475569] font-medium print:py-1.5 print:px-1.5 print:border print:border-black print:text-black print:text-[10px]">
                    الرصيد الافتتاحي المنقول من قبل تاريخ {statementResult.startDate}
                  </td>
                  <td className="py-3.5 px-3 border-r border-[#E2E8F0] text-left font-mono font-bold text-[#15803D] whitespace-nowrap print:py-1.5 print:px-1 print:border print:border-black print:text-black print:text-[10px] print:whitespace-normal">
                    {statementResult.openingBalance > 0 && statementResult.openingBalanceType === 'DEBIT'
                      ? statementResult.openingBalance.toFixed(3)
                      : '-'}
                  </td>
                  <td className="py-3.5 px-3 border-r border-[#E2E8F0] text-left font-mono font-bold text-[#B91C1C] whitespace-nowrap print:py-1.5 print:px-1 print:border print:border-black print:text-black print:text-[10px] print:whitespace-normal">
                    {statementResult.openingBalance > 0 && statementResult.openingBalanceType === 'CREDIT'
                      ? statementResult.openingBalance.toFixed(3)
                      : '-'}
                  </td>
                  <td className="py-3.5 px-3 border-r border-[#E2E8F0] text-left font-mono text-sm sm:text-base font-black text-[#0F172A] whitespace-nowrap print:py-1.5 print:px-1 print:border print:border-black print:text-black print:text-[10px] print:whitespace-normal">
                    {formatCurrency(statementResult.openingBalance, currency)}
                  </td>
                  <td className="py-3.5 px-2 text-center no-print whitespace-nowrap">
                    <span className="px-2 py-0.5 bg-[#E2E8F0] text-[#475569] rounded text-[10px] font-bold">
                      افتتاحي
                    </span>
                  </td>
                </tr>

                {/* أسطر الحركات المالية للفترة الزمنية */}
                {filteredTransactions.length > 0 ? (
                  filteredTransactions.map((tx, idx) => {
                    const isCancelled = tx.status === 'CANCELLED';
                    const isReversal = tx.status === 'REVERSAL';

                    return (
                      <tr
                        key={tx.id}
                        className={`hover:bg-[#F8FAFC] transition-colors print:hover:bg-transparent ${
                          isCancelled
                            ? 'bg-rose-50/40 text-slate-400 line-through print:text-neutral-500'
                            : isReversal
                            ? 'bg-amber-50/40'
                            : ''
                        }`}
                      >
                        <td className="py-3 px-3 text-center border-r border-[#E2E8F0] font-mono text-[#64748B] print:py-1.5 print:px-1 print:border print:border-black print:text-black print:text-[10px]">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-3 border-r border-[#E2E8F0] font-mono text-[#1E293B] whitespace-nowrap print:py-1.5 print:px-1 print:border print:border-black print:text-black print:text-[10px] print:whitespace-normal">
                          {tx.date}
                        </td>
                        <td className="py-3 px-3 border-r border-[#E2E8F0] font-mono font-bold text-[#0F172A] whitespace-nowrap print:py-1.5 print:px-1 print:border print:border-black print:text-black print:text-[10px] print:whitespace-normal">
                          {tx.docNumber}
                        </td>
                        <td className="py-3 px-3 border-r border-[#E2E8F0] font-bold text-[#1E293B] whitespace-nowrap print:py-1.5 print:px-1 print:border print:border-black print:text-black print:text-[10px] print:whitespace-normal">
                          {tx.docTypeLabel}
                        </td>
                        <td className="py-3 px-4 border-r border-[#E2E8F0] text-[#334155] leading-relaxed print:py-1.5 print:px-1.5 print:border print:border-black print:text-black print:text-[10px] print:leading-tight">
                          {tx.description}
                        </td>
                        <td className="py-3 px-3 border-r border-[#E2E8F0] text-left font-mono font-bold text-[#15803D] whitespace-nowrap print:py-1.5 print:px-1 print:border print:border-black print:text-black print:text-[10px] print:whitespace-normal">
                          {tx.debit > 0 ? tx.debit.toFixed(3) : '-'}
                        </td>
                        <td className="py-3 px-3 border-r border-[#E2E8F0] text-left font-mono font-bold text-[#B91C1C] whitespace-nowrap print:py-1.5 print:px-1 print:border print:border-black print:text-black print:text-[10px] print:whitespace-normal">
                          {tx.credit > 0 ? tx.credit.toFixed(3) : '-'}
                        </td>
                        <td className="py-3 px-3 border-r border-[#E2E8F0] text-left font-mono font-black text-[#0F172A] text-xs sm:text-sm whitespace-nowrap print:py-1.5 print:px-1 print:border print:border-black print:text-black print:text-[10px] print:whitespace-normal">
                          {formatCurrency(tx.runningBalance, currency)}
                        </td>
                        <td className="py-3 px-2 text-center no-print whitespace-nowrap">
                          {isCancelled ? (
                            <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded text-[10px] font-extrabold">
                              ملغي
                            </span>
                          ) : isReversal ? (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded text-[10px] font-extrabold">
                              عكسي
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-extrabold">
                              معتمد
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={9} className="p-4 sm:p-6 bg-[#FAFAFA] print:p-2 print:bg-white print:border print:border-black">
                      <div className="max-w-xl mx-auto my-2 bg-amber-50/50 border border-amber-200/70 rounded-xl p-5 text-center shadow-2xs space-y-2.5 print:p-2 print:my-0 print:border-none print:shadow-none">
                        <div className="w-10 h-10 rounded-full bg-amber-100/80 border border-amber-300/60 flex items-center justify-center mx-auto text-amber-700 print:hidden">
                          <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                          <p className="font-bold text-sm text-[#0F172A] print:text-xs">
                            لا توجد أي حركات مالية مسجلة خلال الفترة المحددة ({statementResult.startDate} إلى{' '}
                            {statementResult.endDate})
                          </p>
                          <p className="text-xs text-[#64748B] leading-normal print:text-[10px] print:text-black">
                            الرصيد الافتتاحي هو نفس الرصيد الختامي تماماً بمبلغ وقدره (
                            <span className="font-mono font-bold text-[#0F172A] print:text-black">
                              {formatCurrency(statementResult.closingBalance, currency)}
                            </span>
                            )
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}

                {/* صف إجمالي حركة الفترة والرصيد الختامي المرحل */}
                <tr className="bg-[#1E293B] text-white font-serif font-black text-xs sm:text-sm border-t-2 border-[#0F172A] print:bg-neutral-100 print:text-black print:border-t-2 print:border-b-2 print:border-black print:text-[10px]">
                  <td
                    colSpan={5}
                    className="py-4 px-4 border-r border-slate-700 text-left font-bold text-slate-100 tracking-wide print:py-2 print:px-1.5 print:border print:border-black print:text-black"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-amber-300 font-mono font-normal print:text-neutral-700">
                        CLOSING BALANCE & TOTALS
                      </span>
                      <span className="text-right font-bold">إجمالي حركات الفترة والرصيد الختامي المرحل:</span>
                    </div>
                  </td>

                  {/* مجموع المدين تحت عمود مدين */}
                  <td className="py-4 px-3 border-r border-slate-700 text-left font-mono text-sm font-bold text-emerald-400 whitespace-nowrap bg-slate-800/40 print:py-2 print:px-1 print:border print:border-black print:text-black print:bg-transparent print:text-[10px] print:whitespace-normal">
                    {statementResult.totalPeriodDebit.toFixed(3)}
                  </td>

                  {/* مجموع الدائن تحت عمود دائن */}
                  <td className="py-4 px-3 border-r border-slate-700 text-left font-mono text-sm font-bold text-rose-400 whitespace-nowrap bg-slate-800/40 print:py-2 print:px-1 print:border print:border-black print:text-black print:bg-transparent print:text-[10px] print:whitespace-normal">
                    {statementResult.totalPeriodCredit.toFixed(3)}
                  </td>

                  {/* الرصيد الختامي تحت عمود الرصيد الجاري */}
                  <td className="py-4 px-3 border-r border-slate-700 text-left font-mono text-sm sm:text-base font-black text-amber-300 whitespace-nowrap bg-slate-900/60 print:py-2 print:px-1 print:border print:border-black print:text-black print:bg-transparent print:text-[10px] print:whitespace-normal">
                    {formatCurrency(statementResult.closingBalance, currency)}
                  </td>

                  <td className="py-4 px-2 text-center no-print whitespace-nowrap">
                    <span className="px-2 py-0.5 bg-amber-400 text-slate-950 rounded text-[10px] font-black uppercase">
                      ختامي
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* منطقة التوقيعات السفلية والإقرار المالي */}
          <div className="p-6 md:p-10 bg-[#FDFCFB] border-t border-[#E2E8F0] space-y-8 pb-12 print:p-2.5 print:space-y-2 print:pb-2 print:bg-white print:border-t-2 print:border-black print-avoid-break">
            {/* نص إقرار وصحة الرصيد المحاسبي */}
            <div className="text-xs sm:text-sm text-[#475569] leading-relaxed bg-[#F8FAFC] p-4 rounded-xl border border-[#E2E8F0] print:p-2 print:text-[9.5px] print:leading-snug print:bg-white print:border print:border-neutral-400 print:rounded-lg">
              <div className="flex items-start gap-2 print:gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0 mt-0.5 print:w-3.5 print:h-3.5 print:text-black" />
                <div>
                  <strong className="text-[#0F172A] font-bold print:text-black">إقرار وصحة الرصيد المالي:</strong> يُعتبر هذا الكشف صحيحاً
                  ومطابقاً للدفاتر والقيود المحاسبية لـ <span className="font-bold text-black">{activeCompany.nameAr || activeCompany.headerTitle || 'المنشأة'}</span>. يُرجى مراجعة الحركات المالية الموضحة أعلاه
                  وموافاتنا بأي ملاحظات خطية خلال 15 يوماً من تاريخ الإصدار، وتُعتبر الأرصدة مصادقاً عليها ونهائية بعد
                  انقضاء المدة المقررة.
                </div>
              </div>
            </div>

            {/* خانات التوقيعات الثلاثة */}
            <div className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-8 md:gap-12 text-center text-xs sm:text-sm print:pt-1.5 print:grid-cols-3 print:gap-3 print:text-[10px]">
              <div className="space-y-3 p-4 bg-white rounded-xl border border-[#E2E8F0] shadow-2xs print:space-y-1 print:p-2 print:border print:border-black print:shadow-none print:rounded-lg">
                <span className="text-[#0F172A] font-bold block print:text-black">إعداد المحاسب المسؤول</span>
                <span className="text-[#64748B] text-xs block print:text-[9px] print:text-neutral-700">التوقيع والتاريخ:</span>
                <div className="w-full pt-6 print:pt-3">
                  <div className="w-4/5 h-[1.5px] bg-[#94A3B8] mx-auto border-dashed border-t border-[#64748B] print:border-black"></div>
                  <span className="text-[10px] text-[#94A3B8] font-mono block pt-1 print:text-[8px] print:text-neutral-600">Signature & Date</span>
                </div>
              </div>

              <div className="space-y-3 p-4 bg-white rounded-xl border border-[#E2E8F0] shadow-2xs print:space-y-1 print:p-2 print:border print:border-black print:shadow-none print:rounded-lg">
                <span className="text-[#0F172A] font-bold block print:text-black">مراجعة وتدقيق الحسابات</span>
                <span className="text-[#64748B] text-xs block print:text-[9px] print:text-neutral-700">التوقيع والتاريخ:</span>
                <div className="w-full pt-6 print:pt-3">
                  <div className="w-4/5 h-[1.5px] bg-[#94A3B8] mx-auto border-dashed border-t border-[#64748B] print:border-black"></div>
                  <span className="text-[10px] text-[#94A3B8] font-mono block pt-1 print:text-[8px] print:text-neutral-600">Auditor Review</span>
                </div>
              </div>

              <div className="space-y-3 p-4 bg-white rounded-xl border border-[#E2E8F0] shadow-2xs print:space-y-1 print:p-2 print:border print:border-black print:shadow-none print:rounded-lg">
                <span className="text-[#0F172A] font-bold block print:text-black truncate" title={activeCompany.nameAr || activeCompany.headerTitle}>
                  {activeCompany.nameAr || activeCompany.headerTitle || 'اعتماد المنشأة / الختم'}
                </span>
                <span className="text-[#64748B] text-xs block print:text-[9px] print:text-neutral-700">
                  {activeCompany.generalManager ? `اعتماد الإدارة: ${activeCompany.generalManager}` : 'الختم الرسمي والتوقيع:'}
                </span>
                <div className="w-full pt-6 print:pt-3">
                  <div className="w-4/5 h-[1.5px] bg-[#94A3B8] mx-auto border-dashed border-t border-[#64748B] print:border-black"></div>
                  <span className="text-[10px] text-[#94A3B8] font-mono block pt-1 print:text-[8px] print:text-neutral-600 uppercase truncate">
                    {activeCompany.nameEn || 'Authorized Signature & Stamp'}
                  </span>
                </div>
              </div>
            </div>

            <div className="text-center pt-2 border-t border-[#E2E8F0] print:pt-1 print:border-neutral-300">
              <span className="text-[10px] text-[#94A3B8] font-mono print:text-[8px] print:text-neutral-600">
                {activeCompany.footerNotes || `Generated by ${activeCompany.nameEn || activeCompany.nameAr || 'Enterprise'} ERP System • Compliant with IFRS & Commercial Law • Page 1 of 1`}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-12 text-center text-[#64748B] space-y-3 shadow-sm">
          <FileText className="w-12 h-12 text-[#B8860B] mx-auto opacity-50" />
          <p className="text-base font-bold text-[#0F172A]">يرجى اختيار عميل أو مورد لعرض كشف الحساب المالي</p>
          <p className="text-xs">سيتم احتساب الرصيد الافتتاحي وحركات الفترة والرصيد الختامي بدقة متناهية</p>
        </div>
      )}
    </div>
  );
};
