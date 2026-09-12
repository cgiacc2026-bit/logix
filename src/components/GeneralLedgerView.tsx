import React, { useState, useEffect, useMemo } from 'react';
import { Account, GeneralLedgerReport } from '../types.js';
import { getCategoryBadgeClass, getCategoryLabelAr } from '../utils/formatters.ts';
import { isAccountLeaf } from '../utils/accountingTreeEngine.ts';
import { BookOpen, Printer, Search, Layers, RefreshCw, FileSpreadsheet } from 'lucide-react';
import { DataService } from '../services/dataService.ts';
import { supabase, isSupabaseConfigured, getCurrentCompanyId, resolveToSupabaseCompanyUUID } from '../services/supabaseClient.ts';

interface GeneralLedgerProps {
  journals?: any[];
  accounts: Account[];
  currency: string;
  selectedAccountId?: string;
}

const formatKWD3 = (val: number | string | null | undefined): string => {
  const num = typeof val === 'number' ? val : Number(val || 0);
  const safe = isNaN(num) ? 0 : num;
  return `${safe.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} د.ك`;
};

export const GeneralLedgerView: React.FC<GeneralLedgerProps> = ({
  accounts,
  currency,
  selectedAccountId,
  journals,
}) => {
  // Resolve initial account: prioritize selectedAccountId, or account 1120, or first account
  const initialAccountId = useMemo(() => {
    if (selectedAccountId) {
      const match = accounts.find((a) => a.id === selectedAccountId || a.code === selectedAccountId);
      return match ? match.id : selectedAccountId;
    }
    const acc1120 = accounts.find((a) => a.code === '1120');
    if (acc1120) return acc1120.id;
    return accounts.length > 0 ? accounts[0].id : '';
  }, [selectedAccountId, accounts]);

  const [currentAccountId, setCurrentAccountId] = useState<string>(initialAccountId);
  const [startDate, setStartDate] = useState<string>('2026-01-01');
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [report, setReport] = useState<GeneralLedgerReport | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const selectedAccount = useMemo(() => {
    return accounts.find((a) => a.id === currentAccountId || a.code === currentAccountId) || null;
  }, [accounts, currentAccountId]);

  const isSelectedLeaf = useMemo(() => {
    if (!selectedAccount) return true;
    return isAccountLeaf(selectedAccount, accounts);
  }, [selectedAccount, accounts]);

  // Keep currentAccountId in sync if selectedAccountId prop changes
  useEffect(() => {
    if (selectedAccountId) {
      const match = accounts.find((a) => a.id === selectedAccountId || a.code === selectedAccountId);
      setCurrentAccountId(match ? match.id : selectedAccountId);
    } else if (!currentAccountId && accounts.length > 0) {
      const acc1120 = accounts.find((a) => a.code === '1120');
      setCurrentAccountId(acc1120 ? acc1120.id : accounts[0].id);
    }
  }, [selectedAccountId, accounts, currentAccountId]);

  // Core data fetching with dedicated RPC and fallback to journal_entry_lines
  const fetchLedger = async (accId: string, fromDate: string, toDate: string) => {
    if (!accId) return;
    setLoading(true);
    try {
      const rawCompId = getCurrentCompanyId();
      const companyId = resolveToSupabaseCompanyUUID(rawCompId);

      // Resolve the actual Account entity
      const targetAccount: Account = accounts.find((a) => a.id === accId || a.code === accId) || {
        id: accId,
        code: accId,
        nameAr: 'حساب مالي',
        nameEn: 'Financial Account',
        category: 'ASSET',
        normalBalance: 'DEBIT',
        parentId: null,
        isSystem: false,
        isActive: true,
        level: 1,
        type: 'DETAIL',
        balance: 0,
      };

      let rpcData: any = null;
      let rpcSuccess = false;

      // 1. Dedicated RPC Call: rpc_get_general_ledger
      if (isSupabaseConfigured && companyId) {
        try {
          const { data, error } = await supabase.rpc('rpc_get_general_ledger', {
            p_company_id: companyId,
            p_account_id: targetAccount.id,
            p_from_date: fromDate,
            p_to_date: toDate,
          });

          if (!error && data) {
            rpcData = data;
            rpcSuccess = true;
          } else if (error) {
            console.warn('rpc_get_general_ledger notice:', error.message);
          }
        } catch (rpcErr) {
          console.warn('rpc_get_general_ledger call failed, falling back:', rpcErr);
        }
      }

      // If RPC succeeded, map results
      if (rpcSuccess && rpcData) {
        let movementsList: any[] = [];
        let openingBal = 0;
        let totalDeb = 0;
        let totalCred = 0;

        if (Array.isArray(rpcData)) {
          movementsList = rpcData;
        } else if (typeof rpcData === 'object') {
          movementsList = rpcData.movements || rpcData.lines || rpcData.transactions || [];
          openingBal = Number(rpcData.opening_balance ?? rpcData.openingBalance ?? 0);
        }

        let running = openingBal;
        const mappedMovements = movementsList.map((m: any, idx: number) => {
          const d = Number(m.debit ?? m.debit_amount ?? 0);
          const c = Number(m.credit ?? m.credit_amount ?? 0);
          totalDeb += d;
          totalCred += c;
          if (targetAccount.normalBalance === 'DEBIT') {
            running += (d - c);
          } else {
            running += (c - d);
          }
          return {
            id: m.id || `mov-${idx}`,
            journalEntryId: m.journal_entry_id || m.journalEntryId || '',
            entryNumber: m.entry_number || m.entryNumber || m.journal_number || `JE-${idx + 1}`,
            date: m.date || m.entry_date || fromDate,
            reference: m.reference || m.reference_number || '',
            description: m.description || m.narration || m.notes || m.memo || 'قيد محاسبي',
            debit: d,
            credit: c,
            runningBalance: m.running_balance != null ? Number(m.running_balance) : running,
          };
        });

        setReport({
          account: targetAccount,
          startDate: fromDate,
          endDate: toDate,
          openingBalance: openingBal,
          movements: mappedMovements,
          totalDebit: totalDeb,
          totalCredit: totalCred,
          closingBalance: running,
        });
        return;
      }

      // 2. Direct Supabase query on journal_entry_lines
      if (isSupabaseConfigured && companyId) {
        try {
          const { data: lines, error: linesErr } = await supabase
            .from('journal_entry_lines')
            .select(`
              id,
              account_id,
              account_code,
              debit,
              credit,
              description,
              created_at,
              journal_entries!inner (
                id,
                entry_number,
                date,
                reference,
                status,
                narration
              )
            `)
            .or(`account_id.eq.${targetAccount.id},account_code.eq.${targetAccount.code}`)
            .order('created_at', { ascending: true });

          if (!linesErr && lines && lines.length > 0) {
            let openingBal = 0;
            let totalDeb = 0;
            let totalCred = 0;
            const filteredMovements: any[] = [];

            lines.forEach((line: any) => {
              const je = Array.isArray(line.journal_entries) ? line.journal_entries[0] : line.journal_entries;
              const lineDate = je?.date || line.created_at?.split('T')[0] || fromDate;
              const d = Number(line.debit) || 0;
              const c = Number(line.credit) || 0;

              if (lineDate < fromDate) {
                if (targetAccount.normalBalance === 'DEBIT') {
                  openingBal += (d - c);
                } else {
                  openingBal += (c - d);
                }
              } else if (lineDate <= toDate) {
                totalDeb += d;
                totalCred += c;
                filteredMovements.push({
                  id: line.id,
                  entryNumber: je?.entry_number || `JE-${line.id.slice(0, 6)}`,
                  date: lineDate,
                  reference: je?.reference || '',
                  description: line.description || je?.narration || 'حركة قيد محاسبي',
                  debit: d,
                  credit: c,
                });
              }
            });

            // If openingBal is 0 and targetAccount has balance, use it as baseline
            if (openingBal === 0 && Number(targetAccount.balance || 0) > 0 && totalDeb === 0 && totalCred === 0) {
              openingBal = Number(targetAccount.balance || 0);
            }

            let currentRunning = openingBal;
            const finalMovements = filteredMovements.map((m) => {
              if (targetAccount.normalBalance === 'DEBIT') {
                currentRunning += (m.debit - m.credit);
              } else {
                currentRunning += (m.credit - m.debit);
              }
              return {
                ...m,
                journalEntryId: m.journalEntryId || '',
                runningBalance: currentRunning,
              };
            });

            setReport({
              account: targetAccount,
              startDate: fromDate,
              endDate: toDate,
              openingBalance: openingBal,
              movements: finalMovements,
              totalDebit: totalDeb,
              totalCredit: totalCred,
              closingBalance: currentRunning,
            });
            return;
          }
        } catch (lineQueryErr) {
          console.warn('journal_entry_lines query notice:', lineQueryErr);
        }
      }

      // 3. Fallback: DataService.getLedger
      const localReport = await DataService.getLedger(targetAccount.id, fromDate, toDate);
      if (localReport) {
        setReport(localReport);
      } else {
        const fallbackBal = Number(targetAccount.balance ?? (targetAccount as any).current_balance ?? 0);
        setReport({
          account: targetAccount,
          startDate: fromDate,
          endDate: toDate,
          openingBalance: fallbackBal,
          movements: [],
          totalDebit: 0,
          totalCredit: 0,
          closingBalance: fallbackBal,
        });
      }
    } catch (err) {
      console.error('Error fetching ledger report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentAccountId) {
      fetchLedger(currentAccountId, startDate, endDate);
    }
  }, [currentAccountId, startDate, endDate, journals]);

  // Filter movements by search query in real time
  const displayedMovements = useMemo(() => {
    if (!report?.movements) return [];
    if (!searchQuery.trim()) return report.movements;
    const q = searchQuery.toLowerCase().trim();
    return report.movements.filter((m) =>
      (m.entryNumber && m.entryNumber.toLowerCase().includes(q)) ||
      (m.description && m.description.toLowerCase().includes(q)) ||
      (m.reference && m.reference.toLowerCase().includes(q)) ||
      (m.date && m.date.includes(q))
    );
  }, [report, searchQuery]);

  // Safe active report
  const activeReport: GeneralLedgerReport = report || {
    account: selectedAccount || {
      id: currentAccountId || '1120',
      code: selectedAccount?.code || '1120',
      nameAr: selectedAccount?.nameAr || 'العملاء وحسابات الذمم المدينة',
      nameEn: 'Accounts Receivable',
      category: 'ASSET',
      normalBalance: 'DEBIT',
      parentId: null,
      isSystem: false,
      isActive: true,
      level: 2,
      type: 'DETAIL',
      balance: 0,
    },
    startDate,
    endDate,
    openingBalance: Number(selectedAccount?.balance ?? (selectedAccount as any)?.current_balance ?? 0),
    movements: [],
    totalDebit: 0,
    totalCredit: 0,
    closingBalance: Number(selectedAccount?.balance ?? (selectedAccount as any)?.current_balance ?? 0),
  };

  return (
    <div className="flex flex-col gap-3 min-h-[calc(100vh-140px)]">
      {/* 1. Compact Horizontal Top Bar (Consolidates all filter controls) */}
      <div className="bg-white border border-[#E5E1DA] rounded-lg p-3 shadow-2xs no-print">
        <div className="flex flex-wrap items-center gap-3">
          {/* Account Selector */}
          <div className="flex-1 min-w-[280px]">
            <label className="block text-[11px] font-bold text-[#6E6659] mb-1">
              الحساب المحاسبي (Chart of Accounts)
            </label>
            <select
              id="gl-account-selector"
              value={currentAccountId}
              onChange={(e) => {
                const val = e.target.value;
                const match = accounts.find((a) => a.id === val || a.code === val);
                setCurrentAccountId(match ? match.id : val);
              }}
              className="w-full bg-[#FDFCFB] border border-[#E5E1DA] rounded-md px-3 py-1.5 text-xs text-[#1A1A1A] font-bold focus:outline-none focus:border-[#B8860B]"
            >
              {accounts.map((acc) => {
                const leaf = isAccountLeaf(acc, accounts);
                return (
                  <option key={acc.id} value={acc.id}>
                    {acc.code} - {acc.nameAr} [{leaf ? 'طرفي' : 'رئيسي'}]
                  </option>
                );
              })}
            </select>
          </div>

          {/* Date Range: من تاريخ */}
          <div className="w-36">
            <label className="block text-[11px] font-bold text-[#6E6659] mb-1">من تاريخ</label>
            <input
              id="gl-start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-[#FDFCFB] border border-[#E5E1DA] rounded-md px-2.5 py-1.5 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#B8860B]"
            />
          </div>

          {/* Date Range: إلى تاريخ */}
          <div className="w-36">
            <label className="block text-[11px] font-bold text-[#6E6659] mb-1">إلى تاريخ</label>
            <input
              id="gl-end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-[#FDFCFB] border border-[#E5E1DA] rounded-md px-2.5 py-1.5 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#B8860B]"
            />
          </div>

          {/* Search/Filter Input */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[11px] font-bold text-[#6E6659] mb-1">بحث في الحركات</label>
            <div className="relative">
              <input
                id="gl-search-input"
                type="text"
                placeholder="رقم القيد، المرجع، البيان..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#FDFCFB] border border-[#E5E1DA] rounded-md pr-8 pl-3 py-1.5 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#B8860B]"
              />
              <Search className="w-3.5 h-3.5 text-[#8C8273] absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* Actions: Refresh & Print */}
          <div className="flex items-center gap-2 self-end pb-0.5">
            <button
              id="gl-refresh-btn"
              onClick={() => fetchLedger(currentAccountId, startDate, endDate)}
              disabled={loading}
              title="تحديث البيانات"
              className="p-1.5 bg-[#F2EFE9] hover:bg-[#E5E1DA] text-[#1A1A1A] border border-[#E5E1DA] rounded-md text-xs font-bold transition-all cursor-pointer shadow-2xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#B8860B] ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              id="gl-print-btn"
              onClick={() => window.print()}
              className="px-3 py-1.5 bg-[#F2EFE9] hover:bg-[#E5E1DA] text-[#1A1A1A] border border-[#E5E1DA] rounded-md text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5 text-[#B8860B]" />
              <span>طباعة كشف الحساب</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Main Ledger View (Allocates 80%+ vertical space to the actual transactions grid) */}
      <div className="bg-white border border-[#E5E1DA] rounded-lg shadow-xs flex flex-col flex-1 min-h-[560px] overflow-hidden printable-card">
        {/* Compact Account Header Strip */}
        <div className="px-4 py-2.5 border-b border-[#E5E1DA] bg-[#FDFCFB] flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-[#B8860B] bg-[#F2EFE9] px-2.5 py-0.5 rounded border border-[#E5E1DA]">
              {activeReport.account.code}
            </span>
            <span className="font-serif font-bold text-[#1A1A1A] text-sm">{activeReport.account.nameAr}</span>
            <span
              className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${getCategoryBadgeClass(
                activeReport.account.category
              )}`}
            >
              {getCategoryLabelAr(activeReport.account.category)}
            </span>
            <span className="text-[#8C8273]">
              ({activeReport.account.normalBalance === 'DEBIT' ? 'طبيعة الحساب: مدين (Debit)' : 'طبيعة الحساب: دائن (Credit)'})
            </span>
            {!isSelectedLeaf && (
              <span className="inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded">
                <Layers className="w-3 h-3 text-amber-700" />
                حساب تجميعي
              </span>
            )}
          </div>

          <div className="text-[11px] text-[#8C8273]">
            الفترة: <span className="font-mono text-[#1A1A1A]">{activeReport.startDate}</span> إلى <span className="font-mono text-[#1A1A1A]">{activeReport.endDate}</span>
            {' • '}
            عدد الحركات: <span className="font-bold text-[#1A1A1A]">{displayedMovements.length}</span>
          </div>
        </div>

        {/* Dense Transactions Table with Vertical & Horizontal Scroll */}
        <div className="overflow-x-auto overflow-y-auto flex-1 max-h-[64vh]">
          <table className="w-full text-right text-xs border-collapse">
            <thead className="bg-[#F7F5F0] text-[#6E6659] font-serif font-bold border-b border-[#E5E1DA] sticky top-0 z-5">
              <tr>
                <th className="py-2.5 px-4 w-28">رقم القيد</th>
                <th className="py-2.5 px-4 w-28">التاريخ</th>
                <th className="py-2.5 px-4 w-28">رقم المرجع</th>
                <th className="py-2.5 px-4 min-w-[220px]">البيان والتفاصيل</th>
                <th className="py-2.5 px-4 w-32 text-left text-emerald-800">الطرف المدين (+)</th>
                <th className="py-2.5 px-4 w-32 text-left text-rose-800">الطرف الدائن (-)</th>
                <th className="py-2.5 px-4 w-36 text-left text-[#1A1A1A]">الرصيد التراكمي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E1DA]">
              {/* Opening Balance Row */}
              <tr className="bg-[#FAF9F5] italic text-[#6E6659] font-semibold font-serif">
                <td colSpan={3} className="py-2.5 px-4 text-neutral-400">
                  --
                </td>
                <td className="py-2.5 px-4">
                  الرصيد الافتتاحي السابق للفترة (Opening Balance)
                </td>
                <td className="py-2.5 px-4 text-left font-mono">-</td>
                <td className="py-2.5 px-4 text-left font-mono">-</td>
                <td className="py-2.5 px-4 text-left font-mono font-bold text-[#1A1A1A]">
                  {formatKWD3(activeReport.openingBalance)}
                </td>
              </tr>

              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#8C8273] font-serif italic">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 text-[#B8860B] animate-spin" />
                      <span>جاري تحديث كشف الحساب من القيود المحاسبية...</span>
                    </div>
                  </td>
                </tr>
              ) : displayedMovements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#8C8273] font-serif italic">
                    {searchQuery
                      ? 'لا توجد حركات مطابقة لمعيار البحث المحدد في كشف الحساب.'
                      : 'لا توجد حركات مرحّلة إضافية على هذا الحساب خلال الفترة المحددة.'}
                  </td>
                </tr>
              ) : (
                displayedMovements.map((m) => (
                  <tr key={m.id} className="hover:bg-[#FDFCFB] transition-colors">
                    <td className="py-2.5 px-4 font-mono font-bold text-[#B8860B] whitespace-nowrap">
                      {m.entryNumber}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-[#6E6659] whitespace-nowrap">
                      {m.date}
                    </td>
                    <td className="py-2.5 px-4 text-[#8C8273] whitespace-nowrap">
                      {m.reference || '-'}
                    </td>
                    <td className="py-2.5 px-4 font-serif text-[#1A1A1A]">
                      {m.description}
                    </td>
                    <td className="py-2.5 px-4 text-left font-mono font-bold text-[#2D6A4F] whitespace-nowrap">
                      {m.debit > 0 ? formatKWD3(m.debit) : '-'}
                    </td>
                    <td className="py-2.5 px-4 text-left font-mono font-bold text-[#9E2A2B] whitespace-nowrap">
                      {m.credit > 0 ? formatKWD3(m.credit) : '-'}
                    </td>
                    <td className="py-2.5 px-4 text-left font-mono font-bold text-[#1A1A1A] bg-[#FAF9F5] whitespace-nowrap">
                      {formatKWD3(m.runningBalance)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 3. Sticky Financial Summary Strip at Bottom */}
        <div className="sticky bottom-0 z-10 bg-[#FAF9F5] border-t-2 border-[#D8D2C6] px-4 py-2.5 shadow-md flex flex-wrap items-center justify-between gap-4 text-xs font-serif font-bold text-[#1A1A1A]">
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-1.5">
              <span className="text-[#6E6659]">الرصيد الافتتاحي:</span>
              <span className="font-mono text-xs sm:text-sm text-[#1A1A1A]">
                {formatKWD3(activeReport.openingBalance)}
              </span>
            </div>
            <span className="text-[#D8D2C6] hidden sm:inline">|</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[#2D6A4F]">إجمالي حركات المدين (+):</span>
              <span className="font-mono text-xs sm:text-sm text-[#2D6A4F]">
                {formatKWD3(activeReport.totalDebit)}
              </span>
            </div>
            <span className="text-[#D8D2C6] hidden sm:inline">|</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[#9E2A2B]">إجمالي حركات الدائن (-):</span>
              <span className="font-mono text-xs sm:text-sm text-[#9E2A2B]">
                {formatKWD3(activeReport.totalCredit)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-md border border-[#E5E1DA] shadow-2xs">
            <span className="text-[#1A1A1A]">الرصيد الختامي:</span>
            <span className="font-mono text-sm sm:text-base font-bold text-[#2D6A4F]">
              {formatKWD3(activeReport.closingBalance)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
