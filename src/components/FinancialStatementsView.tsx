import React, { useState, useEffect } from 'react';
import {
  BalanceSheetReport,
  IncomeStatementReport,
  CashFlowReport
} from '../types.js';
import { formatCurrency } from '../utils/formatters.ts';
import { formatKWD } from '../utils/accountingTreeEngine.ts';
import { supabase, isSupabaseConfigured, getCurrentCompanyId, resolveToSupabaseCompanyUUID } from '../services/supabaseClient.ts';
import {
  LineChart,
  ShieldCheck,
  CheckCircle2,
  Printer,
  Calendar,
  Building,
  TrendingUp,
  Wallet
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

  const [pnl, setPnl] = useState<IncomeStatementReport | null>(null);
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetReport | null>(null);
  const [cashFlow, setCashFlow] = useState<CashFlowReport | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const [pnlData, bsData, cfData] = await Promise.all([
        DataService.getPnL(startDate, endDate),
        DataService.getBalanceSheet(endDate),
        DataService.getCashFlow(startDate, endDate),
      ]);

      if (pnlData) setPnl(pnlData);
      if (cfData) setCashFlow(cfData);

      let customBs: BalanceSheetReport | null = null;
      // Direct dynamic aggregation from Supabase chart_of_accounts
      if (isSupabaseConfigured) {
        try {
          const rawCompId = getCurrentCompanyId();
          const compId = resolveToSupabaseCompanyUUID(rawCompId);
          if (compId) {
            const { data: coaRows, error: coaError } = await supabase
              .from('chart_of_accounts')
              .select('*')
              .eq('company_id', compId)
              .order('code', { ascending: true });

            if (!coaError && coaRows && coaRows.length > 0) {
              const currentAssets: { accountCode: string; accountNameAr: string; amount: number }[] = [];
              const nonCurrentAssets: { accountCode: string; accountNameAr: string; amount: number }[] = [];
              const currentLiabilities: { accountCode: string; accountNameAr: string; amount: number }[] = [];
              const nonCurrentLiabilities: { accountCode: string; accountNameAr: string; amount: number }[] = [];
              const equity: { accountCode: string; accountNameAr: string; amount: number }[] = [];

              let sumCurrentAssets = 0;
              let sumNonCurrentAssets = 0;
              let sumCurrentLiabilities = 0;
              let sumNonCurrentLiabilities = 0;
              let sumEquity = 0;

              const parentIds = new Set(coaRows.map((r: any) => r.parent_id).filter(Boolean));
              const parentCodes = new Set<string>();
              coaRows.forEach((r: any) => {
                const c = String(r.code || '').trim();
                if (c) {
                  coaRows.forEach((other: any) => {
                    const oc = String(other.code || '').trim();
                    if (oc && oc !== c && oc.startsWith(c)) {
                      parentCodes.add(c);
                    }
                  });
                }
              });

              const detailAccounts = coaRows.filter((r: any) => {
                if (r.is_leaf === true || r.type === 'DETAIL') return true;
                if (parentIds.has(r.id) || parentCodes.has(String(r.code || '').trim())) return false;
                return true;
              });

              const targetRows = (detailAccounts.length > 0 && detailAccounts.some((r: any) => Math.abs(Number(r.current_balance ?? r.balance ?? 0)) > 0))
                ? detailAccounts
                : coaRows;

              targetRows.forEach((row: any) => {
                const bal = Math.abs(Number(row.current_balance ?? row.balance ?? 0));
                if (bal === 0) return;
                const cat = String(row.category || '').toUpperCase();
                const code = String(row.code || '').trim();
                const name = row.name_ar || row.name || code;

                if (cat === 'ASSET' || code.startsWith('1')) {
                  if (code.startsWith('11')) {
                    currentAssets.push({ accountCode: code, accountNameAr: name, amount: bal });
                    sumCurrentAssets += bal;
                  } else {
                    nonCurrentAssets.push({ accountCode: code, accountNameAr: name, amount: bal });
                    sumNonCurrentAssets += bal;
                  }
                } else if (cat === 'LIABILITY' || code.startsWith('2')) {
                  if (code.startsWith('21')) {
                    currentLiabilities.push({ accountCode: code, accountNameAr: name, amount: bal });
                    sumCurrentLiabilities += bal;
                  } else {
                    nonCurrentLiabilities.push({ accountCode: code, accountNameAr: name, amount: bal });
                    sumNonCurrentLiabilities += bal;
                  }
                } else if (cat === 'EQUITY' || code.startsWith('3')) {
                  equity.push({ accountCode: code, accountNameAr: name, amount: bal });
                  sumEquity += bal;
                }
              });

              const totalAssets = sumCurrentAssets + sumNonCurrentAssets;
              const totalLiabilities = sumCurrentLiabilities + sumNonCurrentLiabilities;
              let totalEquity = sumEquity + (pnlData?.netIncome || 0);

              if (totalAssets > 0 && (totalLiabilities + totalEquity) === 0) {
                totalEquity = totalAssets - totalLiabilities;
                if (equity.length === 0) {
                  equity.push({
                    accountCode: '3200',
                    accountNameAr: 'أرباح مرحلة / رصيد افتتاحي لحقوق الملكية',
                    amount: totalEquity,
                  });
                }
              }

              customBs = {
                asOfDate: endDate,
                currentAssets: {
                  categoryNameAr: 'الأصول المتداولة',
                  items: currentAssets,
                  totalAmount: sumCurrentAssets,
                },
                nonCurrentAssets: {
                  categoryNameAr: 'الأصول غير المتداولة (الثابتة)',
                  items: nonCurrentAssets,
                  totalAmount: sumNonCurrentAssets,
                },
                totalAssets,
                currentLiabilities: {
                  categoryNameAr: 'الالتزامات المتداولة',
                  items: currentLiabilities,
                  totalAmount: sumCurrentLiabilities,
                },
                nonCurrentLiabilities: {
                  categoryNameAr: 'الالتزامات طويلة الأجل',
                  items: nonCurrentLiabilities,
                  totalAmount: sumNonCurrentLiabilities,
                },
                totalLiabilities,
                equity: {
                  categoryNameAr: 'حقوق الملكية',
                  items: equity,
                  totalAmount: sumEquity,
                },
                periodNetIncome: pnlData?.netIncome || 0,
                totalEquity,
                totalLiabilitiesAndEquity: totalLiabilities + totalEquity,
                isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.005,
              };
            }
          }
        } catch (coaErr) {
          console.warn('Direct chart_of_accounts query in FinancialStatementsView notice:', coaErr);
        }
      }

      setBalanceSheet(customBs || bsData);
    } catch (err) {
      console.error('Error fetching financial statements:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [startDate, endDate]);

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-[#E5E1DA] p-6 rounded-lg shadow-xs">
        <div>
          <h2 className="text-2xl font-serif font-bold text-[#1A1A1A] flex items-center gap-2">
            <LineChart className="w-5 h-5 text-[#B8860B]" /> القوائم المالية والحسابات الختامية
          </h2>
          <p className="text-xs text-[#8C8273] mt-1 font-serif italic">
            القوائم الرسمية المعتمدة: قائمة المركز المالي (الميزانية العمومية)، قائمة الدخل (الأرباح والخسائر)، وقائمة التدفقات النقدية.
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
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#F7F5F0] border border-[#E5E1DA] p-4 rounded-lg no-print">
        {/* Sub tabs */}
        <div className="flex items-center gap-2">
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
        <div className="flex items-center gap-3">
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
                    كما هي في {balanceSheet.asOfDate} • معدّة وفق الحسابات الختامية الرسمية
                  </p>
                </div>

                <span className="px-3 py-1 bg-[#EBF5EE] text-[#2D6A4F] border border-[#2D6A4F]/30 rounded-full text-xs font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" /> الأصول = الخصوم + حقوق الملكية
                </span>
              </div>

              {/* Two Column Layout: Assets vs Liabilities & Equity */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Assets Column */}
                <div className="space-y-4">
                  <h4 className="text-xs font-serif font-bold text-[#2D6A4F] bg-[#F7F5F0] p-2.5 rounded-md border border-[#E5E1DA]">
                    الأصول (Assets)
                  </h4>

                  {/* Current Assets */}
                  <div className="space-y-2">
                    <span className="text-xs font-serif font-bold text-[#1A1A1A] block">
                      {balanceSheet.currentAssets.categoryNameAr}
                    </span>
                    <div className="space-y-1.5 pl-2">
                      {balanceSheet.currentAssets.items.map((it) => (
                        <div
                          key={it.accountCode}
                          className="flex justify-between text-xs py-1 border-b border-[#E5E1DA]"
                        >
                          <span className="text-[#6E6659]">
                            {it.accountCode} - {it.accountNameAr}
                          </span>
                          <span className="font-serif font-bold text-[#1A1A1A]">
                            {formatKWD3(it.amount)}
                          </span>
                        </div>
                      ))}
                      <div className="flex justify-between text-xs font-serif font-bold py-1.5 text-[#2D6A4F] bg-[#F7F5F0] px-2 rounded-md border border-[#E5E1DA]">
                        <span>مجموع الأصول المتداولة:</span>
                        <span>{formatKWD3(balanceSheet.currentAssets.totalAmount)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Non Current Assets */}
                  <div className="space-y-2 pt-2">
                    <span className="text-xs font-serif font-bold text-[#1A1A1A] block">
                      {balanceSheet.nonCurrentAssets.categoryNameAr}
                    </span>
                    <div className="space-y-1.5 pl-2">
                      {balanceSheet.nonCurrentAssets.items.map((it) => (
                        <div
                          key={it.accountCode}
                          className="flex justify-between text-xs py-1 border-b border-[#E5E1DA]"
                        >
                          <span className="text-[#6E6659]">
                            {it.accountCode} - {it.accountNameAr}
                          </span>
                          <span className="font-serif font-bold text-[#1A1A1A]">
                            {formatKWD3(it.amount)}
                          </span>
                        </div>
                      ))}
                      <div className="flex justify-between text-xs font-serif font-bold py-1.5 text-[#2D6A4F] bg-[#F7F5F0] px-2 rounded-md border border-[#E5E1DA]">
                        <span>مجموع الأصول الثابتة:</span>
                        <span>
                          {formatKWD3(balanceSheet.nonCurrentAssets.totalAmount)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-[#EBF5EE] border border-[#2D6A4F]/30 rounded-md flex justify-between items-center text-sm font-serif font-bold text-[#2D6A4F]">
                    <span>إجمالي الأصول (Total Assets):</span>
                    <span>{formatKWD3(balanceSheet.totalAssets)}</span>
                  </div>
                </div>

                {/* Liabilities & Equity Column */}
                <div className="space-y-4">
                  <h4 className="text-xs font-serif font-bold text-[#9E2A2B] bg-[#F7F5F0] p-2.5 rounded-md border border-[#E5E1DA]">
                    الخصوم وحقوق الملكية (Liabilities & Equity)
                  </h4>

                  {/* Current Liabilities */}
                  <div className="space-y-2">
                    <span className="text-xs font-serif font-bold text-[#1A1A1A] block">
                      {balanceSheet.currentLiabilities.categoryNameAr}
                    </span>
                    <div className="space-y-1.5 pl-2">
                      {balanceSheet.currentLiabilities.items.map((it) => (
                        <div
                          key={it.accountCode}
                          className="flex justify-between text-xs py-1 border-b border-[#E5E1DA]"
                        >
                          <span className="text-[#6E6659]">
                            {it.accountCode} - {it.accountNameAr}
                          </span>
                          <span className="font-serif font-bold text-[#1A1A1A]">
                            {formatKWD3(it.amount)}
                          </span>
                        </div>
                      ))}
                      <div className="flex justify-between text-xs font-serif font-bold py-1.5 text-[#9E2A2B] bg-[#F7F5F0] px-2 rounded-md border border-[#E5E1DA]">
                        <span>مجموع الخصوم المتداولة:</span>
                        <span>
                          {formatKWD3(balanceSheet.currentLiabilities.totalAmount)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Equity */}
                  <div className="space-y-2 pt-2">
                    <span className="text-xs font-serif font-bold text-[#1A1A1A] block">
                      {balanceSheet.equity.categoryNameAr}
                    </span>
                    <div className="space-y-1.5 pl-2">
                      {balanceSheet.equity.items.map((it) => (
                        <div
                          key={it.accountCode}
                          className="flex justify-between text-xs py-1 border-b border-[#E5E1DA]"
                        >
                          <span className="text-[#6E6659]">
                            {it.accountCode} - {it.accountNameAr}
                          </span>
                          <span className="font-serif font-bold text-[#1A1A1A]">
                            {formatKWD3(it.amount)}
                          </span>
                        </div>
                      ))}
                      <div className="flex justify-between text-xs font-serif font-bold py-1.5 text-[#B8860B] bg-[#F7F5F0] px-2 rounded-md border border-[#E5E1DA]">
                        <span>إجمالي حقوق الملكية:</span>
                        <span>{formatKWD3(balanceSheet.totalEquity)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-[#F7F5F0] border border-[#E5E1DA] rounded-md flex justify-between items-center text-sm font-serif font-bold text-[#1A1A1A]">
                    <span>إجمالي الخصوم وحقوق الملكية:</span>
                    <span>
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
                  <div className="flex justify-between text-[#2D6A4F] font-serif font-bold border-t border-[#E5E1DA] pt-2">
                    <span>صافي التدفق النقدي التشغيلي:</span>
                    <span>{formatKWD(cashFlow.operatingCashFlow.totalOperating)}</span>
                  </div>
                </div>

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
    </div>
  );
};
