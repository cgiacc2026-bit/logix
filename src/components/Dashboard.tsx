import React, { useState, useMemo } from 'react';
import {
  FinancialKPIs,
  JournalEntry,
  Invoice,
  PaymentVoucher,
  Account,
  InventoryItem,
  CompanyProfile
} from '../types.js';
import { formatCurrency } from '../utils/formatters.ts';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Wallet,
  Building,
  AlertCircle,
  PlusCircle,
  FileCheck2,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  PieChart,
  Scale,
  Eye,
  Calendar,
  Filter,
  ChevronDown,
  ChevronUp,
  Info,
  X,
  Layers,
  ShieldCheck,
  Package,
  AlertTriangle,
  Truck,
  ShoppingCart,
  ArrowRight,
  Factory,
  FolderTree,
  FileText,
  BookOpen,
  Users2,
  Building2,
  Ruler,
  Sparkles,
  SlidersHorizontal,
  MoveUp,
  MoveDown,
  LayoutGrid
} from 'lucide-react';
import {
  KpiCustomizerModal,
  KpiUserSettings,
  DEFAULT_KPI_SETTINGS,
  ALL_AVAILABLE_KPIS
} from './KpiCustomizerModal.js';
import { safeJsonParse } from '../utils/safeJson.js';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

interface DashboardProps {
  kpis: FinancialKPIs | null;
  currency: string;
  recentJournals: JournalEntry[];
  unpaidInvoices: Invoice[];
  allInvoices?: Invoice[];
  vouchers?: PaymentVoucher[];
  accounts?: Account[];
  inventory?: InventoryItem[];
  company?: CompanyProfile | null;
  onNavigateTab: (tab: any) => void;
  onNewJournal: () => void;
  onNewInvoice: () => void;
}

