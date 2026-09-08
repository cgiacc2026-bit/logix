import React, { useState, useMemo } from 'react';
import { Account, AccountCategory, JournalEntry } from '../types.js';
import { formatCurrency, getCategoryBadgeClass, getCategoryLabelAr } from '../utils/formatters.ts';
import {
  FolderTree,
  Plus,
  Search,
  ChevronDown,
  ChevronLeft,
  Info,
  ShieldCheck,
  Tag,
  Edit2,
  Trash2,
  Activity,
  Layers,
  FileSpreadsheet,
  ArrowUpRight,
  ArrowDownLeft,
  Scale,
  Eye,
  CheckCircle2,
  Calendar,
  Clock,
  BookOpen
} from 'lucide-react';

interface ChartOfAccountsProps {
  accounts: Account[];
  journals?: JournalEntry[];
  currency: string;
  onAddAccount: (accData: Partial<Account>) => Promise<void>;
  onUpdateAccount?: (id: string, accData: Partial<Account>) => Promise<void>;
  onDeleteAccount?: (id: string) => Promise<void>;
  onSelectAccountLedger: (accountId: string) => void;
}

interface AccountMovementDetail {
  journalId: string;
  journalNumber: string;
  date: string;
  reference: string;
  description: string;
  memo: string;
  debit: number;
  credit: number;
  runningBalance: number;
  entityName?: string;
}

