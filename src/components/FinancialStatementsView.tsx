import React, { useState, useEffect } from 'react';
import {
  BalanceSheetReport,
  IncomeStatementReport,
  CashFlowReport,
  BalanceSheetItem,
} from '../types.js';
import { formatCurrency } from '../utils/formatters.ts';
import { formatKWD } from '../utils/accountingTreeEngine.ts';
import {
  LineChart,
  ShieldCheck,
  CheckCircle2,
  Printer,
  Calendar,
  Building,
  TrendingUp,
  Wallet,
  Eye,
  EyeOff,
  Search,
  AlertCircle,
  FileText,
  X,
  Layers,
  ChevronLeft,
} from 'lucide-react';
import { DataService } from '../services/dataService.ts';

const formatKWD3 = (val: number | string | null | undefined): string => {
  const num = typeof val === 'number' ? val : Number(val || 0);
  const safe = isNaN(num) ? 0 : num;
  return `${safe.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} د.ك`;
};

interface FinancialStatementsProps {
  currency: string;
}

export const FinancialStatementsView: React.FC<FinancialStatementsProps> = ({ currency }) => {
  const [subTab, setSubTab] = useState<'balance-sheet' | 'pnl' | 'cash-flow'>('balance-sheet');
  const [startDate, setStartDate] = useState<string>('2026-01-01');
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const [showAllAccounts, setShowAllAccounts] = useState<boolean>(false);
  const [calcMode, setCalcMode] = useState<'cumulative' | 'gl_only'>('cumulative');

  const [pnl, setPnl] = useState<IncomeStatementReport | null>(null);
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetReport | null>(null);
  const [cashFlow, setCashFlow] = useState<CashFlowReport | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Ledger Audit Modal State
  const [selectedAuditAccount, setSelectedAuditAccount] = useState<BalanceSheetItem | null>(null);
  const [auditJournals, setAuditJournals] = useState<any[]>([]);
  const [loadingAudit, setLoadingAudit] = useState<boolean>(false);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const [pnlData, bsData, cfData] = await Promise.all([
        DataService.getPnL(startDate, endDate),
        DataService.getBalanceSheet(endDate, {
          includeZeroBalances: showAllAccounts,
          calculationMode: calcMode,
        }),
        DataService.getCashFlow(startDate, endDate),
      ]);

      if (pnlData) setPnl(pnlData);
      if (cfData) setCashFlow(cfData);
      if (bsData) setBalanceSheet(bsData);
    } catch (err) {
      console.error('Error fetching financial statements:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [startDate, endDate, showAllAccounts, calcMode]);

  const handleOpenAccountAudit = async (item: BalanceSheetItem) => {
    setSelectedAuditAccount(item);
    setLoadingAudit(true);
    try {
      const allJournals = await DataService.getJournals();
      const code = String(item.accountCode || '').trim();
      const id = String(item.accountId || '').trim();
      const related = allJournals.filter(
        (j) =>
          j.status === 'POSTED' &&
          j.lines?.some(
            (l: any) =>
              (id && (l.accountId === id || l.account_id === id)) ||
              (code && (l.accountCode === code || l.account_code === code))
          )
      );
      setAuditJournals(related);
    } catch (e) {
      console.error('Error loading account audit journals:', e);
    } finally {
      setLoadingAudit(false);
    }
  };

  const renderAccountRow = (it: BalanceSheetItem) => {
    const isLeaf = it.isLeaf ?? true;
    const isZero = it.isZero ?? (it.amount === 0);
    const indentPx = Math.max(0, ((it.level || 1) - 1) * 12);

    return (
      <div
        key={it.accountCode}
        onClick={() => handleOpenAccountAudit(it)}
        title="انقر لفتح كشف حساب وتدقيق حركات الأستاذ العام"
        className={`flex justify-between items-center text-xs py-1.5 px-2 rounded transition-colors cursor-pointer border-b border-[#E5E1DA]/60 hover:bg-[#F7F5F0] group ${
          !isLeaf ? 'font-semibold bg-[#FAFAF8]' : ''
        } ${isZero ? 'opacity-60' : ''}`}
        style={{ paddingRight: `${8 + indentPx}px` }}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="font-mono text-[11px] font-bold text-[#8C8273] bg-[#E5E1DA]/40 px-1.5 py-0.5 rounded">
            {it.accountCode}
          </span>
          <span className="text-[#1A1A1A] truncate">{it.accountNameAr}</span>
          {it.accountNameEn && (
            <span className="text-[10px] text-[#8C8273] hidden sm:inline truncate">
              ({it.accountNameEn})
            </span>
          )}
          <Search className="w-3 h-3 text-[#B8860B] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </div>
        <span
          className={`font-mono text-xs ${
            it.amount < 0
              ? 'text-[#9E2A2B] font-bold'
              : it.amount > 0
              ? 'text-[#1A1A1A] font-bold'
              : 'text-[#8C8273]'
          }`}
        >
          {formatKWD3(it.amount)}
        </span>
      </div>
    );
  };

  const getActiveItems = (section: any): BalanceSheetItem[] => {
    if (showAllAccounts && section.allItems && section.allItems.length > 0) {
      return section.allItems;
    }
    return section.items || [];
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-[#E5E1DA] p-6 rounded-lg shadow-xs">
        <div>
          <h2 className="text-2xl font-serif font-bold text-[#1A1A1A] flex items-center gap-2">
            <LineChart className="w-5 h-5 text-[#B8860B]" /> القوائم المالية والحسابات الختامية
          </h2>
          <p className="text-xs text-[#8C8273] mt-1 font-serif italic">
            قائمة المركز المالي (الميزانية العمومية)، قائمة الدخل (الأرباح والخسائر)، وقائمة التدفقات النقدية وفق المعايير المحاسبية.
          </p>
        </div>

        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-[#1A1A1A] hover:bg-[#2D2B28] text-white rounded-md text-xs font-semibold flex items-center gap-2 border border-[#1A1A1A] shadow-xs transition-all cursor-pointer no-print"
        >
          <Printer className="w-4 h-4 text-[#D4AF37]" />
          <span>طباعة القوائم المالية الرسمية</span>
        </button>
      </div>

      {/* Sub-Tab Navigation & Date Range Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-[#F7F5F0] border border-[#E5E1DA] p-4 rounded-lg no-print">
        {/* Sub tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { id: 'balance-sheet', label: 'قائمة المركز المالي (الميزانية)' },
            { id: 'pnl', label: 'قائمة الدخل (الأرباح والخسائر)' },
            { id: 'cash-flow', label: 'قائمة التدفقات النقدية' },
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setSubTab(st.id as any)}
              className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                subTab === st.id
                  ? 'bg-[#1A1A1A] text-white shadow-xs border border-[#1A1A1A]'
                  : 'text-[#6E6659] hover:text-[#1A1A1A] hover:bg-white'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>

        {/* Date filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 text-xs text-[#1A1A1A]">
            <span>من:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-white border border-[#E5E1DA] rounded-md px-2.5 py-1 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A]"
            />
          </div>
          <div className="flex items-center gap-1 text-xs text-[#1A1A1A]">
            <span>إلى:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-white border border-[#E5E1DA] rounded-md px-2.5 py-1 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A]"
            />
          </div>
        </div>
      </div>

      {/* Balance Sheet Controls Bar */}
      {subTab === 'balance-sheet' && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white border border-[#E5E1DA] px-4 py-3 rounded-lg no-print">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Calculation Mode */}
            <span className="text-xs text-[#6E6659] font-serif font-semibold">نمط الاحتساب:</span>
            <div className="inline-flex rounded-md shadow-2xs border border-[#E5E1DA] p-0.5 bg-[#F7F5F0]">
              <button
                type="button"
                onClick={() => setCalcMode('cumulative')}
                className={`px-3 py-1 text-xs rounded transition-all cursor-pointer ${
                  calcMode === 'cumulative'
                    ? 'bg-white text-[#1A1A1A] font-bold shadow-2xs'
                    : 'text-[#6E6659] hover:text-[#1A1A1A]'
                }`}
              >
                الرصيد التراكمي الشامل (المعتمد)
              </button>
              <button
                type="button"
                onClick={() => setCalcMode('gl_only')}
                className={`px-3 py-1 text-xs rounded transition-all cursor-pointer ${
                  calcMode === 'gl_only'
                    ? 'bg-white text-[#1A1A1A] font-bold shadow-2xs'
                    : 'text-[#6E6659] hover:text-[#1A1A1A]'
                }`}
              >
                سجل ترحيلات الأستاذ العام فقط (GL Ledger)
              </button>
            </div>

            {/* Toggle Full Chart of Accounts */}
            <button
              type="button"
              onClick={() => setShowAllAccounts(!showAllAccounts)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs border transition-all cursor-pointer ${
                showAllAccounts
                  ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]'
                  : 'bg-white text-[#6E6659] hover:text-[#1A1A1A] border-[#E5E1DA]'
              }`}
            >
              {showAllAccounts ? <Eye className="w-3.5 h-3.5 text-[#D4AF37]" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span>
                {showAllAccounts
                  ? 'عرض دليل الحسابات كاملاً (مُفعّل)'
                  : 'عرض بنود الأرصدة النشطة فقط'}
              </span>
            </button>
          </div>

          <div className="text-[11px] text-[#8C8273] font-serif italic">
            * يمكنك النقر على أي بند لاستعراض كشف حركاته في الأستاذ العام
          </div>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-[#8C8273] font-serif italic">جاري احتساب وإعداد القوائم المالية...</div>
      ) : (
        <>
          {/* 1. BALANCE SHEET (قائمة المركز المالي) */}
          {subTab === 'balance-sheet' && balanceSheet && (
            <div className="bg-white border border-[#E5E1DA] rounded-lg p-6 space-y-6 shadow-xs printable-card">
              <div className="border-b border-[#E5E1DA] pb-4 flex flex-wrap justify-between items-center gap-4">
                <div>
                  <h3 className="text-base font-serif font-bold text-[#1A1A1A]">
                    قائمة المركز المالي (Statement of Financial Position - Balance Sheet)
                  </h3>
                  <p className="text-xs text-[#8C8273] mt-1 font-serif italic">
                    كما هي في {balanceSheet.asOfDate} • معدّة بدقة تامة ومطابقة للمعايير المحاسبية الدولية (IAS 1)
                  </p>
                </div>

                {balanceSheet.isBalanced ? (
                  <span className="px-3 py-1.5 bg-[#EBF5EE] text-[#2D6A4F] border border-[#2D6A4F]/30 rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-2xs">
                    <ShieldCheck className="w-4 h-4 text-[#2D6A4F]" />
                    <span>متوازنة ومطابقة محاسبياً 100% (الأصول = الخصوم + حقوق الملكية)</span>
                  </span>
                ) : (
                  <span className="px-3 py-1.5 bg-[#FDF0ED] text-[#9E2A2B] border border-[#9E2A2B]/30 rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-2xs">
                    <AlertCircle className="w-4 h-4 text-[#9E2A2B]" />
                    <span>
                      يوجد فارق عدم توازن: {formatKWD3(balanceSheet.difference || 0)}
                    </span>
                  </span>
                )}
              </div>

              {/* Two Column Layout: Assets vs Liabilities & Equity */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Assets Column */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-[#F7F5F0] p-2.5 rounded-md border border-[#E5E1DA]">
                    <h4 className="text-xs font-serif font-bold text-[#2D6A4F] flex items-center gap-1.5">
                      <Wallet className="w-4 h-4 text-[#2D6A4F]" />
                      <span>الأصول (Assets)</span>
                    </h4>
                    <span className="text-xs font-mono font-bold text-[#2D6A4F]">
                      {formatKWD3(balanceSheet.totalAssets)}
                    </span>
                  </div>

                  {/* Current Assets */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-serif font-bold text-[#1A1A1A] pb-1 border-b border-[#E5E1DA]">
                      <span>{balanceSheet.currentAssets.categoryNameAr}</span>
                      <span className="font-mono text-[#2D6A4F]">
                        {formatKWD3(balanceSheet.currentAssets.totalAmount)}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {getActiveItems(balanceSheet.currentAssets).map((it) => renderAccountRow(it))}
                    </div>
                  </div>

                  {/* Non Current Assets */}
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between text-xs font-serif font-bold text-[#1A1A1A] pb-1 border-b border-[#E5E1DA]">
                      <span>{balanceSheet.nonCurrentAssets.categoryNameAr}</span>
                      <span className="font-mono text-[#2D6A4F]">
                        {formatKWD3(balanceSheet.nonCurrentAssets.totalAmount)}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {getActiveItems(balanceSheet.nonCurrentAssets).length > 0 ? (
                        getActiveItems(balanceSheet.nonCurrentAssets).map((it) => renderAccountRow(it))
                      ) : (
                        <div className="text-[11px] text-[#8C8273] italic py-1 px-2">لا توجد أصول غير متداولة مسجلة</div>
                      )}
                    </div>
                  </div>

                  <div className="p-3.5 bg-[#EBF5EE] border border-[#2D6A4F]/30 rounded-md flex justify-between items-center text-sm font-serif font-bold text-[#2D6A4F] shadow-2xs">
                    <span>إجمالي الأصول (Total Assets):</span>
                    <span className="font-mono">{formatKWD3(balanceSheet.totalAssets)}</span>
                  </div>
                </div>

                {/* Liabilities & Equity Column */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-[#F7F5F0] p-2.5 rounded-md border border-[#E5E1DA]">
                    <h4 className="text-xs font-serif font-bold text-[#9E2A2B] flex items-center gap-1.5">
                      <Building className="w-4 h-4 text-[#9E2A2B]" />
                      <span>الخصوم وحقوق الملكية (Liabilities & Equity)</span>
                    </h4>
                    <span className="text-xs font-mono font-bold text-[#1A1A1A]">
                      {formatKWD3(balanceSheet.totalLiabilitiesAndEquity)}
                    </span>
                  </div>

                  {/* Current Liabilities */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-serif font-bold text-[#1A1A1A] pb-1 border-b border-[#E5E1DA]">
                      <span>{balanceSheet.currentLiabilities.categoryNameAr}</span>
                      <span className="font-mono text-[#9E2A2B]">
                        {formatKWD3(balanceSheet.currentLiabilities.totalAmount)}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {getActiveItems(balanceSheet.currentLiabilities).length > 0 ? (
                        getActiveItems(balanceSheet.currentLiabilities).map((it) => renderAccountRow(it))
                      ) : (
                        <div className="text-[11px] text-[#8C8273] italic py-1 px-2">لا توجد التزامات متداولة مسجلة</div>
                      )}
                    </div>
                  </div>

                  {/* Non Current Liabilities */}
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between text-xs font-serif font-bold text-[#1A1A1A] pb-1 border-b border-[#E5E1DA]">
                      <span>{balanceSheet.nonCurrentLiabilities.categoryNameAr}</span>
                      <span className="font-mono text-[#9E2A2B]">
                        {formatKWD3(balanceSheet.nonCurrentLiabilities.totalAmount)}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {getActiveItems(balanceSheet.nonCurrentLiabilities).length > 0 ? (
                        getActiveItems(balanceSheet.nonCurrentLiabilities).map((it) => renderAccountRow(it))
                      ) : (
                        <div className="text-[11px] text-[#8C8273] italic py-1 px-2">لا توجد التزامات طويلة الأجل مسجلة</div>
                      )}
                    </div>
                  </div>

                  {/* Equity */}
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between text-xs font-serif font-bold text-[#1A1A1A] pb-1 border-b border-[#E5E1DA]">
                      <span>{balanceSheet.equity.categoryNameAr}</span>
                      <span className="font-mono text-[#B8860B]">
                        {formatKWD3(balanceSheet.totalEquity)}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {getActiveItems(balanceSheet.equity).map((it) => renderAccountRow(it))}
                    </div>
                  </div>

                  <div className="p-3.5 bg-[#F7F5F0] border border-[#E5E1DA] rounded-md flex justify-between items-center text-sm font-serif font-bold text-[#1A1A1A] shadow-2xs">
                    <span>إجمالي الخصوم وحقوق الملكية:</span>
                    <span className="font-mono">
                      {formatKWD3(balanceSheet.totalLiabilitiesAndEquity)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. INCOME STATEMENT (قائمة الدخل P&L) */}
          {subTab === 'pnl' && pnl && (
            <div className="bg-white border border-[#E5E1DA] rounded-lg p-6 space-y-6 shadow-xs printable-card">
              <div className="border-b border-[#E5E1DA] pb-4">
                <h3 className="text-base font-serif font-bold text-[#1A1A1A]">
                  قائمة الدخل - الأرباح والخسائر (Income Statement / Profit & Loss)
                </h3>
                <p className="text-xs text-[#8C8273] mt-1 font-serif italic">
                  عن الفترة من {pnl.startDate} إلى {pnl.endDate}
                </p>
              </div>

              <div className="space-y-4 max-w-3xl mx-auto">
                {/* Revenue Section */}
                <div className="bg-[#F7F5F0] border border-[#E5E1DA] rounded-md p-4 space-y-2">
                  <h4 className="text-xs font-serif font-bold text-[#2D6A4F]">الإيرادات (Revenues)</h4>
                  {pnl.revenues.map((rev) => (
                    <div key={rev.accountCode} className="flex justify-between text-xs text-[#6E6659]">
                      <span>{rev.accountCode} - {rev.accountNameAr}</span>
                      <span className="font-serif font-bold text-[#1A1A1A]">{formatKWD(rev.amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-xs font-serif font-bold text-[#2D6A4F] pt-2 border-t border-[#E5E1DA]">
                    <span>إجمالي الإيرادات:</span>
                    <span>{formatKWD(pnl.totalRevenue)}</span>
                  </div>
                </div>

                {/* COGS Section */}
                <div className="bg-[#F7F5F0] border border-[#E5E1DA] rounded-md p-4 space-y-2">
                  <h4 className="text-xs font-serif font-bold text-[#B8860B]">تكلفة البضاعة المباعة (COGS)</h4>
                  {pnl.cogs.map((cg) => (
                    <div key={cg.accountCode} className="flex justify-between text-xs text-[#6E6659]">
                      <span>{cg.accountCode} - {cg.accountNameAr}</span>
                      <span className="font-serif font-bold text-[#1A1A1A]">({formatKWD(cg.amount)})</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-xs font-serif font-bold text-[#B8860B] pt-2 border-t border-[#E5E1DA]">
                    <span>إجمالي تكلفة المبيعات:</span>
                    <span>({formatKWD(pnl.totalCogs)})</span>
                  </div>
                </div>

                {/* Gross Profit Bar */}
                <div className="bg-[#EBF5EE] border border-[#2D6A4F]/30 rounded-md p-4 flex justify-between items-center font-serif font-bold text-sm text-[#2D6A4F]">
                  <span>مجمل الربح (Gross Profit):</span>
                  <span>{formatKWD(pnl.grossProfit)}</span>
                </div>

                {/* Expenses Section */}
                <div className="bg-[#F7F5F0] border border-[#E5E1DA] rounded-md p-4 space-y-2">
                  <h4 className="text-xs font-serif font-bold text-[#9E2A2B]">المصروفات العمومية والإدارية (Operating Expenses)</h4>
                  {pnl.expenses.map((exp) => (
                    <div key={exp.accountCode} className="flex justify-between text-xs text-[#6E6659]">
                      <span>{exp.accountCode} - {exp.accountNameAr}</span>
                      <span className="font-serif font-bold text-[#1A1A1A]">({formatKWD(exp.amount)})</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-xs font-serif font-bold text-[#9E2A2B] pt-2 border-t border-[#E5E1DA]">
                    <span>إجمالي المصروفات الإدارية:</span>
                    <span>({formatKWD(pnl.totalExpenses)})</span>
                  </div>
                </div>

                {/* Net Income Final Banner */}
                <div
                  className={`p-5 rounded-md border flex justify-between items-center text-base font-serif font-bold shadow-xs ${
                    pnl.netIncome >= 0
                      ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]'
                      : 'bg-[#9E2A2B] text-white border-[#9E2A2B]'
                  }`}
                >
                  <span>صافي الأرباح / الخسائر (Net Income):</span>
                  <span>{formatKWD(pnl.netIncome)}</span>
                </div>
              </div>
            </div>
          )}

          {/* 3. CASH FLOW STATEMENT (قائمة التدفقات النقدية) */}
          {subTab === 'cash-flow' && cashFlow && (
            <div className="bg-white border border-[#E5E1DA] rounded-lg p-6 space-y-6 shadow-xs printable-card">
              <div className="border-b border-[#E5E1DA] pb-4">
                <h3 className="text-base font-serif font-bold text-[#1A1A1A]">
                  قائمة التدفقات النقدية (Statement of Cash Flows - IAS 7)
                </h3>
                <p className="text-xs text-[#8C8273] mt-1 font-serif italic">
                  عن الفترة من {cashFlow.startDate} إلى {cashFlow.endDate}
                </p>
              </div>

              <div className="space-y-4 max-w-3xl mx-auto text-xs">
                {/* Operating */}
                <div className="bg-[#F7F5F0] p-4 rounded-md border border-[#E5E1DA] space-y-2">
                  <h4 className="font-serif font-bold text-[#2D6A4F]">
                    1. التدفقات النقدية من الأنشطة التشغيلية (Operating Activities)
                  </h4>
                  <div className="flex justify-between text-[#6E6659]">
                    <span>صافي أرباح الفترة:</span>
                    <span className="font-serif font-bold text-[#1A1A1A]">{formatKWD(cashFlow.operatingCashFlow.netIncome)}</span>
                  </div>
                  {cashFlow.operatingCashFlow.adjustments && cashFlow.operatingCashFlow.adjustments.length > 0 && (
                    <div className="space-y-1 pt-1 pb-1">
                      {cashFlow.operatingCashFlow.adjustments.map((adj, idx) => (
                        <div key={idx} className="flex justify-between text-[#6E6659] pl-2 border-r-2 border-[#2D6A4F]/30 pr-2 text-[11px]">
                          <span>{adj.label}:</span>
                          <span className="font-serif font-semibold text-[#1A1A1A]">
                            {adj.amount >= 0 ? `+${formatKWD(adj.amount)}` : `(${formatKWD(Math.abs(adj.amount))})`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex justify-between text-[#2D6A4F] font-serif font-bold border-t border-[#E5E1DA] pt-2">
                    <span>صافي التدفق النقدي التشغيلي:</span>
                    <span>{formatKWD(cashFlow.operatingCashFlow.totalOperating)}</span>
                  </div>
                </div>

                {/* Investing */}
                {cashFlow.investingCashFlow && cashFlow.investingCashFlow.items && cashFlow.investingCashFlow.items.length > 0 && (
                  <div className="bg-[#F7F5F0] p-4 rounded-md border border-[#E5E1DA] space-y-2">
                    <h4 className="font-serif font-bold text-[#B8860B]">
                      2. التدفقات النقدية من الأنشطة الاستثمارية (Investing Activities)
                    </h4>
                    {cashFlow.investingCashFlow.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-[#6E6659] pl-2 border-r-2 border-[#B8860B]/30 pr-2 text-[11px]">
                        <span>{item.label}:</span>
                        <span className="font-serif font-semibold text-[#1A1A1A]">{formatKWD(item.amount)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-[#B8860B] font-serif font-bold border-t border-[#E5E1DA] pt-2">
                      <span>صافي التدفق النقدي الاستثماري:</span>
                      <span>{formatKWD(cashFlow.investingCashFlow.totalInvesting)}</span>
                    </div>
                  </div>
                )}

                {/* Financing */}
                {cashFlow.financingCashFlow && cashFlow.financingCashFlow.items && cashFlow.financingCashFlow.items.length > 0 && (
                  <div className="bg-[#F7F5F0] p-4 rounded-md border border-[#E5E1DA] space-y-2">
                    <h4 className="font-serif font-bold text-[#1A1A1A]">
                      3. التدفقات النقدية من الأنشطة التمويلية (Financing Activities)
                    </h4>
                    {cashFlow.financingCashFlow.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-[#6E6659] pl-2 border-r-2 border-[#1A1A1A]/30 pr-2 text-[11px]">
                        <span>{item.label}:</span>
                        <span className="font-serif font-semibold text-[#1A1A1A]">{formatKWD(item.amount)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-[#1A1A1A] font-serif font-bold border-t border-[#E5E1DA] pt-2">
                      <span>صافي التدفق النقدي التمويلي:</span>
                      <span>{formatKWD(cashFlow.financingCashFlow.totalFinancing)}</span>
                    </div>
                  </div>
                )}

                {/* Summary */}
                <div className="bg-white p-4 rounded-md border border-[#E5E1DA] space-y-2 font-serif font-bold text-[#1A1A1A]">
                  <div className="flex justify-between">
                    <span>صافي التغير في النقدية خلال الفترة:</span>
                    <span className="text-[#2D6A4F]">{formatKWD(cashFlow.netCashChange)}</span>
                  </div>
                  <div className="flex justify-between text-[#8C8273] font-normal italic">
                    <span>رصيد النقدية في بداية الفترة:</span>
                    <span>{formatKWD(cashFlow.openingCash)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-[#2D6A4F] pt-2 border-t border-[#E5E1DA]">
                    <span>رصيد النقدية وما في حكمها نهاية الفترة:</span>
                    <span>{formatKWD(cashFlow.closingCash)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Ledger Audit Drill-down Modal */}
      {selectedAuditAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs no-print">
          <div className="bg-white border border-[#E5E1DA] rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#E5E1DA] bg-[#F7F5F0]">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#B8860B]" />
                <div>
                  <h3 className="text-sm font-serif font-bold text-[#1A1A1A]">
                    تدقيق الحساب في الأستاذ العام: {selectedAuditAccount.accountCode} - {selectedAuditAccount.accountNameAr}
                  </h3>
                  {selectedAuditAccount.accountNameEn && (
                    <p className="text-[11px] text-[#8C8273]">{selectedAuditAccount.accountNameEn}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelectedAuditAccount(null)}
                className="p-1 hover:bg-[#E5E1DA] rounded text-[#8C8273] hover:text-[#1A1A1A] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Account Balance Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-[#F7F5F0] p-3 rounded border border-[#E5E1DA]">
                  <span className="text-[#8C8273] block text-[11px]">الرصيد الافتتاحي</span>
                  <span className="font-mono font-bold text-[#1A1A1A] block mt-1">
                    {formatKWD3(selectedAuditAccount.openingBalance || 0)}
                  </span>
                </div>
                <div className="bg-[#EBF5EE] p-3 rounded border border-[#2D6A4F]/30">
                  <span className="text-[#2D6A4F] block text-[11px]">إجمالي الحركات المدينة</span>
                  <span className="font-mono font-bold text-[#2D6A4F] block mt-1">
                    {formatKWD3(
                      auditJournals.reduce((sum, j) => {
                        const line = j.lines?.find(
                          (l: any) =>
                            l.accountId === selectedAuditAccount.accountId ||
                            l.accountCode === selectedAuditAccount.accountCode
                        );
                        return sum + Number(line?.debit || 0);
                      }, 0)
                    )}
                  </span>
                </div>
                <div className="bg-[#FDF0ED] p-3 rounded border border-[#9E2A2B]/30">
                  <span className="text-[#9E2A2B] block text-[11px]">إجمالي الحركات الدائنة</span>
                  <span className="font-mono font-bold text-[#9E2A2B] block mt-1">
                    {formatKWD3(
                      auditJournals.reduce((sum, j) => {
                        const line = j.lines?.find(
                          (l: any) =>
                            l.accountId === selectedAuditAccount.accountId ||
                            l.accountCode === selectedAuditAccount.accountCode
                        );
                        return sum + Number(line?.credit || 0);
                      }, 0)
                    )}
                  </span>
                </div>
                <div className="bg-[#1A1A1A] text-white p-3 rounded border border-[#1A1A1A]">
                  <span className="text-[#D4AF37] block text-[11px]">الرصيد النهائي الحالي</span>
                  <span className="font-mono font-bold text-white block mt-1">
                    {formatKWD3(selectedAuditAccount.amount)}
                  </span>
                </div>
              </div>

              {/* Journal Entries List */}
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-serif font-bold text-[#1A1A1A]">
                  سجل قيود اليومية المرحلة للحساب ({auditJournals.length} قيد مرحل)
                </h4>

                {loadingAudit ? (
                  <div className="p-8 text-center text-xs text-[#8C8273] italic">جاري جلب قيود اليومية...</div>
                ) : auditJournals.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#8C8273] bg-[#F7F5F0] rounded border border-[#E5E1DA] italic">
                    لا توجد قيود يومية إضافية مسجلة بعد الرصيد الافتتاحي المعتمد في شجرة الحسابات.
                  </div>
                ) : (
                  <div className="border border-[#E5E1DA] rounded overflow-hidden text-xs">
                    <table className="w-full text-right border-collapse">
                      <thead className="bg-[#F7F5F0] border-b border-[#E5E1DA] text-[#6E6659] font-serif">
                        <tr>
                          <th className="p-2.5">التاريخ</th>
                          <th className="p-2.5">رقم القيد</th>
                          <th className="p-2.5">البيان والشرح</th>
                          <th className="p-2.5">مدين</th>
                          <th className="p-2.5">دائن</th>
                          <th className="p-2.5">الحالة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5E1DA]">
                        {auditJournals.map((j) => {
                          const line = j.lines?.find(
                            (l: any) =>
                              l.accountId === selectedAuditAccount.accountId ||
                              l.accountCode === selectedAuditAccount.accountCode
                          );
                          const debit = Number(line?.debit || 0);
                          const credit = Number(line?.credit || 0);

                          return (
                            <tr key={j.id} className="hover:bg-[#F7F5F0]">
                              <td className="p-2.5 font-mono text-[11px] text-[#6E6659]">{j.date}</td>
                              <td className="p-2.5 font-mono font-bold text-[#1A1A1A]">{j.referenceNumber || j.id?.slice(0, 8)}</td>
                              <td className="p-2.5 text-[#1A1A1A]">{line?.description || j.description || '-'}</td>
                              <td className="p-2.5 font-mono font-bold text-[#2D6A4F]">
                                {debit > 0 ? formatKWD3(debit) : '-'}
                              </td>
                              <td className="p-2.5 font-mono font-bold text-[#9E2A2B]">
                                {credit > 0 ? formatKWD3(credit) : '-'}
                              </td>
                              <td className="p-2.5">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#EBF5EE] text-[#2D6A4F]">
                                  مرحل
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-[#E5E1DA] bg-[#F7F5F0] flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedAuditAccount(null)}
                className="px-4 py-1.5 bg-[#1A1A1A] text-white rounded text-xs font-semibold hover:bg-[#2D2B28] cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