const CustomTooltip = ({ active, payload, label, currency }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#0B192C] text-white p-3 rounded-lg shadow-xl border border-blue-900 text-xs space-y-1 text-right" dir="rtl">
        <p className="font-bold border-b border-slate-700 pb-1 text-cyan-300 mb-1.5">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={`item-${index}`} className="flex items-center justify-between gap-4 py-0.5">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: entry.color }} />
              <span>{entry.name}:</span>
            </span>
            <span className="font-mono font-bold">{formatCurrency(entry.value, currency)}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export const Dashboard: React.FC<DashboardProps> = ({
  kpis,
  currency,
  recentJournals,
  unpaidInvoices,
  allInvoices = [],
  vouchers = [],
  accounts = [],
  inventory = [],
  company = null,
  onNavigateTab,
  onNewJournal,
  onNewInvoice,
}) => {
  const [chartMode, setChartMode] = useState<'all' | 'cash' | 'dues'>('all');
  const [stockAlertFilter, setStockAlertFilter] = useState<'ALL' | 'OUT_OF_STOCK' | 'CRITICAL'>('ALL');
  const [showKpiModal, setShowKpiModal] = useState<boolean>(false);

  // --- Persistent KPI Cards Customization State ---
  const [kpiSettings, setKpiSettings] = useState<KpiUserSettings>(() => {
    return safeJsonParse<KpiUserSettings>(
      localStorage.getItem('alwaleed_dashboard_kpis_config'),
      DEFAULT_KPI_SETTINGS
    );
  });

  const handleSaveKpiSettings = (newSettings: KpiUserSettings) => {
    setKpiSettings(newSettings);
    try {
      localStorage.setItem('alwaleed_dashboard_kpis_config', JSON.stringify(newSettings));
    } catch (e) {
      console.error('Failed to save KPI settings', e);
    }
  };

  // Quick reorder helpers
  const handleQuickMoveCard = (cardId: string, direction: 'UP' | 'DOWN') => {
    const currentOrder = [...(kpiSettings.cardOrder || DEFAULT_KPI_SETTINGS.cardOrder)];
    const index = currentOrder.indexOf(cardId);
    if (index === -1) return;
    if (direction === 'UP' && index > 0) {
      const temp = currentOrder[index - 1];
      currentOrder[index - 1] = currentOrder[index];
      currentOrder[index] = temp;
      handleSaveKpiSettings({ ...kpiSettings, cardOrder: currentOrder });
    } else if (direction === 'DOWN' && index < currentOrder.length - 1) {
      const temp = currentOrder[index + 1];
      currentOrder[index + 1] = currentOrder[index];
      currentOrder[index] = temp;
      handleSaveKpiSettings({ ...kpiSettings, cardOrder: currentOrder });
    }
  };

  // --- Low Stock & Reorder Level Analytics ---
  const lowStockItems = useMemo(() => {
    if (!inventory || inventory.length === 0) return [];
    return inventory.filter(item => {
      const alertLimit = item.minQuantityAlert !== undefined ? item.minQuantityAlert : 5;
      return item.quantityOnHand <= alertLimit;
    });
  }, [inventory]);

  const filteredLowStockItems = useMemo(() => {
    if (stockAlertFilter === 'OUT_OF_STOCK') {
      return lowStockItems.filter(i => i.quantityOnHand <= 0);
    }
    if (stockAlertFilter === 'CRITICAL') {
      return lowStockItems.filter(i => i.quantityOnHand > 0 && i.quantityOnHand <= (i.minQuantityAlert || 5) / 2);
    }
    return lowStockItems;
  }, [lowStockItems, stockAlertFilter]);

  const outOfStockCount = useMemo(() => {
    return lowStockItems.filter(i => i.quantityOnHand <= 0).length;
  }, [lowStockItems]);

  const totalEstimatedReorderCost = useMemo(() => {
    return lowStockItems.reduce((acc, item) => {
      const targetQty = Math.max(1, (item.minQuantityAlert || 5) * 2 - Math.max(0, item.quantityOnHand));
      return acc + (targetQty * (item.purchasePrice || 0));
    }, 0);
  }, [lowStockItems]);

  // --- Assets & Liabilities Comparison with Previous Month ---
  const availableMonths = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return [
      { code: `${currentYear}-08`, label: 'أغسطس 2026', prevCode: `${currentYear}-07`, prevLabel: 'يوليو 2026' },
      { code: `${currentYear}-07`, label: 'يوليو 2026', prevCode: `${currentYear}-06`, prevLabel: 'يونيو 2026' },
      { code: `${currentYear}-06`, label: 'يونيو 2026', prevCode: `${currentYear}-05`, prevLabel: 'مايو 2026' },
      { code: `${currentYear}-05`, label: 'مايو 2026', prevCode: `${currentYear}-04`, prevLabel: 'أبريل 2026' },
    ];
  }, []);

  const [selectedMonthCode, setSelectedMonthCode] = useState<string>('2026-08');
  const [expandedAssetDetails, setExpandedAssetDetails] = useState<boolean>(false);
  const [expandedLiabilityDetails, setExpandedLiabilityDetails] = useState<boolean>(false);
  const [viewingJournalModalCategory, setViewingJournalModalCategory] = useState<'ASSET' | 'LIABILITY' | null>(null);
  const [journalModalSearch, setJournalModalSearch] = useState<string>('');

  const selectedMonthObj = useMemo(() => {
    return availableMonths.find(m => m.code === selectedMonthCode) || availableMonths[0];
  }, [availableMonths, selectedMonthCode]);

  const assetAccounts = useMemo(() => {
    if (!accounts || accounts.length === 0) return [];
    return accounts.filter(a => a.category === 'ASSET' || (a as any).type === 'ASSET' || a.code.startsWith('1'));
  }, [accounts]);

  const liabilityAccounts = useMemo(() => {
    if (!accounts || accounts.length === 0) return [];
    return accounts.filter(a => a.category === 'LIABILITY' || (a as any).type === 'LIABILITY' || a.code.startsWith('2'));
  }, [accounts]);

  const totalAssetsNow = useMemo(() => {
    if (assetAccounts.length > 0) {
      return assetAccounts.reduce((sum, a) => sum + (a.balance || 0), 0);
    }
    return kpis?.totalAssets || 62050;
  }, [assetAccounts, kpis]);

  const totalLiabilitiesNow = useMemo(() => {
    if (liabilityAccounts.length > 0) {
      return liabilityAccounts.reduce((sum, a) => sum + (a.balance || 0), 0);
    }
    return kpis?.totalLiabilities || 3400;
  }, [liabilityAccounts, kpis]);

  const postedJournals = useMemo(() => {
    return recentJournals.filter(j => j.status === 'POSTED');
  }, [recentJournals]);

  const comparisonData = useMemo(() => {
    const selCode = selectedMonthObj.code;
    const prevCode = selectedMonthObj.prevCode;

    let selAssetDebits = 0;
    let selAssetCredits = 0;
    let selLiabilityDebits = 0;
    let selLiabilityCredits = 0;

    let prevAssetDebits = 0;
    let prevAssetCredits = 0;
    let prevLiabilityDebits = 0;
    let prevLiabilityCredits = 0;

    let postAssetDebits = 0;
    let postAssetCredits = 0;
    let postLiabilityDebits = 0;
    let postLiabilityCredits = 0;

    const selMonthAssetJournals: { journal: JournalEntry; line: any }[] = [];
    const selMonthLiabilityJournals: { journal: JournalEntry; line: any }[] = [];

    postedJournals.forEach(j => {
      const entryMonth = j.date ? j.date.substring(0, 7) : '';
      j.lines.forEach(l => {
        const isAsset = assetAccounts.some(a => a.id === l.accountId || a.code === l.accountCode) || l.accountCode?.startsWith('1');
        const isLiability = liabilityAccounts.some(a => a.id === l.accountId || a.code === l.accountCode) || l.accountCode?.startsWith('2');

        const debit = Number(l.debit) || 0;
        const credit = Number(l.credit) || 0;

        if (entryMonth === selCode) {
          if (isAsset) {
            selAssetDebits += debit;
            selAssetCredits += credit;
            selMonthAssetJournals.push({ journal: j, line: l });
          }
          if (isLiability) {
            selLiabilityDebits += debit;
            selLiabilityCredits += credit;
            selMonthLiabilityJournals.push({ journal: j, line: l });
          }
        } else if (entryMonth === prevCode) {
          if (isAsset) {
            prevAssetDebits += debit;
            prevAssetCredits += credit;
          }
          if (isLiability) {
            prevLiabilityDebits += debit;
            prevLiabilityCredits += credit;
          }
        }

        if (entryMonth > selCode) {
          if (isAsset) {
            postAssetDebits += debit;
            postAssetCredits += credit;
          }
          if (isLiability) {
            postLiabilityDebits += debit;
            postLiabilityCredits += credit;
          }
        }
      });
    });

    const selAssetNet = selAssetDebits - selAssetCredits;
    const selLiabilityNet = selLiabilityCredits - selLiabilityDebits;

    const postAssetNet = postAssetDebits - postAssetCredits;
    const postLiabilityNet = postLiabilityCredits - postLiabilityDebits;

    const currentSelectedMonthAssets = totalAssetsNow - postAssetNet;
    const previousMonthAssets = currentSelectedMonthAssets - selAssetNet;

    const currentSelectedMonthLiabilities = totalLiabilitiesNow - postLiabilityNet;
    const previousMonthLiabilities = currentSelectedMonthLiabilities - selLiabilityNet;

    const assetDiff = currentSelectedMonthAssets - previousMonthAssets;
    const assetPct = previousMonthAssets > 0 ? (assetDiff / previousMonthAssets) * 100 : 0;

    const liabilityDiff = currentSelectedMonthLiabilities - previousMonthLiabilities;
    const liabilityPct = previousMonthLiabilities > 0 ? (liabilityDiff / previousMonthLiabilities) * 100 : 0;

    const currentNetAssets = currentSelectedMonthAssets - currentSelectedMonthLiabilities;
    const prevNetAssets = previousMonthAssets - previousMonthLiabilities;
    const netAssetsDiff = currentNetAssets - prevNetAssets;
    const netAssetsPct = prevNetAssets > 0 ? (netAssetsDiff / prevNetAssets) * 100 : 0;

    const currentSolvency = currentSelectedMonthLiabilities > 0 ? (currentSelectedMonthAssets / currentSelectedMonthLiabilities) : 100;
    const prevSolvency = previousMonthLiabilities > 0 ? (previousMonthAssets / previousMonthLiabilities) : 100;

    return {
      currentSelectedMonthAssets,
      previousMonthAssets,
      assetDiff,
      assetPct,
      currentSelectedMonthLiabilities,
      previousMonthLiabilities,
      liabilityDiff,
      liabilityPct,
      currentNetAssets,
      prevNetAssets,
      netAssetsDiff,
      netAssetsPct,
      currentSolvency,
      prevSolvency,
      selMonthAssetJournals,
      selMonthLiabilityJournals,
      selAssetDebits,
      selAssetCredits,
      selLiabilityDebits,
      selLiabilityCredits
    };
  }, [selectedMonthObj, postedJournals, assetAccounts, liabilityAccounts, totalAssetsNow, totalLiabilitiesNow]);

  // Generate 12-Month Chart Data
  const monthlyChartData = useMemo(() => {
    const months = [
      { name: 'يناير', code: '01' },
      { name: 'فبراير', code: '02' },
      { name: 'مارس', code: '03' },
      { name: 'أبريل', code: '04' },
      { name: 'مايو', code: '05' },
      { name: 'يونيو', code: '06' },
      { name: 'يوليو', code: '07' },
      { name: 'أغسطس', code: '08' },
      { name: 'سبتمبر', code: '09' },
      { name: 'أكتوبر', code: '10' },
      { name: 'نوفمبر', code: '11' },
      { name: 'ديسمبر', code: '12' }
    ];

    const currentYear = new Date().getFullYear();

    return months.map((m) => {
      // Find vouchers for this month
      const monthVouchers = vouchers.filter(v => {
        if (!v.date) return false;
        return v.date.startsWith(`${currentYear}-${m.code}`);
      });

      let cashInflow = monthVouchers
        .filter(v => v.type === 'RECEIPT')
        .reduce((sum, v) => sum + (Number(v.amount) || 0), 0);

      let cashOutflow = monthVouchers
        .filter(v => v.type === 'PAYMENT')
        .reduce((sum, v) => sum + (Number(v.amount) || 0), 0);

      // Invoices in this month
      const monthInvoices = allInvoices.filter(inv => {
        const invDate = inv.date;
        if (!invDate) return false;
        return invDate.startsWith(`${currentYear}-${m.code}`);
      });

      let receivables = monthInvoices
        .filter(inv => inv.type === 'SALES')
        .reduce((sum, inv) => sum + (Number(inv.grandTotal) || 0), 0);

      let payables = monthInvoices
        .filter(inv => inv.type === 'PURCHASE')
        .reduce((sum, inv) => sum + (Number(inv.grandTotal) || 0), 0);

      const netCash = cashInflow - cashOutflow;

      return {
        monthName: m.name,
        cashInflow: Math.round(cashInflow * 1000) / 1000,
        cashOutflow: Math.round(cashOutflow * 1000) / 1000,
        netCash: Math.round(netCash * 1000) / 1000,
        receivables: Math.round(receivables * 1000) / 1000,
        payables: Math.round(payables * 1000) / 1000
      };
    });
  }, [allInvoices, vouchers]);

  const totalYearlyInflow = monthlyChartData.reduce((acc, curr) => acc + curr.cashInflow, 0);
  const totalYearlyOutflow = monthlyChartData.reduce((acc, curr) => acc + curr.cashOutflow, 0);
  const liquidityRatio = totalYearlyOutflow > 0 ? (totalYearlyInflow / totalYearlyOutflow) * 100 : 100;

  if (!kpis) {
    return (
      <div className="p-8 text-center text-[#8C8273] font-serif">
        جاري تحميل المؤشرات المالية...
      </div>
    );
  }

  const isProfitPositive = kpis.netProfit >= 0;

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 p-6 rounded-xl shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            لوحة التخطيط المالي والمحاسبي الموحدة
          </h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            إدارة العمليات المحاسبية والمخزون والمبيعات والتحصيل بدقة متكاملة.
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setShowKpiModal(true)}
            className="px-3.5 py-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-black flex items-center gap-2 border border-amber-300 shadow-2xs transition-all active:scale-95 cursor-pointer"
            title="اختيار وترتيب بطاقات المؤشرات المعروضة"
          >
            <SlidersHorizontal className="w-4 h-4 text-amber-700" />
            <span>تخصيص بطاقات KPI</span>
          </button>
          <button
            onClick={onNewJournal}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-2 border border-blue-500 shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 text-cyan-200" />
            <span>قيد يومية جديد</span>
          </button>
          <button
            onClick={onNewInvoice}
            className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-2 border border-slate-800 shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 text-blue-400" />
            <span>فاتورة مبيعات جديدة</span>
          </button>
        </div>
      </div>

      {/* CATEGORIZED TASK GROUPS HUB (مجموعات مهام وعمليات النظام) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Group 1: Operations & Milling */}
        <div className="bg-white border border-amber-200/80 rounded-2xl p-4 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-amber-100">
            <div className="flex items-center gap-2 text-amber-900 font-black text-xs">
              <div className="p-1.5 bg-amber-100 text-amber-800 rounded-lg">
                <Factory className="w-4 h-4" />
              </div>
              <span>العمليات والإنتاج والمبيعات</span>
            </div>
            <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-bold">
              ٥ مهام
            </span>
          </div>
          <div className="grid grid-cols-1 gap-1.5 text-xs">
            <button
              onClick={() => onNavigateTab('invoices')}
              className="px-2.5 py-1.5 bg-slate-50 hover:bg-amber-600 hover:text-white rounded-xl text-slate-700 font-bold text-right flex items-center justify-between transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-3.5 h-3.5 text-amber-600" />
                <span>فواتير المبيعات والمشتريات</span>
              </div>
              <ArrowRight className="w-3 h-3 opacity-60 rotate-180" />
            </button>

            <button
              onClick={() => onNavigateTab('inventory')}
              className="px-2.5 py-1.5 bg-slate-50 hover:bg-amber-600 hover:text-white rounded-xl text-slate-700 font-bold text-right flex items-center justify-between transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Package className="w-3.5 h-3.5 text-amber-600" />
                <span>المخزون والخامات والتسعير</span>
              </div>
              <ArrowRight className="w-3 h-3 opacity-60 rotate-180" />
            </button>

            <button
              onClick={() => onNavigateTab('production')}
              className="px-2.5 py-1.5 bg-amber-50/80 hover:bg-amber-600 hover:text-white rounded-xl text-amber-900 font-black text-right flex items-center justify-between transition-all cursor-pointer border border-amber-200/60"
            >
              <div className="flex items-center gap-2">
                <Factory className="w-3.5 h-3.5 text-amber-700" />
                <span>أوامر طحن وتشغيل المطحنة</span>
              </div>
              <ArrowRight className="w-3 h-3 opacity-60 rotate-180" />
            </button>

            <button
              onClick={() => onNavigateTab('vouchers')}
              className="px-2.5 py-1.5 bg-slate-50 hover:bg-amber-600 hover:text-white rounded-xl text-slate-700 font-bold text-right flex items-center justify-between transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <DollarSign className="w-3.5 h-3.5 text-amber-600" />
                <span>سندات القبض والصرف والخزينة</span>
              </div>
              <ArrowRight className="w-3 h-3 opacity-60 rotate-180" />
            </button>
          </div>
        </div>

        {/* Group 2: Accounting & Journals */}
        <div className="bg-white border border-blue-200/80 rounded-2xl p-4 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-blue-100">
            <div className="flex items-center gap-2 text-blue-900 font-black text-xs">
              <div className="p-1.5 bg-blue-100 text-blue-800 rounded-lg">
                <FileText className="w-4 h-4" />
              </div>
              <span>المحاسبة والقيود والترحيل</span>
            </div>
            <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-bold">
              ٤ مهام
            </span>
          </div>
          <div className="grid grid-cols-1 gap-1.5 text-xs">
            <button
              onClick={() => onNavigateTab('accounts')}
              className="px-2.5 py-1.5 bg-slate-50 hover:bg-blue-600 hover:text-white rounded-xl text-slate-700 font-bold text-right flex items-center justify-between transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <FolderTree className="w-3.5 h-3.5 text-blue-600" />
                <span>دليل وشجرة الحسابات العامة</span>
              </div>
              <ArrowRight className="w-3 h-3 opacity-60 rotate-180" />
            </button>

            <button
              onClick={() => onNavigateTab('journals')}
              className="px-2.5 py-1.5 bg-slate-50 hover:bg-blue-600 hover:text-white rounded-xl text-slate-700 font-bold text-right flex items-center justify-between transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                <span>سجل القيود اليومية المزدوجة</span>
              </div>
              <ArrowRight className="w-3 h-3 opacity-60 rotate-180" />
            </button>

            <button
              onClick={() => onNavigateTab('ledger')}
              className="px-2.5 py-1.5 bg-slate-50 hover:bg-blue-600 hover:text-white rounded-xl text-slate-700 font-bold text-right flex items-center justify-between transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                <span>دفتر الأستاذ العام للحسابات</span>
              </div>
              <ArrowRight className="w-3 h-3 opacity-60 rotate-180" />
            </button>

            <button
              onClick={() => onNavigateTab('trial-balance')}
              className="px-2.5 py-1.5 bg-slate-50 hover:bg-blue-600 hover:text-white rounded-xl text-slate-700 font-bold text-right flex items-center justify-between transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Scale className="w-3.5 h-3.5 text-blue-600" />
                <span>ميزان المراجعة بالمجاميع والأرصدة</span>
              </div>
              <ArrowRight className="w-3 h-3 opacity-60 rotate-180" />
            </button>
          </div>
        </div>

        {/* Group 3: Financial Statements & Reports */}
        <div className="bg-white border border-emerald-200/80 rounded-2xl p-4 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-emerald-100">
            <div className="flex items-center gap-2 text-emerald-900 font-black text-xs">
              <div className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg">
                <BarChart3 className="w-4 h-4" />
              </div>
              <span>القوائم المالية والختامية</span>
            </div>
            <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold">
              ختامية
            </span>
          </div>
          <div className="grid grid-cols-1 gap-1.5 text-xs">
            <button
              onClick={() => onNavigateTab('financials')}
              className="px-2.5 py-1.5 bg-emerald-50/80 hover:bg-emerald-600 hover:text-white rounded-xl text-emerald-950 font-bold text-right flex items-center justify-between transition-all cursor-pointer border border-emerald-200/60"
            >
              <div className="flex items-center gap-2">
                <BarChart3 className="w-3.5 h-3.5 text-emerald-600" />
                <span>قائمة الدخل (الأرباح والخسائر)</span>
              </div>
              <ArrowRight className="w-3 h-3 opacity-60 rotate-180" />
            </button>

            <button
              onClick={() => onNavigateTab('financials')}
              className="px-2.5 py-1.5 bg-slate-50 hover:bg-emerald-600 hover:text-white rounded-xl text-slate-700 font-bold text-right flex items-center justify-between transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <PieChart className="w-3.5 h-3.5 text-emerald-600" />
                <span>الميزانية العمومية والمركز المالي</span>
              </div>
              <ArrowRight className="w-3 h-3 opacity-60 rotate-180" />
            </button>

            <button
              onClick={() => onNavigateTab('financials')}
              className="px-2.5 py-1.5 bg-slate-50 hover:bg-emerald-600 hover:text-white rounded-xl text-slate-700 font-bold text-right flex items-center justify-between transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                <span>قائمة التدفقات النقدية</span>
              </div>
              <ArrowRight className="w-3 h-3 opacity-60 rotate-180" />
            </button>

            <button
              onClick={() => onNavigateTab('dashboard')}
              className="px-2.5 py-1.5 bg-slate-50 hover:bg-emerald-600 hover:text-white rounded-xl text-slate-700 font-bold text-right flex items-center justify-between transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>تحليل الأداء والمؤشرات KPIs</span>
              </div>
              <ArrowRight className="w-3 h-3 opacity-60 rotate-180" />
            </button>
          </div>
        </div>

        {/* Group 4: Master Entities & System Setup */}
        <div className="bg-white border border-purple-200/80 rounded-2xl p-4 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-purple-100">
            <div className="flex items-center gap-2 text-purple-900 font-black text-xs">
              <div className="p-1.5 bg-purple-100 text-purple-800 rounded-lg">
                <Building2 className="w-4 h-4" />
              </div>
              <span>البيانات الأساسية والتهيئة</span>
            </div>
            <span className="text-[10px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-bold">
              ٤ مهام
            </span>
          </div>
          <div className="grid grid-cols-1 gap-1.5 text-xs">
            <button
              onClick={() => onNavigateTab('entities')}
              className="px-2.5 py-1.5 bg-slate-50 hover:bg-purple-600 hover:text-white rounded-xl text-slate-700 font-bold text-right flex items-center justify-between transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Users2 className="w-3.5 h-3.5 text-purple-600" />
                <span>العملاء والجمعيات والموردين</span>
              </div>
              <ArrowRight className="w-3 h-3 opacity-60 rotate-180" />
            </button>

            <button
              onClick={() => onNavigateTab('units')}
              className="px-2.5 py-1.5 bg-slate-50 hover:bg-purple-600 hover:text-white rounded-xl text-slate-700 font-bold text-right flex items-center justify-between transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Ruler className="w-3.5 h-3.5 text-purple-600" />
                <span>وحدات الوزن والقياس والتعبئة</span>
              </div>
              <ArrowRight className="w-3 h-3 opacity-60 rotate-180" />
            </button>

            <button
              onClick={() => onNavigateTab('company')}
              className="px-2.5 py-1.5 bg-slate-50 hover:bg-purple-600 hover:text-white rounded-xl text-slate-700 font-bold text-right flex items-center justify-between transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-purple-600" />
                <span>ملف المطحنة والترخيص والتوقيعات</span>
              </div>
              <ArrowRight className="w-3 h-3 opacity-60 rotate-180" />
            </button>

            <button
              onClick={() => onNavigateTab('users')}
              className="px-2.5 py-1.5 bg-slate-50 hover:bg-purple-600 hover:text-white rounded-xl text-slate-700 font-bold text-right flex items-center justify-between transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                <span>المستخدمون ومسؤوليات النظام</span>
              </div>
              <ArrowRight className="w-3 h-3 opacity-60 rotate-180" />
            </button>
          </div>
        </div>
      </div>

      {/* LOW STOCK & REORDER LEVEL ALERTS WIDGET */}
      {lowStockItems.length > 0 && (
        <div className="bg-white border-2 border-amber-300/80 rounded-2xl p-6 shadow-sm space-y-4 animate-in fade-in duration-300">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-amber-100 pb-3.5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-400/40 flex items-center justify-center text-amber-700 shadow-xs">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    تنبيهات المخزون وحد إعادة الطلب (Reorder Level Alerts)
                  </h3>
                  <span className="px-2.5 py-0.5 text-xs font-extrabold bg-rose-100 text-rose-700 border border-rose-200 rounded-full flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                    {lowStockItems.length} صنف بحاجة لتوريد
                  </span>
                  {outOfStockCount > 0 && (
                    <span className="px-2.5 py-0.5 text-xs font-extrabold bg-rose-600 text-white rounded-full">
                      {outOfStockCount} نفد تماماً (0)
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  قائمة بالأصناف التي انخفض رصيدها عن الحد الأدنى المحدد لإعادة الطلب لتسهيل إجراء أوامر الشراء والتوريد الفوري.
                </p>
              </div>
            </div>

            <div className="flex items-center flex-wrap gap-2">
              {/* Filter Tabs */}
              <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-bold">
                <button
                  onClick={() => setStockAlertFilter('ALL')}
                  className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                    stockAlertFilter === 'ALL' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  الكل ({lowStockItems.length})
                </button>
                <button
                  onClick={() => setStockAlertFilter('OUT_OF_STOCK')}
                  className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                    stockAlertFilter === 'OUT_OF_STOCK' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  نفد بالكامل ({outOfStockCount})
                </button>
                <button
                  onClick={() => setStockAlertFilter('CRITICAL')}
                  className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                    stockAlertFilter === 'CRITICAL' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  مستوى حرج
                </button>
              </div>

              {/* Action Buttons */}
              <button
                onClick={() => onNavigateTab('invoices')}
                className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>إصدار فاتورة مشتريات</span>
              </button>
              <button
                onClick={() => onNavigateTab('inventory')}
                className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 border border-slate-300 transition-all cursor-pointer"
              >
                <Package className="w-3.5 h-3.5 text-blue-600" />
                <span>إدارة المخزون</span>
              </button>
            </div>
          </div>

          {/* Low Stock Items List/Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {filteredLowStockItems.map((item) => {
              const alertLimit = item.minQuantityAlert || 5;
              const isZeroOrNegative = item.quantityOnHand <= 0;
              const deficit = Math.max(1, (alertLimit * 2) - Math.max(0, item.quantityOnHand));
              const estimatedItemReorderCost = deficit * (item.purchasePrice || 0);

              return (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all ${
                    isZeroOrNegative
                      ? 'bg-rose-50/60 border-rose-200 hover:border-rose-300'
                      : 'bg-amber-50/40 border-amber-200 hover:border-amber-300'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                          <span>{item.nameAr}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          SKU: {item.sku} {item.category ? `• ${item.category}` : ''}
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                          isZeroOrNegative
                            ? 'bg-rose-600 text-white'
                            : 'bg-amber-200 text-amber-900'
                        }`}
                      >
                        {isZeroOrNegative ? 'رصيد نافد' : 'قارب على النفاد'}
                      </span>
                    </div>

                    {/* Stock comparison metrics */}
                    <div className="grid grid-cols-2 gap-2 bg-white/80 p-2.5 rounded-lg border border-slate-200/80 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-500 block">الكمية المتوفرة:</span>
                        <span
                          className={`font-mono font-extrabold text-sm ${
                            isZeroOrNegative ? 'text-rose-600' : 'text-amber-700'
                          }`}
                        >
                          {item.quantityOnHand} {item.unit || 'حبة'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">حد إعادة الطلب:</span>
                        <span className="font-mono font-bold text-slate-700 text-sm">
                          {alertLimit} {item.unit || 'حبة'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Procurement estimate and quick action */}
                  <div className="mt-3 pt-2.5 border-t border-slate-200/80 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 block">التوريد المقترح ({deficit} {item.unit}):</span>
                      <span className="font-mono font-bold text-blue-700">
                        {formatCurrency(estimatedItemReorderCost, currency)}
                      </span>
                    </div>

                    <button
                      onClick={() => onNavigateTab('invoices')}
                      className="px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 hover:border-blue-300 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                      title="إضافة في فاتورة شراء"
                    >
                      <Truck className="w-3 h-3 text-blue-600" />
                      <span>طلب توريد</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Summary Strip */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between text-xs font-semibold gap-2">
            <div className="flex items-center gap-2 text-slate-700">
              <Info className="w-4 h-4 text-blue-600" />
              <span>
                إجمالي تكلفة الشراء المقترحة لتغطية نواقص المخزون ومضاعفة حد الأمان:
              </span>
              <span className="font-mono font-extrabold text-blue-700 text-sm">
                {formatCurrency(totalEstimatedReorderCost, currency)}
              </span>
            </div>
            <button
              onClick={() => onNavigateTab('inventory')}
              className="text-blue-600 hover:text-blue-800 text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <span>سجل بطاقات وجرد المخزون الشامل</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Interactive Assets & Liabilities Comparison Block */}
      <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-xs space-y-6">
        {/* Section Header & Month Selector Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#E5E1DA] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-[#D4AF37]/10 text-[#B8860B] rounded-xl border border-[#D4AF37]/30">
                <Scale className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-serif font-bold text-[#1A1A1A] flex items-center gap-2">
                  مقارنة إجمالي الأصول والالتزامات الحالية بالشهر السابق
                  <span className="text-[10px] bg-[#EBF5EE] text-[#2D6A4F] border border-[#2D6A4F]/30 px-2 py-0.5 rounded-full flex items-center gap-1 font-sans font-bold">
                    <ShieldCheck className="w-3 h-3 text-[#2D6A4F]" />
                    مرحّلة بالدفاتر
                  </span>
                </h3>
                <p className="text-xs text-[#8C8273] mt-0.5 font-serif">
                  تحليل الحركة التراكمية بناءً على القيود المحاسبية المرحلة للفترة المالية ({selectedMonthObj.label} مقارنة بـ {selectedMonthObj.prevLabel})
                </p>
              </div>
            </div>
          </div>

          {/* Interactive Period Filter Bar */}
          <div className="flex items-center gap-2 bg-[#F9F8F6] p-1.5 rounded-xl border border-[#E5E1DA] text-xs font-bold">
            <span className="text-[#8C8273] px-2 flex items-center gap-1 font-serif">
              <Calendar className="w-3.5 h-3.5 text-[#B8860B]" />
              شهر المقارنة:
            </span>
            <div className="flex items-center gap-1">
              {availableMonths.map(m => (
                <button
                  key={m.code}
                  onClick={() => setSelectedMonthCode(m.code)}
                  className={`px-3 py-1.5 rounded-lg cursor-pointer transition-all ${
                    selectedMonthCode === m.code
                      ? 'bg-[#1A1A1A] text-white shadow-xs font-bold'
                      : 'text-[#6E6659] hover:text-[#1A1A1A] hover:bg-white'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 4 Interactive Display Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* CARD 1: TOTAL ASSETS */}
          <div className="bg-[#FAF9F6] border border-[#E5E1DA] rounded-xl p-5 relative flex flex-col justify-between shadow-2xs hover:border-[#D4AF37] transition-all">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-serif font-bold text-[#8C8273] uppercase tracking-wider">
                  إجمالي الأصول الحالية
                </span>
                <span className="p-2 rounded-lg bg-[#EBF5EE] text-[#2D6A4F]">
                  <Building className="w-4 h-4" />
                </span>
              </div>

              <div className="mt-1">
                <div className="text-2xl font-serif font-extrabold text-[#1A1A1A] font-mono">
                  {formatCurrency(comparisonData.currentSelectedMonthAssets, currency)}
                </div>

                <div className="text-[11px] text-[#8C8273] mt-1 font-mono">
                  الشهر السابق ({selectedMonthObj.prevLabel}):{' '}
                  <span className="font-bold text-[#1A1A1A]">
                    {formatCurrency(comparisonData.previousMonthAssets, currency)}
                  </span>
                </div>
              </div>
            </div>

            {/* Growth & Actions */}
            <div className="mt-4 pt-3 border-t border-[#E5E1DA] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#8C8273]">التغير التراكمي:</span>
                <span
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-full flex items-center gap-1 ${
                    comparisonData.assetDiff >= 0
                      ? 'bg-[#EBF5EE] text-[#2D6A4F] border border-[#2D6A4F]/30'
                      : 'bg-[#FDF0F0] text-[#9E2A2B] border border-[#9E2A2B]/30'
                  }`}
                >
                  {comparisonData.assetDiff >= 0 ? (
                    <TrendingUp className="w-3.5 h-3.5" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5" />
                  )}
                  {comparisonData.assetDiff >= 0 ? '+' : ''}
                  {formatCurrency(comparisonData.assetDiff, currency)} ({comparisonData.assetPct >= 0 ? '+' : ''}{comparisonData.assetPct.toFixed(1)}%)
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => setExpandedAssetDetails(!expandedAssetDetails)}
                  className="flex-1 py-1.5 px-2 bg-white hover:bg-[#F2EFE9] border border-[#E5E1DA] rounded-lg text-[11px] font-bold text-[#1A1A1A] flex items-center justify-center gap-1 cursor-pointer transition-all"
                >
                  <Layers className="w-3.5 h-3.5 text-[#B8860B]" />
                  <span>{expandedAssetDetails ? 'إخفاء الحسابات' : 'تفاصيل الحسابات'}</span>
                  {expandedAssetDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>

                <button
                  onClick={() => setViewingJournalModalCategory('ASSET')}
                  className="py-1.5 px-2 bg-[#1A1A1A] hover:bg-black text-white rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer shadow-2xs"
                  title="معاينة القيود المرحلة للأصول"
                >
                  <Eye className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>القيود ({comparisonData.selMonthAssetJournals.length})</span>
                </button>
              </div>
            </div>
          </div>

          {/* CARD 2: TOTAL CURRENT LIABILITIES */}
          <div className="bg-[#FAF9F6] border border-[#E5E1DA] rounded-xl p-5 relative flex flex-col justify-between shadow-2xs hover:border-[#9E2A2B] transition-all">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-serif font-bold text-[#8C8273] uppercase tracking-wider">
                  إجمالي الالتزامات الحالية
                </span>
                <span className="p-2 rounded-lg bg-[#FDF0F0] text-[#9E2A2B]">
                  <Wallet className="w-4 h-4" />
                </span>
              </div>

              <div className="mt-1">
                <div className="text-2xl font-serif font-extrabold text-[#1A1A1A] font-mono">
                  {formatCurrency(comparisonData.currentSelectedMonthLiabilities, currency)}
                </div>

                <div className="text-[11px] text-[#8C8273] mt-1 font-mono">
                  الشهر السابق ({selectedMonthObj.prevLabel}):{' '}
                  <span className="font-bold text-[#1A1A1A]">
                    {formatCurrency(comparisonData.previousMonthLiabilities, currency)}
                  </span>
                </div>
              </div>
            </div>

            {/* Change & Actions */}
            <div className="mt-4 pt-3 border-t border-[#E5E1DA] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#8C8273]">تغير الالتزامات:</span>
                <span
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-full flex items-center gap-1 ${
                    comparisonData.liabilityDiff <= 0
                      ? 'bg-[#EBF5EE] text-[#2D6A4F] border border-[#2D6A4F]/30'
                      : 'bg-[#FFFBEB] text-[#B8860B] border border-[#B8860B]/30'
                  }`}
                >
                  {comparisonData.liabilityDiff <= 0 ? (
                    <TrendingDown className="w-3.5 h-3.5 text-[#2D6A4F]" />
                  ) : (
                    <TrendingUp className="w-3.5 h-3.5 text-[#B8860B]" />
                  )}
                  {comparisonData.liabilityDiff > 0 ? '+' : ''}
                  {formatCurrency(comparisonData.liabilityDiff, currency)} ({comparisonData.liabilityPct > 0 ? '+' : ''}{comparisonData.liabilityPct.toFixed(1)}%)
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => setExpandedLiabilityDetails(!expandedLiabilityDetails)}
                  className="flex-1 py-1.5 px-2 bg-white hover:bg-[#F2EFE9] border border-[#E5E1DA] rounded-lg text-[11px] font-bold text-[#1A1A1A] flex items-center justify-center gap-1 cursor-pointer transition-all"
                >
                  <Layers className="w-3.5 h-3.5 text-[#9E2A2B]" />
                  <span>{expandedLiabilityDetails ? 'إخفاء الحسابات' : 'تفاصيل الحسابات'}</span>
                  {expandedLiabilityDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>

                <button
                  onClick={() => setViewingJournalModalCategory('LIABILITY')}
                  className="py-1.5 px-2 bg-[#1A1A1A] hover:bg-black text-white rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer shadow-2xs"
                  title="معاينة القيود المرحلة للالتزامات"
                >
                  <Eye className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>القيود ({comparisonData.selMonthLiabilityJournals.length})</span>
                </button>
              </div>
            </div>
          </div>

          {/* CARD 3: NET ASSETS & WORKING CAPITAL */}
          <div className="bg-[#FAF9F6] border border-[#E5E1DA] rounded-xl p-5 relative flex flex-col justify-between shadow-2xs hover:border-[#2D6A4F] transition-all">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-serif font-bold text-[#8C8273] uppercase tracking-wider">
                  صافي الأصول (حقوق المالكين)
                </span>
                <span className="p-2 rounded-lg bg-[#EBF5EE] text-[#2D6A4F]">
                  <Scale className="w-4 h-4" />
                </span>
              </div>

              <div className="mt-1">
                <div className="text-2xl font-serif font-extrabold text-[#2D6A4F] font-mono">
                  {formatCurrency(comparisonData.currentNetAssets, currency)}
                </div>

                <div className="text-[11px] text-[#8C8273] mt-1 font-mono">
                  الشهر السابق: <span className="font-bold text-[#1A1A1A]">{formatCurrency(comparisonData.prevNetAssets, currency)}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#E5E1DA] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#8C8273]">نمو حقوق الصافي:</span>
                <span className="text-xs font-bold text-[#2D6A4F]">
                  {comparisonData.netAssetsDiff >= 0 ? '+' : ''}{formatCurrency(comparisonData.netAssetsDiff, currency)}
                </span>
              </div>
              <p className="text-[10px] text-[#8C8273] leading-relaxed">
                الأصول المتداولة والثابتة بعد الخصم الكامل للالتزامات والمستحقات.
              </p>
            </div>
          </div>

          {/* CARD 4: SOLVENCY RATIO */}
          <div className="bg-[#FAF9F6] border border-[#E5E1DA] rounded-xl p-5 relative flex flex-col justify-between shadow-2xs hover:border-[#1A1A1A] transition-all">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-serif font-bold text-[#8C8273] uppercase tracking-wider">
                  مؤشر الملاءة وتغطية الالتزامات
                </span>
                <span className="p-2 rounded-lg bg-[#F2EFE9] text-[#B8860B]">
                  <PieChart className="w-4 h-4" />
                </span>
              </div>

              <div className="mt-1">
                <div className="text-2xl font-serif font-extrabold text-[#1A1A1A] font-mono">
                  {comparisonData.currentSolvency.toFixed(2)}x
                </div>

                <div className="text-[11px] text-[#8C8273] mt-1 font-mono">
                  الشهر السابق: <span className="font-bold text-[#1A1A1A]">{comparisonData.prevSolvency.toFixed(2)}x</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#E5E1DA] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#8C8273]">التقييم المحاسبي:</span>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-[#EBF5EE] text-[#2D6A4F] border border-[#2D6A4F]/30">
                  وضع ممتاز (ملاءة مرتفعة)
                </span>
              </div>
              <p className="text-[10px] text-[#8C8273] leading-relaxed">
                كل دين بليرة/دينار يقابله أصول جارية بثلاثة أضعاف على الأقل.
              </p>
            </div>
          </div>

        </div>

        {/* EXPANDABLE SECTION: ASSET ACCOUNT BREAKDOWN */}
        {expandedAssetDetails && (
          <div className="bg-white border border-[#E5E1DA] rounded-xl p-4 space-y-3 text-xs animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-[#E5E1DA] pb-2">
              <h4 className="font-extrabold text-[#1A1A1A] flex items-center gap-2">
                <Building className="w-4 h-4 text-[#B8860B]" />
                تفاصيل ورصيد كل حساب ضمن إجمالي الأصول ({assetAccounts.length} حسابات)
              </h4>
              <span className="text-[11px] text-[#8C8273]">المبالغ محتسبة بناءً على القيود المرحلة</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {assetAccounts.map(acc => {
                const bal = acc.balance || 0;
                const pctOfTotal = comparisonData.currentSelectedMonthAssets > 0
                  ? ((bal / comparisonData.currentSelectedMonthAssets) * 100)
                  : 0;

                return (
                  <div key={acc.id} className="p-3 bg-[#FAF9F6] border border-[#E5E1DA] rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-[#B8860B]">{acc.code}</span>
                      <span className="font-bold text-[#1A1A1A]">{acc.nameAr}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[#8C8273]">الرصيد:</span>
                      <span className="font-mono font-extrabold text-[#2D6A4F]">{formatCurrency(bal, currency)}</span>
                    </div>
                    <div className="w-full bg-[#E5E1DA] h-1.5 rounded-full overflow-hidden">
                      <div className="bg-[#2D6A4F] h-full rounded-full" style={{ width: `${Math.min(100, pctOfTotal)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* EXPANDABLE SECTION: LIABILITY ACCOUNT BREAKDOWN */}
        {expandedLiabilityDetails && (
          <div className="bg-white border border-[#E5E1DA] rounded-xl p-4 space-y-3 text-xs animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-[#E5E1DA] pb-2">
              <h4 className="font-extrabold text-[#1A1A1A] flex items-center gap-2">
                <Wallet className="w-4 h-4 text-[#9E2A2B]" />
                تفاصيل ورصيد كل حساب ضمن إجمالي الالتزامات ({liabilityAccounts.length} حسابات)
              </h4>
              <span className="text-[11px] text-[#8C8273]">المبالغ محتسبة بناءً على القيود المرحلة</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {liabilityAccounts.map(acc => {
                const bal = acc.balance || 0;
                const pctOfTotal = comparisonData.currentSelectedMonthLiabilities > 0
                  ? ((bal / comparisonData.currentSelectedMonthLiabilities) * 100)
                  : 0;

                return (
                  <div key={acc.id} className="p-3 bg-[#FAF9F6] border border-[#E5E1DA] rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-[#9E2A2B]">{acc.code}</span>
                      <span className="font-bold text-[#1A1A1A]">{acc.nameAr}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[#8C8273]">الرصيد:</span>
                      <span className="font-mono font-extrabold text-[#9E2A2B]">{formatCurrency(bal, currency)}</span>
                    </div>
                    <div className="w-full bg-[#E5E1DA] h-1.5 rounded-full overflow-hidden">
                      <div className="bg-[#9E2A2B] h-full rounded-full" style={{ width: `${Math.min(100, pctOfTotal)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* KPI Cards Grid & Customization Header */}
      <div className="space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-100/80 text-blue-700 rounded-xl">
              <LayoutGrid className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  مؤشرات الأداء المالي والتشغيلي (KPIs)
                </h3>
                <span className="text-xs font-bold px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full">
                  {kpiSettings.cardOrder.filter(id => !kpiSettings.hiddenCardIds.includes(id)).length} معروضة
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                يمكنك تخصيص المؤشرات وترتيبها واختيار تخطيط الأعمدة المناسب لاحتياجاتك.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Quick Grid Density Selector */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => handleSaveKpiSettings({ ...kpiSettings, columns: 2 })}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  kpiSettings.columns === 2 ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="عرض في عمودين"
              >
                عمودان
              </button>
              <button
                type="button"
                onClick={() => handleSaveKpiSettings({ ...kpiSettings, columns: 3 })}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  kpiSettings.columns === 3 ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="عرض في ٣ أعمدة"
              >
                ٣ أعمدة
              </button>
              <button
                type="button"
                onClick={() => handleSaveKpiSettings({ ...kpiSettings, columns: 4 })}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  kpiSettings.columns === 4 ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="عرض في ٤ أعمدة (قياسي)"
              >
                ٤ أعمدة
              </button>
            </div>

            {/* Customize Trigger Button */}
            <button
              type="button"
              onClick={() => setShowKpiModal(true)}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer active:scale-95"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>تخصيص وترتيب البطاقات</span>
            </button>
          </div>
        </div>

        {/* Dynamic Responsive KPI Cards Grid */}
        <div
          className={`grid gap-4 ${
            kpiSettings.columns === 2
              ? 'grid-cols-1 md:grid-cols-2'
              : kpiSettings.columns === 3
              ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
              : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
          }`}
        >
          {kpiSettings.cardOrder
            .filter((id) => !kpiSettings.hiddenCardIds.includes(id))
            .map((cardId) => {
              const cardDef = ALL_AVAILABLE_KPIS.find((k) => k.id === cardId);
              if (!cardDef) return null;

              // Render customized card
              return (
                <div
                  key={cardId}
                  className="bg-white border border-[#E5E1DA] p-5 rounded-2xl relative group overflow-hidden shadow-xs hover:border-blue-400 hover:shadow-md transition-all flex flex-col justify-between"
                >
                  {/* Card Quick Move Buttons on Hover */}
                  <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-slate-900/80 p-1 rounded-lg z-10">
                    <button
                      type="button"
                      onClick={() => handleQuickMoveCard(cardId, 'UP')}
                      className="p-1 text-slate-300 hover:text-white hover:bg-slate-700 rounded cursor-pointer"
                      title="تحريك للأمام"
                    >
                      <MoveUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickMoveCard(cardId, 'DOWN')}
                      className="p-1 text-slate-300 hover:text-white hover:bg-slate-700 rounded cursor-pointer"
                      title="تحريك للخلف"
                    >
                      <MoveDown className="w-3 h-3" />
                    </button>
                  </div>

                  <div>
                    {/* Render specific card details */}
                    {cardId === 'totalAssets' && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-serif uppercase tracking-wider text-[#8C8273]">إجمالي الأصول</span>
                          <div className="p-2 rounded-xl bg-[#F2EFE9] text-[#B8860B]">
                            <Building className="w-5 h-5" />
                          </div>
                        </div>
                        <div className="mt-3">
                          <h3 className="text-2xl font-serif font-extrabold text-[#1A1A1A] font-mono">
                            {formatCurrency(kpis.totalAssets, currency)}
                          </h3>
                          <p className="text-[11px] text-[#2D6A4F] flex items-center gap-1 mt-1 font-medium">
                            <CheckCircle2 className="w-3 h-3" /> أصول ثابتة ومتداولة ومخزون
                          </p>
                        </div>
                      </>
                    )}

                    {cardId === 'netProfit' && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-serif uppercase tracking-wider text-[#8C8273]">صافي أرباح الفترة</span>
                          <div
                            className={`p-2 rounded-xl ${
                              isProfitPositive
                                ? 'bg-[#EBF5EE] text-[#2D6A4F]'
                                : 'bg-[#FDF0F0] text-[#9E2A2B]'
                            }`}
                          >
                            {isProfitPositive ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                          </div>
                        </div>
                        <div className="mt-3">
                          <h3
                            className={`text-2xl font-serif font-extrabold font-mono ${
                              isProfitPositive ? 'text-[#2D6A4F]' : 'text-[#9E2A2B]'
                            }`}
                          >
                            {formatCurrency(kpis.netProfit, currency)}
                          </h3>
                          <p className="text-[11px] text-[#8C8273] flex items-center gap-1 mt-1 font-medium">
                            الإيرادات - التكاليف والمصروفات
                          </p>
                        </div>
                      </>
                    )}

                    {cardId === 'totalRevenue' && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-serif uppercase tracking-wider text-[#8C8273]">إجمالي الإيرادات</span>
                          <div className="p-2 rounded-xl bg-blue-50 text-blue-700">
                            <DollarSign className="w-5 h-5" />
                          </div>
                        </div>
                        <div className="mt-3">
                          <h3 className="text-2xl font-serif font-extrabold text-[#1A1A1A] font-mono">
                            {formatCurrency(kpis.totalRevenue, currency)}
                          </h3>
                          <p className="text-[11px] text-[#B8860B] flex items-center gap-1 mt-1 font-medium">
                            <ArrowUpRight className="w-3.5 h-3.5" /> مبيعات البضائع والخدمات
                          </p>
                        </div>
                      </>
                    )}

                    {cardId === 'cashAndBankBalance' && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-serif uppercase tracking-wider text-[#8C8273]">رصيد النقدية والبنوك</span>
                          <div className="p-2 rounded-xl bg-amber-50 text-amber-800">
                            <Wallet className="w-5 h-5" />
                          </div>
                        </div>
                        <div className="mt-3">
                          <h3 className="text-2xl font-serif font-extrabold text-[#1A1A1A] font-mono">
                            {formatCurrency(kpis.cashAndBankBalance, currency)}
                          </h3>
                          <p className="text-[11px] text-[#8C8273] mt-1 font-medium">
                            سيولة جاهزة في الصناديق والبنوك
                          </p>
                        </div>
                      </>
                    )}

                    {cardId === 'totalLiabilities' && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-serif uppercase tracking-wider text-[#8C8273]">إجمالي الالتزامات</span>
                          <div className="p-2 rounded-xl bg-rose-50 text-rose-700">
                            <Scale className="w-5 h-5" />
                          </div>
                        </div>
                        <div className="mt-3">
                          <h3 className="text-2xl font-serif font-extrabold text-rose-700 font-mono">
                            {formatCurrency(kpis.totalLiabilities, currency)}
                          </h3>
                          <p className="text-[11px] text-[#8C8273] mt-1 font-medium">
                            مستحقات الموردين والديون قصيرة الأجل
                          </p>
                        </div>
                      </>
                    )}

                    {cardId === 'netAssets' && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-serif uppercase tracking-wider text-[#8C8273]">صافي حقوق الملكية</span>
                          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                            <Scale className="w-5 h-5" />
                          </div>
                        </div>
                        <div className="mt-3">
                          <h3 className="text-2xl font-serif font-extrabold text-[#2D6A4F] font-mono">
                            {formatCurrency((kpis.totalAssets || 0) - (kpis.totalLiabilities || 0), currency)}
                          </h3>
                          <p className="text-[11px] text-emerald-700 mt-1 font-medium">
                            رأس المال العامل والأرباح المبقاة
                          </p>
                        </div>
                      </>
                    )}

                    {cardId === 'accountsReceivable' && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-serif uppercase tracking-wider text-[#8C8273]">ذمم العملاء والجمعيات</span>
                          <div className="p-2 rounded-xl bg-amber-50 text-amber-800">
                            <Users2 className="w-5 h-5" />
                          </div>
                        </div>
                        <div className="mt-3">
                          <h3 className="text-2xl font-serif font-extrabold text-[#B8860B] font-mono">
                            {formatCurrency(kpis.accountsReceivableTotal || 0, currency)}
                          </h3>
                          <p className="text-[11px] text-[#8C8273] mt-1 font-medium">
                            مبيعات آجلة مستحقة التحصيل
                          </p>
                        </div>
                      </>
                    )}

                    {cardId === 'accountsPayable' && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-serif uppercase tracking-wider text-[#8C8273]">مستحقات الموردين</span>
                          <div className="p-2 rounded-xl bg-purple-50 text-purple-700">
                            <Wallet className="w-5 h-5" />
                          </div>
                        </div>
                        <div className="mt-3">
                          <h3 className="text-2xl font-serif font-extrabold text-purple-900 font-mono">
                            {formatCurrency(kpis.accountsPayableTotal || 0, currency)}
                          </h3>
                          <p className="text-[11px] text-[#8C8273] mt-1 font-medium">
                            فواتير خامات ومشتريات آجلة
                          </p>
                        </div>
                      </>
                    )}

                    {cardId === 'inventoryValuation' && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-serif uppercase tracking-wider text-[#8C8273]">إجمالي تقييم المخزون</span>
                          <div className="p-2 rounded-xl bg-blue-50 text-blue-700">
                            <Package className="w-5 h-5" />
                          </div>
                        </div>
                        <div className="mt-3">
                          <h3 className="text-2xl font-serif font-extrabold text-blue-900 font-mono">
                            {formatCurrency(
                              inventory.reduce((sum, item) => sum + (item.quantityOnHand * (item.purchasePrice || item.salePrice || 0)), 0),
                              currency
                            )}
                          </h3>
                          <p className="text-[11px] text-blue-600 mt-1 font-medium">
                            {inventory.length} صنف ومادة خام مسجلة
                          </p>
                        </div>
                      </>
                    )}

                    {cardId === 'solvencyRatio' && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-serif uppercase tracking-wider text-[#8C8273]">مؤشر الملاءة المالية</span>
                          <div className="p-2 rounded-xl bg-cyan-50 text-cyan-800">
                            <Scale className="w-5 h-5" />
                          </div>
                        </div>
                        <div className="mt-3">
                          <h3 className="text-2xl font-serif font-extrabold text-cyan-900 font-mono">
                            {(kpis.totalLiabilities > 0 ? (kpis.totalAssets / kpis.totalLiabilities) : 100).toFixed(2)}x
                          </h3>
                          <p className="text-[11px] text-cyan-700 mt-1 font-medium">
                            تغطية الأصول للالتزامات والديون
                          </p>
                        </div>
                      </>
                    )}

                    {cardId === 'lowStockAlert' && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-serif uppercase tracking-wider text-[#8C8273]">تنبيهات حد الطلب</span>
                          <div className={`p-2 rounded-xl ${lowStockItems.length > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-700'}`}>
                            <AlertTriangle className="w-5 h-5" />
                          </div>
                        </div>
                        <div className="mt-3">
                          <h3 className={`text-2xl font-serif font-extrabold font-mono ${lowStockItems.length > 0 ? 'text-amber-800' : 'text-emerald-700'}`}>
                            {lowStockItems.length} صنف
                          </h3>
                          <p className="text-[11px] text-[#8C8273] mt-1 font-medium">
                            {outOfStockCount > 0 ? `${outOfStockCount} صنف نفد بالكامل` : 'أصناف بلغت الحد الأدنى'}
                          </p>
                        </div>
                      </>
                    )}

                    {cardId === 'unpaidInvoices' && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-serif uppercase tracking-wider text-[#8C8273]">فواتير غير محصلة</span>
                          <div className="p-2 rounded-xl bg-rose-50 text-rose-700">
                            <FileCheck2 className="w-5 h-5" />
                          </div>
                        </div>
                        <div className="mt-3">
                          <h3 className="text-2xl font-serif font-extrabold text-rose-700 font-mono">
                            {unpaidInvoices.length} فواتير
                          </h3>
                          <p className="text-[11px] text-rose-600 mt-1 font-medium">
                            مجموع {formatCurrency(unpaidInvoices.reduce((sum, inv) => sum + (Number(inv.grandTotal) - Number(inv.paidAmount || 0)), 0), currency)}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Recharts Analytical Dashboard Panel */}
      <div className="bg-white border border-[#E5E1DA] p-6 rounded-lg space-y-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5E1DA] pb-4">
          <div>
            <h3 className="text-lg font-serif font-bold text-[#1A1A1A] flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#B8860B]" />
              التحليل المالي السنوي - التدفقات النقدية والذمم المدينة والمستحقة
            </h3>
            <p className="text-xs text-[#8C8273] mt-0.5 font-serif">
              رسم بياني تفاعلي يوضح الحركة النقدية والالتزامات وحقوق التحصيل عبر أشهر السنة المالية ({currency})
            </p>
          </div>

          {/* Metric Filter Tabs */}
          <div className="flex items-center gap-1 bg-[#F2EFE9] p-1 rounded-md border border-[#E5E1DA] text-xs font-semibold">
            <button
              onClick={() => setChartMode('all')}
              className={`px-3 py-1.5 rounded-sm transition-all cursor-pointer ${
                chartMode === 'all'
                  ? 'bg-white text-[#1A1A1A] shadow-xs font-bold'
                  : 'text-[#6E6659] hover:text-[#1A1A1A]'
              }`}
            >
              الشامل
            </button>
            <button
              onClick={() => setChartMode('cash')}
              className={`px-3 py-1.5 rounded-sm transition-all cursor-pointer ${
                chartMode === 'cash'
                  ? 'bg-[#2D6A4F] text-white shadow-xs font-bold'
                  : 'text-[#6E6659] hover:text-[#1A1A1A]'
              }`}
            >
              التدفق النقدي
            </button>
            <button
              onClick={() => setChartMode('dues')}
              className={`px-3 py-1.5 rounded-sm transition-all cursor-pointer ${
                chartMode === 'dues'
                  ? 'bg-[#B8860B] text-white shadow-xs font-bold'
                  : 'text-[#6E6659] hover:text-[#1A1A1A]'
              }`}
            >
              الذمم والالتزامات
            </button>
          </div>
        </div>

        {/* Recharts Container */}
        <div className="w-full h-80 pt-2" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={monthlyChartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F2EFE9" vertical={false} />
              <XAxis
                dataKey="monthName"
                tick={{ fill: '#6E6659', fontSize: 12, fontFamily: 'sans-serif' }}
                axisLine={{ stroke: '#E5E1DA' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#6E6659', fontSize: 11, fontFamily: 'monospace' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip currency={currency} />} />
              <Legend
                wrapperStyle={{ paddingTop: 15, fontSize: 12, fontFamily: 'sans-serif' }}
                formatter={(value) => <span className="text-[#1A1A1A] font-semibold">{value}</span>}
              />
              {(chartMode === 'all' || chartMode === 'cash') && (
                <Area
                  type="monotone"
                  dataKey="cashInflow"
                  name="التدفق النقدي المقبوض"
                  fill="#2D6A4F"
                  stroke="#2D6A4F"
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
              )}
              {(chartMode === 'all' || chartMode === 'dues') && (
                <Bar
                  dataKey="receivables"
                  name="الذمم المدينة (حقوق العملاء)"
                  fill="#B8860B"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
              )}
              {(chartMode === 'all' || chartMode === 'dues') && (
                <Bar
                  dataKey="payables"
                  name="الذمم الدائنة (الموردين)"
                  fill="#9E2A2B"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
              )}
              {(chartMode === 'all' || chartMode === 'cash') && (
                <Line
                  type="monotone"
                  dataKey="netCash"
                  name="صافي الحركة النقدية"
                  stroke="#1A1A1A"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#1A1A1A' }}
                  activeDot={{ r: 6, fill: '#D4AF37' }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Chart Summary Stats Footer */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-[#E5E1DA] text-xs">
          <div className="flex items-center gap-3 bg-[#FDFCFB] p-3 rounded-md border border-[#E5E1DA]">
            <div className="p-2 rounded bg-[#EBF5EE] text-[#2D6A4F]">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[#8C8273]">إجمالي المقبوضات السنوية</div>
              <div className="font-serif font-bold text-[#2D6A4F] text-sm">
                {formatCurrency(totalYearlyInflow, currency)}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-[#FDFCFB] p-3 rounded-md border border-[#E5E1DA]">
            <div className="p-2 rounded bg-[#FDF0F0] text-[#9E2A2B]">
              <TrendingDown className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[#8C8273]">إجمالي المدفوعات السنوية</div>
              <div className="font-serif font-bold text-[#9E2A2B] text-sm">
                {formatCurrency(totalYearlyOutflow, currency)}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-[#FDFCFB] p-3 rounded-md border border-[#E5E1DA]">
            <div className="p-2 rounded bg-[#F2EFE9] text-[#B8860B]">
              <PieChart className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[#8C8273]">معدل تغطية السيولة النقدية</div>
              <div className="font-serif font-bold text-[#1A1A1A] text-sm">
                {liquidityRatio.toFixed(1)}% مؤشر إيجابي
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Financial Health Summary & Receivables/Payables */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue vs Expenses Ratio Card */}
        <div className="lg:col-span-2 bg-white border border-[#E5E1DA] p-6 rounded-lg space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-[#E5E1DA] pb-3">
            <h3 className="text-base font-serif font-bold text-[#1A1A1A] flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-[#B8860B]" /> ملخص الأداء المالي والربحية
            </h3>
            <button
              onClick={() => onNavigateTab('financials')}
              className="text-xs font-semibold text-[#B8860B] hover:text-[#1A1A1A] flex items-center gap-1 cursor-pointer transition-colors"
            >
              عرض القوائم المالية الكاملة &larr;
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-[#FDFCFB] p-4 rounded-md border border-[#E5E1DA]">
              <span className="text-xs text-[#8C8273]">الذمم المدينة (حقوق لدى العملاء)</span>
              <div className="text-lg font-serif font-bold text-[#B8860B] mt-1">
                {formatCurrency(kpis.accountsReceivableTotal, currency)}
              </div>
            </div>
            <div className="bg-[#FDFCFB] p-4 rounded-md border border-[#E5E1DA]">
              <span className="text-xs text-[#8C8273]">الذمم الدائنة (التزامات للموردين)</span>
              <div className="text-lg font-serif font-bold text-[#9E2A2B] mt-1">
                {formatCurrency(kpis.accountsPayableTotal, currency)}
              </div>
            </div>
          </div>

          {/* Revenue vs Expenses Bar */}
          <div className="space-y-2 pt-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-[#6E6659]">
                نسبة المصروفات والتكاليف إلى الإيراد
              </span>
              <span className="text-[#2D6A4F] font-serif font-bold">
                {Number(kpis?.totalRevenue) > 0
                  ? `${((Number(kpis?.totalExpenses || 0) / Number(kpis.totalRevenue)) * 100).toFixed(1)}%`
                  : '0.0%'}
              </span>
            </div>
            <div className="w-full bg-[#F2EFE9] rounded-full h-3 overflow-hidden p-0.5 border border-[#E5E1DA]">
              <div
                className="bg-[#1A1A1A] h-2 rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(
                    100,
                    Math.max(
                      0,
                      Number(kpis?.totalRevenue) > 0
                        ? (Number(kpis?.netProfit || 0) / Number(kpis.totalRevenue)) * 100
                        : 0
                    )
                  )}%`,
                }}
              />
            </div>
            <p className="text-[11px] text-[#8C8273]">
              صافي هامش الربح التشغيلي المحقق حتى الآن يبلغ (
              {Number(kpis?.totalRevenue) > 0
                ? ((Number(kpis?.netProfit || 0) / Number(kpis.totalRevenue)) * 100).toFixed(1)
                : '0.0'}
              %) من إجمالي المبيعات.
            </p>
          </div>
        </div>

        {/* Unpaid Invoices Widget */}
        <div className="bg-white border border-[#E5E1DA] p-6 rounded-lg flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-[#E5E1DA] pb-3">
              <h3 className="text-base font-serif font-bold text-[#1A1A1A] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-[#B8860B]" /> فواتير مستحقة للتحصيل
              </h3>
              <span className="px-2.5 py-0.5 text-xs font-bold bg-[#F2EFE9] text-[#B8860B] border border-[#D4AF37]/40 rounded-full">
                {unpaidInvoices.length} فاتورة
              </span>
            </div>

            {unpaidInvoices.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#8C8273] font-serif italic">
                لا توجد فواتير آجلية غير مدفوعة حالياً 🎉
              </div>
            ) : (
              <div className="space-y-3">
                {unpaidInvoices.slice(0, 3).map((inv) => (
                  <div
                    key={inv.id}
                    className="p-3 bg-[#FDFCFB] rounded-md border border-[#E5E1DA] flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-[#1A1A1A]">{inv.entityNameAr}</div>
                      <div className="text-[11px] text-[#8C8273] font-mono">{inv.invoiceNumber} • {inv.date}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-serif font-bold text-[#B8860B]">
                        {formatCurrency(inv.dueAmount, currency)}
                      </div>
                      <div className="text-[10px] text-[#8C8273]">غير مدفوعة</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => onNavigateTab('invoices')}
            className="w-full mt-4 py-2 bg-[#F2EFE9] hover:bg-[#E5E1DA] text-[#1A1A1A] rounded-md text-xs font-semibold transition-colors cursor-pointer border border-[#E5E1DA]"
          >
            إدارة الفواتير وسندات القبض &larr;
          </button>
        </div>
      </div>

      {/* Recent Journal Entries Table */}
      <div className="bg-white border border-[#E5E1DA] p-6 rounded-lg space-y-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-[#E5E1DA] pb-3">
          <h3 className="text-base font-serif font-bold text-[#1A1A1A] flex items-center gap-2">
            <FileCheck2 className="w-4 h-4 text-[#B8860B]" /> آخر القيود المحاسبية المرحلة
          </h3>
          <button
            onClick={() => onNavigateTab('journals')}
            className="text-xs font-semibold text-[#B8860B] hover:text-[#1A1A1A] cursor-pointer transition-colors"
          >
            سجل القيود الكامل &larr;
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-[#F7F5F0] text-[#6E6659] font-serif font-bold border-b border-[#E5E1DA]">
              <tr>
                <th className="py-3 px-4">رقم القيد</th>
                <th className="py-3 px-4">التاريخ</th>
                <th className="py-3 px-4">البيان والتفاصيل</th>
                <th className="py-3 px-4">إجمالي المدين</th>
                <th className="py-3 px-4">إجمالي الدائن</th>
                <th className="py-3 px-4 text-center">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E1DA]">
              {recentJournals.slice(0, 5).map((j) => (
                <tr key={j.id} className="hover:bg-[#FDFCFB] transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-[#B8860B]">{j.entryNumber}</td>
                  <td className="py-3 px-4 text-[#6E6659]">{j.date}</td>
                  <td className="py-3 px-4 text-[#1A1A1A] max-w-xs truncate">{j.description}</td>
                  <td className="py-3 px-4 font-serif font-bold text-[#1A1A1A]">
                    {formatCurrency(j.totalDebit, currency)}
                  </td>
                  <td className="py-3 px-4 font-serif font-bold text-[#1A1A1A]">
                    {formatCurrency(j.totalCredit, currency)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`px-2.5 py-0.5 text-[10px] font-semibold rounded-full border ${
                        j.status === 'POSTED'
                          ? 'bg-[#EBF5EE] text-[#2D6A4F] border-[#2D6A4F]/30'
                          : 'bg-[#FDF0F0] text-[#9E2A2B] border-[#9E2A2B]/30'
                      }`}
                    >
                      {j.status === 'POSTED' ? 'مرحّل' : 'ملغى'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* JOURNAL ENTRIES AUDIT MODAL FOR ASSETS / LIABILITIES */}
      {viewingJournalModalCategory && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 dir-rtl text-right">
          <div className="bg-white border border-[#E5E1DA] w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="bg-[#1A1A1A] text-white px-6 py-4 flex items-center justify-between border-b border-black">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#D4AF37]/20 rounded-xl border border-[#D4AF37]/40">
                  <FileCheck2 className="w-5 h-5 text-[#D4AF37]" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                    معاينة القيود المحاسبية المرحلة ({viewingJournalModalCategory === 'ASSET' ? 'حسابات الأصول' : 'حسابات الالتزامات'})
                  </h3>
                  <p className="text-xs text-neutral-400 font-serif">
                    الفترة: {selectedMonthObj.label} • القيود ذات الحالة (POSTED) فقط
                  </p>
                </div>
              </div>

              <button
                onClick={() => setViewingJournalModalCategory(null)}
                className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter Search Header */}
            <div className="p-4 bg-[#FAF9F6] border-b border-[#E5E1DA] flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
              <input
                type="text"
                placeholder="بحث برقم القيد أو اسم الحساب أو البيان..."
                value={journalModalSearch}
                onChange={(e) => setJournalModalSearch(e.target.value)}
                className="w-full sm:w-80 bg-white border border-[#E5E1DA] rounded-lg px-3 py-2 text-[#1A1A1A] outline-none font-semibold"
              />

              <div className="text-[#8C8273] font-bold text-xs whitespace-nowrap">
                إجمالي حركة المدين:{' '}
                <span className="font-mono text-[#2D6A4F] ml-2">
                  {formatCurrency(
                    viewingJournalModalCategory === 'ASSET'
                      ? comparisonData.selAssetDebits
                      : comparisonData.selLiabilityDebits,
                    currency
                  )}
                </span>
                إجمالي الدائن:{' '}
                <span className="font-mono text-[#9E2A2B]">
                  {formatCurrency(
                    viewingJournalModalCategory === 'ASSET'
                      ? comparisonData.selAssetCredits
                      : comparisonData.selLiabilityCredits,
                    currency
                  )}
                </span>
              </div>
            </div>

            {/* Modal Body Table */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
              {(() => {
                const list = viewingJournalModalCategory === 'ASSET'
                  ? comparisonData.selMonthAssetJournals
                  : comparisonData.selMonthLiabilityJournals;

                const filtered = list.filter(item => {
                  if (!journalModalSearch) return true;
                  const q = journalModalSearch.toLowerCase();
                  return (
                    item.journal.entryNumber.toLowerCase().includes(q) ||
                    (item.line.accountNameAr && item.line.accountNameAr.toLowerCase().includes(q)) ||
                    (item.line.accountName && item.line.accountName.toLowerCase().includes(q)) ||
                    (item.journal.description && item.journal.description.toLowerCase().includes(q))
                  );
                });

                if (filtered.length === 0) {
                  return (
                    <div className="py-12 text-center text-[#8C8273] font-serif">
                      لا توجد قيود مرحّلة تنطبق على الفلترة في شهر {selectedMonthObj.label}
                    </div>
                  );
                }

                return (
                  <div className="overflow-x-auto border border-[#E5E1DA] rounded-xl">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-[#F7F5F0] text-[#1A1A1A] font-bold border-b border-[#E5E1DA]">
                        <tr>
                          <th className="py-2.5 px-3">رقم القيد</th>
                          <th className="py-2.5 px-3">التاريخ</th>
                          <th className="py-2.5 px-3">الحساب</th>
                          <th className="py-2.5 px-3">مدين</th>
                          <th className="py-2.5 px-3">دائن</th>
                          <th className="py-2.5 px-3">البيان والشرح</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5E1DA]">
                        {filtered.map((item, idx) => (
                          <tr key={idx} className="hover:bg-[#FDFCFB]">
                            <td className="py-2.5 px-3 font-mono font-bold text-[#B8860B]">{item.journal.entryNumber}</td>
                            <td className="py-2.5 px-3 text-[#8C8273] font-mono">{item.journal.date}</td>
                            <td className="py-2.5 px-3 font-bold text-[#1A1A1A]">
                              <span className="font-mono text-[#8C8273] ml-1">[{item.line.accountCode}]</span>
                              {item.line.accountNameAr || item.line.accountName || 'حساب'}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-[#2D6A4F]">
                              {item.line.debit > 0 ? formatCurrency(item.line.debit, currency) : '-'}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-[#9E2A2B]">
                              {item.line.credit > 0 ? formatCurrency(item.line.credit, currency) : '-'}
                            </td>
                            <td className="py-2.5 px-3 text-[#6E6659]">
                              {item.line.memo || item.journal.description || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-[#FAF9F6] border-t border-[#E5E1DA] flex justify-end">
              <button
                onClick={() => setViewingJournalModalCategory(null)}
                className="px-5 py-2 bg-[#1A1A1A] hover:bg-black text-white font-bold rounded-xl cursor-pointer text-xs"
              >
                إغلاق المعاينة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards Customization Modal */}
      <KpiCustomizerModal
        isOpen={showKpiModal}
        onClose={() => setShowKpiModal(false)}
        settings={kpiSettings}
        onSaveSettings={handleSaveKpiSettings}
      />
    </div>
  );
};