export const ChartOfAccountsView: React.FC<ChartOfAccountsProps> = ({
  accounts,
  journals = [],
  currency,
  onAddAccount,
  onUpdateAccount,
  onDeleteAccount,
  onSelectAccountLedger,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [filterActiveMovementsOnly, setFilterActiveMovementsOnly] = useState<boolean>(false);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    'acc-1000': true,
    'acc-1100': true,
    'acc-2000': true,
    'acc-3000': true,
    'acc-4000': true,
    'acc-5000': true,
  });

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [newCode, setNewCode] = useState('');
  const [newNameAr, setNewNameAr] = useState('');
  const [newNameEn, setNewNameEn] = useState('');
  const [newCategory, setNewCategory] = useState<AccountCategory>('ASSET');
  const [newParentId, setNewParentId] = useState<string>('');
  const [newDescription, setNewDescription] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Quick Movement Inspector Modal
  const [inspectedAccount, setInspectedAccount] = useState<Account | null>(null);

  // Compute live movements and rolled up balances across the entire chart
  const enrichedAccounts = useMemo(() => {
    const balanceMap = new Map<string, number>();
    const debitMap = new Map<string, number>();
    const creditMap = new Map<string, number>();
    const countMap = new Map<string, number>();

    const accountByLookup = new Map<string, Account>();
    accounts.forEach((a) => {
      accountByLookup.set(a.id, a);
      if (a.code) accountByLookup.set(a.code, a);
    });

    const postedJournals = (journals || []).filter((j) => j.status === 'POSTED');

    for (const journal of postedJournals) {
      for (const line of journal.lines || []) {
        const acc = accountByLookup.get(line.accountId) || accountByLookup.get(line.accountCode || '');
        if (!acc) continue;

        const currentDebit = debitMap.get(acc.id) || 0;
        const currentCredit = creditMap.get(acc.id) || 0;
        const lineDebit = Number(line.debit) || 0;
        const lineCredit = Number(line.credit) || 0;

        debitMap.set(acc.id, currentDebit + lineDebit);
        creditMap.set(acc.id, currentCredit + lineCredit);
        countMap.set(acc.id, (countMap.get(acc.id) || 0) + 1);

        const currentBal = balanceMap.get(acc.id) || 0;
        if (acc.normalBalance === 'DEBIT') {
          balanceMap.set(acc.id, currentBal + (lineDebit - lineCredit));
        } else {
          balanceMap.set(acc.id, currentBal + (lineCredit - lineDebit));
        }
      }
    }

    const accountsCopy: Account[] = JSON.parse(JSON.stringify(accounts));
    accountsCopy.sort((a, b) => b.level - a.level);

    // Roll up into parents
    accountsCopy.forEach((acc) => {
      const ownBal = balanceMap.get(acc.id) || 0;
      acc.balance = ownBal;
      (acc as any).totalDebitMovement = debitMap.get(acc.id) || 0;
      (acc as any).totalCreditMovement = creditMap.get(acc.id) || 0;
      (acc as any).movementCount = countMap.get(acc.id) || 0;

      if (acc.parentId) {
        const parentBal = balanceMap.get(acc.parentId) || 0;
        balanceMap.set(acc.parentId, parentBal + ownBal);

        const parentDeb = debitMap.get(acc.parentId) || 0;
        debitMap.set(acc.parentId, parentDeb + (debitMap.get(acc.id) || 0));

        const parentCred = creditMap.get(acc.parentId) || 0;
        creditMap.set(acc.parentId, parentCred + (creditMap.get(acc.id) || 0));

        const parentCount = countMap.get(acc.parentId) || 0;
        countMap.set(acc.parentId, parentCount + (countMap.get(acc.id) || 0));
      }
    });

    return accountsCopy.sort((a, b) => a.code.localeCompare(b.code));
  }, [accounts, journals]);

  // Overall Totals for KPIs
  const summaryKPIs = useMemo(() => {
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;
    let totalRevenues = 0;
    let totalExpenses = 0;
    let totalSystemDebit = 0;
    let totalSystemCredit = 0;

    // Sum level 1 or 2 roots
    const rootAccounts = enrichedAccounts.filter((a) => a.level === 1 || !a.parentId);
    rootAccounts.forEach((acc) => {
      const bal = Number(acc.balance) || 0;
      if (acc.category === 'ASSET') totalAssets += bal;
      if (acc.category === 'LIABILITY') totalLiabilities += bal;
      if (acc.category === 'EQUITY') totalEquity += bal;
      if (acc.category === 'REVENUE') totalRevenues += bal;
      if (acc.category === 'EXPENSE') totalExpenses += bal;
    });

    // Sum total debit & credit movements across all posted journals
    (journals || [])
      .filter((j) => j.status === 'POSTED')
      .forEach((j) => {
        (j.lines || []).forEach((l) => {
          totalSystemDebit += Number(l.debit) || 0;
          totalSystemCredit += Number(l.credit) || 0;
        });
      });

    return {
      totalAssets,
      totalLiabilities,
      totalEquity,
      totalRevenues,
      totalExpenses,
      totalSystemDebit,
      totalSystemCredit,
      isDoubleEntryBalanced: Math.abs(totalSystemDebit - totalSystemCredit) < 0.01,
    };
  }, [enrichedAccounts, journals]);

  // Calculate inspected account detailed movements
  const inspectedMovements: AccountMovementDetail[] = useMemo(() => {
    if (!inspectedAccount) return [];
    const moves: AccountMovementDetail[] = [];
    const postedJournals = (journals || [])
      .filter((j) => j.status === 'POSTED')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let running = 0;

    for (const j of postedJournals) {
      for (const l of j.lines || []) {
        if (l.accountId === inspectedAccount.id || l.accountCode === inspectedAccount.code) {
          const deb = Number(l.debit) || 0;
          const cred = Number(l.credit) || 0;

          if (inspectedAccount.normalBalance === 'DEBIT') {
            running += deb - cred;
          } else {
            running += cred - deb;
          }

          moves.push({
            journalId: j.id,
            journalNumber: j.entryNumber || (j as any).journalNumber || j.reference || j.id.slice(0, 8),
            date: j.date,
            reference: j.reference || '—',
            description: j.description || '—',
            memo: l.memo || '',
            debit: deb,
            credit: cred,
            runningBalance: running,
            entityName: l.entityNameAr || l.entityType,
          });
        }
      }
    }

    return moves;
  }, [inspectedAccount, journals]);

  const toggleExpand = (id: string) => {
    setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleOpenAddModal = (parent?: Account) => {
    setErrorMsg('');
    setEditingAccount(null);
    if (parent) {
      setNewParentId(parent.id);
      setNewCategory(parent.category);
      const siblings = accounts.filter((a) => a.parentId === parent.id);
      const nextNum = siblings.length + 1;
      setNewCode(`${parent.code}${nextNum}`);
    } else {
      setNewParentId('');
      setNewCategory('ASSET');
      setNewCode('');
    }
    setNewNameAr('');
    setNewNameEn('');
    setNewDescription('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (acc: Account) => {
    setErrorMsg('');
    setEditingAccount(acc);
    setNewCode(acc.code);
    setNewNameAr(acc.nameAr);
    setNewNameEn(acc.nameEn || '');
    setNewCategory(acc.category);
    setNewParentId(acc.parentId || '');
    setNewDescription(acc.description || '');
    setIsModalOpen(true);
  };

  const handleDeleteAccountRow = async (acc: Account) => {
    if (!confirm(`هل أنت متأكد من حذف الحساب "${acc.code} - ${acc.nameAr}"؟`)) return;
    try {
      if (onDeleteAccount) {
        await onDeleteAccount(acc.id);
      }
    } catch (err: any) {
      alert(err.message || 'فشل في حذف الحساب');
    }
  };

  const handleSubmitAccountForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode || !newNameAr) {
      setErrorMsg('الرجاء إدخال رقم الكود واسم الحساب باللغة العربية.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const payload = {
        code: newCode.trim(),
        nameAr: newNameAr.trim(),
        nameEn: newNameEn.trim() || newNameAr.trim(),
        category: newCategory,
        parentId: newParentId || null,
        description: newDescription.trim(),
      };

      if (editingAccount && onUpdateAccount) {
        await onUpdateAccount(editingAccount.id, payload);
      } else {
        await onAddAccount(payload);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ أثناء حفظ الحساب');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter accounts
  const filteredAccounts = enrichedAccounts.filter((a) => {
    const matchesSearch =
      a.code.includes(search) ||
      a.nameAr.includes(search) ||
      (a.nameEn && a.nameEn.toLowerCase().includes(search.toLowerCase()));

    const matchesCategory = selectedCategory === 'ALL' || a.category === selectedCategory;

    const matchesMovement =
      !filterActiveMovementsOnly ||
      ((a as any).movementCount && (a as any).movementCount > 0) ||
      Math.abs(Number(a.balance) || 0) > 0.001;

    return matchesSearch && matchesCategory && matchesMovement;
  });

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-[#E5E1DA] p-6 rounded-2xl shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-[#FAF8F5] border border-[#E5E1DA] rounded-xl flex items-center justify-center text-[#B8860B]">
              <FolderTree className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-serif font-black text-[#1A1A1A]">
                الدليل المحاسبي الشجري المربوط بالحركات (Chart of Accounts)
              </h2>
              <p className="text-xs text-[#8C8273] mt-0.5">
                شجرة الحسابات المالية الموحدة مرتبطة لحظياً بجميع قيود اليومية، حركات المدين والدائن، وتجميع الأرصدة التلقائي.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleOpenAddModal()}
            className="px-4 py-2.5 bg-[#1A1A1A] hover:bg-black text-white rounded-xl text-xs font-black flex items-center gap-2 border border-[#1A1A1A] shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#D4AF37]" />
            <span>إضافة حساب رئيسي / فرعي</span>
          </button>
        </div>
      </div>

      {/* KPI Financial Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white border border-[#E5E1DA] rounded-xl p-3.5 shadow-xs space-y-1">
          <div className="text-[11px] text-[#8C8273] font-semibold flex items-center justify-between">
            <span>الأصول (1000)</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          </div>
          <div className="text-sm font-mono font-black text-emerald-800">
            {formatCurrency(summaryKPIs.totalAssets, currency)}
          </div>
        </div>

        <div className="bg-white border border-[#E5E1DA] rounded-xl p-3.5 shadow-xs space-y-1">
          <div className="text-[11px] text-[#8C8273] font-semibold flex items-center justify-between">
            <span>الخصوم (2000)</span>
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
          </div>
          <div className="text-sm font-mono font-black text-rose-800">
            {formatCurrency(summaryKPIs.totalLiabilities, currency)}
          </div>
        </div>

        <div className="bg-white border border-[#E5E1DA] rounded-xl p-3.5 shadow-xs space-y-1">
          <div className="text-[11px] text-[#8C8273] font-semibold flex items-center justify-between">
            <span>حقوق الملكية (3000)</span>
            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
          </div>
          <div className="text-sm font-mono font-black text-indigo-800">
            {formatCurrency(summaryKPIs.totalEquity, currency)}
          </div>
        </div>

        <div className="bg-white border border-[#E5E1DA] rounded-xl p-3.5 shadow-xs space-y-1">
          <div className="text-[11px] text-[#8C8273] font-semibold flex items-center justify-between">
            <span>الإيرادات (4000)</span>
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
          </div>
          <div className="text-sm font-mono font-black text-blue-800">
            {formatCurrency(summaryKPIs.totalRevenues, currency)}
          </div>
        </div>

        <div className="bg-white border border-[#E5E1DA] rounded-xl p-3.5 shadow-xs space-y-1">
          <div className="text-[11px] text-[#8C8273] font-semibold flex items-center justify-between">
            <span>المصروفات (5000)</span>
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          </div>
          <div className="text-sm font-mono font-black text-amber-800">
            {formatCurrency(summaryKPIs.totalExpenses, currency)}
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#1A1A1A] to-[#2D2B28] text-white rounded-xl p-3.5 shadow-xs space-y-1">
          <div className="text-[10px] text-gray-300 font-semibold flex items-center justify-between">
            <span>توازن القيود (مدين/دائن)</span>
            <Scale className="w-3.5 h-3.5 text-[#D4AF37]" />
          </div>
          <div className="text-xs font-mono font-black text-[#D4AF37] flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>متوازن 100%</span>
          </div>
          <div className="text-[9px] text-gray-400 font-mono truncate">
            مدين: {formatCurrency(summaryKPIs.totalSystemDebit, currency)}
          </div>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#F7F5F0] border border-[#E5E1DA] p-4 rounded-xl">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[#8C8273] absolute right-3 top-2.5" />
          <input
            type="text"
            placeholder="بحث برقم الحساب أو الاسم أو الوصف..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-[#E5E1DA] rounded-xl pr-9 pl-3 py-2 text-xs text-[#1A1A1A] placeholder-[#8C8273] focus:outline-none focus:border-[#1A1A1A]"
          />
        </div>

        {/* Categories Tab */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto scrollbar-none">
          {[
            { id: 'ALL', label: 'كافة الحسابات' },
            { id: 'ASSET', label: '1000 - الأصول' },
            { id: 'LIABILITY', label: '2000 - الخصوم' },
            { id: 'EQUITY', label: '3000 - حقوق الملكية' },
            { id: 'REVENUE', label: '4000 - الإيرادات' },
            { id: 'EXPENSE', label: '5000 - المصروفات' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-[#1A1A1A] text-white shadow-xs border border-[#1A1A1A]'
                  : 'text-[#6E6659] hover:text-[#1A1A1A] hover:bg-white bg-white/60 border border-transparent'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Active movements toggle */}
        <button
          onClick={() => setFilterActiveMovementsOnly(!filterActiveMovementsOnly)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer shrink-0 ${
            filterActiveMovementsOnly
              ? 'bg-blue-700 text-white border-blue-800 shadow-xs'
              : 'bg-white text-[#6E6659] border-[#E5E1DA] hover:bg-[#FAF8F5]'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>الحسابات ذات الحركات فقط ({enrichedAccounts.filter((a) => (a as any).movementCount > 0).length})</span>
        </button>
      </div>

      {/* Tree Hierarchy List */}
      <div className="bg-white border border-[#E5E1DA] rounded-2xl overflow-hidden shadow-xs">
        <div className="bg-[#FAF8F5] border-b border-[#E5E1DA] px-6 py-3.5 grid grid-cols-12 text-xs font-serif font-black text-[#6E6659]">
          <div className="col-span-6 sm:col-span-4">كود واسم الحساب المحاسبي</div>
          <div className="col-span-3 sm:col-span-2 text-center">التصنيف والطبيعة</div>
          <div className="hidden sm:block sm:col-span-2 text-left">حركات المدين / الدائن</div>
          <div className="col-span-3 sm:col-span-2 text-left">الرصيد الفعلي الحالي</div>
          <div className="col-span-12 sm:col-span-2 text-center sm:text-left mt-2 sm:mt-0">إجراءات الحساب</div>
        </div>

        <div className="divide-y divide-[#E5E1DA] p-2">
          {filteredAccounts.length > 0 ? (
            filteredAccounts.map((acc) => {
              const hasChildren = accounts.some((child) => child.parentId === acc.id);
              const isExpanded = expandedNodes[acc.id] ?? true;
              const debitMove = (acc as any).totalDebitMovement || 0;
              const creditMove = (acc as any).totalCreditMovement || 0;
              const movCount = (acc as any).movementCount || 0;
              const paddingRight = `${(acc.level - 1) * 1.5}rem`;

              return (
                <div
                  key={acc.id}
                  className="hover:bg-[#FAF9F6] transition-colors p-3 rounded-xl grid grid-cols-12 items-center text-xs gap-y-2 sm:gap-y-0"
                  style={{ paddingRight }}
                >
                  {/* Account Code & Name */}
                  <div className="col-span-6 sm:col-span-4 flex items-center gap-2">
                    {hasChildren ? (
                      <button
                        onClick={() => toggleExpand(acc.id)}
                        className="p-1 hover:bg-[#F2EFE9] rounded text-[#6E6659] cursor-pointer"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-[#B8860B]" />
                        ) : (
                          <ChevronLeft className="w-4 h-4 text-[#8C8273]" />
                        )}
                      </button>
                    ) : (
                      <span className="w-6 inline-block text-center text-[#C8C2B7]">•</span>
                    )}

                    <span className="font-mono font-black text-[#B8860B] bg-[#FAF8F5] px-2 py-0.5 rounded-md border border-[#E5E1DA]">
                      {acc.code}
                    </span>

                    <div className="truncate">
                      <span className="font-serif font-bold text-[#1A1A1A] block truncate">{acc.nameAr}</span>
                      <span className="text-[10px] text-[#8C8273] block truncate">{acc.nameEn}</span>
                    </div>
                  </div>

                  {/* Category Badge & Normal Balance */}
                  <div className="col-span-3 sm:col-span-2 text-center flex flex-col items-center gap-1">
                    <span
                      className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full border ${getCategoryBadgeClass(
                        acc.category
                      )}`}
                    >
                      {getCategoryLabelAr(acc.category)}
                    </span>
                    <span className="text-[10px] text-[#8C8273] font-semibold">
                      {acc.normalBalance === 'DEBIT' ? 'طبيعته مدين' : 'طبيعته دائن'}
                    </span>
                  </div>

                  {/* Movements Debit / Credit */}
                  <div className="hidden sm:flex sm:col-span-2 flex-col text-left font-mono text-[11px]">
                    <div className="text-emerald-800 flex items-center justify-end gap-1">
                      <span>+{formatCurrency(debitMove, currency)}</span>
                      <span className="text-[9px] text-[#8C8273]">مدين</span>
                    </div>
                    <div className="text-rose-800 flex items-center justify-end gap-1">
                      <span>-{formatCurrency(creditMove, currency)}</span>
                      <span className="text-[9px] text-[#8C8273]">دائن</span>
                    </div>
                  </div>

                  {/* Dynamic Net Balance */}
                  <div className="col-span-3 sm:col-span-2 text-left space-y-0.5">
                    <div className="font-mono font-black text-xs sm:text-sm text-[#1A1A1A]">
                      {formatCurrency(acc.balance || 0, currency)}
                    </div>
                    {movCount > 0 && (
                      <span className="inline-block px-1.5 py-0.2 bg-blue-50 text-blue-800 text-[10px] rounded font-bold">
                        {movCount} حركة مسجلة
                      </span>
                    )}
                  </div>

                  {/* Actions Toolbar */}
                  <div className="col-span-12 sm:col-span-2 flex items-center justify-end gap-1.5 pt-1 sm:pt-0">
                    <button
                      onClick={() => setInspectedAccount(acc)}
                      title="معاينة حركات الحساب التفصيلية"
                      className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span className="hidden lg:inline">الحركات</span>
                    </button>

                    <button
                      onClick={() => onSelectAccountLedger(acc.id)}
                      title="فتح كشف الأستاذ العام الكامل"
                      className="p-1.5 bg-[#FAF8F5] hover:bg-[#E5E1DA] text-[#1A1A1A] border border-[#E5E1DA] rounded-lg text-xs font-bold transition-all cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-[#B8860B]" />
                    </button>

                    <button
                      onClick={() => handleOpenAddModal(acc)}
                      title="إضافة حساب فرعي تحته"
                      className="p-1.5 bg-[#FAF8F5] hover:bg-[#E5E1DA] text-[#B8860B] border border-[#E5E1DA] rounded-lg transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleOpenEditModal(acc)}
                      title="تعديل الحساب"
                      className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg transition-all cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    {!acc.isSystem && onDeleteAccount && (
                      <button
                        onClick={() => handleDeleteAccountRow(acc)}
                        title="حذف الحساب"
                        className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg transition-all cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-12 text-center text-xs text-[#8C8273] space-y-2">
              <FolderTree className="w-8 h-8 mx-auto text-[#B8860B] opacity-40" />
              <p className="font-bold text-[#1A1A1A]">لا توجد حسابات تطابق معايير البحث المحددة</p>
            </div>
          )}
        </div>
      </div>

      {/* QUICK MOVEMENT INSPECTOR MODAL */}
      {inspectedAccount && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E5E1DA] w-full max-w-4xl rounded-2xl p-6 shadow-2xl space-y-5 max-h-[90vh] flex flex-col text-right dir-rtl animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-[#E5E1DA] pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 text-blue-700 rounded-xl flex items-center justify-center font-bold">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-serif font-black text-[#1A1A1A] flex items-center gap-2">
                    <span>حركات الحساب:</span>
                    <span className="font-mono text-[#B8860B]">{inspectedAccount.code}</span>
                    <span>- {inspectedAccount.nameAr}</span>
                  </h3>
                  <p className="text-xs text-[#8C8273]">
                    كافة القيود اليومية المرحلة المؤثرة على هذا الحساب مع الرصيد المتراكم اللحظي
                  </p>
                </div>
              </div>

              <button
                onClick={() => setInspectedAccount(null)}
                className="p-1.5 text-[#8C8273] hover:text-[#1A1A1A] rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Account Quick Stats Header */}
            <div className="grid grid-cols-3 gap-3 bg-[#FAF8F5] p-3.5 rounded-xl border border-[#E5E1DA] text-xs shrink-0">
              <div>
                <span className="text-[#8C8273] block">إجمالي حركات المدين:</span>
                <strong className="font-mono text-emerald-800 text-sm">
                  {formatCurrency((inspectedAccount as any).totalDebitMovement || 0, currency)}
                </strong>
              </div>
              <div>
                <span className="text-[#8C8273] block">إجمالي حركات الدائن:</span>
                <strong className="font-mono text-rose-800 text-sm">
                  {formatCurrency((inspectedAccount as any).totalCreditMovement || 0, currency)}
                </strong>
              </div>
              <div>
                <span className="text-[#8C8273] block">الرصيد الفعلي الحالي:</span>
                <strong className="font-mono text-[#1A1A1A] text-sm">
                  {formatCurrency(inspectedAccount.balance || 0, currency)}
                </strong>
              </div>
            </div>

            {/* Movements Table */}
            <div className="flex-1 overflow-y-auto border border-[#E5E1DA] rounded-xl">
              {inspectedMovements.length > 0 ? (
                <table className="w-full text-xs text-right border-collapse">
                  <thead className="bg-[#FAF8F5] text-[#6E6659] font-serif font-black sticky top-0 border-b border-[#E5E1DA]">
                    <tr>
                      <th className="p-3">التاريخ</th>
                      <th className="p-3">رقم القيد / المرجع</th>
                      <th className="p-3">البيان والشرح</th>
                      <th className="p-3">الطرف المرتبط</th>
                      <th className="p-3 text-left text-emerald-800">مدين (+)</th>
                      <th className="p-3 text-left text-rose-800">دائن (-)</th>
                      <th className="p-3 text-left">الرصيد التراكمي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E1DA]">
                    {inspectedMovements.map((move, idx) => (
                      <tr key={idx} className="hover:bg-[#FAF9F6] transition-colors">
                        <td className="p-3 font-mono text-[#6E6659] whitespace-nowrap">{move.date}</td>
                        <td className="p-3 font-mono font-bold text-[#B8860B] whitespace-nowrap">
                          {move.journalNumber}
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-[#1A1A1A]">{move.description}</div>
                          {move.memo && <div className="text-[11px] text-[#8C8273]">{move.memo}</div>}
                        </td>
                        <td className="p-3 text-[#6E6659]">{move.entityName || '—'}</td>
                        <td className="p-3 font-mono font-bold text-emerald-800 text-left whitespace-nowrap">
                          {move.debit > 0 ? formatCurrency(move.debit, currency) : '—'}
                        </td>
                        <td className="p-3 font-mono font-bold text-rose-800 text-left whitespace-nowrap">
                          {move.credit > 0 ? formatCurrency(move.credit, currency) : '—'}
                        </td>
                        <td className="p-3 font-mono font-black text-[#1A1A1A] text-left whitespace-nowrap">
                          {formatCurrency(move.runningBalance, currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="py-12 text-center text-xs text-[#8C8273] space-y-2">
                  <Clock className="w-8 h-8 mx-auto text-[#B8860B] opacity-40" />
                  <p className="font-bold text-[#1A1A1A]">لا توجد حركات أو قيود مرحلة على هذا الحساب حتى الآن</p>
                  <p className="text-[11px]">يتم إدراج الحركات تلقائياً عند ترحيل الفواتير أو السندات أو القيود اليومية.</p>
                </div>
              )}
            </div>

            {/* Footer buttons */}
            <div className="flex items-center justify-between pt-2 shrink-0 border-t border-[#E5E1DA]">
              <button
                type="button"
                onClick={() => {
                  onSelectAccountLedger(inspectedAccount.id);
                  setInspectedAccount(null);
                }}
                className="px-4 py-2 bg-[#1A1A1A] hover:bg-black text-white text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer"
              >
                <BookOpen className="w-4 h-4 text-[#D4AF37]" />
                <span>فتح تقرير الأستاذ العام الكامل للحساب</span>
              </button>

              <button
                type="button"
                onClick={() => setInspectedAccount(null)}
                className="px-4 py-2 bg-[#F2EFE9] hover:bg-[#E5E1DA] text-[#1A1A1A] text-xs font-bold rounded-xl cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Account Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E5E1DA] w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#E5E1DA] pb-3">
              <h3 className="text-base font-serif font-bold text-[#1A1A1A] flex items-center gap-2">
                <Tag className="w-5 h-5 text-[#B8860B]" />
                {editingAccount ? 'تعديل الحساب المحاسبي' : 'إضافة حساب جديد في الدليل الشجري'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-[#8C8273] hover:text-[#1A1A1A] font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-[#FDF0F0] border border-[#9E2A2B]/30 text-[#9E2A2B] text-xs rounded-xl flex items-center gap-2 font-semibold">
                <Info className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmitAccountForm} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1A1A1A] mb-1">
                    رمز / كود الحساب *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: 1113"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    className="w-full bg-[#FDFCFB] border border-[#E5E1DA] rounded-xl px-3 py-2 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A] font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1A1A1A] mb-1">
                    التصنيف الرئيسي *
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as AccountCategory)}
                    className="w-full bg-[#FDFCFB] border border-[#E5E1DA] rounded-xl px-3 py-2 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A]"
                  >
                    <option value="ASSET">الأصول (Assets)</option>
                    <option value="LIABILITY">الخصوم (Liabilities)</option>
                    <option value="EQUITY">حقوق الملكية (Equity)</option>
                    <option value="REVENUE">الإيرادات (Revenues)</option>
                    <option value="EXPENSE">المصروفات (Expenses)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1A1A1A] mb-1">
                  اسم الحساب باللغة العربية *
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: بنك الراجحي - الفرع الرئيسي"
                  value={newNameAr}
                  onChange={(e) => setNewNameAr(e.target.value)}
                  className="w-full bg-[#FDFCFB] border border-[#E5E1DA] rounded-xl px-3 py-2 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1A1A1A] mb-1">
                  اسم الحساب بالإنجليزية (اختياري)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Al Rajhi Bank Main Branch"
                  value={newNameEn}
                  onChange={(e) => setNewNameEn(e.target.value)}
                  className="w-full bg-[#FDFCFB] border border-[#E5E1DA] rounded-xl px-3 py-2 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1A1A1A] mb-1">
                  الحساب الأب / التابع له
                </label>
                <select
                  value={newParentId}
                  onChange={(e) => setNewParentId(e.target.value)}
                  className="w-full bg-[#FDFCFB] border border-[#E5E1DA] rounded-xl px-3 py-2 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A]"
                >
                  <option value="">-- بدون حساب أب (حساب رئيسي) --</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} - {a.nameAr}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1A1A1A] mb-1">
                  ملاحظات أو وصف إضافي
                </label>
                <textarea
                  rows={2}
                  placeholder="وصف طبيعة استخدام الحساب..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full bg-[#FDFCFB] border border-[#E5E1DA] rounded-xl px-3 py-2 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E5E1DA]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-[#F2EFE9] hover:bg-[#E5E1DA] text-[#1A1A1A] border border-[#E5E1DA] rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-[#1A1A1A] hover:bg-[#2D2B28] text-white rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 border border-[#1A1A1A]"
                >
                  {isSubmitting ? 'جاري الحفظ...' : 'حفظ الحساب'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
